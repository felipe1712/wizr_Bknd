import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Bright Data Dataset IDs for social media scrapers
// HYBRID STRATEGY: Only TikTok and YouTube have keyword search available
// Other platforms (Twitter, Instagram, Facebook, LinkedIn, Reddit) use Apify
const BRIGHTDATA_DATASETS: Record<string, string> = {
  // TikTok Posts - Discover by keyword (ACTIVE - keyword search available)
  tiktok_keyword: "gd_lu702nij2f790tmv9h",
  // YouTube Videos posts - Discover by keyword (ACTIVE - keyword search available)
  youtube_keyword: "gd_lk56epmy2i5g7lzu0k",
};

// Platform to dataset mapping - ONLY TikTok and YouTube keyword search supported
// Returns null for unsupported platforms (use Apify instead)
function getDatasetId(platform: string, searchType: string): string | null {
  switch (platform) {
    case "tiktok":
      // Only keyword search is supported via Bright Data
      if (searchType === "query" || searchType === "hashtag") {
        return BRIGHTDATA_DATASETS.tiktok_keyword;
      }
      return null; // Profile scraping not configured

    case "youtube":
    case "youtube_shorts":
      // Only keyword search is supported via Bright Data
      if (searchType === "query") {
        return BRIGHTDATA_DATASETS.youtube_keyword;
      }
      return null; // Channel scraping not configured

    // All other platforms should use Apify
    default:
      return null;
  }
}

interface ScrapeRequest {
  platform: "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "youtube_shorts" | "reddit" | "reddit_comments";
  query?: string;
  username?: string;
  hashtag?: string;
  companyUrl?: string;
  channelUrl?: string;
  subreddit?: string;
  taggedUsername?: string;
  captionFilter?: string;
  maxResults?: number;
  searchType?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BRIGHTDATA_API_KEY = Deno.env.get("BRIGHTDATA_API_KEY");
    if (!BRIGHTDATA_API_KEY) {
      throw new Error("BRIGHTDATA_API_KEY is not configured");
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
      searchType = "query",
    }: ScrapeRequest = await req.json();

    if (!platform) {
      throw new Error("Platform is required");
    }

    const datasetId = getDatasetId(platform, searchType);
    if (!datasetId) {
      throw new Error(`Unsupported platform for Bright Data: ${platform}`);
    }

    // Build input payload - ONLY TikTok and YouTube keyword search
    let inputPayload: Record<string, unknown>[] = [];

    switch (platform) {
      case "tiktok":
        // TikTok uses 'search_keyword' parameter (from Bright Data dashboard)
        if (hashtag) {
          inputPayload = [{ search_keyword: hashtag.replace(/^#/, ""), num_of_posts: maxResults }];
        } else if (query) {
          inputPayload = [{ search_keyword: query, num_of_posts: maxResults }];
        }
        break;

      case "youtube":
      case "youtube_shorts":
        // YouTube uses 'keyword' parameter with optional date filters
        if (query) {
          inputPayload = [{ keyword: query, num_of_posts: maxResults }];
        }
        break;

      default:
        throw new Error(`Platform ${platform} not supported by Bright Data. Use Apify instead.`);
    }

    if (inputPayload.length === 0) {
      throw new Error("No valid search parameters provided");
    }

    console.log(`Bright Data scrape: platform=${platform}, dataset=${datasetId}, inputs=${JSON.stringify(inputPayload)}`);

    // Trigger async scrape via Bright Data API
    const triggerResponse = await fetch(
      `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BRIGHTDATA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inputPayload),
      }
    );

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text();
      console.error("Bright Data trigger error:", triggerResponse.status, errorText);
      throw new Error(`Bright Data API error: ${triggerResponse.status} - ${errorText}`);
    }

    const triggerData = await triggerResponse.json();
    console.log("Bright Data trigger response:", JSON.stringify(triggerData));

    // Bright Data returns snapshot_id for async requests
    const snapshotId = triggerData.snapshot_id;
    
    if (!snapshotId) {
      throw new Error("No snapshot_id returned from Bright Data");
    }

    return new Response(
      JSON.stringify({
        success: true,
        runId: snapshotId,
        datasetId: datasetId,
        status: "running",
        message: `Bright Data scrape initiated for ${platform}`,
        provider: "brightdata",
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Bright Data scrape error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        provider: "brightdata",
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
