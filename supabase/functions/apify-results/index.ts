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
  
  // Unix timestamp in seconds
  if (typeof value === "number") {
    const timestamp = value > 1e12 ? value : value * 1000;
    return new Date(timestamp).toISOString();
  }
  
  // ISO string or other date string
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  
  return new Date().toISOString();
}

// Helper to extract hashtags from text
function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? matches.map(h => h.substring(1)) : [];
}

// Helper to extract mentions from text
function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w]+/g);
  return matches ? matches.map(m => m.substring(1)) : [];
}

// Calculate engagement rate
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
    metrics: {
      ...metrics,
      engagement: calculateEngagement(metrics),
    },
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
    metrics: {
      ...metrics,
      engagement: calculateEngagement(metrics),
    },
    publishedAt: parseDate(get(item, "time") || get(item, "publishedAt") || get(item, "timestamp")),
    url: String(get(item, "url") || get(item, "postUrl") || ""),
    contentType: get(item, "type") === "video" ? "video" : get(item, "type") === "photo" ? "image" : "post",
    media: get(item, "media") ? {
      type: get(item, "type") === "video" ? "video" : "image",
      url: String(get(item, "media.0.url") || get(item, "videoUrl") || get(item, "imageUrl") || ""),
      thumbnailUrl: String(get(item, "media.0.thumbnail") || get(item, "thumbnailUrl") || ""),
    } : undefined,
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeTikTok(item: Record<string, unknown>, index: number): NormalizedResult {
  // Supports multiple TikTok actor output formats:
  // - clockworks/tiktok-scraper: text/desc, authorMeta, diggCount/playCount/createTime
  // - powerai/tiktok-videos-search-scraper: title/content_desc, aweme_id/video_id, play/like/comment/share

  const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
  const authorObj = (get(item, "author") as Record<string, unknown>) || undefined;
  const authorInfoObj = (get(item, "author_info") as Record<string, unknown>) || undefined;

  const title = String(get(item, "title") || "");
  const desc = String(get(item, "content_desc") || "");
  const legacyText = String(get(item, "text") || get(item, "desc") || get(item, "description") || "");
  const text = (title || desc || legacyText).trim();

  const username = String(
    get(authorMeta, "name") ||
      get(authorObj, "unique_id") ||
      get(authorObj, "uniqueId") ||
      get(authorObj, "username") ||
      get(authorInfoObj, "unique_id") ||
      get(authorInfoObj, "uniqueId") ||
      get(authorInfoObj, "username") ||
      get(item, "author") ||
      get(item, "authorName") ||
      ""
  );

  const displayName = String(
    get(authorMeta, "nickName") ||
      get(authorMeta, "nickname") ||
      get(authorObj, "nickname") ||
      get(authorInfoObj, "nickname") ||
      username
  );

  const metrics = {
    likes: Number(
      get(item, "diggCount") ||
        get(item, "likeCount") ||
        get(item, "likes") ||
        get(item, "likesCount") ||
        get(item, "like") ||
        get(item, "stats.diggCount") ||
        0
    ),
    comments: Number(
      get(item, "commentCount") ||
        get(item, "comments") ||
        get(item, "commentsCount") ||
        get(item, "comment") ||
        get(item, "stats.commentCount") ||
        0
    ),
    shares: Number(get(item, "shareCount") || get(item, "shares") || get(item, "share") || get(item, "stats.shareCount") || 0),
    views: Number(
      get(item, "playCount") ||
        get(item, "views") ||
        get(item, "viewCount") ||
        get(item, "play") ||
        get(item, "stats.playCount") ||
        0
    ),
  };

  const videoId = String(get(item, "video_id") || get(item, "aweme_id") || get(item, "id") || "");

  const url = String(
    get(item, "webVideoUrl") ||
      get(item, "share_url") ||
      get(item, "url") ||
      get(item, "videoUrl") ||
      (videoId ? `https://www.tiktok.com/video/${videoId}` : "")
  );

  return {
    id: `tiktok-${videoId || index}-${Date.now()}`,
    platform: "tiktok",
    title: (text || title).substring(0, 100) + ((text || title).length > 100 ? "..." : ""),
    description: text || title || desc,
    author: {
      name: displayName,
      username: username,
      url: username ? `https://tiktok.com/@${username}` : "",
      avatarUrl: String(
        get(authorMeta, "avatar") ||
          get(authorObj, "avatar") ||
          get(authorObj, "avatar_thumb") ||
          get(authorInfoObj, "avatar") ||
          get(authorInfoObj, "avatar_thumb") ||
          get(item, "authorAvatar") ||
          ""
      ),
      verified: Boolean(
        get(authorMeta, "verified") || get(authorObj, "verified") || get(authorInfoObj, "verified") || get(item, "authorVerified")
      ),
      followers: Number(
        get(authorMeta, "fans") ||
          get(authorMeta, "followers") ||
          get(authorObj, "follower_count") ||
          get(authorInfoObj, "follower_count") ||
          0
      ),
    },
    metrics: {
      ...metrics,
      engagement: calculateEngagement(metrics),
    },
    publishedAt: parseDate(
      get(item, "createTime") ||
        get(item, "createTimeISO") ||
        get(item, "createdAt") ||
        get(item, "create_time") ||
        get(item, "create_time_iso") ||
        get(item, "created_at")
    ),
    url,
    contentType: "video",
    media: {
      type: "video",
      url: String(get(item, "videoUrl") || get(item, "wmplay") || get(item, "play") || get(item, "webVideoUrl") || url || ""),
      thumbnailUrl: String(
        get(item, "covers.default") ||
          get(item, "thumbnail") ||
          get(item, "cover") ||
          get(item, "origin_cover") ||
          get(item, "ai_dynamic_cover") ||
          ""
      ),
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
    metrics: {
      ...metrics,
      engagement: calculateEngagement(metrics),
    },
    publishedAt: parseDate(get(item, "timestamp") || get(item, "takenAt")),
    url: String(get(item, "url") || (get(item, "shortCode") ? `https://instagram.com/p/${get(item, "shortCode")}` : "")),
    contentType: type === "Video" || type === "video" ? "video" : type === "Sidecar" ? "image" : "image",
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
    metrics: {
      ...metrics,
      engagement: calculateEngagement(metrics),
    },
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
    metrics: {
      ...metrics,
      engagement: calculateEngagement(metrics),
    },
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
  // trudax/reddit-scraper-lite uses 'username' for author
  const author = String(get(item, "username") || get(item, "author") || "");
  // trudax uses 'communityName' or 'parsedCommunityName'
  const subreddit = String(get(item, "communityName") || get(item, "parsedCommunityName") || get(item, "subreddit") || "");
  
  const metrics = {
    // trudax uses 'upVotes' (camelCase)
    likes: Number(get(item, "upVotes") || get(item, "upvotes") || get(item, "score") || get(item, "ups") || 0),
    // trudax uses 'numberOfComments'
    comments: Number(get(item, "numberOfComments") || get(item, "numComments") || get(item, "commentsCount") || get(item, "num_comments") || 0),
    shares: 0,
  };

  const postType = get(item, "postType") || get(item, "dataType") as string || "text";
  const isVideo = Boolean(get(item, "isVideo"));
  
  // Parse ID - trudax uses 'parsedId' or full 'id' like 't3_1q9dx0x'
  const rawId = String(get(item, "parsedId") || get(item, "id") || "");

  return {
    id: `reddit-${rawId || index}-${Date.now()}`,
    platform: "reddit",
    title: title || body.substring(0, 100) + (body.length > 100 ? "..." : ""),
    description: body || title,
    author: {
      name: author,
      username: author,
      url: author ? `https://reddit.com/u/${author}` : "",
    },
    metrics: {
      ...metrics,
      engagement: calculateEngagement(metrics),
    },
    // trudax provides 'createdAt' as ISO string
    publishedAt: parseDate(get(item, "createdAt") || get(item, "created_utc") || get(item, "created")),
    url: String(get(item, "url") || get(item, "permalink") || ""),
    contentType: isVideo ? "video" : postType === "image" ? "image" : "post",
    media: get(item, "imageUrls") || get(item, "thumbnail") ? {
      type: isVideo ? "video" : "image",
      url: String(
        (Array.isArray(get(item, "imageUrls")) && (get(item, "imageUrls") as string[]).length > 0)
          ? (get(item, "imageUrls") as string[])[0]
          : get(item, "link") || ""
      ),
      thumbnailUrl: String(get(item, "thumbnailUrl") || get(item, "thumbnail") || ""),
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
          author: {
            name: String(get(data, "author") || ""),
            username: "",
            url: "",
          },
          metrics: {
            likes: 0,
            comments: 0,
            shares: 0,
            engagement: 0,
          },
          publishedAt: new Date().toISOString(),
          url: String(get(data, "url") || ""),
          contentType: "post" as const,
          raw: data,
        };
    }
  });
}

