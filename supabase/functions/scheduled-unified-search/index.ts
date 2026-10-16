import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeResults as normalizeShared, toMentionRow, enrichWithDate, type NormalizedResult, type Platform } from "../_shared/normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Entity {
  id: string;
  nombre: string;
  palabras_clave: string[];
  aliases: string[];
  platform_keywords: Record<string, string[]>;
}

interface Schedule {
  id: string;
  project_id: string;
  platforms: string[];
  max_results_per_platform: number;
  frequency: string;
  projects: { id: string; nombre: string } | null;
}

interface AlertConfig {
  id: string;
  project_id: string;
  name: string;
  alert_type: "sentiment_negative" | "mention_spike" | "keyword_match";
  threshold_percent: number | null;
  keywords: string[] | null;
  entity_ids: string[] | null;
  is_active: boolean;
  trigger_count: number;
}

interface SavedMention {
  id: string;
  project_id: string;
  entity_id: string | null;
  title: string | null;
  description: string | null;
  url: string;
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

    // Find all enabled schedules that are due
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

    // Collect all project IDs to fetch alert configs in one query
    const allProjectIds = (schedules as Schedule[]).map(s => s.project_id);

    // Fetch alert configs for all projects at once
    const { data: alertConfigs } = await supabase
      .from("alert_configs")
      .select("*")
      .in("project_id", allProjectIds)
      .eq("is_active", true);

    // Fetch previous mention counts for spike detection (last 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { data: recentMentionCounts } = await supabase
      .from("mentions")
      .select("project_id")
      .in("project_id", allProjectIds)
      .gte("created_at", yesterday.toISOString());

    const previousCounts = new Map<string, number>();
    for (const m of recentMentionCounts || []) {
      previousCounts.set(m.project_id, (previousCounts.get(m.project_id) || 0) + 1);
    }

