import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Apify Actor IDs for different platforms
// NOTE: Some actors are paid (require “rental”) and will return 403 after trial.
// We prefer actors that are likely to work without rental.
const ACTOR_IDS: Record<string, string> = {
  twitter: "apidojo/tweet-scraper",
  facebook: "apify/facebook-posts-scraper",
  tiktok: "clockworks/tiktok-scraper",
  instagram: "apify/instagram-scraper",
  // LinkedIn: best-effort keyword search via LinkedIn content search URL.
  linkedin: "curious_coder/linkedin-post-search-scraper",
  // YouTube: revert to previously working actor.
  youtube: "streamers/youtube-scraper",
  // Reddit: lite variant reduces risk of rental restrictions.
  reddit: "trudax/reddit-scraper-lite",
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

    const actorId = ACTOR_IDS[platform];
    if (!actorId) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Build input based on platform
    let input: Record<string, unknown> = {};

    switch (platform) {
      case "twitter":
        // Tweet Scraper often validates that startUrls is non-empty.
        // Provide derived URLs to avoid 400: "input.startUrls must NOT have fewer than 1 items".
        input = {
          startUrls: [
            ...(query
              ? [`https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`]
              : []),
            ...(username ? [`https://twitter.com/${encodeURIComponent(username)}`] : []),
          ],
          searchTerms: query ? [query] : [],
          twitterHandles: username ? [username] : [],
          maxItems: maxResults,
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
        input = {
          hashtags: hashtag ? [hashtag] : [],
          profiles: username ? [username] : [],
          searchQueries: query ? [query] : [],
          resultsPerPage: maxResults,
        };
        break;
        
      case "instagram":
        input = {
          directUrls: username ? [`https://www.instagram.com/${username}/`] : [],
          hashtags: hashtag ? [hashtag] : [],
          resultsLimit: maxResults,
        };
        break;
        
      case "linkedin":
        // LinkedIn post search scraper: keyword search is driven by a LinkedIn search URL.
        input = {
          urls: [
            ...(companyUrl ? [companyUrl] : []),
            ...(query
              ? [
                  `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
                    query
                  )}&origin=FACETED_SEARCH`,
                ]
              : []),
          ],
        };
        break;
        
      case "youtube":
        // YouTube scraper configuration (streamers/youtube-scraper)
        if (channelUrl) {
          input = {
            startUrls: [{ url: channelUrl }],
            maxResults: maxResults,
            maxResultsShorts: 0,
            maxResultStreams: 0,
          };
        } else if (query) {
          input = {
            searchKeywords: [query],
            maxResults: maxResults,
            maxResultsShorts: 0,
            maxResultStreams: 0,
          };
        }
        break;
        
      case "reddit":
        // Reddit scraper configuration
        if (subreddit) {
          input = {
            startUrls: [`https://www.reddit.com/r/${subreddit}/`],
            maxItems: maxResults,
            maxPostCount: maxResults,
            maxComments: 0,
            sort: "hot",
          };
        } else if (query) {
          input = {
            searches: [query],
            maxItems: maxResults,
            maxPostCount: maxResults,
            maxComments: 0,
            sort: "relevance",
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
