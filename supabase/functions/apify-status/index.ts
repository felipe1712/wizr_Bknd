import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Retry wrapper for transient upstream failures and network hiccups.
async function fetchWithRetry(
  url: string,
  options?: { retries?: number; baseDelayMs?: number; timeoutMs?: number }
): Promise<Response> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 800;
  const timeoutMs = options?.timeoutMs ?? 12000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);

      // Retry only on transient server errors.
      if (res.status >= 500 && TRANSIENT_STATUS_CODES.has(res.status) && attempt < retries) {
        console.log(`Upstream returned ${res.status} for ${url}; retrying (${attempt}/${retries})`);
        await sleep(baseDelayMs * attempt);
        continue;
      }

      return res;
    } catch (err) {
      // Retry on network errors / aborts.
      if (attempt < retries) {
        console.log(`Network/timeout error for ${url}; retrying (${attempt}/${retries})`, err);
        await sleep(baseDelayMs * attempt);
        continue;
      }
      throw err;
    }
  }

  // Should be unreachable.
  throw new Error("Max retries exceeded");
}

function safeJsonUnescape(input: string): string {
  try {
    // Convert JSON string literal to actual string.
    return JSON.parse(`"${input.replace(/"/g, "\\\"")}"`);
  } catch {
    return input
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }
}

