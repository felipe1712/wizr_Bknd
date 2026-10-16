// ============================================================
// CANONICAL NORMALIZATION MODULE — v2
// Single source of truth for all social media result normalization.
// Used by: apify-results, apify-status, scheduled-unified-search
// ============================================================

export type Platform = "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "youtube_shorts" | "reddit" | "reddit_comments";

export interface NormalizedResult {
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

// ==================== HELPERS ====================

export function get(obj: unknown, path: string, defaultValue: unknown = undefined): unknown {
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

export function parseRelativeTime(text: string): { date: Date; confidence: "high" | "medium" | "low" } | null {
  if (!text || typeof text !== "string") return null;
  const lowerText = text.toLowerCase().trim();
  const now = new Date();

  const patterns: Array<{ regex: RegExp; getMs: (n: number) => number; confidence: "high" | "medium" | "low" }> = [
    { regex: /(\d+)\s*hour(?:s)?\s*ago/i, getMs: (n) => n * 3600000, confidence: "high" },
    { regex: /(\d+)\s*day(?:s)?\s*ago/i, getMs: (n) => n * 86400000, confidence: "high" },
    { regex: /(\d+)\s*week(?:s)?\s*ago/i, getMs: (n) => n * 604800000, confidence: "medium" },
    { regex: /(\d+)\s*month(?:s)?\s*ago/i, getMs: (n) => n * 2592000000, confidence: "medium" },
    { regex: /(\d+)\s*year(?:s)?\s*ago/i, getMs: (n) => n * 31536000000, confidence: "low" },
    { regex: /yesterday/i, getMs: () => 86400000, confidence: "high" },
    { regex: /today|just now|moments? ago/i, getMs: () => 0, confidence: "high" },
  ];

  for (const { regex, getMs, confidence } of patterns) {
    const match = lowerText.match(regex);
    if (match) {
      const value = match[1] ? parseInt(match[1], 10) : 1;
      return { date: new Date(now.getTime() - getMs(value)), confidence };
    }
  }
  return null;
}

export interface ParsedDate {
  isoString: string;
  confidence?: "high" | "medium" | "low";
  isRelative?: boolean;
}

export function parseDateWithConfidence(value: unknown): ParsedDate {
  if (!value) return { isoString: new Date().toISOString(), confidence: "low" };
  if (typeof value === "number") {
    const timestamp = value > 1e12 ? value : value * 1000;
    return { isoString: new Date(timestamp).toISOString(), confidence: "high" };
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return { isoString: parsed.toISOString(), confidence: "high" };
    const relativeResult = parseRelativeTime(value);
    if (relativeResult) return { isoString: relativeResult.date.toISOString(), confidence: relativeResult.confidence, isRelative: true };
  }
  return { isoString: new Date().toISOString(), confidence: "low" };
}

export function parseDate(value: unknown): string {
  return parseDateWithConfidence(value).isoString;
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? matches.map(h => h.substring(1)) : [];
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w]+/g);
  return matches ? matches.map(m => m.substring(1)) : [];
}

export function calculateEngagement(metrics: { likes: number; comments: number; shares: number; views?: number }): number {
  const totalInteractions = metrics.likes + metrics.comments + metrics.shares;
  if (metrics.views && metrics.views > 0) {
    return Math.round((totalInteractions / metrics.views) * 10000) / 100;
  }
  return totalInteractions;
}

// ==================== PLATFORM NORMALIZERS ====================

