import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// META RESILIENCE SYSTEM - Multi-actor rotation with cooldowns
// =============================================================================

// Actor configuration with priority, cooldown, and success tracking
interface ActorConfig {
  id: string;
  name: string;
  priority: number; // Lower = higher priority
  cooldownMinutes: number; // How long to wait after failure before retry
  lastFailure?: number; // Timestamp of last failure
  consecutiveFailures?: number;
}

// Facebook actors pool (ordered by priority)
const FACEBOOK_ACTORS_POOL: ActorConfig[] = [
  { id: "powerai/facebook-post-search-scraper", name: "powerai", priority: 1, cooldownMinutes: 30 },
  { id: "scraper_one/facebook-posts-search", name: "scraper_one", priority: 2, cooldownMinutes: 15 },
  { id: "microworlds/facebook-post-search-scraper", name: "microworlds", priority: 3, cooldownMinutes: 20 },
];

// Instagram actors pool (ordered by priority)
const INSTAGRAM_ACTORS_POOL: ActorConfig[] = [
  { id: "apify/instagram-scraper", name: "apify_scraper", priority: 1, cooldownMinutes: 30 },
  { id: "apify/instagram-hashtag-scraper", name: "apify_hashtag", priority: 2, cooldownMinutes: 20 },
  { id: "microworlds/instagram-scraper", name: "microworlds", priority: 3, cooldownMinutes: 15 },
];

// In-memory cooldown tracker (resets on cold start, but sufficient for short-term rotation)
// Format: { "actor_id": { lastFailure: timestamp, consecutiveFailures: number } }
const actorCooldowns: Map<string, { lastFailure: number; consecutiveFailures: number }> = new Map();

// Check if an actor is in cooldown
function isActorInCooldown(actor: ActorConfig): boolean {
  const cooldownData = actorCooldowns.get(actor.id);
  if (!cooldownData) return false;
  
  const cooldownMs = actor.cooldownMinutes * 60 * 1000;
  const timeSinceFailure = Date.now() - cooldownData.lastFailure;
  
  // Exponential backoff: double cooldown for each consecutive failure (max 4x)
  const multiplier = Math.min(Math.pow(2, cooldownData.consecutiveFailures - 1), 4);
  const effectiveCooldown = cooldownMs * multiplier;
  
  return timeSinceFailure < effectiveCooldown;
}

// Mark actor as failed
function markActorFailed(actorId: string): void {
  const existing = actorCooldowns.get(actorId);
  actorCooldowns.set(actorId, {
    lastFailure: Date.now(),
    consecutiveFailures: (existing?.consecutiveFailures || 0) + 1,
  });
  console.log(`Actor ${actorId} marked as failed. Consecutive failures: ${actorCooldowns.get(actorId)?.consecutiveFailures}`);
}

// Mark actor as successful (reset cooldown)
function markActorSuccess(actorId: string): void {
  actorCooldowns.delete(actorId);
  console.log(`Actor ${actorId} succeeded, cooldown reset.`);
}

// Get next available actor from pool (respecting cooldowns and priority)
function getNextAvailableActor(pool: ActorConfig[]): ActorConfig | null {
  // Sort by priority and filter out those in cooldown
  const available = pool
    .filter(actor => !isActorInCooldown(actor))
    .sort((a, b) => a.priority - b.priority);
  
  if (available.length > 0) {
    console.log(`Available actors: ${available.map(a => a.name).join(", ")}`);
    return available[0];
  }
  
  // All actors in cooldown - return the one with shortest remaining cooldown
  const byRemainingCooldown = pool
    .map(actor => {
      const data = actorCooldowns.get(actor.id);
      if (!data) return { actor, remaining: 0 };
      const cooldownMs = actor.cooldownMinutes * 60 * 1000;
      const multiplier = Math.min(Math.pow(2, data.consecutiveFailures - 1), 4);
      const remaining = (data.lastFailure + cooldownMs * multiplier) - Date.now();
      return { actor, remaining: Math.max(0, remaining) };
    })
    .sort((a, b) => a.remaining - b.remaining);
  
  console.warn(`All actors in cooldown. Forcing use of ${byRemainingCooldown[0].actor.name} (${Math.round(byRemainingCooldown[0].remaining / 1000)}s remaining)`);
  return byRemainingCooldown[0].actor;
}

