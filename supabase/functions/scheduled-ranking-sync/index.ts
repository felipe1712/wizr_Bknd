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

interface PostKPI {
  value?: number;
  formatted_value?: string;
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
  kpi?: {
    page_posts_likes_count?: PostKPI;
    page_posts_comments_count?: PostKPI;
    page_posts_shares_count?: PostKPI;
    page_total_engagement_count?: PostKPI;
    page_video_posts_views_count?: PostKPI;
    [key: string]: PostKPI | undefined;
  };
}

// Parse Fanpage Karma date format: "Mon Feb 02 20:00:00 UTC 2026"
function parseFKDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // If already ISO format, extract date part
  if (dateStr.includes("T") && dateStr.includes("-")) {
    return dateStr.split("T")[0];
  }
  
  // FK can return strings like:
  // - "Mon Feb 02 20:00:00 UTC 2026"
  // - truncated: "Wed Jan 28 03:32:54 U"
  // Deno's Date() parsing for these formats is not reliable, so we parse manually.
  const currentYear = new Date().getUTCFullYear();
  const normalized = dateStr
    .replace(/\s+UTC\b/i, " UTC")
    .replace(/\s+UT\b/i, " UTC")
    .replace(/\s+U\b/i, " UTC")
    .trim();

  const m = normalized.match(
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})(?:\s+UTC)?(?:\s+(\d{4}))?$/
  );
  if (m) {
    const monthAbbrev = m[2].toLowerCase();
    const dayNum = Number(m[3]);
    const yearNum = m[5] ? Number(m[5]) : currentYear;

    const monthMap: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };

    const monthNum = monthMap[monthAbbrev];
    if (monthNum && dayNum >= 1 && dayNum <= 31) {
      const mm = String(monthNum).padStart(2, "0");
      const dd = String(dayNum).padStart(2, "0");
      return `${yearNum}-${mm}-${dd}`;
    }
  }

  // Fallback: try Date() for any other variant.
  try {
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const day = String(parsed.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through
  }
  
  // Last resort: try to extract year-month-day pattern from any format
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }
  
  return null;
}