// Calculate aggregate metrics
function calculateAggregateMetrics(results: NormalizedResult[]) {
  const totals = results.reduce((acc, r) => ({
    likes: acc.likes + r.metrics.likes,
    comments: acc.comments + r.metrics.comments,
    shares: acc.shares + r.metrics.shares,
    views: acc.views + (r.metrics.views || 0),
  }), { likes: 0, comments: 0, shares: 0, views: 0 });

  const avgEngagement = results.length > 0 
    ? results.reduce((sum, r) => sum + (r.metrics.engagement || 0), 0) / results.length
    : 0;

  return {
    totals,
    averageEngagement: Math.round(avgEngagement * 100) / 100,
    resultCount: results.length,
    verifiedAuthors: results.filter(r => r.author.verified).length,
    contentTypes: results.reduce((acc, r) => {
      acc[r.contentType] = (acc[r.contentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
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

    const { datasetId, platform = "twitter", offset = 0, limit = 100 } = await req.json();

    if (!datasetId) {
      throw new Error("datasetId is required");
    }

    // Get dataset items
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&offset=${offset}&limit=${limit}`
    );

    if (!datasetResponse.ok) {
      const errorText = await datasetResponse.text();
      console.error("Apify dataset error:", errorText);
      throw new Error(`Failed to get dataset items: ${datasetResponse.status}`);
    }

    const rawItems = await datasetResponse.json();
    
    // Normalize results based on platform
    const normalizedItems = normalizeResults(rawItems, platform as Platform);
    
    // Calculate aggregate metrics
    const aggregateMetrics = calculateAggregateMetrics(normalizedItems);

    console.log(`Retrieved and normalized ${normalizedItems.length} items from dataset ${datasetId} (platform: ${platform})`);

    return new Response(
      JSON.stringify({
        success: true,
        datasetId,
        platform,
        items: normalizedItems,
        rawItems: rawItems, // Keep raw for debugging
        count: normalizedItems.length,
        offset,
        limit,
        aggregateMetrics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apify-results:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
