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
  // Facebook: powerai/facebook-post-search-scraper (5.0 rating, $9.99/1000 results)
  facebook: "powerai/facebook-post-search-scraper",
  // Facebook page-specific scraper (fallback for username searches)
  facebook_page: "apify/facebook-posts-scraper",
  // TikTok: sociavault/tiktok-keyword-search-scraper ($1.50/1000 results, keyword filtering)
  // NOTE: sociavault actor failed with upstream 402 (external credits). Use Apify-billed actor instead.
  tiktok: "powerai/tiktok-videos-search-scraper",
  // Instagram: apify/instagram-hashtag-scraper ($2.30/1000 results, maintained by Apify)
  instagram: "apify/instagram-hashtag-scraper",
  // Instagram profile scraper for username-based searches (scrapes posts from specific profiles)
  instagram_profile: "apify/instagram-profile-scraper",
  // YouTube: scraper_one/youtube-search-scraper (reliable, well-maintained)
  youtube: "scraper_one/youtube-search-scraper",
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
  taggedUsername?: string; // Instagram: fetch posts where this user is tagged
  captionFilter?: string; // Instagram: filter results to only include posts mentioning this term
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
      taggedUsername,
      captionFilter,
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
        // Facebook: Use powerai/facebook-post-search-scraper for keyword queries
        // Use page scraper only for specific username/page searches
        if (query) {
          // Use Facebook Post Search Scraper (powerai - 5.0 rating, better reliability)
          actorId = ACTOR_IDS.facebook; // powerai/facebook-post-search-scraper
          
          // Calculate date range: last 30 days to ensure recent posts
          const today = new Date();
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 30);
          
          const formatDate = (d: Date) => d.toISOString().split("T")[0]; // yyyy-mm-dd
          
          input = {
            query: query, // This actor uses 'query' not 'searchQuery'
            maxResults: maxResults,
            recent_posts: true, // Focus on recent posts for monitoring
            start_date: formatDate(thirtyDaysAgo), // Filter posts from last 30 days
            end_date: formatDate(today),
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
        // scraper_one/youtube-search-scraper - uses 'query' and 'resultsCount' parameters
        if (channelUrl) {
          // For channel URLs, search by channel name extracted from URL
          const channelName = channelUrl.replace(/.*@/, "").replace(/.*\/channel\//, "").replace(/.*\/c\//, "");
          input = {
            query: channelName,
            resultsCount: maxResults,
          };
        } else if (query) {
          input = {
            query: query,
            resultsCount: maxResults,
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