// Apify Actor IDs for different platforms
const ACTOR_IDS: Record<string, string> = {
  // Twitter/X: powerai/twitter-search-scraper (rented, $4.99/1000 results)
  twitter: "powerai/twitter-search-scraper",
  // Facebook: handled by META_RESILIENCE system
  facebook: "__META_RESILIENCE_FACEBOOK__",
  // Facebook fallback markers (for backwards compatibility)
  facebook_fallback: "scraper_one/facebook-posts-search",
  // Facebook page-specific scraper (fallback for username searches)
  facebook_page: "apify/facebook-posts-scraper",
  // TikTok: powerai/tiktok-videos-search-scraper
  tiktok: "powerai/tiktok-videos-search-scraper",
  // Instagram: handled by META_RESILIENCE system
  instagram: "__META_RESILIENCE_INSTAGRAM__",
  // Instagram profile scraper for username-based searches (direct, no rotation)
  instagram_profile: "apify/instagram-profile-scraper",
  // YouTube: scraper_one/youtube-search-scraper (better results quality, sorted by upload_date)
  youtube: "scraper_one/youtube-search-scraper",
  // YouTube Shorts: same actor, handles search queries
  youtube_shorts: "scraper_one/youtube-search-scraper",
  // Reddit: lite variant for less restrictions (searches posts)
  reddit: "trudax/reddit-scraper-lite",
  // Reddit Comments: search directly within comments (not just post titles)
  reddit_comments: "easyapi/reddit-comments-search-scraper",
  // LinkedIn: harvestapi/linkedin-post-search (no cookies required, $2/1000 results)
  linkedin: "harvestapi/linkedin-post-search",
};

// Legacy Facebook actors array (kept for backwards compatibility)
const FACEBOOK_ACTORS = [
  { id: "powerai/facebook-post-search-scraper", name: "powerai" },
  { id: "scraper_one/facebook-posts-search", name: "scraper_one" },
] as const;

// Platforms that require paid subscriptions - return friendly error instead of 403
const DISABLED_PLATFORMS: Record<string, string> = {
  // All platforms now enabled!
};

interface ScrapeRequest {
  platform: "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "youtube_shorts" | "reddit" | "reddit_comments";
  query?: string;
  username?: string;
  hashtag?: string;
  companyUrl?: string;
  channelUrl?: string;
  subreddit?: string;
  taggedUsername?: string; // Instagram: fetch posts where this user is tagged
  captionFilter?: string; // Instagram: filter results to only include posts mentioning this term
  maxResults?: number;
  // YouTube-specific filters
  youtubeUploadDate?: "lastHour" | "today" | "thisWeek" | "thisMonth" | "thisYear";
  youtubeSortType?: "relevance" | "popularity";
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

    const { 
      platform, 
      query, 
      username, 
      hashtag, 
      companyUrl, 
      channelUrl,
      subreddit,
      taggedUsername,
      captionFilter,
      maxResults = 50,
      youtubeUploadDate,
      youtubeSortType,
    }: ScrapeRequest = await req.json();

    if (!platform) {
      throw new Error("Platform is required");
    }

