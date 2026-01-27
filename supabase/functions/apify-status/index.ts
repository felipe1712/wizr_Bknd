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
  // Handle powerai/facebook-post-search-scraper format (primary)
  // and fallback for page scraper formats
  const author = item.author as Record<string, unknown> | undefined;
  
  const text = String(
    get(item, "message") ||  // powerai format
    get(item, "text") || 
    get(item, "postText") || 
    get(item, "content") ||
    ""
  );
  
  // powerai format returns author object with id, name, url, profile_picture_url
  const authorName = String(
    get(author, "name") ||
    get(item, "pageName") || 
    get(item, "page.name") || 
    get(item, "authorName") ||
    get(item, "user_name") ||
    get(item, "userName") ||
    ""
  );
  
  const authorUrl = String(
    get(author, "url") ||
    get(item, "pageUrl") || 
    get(item, "page.url") || 
    get(item, "authorUrl") ||
    get(item, "user_url") ||
    get(item, "profileUrl") ||
    ""
  );
  
  const authorAvatar = String(
    get(author, "profile_picture_url") ||
    get(item, "page.profilePicture") || 
    get(item, "authorAvatar") || 
    get(item, "profilePicture") || 
    ""
  );
  
  // powerai format uses reactions_count, comments_count, reshare_count
  const metrics = {
    likes: Number(
      get(item, "reactions_count") || // powerai format
      get(item, "likes") || 
      get(item, "likesCount") || 
      get(item, "reactions") || 
      get(item, "reactionCount") || 
      0
    ),
    comments: Number(
      get(item, "comments_count") || // powerai format
      get(item, "comments") || 
      get(item, "commentsCount") || 
      get(item, "commentCount") || 
      0
    ),
    shares: Number(
      get(item, "reshare_count") || // powerai format
      get(item, "shares") || 
      get(item, "sharesCount") || 
      get(item, "shareCount") || 
      0
    ),
  };

  // Handle various URL formats
  const postUrl = String(
    get(item, "url") || 
    get(item, "postUrl") || 
    get(item, "link") ||
    ""
  );
  
  // powerai uses 'type' field and 'timestamp' (unix)
  const postType = String(get(item, "type") || "post");
  const hasVideo = Boolean(get(item, "video") || get(item, "video_files"));
  const hasImage = Boolean(get(item, "image") || get(item, "album_preview"));

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
      followers: Number(get(item, "page.likes") || get(item, "followersCount") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(
      get(item, "timestamp") || // powerai uses unix timestamp
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
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    // powerai often includes create time under different keys; keep wide mapping
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
  const channel = item.channel as Record<string, unknown> | undefined;
  const title = String(get(item, "title") || get(item, "text") || "");
  const description = String(get(item, "description") || get(item, "descriptionSnippet") || get(item, "text") || title);
  
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
  const publishedAt = get(item, "interpolatedTimestamp") 
    ? parseDate(get(item, "interpolatedTimestamp"))
    : parseDate(get(item, "publishedAt") || get(item, "publishedTimeText") || get(item, "date") || get(item, "uploadDate"));

  return {
    id: `youtube-${videoId || index}-${Date.now()}`,
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
    publishedAt: publishedAt,
    url: String(get(item, "url") || (videoId ? `https://youtube.com/watch?v=${videoId}` : "")),
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

  const postType = get(item, "postType") as string || "text";
  
  // trudax uses 'scrapedAt' or 'dataPostedAt' - try multiple fields
  // Also handle unix timestamps
  const rawDate = get(item, "dataPostedAt") || get(item, "scrapedAt") || get(item, "createdAt") || get(item, "created_utc") || get(item, "created");
  
  // Build URL - trudax provides 'url' directly
  const postUrl = String(get(item, "url") || get(item, "permalink") || "");

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

        // Filter by keyword for ALL platforms to reduce false positives
        // Apify actors often return noisy/irrelevant results
        if (keywordLower) {
          const beforeCount = normalized.length;
          
          // Handle multiple search terms separated by commas (e.g., "Actinver, @actinver, @actinver_trade")
          const searchTerms: string[] = keywordLower.split(",").map((t: string) => t.trim().replace(/^@/, "")).filter(Boolean);
          
          normalized = normalized.filter((item) => {
            // Check title, description/content, hashtags, author username and name
            const text = `${item.title} ${item.description} ${(item.hashtags || []).join(" ")} ${item.author?.name || ""} ${item.author?.username || ""}`.toLowerCase();
            // Match if ANY of the search terms is found
            return searchTerms.some((term: string) => text.includes(term));
          });
          console.log(`Filtered ${platform} results from ${beforeCount} to ${normalized.length} using keywords: ${searchTerms.join(", ")}`);
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

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        status,
        platform,
        isFinished: ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status),
        items: status === "SUCCEEDED" ? items : [],
        rawCount: rawCount, // Include raw count before filtering
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
