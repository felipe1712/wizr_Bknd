import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Apify Actor IDs for different platforms
// Using well-maintained actors from Apify Store
const ACTOR_IDS: Record<string, string> = {
  twitter: "apidojo/tweet-scraper",
  facebook: "apify/facebook-posts-scraper",
  tiktok: "clockworks/tiktok-scraper",
  instagram: "apify/instagram-scraper",
  linkedin: "anchor/linkedin-scraper",
  youtube: "streamers/youtube-scraper",
  reddit: "trudax/reddit-scraper",
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
        input = {
          searchTerms: query ? [query] : [],
          handles: username ? [username] : [],
          maxTweets: maxResults,
          addUserInfo: true,
          scrapeTweetReplies: false,
        };
        break;
        
      case "facebook":
        input = {
          startUrls: username ? [`https://www.facebook.com/${username}`] : [],
          searchTerms: query ? [query] : [],
          maxPosts: maxResults,
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
        input = {
          urls: companyUrl ? [companyUrl] : [],
          searchTerms: query ? [query] : [],
          maxResults: maxResults,
        };
        break;
        
      case "youtube":
        // YouTube scraper configuration
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
      throw new Error(`Failed to start Apify actor: ${runResponse.status}`);
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