    const results: Array<{
      projectId: string;
      projectName: string;
      success: boolean;
      mentionsFound: number;
      mentionsSaved: number;
      alertsTriggered: number;
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
          .select("id, nombre, palabras_clave, aliases, platform_keywords")
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
        const allSavedMentions: SavedMention[] = [];

        // Process each entity
        for (const entity of entities as Entity[]) {
          for (const platform of schedule.platforms) {
            const searchQuery = buildSearchQuery(entity, platform);
            try {
              let platformResults: Array<{
                url: string;
                title?: string;
                description?: string;
                source_domain?: string;
                published_at?: string;
                raw_metadata?: Record<string, unknown>;
              }> = [];

              if (platform === "news" && firecrawlKey) {
                platformResults = await searchNews(firecrawlKey, searchQuery, schedule.max_results_per_platform);
              } else if (apifyToken) {
                platformResults = await searchSocial(apifyToken, platform, searchQuery, schedule.max_results_per_platform);
              }

              totalMentionsFound += platformResults.length;

              if (platformResults.length > 0) {
                // Post-validate: only keep results whose content actually mentions a keyword
                const relevantResults = platformResults.filter(r => r.url && contentMatchesKeywords(r, entity));
                const filtered = platformResults.length - relevantResults.length;
                if (filtered > 0) {
                  console.log(`  ${entity.nombre}/${platform}: filtered ${filtered}/${platformResults.length} irrelevant results`);
                }

                const mentionsToSave = relevantResults
                  .map(r => ({
                    project_id: schedule.project_id,
                    url: r.url,
                    title: r.title || null,
                    description: r.description || null,
                    source_domain: r.source_domain || platform,
                    entity_id: entity.id,
                    matched_keywords: entity.palabras_clave || [],
                    published_at: r.published_at || null,
                    raw_metadata: r.raw_metadata || {},
                  }));

                if (mentionsToSave.length > 0) {
                  const { error: saveError, data: savedData } = await supabase
                    .from("mentions")
                    .upsert(mentionsToSave, {
                      onConflict: "project_id,url",
                      ignoreDuplicates: true,
                    })
                    .select("id, project_id, entity_id, title, description, url");

                  if (!saveError && savedData) {
                    totalMentionsSaved += savedData.length;
                    allSavedMentions.push(...savedData);
                  }
                }
              }

              console.log(`  ${entity.nombre} on ${platform}: ${platformResults.length} results`);
            } catch (platformError) {
              console.error(`Error searching ${platform} for ${entity.nombre}:`, platformError);
            }
          }
        }

        // === ALERT EVALUATION ===
        const projectAlerts = (alertConfigs || []).filter(
          (c: AlertConfig) => c.project_id === schedule.project_id && c.is_active
        );

        const alertsTriggered = await evaluateAndCreateAlerts(
          supabase,
          projectAlerts as AlertConfig[],
          allSavedMentions,
          schedule.project_id,
          previousCounts.get(schedule.project_id) || 0,
          totalMentionsSaved
        );

        // Update schedule after successful run
        await updateScheduleAfterRun(supabase, schedule.id, schedule.frequency, null);

        results.push({
          projectId: schedule.project_id,
          projectName,
          success: true,
          mentionsFound: totalMentionsFound,
          mentionsSaved: totalMentionsSaved,
          alertsTriggered,
        });

        console.log(`Project ${projectName}: ${totalMentionsFound} found, ${totalMentionsSaved} saved, ${alertsTriggered} alerts`);
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
          alertsTriggered: 0,
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

// ==================== ALERT EVALUATION ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evaluateAndCreateAlerts(
  supabase: any,
  alertConfigs: AlertConfig[],
  newMentions: SavedMention[],
  projectId: string,
  previousMentionCount: number,
  currentNewCount: number
): Promise<number> {
  if (alertConfigs.length === 0 || newMentions.length === 0) return 0;

  const triggered: Array<{ config: AlertConfig; reason: string; mentionCount: number; sampleUrls: string[] }> = [];

  for (const config of alertConfigs) {
    // Filter by entity if specified
    const relevantMentions = config.entity_ids && config.entity_ids.length > 0
      ? newMentions.filter(m => m.entity_id && config.entity_ids!.includes(m.entity_id))
      : newMentions;

    if (relevantMentions.length === 0) continue;

    switch (config.alert_type) {
      case "keyword_match": {
        if (!config.keywords || config.keywords.length === 0) continue;

        const matched = relevantMentions.filter(mention => {
          const content = `${mention.title || ""} ${mention.description || ""}`.toLowerCase();
          return config.keywords!.some(kw => content.includes(kw.toLowerCase()));
        });

        if (matched.length > 0) {
          triggered.push({
            config,
            reason: `Se encontraron ${matched.length} menciones con palabras clave monitoreadas`,
            mentionCount: matched.length,
            sampleUrls: matched.slice(0, 3).map(m => m.url),
          });
        }
        break;
      }

      case "mention_spike": {
        const threshold = config.threshold_percent || 50;
        const percentIncrease = previousMentionCount > 0
          ? ((currentNewCount - previousMentionCount) / previousMentionCount) * 100
          : currentNewCount > 0 ? 100 : 0;

        if (percentIncrease >= threshold) {
          triggered.push({
            config,
            reason: `Incremento de ${percentIncrease.toFixed(0)}% en menciones (umbral: ${threshold}%)`,
            mentionCount: relevantMentions.length,
            sampleUrls: relevantMentions.slice(0, 3).map(m => m.url),
          });
        }
        break;
      }

      case "sentiment_negative": {
        if (relevantMentions.length >= 3) {
          triggered.push({
            config,
            reason: `${relevantMentions.length} nuevas menciones requieren análisis de sentimiento`,
            mentionCount: relevantMentions.length,
            sampleUrls: relevantMentions.slice(0, 3).map(m => m.url),
          });
        }
        break;
      }
    }
  }

  if (triggered.length === 0) return 0;

  // Create notifications
  const notifications = triggered.map(t => ({
    alert_config_id: t.config.id,
    project_id: projectId,
    title: `Alerta: ${t.config.name}`,
    message: t.reason,
    severity: t.config.alert_type === "sentiment_negative" ? "error" : "warning",
    metadata: {
      mention_count: t.mentionCount,
      sample_urls: t.sampleUrls,
    },
  }));

  const { error: notifError } = await supabase
    .from("alert_notifications")
    .insert(notifications);

  if (notifError) {
    console.error("Error creating alert notifications:", notifError);
    return 0;
  }

  // Update trigger counts
  for (const t of triggered) {
    await supabase
      .from("alert_configs")
      .update({
        trigger_count: t.config.trigger_count + 1,
        last_triggered_at: new Date().toISOString(),
      })
      .eq("id", t.config.id);
  }

  console.log(`Created ${triggered.length} alert notifications for project ${projectId}`);
  return triggered.length;
}

// ==================== SCHEDULE HELPERS ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateScheduleAfterRun(
  supabase: any,
  scheduleId: string,
  frequency: string,
  error: string | null
) {
  const now = new Date();
  const nextRun = calculateNextRun(frequency, now);

  // First get current run_count
  const { data: current } = await supabase
    .from("project_search_schedules")
    .select("run_count")
    .eq("id", scheduleId)
    .single();

  await supabase
    .from("project_search_schedules")
    .update({
      last_run_at: now.toISOString(),
      next_run_at: nextRun.toISOString(),
      last_error: error,
      run_count: (current?.run_count || 0) + 1,
    })
    .eq("id", scheduleId);
}