function normalizeTwitter(item: Record<string, unknown>, index: number): NormalizedResult {
  const user = item.user as Record<string, unknown> | undefined;
  const author = item.author as Record<string, unknown> | undefined;

  const username = String(get(item, "screen_name") || get(user, "screen_name") || get(author, "userName") || get(item, "user_screen_name") || "");
  const authorName = String(get(item, "name") || get(user, "name") || get(author, "name") || username);
  const text = String(get(item, "full_text") || get(item, "text") || get(item, "tweet") || "");
  const tweetId = String(get(item, "id") || get(item, "id_str") || get(item, "tweet_id") || "");

  const metrics = {
    likes: Number(get(item, "favorite_count") || get(item, "favorites") || get(item, "likeCount") || 0),
    comments: Number(get(item, "reply_count") || get(item, "replies") || get(item, "replyCount") || 0),
    shares: Number(get(item, "retweet_count") || get(item, "retweets") || get(item, "retweetCount") || 0),
    views: Number(get(item, "views") || get(item, "viewCount") || get(item, "views_count") || 0),
  };

  return {
    id: `twitter-${tweetId || index}-${Date.now()}`,
    platform: "twitter",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: authorName,
      username,
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
  // Handles: powerai, scraper_one, apify/facebook-posts-scraper
  const author = item.author as Record<string, unknown> | undefined;

  const text = String(get(item, "message") || get(item, "text") || get(item, "postText") || get(item, "content") || get(item, "caption") || "");
  const authorName = String(get(author, "name") || get(item, "authorName") || get(item, "pageName") || get(item, "page.name") || get(item, "user_name") || get(item, "userName") || get(item, "profileName") || "");
  const authorUrl = String(get(author, "url") || get(item, "authorUrl") || get(item, "profileUrl") || get(item, "pageUrl") || get(item, "page.url") || get(item, "user_url") || "");
  const authorAvatar = String(get(author, "profile_picture_url") || get(item, "authorProfilePicture") || get(item, "profilePicture") || get(item, "page.profilePicture") || get(item, "authorAvatar") || "");

  const metrics = {
    likes: Number(get(item, "reactions_count") || get(item, "likesCount") || get(item, "likes") || get(item, "reactions") || get(item, "reactionCount") || 0),
    comments: Number(get(item, "comments_count") || get(item, "commentsCount") || get(item, "comments") || get(item, "commentCount") || 0),
    shares: Number(get(item, "reshare_count") || get(item, "sharesCount") || get(item, "shares") || get(item, "shareCount") || 0),
  };

  const postUrl = String(get(item, "url") || get(item, "postUrl") || get(item, "link") || get(item, "permalink") || "");
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
    publishedAt: parseDate(get(item, "timestamp") || get(item, "postedAt") || get(item, "time") || get(item, "publishedAt") || get(item, "date") || get(item, "createdAt") || get(item, "scrapedAt")),
    url: postUrl,
    contentType: hasVideo ? "video" : hasImage ? "image" : "post",
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeTikTok(item: Record<string, unknown>, index: number): NormalizedResult {
  // Handles: sociavault, clockworks, powerai
  const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
  const authorObj = (get(item, "author") as Record<string, unknown>) || undefined;
  const authorInfoObj = (get(item, "author_info") as Record<string, unknown>) || undefined;

  const description = String(get(item, "description") || "");
  const title = String(get(item, "title") || "");
  const desc = String(get(item, "content_desc") || "");
  const legacyText = String(get(item, "text") || get(item, "desc") || "");
  const text = (description || title || desc || legacyText).trim();

  const username = String(
    get(authorObj, "nickname") || get(authorObj, "unique_id") || get(authorObj, "uniqueId") || get(authorObj, "username") ||
    get(authorMeta, "name") || get(authorInfoObj, "unique_id") || get(authorInfoObj, "uniqueId") || get(authorInfoObj, "username") ||
    get(item, "author") || get(item, "authorName") || ""
  );
  const displayName = String(get(authorObj, "nickname") || get(authorMeta, "nickName") || get(authorMeta, "nickname") || get(authorInfoObj, "nickname") || username);

  const metrics = {
    likes: Number(get(item, "likes") || get(item, "diggCount") || get(item, "likeCount") || get(item, "likesCount") || get(item, "like") || get(item, "stats.diggCount") || 0),
    comments: Number(get(item, "comments") || get(item, "commentCount") || get(item, "commentsCount") || get(item, "comment") || get(item, "stats.commentCount") || 0),
    shares: Number(get(item, "shares") || get(item, "shareCount") || get(item, "share") || get(item, "stats.shareCount") || 0),
    views: Number(get(item, "views") || get(item, "playCount") || get(item, "viewCount") || get(item, "play") || get(item, "stats.playCount") || 0),
  };

  const videoId = String(get(item, "video_id") || get(item, "id") || get(item, "aweme_id") || "");
  let url = String(get(item, "webVideoUrl") || get(item, "share_url") || get(item, "url") || get(item, "videoUrl") || "");
  if (!url && videoId) {
    const uniqueId = String(get(authorObj, "unique_id") || get(authorObj, "uniqueId") || get(authorMeta, "uniqueId") || get(authorMeta, "name") || get(authorInfoObj, "unique_id") || "");
    url = uniqueId ? `https://www.tiktok.com/@${uniqueId}/video/${videoId}` : `https://www.tiktok.com/t/${videoId}`;
  }

  return {
    id: `tiktok-${videoId || index}-${Date.now()}`,
    platform: "tiktok",
    title: (text || title).substring(0, 100) + ((text || title).length > 100 ? "..." : ""),
    description: text || title || desc,
    author: {
      name: displayName,
      username,
      url: username ? `https://tiktok.com/@${username}` : "",
      avatarUrl: String(get(authorMeta, "avatar") || get(authorObj, "avatar") || get(authorObj, "avatar_thumb") || get(authorInfoObj, "avatar") || get(authorInfoObj, "avatar_thumb") || get(item, "authorAvatar") || ""),
      verified: Boolean(get(authorMeta, "verified") || get(authorObj, "verified") || get(authorInfoObj, "verified") || get(item, "authorVerified")),
      followers: Number(get(authorMeta, "fans") || get(authorMeta, "followers") || get(authorObj, "follower_count") || get(authorInfoObj, "follower_count") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "created_at") || get(item, "createTime") || get(item, "createTimeISO") || get(item, "createdAt") || get(item, "create_time") || get(item, "create_time_iso")),
    url,
    contentType: "video",
    media: {
      type: "video",
      url: String(get(item, "videoUrl") || get(item, "wmplay") || get(item, "play") || get(item, "webVideoUrl") || url || ""),
      thumbnailUrl: String(get(item, "covers.default") || get(item, "thumbnail") || get(item, "cover") || get(item, "origin_cover") || get(item, "ai_dynamic_cover") || ""),
    },
    hashtags: (get(item, "hashtags") as Array<Record<string, string>>)
      ? (get(item, "hashtags") as Array<Record<string, string>>).map(h => h.name || h.title || "").filter(Boolean)
      : extractHashtags(text),
    mentions: extractMentions(text),
    raw: item,
  };
}

function normalizeInstagram(item: Record<string, unknown>, index: number): NormalizedResult {
  const caption = String(get(item, "caption") || "");
  const description = String(get(item, "description") || "");
  const text = caption || description;
  const username = String(get(item, "ownerUsername") || get(item, "owner.username") || "");
  const type = get(item, "type") as string || "image";

  const metrics = {
    likes: Number(get(item, "likesCount") || get(item, "likes") || 0),
    comments: Number(get(item, "commentsCount") || get(item, "comments") || 0),
    shares: 0,
    views: Number(get(item, "videoViewCount") || get(item, "views") || 0),
  };

  return {
    id: `instagram-${get(item, "id") || get(item, "shortCode") || index}-${Date.now()}`,
    platform: "instagram",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: String(get(item, "ownerFullName") || get(item, "owner.fullName") || username),
      username,
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
      type: (type === "Video" || type === "video" ? "video" : type === "Sidecar" ? "carousel" : "image") as "video" | "image" | "carousel",
      url: String(get(item, "displayUrl") || get(item, "videoUrl") || ""),
      thumbnailUrl: String(get(item, "thumbnailUrl") || get(item, "displayUrl") || ""),
    },
    hashtags: (get(item, "hashtags") as string[]) || extractHashtags(text),
    mentions: (get(item, "mentions") as string[]) || extractMentions(text),
    raw: item,
  };
}

function normalizeLinkedIn(item: Record<string, unknown>, index: number): NormalizedResult {
  // Handles harvestapi/linkedin-post-search nested format
  const author = item.author as Record<string, unknown> | undefined;
  const engagement = item.engagement as Record<string, unknown> | undefined;
  const postedAt = item.postedAt as Record<string, unknown> | undefined;

  const text = String(get(item, "content") || get(item, "text") || get(item, "commentary") || get(item, "postText") || "");
  const authorName = String(get(author, "name") || get(item, "authorName") || get(item, "companyName") || "");
  const authorUsername = String(get(author, "publicIdentifier") || get(item, "authorUsername") || "");
  const authorUrl = String(get(author, "linkedinUrl") || get(author, "url") || get(item, "authorUrl") || "");
  const avatarUrl = (() => {
    const avatar = get(author, "avatar") as Record<string, unknown> | undefined;
    return String(avatar?.url || get(author, "profilePicture") || get(author, "image") || "");
  })();

  const metrics = {
    likes: Number(get(engagement, "likes") || get(item, "numLikes") || get(item, "likes") || get(item, "likeCount") || 0),
    comments: Number(get(engagement, "comments") || get(item, "numComments") || get(item, "comments") || get(item, "commentCount") || 0),
    shares: Number(get(engagement, "shares") || get(item, "numShares") || get(item, "shares") || get(item, "repostCount") || 0),
  };

  const publishedDate = postedAt
    ? parseDate(get(postedAt, "date") || get(postedAt, "timestamp"))
    : parseDate(get(item, "postedAt") || get(item, "postedDate") || get(item, "publishedAt"));

  const postUrl = String(get(item, "linkedinUrl") || get(item, "url") || get(item, "postUrl") || "");

  return {
    id: `linkedin-${get(item, "id") || get(item, "urn") || index}-${Date.now()}`,
    platform: "linkedin",
    title: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
    description: text,
    author: {
      name: authorName,
      username: authorUsername,
      url: authorUrl,
      avatarUrl,
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
  const channel = item.channel as Record<string, unknown> | undefined;
  const aboutChannelInfo = item.aboutChannelInfo as Record<string, unknown> | undefined;
  const title = String(get(item, "title") || get(item, "text") || "");

  // Combine all description sources for better keyword matching
  const descSnippet = String(get(item, "descriptionSnippet") || "");
  const fullDesc = String(get(item, "description") || "");
  const textField = String(get(item, "text") || "");
  const description = fullDesc || descSnippet || textField || title;
  const allTextForSearch = `${title} ${descSnippet} ${fullDesc}`.trim();

  const metrics = {
    likes: Number(get(item, "likes") || get(item, "likeCount") || 0),
    comments: Number(get(item, "commentsCount") || get(item, "commentCount") || 0),
    shares: 0,
    views: Number(get(item, "viewCount") || get(item, "views") || 0),
  };

  const channelName = String(get(item, "channelName") || get(channel, "name") || get(aboutChannelInfo, "channelName") || get(item, "uploader") || get(item, "ownerText") || "");
  const channelUsername = String(get(item, "channelUsername") || get(aboutChannelInfo, "channelUsername") || get(channel, "username") || channelName);
  const channelId = String(get(item, "channelId") || get(channel, "id") || get(aboutChannelInfo, "channelId") || "");
  const channelUrl = String(
    get(item, "channelUrl") || get(channel, "url") || get(aboutChannelInfo, "channelUrl") ||
    (channelUsername && channelUsername !== channelName ? `https://youtube.com/@${channelUsername}` : "") ||
    (channelId ? `https://youtube.com/channel/${channelId}` : "")
  );

  const videoUrl = String(get(item, "url") || "");
  const durationSeconds = Number(get(item, "duration") || get(item, "lengthSeconds") || get(item, "durationSeconds") || 0);
  const isShort = Boolean(get(item, "isShort") || get(item, "isShorts") || videoUrl.includes("/shorts/") || (durationSeconds > 0 && durationSeconds <= 60));
  const videoId = String(get(item, "id") || get(item, "videoId") || "");
  const finalUrl = videoUrl || (videoId ? `https://youtube.com/watch?v=${videoId}` : "");

  const rawDateValue = get(item, "interpolatedTimestamp") || get(item, "publishedAt") || get(item, "publishedTimeText") || get(item, "date") || get(item, "uploadDate");
  const parsedDate = parseDateWithConfidence(rawDateValue);

  return {
    id: `youtube-${videoId || index}-${Date.now()}`,
    platform: "youtube",
    title,
    description,
    author: {
      name: channelName,
      username: channelUsername,
      url: channelUrl,
      avatarUrl: String(get(aboutChannelInfo, "channelAvatarUrl") || get(channel, "thumbnail") || get(item, "channelThumbnail") || ""),
      verified: Boolean(get(aboutChannelInfo, "isChannelVerified") || get(channel, "verified")),
      followers: Number(get(aboutChannelInfo, "numberOfSubscribers") || get(channel, "subscriberCount") || get(item, "channelSubscribers") || 0),
    },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parsedDate.isoString,
    url: finalUrl,
    contentType: "video",
    media: {
      type: "video",
      url: finalUrl,
      thumbnailUrl: String(get(item, "thumbnailUrl") || get(item, "thumbnail") || ""),
    },
    hashtags: (get(item, "hashtags") as string[]) || extractHashtags(description),
    raw: { ...item, _isShort: isShort, _durationSeconds: durationSeconds, _searchableText: allTextForSearch, _dateConfidence: parsedDate.confidence, _dateIsRelative: parsedDate.isRelative, _rawDateValue: rawDateValue },
  };
}

function normalizeYouTubeShort(item: Record<string, unknown>, index: number): NormalizedResult {
  const title = String(get(item, "title") || "");
  const description = String(get(item, "description") || "");
  const videoId = String(get(item, "id") || get(item, "videoId") || "");
  const channelName = String(get(item, "channelName") || get(item, "channel") || "");
  const channelUrl = String(get(item, "channelUrl") || "");

  const metrics = {
    likes: Number(get(item, "likeCount") || get(item, "likes") || 0),
    comments: Number(get(item, "commentCount") || get(item, "comments") || 0),
    shares: 0,
    views: Number(get(item, "viewCount") || get(item, "views") || 0),
  };

  return {
    id: `youtube_shorts-${videoId || index}-${Date.now()}`,
    platform: "youtube_shorts" as Platform,
    title,
    description: description || title,
    author: { name: channelName, username: channelName, url: channelUrl, avatarUrl: "" },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(get(item, "uploadDate") || get(item, "publishedAt")),
    url: String(get(item, "url") || (videoId ? `https://youtube.com/shorts/${videoId}` : "")),
    contentType: "video",
    media: { type: "video", url: String(get(item, "url") || ""), thumbnailUrl: String(get(item, "thumbnail") || get(item, "thumbnailUrl") || "") },
    hashtags: extractHashtags(description),
    raw: item,
  };
}

function normalizeReddit(item: Record<string, unknown>, index: number): NormalizedResult {
  const title = String(get(item, "title") || "");
  const body = String(get(item, "body") || get(item, "selftext") || get(item, "text") || "");
  const author = String(get(item, "username") || get(item, "author") || "");
  const subreddit = String(get(item, "communityName") || get(item, "parsedCommunityName") || get(item, "subreddit") || "");

  const metrics = {
    likes: Number(get(item, "upVotes") || get(item, "upvotes") || get(item, "score") || get(item, "ups") || 0),
    comments: Number(get(item, "numberOfComments") || get(item, "numComments") || get(item, "commentsCount") || get(item, "num_comments") || 0),
    shares: 0,
  };

  const postType = String(get(item, "postType") || get(item, "dataType") || "text");
  const rawId = String(get(item, "parsedId") || get(item, "id") || "");
  const rawDate = get(item, "dataPostedAt") || get(item, "createdAt") || get(item, "created_utc") || get(item, "created") || get(item, "scrapedAt");
  const postUrl = String(get(item, "url") || get(item, "permalink") || "");

  // Extract comments array if present (trudax returns nested comment objects)
  const commentsArray = get(item, "comments") as Array<Record<string, unknown>> | undefined;
  const extractedComments = commentsArray?.map((c) => ({
    author: String(get(c, "username") || get(c, "author") || ""),
    body: String(get(c, "body") || get(c, "text") || ""),
    upVotes: Number(get(c, "upVotes") || get(c, "ups") || get(c, "score") || 0),
    createdAt: get(c, "dataPostedAt") || get(c, "createdAt"),
  })).filter(c => c.body.trim()) || [];

  return {
    id: `reddit-${rawId || index}-${Date.now()}`,
    platform: "reddit",
    title: title || body.substring(0, 100) + (body.length > 100 ? "..." : ""),
    description: body || title,
    author: { name: author, username: author, url: author ? `https://reddit.com/u/${author}` : "" },
    metrics: { ...metrics, engagement: calculateEngagement(metrics) },
    publishedAt: parseDate(rawDate),
    url: postUrl,
    contentType: postType === "video" ? "video" : postType === "image" ? "image" : "post",
    media: get(item, "media") || get(item, "thumbnail") || get(item, "imageUrls") ? {
      type: (postType === "video" ? "video" : "image") as "video" | "image",
      url: String(
        (Array.isArray(get(item, "imageUrls")) && (get(item, "imageUrls") as string[]).length > 0)
          ? (get(item, "imageUrls") as string[])[0]
          : get(item, "media.url") || get(item, "videoUrl") || get(item, "imageUrl") || get(item, "link") || ""
      ),
      thumbnailUrl: String(get(item, "thumbnailUrl") || get(item, "thumbnail") || ""),
    } : undefined,
    hashtags: subreddit ? [subreddit] : [],
    raw: { ...item, _extractedComments: extractedComments, _commentsCount: extractedComments.length },
  };
}

function normalizeRedditComment(item: Record<string, unknown>, index: number): NormalizedResult {
  const commentContent = String(get(item, "comment_content") || get(item, "contentText") || get(item, "body") || "");
  const postTitle = String(get(item, "title") || get(item, "post.title") || "");
  const author = String(get(item, "author") || get(item, "author.name") || "");
  const subreddit = String(get(item, "subreddit") || get(item, "subreddit.name") || "");
  const commentScore = Number(get(item, "score") || get(item, "votes") || 0);
  const postComments = Number(get(item, "comments") || get(item, "comment_count") || 0);
  const commentId = String(get(item, "comment_id") || get(item, "id") || "");
  const postUrl = String(get(item, "url") || "");
  const authorUrl = String(get(item, "author_url") || (author ? `https://reddit.com/u/${author}` : ""));

  return {
    id: `reddit_comments-${commentId || index}-${Date.now()}`,
    platform: "reddit_comments" as Platform,
    title: commentContent.substring(0, 100) + (commentContent.length > 100 ? "..." : ""),
    description: `💬 Comentario: ${commentContent}\n\n📝 En post: "${postTitle}"`,
    author: { name: author, username: author, url: authorUrl },
    metrics: { likes: commentScore, comments: postComments, shares: 0, engagement: commentScore },
    publishedAt: parseDate(get(item, "created_time") || get(item, "created_timestamp") || get(item, "createdAt")),
    url: postUrl,
    contentType: "post",
    hashtags: subreddit ? [subreddit] : [],
    raw: { ...item, _isComment: true, _commentContent: commentContent, _postTitle: postTitle },
  };
}

// ==================== MAIN NORMALIZER ====================

export function normalizeResults(items: unknown[], platform: Platform | string): NormalizedResult[] {
  return (items || []).map((item, index) => {
    const data = item as Record<string, unknown>;
    switch (platform) {
      case "twitter": return normalizeTwitter(data, index);
      case "facebook": return normalizeFacebook(data, index);
      case "tiktok": return normalizeTikTok(data, index);
      case "instagram": return normalizeInstagram(data, index);
      case "linkedin": return normalizeLinkedIn(data, index);
      case "youtube": return normalizeYouTube(data, index);
      case "youtube_shorts": return normalizeYouTubeShort(data, index);
      case "reddit": return normalizeReddit(data, index);
      case "reddit_comments": {
        // Check if this is from easyapi/reddit-comments-search-scraper (has comment_content)
        if (data.comment_content || data.contentText) {
          return normalizeRedditComment(data, index);
        }
        // Otherwise it's from trudax — use regular Reddit normalizer but mark platform
        const normalized = normalizeReddit(data, index);
        normalized.platform = "reddit_comments" as Platform;
        return normalized;
      }
      default:
        return {
          id: `unknown-${index}-${Date.now()}`,
          platform: platform as Platform,
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

// ==================== AGGREGATE METRICS ====================

export function calculateAggregateMetrics(results: NormalizedResult[]) {
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

/**
 * Convert a NormalizedResult to a flat mention row for upserting into the mentions table.
 */
export function toMentionRow(
  result: NormalizedResult,
  projectId: string,
  entityId: string,
  matchedKeywords: string[]
) {
  return {
    project_id: projectId,
    url: result.url,
    title: result.title || null,
    description: result.description || null,
    source_domain: result.platform,
    entity_id: entityId,
    matched_keywords: matchedKeywords,
    published_at: result.publishedAt || null,
    raw_metadata: {
      author: result.author,
      metrics: result.metrics,
      contentType: result.contentType,
      media: result.media,
      hashtags: result.hashtags,
      mentions: result.mentions,
    },
  };
}

// ============================================================
// SNIPPET DATE PARSER — extracts publication date from
// Firecrawl/Google search snippets when metadata.publishedDate
// is missing. Returns ISO string + confidence level.
// ============================================================

export type DateConfidence = "high" | "medium" | "low" | "unknown";

const MONTH_MAP_ES: Record<string, number> = {
  enero: 0, ene: 0, febrero: 1, feb: 1, marzo: 2, mar: 2, abril: 3, abr: 3,
  mayo: 4, may: 4, junio: 5, jun: 5, julio: 6, jul: 6, agosto: 7, ago: 7,
  septiembre: 8, setiembre: 8, sep: 8, sept: 8, octubre: 9, oct: 9,
  noviembre: 10, nov: 10, diciembre: 11, dic: 11,
};
const MONTH_MAP_EN: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};

function clampDate(d: Date): string | null {
  if (isNaN(d.getTime())) return null;
  const now = Date.now();
  const t = d.getTime();
  // Reject future dates >2 days ahead and dates >5 years old
  if (t > now + 2 * 86400_000) return null;
  if (t < now - 5 * 365 * 86400_000) return null;
  return d.toISOString();
}

/**
 * Parse a publication date from a free-text snippet.
 * Handles: "hace N días/horas/semanas/meses", "May 12, 2026",
 * "12 may 2026", "12 de mayo de 2026", ISO "YYYY-MM-DD".
 * Returns null if nothing reliable found.
 */
export function parseSnippetDate(text: string | null | undefined, now: Date = new Date()): string | null {
  if (!text) return null;
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1) "hace N {unit}" (es) / "N {unit} ago" (en)
  const rel = t.match(/hace\s+(\d{1,3})\s+(minuto|hora|dia|día|semana|mes|ano|año)s?/) ||
              t.match(/(\d{1,3})\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const u = rel[2];
    const ms =
      u.startsWith("minut") ? n * 60_000 :
      u.startsWith("hora") || u.startsWith("hour") ? n * 3600_000 :
      u.startsWith("dia") || u.startsWith("día") || u.startsWith("day") ? n * 86400_000 :
      u.startsWith("seman") || u.startsWith("week") ? n * 7 * 86400_000 :
      u.startsWith("mes") || u.startsWith("month") ? n * 30 * 86400_000 :
      u.startsWith("ano") || u.startsWith("año") || u.startsWith("year") ? n * 365 * 86400_000 : 0;
    if (ms > 0) return clampDate(new Date(now.getTime() - ms));
  }

  // 2) ISO YYYY-MM-DD
  const iso = t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return clampDate(new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3])));

  // 3) "12 de mayo de 2026" / "12 mayo 2026" / "12 may 2026"
  const dmy = t.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]{3,12})\s+(?:de\s+)?(20\d{2})\b/);
  if (dmy) {
    const m = MONTH_MAP_ES[dmy[2]] ?? MONTH_MAP_EN[dmy[2]];
    if (m !== undefined) return clampDate(new Date(Date.UTC(+dmy[3], m, +dmy[1])));
  }

  // 4) "May 12, 2026" / "may 12 2026"
  const mdy = t.match(/\b([a-z]{3,12})\s+(\d{1,2}),?\s+(20\d{2})\b/);
  if (mdy) {
    const m = MONTH_MAP_EN[mdy[1]] ?? MONTH_MAP_ES[mdy[1]];
    if (m !== undefined) return clampDate(new Date(Date.UTC(+mdy[3], m, +mdy[2])));
  }

  // 5) "ayer" / "yesterday" / "hoy" / "today"
  if (/\bayer\b|\byesterday\b/.test(t)) return clampDate(new Date(now.getTime() - 86400_000));
  if (/\bhoy\b|\btoday\b/.test(t)) return clampDate(now);

  return null;
}

/**
 * Enrich a Firecrawl search result with publishedAt + dateConfidence.
 * Priority: metadata.publishedDate (high) > snippet parse (medium) > null (unknown).
 */
export function enrichWithDate(result: {
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): { publishedAt: string | null; dateConfidence: DateConfidence } {
  const meta = (result.metadata || {}) as Record<string, unknown>;
  const metaDate = (meta.publishedDate || meta.published_time || meta["article:published_time"] ||
                    meta.datePublished || meta.pubdate) as string | undefined;
  if (metaDate) {
    const d = new Date(metaDate);
    if (!isNaN(d.getTime())) return { publishedAt: d.toISOString(), dateConfidence: "high" };
  }
  const snippet = `${result.title || ""}  ${result.description || ""}`;
  const parsed = parseSnippetDate(snippet);
  if (parsed) return { publishedAt: parsed, dateConfidence: "medium" };
  return { publishedAt: null, dateConfidence: "unknown" };
}