// Extract metrics from post (handles both root-level and nested kpi structure)
function extractPostMetrics(post: PostData): { likes: number; comments: number; shares: number; views: number; engagement: number } {
  let likes = post.likes || 0;
  let comments = post.comments || 0;
  let shares = post.shares || 0;
  let views = post.views || 0;
  let engagement = post.engagement || post.interactions || 0;
  
  // If metrics are nested in kpi object
  if (post.kpi) {
    likes = post.kpi.page_posts_likes_count?.value ?? likes;
    comments = post.kpi.page_posts_comments_count?.value ?? comments;
    shares = post.kpi.page_posts_shares_count?.value ?? shares;
    views = post.kpi.page_video_posts_views_count?.value ?? views;
    engagement = post.kpi.page_total_engagement_count?.value ?? engagement;
  }
  
  // Calculate engagement if not provided
  if (!engagement) {
    engagement = likes + comments + shares;
  }
  
  return { likes, comments, shares, views, engagement };
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

    // For top posts, we look at the last 7 days to increase probability of capturing data
    const topPostsEndDate = new Date();
    topPostsEndDate.setDate(topPostsEndDate.getDate() - 1); // yesterday
    const topPostsStartDate = new Date();
    topPostsStartDate.setDate(topPostsStartDate.getDate() - 7);
    const topPostsPeriod = `${formatDate(topPostsStartDate)}_${formatDate(topPostsEndDate)}`;

    const results: { profile: string; success: boolean; error?: string; topPosts?: number }[] = [];

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
          // YouTube uses channel_* prefix (e.g. channel_subscribers_count)
          followers = extractValue("channel_subscribers_count") || extractValue("channel_subscribers");
          engagementRate =
            extractValue("channel_video_interaction") ||
            extractValue("channel_engagement") ||
            extractValue("channel_engagement_rate");
          followerGrowth = extractValue("channel_subscribers_growth");
          postsPerDay = extractValue("channel_videos_per_day");
          ppi = extractValue("channel_page_performance_index") || extractValue("channel_ppi");
        } else if (profile.network === "twitter") {
          // Twitter/X uses profile_* prefix in Fanpage Karma
          followers = extractValue("profile_followers") || extractValue("profile_follower");
          engagementRate = extractValue("profile_engagement") || extractValue("profile_engagement_rate");
          followerGrowth = extractValue("profile_followers_growth") || extractValue("profile_follower_growth");
          postsPerDay = extractValue("profile_posts_per_day") || extractValue("profile_tweets_per_day");
          ppi = extractValue("profile_page_performance_index") || extractValue("profile_ppi");
        } else if (profile.network === "linkedin") {
          followers = extractValue("page_followers") || extractValue("page_follower");
          engagementRate = extractValue("page_engagement") || extractValue("page_engagement_rate");
          followerGrowth = extractValue("page_followers_growth");
          postsPerDay = extractValue("page_posts_per_day");
          ppi = extractValue("page_page_performance_index") || extractValue("page_ppi");
        }

        // Upsert KPI record (avoid duplicate key errors when re-running the sync)
        const { error: kpiUpsertError } = await supabase
          .from("fk_profile_kpis")
          .upsert(
            {
              fk_profile_id: profile.id,
              period_start: formatDate(startDate),
              period_end: formatDate(endDate),
              followers,
              follower_growth_percent: followerGrowth,
              engagement_rate: engagementRate,
              posts_per_day: postsPerDay,
              page_performance_index: ppi,
              raw_data: kpiDataObj,
            },
            {
              onConflict: "fk_profile_id,period_start,period_end",
            }
          );

        if (kpiUpsertError) {
          // Don't block top posts just because KPI upsert failed for this profile
          console.error(`Error upserting KPI for ${profile.profile_id}:`, kpiUpsertError.message);
        }

        // Update last_synced_at
        await supabase
          .from("fk_profiles")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", profile.id);

        // ============ FETCH TOP POSTS OF LAST 7 DAYS ============
        let topPostsCount = 0;
        try {
          const postsUrl = `${FANPAGE_KARMA_API_BASE}/${profile.network}/${encodeURIComponent(profile.profile_id)}/posts?token=${FANPAGE_KARMA_API_KEY}&period=${topPostsPeriod}`;
          
          console.log(`Fetching posts: ${profile.network}/${profile.profile_id} for ${topPostsPeriod}`);
          
          const postsResponse = await fetch(postsUrl);
          const postsText = await postsResponse.text();
          const trimmedPostsText = postsText.trim();
          
          // Fanpage Karma may return valid JSON ending in either '}' (object) or ']' (array).
          // We only want to skip clearly truncated responses.
          const looksComplete =
            trimmedPostsText.endsWith("}") || trimmedPostsText.endsWith("]");

          if (postsResponse.ok && looksComplete) {
            const sanitizedPostsText = trimmedPostsText.replace(/:\s*NaN\s*(,|})/g, ': null$1');
            const postsData = JSON.parse(sanitizedPostsText);
            // Handle both { data: { posts: [...] } } and { data: [...] } structures
            const rawPosts = postsData.data?.posts || postsData.data || [];
            const posts: PostData[] = Array.isArray(rawPosts) ? rawPosts : [];
           
            if (posts.length > 0) {
              // Group posts by date
              const postsByDate = new Map<string, PostData[]>();
              
              for (const post of posts) {
                // Get date from post (handle FK's text format like "Mon Feb 02 20:00:00 UTC 2026")
                const postDateRaw = post.date || post.created_time || post.published_at;
                const postDate = parseFKDate(postDateRaw || "");
                if (!postDate) continue;
                
                if (!postsByDate.has(postDate)) {
                  postsByDate.set(postDate, []);
                }
                postsByDate.get(postDate)!.push(post);
              }
              
              // For each date, save the top post
              for (const [postDate, datePosts] of postsByDate) {
                const topPost = datePosts.reduce((best: PostData | null, current: PostData) => {
                  const currentMetrics = extractPostMetrics(current);
                  const bestMetrics = best ? extractPostMetrics(best) : { engagement: 0 };
                  return currentMetrics.engagement > bestMetrics.engagement ? current : best;
                }, null);

                if (topPost) {
                  const metrics = extractPostMetrics(topPost);

                  // Upsert top post (update if exists for same profile/network/date)
                  const { error: topPostError } = await supabase
                    .from("fk_daily_top_posts")
                    .upsert({
                      fk_profile_id: profile.id,
                      network: profile.network,
                      post_date: postDate,
                      post_url: topPost.url || topPost.link || null,
                      post_content: topPost.content || topPost.text || topPost.message || topPost.description || null,
                      post_image_url: topPost.image || topPost.picture || topPost.thumbnail || null,
                      engagement: metrics.engagement,
                      likes: metrics.likes,
                      comments: metrics.comments,
                      shares: metrics.shares,
                      views: metrics.views,
                      raw_data: topPost,
                    }, {
                      onConflict: 'fk_profile_id,network,post_date'
                    });

                  if (!topPostError) {
                    topPostsCount++;
                  } else {
                    console.error(`Error saving top post for ${profile.profile_id} (${postDate}):`, topPostError.message);
                  }
                }
              }
              
              if (topPostsCount > 0) {
                console.log(`Saved ${topPostsCount} top posts for ${profile.profile_id} (${profile.network})`);
              }
            } else {
              console.log(`No posts found for ${profile.profile_id} in the last 7 days`);
            }
          } else if (!looksComplete) {
            console.warn(`Posts response looked truncated for ${profile.profile_id} (${profile.network})`);
          }
        } catch (postErr) {
          console.error(`Error fetching posts for ${profile.profile_id}:`, postErr);
          // Don't fail the whole sync if posts fail
        }
        
        results.push({ profile: profile.profile_id, success: true, topPosts: topPostsCount });

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
    const topPostsSaved = results.reduce((sum, r) => sum + (r.topPosts || 0), 0);

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