function calculateNextRun(frequency: string, fromTime: Date): Date {
  const next = new Date(fromTime);
  switch (frequency) {
    case "hourly":
      next.setHours(next.getHours() + 1);
      break;
    case "every_3_hours":
      next.setHours(next.getHours() + 3);
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

// ==================== RELEVANCE FILTER ====================

/**
 * Post-validates that a mention's content actually contains at least one
 * of the entity's keywords. Prevents false positives from scrapers that
 * return tangentially related results.
 */
function contentMatchesKeywords(
  item: { title?: string; description?: string; url?: string },
  entity: Entity
): boolean {
  const text = [item.title, item.description, item.url]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text) return false;

  // Collect all keywords: nombre, aliases, palabras_clave
  const keywords: string[] = [
    entity.nombre,
    ...entity.aliases,
    ...entity.palabras_clave,
  ].filter(Boolean);

  // Also include platform_keywords values (flattened)
  if (entity.platform_keywords && typeof entity.platform_keywords === "object") {
    for (const vals of Object.values(entity.platform_keywords as Record<string, string[]>)) {
      if (Array.isArray(vals)) keywords.push(...vals);
    }
  }

  // At least one keyword (2+ chars) must appear in the text
  return keywords
    .filter(k => k.length >= 2)
    .some(keyword => text.includes(keyword.toLowerCase()));
}

// ==================== SEARCH FUNCTIONS ====================

function buildSearchQuery(entity: Entity, platform?: string): string {
  if (platform && entity.platform_keywords && entity.platform_keywords[platform]?.length > 0) {
    return entity.platform_keywords[platform].join(" OR ");
  }
  if (entity.palabras_clave && entity.palabras_clave.length > 0) {
    return entity.palabras_clave.join(" OR ");
  }
  const terms = [entity.nombre, ...entity.aliases].filter(Boolean);
  return terms.join(" OR ");
}

async function searchNews(
  apiKey: string,
  query: string,
  maxResults: number
): Promise<Array<{ url: string; title?: string; description?: string; source_domain?: string; published_at?: string; raw_metadata?: Record<string, unknown> }>> {
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
    return (data.data || []).map((r: Record<string, unknown>) => {
      const enriched = enrichWithDate({
        title: r.title as string,
        description: r.description as string,
        metadata: r.metadata as Record<string, unknown>,
      });
      return {
        url: r.url as string,
        title: r.title as string,
        description: r.description as string,
        source_domain: r.url ? new URL(r.url as string).hostname.replace("www.", "") : undefined,
        published_at: enriched.publishedAt || undefined,
        raw_metadata: { date_confidence: enriched.dateConfidence, date_source: enriched.publishedAt ? (enriched.dateConfidence === "high" ? "firecrawl_metadata" : "snippet_parse") : "missing" },
      };
    });
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
): Promise<Array<{ url: string; title?: string; description?: string; source_domain?: string; published_at?: string; raw_metadata?: Record<string, unknown> }>> {
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

        const rawItems = await resultsResponse.json();

        // Use the shared canonical normalizer for rich metadata
        const normalized = normalizeShared(rawItems, platform as Platform);

        return normalized.filter(r => r.url).map(r => ({
          url: r.url,
          title: r.title,
          description: r.description,
          source_domain: r.platform,
          published_at: r.publishedAt,
          raw_metadata: {
            author: r.author,
            metrics: r.metrics,
            contentType: r.contentType,
            media: r.media,
            hashtags: r.hashtags,
            mentions: r.mentions,
          },
        }));
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
