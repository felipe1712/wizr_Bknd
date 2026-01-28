import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FANPAGE_KARMA_API_BASE = "https://app.fanpagekarma.com/api/v1";

interface FkProfile {
  id: string;
  profile_id: string;
  network: string;
  ranking_id: string | null;
  display_name: string | null;
}

interface PostData {
  url?: string;
  link?: string;
  content?: string;
  text?: string;
  message?: string;
  description?: string;
  image?: string;
  picture?: string;
  thumbnail?: string;
  engagement?: number;
  interactions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  date?: string;
  created_time?: string;
  published_at?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const runSync = async () => {
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

    // Calculate period (last 28 days by default for KPIs)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);
    
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const period = `${formatDate(startDate)}_${formatDate(endDate)}`;

    // Calculate yesterday's date for top posts
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);
    const yesterdayPeriod = `${yesterdayStr}_${yesterdayStr}`;

    const results: { profile: string; success: boolean; error?: string; topPost?: boolean }[] = [];

    // Process each profile
    for (const profile of profiles as FkProfile[]) {
      try {
        // ============ SYNC KPIs ============
        const kpiUrl = `${FANPAGE_KARMA_API_BASE}/${profile.network}/${encodeURIComponent(profile.profile_id)}/kpi?token=${FANPAGE_KARMA_API_KEY}&period=${period}`;
        
        console.log(`Syncing KPIs: ${profile.network}/${profile.profile_id}`);
        
        const kpiResponse = await fetch(kpiUrl);
        const kpiText = await kpiResponse.text();
        
        let kpiData;
        try {
          // Handle NaN values in response
          const sanitizedText = kpiText.trim().replace(/:\s*NaN\s*(,|})/g, ': null$1');
          kpiData = JSON.parse(sanitizedText);
        } catch {
          results.push({ profile: profile.profile_id, success: false, error: "Invalid JSON response for KPIs" });
          continue;
        }

        if (!kpiResponse.ok) {
          results.push({ profile: profile.profile_id, success: false, error: kpiData.metadata?.message || "KPI API error" });
          continue;
        }

        // Extract KPIs based on network
        const kpiDataObj = kpiData.data || {};
        const extractValue = (key: string) => {
          const item = kpiDataObj[key];
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
          raw_data: kpiDataObj,
        });

        if (insertError) {
          results.push({ profile: profile.profile_id, success: false, error: insertError.message });
          continue;
        }

        // Update last_synced_at
        await supabase
          .from("fk_profiles")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", profile.id);

        // ============ FETCH TOP POST OF YESTERDAY ============
        let topPostSaved = false;
        try {
          const postsUrl = `${FANPAGE_KARMA_API_BASE}/${profile.network}/${encodeURIComponent(profile.profile_id)}/posts?token=${FANPAGE_KARMA_API_KEY}&period=${yesterdayPeriod}`;
          
          console.log(`Fetching posts: ${profile.network}/${profile.profile_id} for ${yesterdayStr}`);
          
          const postsResponse = await fetch(postsUrl);
          const postsText = await postsResponse.text();
          
          if (postsResponse.ok && postsText.trim().endsWith('}')) {
            const sanitizedPostsText = postsText.trim().replace(/:\s*NaN\s*(,|})/g, ': null$1');
            const postsData = JSON.parse(sanitizedPostsText);
            const posts: PostData[] = postsData.data || [];
            
            if (posts.length > 0) {
              // Find post with highest engagement
              const topPost = posts.reduce((best: PostData | null, current: PostData) => {
                const currentEngagement = current.engagement || current.interactions || 
                  ((current.likes || 0) + (current.comments || 0) + (current.shares || 0));
                const bestEngagement = best ? (best.engagement || best.interactions || 
                  ((best.likes || 0) + (best.comments || 0) + (best.shares || 0))) : 0;
                return currentEngagement > bestEngagement ? current : best;
              }, null);

              if (topPost) {
                const engagement = topPost.engagement || topPost.interactions || 
                  ((topPost.likes || 0) + (topPost.comments || 0) + (topPost.shares || 0));

                // Upsert top post (update if exists for same profile/network/date)
                const { error: topPostError } = await supabase
                  .from("fk_daily_top_posts")
                  .upsert({
                    fk_profile_id: profile.id,
                    network: profile.network,
                    post_date: yesterdayStr,
                    post_url: topPost.url || topPost.link || null,
                    post_content: topPost.content || topPost.text || topPost.message || topPost.description || null,
                    post_image_url: topPost.image || topPost.picture || topPost.thumbnail || null,
                    engagement: engagement,
                    likes: topPost.likes || 0,
                    comments: topPost.comments || 0,
                    shares: topPost.shares || 0,
                    views: topPost.views || 0,
                    raw_data: topPost,
                  }, {
                    onConflict: 'fk_profile_id,network,post_date'
                  });

                if (!topPostError) {
                  topPostSaved = true;
                  console.log(`Saved top post for ${profile.profile_id} (${profile.network}): ${engagement} engagement`);
                } else {
                  console.error(`Error saving top post for ${profile.profile_id}:`, topPostError.message);
                }
              }
            } else {
              console.log(`No posts found for ${profile.profile_id} on ${yesterdayStr}`);
            }
          }
        } catch (postErr) {
          console.error(`Error fetching posts for ${profile.profile_id}:`, postErr);
          // Don't fail the whole sync if posts fail
        }
        
        results.push({ profile: profile.profile_id, success: true, topPost: topPostSaved });

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
    const topPostsSaved = results.filter((r) => r.topPost).length;

    console.log(`Scheduled sync complete: ${successful} success, ${failed} failed, ${topPostsSaved} top posts saved`);

    return {
      success: true,
      message: `Synced ${successful} profiles, ${failed} failed, ${topPostsSaved} top posts saved`,
      synced: successful,
      failed,
      topPostsSaved,
      details: results,
    };
  };

  // IMPORTANT: This sync can take several minutes (hundreds of profiles).
  // To avoid browser/gateway timeouts, we run it in the background and return immediately.
  try {
    const edgeRuntimeAny = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    const waitUntil = edgeRuntimeAny?.waitUntil;

    if (typeof waitUntil === "function") {
      waitUntil(
        runSync().catch((e) => {
          console.error("Scheduled ranking sync background error:", e);
        })
      );
    } else {
      // Fallback: run without waitUntil (may still complete, but not guaranteed if the platform enforces strict request lifetimes)
      runSync().catch((e) => console.error("Scheduled ranking sync fallback error:", e));
    }

    return new Response(
      JSON.stringify({ success: true, started: true, message: "Sync started" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Scheduled ranking sync start error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
