import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  // Optional: allows server-side persistence of run_id/dataset_id even if client times out
  jobId?: string;
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

  async function updateSocialScrapeJob(jobId: string, updates: Record<string, unknown>) {
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; cannot persist job updates");
        return;
      }

      const url = `${SUPABASE_URL}/rest/v1/social_scrape_jobs?id=eq.${encodeURIComponent(jobId)}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn("Failed to persist social_scrape_jobs update:", res.status, text);
      }
    } catch (e) {
      console.warn("Error persisting social_scrape_jobs update:", e);
    }
  }

  try {
    const BRIGHTDATA_API_KEY = Deno.env.get("BRIGHTDATA_API_KEY");
    if (!BRIGHTDATA_API_KEY) {
      throw new Error("BRIGHTDATA_API_KEY is not configured");
    }

    const { 
      jobId,
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
    let discoverBy = "keyword"; // Default for keyword search

    switch (platform) {
      case "tiktok":
        // TikTok uses 'search_keyword' and 'country' (no num_of_posts)
        // Based on curl: {"input":[{"search_keyword":"#artist","country":""}]}
        if (hashtag) {
          inputPayload = [{ search_keyword: hashtag.startsWith('#') ? hashtag : `#${hashtag}`, country: "" }];
        } else if (query) {
          inputPayload = [{ search_keyword: query, country: "" }];
        }
        break;

      case "youtube":
      case "youtube_shorts":
        // YouTube uses 'keyword' parameter based on the curl example
        if (query) {
          inputPayload = [{ 
            keyword: query, 
            num_of_posts: String(maxResults), // API expects string
            start_date: "",
            end_date: "",
            country: ""
          }];
        }
        break;

      default:
        throw new Error(`Platform ${platform} not supported by Bright Data. Use Apify instead.`);
    }

    if (inputPayload.length === 0) {
      throw new Error("No valid search parameters provided");
    }

    console.log(`Bright Data scrape: platform=${platform}, dataset=${datasetId}, inputs=${JSON.stringify(inputPayload)}`);

    // Trigger scrape via Bright Data API using the correct endpoint format
    // Based on curl example: /datasets/v3/scrape?dataset_id=X&type=discover_new&discover_by=keyword
    const apiUrl = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&notify=false&include_errors=true&type=discover_new&discover_by=${discoverBy}`;
    
    const triggerResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BRIGHTDATA_API_KEY}`,
        "Content-Type": "application/json",
      },
      // Wrap inputs in {"input": [...]} as shown in the curl example
      body: JSON.stringify({ input: inputPayload }),
    });

    // Read response as text first - Bright Data may return NDJSON (newline-delimited JSON)
    const responseText = await triggerResponse.text();
    
    if (!triggerResponse.ok) {
      console.error("Bright Data trigger error:", triggerResponse.status, responseText);
      throw new Error(`Bright Data API error: ${triggerResponse.status} - ${responseText}`);
    }

    // Parse only the first line of the response (NDJSON format)
    const firstLine = responseText.split('\n')[0].trim();
    let triggerData: { snapshot_id?: string };
    try {
      triggerData = JSON.parse(firstLine);
    } catch (parseError) {
      console.error("Failed to parse Bright Data response:", responseText.substring(0, 500));
      throw new Error(`Invalid JSON response from Bright Data: ${parseError}`);
    }
    console.log("Bright Data trigger response:", JSON.stringify(triggerData));

    // Bright Data returns snapshot_id for async requests
    const snapshotId = triggerData.snapshot_id;
    
    if (!snapshotId) {
      throw new Error("No snapshot_id returned from Bright Data");
    }

    // Persist run_id/dataset_id server-side (prevents client-timeout from losing snapshot_id)
    if (jobId) {
      await updateSocialScrapeJob(jobId, {
        run_id: snapshotId,
        dataset_id: datasetId,
        status: "running",
        // keep metadata minimal; front-end may override/extend
        metadata: { provider: "brightdata" },
        updated_at: new Date().toISOString(),
      });
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