    // Check if platform is disabled
    if (DISABLED_PLATFORMS[platform]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: DISABLED_PLATFORMS[platform],
          disabled: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let actorId = ACTOR_IDS[platform];
    if (!actorId) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    // Build input based on platform
    let input: Record<string, unknown> = {};

    switch (platform) {
      case "twitter":
        // powerai/twitter-search-scraper - uses 'query' parameter (NOT searchTerms)
        // Combine all search terms into a single OR query for Twitter search
        const searchTerms = query ? query.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
        // Format: "term1 OR term2 OR term3" for Twitter's search syntax
        const twitterQuery = searchTerms.join(" OR ");
        input = {
          query: twitterQuery || "Actinver", // Required parameter
          searchType: "Latest", // Top, Latest, Media, People, Lists
          maxTweets: maxResults,
        };
        break;
        
      case "facebook":
        // Facebook: Use powerai/facebook-post-search-scraper for keyword queries
        // Use page scraper only for specific username/page searches
        // Fallback logic is handled after the switch statement
        if (query) {
          // Calculate date range: last 30 days to ensure recent posts
          const today = new Date();
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 30);
          
          const formatDate = (d: Date) => d.toISOString().split("T")[0]; // yyyy-mm-dd
          
          // Store Facebook-specific inputs for fallback logic
          // Primary actor (powerai) input format
          input = {
            query: query,
            maxResults: maxResults,
            recent_posts: true,
            start_date: formatDate(thirtyDaysAgo),
            end_date: formatDate(today),
          };
          
          // Mark as Facebook query for fallback handling
          actorId = "__FACEBOOK_WITH_FALLBACK__";
        } else if (username) {
          // Fallback to page scraper for specific pages (no fallback needed)
          actorId = ACTOR_IDS.facebook_page;
          input = {
            startUrls: [{ url: `https://www.facebook.com/${username}` }],
            resultsLimit: maxResults,
          };
        } else {
          throw new Error("Facebook requires a search query or page username.");
        }
        break;
        
      case "tiktok":
        // TikTok: powerai/tiktok-videos-search-scraper
        // Input schema (OpenAPI): { keywords: string (required), maxResults?: number, region?: string, publish_time?: number, sort_type?: number }
        const tiktokTerms: string[] = [];
        if (query) {
          query.split(",").forEach((term: string) => {
            const cleaned = term.trim();
            if (cleaned) tiktokTerms.push(cleaned);
          });
        }
        if (hashtag) {
          const cleanHashtag = hashtag.replace(/^#/, "");
          if (cleanHashtag) tiktokTerms.push(cleanHashtag);
        }
        if (username) {
          const cleanUsername = username.replace(/^@/, "");
          if (cleanUsername) tiktokTerms.push(cleanUsername);
        }
        
        // powerai requires a single keywords string.
        const keywords = (tiktokTerms.join(" ") || "Actinver").trim();

        input = {
          keywords,
          // Increase results for better coverage - TikTok filtering is done client-side
          maxResults: Math.min(Math.max(maxResults, 200), 1000),
          // 30 = last month (more relevant for monitoring)
          publish_time: 30,
          // 3 = publish time (newest first)
          sort_type: 3,
          region: "", // actor default (US) when empty
        };
        break;
        
      case "instagram":
        // Helper to clean IG terms: remove ALL special chars, keep only alphanumeric + underscore
        const cleanIGTerm = (term: string): string => {
          return term
            .trim()
            .toLowerCase()
            .replace(/^[@#]+/, "") // Remove leading @ or # symbols
            .replace(/[^a-z0-9_.]/g, ""); // Keep only letters, numbers, underscores, dots
        };
        
        // CASE 1: Tagged posts search - posts where the account is tagged by others
        if (taggedUsername) {
          actorId = ACTOR_IDS.instagram_profile;
          
          const cleanedTaggedUser = cleanIGTerm(taggedUsername);
          
          if (!cleanedTaggedUser) {
            throw new Error("Instagram tagged search requires a valid username.");
          }
          
          console.log(`Instagram tagged posts search for: ${cleanedTaggedUser}`);
          
          // apify/instagram-profile-scraper requires 'usernames' array, not 'directUrls'
          input = {
            usernames: [cleanedTaggedUser],
            resultsLimit: Math.min(maxResults, 100),
            resultsType: "taggedPosts", // Get posts where this account is tagged
          };
        }
        // CASE 2: Username-based search - scrape specific profiles
        else if (username) {
          // Use Instagram Profile Scraper for username searches
          actorId = ACTOR_IDS.instagram_profile;
          
          // Split usernames by comma for multiple profiles
          const cleanedUsernames = username.split(",").map(u => cleanIGTerm(u)).filter(Boolean);
          
          if (cleanedUsernames.length === 0) {
            throw new Error("Instagram requires at least one valid username.");
          }
          
          console.log(`Instagram profile search for usernames: ${JSON.stringify(cleanedUsernames)}`);
          
          // apify/instagram-profile-scraper requires 'usernames' array, not 'directUrls'
          input = {
            usernames: cleanedUsernames,
            resultsLimit: Math.min(maxResults, 50),
            resultsType: "posts", // Get posts from profiles
          };
        }
        // CASE 3: Hashtag-based search with optional caption filter - USE META RESILIENCE
        else if (hashtag || query) {
          // Use Meta Resilience system for hashtag searches
          actorId = "__META_RESILIENCE_INSTAGRAM__";
          
          const igHashtags: string[] = [];
          
          // Process hashtag field
          if (hashtag) {
            hashtag.split(",").forEach((term: string) => {
              const cleaned = cleanIGTerm(term);
              if (cleaned) igHashtags.push(cleaned);
            });
          }
          
          // Process query as hashtags
          if (query) {
            query.split(",").forEach((term: string) => {
              const cleaned = cleanIGTerm(term);
              if (cleaned) igHashtags.push(cleaned);
            });
          }
          
          // Remove duplicates
          const uniqueHashtags = [...new Set(igHashtags)];
          
          console.log(`Instagram hashtag search (META_RESILIENCE): ${JSON.stringify(uniqueHashtags)}${captionFilter ? ` with caption filter: ${captionFilter}` : ""}`);
          
          if (uniqueHashtags.length === 0) {
            throw new Error("Instagram requires at least one valid hashtag.");
          }
          
          input = {
            hashtags: uniqueHashtags,
            resultsLimit: Math.min(maxResults, 100),
            _igHashtags: uniqueHashtags, // Store for resilience handler
          };
        }
        else {
          throw new Error("Instagram requires a username, taggedUsername, or hashtag to search.");
        }
        break;
        
      case "youtube":
      case "youtube_shorts":
        // scraper_one/youtube-search-scraper
        // OpenAPI input uses:
        // - query (required)
        // - resultsCount (1..100)
        // - sortType: relevance|date|views|rating (default: relevance)
        // - uploadDate: lastHour|today|thisWeek|thisMonth|thisYear
        const youtubeResultsCount = Math.min(Math.max(maxResults, 1), 100);

        if (!query) {
          throw new Error("YouTube requiere un término de búsqueda (query).");
        }

        input = {
          query,
          resultsCount: youtubeResultsCount,
        };
        
        // Add native YouTube filters if provided
        if (youtubeUploadDate) {
          (input as Record<string, unknown>).uploadDate = youtubeUploadDate;
        }
        if (youtubeSortType) {
          (input as Record<string, unknown>).sortType = youtubeSortType;
        }
        break;
        
      case "reddit":
        // Reddit scraper configuration (trudax/reddit-scraper-lite)
        // Key params: type="post" + searchPosts=true ensures we get posts (not communities/users)
        // sort="new" for chronological order, time="all" for all time ranges
        if (subreddit) {
          input = {
            startUrls: [{ url: `https://www.reddit.com/r/${subreddit}/new/` }],
            maxItems: maxResults,
            maxPostCount: maxResults,
            maxComments: 50,
            sort: "new",
            time: "all",
          };
        } else if (query) {
          input = {
            searches: [query],
            type: "post",
            searchPosts: true,
            searchCommunities: false,
            searchUsers: false,
            maxItems: maxResults,
            maxPostCount: maxResults,
            maxComments: 50,
            sort: "new",
            time: "all",
          };
        }
        break;
        
      case "reddit_comments":
        // For comments search: use trudax/reddit-scraper-lite with sort="comments" to prioritize
        // posts with most comments (more likely to contain keyword mentions in discussion).
        // Then sort="new" as secondary pass. The filtering happens in apify-status.
        actorId = ACTOR_IDS.reddit; // Use trudax/reddit-scraper-lite
        if (!query) {
          throw new Error("Reddit comments search requires a search query.");
        }
        input = {
          searches: [query],
          type: "post",
          searchPosts: true,
          searchCommunities: false,
          searchUsers: false,
          maxItems: Math.min(maxResults * 3, 150),
          maxPostCount: Math.min(maxResults * 3, 150),
          maxComments: 75,
          sort: "comments", // Sort by most comments first — more likely to have keyword in discussions
          time: "all",
        };
        break;
        
      case "linkedin":
        // harvestapi/linkedin-post-search - no cookies required
        // Uses 'searchQueries' (array) NOT 'search' (string)
        const linkedinQueries: string[] = [];
        
        if (query) {
          // Split by comma and add each as a separate query
          query.split(",").forEach((term: string) => {
            const cleaned = term.trim();
            if (cleaned) linkedinQueries.push(cleaned);
          });
        }
        
        if (companyUrl) {
          // Extract company name from URL for search
          const companyName = companyUrl
            .replace(/.*linkedin\.com\/company\//, "")
            .replace(/\/.*/, "")
            .replace(/-/g, " ");
          if (companyName) linkedinQueries.push(companyName);
        }
        
        if (linkedinQueries.length === 0) {
          throw new Error("LinkedIn requires a search query or company URL.");
        }
        
        input = {
          searchQueries: linkedinQueries, // Array of search queries (required)
          maxPosts: maxResults,
          sortBy: "date", // Sort by newest first
        };
        break;
    }

    console.log(`Starting Apify actor ${actorId} with input:`, JSON.stringify(input));

    // Special handling for Facebook with automatic fallback (Meta Resilience)
    if (actorId === "__FACEBOOK_WITH_FALLBACK__") {
      return await handleFacebookWithFallback(APIFY_API_TOKEN, input, query || "");
    }
    
    // Special handling for Instagram hashtag search with Meta Resilience
    if (actorId === "__META_RESILIENCE_INSTAGRAM__") {
      const igHashtags = (input._igHashtags as string[]) || [];
      delete input._igHashtags; // Clean up internal field
      return await handleInstagramWithResilience(APIFY_API_TOKEN, input, igHashtags);
    }

    // Start the actor run
    // Apify API URLs typically use the `owner~actor-name` form.
    // Some actors may not resolve correctly via `owner/actor-name` in path segments.
    const actorPathId = actorId.includes("/") ? actorId.replace("/", "~") : actorId;

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorPathId)}/runs?token=${APIFY_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error("Apify run start error:", errorText);

      // Preserve upstream status (400 invalid input, 403 not rented, etc.)
      // so the frontend can display a meaningful message.
      return new Response(
        JSON.stringify({
          success: false,
          error: `Apify error ${runResponse.status}: ${errorText}`,
          errorCode: runResponse.status,
          errorDetails: errorText,
        }),
        { status: runResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    console.log(`Actor run started with ID: ${runId}, Dataset ID: ${datasetId}`);

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        datasetId,
        status: runData.data.status,
        actorUsed: actorId,
        message: "Scraping job started. Use the status endpoint to check progress.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apify-scrape:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================================================
// META RESILIENCE HANDLERS - Facebook and Instagram with smart rotation
// =============================================================================

// Generic Meta platform handler with cooldown-aware rotation
async function handleMetaWithResilience(
  apiToken: string,
  platform: "facebook" | "instagram",
  primaryInput: Record<string, unknown>,
  query: string,
  searchContext: { hashtags?: string[]; username?: string }
): Promise<Response> {
  const pool = platform === "facebook" ? FACEBOOK_ACTORS_POOL : INSTAGRAM_ACTORS_POOL;
  const errors: Array<{ actor: string; status: number; error: string; inCooldown: boolean }> = [];
  const triedActors: string[] = [];
  
  // Get actors sorted by availability (not in cooldown first, then by priority)
  const sortedActors = [...pool].sort((a, b) => {
    const aInCooldown = isActorInCooldown(a);
    const bInCooldown = isActorInCooldown(b);
    if (aInCooldown !== bInCooldown) return aInCooldown ? 1 : -1;
    return a.priority - b.priority;
  });
  
  console.log(`[META_RESILIENCE] Starting ${platform} search with ${sortedActors.length} available actors`);
  console.log(`[META_RESILIENCE] Actor order: ${sortedActors.map(a => `${a.name}${isActorInCooldown(a) ? " (cooldown)" : ""}`).join(", ")}`);
  
  for (const actor of sortedActors) {
    const inCooldown = isActorInCooldown(actor);
    if (inCooldown && triedActors.length < sortedActors.length - 1) {
      // Skip actors in cooldown if we have alternatives
      console.log(`[META_RESILIENCE] Skipping ${actor.name} - in cooldown`);
      continue;
    }
    
    triedActors.push(actor.id);
    console.log(`[META_RESILIENCE] Trying ${platform} actor: ${actor.name} (${actor.id})${inCooldown ? " [FORCED - all in cooldown]" : ""}`);
    
    // Build input based on actor type
    const input = buildActorInput(platform, actor, primaryInput, query, searchContext);
    
    const actorPathId = actor.id.replace("/", "~");
    
    try {
      const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${encodeURIComponent(actorPathId)}/runs?token=${apiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      
      if (runResponse.ok) {
        const runData = await runResponse.json();
        const runId = runData.data.id;
        const datasetId = runData.data.defaultDatasetId;

        // Check for fast-fail (run starts but fails quickly due to block)
        const failFast = await detectMetaFastFail(apiToken, runId, platform);
        if (failFast.isFastFail) {
          console.warn(`[META_RESILIENCE] ${platform} actor ${actor.name} fast-failed (runId=${runId}). Reason: ${failFast.reason}`);
          
          // Mark actor as failed with cooldown
          markActorFailed(actor.id);

          errors.push({
            actor: actor.id,
            status: failFast.statusCode ?? 503,
            error: (failFast.reason || "Fast fail").substring(0, 200),
            inCooldown: true,
          });

          // Try next actor
          continue;
        }

        // Success! Reset cooldown for this actor
        markActorSuccess(actor.id);
        
        console.log(`[META_RESILIENCE] ${platform} actor ${actor.name} started successfully. Run ID: ${runId}`);

        return new Response(
          JSON.stringify({
            success: true,
            runId,
            datasetId,
            status: runData.data.status,
            actorUsed: actor.id,
            actorName: actor.name,
            fallbackUsed: actor.priority > 1,
            previousErrors: errors.length > 0 ? errors : undefined,
            cooldownStatus: getCooldownStatus(pool),
            message:
              errors.length > 0
                ? `Actor primario falló. Usando: ${actor.name}`
                : "Scraping job started. Use the status endpoint to check progress.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Actor failed - record error, mark cooldown, and try next
      const errorText = await runResponse.text();
      console.error(`[META_RESILIENCE] ${platform} actor ${actor.name} failed:`, runResponse.status, errorText);
      
      // Only mark as failed for 5xx errors (not for 4xx which are usually config issues)
      if (runResponse.status >= 500) {
        markActorFailed(actor.id);
      }
      
      errors.push({
        actor: actor.id,
        status: runResponse.status,
        error: errorText.substring(0, 200),
        inCooldown: runResponse.status >= 500,
      });
      
      // For 4xx errors (invalid input, not rented), don't retry with same input
      if (runResponse.status >= 400 && runResponse.status < 500) {
        console.log(`[META_RESILIENCE] Actor ${actor.name} returned ${runResponse.status} - not retrying (client error)`);
        // Don't break - try other actors with potentially different input formats
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      console.error(`[META_RESILIENCE] ${platform} actor ${actor.name} network error:`, errorMsg);
      markActorFailed(actor.id);
      errors.push({
        actor: actor.id,
        status: 0,
        error: errorMsg,
        inCooldown: true,
      });
    }
  }
  
  // All actors failed
  const lastError = errors[errors.length - 1];
  return new Response(
    JSON.stringify({
      success: false,
      error: `Todos los actores de ${platform} fallaron. Último error: ${lastError?.error || "Unknown"}`,
      errorCode: lastError?.status || 503,
      errorDetails: errors,
      platform,
      cooldownStatus: getCooldownStatus(pool),
      retriable: true,
      retryAfterSeconds: getMinCooldownRemaining(pool),
    }),
    { 
      status: lastError?.status || 503, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

// Build actor-specific input based on platform and actor type
function buildActorInput(
  platform: "facebook" | "instagram",
  actor: ActorConfig,
  primaryInput: Record<string, unknown>,
  query: string,
  context: { hashtags?: string[]; username?: string }
): Record<string, unknown> {
  if (platform === "facebook") {
    switch (actor.name) {
      case "powerai":
        return primaryInput;
      case "scraper_one":
        return {
          query,
          searchQueries: [query],
          maxPosts: primaryInput.maxResults || 50,
          maxResults: primaryInput.maxResults || 50,
        };
      case "microworlds":
        return {
          searchQuery: query,
          maxPosts: primaryInput.maxResults || 50,
        };
      default:
        return primaryInput;
    }
  } else {
    // Instagram
    switch (actor.name) {
      case "apify_scraper":
        // apify/instagram-scraper - general purpose
        return {
          hashtags: context.hashtags || [],
          resultsLimit: Math.min((primaryInput.resultsLimit as number) || 50, 100),
          searchType: "hashtag",
        };
      case "apify_hashtag":
        // apify/instagram-hashtag-scraper - hashtag focused
        return {
          hashtags: context.hashtags || [],
          resultsLimit: Math.min((primaryInput.resultsLimit as number) || 50, 100),
        };
      case "microworlds":
        // microworlds/instagram-scraper
        return {
          hashtags: context.hashtags || [],
          maxPosts: Math.min((primaryInput.resultsLimit as number) || 50, 100),
        };
      default:
        return primaryInput;
    }
  }
}

// Get cooldown status for all actors in a pool
function getCooldownStatus(pool: ActorConfig[]): Record<string, { inCooldown: boolean; remainingSeconds: number; consecutiveFailures: number }> {
  const status: Record<string, { inCooldown: boolean; remainingSeconds: number; consecutiveFailures: number }> = {};
  
  for (const actor of pool) {
    const data = actorCooldowns.get(actor.id);
    if (!data) {
      status[actor.name] = { inCooldown: false, remainingSeconds: 0, consecutiveFailures: 0 };
    } else {
      const cooldownMs = actor.cooldownMinutes * 60 * 1000;
      const multiplier = Math.min(Math.pow(2, data.consecutiveFailures - 1), 4);
      const remaining = Math.max(0, (data.lastFailure + cooldownMs * multiplier) - Date.now());
      status[actor.name] = {
        inCooldown: remaining > 0,
        remainingSeconds: Math.round(remaining / 1000),
        consecutiveFailures: data.consecutiveFailures,
      };
    }
  }
  
  return status;
}

// Get minimum cooldown remaining across all actors
function getMinCooldownRemaining(pool: ActorConfig[]): number {
  let minRemaining = Infinity;
  
  for (const actor of pool) {
    const data = actorCooldowns.get(actor.id);
    if (!data) return 0; // At least one actor available immediately
    
    const cooldownMs = actor.cooldownMinutes * 60 * 1000;
    const multiplier = Math.min(Math.pow(2, data.consecutiveFailures - 1), 4);
    const remaining = Math.max(0, (data.lastFailure + cooldownMs * multiplier) - Date.now());
    minRemaining = Math.min(minRemaining, remaining);
  }
  
  return Math.round(minRemaining / 1000);
}

// Legacy handler - redirects to new resilience system
async function handleFacebookWithFallback(
  apiToken: string,
  primaryInput: Record<string, unknown>,
  query: string
): Promise<Response> {
  return handleMetaWithResilience(apiToken, "facebook", primaryInput, query, {});
}

// Instagram resilience handler
async function handleInstagramWithResilience(
  apiToken: string,
  primaryInput: Record<string, unknown>,
  hashtags: string[]
): Promise<Response> {
  return handleMetaWithResilience(apiToken, "instagram", primaryInput, hashtags.join(" "), { hashtags });
}

type MetaFastFailResult = {
  isFastFail: boolean;
  statusCode?: number;
  reason?: string;
};

// Detects fast-fail for both Facebook and Instagram
async function detectMetaFastFail(apiToken: string, runId: string, platform: string): Promise<MetaFastFailResult> {
  const delays = [800, 1500, 2000, 2500, 3000];
  const startedAt = Date.now();

  for (const d of delays) {
    await sleep(d);

    try {
      const res = await fetch(
        `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${apiToken}`
      );
      if (!res.ok) continue;
      const json = await res.json();
      const status = String(json?.data?.status || "");
      const exitCode = json?.data?.exitCode;

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        const logTail = await fetchApifyLogTail(apiToken, runId, { retries: 3, retryDelayMs: 600 });
        const combined = `${logTail || ""}`.toLowerCase();

        // Match known transient upstream errors
        const is503 =
          combined.includes("status 503") ||
          combined.includes("api request failed with status 503") ||
          combined.includes("\n503") ||
          combined.includes("http 503");
        const is5xx =
          is503 ||
          combined.includes("status 502") ||
          combined.includes("status 500") ||
          combined.includes("status 504") ||
          combined.includes("api request failed with status 5");
        
        // Platform-specific error patterns
        const isMetaBlock = 
          combined.includes("rate limit") ||
          combined.includes("too many requests") ||
          combined.includes("blocked") ||
          combined.includes("checkpoint") ||
          combined.includes("login required");

        if (is5xx || isMetaBlock) {
          return {
            isFastFail: true,
            statusCode: is503 ? 503 : 502,
            reason: `Run ${status} (exitCode=${exitCode ?? "n/a"}, platform=${platform}). ${logTail ? logTail.split("\n").slice(-6).join("\n") : ""}`,
          };
        }

        const elapsedMs = Date.now() - startedAt;
        if (!logTail && elapsedMs <= 12_000) {
          return {
            isFastFail: true,
            statusCode: 503,
            reason: `Run ${status} quickly (exitCode=${exitCode ?? "n/a"}) but logs not yet available; assuming transient ${platform} block.`,
          };
        }

        return { isFastFail: false };
      }
    } catch {
      // Ignore and keep polling
    }
  }

  return { isFastFail: false };
}

// Legacy alias for backwards compatibility
async function detectFacebookFastFail(apiToken: string, runId: string): Promise<MetaFastFailResult> {
  return detectMetaFastFail(apiToken, runId, "facebook");
}

async function fetchApifyLogTail(
  apiToken: string,
  runId: string,
  opts?: { retries?: number; retryDelayMs?: number }
): Promise<string | null> {
  const retries = opts?.retries ?? 0;
  const retryDelayMs = opts?.retryDelayMs ?? 500;

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(
        `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/log?token=${apiToken}&stream=false`
      );
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          const lines = text.split("\n");
          return lines.slice(Math.max(0, lines.length - 40)).join("\n");
        }
      }

      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }

    return null;
  } catch {
    return null;
  }
}
