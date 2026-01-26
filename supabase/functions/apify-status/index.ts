import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Platform = "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "reddit";

interface NormalizedResult {
  id: string;
  platform: Platform;
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
  media?: {
    type: "image" | "video" | "carousel";
    url?: string;
    thumbnailUrl?: string;
  };
  hashtags?: string[];
  mentions?: string[];
  raw: Record<string, unknown>;
}

// Helper to safely get nested values
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

// Helper to parse dates from various formats
function parseDate(value: unknown): string {
  if (!value) return new Date().toISOString();
  
  if (typeof value === "number") {
    const timestamp = value > 1e12 ? value : value * 1000;
    return new Date(timestamp).toISOString();
  }
  
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  
  return new Date().toISOString();
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? matches.map(h => h.substring(1)) : [];
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w]+/g);
  return matches ? matches.map(m => m.substring(1)) : [];
}

function calculateEngagement(metrics: { likes: number; comments: number; shares: number; views?: number }): number {
  const totalInteractions = metrics.likes + metrics.comments + metrics.shares;
  if (metrics.views && metrics.views > 0) {
    return Math.round((totalInteractions / metrics.views) * 10000) / 100;
  }
  return totalInteractions;
}

function normalizeTwitter(item: Record<string, unknown>, index: number): NormalizedResult {
  const user = item.user as Record<string, unknown> | undefined;
  const author = item.author as Record<string, unknown> | undefined;
  
  const username = String(get(user, "screen_name") || get(author, "userName") || get(item, "user_screen_name") || "");
  const authorName = String(get(user, "name") || get(author, "name") || username);
  const text = String(get(item, "full_text") || get(item, "text") || "");
  
  const metrics = {
    likes: Number(get(item, "favorite_count") || get(item, "likeCount") || 0),
    comments: Number(get(item, "reply_count") || get(item, "replyCount") || 0),
    shares: Number(get(item, "retweet_count") || get(item, "retweetCount") || 0),
    views: Number(get(item, "views") || get(item, "viewCount") || 0),
  };

  return {
    id: `twitter-${get(item, "id") || index}-${Date.now()}`,
    platform: "twitter",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: authorName,
      username: username,
      url: username ? `https://x.com/${username}` : "",
      avatarUrl: String(get(user, "profile_image_url_https") || get(author, "profileImageUrl") || ""),
      verified: Boolean(get(user, "verified") || get(author, "isVerified")),
      followers: Number(get(user, "followers_count") || get(author, "followers") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "created_at") || get(item, "createdAt")),
    url: String(get(item, "url") || (get(item, "id") ? `https://x.com/i/status/${get(item, "id")}` : "")),
    contentType: get(item, "in_reply_to_status_id") ? "thread" : "post",
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeFacebook(item: Record<string, unknown>, index: number): NormalizedResult {
  const text = String(get(item, "text") || get(item, "message") || get(item, "postText") || "");
  const pageName = String(get(item, "pageName") || get(item, "page.name") || "");
  
  const metrics = {
    likes: Number(get(item, "likes") || get(item, "likesCount") || get(item, "reactions") || 0),
    comments: Number(get(item, "comments") || get(item, "commentsCount") || 0),
    shares: Number(get(item, "shares") || get(item, "sharesCount") || 0),
  };

  return {
    id: `facebook-${get(item, "id") || get(item, "postId") || index}-${Date.now()}`,
    platform: "facebook",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: pageName,
      username: pageName.toLowerCase().replace(/\s+/g, ""),
      url: String(get(item, "pageUrl") || get(item, "page.url") || ""),
      avatarUrl: String(get(item, "page.profilePicture") || ""),
      followers: Number(get(item, "page.likes") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "time") || get(item, "publishedAt") || get(item, "timestamp")),
    url: String(get(item, "url") || get(item, "postUrl") || ""),
    contentType: get(item, "type") === "video" ? "video" : get(item, "type") === "photo" ? "image" : "post",
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeTikTok(item: Record<string, unknown>, index: number): NormalizedResult {
  const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
  const text = String(get(item, "text") || get(item, "desc") || get(item, "description") || "");
  const username = String(get(authorMeta, "name") || get(item, "author") || get(item, "authorName") || "");
  
  const metrics = {
    likes: Number(get(item, "diggCount") || get(item, "likes") || get(item, "likesCount") || 0),
    comments: Number(get(item, "commentCount") || get(item, "comments") || get(item, "commentsCount") || 0),
    shares: Number(get(item, "shareCount") || get(item, "shares") || 0),
    views: Number(get(item, "playCount") || get(item, "views") || get(item, "viewCount") || 0),
  };

  return {
    id: `tiktok-${get(item, "id") || index}-${Date.now()}`,
    platform: "tiktok",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: String(get(authorMeta, "nickName") || get(authorMeta, "nickname") || username),
      username: username,
      url: username ? `https://tiktok.com/@${username}` : "",
      avatarUrl: String(get(authorMeta, "avatar") || get(item, "authorAvatar") || ""),
      verified: Boolean(get(authorMeta, "verified") || get(item, "authorVerified")),
      followers: Number(get(authorMeta, "fans") || get(authorMeta, "followers") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "createTime") || get(item, "createdAt")),
    url: String(get(item, "webVideoUrl") || get(item, "url") || get(item, "videoUrl") || ""),
    contentType: "video",
    media: {
      type: "video",
      url: String(get(item, "videoUrl") || get(item, "webVideoUrl") || ""),
      thumbnailUrl: String(get(item, "covers.default") || get(item, "thumbnail") || get(item, "cover") || ""),
    },
    hashtags: (get(item, "hashtags") as Array<Record<string, string>>) 
      ? (get(item, "hashtags") as Array<Record<string, string>>).map(h => h.name || h.title || "").filter(Boolean)
      : extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeInstagram(item: Record<string, unknown>, index: number): NormalizedResult {
  // Get caption - this is the actual post content, not sidebar suggestions
  const caption = String(get(item, "caption") || "");
  // Some scrapers return 'description' which may include page chrome - only use if caption is empty
  const description = String(get(item, "description") || "");
  
  // Prefer caption as it's the actual post content
  const text = caption || description;
  
  const username = String(get(item, "ownerUsername") || get(item, "owner.username") || "");
  
  const metrics = {
    likes: Number(get(item, "likesCount") || get(item, "likes") || 0),
    comments: Number(get(item, "commentsCount") || get(item, "comments") || 0),
    shares: 0,
    views: Number(get(item, "videoViewCount") || get(item, "views") || 0),
  };

  const type = get(item, "type") as string || "image";

  return {
    id: `instagram-${get(item, "id") || get(item, "shortCode") || index}-${Date.now()}`,
    platform: "instagram",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: String(get(item, "ownerFullName") || get(item, "owner.fullName") || username),
      username: username,
      url: username ? `https://instagram.com/${username}` : "",
      avatarUrl: String(get(item, "owner.profilePicUrl") || ""),
      verified: Boolean(get(item, "owner.isVerified")),
      followers: Number(get(item, "owner.followersCount") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "timestamp") || get(item, "takenAt")),
    url: String(get(item, "url") || (get(item, "shortCode") ? `https://instagram.com/p/${get(item, "shortCode")}` : "")),
    contentType: type === "Video" || type === "video" ? "video" : "image",
    media: {
      type: type === "Video" || type === "video" ? "video" : type === "Sidecar" ? "carousel" : "image",
      url: String(get(item, "displayUrl") || get(item, "videoUrl") || ""),
      thumbnailUrl: String(get(item, "thumbnailUrl") || get(item, "displayUrl") || ""),
    },
    hashtags: (get(item, "hashtags") as string[]) || extractHashtags(text),
    mentions: (get(item, "mentions") as string[]) || extractMentions(text),
    raw: item,
  };
}

function normalizeLinkedIn(item: Record<string, unknown>, index: number): NormalizedResult {
  const author = item.author as Record<string, unknown> | undefined;
  const text = String(get(item, "text") || get(item, "commentary") || get(item, "postText") || "");
  const authorName = String(get(author, "name") || get(item, "authorName") || get(item, "companyName") || "");
  
  const metrics = {
    likes: Number(get(item, "numLikes") || get(item, "likes") || get(item, "likeCount") || 0),
    comments: Number(get(item, "numComments") || get(item, "comments") || get(item, "commentCount") || 0),
    shares: Number(get(item, "numShares") || get(item, "shares") || get(item, "repostCount") || 0),
  };

  return {
    id: `linkedin-${get(item, "urn") || get(item, "id") || index}-${Date.now()}`,
    platform: "linkedin",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: authorName,
      username: String(get(author, "publicIdentifier") || get(item, "authorUsername") || ""),
      url: String(get(author, "url") || get(item, "authorUrl") || ""),
      avatarUrl: String(get(author, "profilePicture") || get(author, "image") || ""),
      followers: Number(get(author, "followersCount") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "postedAt") || get(item, "postedDate") || get(item, "publishedAt")),
    url: String(get(item, "url") || get(item, "postUrl") || ""),
    contentType: get(item, "type") === "video" ? "video" : get(item, "type") === "article" ? "article" : "post",
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeYouTube(item: Record<string, unknown>, index: number): NormalizedResult {
  const channel = item.channel as Record<string, unknown> | undefined;
  const title = String(get(item, "title") || get(item, "text") || "");
  const description = String(get(item, "description") || get(item, "text") || title);
  
  const metrics = {
    likes: Number(get(item, "likes") || get(item, "likeCount") || 0),
    comments: Number(get(item, "commentsCount") || get(item, "commentCount") || 0),
    shares: 0,
    views: Number(get(item, "viewCount") || get(item, "views") || 0),
  };

  const channelName = String(get(channel, "name") || get(item, "channelName") || get(item, "uploader") || "");
  const channelId = String(get(channel, "id") || get(item, "channelId") || "");

  return {
    id: `youtube-${get(item, "id") || get(item, "videoId") || index}-${Date.now()}`,
    platform: "youtube",
    title: title,
    description: description,
    author: {
      name: channelName,
      username: channelId,
      url: String(get(item, "channelUrl") || get(channel, "url") || (channelId ? `https://youtube.com/channel/${channelId}` : "")),
      avatarUrl: String(get(channel, "thumbnail") || get(item, "channelThumbnail") || ""),
      verified: Boolean(get(channel, "verified")),
      followers: Number(get(channel, "subscriberCount") || get(item, "channelSubscribers") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "publishedAt") || get(item, "date") || get(item, "uploadDate")),
    url: String(get(item, "url") || (get(item, "id") ? `https://youtube.com/watch?v=${get(item, "id")}` : "")),
    contentType: "video",
    media: {
      type: "video",
      url: String(get(item, "url") || ""),
      thumbnailUrl: String(get(item, "thumbnailUrl") || get(item, "thumbnail") || ""),
    },
    hashtags: (get(item, "hashtags") as string[]) || extractHashtags(description),
    raw: item,
  };
}

function normalizeReddit(item: Record<string, unknown>, index: number): NormalizedResult {
  const title = String(get(item, "title") || "");
  const body = String(get(item, "body") || get(item, "selftext") || get(item, "text") || "");
  const author = String(get(item, "author") || get(item, "username") || "");
  const subreddit = String(get(item, "subreddit") || get(item, "communityName") || "");
  
  const metrics = {
    likes: Number(get(item, "upvotes") || get(item, "score") || get(item, "ups") || 0),
    comments: Number(get(item, "numComments") || get(item, "commentsCount") || get(item, "num_comments") || 0),
    shares: 0,
  };

  const postType = get(item, "postType") as string || "text";

  return {
    id: `reddit-${get(item, "id") || index}-${Date.now()}`,
    platform: "reddit",
    title: title || body.substring(0, 100) + (body.length > 100 ? "..." : ""),
    description: body || title,
    author: {
      name: author,
      username: author,
      url: author ? `https://reddit.com/u/${author}` : "",
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "createdAt") || get(item, "created_utc") || get(item, "created")),
    url: String(get(item, "url") || get(item, "permalink") || ""),
    contentType: postType === "video" ? "video" : postType === "image" ? "image" : "post",
    media: get(item, "media") || get(item, "thumbnail") ? {
      type: postType === "video" ? "video" : "image",
      url: String(get(item, "media.url") || get(item, "videoUrl") || get(item, "imageUrl") || ""),
      thumbnailUrl: String(get(item, "thumbnail") || ""),
    } : undefined,
    hashtags: subreddit ? [subreddit] : [],
    raw: item,
  };
}

function normalizeResults(items: unknown[], platform: Platform): NormalizedResult[] {
  return (items || []).map((item, index) => {
    const data = item as Record<string, unknown>;
    
    switch (platform) {
      case "twitter":
        return normalizeTwitter(data, index);
      case "facebook":
        return normalizeFacebook(data, index);
      case "tiktok":
        return normalizeTikTok(data, index);
      case "instagram":
        return normalizeInstagram(data, index);
      case "linkedin":
        return normalizeLinkedIn(data, index);
      case "youtube":
        return normalizeYouTube(data, index);
      case "reddit":
        return normalizeReddit(data, index);
      default:
        return {
          id: `unknown-${index}-${Date.now()}`,
          platform: platform,
          title: String(get(data, "title") || get(data, "text") || "").substring(0, 100),
          description: String(get(data, "description") || get(data, "text") || ""),
          author: { name: String(get(data, "author") || ""), username: "", url: "" },
          metrics: { likes: 0, comments: 0, shares: 0, engagement: 0 },
          publishedAt: new Date().toISOString(),
          url: String(get(data, "url") || ""),
          contentType: "post" as const,
          raw: data,
        };
    }
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN is not configured");
    }

    const { runId, platform = "twitter", filterKeyword = "" } = await req.json();

    if (!runId) {
      throw new Error("runId is required");
    }

    // Normalize filterKeyword for case-insensitive matching
    const keywordLower = (filterKeyword || "").toLowerCase().trim();

    // Get run status
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Apify status error:", errorText);
      throw new Error(`Failed to get run status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.data.status;
    const datasetId = statusData.data.defaultDatasetId;

    console.log(`Run ${runId} status: ${status}`);

    let items: NormalizedResult[] = [];

    // If the run is finished, get and normalize the results
    if (status === "SUCCEEDED" && datasetId) {
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=100`
      );

      if (datasetResponse.ok) {
        const rawItems = await datasetResponse.json();
        let normalized = normalizeResults(rawItems, platform as Platform);

        // Filter by keyword if provided (for TikTok and Instagram to reduce false positives)
        if (keywordLower && (platform === "tiktok" || platform === "instagram")) {
          const beforeCount = normalized.length;
          normalized = normalized.filter((item) => {
            // For Instagram, be more strict - only check caption/description, not sidebar content
            const text = `${item.title} ${item.description} ${(item.hashtags || []).join(" ")}`.toLowerCase();
            return text.includes(keywordLower);
          });
          console.log(`Filtered ${platform} results from ${beforeCount} to ${normalized.length} using keyword: ${keywordLower}`);
        }

        items = normalized;
        console.log(`Retrieved and normalized ${items.length} items from dataset`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        status,
        platform,
        isFinished: ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status),
        items: status === "SUCCEEDED" ? items : [],
        stats: statusData.data.stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apify-status:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
