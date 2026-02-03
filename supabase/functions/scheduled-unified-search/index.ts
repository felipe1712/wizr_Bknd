import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Entity {
  id: string;
  nombre: string;
  palabras_clave: string[];
  aliases: string[];
}

interface Schedule {
  id: string;
  project_id: string;
  platforms: string[];
  max_results_per_platform: number;
  frequency: string;
  projects: { id: string; nombre: string } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("scheduled-unified-search: Starting scheduled search run");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;

    // Find all enabled schedules that are due (next_run_at <= now or next_run_at is null)
    const { data: schedules, error: schedulesError } = await supabase
      .from("project_search_schedules")
      .select("*, projects(id, nombre)")
      .eq("is_enabled", true)
      .or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`);

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    if (!schedules || schedules.length === 0) {
      console.log("No schedules due for execution");
      return new Response(
        JSON.stringify({ success: true, message: "No schedules due", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${schedules.length} schedules to process`);

    const results: Array<{
      projectId: string;
      projectName: string;
      success: boolean;
      mentionsFound: number;
      mentionsSaved: number;
      error?: string;
    }> = [];

    // Process each schedule
    for (const schedule of schedules as Schedule[]) {
      const projectName = schedule.projects?.nombre || "Unknown";
      console.log(`Processing schedule for project: ${projectName}`);

      try {
        // Get entities for this project
        const { data: entities, error: entitiesError } = await supabase
          .from("entities")
          .select("id, nombre, palabras_clave, aliases")
          .eq("project_id", schedule.project_id)
          .eq("activo", true);

        if (entitiesError) throw entitiesError;

        if (!entities || entities.length === 0) {
          console.log(`No active entities for project ${schedule.project_id}, skipping`);
          await updateScheduleAfterRun(supabase, schedule.id, schedule.frequency, "No active entities");
          continue;
        }

        let totalMentionsFound = 0;
        let totalMentionsSaved = 0;

        // Process each entity
        for (const entity of entities as Entity[]) {
          const searchQuery = buildSearchQuery(entity);

          // Process each platform
          for (const platform of schedule.platforms) {
            try {
              let platformResults: Array<{
                url: string;
                title?: string;
                description?: string;
                source_domain?: string;
                published_at?: string;
              }> = [];

              if (platform === "news" && firecrawlKey) {
                platformResults = await searchNews(firecrawlKey, searchQuery, schedule.max_results_per_platform);
              } else if (apifyToken) {
                platformResults = await searchSocial(apifyToken, platform, searchQuery, schedule.max_results_per_platform);
              }

              totalMentionsFound += platformResults.length;

              // Save results as mentions
              if (platformResults.length > 0) {
                const mentionsToSave = platformResults
                  .filter(r => r.url)
                  .map(r => ({
                    project_id: schedule.project_id,
                    url: r.url,
                    title: r.title || null,
                    description: r.description || null,
                    source_domain: r.source_domain || platform,
                    entity_id: entity.id,
                    matched_keywords: entity.palabras_clave || [],
                    published_at: r.published_at || null,
                  }));

                if (mentionsToSave.length > 0) {
                  const { error: saveError, data: savedData } = await supabase
                    .from("mentions")
                    .upsert(mentionsToSave, { 
                      onConflict: "project_id,url",
                      ignoreDuplicates: true 
                    })
                    .select("id");

                  if (!saveError && savedData) {
                    totalMentionsSaved += savedData.length;
                  }
                }
              }

              console.log(`  ${entity.nombre} on ${platform}: ${platformResults.length} results`);
            } catch (platformError) {
              console.error(`Error searching ${platform} for ${entity.nombre}:`, platformError);
            }
          }
        }

        // Update schedule after successful run
        await updateScheduleAfterRun(supabase, schedule.id, schedule.frequency, null);

        results.push({
          projectId: schedule.project_id,
          projectName,
          success: true,
          mentionsFound: totalMentionsFound,
          mentionsSaved: totalMentionsSaved,
        });

        console.log(`Project ${projectName}: ${totalMentionsFound} found, ${totalMentionsSaved} saved`);
      } catch (projectError) {
        const errorMessage = projectError instanceof Error ? projectError.message : "Unknown error";
        console.error(`Error processing project ${schedule.project_id}:`, projectError);
        
        await updateScheduleAfterRun(supabase, schedule.id, schedule.frequency, errorMessage);

        results.push({
          projectId: schedule.project_id,
          projectName,
          success: false,
          mentionsFound: 0,
          mentionsSaved: 0,
          error: errorMessage,
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`scheduled-unified-search: Completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: schedules.length,
        results,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("scheduled-unified-search error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSearchQuery(entity: Entity): string {
  if (entity.palabras_clave && entity.palabras_clave.length > 0) {
    return entity.palabras_clave.join(" OR ");
  }
  const terms = [entity.nombre, ...entity.aliases].filter(Boolean);
  return terms.join(" OR ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateScheduleAfterRun(
  supabase: any,
  scheduleId: string,
  frequency: string,
  error: string | null
) {
  const now = new Date();
  const nextRun = calculateNextRun(frequency, now);

  await supabase
    .from("project_search_schedules")
    .update({
      last_run_at: now.toISOString(),
      next_run_at: nextRun.toISOString(),
      last_error: error,
      run_count: supabase.sql`run_count + 1`,
    })
    .eq("id", scheduleId);
}

function calculateNextRun(frequency: string, fromTime: Date): Date {
  const next = new Date(fromTime);
  switch (frequency) {
    case "hourly":
      next.setHours(next.getHours() + 1);
      break;
    case "twice_daily":
      next.setHours(next.getHours() + 12);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}

async function searchNews(
  apiKey: string,
  query: string,
  maxResults: number
): Promise<Array<{ url: string; title?: string; description?: string; source_domain?: string; published_at?: string }>> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: maxResults,
        lang: "es",
        tbs: "qdr:w",
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl error:", response.status);
      return [];
    }

    const data = await response.json();
    return (data.data || []).map((r: Record<string, unknown>) => ({
      url: r.url as string,
      title: r.title as string,
      description: r.description as string,
      source_domain: r.url ? new URL(r.url as string).hostname.replace("www.", "") : undefined,
      published_at: (r.metadata as Record<string, unknown>)?.publishedDate as string,
    }));
  } catch (error) {
    console.error("searchNews error:", error);
    return [];
  }
}

async function searchSocial(
  apiToken: string,
  platform: string,
  query: string,
  maxResults: number
): Promise<Array<{ url: string; title?: string; description?: string; source_domain?: string; published_at?: string }>> {
  const actorMap: Record<string, string> = {
    twitter: "powerai/twitter-search-scraper",
    facebook: "powerai/facebook-post-search-scraper",
    tiktok: "sociavault/tiktok-keyword-search-scraper",
    instagram: "apify/instagram-scraper",
    youtube: "scrapesmith/free-youtube-search-scraper",
    reddit: "trudax/reddit-scraper-lite",
    linkedin: "harvestapi/linkedin-post-search",
  };

  const actorId = actorMap[platform];
  if (!actorId) {
    console.log(`Unknown platform: ${platform}`);
    return [];
  }

  try {
    let input: Record<string, unknown> = {};

    switch (platform) {
      case "twitter":
        input = { query, searchType: "Latest", maxTweets: maxResults };
        break;
      case "facebook":
        input = { query, maxResults, recent_posts: true };
        break;
      case "tiktok":
        input = { query, max_results: maxResults, date_posted: "this-week" };
        break;
      case "instagram":
        input = { search: query, resultsLimit: Math.min(maxResults, 20) };
        break;
      case "youtube":
        input = { searchQueries: [query], maxResults };
        break;
      case "reddit":
        input = { searches: [query], maxItems: maxResults, sort: "new" };
        break;
      case "linkedin":
        input = { search: query, maxPosts: maxResults };
        break;
    }

    const startResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (!startResponse.ok) {
      console.error(`Apify start error for ${platform}:`, startResponse.status);
      return [];
    }

    const startData = await startResponse.json();
    const runId = startData.data?.id;

    if (!runId) {
      console.error(`No run ID for ${platform}`);
      return [];
    }

    // Poll for completion (max 2 minutes)
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`
      );

      if (!statusResponse.ok) {
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      const status = statusData.data?.status;

      if (status === "SUCCEEDED") {
        const datasetId = statusData.data?.defaultDatasetId;
        if (!datasetId) return [];

        const resultsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}&limit=${maxResults}`
        );

        if (!resultsResponse.ok) return [];

        const resultsData = await resultsResponse.json();
        return normalizeResults(platform, resultsData);
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        console.error(`Apify run ${status} for ${platform}`);
        return [];
      }

      attempts++;
    }

    console.error(`Timeout waiting for ${platform} results`);
    return [];
  } catch (error) {
    console.error(`searchSocial error for ${platform}:`, error);
    return [];
  }
}

function normalizeResults(
  platform: string,
  results: Array<Record<string, unknown>>
): Array<{ url: string; title?: string; description?: string; source_domain?: string; published_at?: string }> {
  return results.map(r => {
    let url = "";
    let title = "";
    let description = "";
    let publishedAt = "";

    switch (platform) {
      case "twitter":
        url = r.tweet_url as string || r.url as string || "";
        description = r.text as string || r.full_text as string || "";
        publishedAt = r.created_at as string || "";
        break;
      case "facebook":
        url = r.post_url as string || r.url as string || "";
        description = r.message as string || r.text as string || "";
        publishedAt = r.timestamp as string || r.postedAt as string || "";
        break;
      case "tiktok":
        url = r.video_url as string || r.webVideoUrl as string || "";
        description = r.description as string || r.text as string || "";
        publishedAt = r.created_at as string || r.createTime as string || "";
        break;
      case "instagram":
        url = r.url as string || `https://instagram.com/p/${r.shortCode}` || "";
        description = r.caption as string || "";
        publishedAt = r.timestamp as string || "";
        break;
      case "youtube":
        url = r.url as string || `https://youtube.com/watch?v=${r.id}` || "";
        title = r.title as string || "";
        description = r.description as string || r.descriptionSnippet as string || "";
        publishedAt = r.date as string || r.uploadDate as string || "";
        break;
      case "reddit":
        url = r.url as string || "";
        title = r.title as string || "";
        description = r.body as string || r.selftext as string || "";
        publishedAt = r.createdAt as string || "";
        break;
      case "linkedin":
        url = r.postUrl as string || r.url as string || "";
        description = r.text as string || r.commentary as string || "";
        publishedAt = r.postedAt as string || r.postedDate as string || "";
        break;
    }

    return {
      url,
      title,
      description,
      source_domain: platform,
      published_at: publishedAt,
    };
  }).filter(r => r.url);
}
