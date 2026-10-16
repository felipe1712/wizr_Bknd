import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface YouTubeSearchRequest {
  query: string;
  maxResults?: number;
  uploadDate?: "lastHour" | "today" | "thisWeek" | "thisMonth" | "thisYear";
  sortBy?: "relevance" | "date" | "viewCount" | "rating";
  channelId?: string;
}

interface YouTubeVideoSnippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: Record<string, { url: string; width: number; height: number }>;
  channelTitle: string;
  liveBroadcastContent: string;
}

interface YouTubeSearchItem {
  id: { kind: string; videoId?: string; channelId?: string; playlistId?: string };
  snippet: YouTubeVideoSnippet;
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
  pageInfo: { totalResults: number; resultsPerPage: number };
  nextPageToken?: string;
}

interface YouTubeVideoStats {
  id: string;
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}

interface YouTubeVideosResponse {
  items: YouTubeVideoStats[];
}

// Map our upload date filter to YouTube API's publishedAfter parameter
function getPublishedAfter(uploadDate?: string): string | undefined {
  if (!uploadDate) return undefined;
  const now = new Date();
  switch (uploadDate) {
    case "lastHour":
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case "thisWeek":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "thisMonth":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "thisYear":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
}

// Map sortBy to YouTube API order parameter
function getOrder(sortBy?: string): string {
  switch (sortBy) {
    case "date": return "date";
    case "viewCount": return "viewCount";
    case "rating": return "rating";
    default: return "relevance";
  }
}

// Wrap multi-word queries in quotes for exact matching on YouTube
function buildExactQuery(query: string): string {
  const trimmed = query.trim();
  // Already quoted
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;
  // Multi-word → wrap in quotes for exact phrase match
  if (trimmed.includes(" ")) return `"${trimmed}"`;
  return trimmed;
}

// Spanish/English stopwords that should never count alone as a relevance match
const STOPWORDS = new Set([
  "de","del","la","el","los","las","un","una","y","o","en","a","al","por","para","con","sin","que","es","se",
  "the","of","and","or","in","on","at","to","for","a","an","is","it"
]);

// Extract meaningful keyword tokens (≥3 chars, not stopwords) for relevance scoring
function extractKeywordTokens(query: string): string[] {
  const cleaned = query.replace(/"/g, "").toLowerCase();
  return cleaned.split(/\s+/).filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

// Relevance rule: prefer exact-phrase match; otherwise require ≥2 distinct meaningful tokens
// (or all of them if the query has fewer than 2). This prevents single-token false positives
// like "Camino de Guanajuato" matching a query for "Las Libres Guanajuato".
function isRelevantResult(title: string, description: string, channelTitle: string, keywords: string[], originalQuery: string): boolean {
  const haystack = `${title} ${description} ${channelTitle}`.toLowerCase();
  const phrase = originalQuery.replace(/"/g, "").trim().toLowerCase();
  if (phrase.length >= 4 && haystack.includes(phrase)) return true;
  if (keywords.length === 0) return true;
  const matched = keywords.filter(kw => haystack.includes(kw)).length;
  const required = Math.min(keywords.length, 2);
  return matched >= required;
}

// Parse ISO 8601 duration (PT1H2M3S) to seconds
function parseDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) +
         (parseInt(match[2] || "0") * 60) +
         parseInt(match[3] || "0");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "YOUTUBE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: YouTubeSearchRequest = await req.json();
    const { query, maxResults = 25, uploadDate, sortBy, channelId } = body;

    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const exactQuery = buildExactQuery(query);
    const relevanceTokens = extractKeywordTokens(query);

    console.log(`YouTube API search: original="${query}" exact="${exactQuery}" tokens=${JSON.stringify(relevanceTokens)} maxResults=${maxResults}`);

    // Step 1: Search for videos (with exact-match quoting)
    const searchParams = new URLSearchParams({
      part: "snippet",
      q: exactQuery,
      type: "video",
      maxResults: String(Math.min(maxResults, 50)),
      order: getOrder(sortBy),
      key: apiKey,
    });

    if (channelId) {
      searchParams.set("channelId", channelId);
    }

    const publishedAfter = getPublishedAfter(uploadDate);
    if (publishedAfter) {
      searchParams.set("publishedAfter", publishedAfter);
    }

    // Paginate if more than 50 results requested
    const allSearchItems: YouTubeSearchItem[] = [];
    let pageToken: string | undefined;
    const maxPages = Math.ceil(Math.min(maxResults, 200) / 50);

    for (let page = 0; page < maxPages; page++) {
      if (pageToken) {
        searchParams.set("pageToken", pageToken);
      }
      // Adjust maxResults for last page
      const remaining = maxResults - allSearchItems.length;
      searchParams.set("maxResults", String(Math.min(remaining, 50)));

      const searchUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams}`;
      const searchRes = await fetch(searchUrl);

      if (!searchRes.ok) {
        const errBody = await searchRes.text();
        console.error("YouTube search API error:", searchRes.status, errBody);
        
        if (searchRes.status === 403) {
          return new Response(
            JSON.stringify({ success: false, error: "YouTube API quota exceeded. Try again tomorrow." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: false, error: `YouTube API error: ${searchRes.status}` }),
          { status: searchRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const searchData: YouTubeSearchResponse = await searchRes.json();
      const videoItems = (searchData.items || []).filter(item => item.id?.videoId);
      allSearchItems.push(...videoItems);

      pageToken = searchData.nextPageToken;
      if (!pageToken || allSearchItems.length >= maxResults) break;
    }

    if (allSearchItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          items: [],
          totalResults: 0,
          quotaCost: maxPages, // Each search.list costs 100 units
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get video statistics + duration in batches of 50
    const videoIds = allSearchItems.map(item => item.id.videoId!);
    const allStats: YouTubeVideoStats[] = [];

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({
        part: "statistics,contentDetails",
        id: batch.join(","),
        key: apiKey,
      })}`;

      const statsRes = await fetch(statsUrl);
      if (statsRes.ok) {
        const statsData: YouTubeVideosResponse = await statsRes.json();
        allStats.push(...(statsData.items || []));
      }
    }

    // Build stats lookup
    const statsMap = new Map<string, YouTubeVideoStats>();
    for (const s of allStats) {
      statsMap.set(s.id, s);
    }

    // Step 3: Normalize results into our standard format
    const items = allSearchItems.map(item => {
      const videoId = item.id.videoId!;
      const stats = statsMap.get(videoId);
      const duration = parseDuration(stats?.contentDetails?.duration);
      const isShort = duration > 0 && duration <= 60;
      const views = parseInt(stats?.statistics?.viewCount || "0");
      const likes = parseInt(stats?.statistics?.likeCount || "0");
      const comments = parseInt(stats?.statistics?.commentCount || "0");

      return {
        id: videoId,
        platform: isShort ? "youtube_shorts" : "youtube",
        title: item.snippet.title,
        description: item.snippet.description,
        author: {
          name: item.snippet.channelTitle,
          username: item.snippet.channelId,
          url: `https://youtube.com/channel/${item.snippet.channelId}`,
        },
        metrics: {
          likes,
          comments,
          shares: 0,
          views,
          engagement: views > 0 ? Math.round(((likes + comments) / views) * 10000) / 100 : 0,
        },
        publishedAt: item.snippet.publishedAt,
        url: isShort
          ? `https://youtube.com/shorts/${videoId}`
          : `https://youtube.com/watch?v=${videoId}`,
        contentType: isShort ? "video" : "video",
        hashtags: [],
        mentions: [],
        raw: {
          _source: "youtube_api_v3",
          _duration: duration,
          _isShort: isShort,
          thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        },
      };
    });

    // Step 4: Post-search relevance filter — discard results that don't mention any keyword
    const rawCount = items.length;
    const relevantItems = items.filter(item =>
      isRelevantResult(item.title, item.description, item.author.name, relevanceTokens, query)
    );
    const discardedCount = rawCount - relevantItems.length;

    // Sort by date (newest first) by default, unless sorted by relevance/viewCount
    if (sortBy === "date" || !sortBy) {
      relevantItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }

    console.log(`YouTube API: ${rawCount} raw → ${relevantItems.length} relevant (${discardedCount} discarded, ${relevantItems.filter(i => i.raw._isShort).length} shorts)`);

    return new Response(
      JSON.stringify({
        success: true,
        items: relevantItems,
        totalResults: relevantItems.length,
        rawCount,
        discardedCount,
        quotaCost: maxPages + Math.ceil(videoIds.length / 50),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("youtube-search error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
