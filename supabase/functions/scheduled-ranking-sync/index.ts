import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FANPAGE_KARMA_API_BASE = "https://app.fanpagekarma.com/api/v1";

interface FkProfile {
  id: string;
  profile_id: string;
  network: string;
  ranking_id: string | null;
  display_name: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FANPAGE_KARMA_API_KEY = Deno.env.get("FANPAGE_KARMA_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FANPAGE_KARMA_API_KEY) {
      throw new Error("FANPAGE_KARMA_API_KEY not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all active profiles linked to rankings
    const { data: profiles, error: profilesError } = await supabase
      .from("fk_profiles")
      .select("id, profile_id, network, ranking_id, display_name")
      .not("ranking_id", "is", null)
      .eq("is_active", true);

    if (profilesError) {
      throw new Error(`Error fetching profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No profiles to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Scheduled sync: Found ${profiles.length} profiles to sync`);

    // Calculate period (last 28 days by default)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);
    
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const period = `${formatDate(startDate)}_${formatDate(endDate)}`;

    const results: { profile: string; success: boolean; error?: string }[] = [];

    // Process each profile
    for (const profile of profiles as FkProfile[]) {
      try {
        const url = `${FANPAGE_KARMA_API_BASE}/${profile.network}/${encodeURIComponent(profile.profile_id)}/kpi?token=${FANPAGE_KARMA_API_KEY}&period=${period}`;
        
        console.log(`Syncing ${profile.network}/${profile.profile_id}`);
        
        const response = await fetch(url);
        const text = await response.text();
        
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          results.push({ profile: profile.profile_id, success: false, error: "Invalid JSON response" });
          continue;
        }

        if (!response.ok) {
          results.push({ profile: profile.profile_id, success: false, error: data.metadata?.message || "API error" });
          continue;
        }

        // Extract KPIs based on network
        const kpiData = data.data || {};
        const extractValue = (key: string) => {
          const item = kpiData[key];
          return item?.value ?? item?.absolute ?? null;
        };

        let followers: number | null = null;
        let engagementRate: number | null = null;
        let followerGrowth: number | null = null;
        let postsPerDay: number | null = null;
        let ppi: number | null = null;

        if (profile.network === "facebook") {
          followers = extractValue("page_follower") || extractValue("page_fans");
          engagementRate = extractValue("page_engagement_rate") || extractValue("page_engagement");
          followerGrowth = extractValue("page_follower_growth") || extractValue("page_fans_growth");
          postsPerDay = extractValue("page_posts_per_day");
          ppi = extractValue("page_page_performance_index") || extractValue("page_ppi");
        } else if (profile.network === "instagram") {
          followers = extractValue("profile_followers") || extractValue("profile_follower");
          engagementRate = extractValue("profile_engagement") || extractValue("profile_engagement_rate");
          followerGrowth = extractValue("profile_followers_growth") || extractValue("profile_follower_growth");
          postsPerDay = extractValue("profile_posts_per_day");
          ppi = extractValue("profile_page_performance_index") || extractValue("profile_ppi");
        } else if (profile.network === "tiktok") {
          followers = 
            extractValue("tiktoker_profile_follower_count") ||
            extractValue("tiktoker_followers") ||
            extractValue("tiktoker_followers_count") ||
            extractValue("tiktoker_fans") ||
            extractValue("tiktoker_fans_count") ||
            extractValue("tiktoker_follower");
          engagementRate = extractValue("tiktoker_engagement") || extractValue("tiktoker_engagement_rate");
          followerGrowth = extractValue("tiktoker_followers_growth") || extractValue("tiktoker_follower_growth");
          postsPerDay = extractValue("tiktoker_posts_per_day");
          ppi = extractValue("tiktoker_page_performance_index") || extractValue("tiktoker_ppi");
        } else if (profile.network === "youtube") {
          followers = extractValue("channel_subscribers") || extractValue("channel_subscriber");
          engagementRate = extractValue("channel_engagement") || extractValue("channel_engagement_rate");
          followerGrowth = extractValue("channel_subscribers_growth");
          postsPerDay = extractValue("channel_videos_per_day");
          ppi = extractValue("channel_page_performance_index") || extractValue("channel_ppi");
        } else if (profile.network === "twitter") {
          followers = extractValue("account_followers") || extractValue("account_follower");
          engagementRate = extractValue("account_engagement") || extractValue("account_engagement_rate");
          followerGrowth = extractValue("account_followers_growth");
          postsPerDay = extractValue("account_tweets_per_day");
          ppi = extractValue("account_page_performance_index") || extractValue("account_ppi");
        } else if (profile.network === "linkedin") {
          followers = extractValue("page_followers") || extractValue("page_follower");
          engagementRate = extractValue("page_engagement") || extractValue("page_engagement_rate");
          followerGrowth = extractValue("page_followers_growth");
          postsPerDay = extractValue("page_posts_per_day");
          ppi = extractValue("page_page_performance_index") || extractValue("page_ppi");
        }

        // Insert KPI record
        const { error: insertError } = await supabase.from("fk_profile_kpis").insert({
          fk_profile_id: profile.id,
          period_start: formatDate(startDate),
          period_end: formatDate(endDate),
          followers,
          follower_growth_percent: followerGrowth,
          engagement_rate: engagementRate,
          posts_per_day: postsPerDay,
          page_performance_index: ppi,
          raw_data: kpiData,
        });

        if (insertError) {
          results.push({ profile: profile.profile_id, success: false, error: insertError.message });
        } else {
          // Update last_synced_at
          await supabase
            .from("fk_profiles")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", profile.id);
          
          results.push({ profile: profile.profile_id, success: true });
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));

      } catch (err) {
        results.push({ 
          profile: profile.profile_id, 
          success: false, 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Scheduled sync complete: ${successful} success, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${successful} profiles, ${failed} failed`,
        synced: successful,
        failed,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Scheduled ranking sync error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
