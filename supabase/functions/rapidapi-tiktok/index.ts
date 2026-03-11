import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RAPIDAPI_HOST = "tiktok-api23.p.rapidapi.com";

interface SearchRequest {
  action: "search" | "user_posts" | "hashtag";
  keyword?: string;
  username?: string;
  hashtag?: string;
  count?: number;
  cursor?: number;
}

interface NormalizedResult {
  id: string;
  platform: "tiktok";
  title: string;
  description: string;
  author: {
    name: string;
    username: string;
    url: string;
    avatarUrl?: string;
    verified?: boolean;
    followers?: number;
  };
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
    engagement?: number;
  };
  publishedAt: string;
  url: string;
  contentType: "video";
  hashtags?: string[];
  mentions?: string[];
  raw: Record<string, unknown>;
}

function get(obj: unknown, path: string, defaultValue: unknown = undefined): unknown {
  if (!obj || typeof obj !== "object") return defaultValue;
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue;
    if (typeof current !== "object") return defaultValue;
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? defaultValue;
}

function parseDate(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "number") {
    const timestamp = value > 1e12 ? value : value * 1000;
    return new Date(timestamp).toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? matches.map((h) => h.substring(1)) : [];
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w]+/g);
  return matches ? matches.map((m) => m.substring(1)) : [];
}

function calculateEngagement(metrics: { likes: number; comments: number; shares: number; views?: number }): number {
  const totalInteractions = metrics.likes + metrics.comments + metrics.shares;
  if (metrics.views && metrics.views > 0) {
    return Math.round((totalInteractions / metrics.views) * 10000) / 100;
  }
  return totalInteractions;
}

