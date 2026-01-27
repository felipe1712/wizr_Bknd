import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Apify Actor IDs for different platforms
// NOTE: Some actors are paid (require "rental") and will return 403 after trial.
// We use free/community actors that don't require paid subscriptions.
const ACTOR_IDS: Record<string, string> = {
  // Twitter: using free tweet scraper - works without subscription
  twitter: "coder_luffy/free-tweet-scraper",
  // Facebook: still using apify's scraper (only option for pages)
  facebook: "apify/facebook-posts-scraper",
  // TikTok: clockworks scraper (free tier available)
  tiktok: "clockworks/tiktok-scraper",
  // Instagram: apify's scraper
  instagram: "apify/instagram-scraper",
  // YouTube: using free youtube search scraper
  youtube: "scrapesmith/free-youtube-search-scraper",
  // Reddit: lite variant for less restrictions
  reddit: "trudax/reddit-scraper-lite",
};

// Platforms that require paid subscriptions - return friendly error instead of 403
const DISABLED_PLATFORMS: Record<string, string> = {
  linkedin: "LinkedIn requiere una suscripción de pago en Apify. Esta plataforma está temporalmente deshabilitada.",
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

    const actorId = ACTOR_IDS[platform];
    if (!actorId) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Build input based on platform
    let input: Record<string, unknown> = {};

    switch (platform) {
      case "twitter":
        // Free Tweet Scraper - uses searchTerms and handles
        input = {
          searchTerms: query ? query.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
          handles: username ? [username.replace("@", "")] : [],
          maxTweets: maxResults,
          // Get latest tweets first
          sortBy: "Latest",
        };
        break;
        
      case "facebook":
        // Facebook scraper REQUIRES startUrls - cannot search without page URLs
        if (!username) {
          throw new Error("Facebook requires a page username or URL. Search by keyword alone is not supported.");
        }
        input = {
          startUrls: [{ url: `https://www.facebook.com/${username}` }],
          resultsLimit: maxResults,
        };
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
