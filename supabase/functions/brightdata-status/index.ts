import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface StatusRequest {
  snapshotId: string;
  platform: string;
}

interface NormalizedResult {
  id: string;
  platform: string;
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
  contentType: "post" | "video" | "image" | "article" | "thread";
  hashtags?: string[];
  mentions?: string[];
  raw: Record<string, unknown>;
}

// Parse TikTok create_time (Unix timestamp in seconds or milliseconds)
function parseTikTokDate(raw: Record<string, unknown>): string {
  const createTime = raw.create_time || raw.createTime || raw.timestamp;
  
  if (typeof createTime === "number") {
    // Detect if it's seconds (10 digits) or milliseconds (13 digits)
    const ts = createTime > 1e12 ? createTime : createTime * 1000;
    return new Date(ts).toISOString();
  }
  
  if (typeof createTime === "string") {
    // Try parsing as ISO date first
    const parsed = new Date(createTime);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    
    // Try parsing as numeric string (Unix timestamp)
    const numericTs = parseInt(createTime, 10);
    if (!isNaN(numericTs)) {
      const ts = numericTs > 1e12 ? numericTs : numericTs * 1000;
      return new Date(ts).toISOString();
    }
  }
  
  return "";
}

// Parse YouTube relative date strings ("2 weeks ago", "3 days ago")
function parseYouTubeDate(raw: Record<string, unknown>): { date: string; confidence: "high" | "medium" | "low" } {
  // First try standard date fields
  const dateFields = ["upload_date", "published_at", "date", "uploadDate", "publishedAt"];
  for (const field of dateFields) {
    const val = raw[field];
    if (typeof val === "string" && val) {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        return { date: parsed.toISOString(), confidence: "high" };
      }
    }
    if (typeof val === "number") {
      const ts = val > 1e12 ? val : val * 1000;
      return { date: new Date(ts).toISOString(), confidence: "high" };
    }
  }
  
  // Try relative time parsing
  const relativeFields = ["interpolatedTimestamp", "upload_date", "date", "published"];
  for (const field of relativeFields) {
    const val = raw[field];
    if (typeof val === "string" && val.includes("ago")) {
      const result = parseRelativeTime(val);
      if (result) return result;
    }
  }
  
  return { date: "", confidence: "low" };
}

// Parse relative time strings like "2 weeks ago", "3 days ago"
function parseRelativeTime(text: string): { date: string; confidence: "high" | "medium" | "low" } | null {
  const now = new Date();
  const lowerText = text.toLowerCase().trim();
  
  // Match patterns like "X hours/days/weeks/months/years ago"
  const match = lowerText.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i);
  if (!match) return null;
  
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  
  let confidence: "high" | "medium" | "low" = "medium";
  const result = new Date(now);
  
  switch (unit) {
    case "second":
      result.setSeconds(result.getSeconds() - value);
      confidence = "high";
      break;
    case "minute":
      result.setMinutes(result.getMinutes() - value);
      confidence = "high";
      break;
    case "hour":
      result.setHours(result.getHours() - value);
      confidence = "high";
      break;
    case "day":
      result.setDate(result.getDate() - value);
      confidence = "high";
      break;
    case "week":
      result.setDate(result.getDate() - (value * 7));
      confidence = "medium";
      break;
    case "month":
      result.setMonth(result.getMonth() - value);
      confidence = "medium";
      break;
    case "year":
      result.setFullYear(result.getFullYear() - value);
      confidence = "low";
      break;
  }
  
  return { date: result.toISOString(), confidence };
}