async function tryFetchYouTubeFullDescription(videoUrl: string): Promise<string | null> {
  if (!videoUrl) return null;
  try {
    // YouTube blocks some automated traffic; best-effort only.
    const res = await fetchWithTimeout(videoUrl, 8000);
    if (!res.ok) return null;
    const html = await res.text();

    // 1) Most reliable: shortDescription inside ytInitialPlayerResponse JSON.
    const m1 = html.match(/\"shortDescription\"\s*:\s*\"([^\"]*)\"/);
    if (m1?.[1]) {
      const desc = safeJsonUnescape(m1[1]);
      return desc.trim() ? desc : null;
    }

    // 2) Fallback: meta description.
    const m2 = html.match(/<meta\s+name=\"description\"\s+content=\"([^\"]*)\"/i);
    if (m2?.[1]) {
      const desc = safeJsonUnescape(m2[1]);
      return desc.trim() ? desc : null;
    }

    return null;
  } catch {
    return null;
  }
}

type Platform = "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "youtube_shorts" | "reddit" | "reddit_comments";

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

// Helper to parse relative time expressions (e.g., "2 weeks ago", "3 days ago")
// Returns { date: Date, confidence: "high" | "medium" | "low" }
function parseRelativeTime(text: string): { date: Date; confidence: "high" | "medium" | "low" } | null {
  if (!text || typeof text !== "string") return null;
  
  const now = new Date();
  const lowerText = text.toLowerCase().trim();
  
  // Patterns for relative time expressions
  const patterns: Array<{ regex: RegExp; getMs: (n: number) => number; confidence: "high" | "medium" | "low" }> = [
    // Hours
    { regex: /(\d+)\s*hour(?:s)?\s*ago/i, getMs: (n) => n * 60 * 60 * 1000, confidence: "high" },
    // Days
    { regex: /(\d+)\s*day(?:s)?\s*ago/i, getMs: (n) => n * 24 * 60 * 60 * 1000, confidence: "high" },
    // Weeks
    { regex: /(\d+)\s*week(?:s)?\s*ago/i, getMs: (n) => n * 7 * 24 * 60 * 60 * 1000, confidence: "medium" },
    // Months (approximate as 30 days)
    { regex: /(\d+)\s*month(?:s)?\s*ago/i, getMs: (n) => n * 30 * 24 * 60 * 60 * 1000, confidence: "medium" },
    // Years (approximate as 365 days)
    { regex: /(\d+)\s*year(?:s)?\s*ago/i, getMs: (n) => n * 365 * 24 * 60 * 60 * 1000, confidence: "low" },
    // Special cases
    { regex: /yesterday/i, getMs: () => 24 * 60 * 60 * 1000, confidence: "high" },
    { regex: /today|just now|moments? ago/i, getMs: () => 0, confidence: "high" },
  ];
  
  for (const { regex, getMs, confidence } of patterns) {
    const match = lowerText.match(regex);
    if (match) {
      const value = match[1] ? parseInt(match[1], 10) : 1;
      const msAgo = getMs(value);
      const date = new Date(now.getTime() - msAgo);
      return { date, confidence };
    }
  }
  
  return null;
}

// Helper to parse dates from various formats
// Returns an object with date and optional confidence level
interface ParsedDate {
  isoString: string;
  confidence?: "high" | "medium" | "low";
  isRelative?: boolean;
}

function parseDateWithConfidence(value: unknown): ParsedDate {
  if (!value) return { isoString: new Date().toISOString(), confidence: "low" };
  
  if (typeof value === "number") {
    const timestamp = value > 1e12 ? value : value * 1000;
    return { isoString: new Date(timestamp).toISOString(), confidence: "high" };
  }
  
  if (typeof value === "string") {
    // First try to parse as ISO date
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return { isoString: parsed.toISOString(), confidence: "high" };
    }
    
    // Try to parse relative time expressions (e.g., "2 weeks ago")
    const relativeResult = parseRelativeTime(value);
    if (relativeResult) {
      return {
        isoString: relativeResult.date.toISOString(),
        confidence: relativeResult.confidence,
        isRelative: true,
      };
    }
  }
  
  return { isoString: new Date().toISOString(), confidence: "low" };
}

// Backwards-compatible helper
function parseDate(value: unknown): string {
  return parseDateWithConfidence(value).isoString;
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
  // Handle both old format (apidojo) and new format (coder_luffy/free-tweet-scraper)
  const user = item.user as Record<string, unknown> | undefined;
  const author = item.author as Record<string, unknown> | undefined;
  
  // New scraper uses screen_name directly on item
  const username = String(
    get(item, "screen_name") || 
    get(user, "screen_name") || 
    get(author, "userName") || 
    get(item, "user_screen_name") || 
    ""
  );
  const authorName = String(
    get(item, "name") || 
    get(user, "name") || 
    get(author, "name") || 
    username
  );
  // New scraper uses "full_text" or "text"
  const text = String(get(item, "full_text") || get(item, "text") || get(item, "tweet") || "");
  
  const metrics = {
    likes: Number(get(item, "favorite_count") || get(item, "favorites") || get(item, "likeCount") || 0),
    comments: Number(get(item, "reply_count") || get(item, "replies") || get(item, "replyCount") || 0),
    shares: Number(get(item, "retweet_count") || get(item, "retweets") || get(item, "retweetCount") || 0),
    views: Number(get(item, "views") || get(item, "viewCount") || get(item, "views_count") || 0),
  };

  // New scraper has different URL/ID format
  const tweetId = String(get(item, "id") || get(item, "id_str") || get(item, "tweet_id") || "");

  return {
    id: `twitter-${tweetId || index}-${Date.now()}`,
    platform: "twitter",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: authorName,
      username: username,
      url: username ? `https://x.com/${username}` : "",
      avatarUrl: String(get(item, "profile_image_url_https") || get(user, "profile_image_url_https") || get(author, "profileImageUrl") || ""),
      verified: Boolean(get(item, "verified") || get(user, "verified") || get(author, "isVerified")),
      followers: Number(get(item, "followers_count") || get(user, "followers_count") || get(author, "followers") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "created_at") || get(item, "createdAt") || get(item, "timestamp")),
    url: String(get(item, "url") || get(item, "tweet_url") || (tweetId ? `https://x.com/i/status/${tweetId}` : "")),
    contentType: get(item, "in_reply_to_status_id") ? "thread" : "post",
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeFacebook(item: Record<string, unknown>, index: number): NormalizedResult {
  // Handle multiple Facebook actor formats:
  // - powerai/facebook-post-search-scraper: message, author.name, reactions_count, timestamp
  // - scraper_one/facebook-posts-search: text, authorName, likesCount, postedAt
  // - apify/facebook-posts-scraper (page scraper): postText, pageName, likes, time
  const author = item.author as Record<string, unknown> | undefined;
  
  const text = String(
    get(item, "message") ||  // powerai format
    get(item, "text") ||     // scraper_one format
    get(item, "postText") || 
    get(item, "content") ||
    get(item, "caption") ||  // alternative field
    ""
  );
  
  // Author name from various formats
  const authorName = String(
    get(author, "name") ||           // powerai nested format
    get(item, "authorName") ||       // scraper_one format
    get(item, "pageName") || 
    get(item, "page.name") || 
    get(item, "user_name") ||
    get(item, "userName") ||
    get(item, "profileName") ||      // alternative
    ""
  );
  
  const authorUrl = String(
    get(author, "url") ||            // powerai nested format
    get(item, "authorUrl") ||        // scraper_one format
    get(item, "profileUrl") ||
    get(item, "pageUrl") || 
    get(item, "page.url") || 
    get(item, "user_url") ||
    ""
  );
  
  const authorAvatar = String(
    get(author, "profile_picture_url") ||  // powerai nested format
    get(item, "authorProfilePicture") ||   // scraper_one format
    get(item, "profilePicture") ||
    get(item, "page.profilePicture") || 
    get(item, "authorAvatar") || 
    ""
  );
  
  // Metrics from various formats
  const metrics = {
    likes: Number(
      get(item, "reactions_count") ||  // powerai format
      get(item, "likesCount") ||       // scraper_one format
      get(item, "likes") || 
      get(item, "reactions") || 
      get(item, "reactionCount") || 
      0
    ),
    comments: Number(
      get(item, "comments_count") ||   // powerai format
      get(item, "commentsCount") ||    // scraper_one format
      get(item, "comments") || 
      get(item, "commentCount") || 
      0
    ),
    shares: Number(
      get(item, "reshare_count") ||    // powerai format
      get(item, "sharesCount") ||      // scraper_one format
      get(item, "shares") || 
      get(item, "shareCount") || 
      0
    ),
  };

  // Handle various URL formats
  const postUrl = String(
    get(item, "url") || 
    get(item, "postUrl") || 
    get(item, "link") ||
    get(item, "permalink") ||  // scraper_one sometimes uses this
    ""
  );
  
  // Detect content type
  const postType = String(get(item, "type") || get(item, "postType") || "post");
  const hasVideo = Boolean(get(item, "video") || get(item, "video_files") || get(item, "videoUrl"));
  const hasImage = Boolean(get(item, "image") || get(item, "album_preview") || get(item, "imageUrl"));

  return {
    id: `facebook-${get(item, "post_id") || get(item, "id") || get(item, "postId") || index}-${Date.now()}`,
    platform: "facebook",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: authorName,
      username: authorName.toLowerCase().replace(/\s+/g, ""),
      url: authorUrl,
      avatarUrl: authorAvatar,
      followers: Number(get(item, "page.likes") || get(item, "followersCount") || get(item, "followers") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(
      get(item, "timestamp") ||     // powerai uses unix timestamp
      get(item, "postedAt") ||      // scraper_one format
      get(item, "time") || 
      get(item, "publishedAt") || 
      get(item, "date") || 
      get(item, "createdAt") ||
      get(item, "scrapedAt")
    ),
    url: postUrl,
    contentType: hasVideo ? "video" : hasImage ? "image" : "post",
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeTikTok(item: Record<string, unknown>, index: number): NormalizedResult {
  // Supports multiple TikTok actor output formats:
  // - sociavault/tiktok-keyword-search-scraper: description, author.nickname, likes/comments/shares/views, created_at
  // - clockworks/tiktok-scraper (legacy): text/desc, authorMeta, diggCount/playCount/createTime
  // - powerai (legacy): title/content_desc, aweme_id/video_id

  const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
  const authorObj = (get(item, "author") as Record<string, unknown>) || undefined;
  const authorInfoObj = (get(item, "author_info") as Record<string, unknown>) || undefined;

  // sociavault uses 'description' as primary field
  const description = String(get(item, "description") || "");
  const title = String(get(item, "title") || "");
  const desc = String(get(item, "content_desc") || "");
  const legacyText = String(get(item, "text") || get(item, "desc") || "");
  const text = (description || title || desc || legacyText).trim();

  // sociavault uses author.nickname/author.unique_id
  const username = String(
    get(authorObj, "nickname") ||
      get(authorObj, "unique_id") ||
      get(authorObj, "uniqueId") ||
      get(authorObj, "username") ||
      get(authorMeta, "name") ||
      get(authorInfoObj, "unique_id") ||
      get(authorInfoObj, "uniqueId") ||
      get(authorInfoObj, "username") ||
      get(item, "author") ||
      get(item, "authorName") ||
      ""
  );

  const displayName = String(
    get(authorObj, "nickname") ||
      get(authorMeta, "nickName") ||
      get(authorMeta, "nickname") ||
      get(authorInfoObj, "nickname") ||
      username
  );

  // sociavault uses likes/comments/shares/views directly
  const metrics = {
    likes: Number(
      get(item, "likes") ||
        get(item, "diggCount") ||
        get(item, "likeCount") ||
        get(item, "likesCount") ||
        get(item, "like") ||
        get(item, "stats.diggCount") ||
        0
    ),
    comments: Number(
      get(item, "comments") ||
        get(item, "commentCount") ||
        get(item, "commentsCount") ||
        get(item, "comment") ||
        get(item, "stats.commentCount") ||
        0
    ),
    shares: Number(get(item, "shares") || get(item, "shareCount") || get(item, "share") || get(item, "stats.shareCount") || 0),
    views: Number(
      get(item, "views") ||
        get(item, "playCount") ||
        get(item, "viewCount") ||
        get(item, "play") ||
        get(item, "stats.playCount") ||
        0
    ),
  };

  // sociavault uses video_id or id
  const videoId = String(get(item, "video_id") || get(item, "id") || get(item, "aweme_id") || "");

  // Build URL: prefer share_url/webVideoUrl, then construct with username if available
  // TikTok URLs work better with format: tiktok.com/@username/video/ID
  let url = String(
    get(item, "webVideoUrl") ||
      get(item, "share_url") ||
      get(item, "url") ||
      get(item, "videoUrl") ||
      ""
  );
  
  // If no URL found but we have videoId, construct it properly
  if (!url && videoId) {
    // Get the actual unique_id (username) for proper URL format
    const uniqueId = String(
      get(authorObj, "unique_id") ||
        get(authorObj, "uniqueId") ||
        get(authorMeta, "uniqueId") ||
        get(authorMeta, "name") ||
        get(authorInfoObj, "unique_id") ||
        ""
    );
    
    if (uniqueId) {
      url = `https://www.tiktok.com/@${uniqueId}/video/${videoId}`;
    } else {
      // Fallback to share URL format which tends to redirect properly
      url = `https://www.tiktok.com/t/${videoId}`;
    }
  }

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
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    // sociavault uses 'created_at' ISO format; keep wide mapping for legacy actors
    publishedAt: parseDate(
      get(item, "created_at") ||
        get(item, "createTime") ||
        get(item, "createTimeISO") ||
        get(item, "createdAt") ||
        get(item, "create_time") ||
        get(item, "create_time_iso")
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
  // harvestapi/linkedin-post-search format
  const author = item.author as Record<string, unknown> | undefined;
  const engagement = item.engagement as Record<string, unknown> | undefined;
  const postedAt = item.postedAt as Record<string, unknown> | undefined;
  
  // Content from harvestapi format
  const text = String(get(item, "content") || get(item, "text") || get(item, "commentary") || get(item, "postText") || "");
  
  // Author info - harvestapi uses nested 'author' object
  const authorName = String(
    get(author, "name") || 
    get(item, "authorName") || 
    get(item, "companyName") || 
    ""
  );
  const authorUsername = String(
    get(author, "publicIdentifier") || 
    get(item, "authorUsername") || 
    ""
  );
  const authorUrl = String(
    get(author, "linkedinUrl") || 
    get(author, "url") || 
    get(item, "authorUrl") || 
    ""
  );
  const avatarUrl = (() => {
    const avatar = get(author, "avatar") as Record<string, unknown> | undefined;
    return String(avatar?.url || get(author, "profilePicture") || get(author, "image") || "");
  })();
  
  // Engagement metrics - harvestapi uses nested 'engagement' object
  const metrics = {
    likes: Number(get(engagement, "likes") || get(item, "numLikes") || get(item, "likes") || get(item, "likeCount") || 0),
    comments: Number(get(engagement, "comments") || get(item, "numComments") || get(item, "comments") || get(item, "commentCount") || 0),
    shares: Number(get(engagement, "shares") || get(item, "numShares") || get(item, "shares") || get(item, "repostCount") || 0),
  };

  // Date - harvestapi uses nested 'postedAt' object with 'date' field
  const publishedDate = postedAt 
    ? parseDate(get(postedAt, "date") || get(postedAt, "timestamp"))
    : parseDate(get(item, "postedAt") || get(item, "postedDate") || get(item, "publishedAt"));

  // Post URL
  const postUrl = String(
    get(item, "linkedinUrl") || 
    get(item, "url") || 
    get(item, "postUrl") || 
    ""
  );

  return {
    id: `linkedin-${get(item, "id") || get(item, "urn") || index}-${Date.now()}`,
    platform: "linkedin",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: authorName,
      username: authorUsername,
      url: authorUrl,
      avatarUrl: avatarUrl,
      followers: Number(get(author, "followersCount") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: publishedDate,
    url: postUrl,
    contentType: get(item, "type") === "video" ? "video" : get(item, "type") === "article" ? "article" : "post",
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeYouTube(item: Record<string, unknown>, index: number): NormalizedResult {
  // Handle both streamers/youtube-scraper and scrapesmith/free-youtube-search-scraper formats
  // Also handle scraper_one/youtube-search-scraper which uses 'descriptionSnippet'
  const channel = item.channel as Record<string, unknown> | undefined;
  const title = String(get(item, "title") || get(item, "text") || "");
  
  // Build comprehensive description from all available text fields
  // Some scrapers return 'descriptionSnippet' (truncated) and others return full 'description'
  const descSnippet = String(get(item, "descriptionSnippet") || "");
  const fullDesc = String(get(item, "description") || "");
  const textField = String(get(item, "text") || "");
  
  // Prefer full description, but combine all text for better keyword matching
  // The descriptionSnippet often contains the keyword even when the title doesn't
  const description = fullDesc || descSnippet || textField || title;
  
  // Store all text variants for better search/filtering (stored in raw for debugging)
  const allTextForSearch = `${title} ${descSnippet} ${fullDesc}`.trim();
  
  const metrics = {
    likes: Number(get(item, "likes") || get(item, "likeCount") || 0),
    comments: Number(get(item, "commentsCount") || get(item, "commentCount") || 0),
    shares: 0,
    views: Number(get(item, "viewCount") || get(item, "views") || 0),
  };

  // Handle different channel name fields from different scrapers
  const channelName = String(
    get(channel, "name") || 
    get(item, "channelName") || 
    get(item, "uploader") || 
    get(item, "ownerText") ||
    ""
  );
  const channelId = String(get(channel, "id") || get(item, "channelId") || "");
  const videoId = String(get(item, "id") || get(item, "videoId") || "");

  // Handle interpolatedTimestamp from free-youtube-search-scraper
  // This field often contains relative text like "2 weeks ago" which we parse with confidence levels
  const rawDateValue = get(item, "interpolatedTimestamp") || 
    get(item, "publishedAt") || 
    get(item, "publishedTimeText") || 
    get(item, "date") || 
    get(item, "uploadDate");
  
  const parsedDate = parseDateWithConfidence(rawDateValue);

  return {
    id: `youtube-${videoId || index}-${Date.now()}`,
    platform: "youtube",
    title: title,
    // Use combined description for display AND for keyword filtering
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
    publishedAt: parsedDate.isoString,
    url: String(get(item, "url") || (videoId ? `https://youtube.com/watch?v=${videoId}` : "")),
    contentType: "video",
    media: {
      type: "video",
      url: String(get(item, "url") || ""),
      thumbnailUrl: String(get(item, "thumbnailUrl") || get(item, "thumbnail") || ""),
    },
    hashtags: (get(item, "hashtags") as string[]) || extractHashtags(description),
    // Store raw item with date metadata for debugging and UI display
    raw: { 
      ...item, 
      _searchableText: allTextForSearch,
      _dateConfidence: parsedDate.confidence,
      _dateIsRelative: parsedDate.isRelative,
      _rawDateValue: rawDateValue,
    },
  };
}

// Normalize YouTube Shorts from newbs/youtube-shorts actor
function normalizeYouTubeShort(item: Record<string, unknown>, index: number): NormalizedResult {
  // newbs/youtube-shorts output structure:
  // { id, url, title, viewCount, likeCount, commentCount, channelName, channelUrl, uploadDate, thumbnail, description }
  const title = String(get(item, "title") || "");
  const description = String(get(item, "description") || "");
  const videoId = String(get(item, "id") || get(item, "videoId") || "");
  
  const metrics = {
    likes: Number(get(item, "likeCount") || get(item, "likes") || 0),
    comments: Number(get(item, "commentCount") || get(item, "comments") || 0),
    shares: 0,
    views: Number(get(item, "viewCount") || get(item, "views") || 0),
  };

  const channelName = String(get(item, "channelName") || get(item, "channel") || "");
  const channelUrl = String(get(item, "channelUrl") || "");

  // Parse upload date - could be ISO string or relative like "2 days ago"
  const uploadDate = get(item, "uploadDate") || get(item, "publishedAt");
  
  return {
    id: `youtube_shorts-${videoId || index}-${Date.now()}`,
    platform: "youtube_shorts" as Platform,
    title: title,
    description: description || title,
    author: {
      name: channelName,
      username: channelName,
      url: channelUrl,
      avatarUrl: "",
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(uploadDate),
    url: String(get(item, "url") || (videoId ? `https://youtube.com/shorts/${videoId}` : "")),
    contentType: "video",
    media: {
      type: "video",
      url: String(get(item, "url") || ""),
      thumbnailUrl: String(get(item, "thumbnail") || get(item, "thumbnailUrl") || ""),
    },
    hashtags: extractHashtags(description),
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

  const postType = get(item, "postType") as string || "text";
  
  // trudax uses 'dataPostedAt' (ISO string like "2024-12-15T10:30:00.000Z")
  // Fallback chain for different field names and formats
  const rawDate = get(item, "dataPostedAt") || get(item, "createdAt") || get(item, "created_utc") || get(item, "created") || get(item, "scrapedAt");
  
  // Build URL - trudax provides 'url' directly
  const postUrl = String(get(item, "url") || get(item, "permalink") || "");
  
  // Extract comments array if present (trudax returns 'comments' array with nested comment objects)
  const commentsArray = get(item, "comments") as Array<Record<string, unknown>> | undefined;
  const extractedComments = commentsArray?.map((c) => ({
    author: String(get(c, "username") || get(c, "author") || ""),
    body: String(get(c, "body") || get(c, "text") || ""),
    upVotes: Number(get(c, "upVotes") || get(c, "ups") || get(c, "score") || 0),
    createdAt: get(c, "dataPostedAt") || get(c, "createdAt"),
  })).filter(c => c.body.trim()) || [];

  return {
    id: `reddit-${get(item, "parsedId") || get(item, "id") || index}-${Date.now()}`,
    platform: "reddit",
    title: title || body.substring(0, 100) + (body.length > 100 ? "..." : ""),
    description: body || title,
    author: {
      name: author,
      username: author,
      url: author ? `https://reddit.com/u/${author}` : "",
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(rawDate),
    url: postUrl,
    contentType: postType === "video" ? "video" : postType === "image" ? "image" : "post",
    media: get(item, "media") || get(item, "thumbnail") ? {
      type: postType === "video" ? "video" : "image",
      url: String(get(item, "media.url") || get(item, "videoUrl") || get(item, "imageUrl") || ""),
      thumbnailUrl: String(get(item, "thumbnail") || ""),
    } : undefined,
    hashtags: subreddit ? [subreddit] : [],
    // Include extracted comments in raw for frontend access
    raw: { 
      ...item, 
      _extractedComments: extractedComments,
      _commentsCount: extractedComments.length,
    },
  };
}

// Normalize Reddit Comments from easyapi/reddit-comments-search-scraper
// This actor returns individual comments, not posts
function normalizeRedditComment(item: Record<string, unknown>, index: number): NormalizedResult {
  // easyapi/reddit-comments-search-scraper output structure:
  // { comment_id, post_id, subreddit, author, created_time, score, author_url, title, url, comment_content, votes, comments }
  
  const commentContent = String(get(item, "comment_content") || get(item, "contentText") || get(item, "body") || "");
  const postTitle = String(get(item, "title") || get(item, "post.title") || "");
  const author = String(get(item, "author") || get(item, "author.name") || "");
  const subreddit = String(get(item, "subreddit") || get(item, "subreddit.name") || "");
  
  // easyapi returns 'score' or 'votes' for comment upvotes
  const commentScore = Number(get(item, "score") || get(item, "votes") || 0);
  // Post-level comment count
  const postComments = Number(get(item, "comments") || get(item, "comment_count") || 0);
  
  const commentId = String(get(item, "comment_id") || get(item, "id") || "");
  const postUrl = String(get(item, "url") || "");
  const authorUrl = String(get(item, "author_url") || (author ? `https://reddit.com/u/${author}` : ""));
  
  // Parse created_time - can be ISO string
  const createdTime = get(item, "created_time") || get(item, "created_timestamp") || get(item, "createdAt");

  return {
    id: `reddit_comments-${commentId || index}-${Date.now()}`,
    platform: "reddit_comments" as Platform,
    // For comments, the title is the comment content (truncated)
    title: commentContent.substring(0, 100) + (commentContent.length > 100 ? "..." : ""),
    // Full comment as description, with post context
    description: `💬 Comentario: ${commentContent}\n\n📝 En post: "${postTitle}"`,
    author: {
      name: author,
      username: author,
      url: authorUrl,
    },
    metrics: {
      likes: commentScore,
      comments: postComments, // This is the post's comment count
      shares: 0,
      engagement: commentScore,
    },
    publishedAt: parseDate(createdTime),
    url: postUrl, // URL points to the post (comment is within)
    contentType: "post",
    hashtags: subreddit ? [subreddit] : [],
    raw: {
      ...item,
      _isComment: true,
      _commentContent: commentContent,
      _postTitle: postTitle,
    },
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
      case "youtube_shorts":
        return normalizeYouTubeShort(data, index);
      case "reddit":
        return normalizeReddit(data, index);
      case "reddit_comments":
        // reddit_comments uses the same actor (trudax/reddit-scraper-lite) as regular reddit
        // The difference is in post-processing: we'll filter to show only posts with keyword matches in comments
        // Use normalizeReddit but mark it as reddit_comments platform for UI differentiation
        const normalized = normalizeReddit(data, index);
        normalized.platform = "reddit_comments" as Platform;
        return normalized;
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

    const statusResponse = await fetchWithRetry(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Apify status error:", errorText);

      // Treat transient upstream errors as a non-fatal polling state.
      if (TRANSIENT_STATUS_CODES.has(statusResponse.status)) {
        return new Response(
          JSON.stringify({
            success: true,
            runId,
            status: "RUNNING",
            platform,
            isFinished: false,
            items: [],
            rawCount: 0,
            transientError: true,
            transientStatusCode: statusResponse.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Failed to get run status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.data.status;
    const datasetId = statusData.data.defaultDatasetId;

    // Surface upstream diagnostics to the client so the UI can show actionable errors.
    const statusMessage = statusData.data.statusMessage || statusData.data.message || null;
    const errorMessage = statusData.data.errorMessage || statusData.data.error || null;
    const exitCode = statusData.data.exitCode ?? null;

    // Fetch a small tail of the run log to surface the real root-cause (actors often fail with null statusMessage).
    let logTail: string | null = null;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      try {
        const logResp = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/log?token=${APIFY_API_TOKEN}`
        );
        if (logResp.ok) {
          const fullLog = await logResp.text();
          // Keep response small to avoid blowing up payload size.
          logTail = fullLog.length > 4000 ? fullLog.slice(-4000) : fullLog;
        }
      } catch (e) {
        // Non-fatal: keep diagnostics best-effort.
        console.error("Failed to fetch Apify log tail:", e);
      }
    }

    console.log(
      `Run ${runId} status: ${status}` +
        (statusMessage ? ` | statusMessage: ${statusMessage}` : "") +
        (errorMessage ? ` | errorMessage: ${errorMessage}` : "") +
        (exitCode !== null ? ` | exitCode: ${exitCode}` : "")
    );

    let items: NormalizedResult[] = [];
    let rawCount = 0;

    // If the run is finished, get and normalize the results
    if (status === "SUCCEEDED" && datasetId) {
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=100`
      );

      if (datasetResponse.ok) {
        const rawItems = await datasetResponse.json();
        
        // Log raw item count and first item structure for debugging
        console.log(`Dataset ${datasetId}: ${Array.isArray(rawItems) ? rawItems.length : 'non-array'} raw items for ${platform}`);
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          console.log(`First raw item keys for ${platform}:`, Object.keys(rawItems[0]).slice(0, 15).join(', '));
        }
        
        let normalized = normalizeResults(rawItems, platform as Platform);
        rawCount = normalized.length;

        // YouTube: Enrich with full video description (best-effort) BEFORE keyword filtering.
        // This helps catch mentions that appear only in the full description, not in the snippet.
        if (platform === "youtube" && keywordLower) {
          const searchTerms: string[] = keywordLower
            .split(",")
            .map((t: string) => t.trim().replace(/^@/, ""))
            .filter(Boolean);

          let enriched = 0;
          const maxEnrich = 12; // keep runtime small

          for (const item of normalized) {
            if (enriched >= maxEnrich) break;
            const currentText = `${item.title} ${item.description}`.toLowerCase();
            const alreadyMatches = searchTerms.some((t) => currentText.includes(t));
            if (alreadyMatches) continue;

            const url = item.url;
            if (!url || !url.includes("youtube.com/watch")) continue;

            const fullDesc = await tryFetchYouTubeFullDescription(url);
            if (fullDesc) {
              // Append so we don't lose snippet context.
              item.description = `${item.description}\n\n${fullDesc}`.trim();
              item.raw = { ...item.raw, _fullDescription: fullDesc, _fullDescriptionSource: "youtube_html" };
              enriched++;
            }
          }

          if (enriched > 0) {
            console.log(`YouTube: enriched ${enriched} items with full descriptions before filtering.`);
          }
        }

        // Filter by keyword for platforms that need it
        // SKIP filtering for TikTok - keywords appear in video overlays (OCR) not in metadata
        // User prefers to see all results and manually curate
        //
        // SOFT FILTER for YouTube: When the query IS the keyword, Apify already searched for it.
        // Re-filtering would be overly restrictive (e.g. a video about "Actinver" might not repeat the word in title).
        // So for YouTube we skip keyword filtering entirely and rely on frontend date filtering.
        // Reddit & YouTube: Apify already searched for the keyword, so re-filtering is
        // redundant and overly restrictive (drops 95%+ of valid results). Skip keyword filter.
        const useSoftFilter = platform === "youtube" || platform === "reddit" || platform === "reddit_comments";
        
        if (keywordLower && platform !== "tiktok" && !useSoftFilter) {
          const beforeCount = normalized.length;
          
          // Handle multiple search terms separated by commas (e.g., "Actinver, @actinver, @actinver_trade")
          const searchTerms: string[] = keywordLower.split(",").map((t: string) => t.trim().replace(/^@/, "")).filter(Boolean);
          
          // For reddit_comments: prefer showing only posts where keyword appears in comments.
          // IMPORTANT: Some Reddit actors do NOT return comment bodies, even if maxComments is set.
          // In that case, a strict comments-only filter would incorrectly drop everything to 0.
          const isCommentsOnlySearch = platform === "reddit_comments";
          const commentsAvailable =
            (platform === "reddit" || platform === "reddit_comments") &&
            normalized.some((i) => Array.isArray((i as any)?.raw?._extractedComments) && ((i as any).raw._extractedComments?.length || 0) > 0);
          
          normalized = normalized.filter((item) => {
            // Check title, description/content, hashtags, author username and name
            const mainText = `${item.title} ${item.description} ${(item.hashtags || []).join(" ")} ${item.author?.name || ""} ${item.author?.username || ""}`.toLowerCase();
            
            // Check if main content matches
            const matchesMain = searchTerms.some((term: string) => mainText.includes(term));
            
            // For Reddit/reddit_comments: ALSO check extracted comments for keyword matches
            // This catches posts where "Actinver" is mentioned in comments but not in title/body
            let matchesComment = false;
            if ((platform === "reddit" || platform === "reddit_comments") && item.raw?._extractedComments) {
              const comments = item.raw._extractedComments as Array<{ body: string; author: string }>;
              const commentsText = comments.map((c) => `${c.body} ${c.author}`).join(" ").toLowerCase();
              matchesComment = searchTerms.some((term: string) => commentsText.includes(term));
              
              if (matchesComment) {
                // Mark that this item matched via comment
                item.raw._matchedInComment = true;
                item.raw._matchingComments = comments.filter((c) => 
                  searchTerms.some((term: string) => c.body.toLowerCase().includes(term))
                );
              }
            }
            
            // For reddit_comments mode:
            // - If comments are available: ONLY include if keyword is in comments.
            // - If comments are NOT available from the actor: fallback to main-text matching
            //   and mark results so UI/diagnostics can explain the limitation.
            // For regular reddit: include if keyword is anywhere (title/body OR comments)
            if (isCommentsOnlySearch) {
              if (!commentsAvailable) {
                item.raw = { ...(item.raw || {}), _commentsUnavailable: true };
                return matchesMain;
              }
              return matchesComment; // Only keep posts with comment matches
            }
            
            return matchesMain || matchesComment;
          });
          
          // Count how many matched via comments only
          const commentMatches = normalized.filter((i) => i.raw?._matchedInComment).length;
          const logExtra = commentMatches > 0 ? ` (${commentMatches} matched in comments)` : "";
          const modeLabel = isCommentsOnlySearch ? " [COMMENTS-ONLY MODE]" : "";
          const commentsNote = isCommentsOnlySearch && !commentsAvailable ? " [NO-COMMENTS-IN-DATASET → FALLBACK TO POST MATCH]" : "";
          console.log(
            `Filtered ${platform} results from ${beforeCount} to ${normalized.length} using keywords: ${searchTerms.join(", ")}${logExtra}${modeLabel}${commentsNote}`
          );
        } else if (platform === "tiktok") {
          console.log(`Skipping keyword filter for TikTok - returning all ${normalized.length} results (user curates manually)`);
        } else if (useSoftFilter) {
          console.log(`SOFT FILTER: Skipping keyword filter for ${platform} - Apify already searched for query "${keywordLower}". Returning all ${normalized.length} results.`);
        }

        // Sort all results chronologically (newest first)
        normalized.sort((a, b) => {
          const dateA = new Date(a.publishedAt).getTime();
          const dateB = new Date(b.publishedAt).getTime();
          // Handle invalid dates by putting them at the end
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;
          return dateB - dateA; // Descending (newest first)
        });

        items = normalized;
        console.log(`Retrieved and normalized ${items.length} items from dataset (sorted chronologically)`);
      }
    }

    // Capture whether soft filter was used
    const usedSoftFilter = keywordLower && (platform === "youtube" || platform === "reddit" || platform === "reddit_comments");

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        status,
        statusMessage,
        platform,
        isFinished: ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status),
        error:
          status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT"
            ? (errorMessage || statusMessage || `Job ${status}`)
            : undefined,
        runDiagnostics:
          status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT"
            ? { statusMessage, errorMessage, exitCode, logTail }
            : undefined,
        items: status === "SUCCEEDED" ? items : [],
        rawCount: rawCount, // Include raw count before filtering
        softFilter: usedSoftFilter, // True if keyword filtering was skipped
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
