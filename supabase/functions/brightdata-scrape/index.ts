import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Bright Data Dataset IDs for social media scrapers
// These are the pre-built scraper IDs from Bright Data's Social Media API Suite
const BRIGHTDATA_DATASETS: Record<string, string> = {
  // Facebook Posts by Search (keyword search)
  facebook_posts_search: "gd_lyclf27l1knqaruv1",
  // Facebook Posts by Profile URL
  facebook_posts_profile: "gd_lycleh7010mwt37tvc",
  // Instagram Posts by Hashtag
  instagram_hashtag: "gd_l1villgoqfuktt1co",
  // Instagram Posts by Profile
  instagram_profile: "gd_l1vikfnt1wgvvqz95w",
  // TikTok Posts Search
  tiktok_search: "gd_l7q7dkf244hwjntr0",
  // TikTok Posts by Profile
  tiktok_profile: "gd_lxt7p2o81g1tmc2s4i",
  // YouTube Videos Search
  youtube_search: "gd_lvmq889k7jsh4f0z",
  // YouTube Videos by Channel
  youtube_channel: "gd_l2m3a8o5uyb2o2qz1w",
  // Reddit Posts Search
  reddit_search: "gd_l1villgoqfuktt1cq",
  // LinkedIn Posts Search
  linkedin_search: "gd_l1vikfnt1wgvvqz95x",
  // Twitter/X Search
  twitter_search: "gd_lwxkxvnf1cynvib9co",
};

// Platform to dataset mapping based on search type
function getDatasetId(platform: string, searchType: string): string | null {
  switch (platform) {
    case "facebook":
      return searchType === "username" 
        ? BRIGHTDATA_DATASETS.facebook_posts_profile 
        : BRIGHTDATA_DATASETS.facebook_posts_search;
    case "instagram":
      if (searchType === "username" || searchType === "taggedPosts") {
        return BRIGHTDATA_DATASETS.instagram_profile;
      }
      return BRIGHTDATA_DATASETS.instagram_hashtag;
    case "tiktok":
      return searchType === "username" 
        ? BRIGHTDATA_DATASETS.tiktok_profile 
        : BRIGHTDATA_DATASETS.tiktok_search;
    case "youtube":
    case "youtube_shorts":
      return searchType === "channelUrl" 
        ? BRIGHTDATA_DATASETS.youtube_channel 
        : BRIGHTDATA_DATASETS.youtube_search;
    case "reddit":
    case "reddit_comments":
      return BRIGHTDATA_DATASETS.reddit_search;
    case "linkedin":
      return BRIGHTDATA_DATASETS.linkedin_search;
    case "twitter":
      return BRIGHTDATA_DATASETS.twitter_search;
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

    // Build input payload based on platform and search type
    let inputPayload: Record<string, unknown>[] = [];

    switch (platform) {
      case "twitter":
        if (query) {
          inputPayload = [{ keyword: query, num_of_posts: maxResults }];
        } else if (username) {
          inputPayload = [{ url: `https://twitter.com/${username.replace(/^@/, "")}`, num_of_posts: maxResults }];
        }
        break;

      case "facebook":
        if (searchType === "username" && username) {
          inputPayload = [{ url: `https://www.facebook.com/${username}`, num_of_posts: maxResults }];
        } else if (query) {
          inputPayload = [{ keyword: query, num_of_posts: maxResults }];
        }
        break;

      case "tiktok":
        if (searchType === "username" && username) {
          inputPayload = [{ url: `https://www.tiktok.com/@${username.replace(/^@/, "")}`, num_of_posts: maxResults }];
        } else if (hashtag) {
          inputPayload = [{ keyword: hashtag.replace(/^#/, ""), num_of_posts: maxResults }];
        } else if (query) {
          inputPayload = [{ keyword: query, num_of_posts: maxResults }];
        }
        break;

      case "instagram":
        if (searchType === "taggedPosts" && taggedUsername) {
          inputPayload = [{ url: `https://www.instagram.com/${taggedUsername.replace(/^@/, "")}/tagged/`, num_of_posts: maxResults }];
        } else if (searchType === "username" && username) {
          const usernames = username.split(",").map(u => u.trim().replace(/^@/, "")).filter(Boolean);
          inputPayload = usernames.map(u => ({ url: `https://www.instagram.com/${u}/`, num_of_posts: Math.ceil(maxResults / usernames.length) }));
        } else if (hashtag) {
          const tags = hashtag.split(",").map(h => h.trim().replace(/^#/, "")).filter(Boolean);
          inputPayload = tags.map(t => ({ url: `https://www.instagram.com/explore/tags/${t}/`, num_of_posts: Math.ceil(maxResults / tags.length) }));
        } else if (query) {
          // Treat query as hashtag for Instagram
          inputPayload = [{ url: `https://www.instagram.com/explore/tags/${query.replace(/^#/, "")}/`, num_of_posts: maxResults }];
        }
        break;

      case "youtube":
      case "youtube_shorts":
        if (searchType === "channelUrl" && channelUrl) {
          inputPayload = [{ url: channelUrl, num_of_posts: maxResults }];
        } else if (query) {
          inputPayload = [{ keyword: query, num_of_posts: maxResults }];
        }
        break;

      case "reddit":
      case "reddit_comments":
        if (subreddit) {
          inputPayload = [{ url: `https://www.reddit.com/r/${subreddit}/`, num_of_posts: maxResults }];
        } else if (query) {
          inputPayload = [{ keyword: query, num_of_posts: maxResults }];
        }
        break;

      case "linkedin":
        if (query) {
          inputPayload = [{ keyword: query, num_of_posts: maxResults }];
        }
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
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