// Normalize Bright Data results to match our unified format
function normalizeResults(items: unknown[], platform: string): NormalizedResult[] {
  return items.map((item: unknown, index: number) => {
    const raw = item as Record<string, unknown>;
    
    // Common extraction with fallbacks
    const getText = (...keys: string[]): string => {
      for (const key of keys) {
        if (raw[key] && typeof raw[key] === "string") return raw[key] as string;
      }
      return "";
    };
    
    const getNumber = (...keys: string[]): number => {
      for (const key of keys) {
        const val = raw[key];
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const parsed = parseInt(val.replace(/[^0-9]/g, ""), 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
      return 0;
    };

    const getId = (): string => {
      return getText("id", "post_id", "video_id", "content_id", "url") || `bd_${platform}_${index}_${Date.now()}`;
    };

    // Platform-specific normalization
    let normalized: NormalizedResult;
    
    switch (platform) {
      case "twitter":
        normalized = {
          id: getId(),
          platform: "twitter",
          title: getText("text", "content", "full_text").slice(0, 100),
          description: getText("text", "content", "full_text"),
          author: {
            name: getText("author_name", "user_name", "name"),
            username: getText("author_username", "screen_name", "username"),
            url: getText("author_url", "user_url") || `https://twitter.com/${getText("author_username", "screen_name")}`,
            avatarUrl: getText("author_avatar", "profile_image_url"),
            verified: !!raw.verified || !!raw.is_verified,
            followers: getNumber("followers_count", "author_followers"),
          },
          metrics: {
            likes: getNumber("likes", "favorite_count", "like_count"),
            comments: getNumber("comments", "reply_count", "replies"),
            shares: getNumber("retweets", "retweet_count", "shares"),
            views: getNumber("views", "view_count", "impressions"),
          },
          publishedAt: getText("created_at", "date", "timestamp", "published_at") || new Date().toISOString(),
          url: getText("url", "post_url", "tweet_url") || `https://twitter.com/i/status/${getId()}`,
          contentType: "post",
          hashtags: (raw.hashtags as string[]) || [],
          mentions: (raw.mentions as string[]) || [],
          raw,
        };
        break;

      case "facebook":
        normalized = {
          id: getId(),
          platform: "facebook",
          title: getText("content", "message", "text").slice(0, 100),
          description: getText("content", "message", "text", "post_text"),
          author: {
            name: getText("author_name", "page_name", "user_name"),
            username: getText("author_username", "page_id", "user_id"),
            url: getText("author_url", "page_url", "user_url"),
            avatarUrl: getText("author_avatar", "page_avatar"),
            verified: !!raw.is_verified,
            followers: getNumber("followers", "page_likes"),
          },
          metrics: {
            likes: getNumber("likes", "reactions", "like_count"),
            comments: getNumber("comments", "comment_count", "comments_count"),
            shares: getNumber("shares", "share_count", "shares_count"),
            views: getNumber("views", "view_count"),
          },
          publishedAt: getText("date", "created_at", "timestamp", "post_date") || new Date().toISOString(),
          url: getText("url", "post_url", "link"),
          contentType: raw.video_url ? "video" : raw.image_url ? "image" : "post",
          hashtags: (raw.hashtags as string[]) || [],
          mentions: (raw.mentions as string[]) || [],
          raw,
        };
        break;

      case "instagram":
        normalized = {
          id: getId(),
          platform: "instagram",
          title: getText("caption", "description", "text").slice(0, 100),
          description: getText("caption", "description", "text"),
          author: {
            name: getText("owner_name", "author_name", "username"),
            username: getText("owner_username", "author_username", "username"),
            url: `https://instagram.com/${getText("owner_username", "author_username", "username")}`,
            avatarUrl: getText("owner_avatar", "profile_pic_url"),
            verified: !!raw.is_verified,
            followers: getNumber("follower_count", "followers"),
          },
          metrics: {
            likes: getNumber("likes", "like_count", "likes_count"),
            comments: getNumber("comments", "comment_count", "comments_count"),
            shares: 0,
            views: getNumber("views", "video_view_count", "view_count"),
          },
          publishedAt: getText("taken_at", "timestamp", "date", "created_at") || new Date().toISOString(),
          url: getText("url", "post_url", "shortcode") 
            ? (getText("url", "post_url") || `https://instagram.com/p/${getText("shortcode")}`)
            : `https://instagram.com/p/${getId()}`,
          contentType: raw.is_video ? "video" : "image",
          hashtags: (raw.hashtags as string[]) || [],
          mentions: (raw.mentions as string[]) || [],
          raw,
        };
        break;

      case "tiktok":
        // TikTok uses Unix timestamps (seconds or ms) - parse correctly
        const tiktokDate = parseTikTokDate(raw);
        normalized = {
          id: getId(),
          platform: "tiktok",
          title: getText("description", "desc", "text").slice(0, 100),
          description: getText("description", "desc", "text"),
          author: {
            name: getText("author_name", "nickname", "author_nickname"),
            username: getText("author_username", "unique_id", "author_unique_id"),
            url: `https://tiktok.com/@${getText("author_username", "unique_id", "author_unique_id")}`,
            avatarUrl: getText("author_avatar", "avatar_url"),
            verified: !!raw.verified,
            followers: getNumber("author_followers", "follower_count"),
          },
          metrics: {
            likes: getNumber("likes", "digg_count", "like_count"),
            comments: getNumber("comments", "comment_count", "comments_count"),
            shares: getNumber("shares", "share_count", "shares_count"),
            views: getNumber("views", "play_count", "view_count"),
          },
          publishedAt: tiktokDate || new Date().toISOString(),
          url: getText("url", "video_url", "webVideoUrl"),
          contentType: "video",
          hashtags: (raw.hashtags as string[]) || (raw.challenges as string[]) || [],
          mentions: (raw.mentions as string[]) || [],
          raw: { ...raw, _dateSource: tiktokDate ? "parsed" : "fallback" },
        };
        break;

      case "youtube":
      case "youtube_shorts":
        const isShort = raw.is_short || (raw.duration && (raw.duration as number) <= 60);
        // YouTube may have relative dates ("2 weeks ago") - parse with confidence
        const ytDateResult = parseYouTubeDate(raw);
        normalized = {
          id: getId(),
          platform: isShort ? "youtube_shorts" : "youtube",
          title: getText("title", "name"),
          description: getText("description", "text"),
          author: {
            name: getText("channel_name", "author_name", "uploader"),
            username: getText("channel_id", "author_id", "uploader_id"),
            url: getText("channel_url", "author_url") || `https://youtube.com/channel/${getText("channel_id")}`,
            avatarUrl: getText("channel_avatar", "author_avatar"),
            verified: !!raw.is_verified,
            followers: getNumber("subscriber_count", "subscribers"),
          },
          metrics: {
            likes: getNumber("likes", "like_count"),
            comments: getNumber("comments", "comment_count"),
            shares: 0,
            views: getNumber("views", "view_count"),
          },
          publishedAt: ytDateResult.date || new Date().toISOString(),
          url: getText("url", "video_url") || `https://youtube.com/watch?v=${getId()}`,
          contentType: "video",
          hashtags: (raw.tags as string[]) || [],
          mentions: [],
          raw: { 
            ...raw, 
            _isShort: isShort,
            _dateConfidence: ytDateResult.confidence,
            _dateIsRelative: ytDateResult.date !== "" && ytDateResult.confidence !== "high"
          },
        };
        break;

      case "reddit":
      case "reddit_comments":
        normalized = {
          id: getId(),
          platform: "reddit",
          title: getText("title", "name"),
          description: getText("selftext", "body", "text", "content"),
          author: {
            name: getText("author", "author_name"),
            username: getText("author", "author_name"),
            url: `https://reddit.com/user/${getText("author", "author_name")}`,
            verified: false,
            followers: 0,
          },
          metrics: {
            likes: getNumber("score", "ups", "upvotes"),
            comments: getNumber("num_comments", "comments_count"),
            shares: 0,
            views: 0,
          },
          publishedAt: getText("created_utc", "created_at", "date") || new Date().toISOString(),
          url: getText("url", "permalink") 
            ? getText("url") || `https://reddit.com${getText("permalink")}`
            : `https://reddit.com/comments/${getId()}`,
          contentType: "thread",
          hashtags: [],
          mentions: [],
          raw,
        };
        break;

      case "linkedin":
        normalized = {
          id: getId(),
          platform: "linkedin",
          title: getText("text", "content", "commentary").slice(0, 100),
          description: getText("text", "content", "commentary"),
          author: {
            name: getText("author_name", "name"),
            username: getText("author_urn", "author_id"),
            url: getText("author_url", "profile_url"),
            avatarUrl: getText("author_avatar", "profile_picture"),
            verified: false,
            followers: getNumber("follower_count"),
          },
          metrics: {
            likes: getNumber("likes", "num_likes", "reactions"),
            comments: getNumber("comments", "num_comments"),
            shares: getNumber("shares", "num_shares", "reposts"),
            views: getNumber("views", "impressions"),
          },
          publishedAt: getText("posted_at", "date", "created_at") || new Date().toISOString(),
          url: getText("url", "post_url"),
          contentType: "post",
          hashtags: (raw.hashtags as string[]) || [],
          mentions: (raw.mentions as string[]) || [],
          raw,
        };
        break;

      default:
        normalized = {
          id: getId(),
          platform,
          title: getText("title", "text", "content").slice(0, 100),
          description: getText("description", "text", "content"),
          author: {
            name: getText("author", "author_name"),
            username: getText("username", "author_username"),
            url: getText("author_url", "profile_url"),
          },
          metrics: {
            likes: getNumber("likes"),
            comments: getNumber("comments"),
            shares: getNumber("shares"),
            views: getNumber("views"),
          },
          publishedAt: getText("date", "timestamp", "created_at") || new Date().toISOString(),
          url: getText("url"),
          contentType: "post",
          raw,
        };
    }

    // Calculate engagement rate
    const totalEngagement = normalized.metrics.likes + normalized.metrics.comments + normalized.metrics.shares;
    const views = normalized.metrics.views || 1;
    normalized.metrics.engagement = views > 0 ? (totalEngagement / views) * 100 : 0;

    return normalized;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BRIGHTDATA_API_KEY = Deno.env.get("BRIGHTDATA_API_KEY");
    if (!BRIGHTDATA_API_KEY) {
      throw new Error("BRIGHTDATA_API_KEY is not configured");
    }

    const { snapshotId, platform }: StatusRequest = await req.json();

    if (!snapshotId) {
      throw new Error("snapshotId is required");
    }

    console.log(`Checking Bright Data status: snapshotId=${snapshotId}, platform=${platform}`);

    // Check snapshot status
    const statusResponse = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${BRIGHTDATA_API_KEY}`,
        },
      }
    );

    if (statusResponse.status === 202) {
      // Still running
      return new Response(
        JSON.stringify({
          success: true,
          status: "running",
          items: [],
          provider: "brightdata",
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Bright Data status error:", statusResponse.status, errorText);
      
      if (statusResponse.status === 404) {
        return new Response(
          JSON.stringify({
            success: false,
            status: "failed",
            error: "Snapshot not found",
            provider: "brightdata",
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      throw new Error(`Bright Data API error: ${statusResponse.status}`);
    }

    // Get results
    const rawResults = await statusResponse.json();
    const items = Array.isArray(rawResults) ? rawResults : [rawResults];
    
    console.log(`Bright Data returned ${items.length} raw results`);

    // Normalize results
    const normalizedItems = normalizeResults(items, platform);

    // Sort by date (newest first)
    normalizedItems.sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return new Response(
      JSON.stringify({
        success: true,
        status: "completed",
        items: normalizedItems,
        rawCount: items.length,
        provider: "brightdata",
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Bright Data status error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error occurred",
        provider: "brightdata",
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