function normalizeSearchItem(item: Record<string, unknown>, index: number): NormalizedResult {
  // RapidAPI tiktok-api23 search response format
  // The response typically wraps video data in item_list or data arrays
  const author = (get(item, "author") as Record<string, unknown>) || {};
  const stats = (get(item, "statistics") as Record<string, unknown>) ||
    (get(item, "stats") as Record<string, unknown>) || {};

  const desc = String(
    get(item, "desc") ||
    get(item, "title") ||
    get(item, "description") ||
    get(item, "video_description") ||
    ""
  );

  const username = String(
    get(author, "unique_id") ||
    get(author, "uniqueId") ||
    get(author, "username") ||
    get(item, "author_unique_id") ||
    ""
  );

  const displayName = String(
    get(author, "nickname") ||
    get(author, "nick_name") ||
    username
  );

  const metrics = {
    likes: Number(
      get(stats, "digg_count") || get(stats, "diggCount") || get(stats, "like_count") ||
      get(item, "digg_count") || get(item, "likes") || get(item, "like_count") || 0
    ),
    comments: Number(
      get(stats, "comment_count") || get(stats, "commentCount") ||
      get(item, "comment_count") || get(item, "comments") || 0
    ),
    shares: Number(
      get(stats, "share_count") || get(stats, "shareCount") ||
      get(item, "share_count") || get(item, "shares") || 0
    ),
    views: Number(
      get(stats, "play_count") || get(stats, "playCount") ||
      get(item, "play_count") || get(item, "views") || get(item, "view_count") || 0
    ),
  };

  const videoId = String(
    get(item, "aweme_id") || get(item, "id") || get(item, "video_id") || ""
  );

  const shareUrl = String(
    get(item, "share_url") || get(item, "url") || get(item, "webVideoUrl") || ""
  );
  const url = shareUrl || (username && videoId
    ? `https://www.tiktok.com/@${username}/video/${videoId}`
    : videoId
      ? `https://www.tiktok.com/video/${videoId}`
      : "");

  const avatarUrl = String(
    get(author, "avatar_thumb") ||
    get(author, "avatar_medium") ||
    get(author, "avatar_larger") ||
    get(author, "avatar") ||
    ""
  );

  // Handle hashtag/challenge array from TikTok
  const challenges = get(item, "challenges") as Array<Record<string, unknown>> | undefined;
  const textTags = get(item, "text_extra") as Array<Record<string, unknown>> | undefined;
  let hashtags: string[] = [];
  if (challenges && Array.isArray(challenges)) {
    hashtags = challenges.map((c) => String(get(c, "title") || get(c, "cha_name") || "")).filter(Boolean);
  } else if (textTags && Array.isArray(textTags)) {
    hashtags = textTags
      .filter((t) => get(t, "type") === 1 || get(t, "hashtag_name"))
      .map((t) => String(get(t, "hashtag_name") || ""))
      .filter(Boolean);
  }
  if (hashtags.length === 0) {
    hashtags = extractHashtags(desc);
  }

  return {
    id: `tiktok-${videoId || index}-${Date.now()}`,
    platform: "tiktok",
    title: desc.substring(0, 100) + (desc.length > 100 ? "..." : ""),
    description: desc,
    author: {
      name: displayName,
      username,
      url: username ? `https://tiktok.com/@${username}` : "",
      avatarUrl,
      verified: Boolean(get(author, "verification_type") || get(author, "verified")),
      followers: Number(get(author, "follower_count") || get(author, "fans") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(
      get(item, "create_time") || get(item, "createTime") || get(item, "created_at")
    ),
    url,
    contentType: "video",
    hashtags,
    mentions: extractMentions(desc),
    raw: item,
  };
}

async function fetchRapidAPI(
  path: string,
  params: Record<string, string>,
  apiKey: string
): Promise<unknown> {
  const url = new URL(`https://${RAPIDAPI_HOST}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  console.log(`RapidAPI TikTok request: GET ${url.pathname}?${url.searchParams.toString()}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`RapidAPI error ${response.status}:`, errorText);
      throw new Error(`RapidAPI error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("RapidAPI request timeout (30s)");
    }
    throw err;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
    if (!RAPIDAPI_KEY) {
      throw new Error("RAPIDAPI_KEY not configured");
    }

    const body: SearchRequest = await req.json();
    console.log("RapidAPI TikTok request:", JSON.stringify(body));

    const count = Math.min(body.count || 30, 100);
    let items: Record<string, unknown>[] = [];
    let cursor = body.cursor || 0;
    let hasMore = false;

    if (body.action === "search") {
      if (!body.keyword) {
        throw new Error("keyword is required for search action");
      }

      // Use the search/general endpoint (search videos by keyword)
      const data = await fetchRapidAPI("/api/search/general", {
        keyword: body.keyword,
        count: String(count),
        cursor: String(cursor),
      }, RAPIDAPI_KEY) as Record<string, unknown>;

      console.log("RapidAPI search response keys:", Object.keys(data));

      // Extract items from various possible response structures
      const dataObj = (data.data as Record<string, unknown>) || data;
      const rawItems = (
        dataObj.item_list ||
        dataObj.items ||
        dataObj.videos ||
        dataObj.data ||
        (Array.isArray(data) ? data : [])
      ) as Record<string, unknown>[];

      if (Array.isArray(rawItems)) {
        items = rawItems;
      }

      hasMore = Boolean(dataObj.has_more || dataObj.hasMore);
      cursor = Number(dataObj.cursor || 0);

      console.log(`Search results: ${items.length} items, hasMore: ${hasMore}`);

    } else if (body.action === "user_posts") {
      if (!body.username) {
        throw new Error("username is required for user_posts action");
      }

      // First get secUid from username
      const userInfo = await fetchRapidAPI("/api/user/info", {
        uniqueId: body.username.replace("@", ""),
      }, RAPIDAPI_KEY) as Record<string, unknown>;

      const userDataObj = (userInfo.userInfo as Record<string, unknown>) ||
        (userInfo.data as Record<string, unknown>) || userInfo;
      const user = (get(userDataObj, "user") as Record<string, unknown>) || userDataObj;
      const secUid = String(get(user, "secUid") || get(user, "sec_uid") || "");

      if (!secUid) {
        throw new Error(`Could not find secUid for user: ${body.username}`);
      }

      console.log(`Found secUid for ${body.username}: ${secUid.substring(0, 20)}...`);

      // Get user posts
      const postsData = await fetchRapidAPI("/api/user/posts", {
        secUid,
        count: String(count),
        cursor: String(cursor),
      }, RAPIDAPI_KEY) as Record<string, unknown>;

      const postsDataObj = (postsData.data as Record<string, unknown>) || postsData;
      const rawPosts = (
        postsDataObj.itemList ||
        postsDataObj.item_list ||
        postsDataObj.items ||
        postsDataObj.aweme_list ||
        (Array.isArray(postsData) ? postsData : [])
      ) as Record<string, unknown>[];

      if (Array.isArray(rawPosts)) {
        items = rawPosts;
      }

      hasMore = Boolean(postsDataObj.hasMore || postsDataObj.has_more);
      cursor = Number(postsDataObj.cursor || 0);

    } else if (body.action === "hashtag") {
      if (!body.hashtag) {
        throw new Error("hashtag is required for hashtag action");
      }

      // First get challenge/hashtag ID
      const cleanHashtag = body.hashtag.replace("#", "");
      
      // Search using hashtag as keyword (more reliable than challenge endpoint)
      const data = await fetchRapidAPI("/api/search/general", {
        keyword: `#${cleanHashtag}`,
        count: String(count),
        cursor: String(cursor),
      }, RAPIDAPI_KEY) as Record<string, unknown>;

      const dataObj = (data.data as Record<string, unknown>) || data;
      const rawItems = (
        dataObj.item_list ||
        dataObj.items ||
        dataObj.videos ||
        dataObj.data ||
        (Array.isArray(data) ? data : [])
      ) as Record<string, unknown>[];

      if (Array.isArray(rawItems)) {
        items = rawItems;
      }

      hasMore = Boolean(dataObj.has_more || dataObj.hasMore);
      cursor = Number(dataObj.cursor || 0);

    } else {
      throw new Error(`Unknown action: ${body.action}`);
    }

    // Normalize items
    const normalized = items.map((item, idx) => normalizeSearchItem(item, idx));

    // Sort by publishedAt descending
    normalized.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    console.log(`Returning ${normalized.length} normalized TikTok results`);

    return new Response(
      JSON.stringify({
        success: true,
        items: normalized,
        totalCount: normalized.length,
        hasMore,
        cursor,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("RapidAPI TikTok error:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        items: [],
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
