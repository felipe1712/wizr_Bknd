import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Apify Actor IDs for different platforms
const ACTOR_IDS: Record<string, string> = {
  // Twitter/X: powerai/twitter-search-scraper (rented, $4.99/1000 results)
  twitter: "powerai/twitter-search-scraper",
  // Facebook: using search scraper for third-party mentions (not just pages)
  facebook: "easyapi/facebook-posts-search-scraper",
  // Facebook page-specific scraper (fallback for username searches)
  facebook_page: "apify/facebook-posts-scraper",
  // TikTok: clockworks scraper (free tier available)
  tiktok: "clockworks/tiktok-scraper",
  // Instagram: apify's scraper
  instagram: "apify/instagram-scraper",
  // YouTube: using free youtube search scraper
  youtube: "scrapesmith/free-youtube-search-scraper",
  // Reddit: lite variant for less restrictions
  reddit: "trudax/reddit-scraper-lite",
  // LinkedIn: harvestapi/linkedin-post-search (no cookies required, $2/1000 results)
  linkedin: "harvestapi/linkedin-post-search",
};

// Platforms that require paid subscriptions - return friendly error instead of 403
const DISABLED_PLATFORMS: Record<string, string> = {
  // All platforms now enabled!
};

interface ScrapeRequest {
  platform: "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "reddit";
  query?: string;
  username?: string;
  hashtag?: string;
  companyUrl?: string;
  channelUrl?: string;
  subreddit?: string;
  maxResults?: number;
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
      maxResults = 50 
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
        // Facebook: Use search scraper for general queries (third-party mentions)
        // Use page scraper only for specific username/page searches
        if (query) {
          // Use Facebook Posts Search Scraper for keyword queries
          actorId = ACTOR_IDS.facebook; // easyapi/facebook-posts-search-scraper
          input = {
            searchQuery: query,
            maxResults: maxResults,
          };
        } else if (username) {
          // Fallback to page scraper for specific pages
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
        // TikTok: send the keyword to filter results on the backend
        input = {
          hashtags: hashtag ? [hashtag] : [],
          profiles: username ? [username] : [],
          searchQueries: query ? [query] : [],
          resultsPerPage: maxResults,
          // Pass keyword for post-processing filter (handled in apify-status)
          _filterKeyword: query || hashtag || username || "",
        };
        break;
        
      case "instagram":
        // Instagram: Reduce parameters to speed up - only fetch posts, no stories/reels extras
        input = {
          directUrls: username ? [`https://www.instagram.com/${username}/`] : [],
          hashtags: hashtag ? [hashtag] : [],
          resultsLimit: Math.min(maxResults, 20), // Limit to prevent long runs
          addParentData: false,
          searchType: "hashtag", // Faster mode
        };
        break;
        
      case "youtube":
        // Free YouTube Search Scraper (scrapesmith/free-youtube-search-scraper)
        if (channelUrl) {
          // For channel URLs, use search URLs format
          input = {
            searchUrls: [channelUrl],
            maxResults: maxResults,
          };
        } else if (query) {
          input = {
            searchQueries: [query],
            maxResults: maxResults,
          };
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
        
      case "linkedin":
        // harvestapi/linkedin-post-search - no cookies required
        input = {
          search: query || "",
          maxPosts: maxResults,
        };
        break;
    }

    console.log(`Starting Apify actor ${actorId} with input:`, JSON.stringify(input));

    // Start the actor run
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_API_TOKEN}`,
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
