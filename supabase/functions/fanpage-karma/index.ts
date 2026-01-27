import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FANPAGE_KARMA_BASE_URL = "https://app.fanpagekarma.com/api/v1";

interface FanpageKarmaRequest {
  platform: "facebook" | "instagram";
  profileId: string;
  projectId: string;
  periodDays?: number;
  filterKeywords?: string[];
}

interface FanpageKarmaPost {
  id: string;
  date: string;
  message?: string;
  link?: string;
  image?: string;
  type?: string;
  kpi?: {
    likes?: { value: number };
    comments?: { value: number };
    shares?: { value: number };
    reactions?: { value: number };
    engagement?: { value: number };
    reach?: { value: number };
    views?: { value: number };
  };
}

function parseDate(dateStr: string): string | null {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

function formatPeriod(days: number): string {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  return `${formatDate(startDate)}_${formatDate(endDate)}`;
}

function normalizePost(post: FanpageKarmaPost, platform: string, profileName: string) {
  const kpi = post.kpi || {};
  
  const likes = kpi.likes?.value || kpi.reactions?.value || 0;
  const comments = kpi.comments?.value || 0;
  const shares = kpi.shares?.value || 0;
  const views = kpi.views?.value || kpi.reach?.value || 0;
  const totalInteractions = likes + comments + shares;
  const engagement = views > 0 ? (totalInteractions / views) * 100 : 0;

  return {
    external_id: post.id,
    platform,
    title: null,
    description: post.message || "",
    author_name: profileName,
    author_username: profileName,
    author_url: post.link?.split("/posts/")[0] || null,
    author_verified: null,
    author_followers: null,
    likes,
    comments,
    shares,
    views,
    engagement: Math.round(engagement * 100) / 100,
    published_at: parseDate(post.date),
    url: post.link || null,
    content_type: (post.type || "post").toLowerCase(),
    hashtags: extractHashtags(post.message || ""),
    raw_data: post,
  };
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g) || [];
  return matches.map(h => h.toLowerCase());
}

function matchesKeywords(post: { description: string; hashtags: string[] }, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  
  const searchText = `${post.description} ${post.hashtags.join(" ")}`.toLowerCase();
  return keywords.some(keyword => searchText.includes(keyword.toLowerCase().trim()));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FANPAGE_KARMA_API_KEY = Deno.env.get("FANPAGE_KARMA_API_KEY");
    if (!FANPAGE_KARMA_API_KEY) {
      throw new Error("FANPAGE_KARMA_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { 
      platform, 
      profileId, 
      projectId,
      periodDays = 28,
      filterKeywords = []
    }: FanpageKarmaRequest = await req.json();

    if (!platform || !profileId || !projectId) {
      throw new Error("platform, profileId, and projectId are required");
    }

    if (!["facebook", "instagram"].includes(platform)) {
      throw new Error("Platform must be 'facebook' or 'instagram'");
    }

    const period = formatPeriod(periodDays);
    const apiUrl = `${FANPAGE_KARMA_BASE_URL}/${platform}/${profileId}/posts?token=${FANPAGE_KARMA_API_KEY}&period=${period}`;

    console.log(`Fetching ${platform} posts for profile ${profileId}, period: ${period}`);

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Fanpage Karma API error:", response.status, errorText);
      throw new Error(`Fanpage Karma API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const posts: FanpageKarmaPost[] = result.data?.posts || [];
    const profileName = result.metadata?.profile_name || profileId;

    console.log(`Received ${posts.length} posts from Fanpage Karma`);

    // Normalize posts
    let normalizedPosts = posts.map(post => normalizePost(post, platform, profileName));

    // Filter by keywords if provided
    if (filterKeywords.length > 0) {
      const beforeCount = normalizedPosts.length;
      normalizedPosts = normalizedPosts.filter(post => 
        matchesKeywords(post, filterKeywords)
      );
      console.log(`Filtered ${beforeCount} -> ${normalizedPosts.length} posts by keywords: ${filterKeywords.join(", ")}`);
    }

    // === DEDUPLICATION: Check by BOTH external_id AND url ===
    const externalIds = normalizedPosts.map(p => p.external_id).filter(Boolean);
    const urls = normalizedPosts.map(p => p.url).filter(Boolean);

    // Check existing by external_id
    const { data: existingByExternalId } = await supabase
      .from("social_results")
      .select("external_id")
      .eq("project_id", projectId)
      .eq("platform", platform)
      .in("external_id", externalIds);

    const existingExternalIds = new Set((existingByExternalId || []).map(r => r.external_id));

    // Check existing by URL
    const { data: existingByUrl } = await supabase
      .from("social_results")
      .select("url")
      .eq("project_id", projectId)
      .eq("platform", platform)
      .in("url", urls);

    const existingUrls = new Set((existingByUrl || []).map(r => r.url));

    // Filter out duplicates (either external_id OR url match = duplicate)
    const newPosts = normalizedPosts.filter(post => 
      !existingExternalIds.has(post.external_id) && 
      !existingUrls.has(post.url)
    );

    const duplicatesSkipped = normalizedPosts.length - newPosts.length;
    console.log(`Deduplication: ${duplicatesSkipped} duplicates skipped, ${newPosts.length} new posts`);

    // Create a job record for tracking
    const { data: job, error: jobError } = await supabase
      .from("social_scrape_jobs")
      .insert({
        project_id: projectId,
        platform: `${platform}_fanpage`,
        search_type: "profile",
        search_value: profileId,
        status: "completed",
        results_count: newPosts.length,
        completed_at: new Date().toISOString(),
        metadata: {
          source: "fanpage_karma",
          period,
          total_fetched: posts.length,
          filtered_count: normalizedPosts.length,
          duplicates_skipped: duplicatesSkipped,
          filter_keywords: filterKeywords,
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error("Error creating job record:", jobError);
    }

    // Insert new posts
    if (newPosts.length > 0 && job) {
      const postsToInsert = newPosts.map(post => ({
        ...post,
        project_id: projectId,
        job_id: job.id,
      }));

      const { error: insertError } = await supabase
        .from("social_results")
        .insert(postsToInsert);

      if (insertError) {
        console.error("Error inserting posts:", insertError);
        throw new Error(`Failed to save posts: ${insertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        platform,
        profileId,
        profileName,
        totalFetched: posts.length,
        filteredCount: normalizedPosts.length,
        duplicatesSkipped,
        newPostsSaved: newPosts.length,
        jobId: job?.id,
        period,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fanpage-karma:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
