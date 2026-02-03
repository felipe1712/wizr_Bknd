import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Apify Actor IDs for different platforms
const ACTOR_IDS: Record<string, string> = {
  // Twitter/X: powerai/twitter-search-scraper (rented, $4.99/1000 results)
  twitter: "powerai/twitter-search-scraper",
  // Facebook: powerai/facebook-post-search-scraper (5.0 rating, $9.99/1000 results)
  facebook: "powerai/facebook-post-search-scraper",
  // Facebook fallback: scraper_one/facebook-posts-search (4.4 rating, more reliable)
  facebook_fallback: "scraper_one/facebook-posts-search",
  // Facebook page-specific scraper (fallback for username searches)
  facebook_page: "apify/facebook-posts-scraper",
  // TikTok: powerai/tiktok-videos-search-scraper
  tiktok: "powerai/tiktok-videos-search-scraper",
  // Instagram: apify/instagram-hashtag-scraper ($2.30/1000 results, maintained by Apify)
  instagram: "apify/instagram-hashtag-scraper",
  // Instagram profile scraper for username-based searches (scrapes posts from specific profiles)
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

// Facebook-specific fallback actors (tried in order)
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
  youtubeSortType?: "relevance" | "date" | "views" | "rating";
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
        // CASE 3: Hashtag-based search with optional caption filter
        else if (hashtag || query) {
          // Use Instagram Hashtag Scraper
          actorId = ACTOR_IDS.instagram; // apify/instagram-hashtag-scraper
          
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
          
          console.log(`Instagram hashtag search: ${JSON.stringify(uniqueHashtags)}${captionFilter ? ` with caption filter: ${captionFilter}` : ""}`);
          
          if (uniqueHashtags.length === 0) {
            throw new Error("Instagram requires at least one valid hashtag.");
          }
          
          input = {
            hashtags: uniqueHashtags,
            resultsLimit: Math.min(maxResults, 100), // Get more results for post-filtering
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
        // Reddit scraper configuration - includes comments, sorted by NEW for chronological order
        if (subreddit) {
          input = {
            startUrls: [{ url: `https://www.reddit.com/r/${subreddit}/new/` }],
            maxItems: maxResults,
            maxPostCount: maxResults,
            maxComments: 10, // Include top 10 comments per post
            sort: "new", // Changed to new for chronological order
          };
        } else if (query) {
          input = {
            searches: [query],
            maxItems: maxResults,
            maxPostCount: maxResults,
            maxComments: 10, // Include top 10 comments per post
            sort: "new", // Changed to new for chronological order
          };
        }
        break;
        
      case "reddit_comments":
        // Use the same actor as regular reddit (trudax/reddit-scraper-lite) but with increased 
        // maxComments. The filtering happens in apify-status where we check if keywords appear
        // in the comments of each post. This avoids needing a paid actor rental.
        actorId = ACTOR_IDS.reddit; // Use trudax/reddit-scraper-lite
        if (!query) {
          throw new Error("Reddit comments search requires a search query.");
        }
        input = {
          searches: [query],
          maxItems: Math.min(maxResults * 2, 100), // More posts to search through
          maxPostCount: Math.min(maxResults * 2, 100),
          maxComments: 25, // Increased: fetch more comments per post to search within
          sort: "new",
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

    // Special handling for Facebook with automatic fallback
    if (actorId === "__FACEBOOK_WITH_FALLBACK__") {
      return await handleFacebookWithFallback(APIFY_API_TOKEN, input, query || "");
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

// Facebook fallback handler with automatic retry on different actors
async function handleFacebookWithFallback(
  apiToken: string,
  primaryInput: Record<string, unknown>,
  query: string
): Promise<Response> {
  const errors: Array<{ actor: string; status: number; error: string }> = [];
  
  for (const actor of FACEBOOK_ACTORS) {
    console.log(`Trying Facebook actor: ${actor.name} (${actor.id})`);
    
    // Build input based on actor type
    let input: Record<string, unknown>;
    
    if (actor.name === "powerai") {
      // powerai uses: query, maxResults, recent_posts, start_date, end_date
      input = primaryInput;
    } else if (actor.name === "scraper_one") {
      // scraper_one/facebook-posts-search: schema differs across versions; some require `query`.
      // Send both to be safe.
      input = {
        query,
        searchQueries: [query],
        maxPosts: primaryInput.maxResults || 50,
        maxResults: primaryInput.maxResults || 50,
      };
    } else {
      input = primaryInput;
    }
    
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

        // IMPORTANT: Facebook actors sometimes "start OK" but fail quickly inside the run
        // with a transient 5xx (e.g., "API request failed with status 503").
        // In that case we want to auto-fallback to the next actor *without*
        // changing the frontend flow.
        const failFast = await detectFacebookFastFail(apiToken, runId);
        if (failFast.isFastFail) {
          console.warn(
            `Facebook actor ${actor.name} fast-failed (runId=${runId}). Reason: ${failFast.reason}`
          );

          errors.push({
            actor: actor.id,
            status: failFast.statusCode ?? 503,
            error: (failFast.reason || "Fast fail").substring(0, 200),
          });

          // Try next actor
          continue;
        }

        console.log(`Facebook actor ${actor.name} started successfully. Run ID: ${runId}`);

        return new Response(
          JSON.stringify({
            success: true,
            runId,
            datasetId,
            status: runData.data.status,
            actorUsed: actor.id,
            fallbackUsed: actor.name !== "powerai",
            previousErrors: errors.length > 0 ? errors : undefined,
            message:
              errors.length > 0
                ? `Actor primario falló. Usando fallback: ${actor.name}`
                : "Scraping job started. Use the status endpoint to check progress.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Actor failed - record error and try next
      const errorText = await runResponse.text();
      console.error(`Facebook actor ${actor.name} failed:`, runResponse.status, errorText);
      
      errors.push({
        actor: actor.id,
        status: runResponse.status,
        error: errorText.substring(0, 200), // Truncate for response size
      });
      
      // Only retry on 5xx errors (service unavailable, etc.)
      // For 4xx errors (invalid input, not rented), don't retry
      if (runResponse.status < 500) {
        console.log(`Actor ${actor.name} returned ${runResponse.status} - not retrying`);
        break;
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      console.error(`Facebook actor ${actor.name} network error:`, errorMsg);
      errors.push({
        actor: actor.id,
        status: 0,
        error: errorMsg,
      });
    }
  }
  
  // All actors failed
  const lastError = errors[errors.length - 1];
  return new Response(
    JSON.stringify({
      success: false,
      error: `Todos los actores de Facebook fallaron. Último error: ${lastError?.error || "Unknown"}`,
      errorCode: lastError?.status || 503,
      errorDetails: errors,
      platform: "facebook",
      retriable: true,
    }),
    { 
      status: lastError?.status || 503, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

type FacebookFastFailResult = {
  isFastFail: boolean;
  statusCode?: number;
  reason?: string;
};

// Detects the common case where the run starts but immediately FAILS due to transient upstream 5xx.
// We only use this to decide whether to auto-fallback to the next actor.
async function detectFacebookFastFail(apiToken: string, runId: string): Promise<FacebookFastFailResult> {
  // A few short polls (<= ~9s) to avoid delaying the UI too much.
  const delays = [1500, 2500, 3500];

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
        // Try to fetch last logs tail to identify 5xx cause.
        const logTail = await fetchApifyLogTail(apiToken, runId);
        const combined = `${logTail || ""}`.toLowerCase();

        // Match known transient upstream errors.
        const is503 = combined.includes("status 503") || combined.includes("\n503") || combined.includes("http 503");
        const is5xx = is503 || combined.includes("status 502") || combined.includes("status 500") || combined.includes("status 504");

        if (is5xx) {
          return {
            isFastFail: true,
            statusCode: is503 ? 503 : 502,
            reason: `Run ${status} (exitCode=${exitCode ?? "n/a"}). ${logTail ? logTail.split("\n").slice(-6).join("\n") : ""}`,
          };
        }

        // Non-transient failure: don't treat as fast-fail.
        return { isFastFail: false };
      }
    } catch {
      // Ignore and keep polling.
    }
  }

  return { isFastFail: false };
}

async function fetchApifyLogTail(apiToken: string, runId: string): Promise<string | null> {
  try {
    // Build log is usually enough for a diagnostic like "API request failed with status 503".
    // We keep it small to reduce payload.
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/log?token=${apiToken}&stream=false`
    );
    if (!res.ok) return null;
    const text = await res.text();
    // Tail last ~40 lines
    const lines = text.split("\n");
    return lines.slice(Math.max(0, lines.length - 40)).join("\n");
  } catch {
    return null;
  }
}
