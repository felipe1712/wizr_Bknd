// Consulta runs asíncronos de Apify y crea/actualiza mentions cuando terminan.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Platform = "facebook" | "instagram" | "tiktok" | "twitter";

type BatchUrl = {
  original: string;
  resolved: string;
};

type IngestJob = {
  platform: Platform;
  runId: string;
  datasetId?: string | null;
  status?: string;
  batch: BatchUrl[];
  processed?: boolean;
  processedResults?: Array<Record<string, unknown>>;
};

const DOMAIN_TO_SOURCE: Record<Platform, string> = {
  facebook: "facebook.com",
  instagram: "instagram.com",
  tiktok: "tiktok.com",
  twitter: "x.com",
};

function isTerminal(status: string) {
  return ["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(status);
}

function itemUrl(it: any): string | null {
  return it.url || it.postUrl || it.webVideoUrl || it.permalink || it.postLink || it.link || it.shareUrl || null;
}

function extractDate(platform: Platform, it: any): string | null {
  const list: any[] = (() => {
    switch (platform) {
      case "facebook": return [it.time, it.timestamp, it.publishedTime, it.date];
      case "instagram": return [it.timestamp, it.takenAtTimestamp, it.takenAt];
      case "tiktok": return [it.createTimeISO, it.createTime];
      case "twitter": return [it.createdAt, it.created_at, it.timestamp];
    }
  })();
  for (const c of list) {
    if (c == null) continue;
    if (typeof c === "number") {
      const ms = c > 1e12 ? c : c * 1000;
      return new Date(ms).toISOString();
    }
    if (typeof c === "string") {
      const d = new Date(c);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

function extractText(platform: Platform, it: any): { title: string | null; description: string | null } {
  let txt: string | null = null;
  switch (platform) {
    case "facebook": txt = it.text || it.message || it.caption || it.postText || null; break;
    case "instagram": txt = it.caption || it.text || null; break;
    case "tiktok": txt = it.text || it.desc || null; break;
    case "twitter": txt = it.text || it.fullText || null; break;
  }
  if (!txt) return { title: null, description: null };
  const clean = String(txt).trim();
  return { title: clean.slice(0, 140), description: clean };
}

function extractEngagement(_platform: Platform, it: any): { likes: number; comments: number; shares: number; views: number } {
  return {
    likes: Number(it.likes || it.likesCount || it.diggCount || it.favoriteCount || it.likeCount || 0) || 0,
    comments: Number(it.comments || it.commentsCount || it.commentCount || it.replyCount || 0) || 0,
    shares: Number(it.shares || it.sharesCount || it.shareCount || it.retweetCount || 0) || 0,
    views: Number(it.views || it.viewsCount || it.playCount || it.videoViewCount || 0) || 0,
  };
}

function extractAuthor(platform: Platform, it: any) {
  switch (platform) {
    case "facebook": return { name: it.user?.name || it.author || it.pageName || null, url: it.user?.profileUrl || it.pageUrl || null };
    case "instagram": return { name: it.ownerFullName || it.ownerUsername || null, url: it.ownerUsername ? `https://instagram.com/${it.ownerUsername}` : null };
    case "tiktok": return { name: it.authorMeta?.nickName || it.authorMeta?.name || null, url: it.authorMeta?.name ? `https://tiktok.com/@${it.authorMeta.name}` : null };
    case "twitter": return { name: it.author?.name || it.user?.name || null, url: it.author?.url || (it.author?.userName ? `https://x.com/${it.author.userName}` : null) };
  }
  return { name: null, url: null };
}

async function getApifyRun(runId: string) {
  const resp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Apify run ${runId} ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json?.data || json;
}

async function getDatasetItems(datasetId: string) {
  const resp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&format=json`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Apify dataset ${datasetId} ${resp.status}: ${t.slice(0, 200)}`);
  }
  return await resp.json();
}

function findMatchingItem(items: any[], original: string, resolved: string) {
  const indexed = items.map((it) => ({ it, u: (itemUrl(it) || "").replace(/\/+$/, "").split("?")[0].toLowerCase() }));
  const targets = [original, resolved].map((url) => url.replace(/\/+$/, "").split("?")[0].toLowerCase());
  let entry = indexed.find((x) => targets.includes(x.u));
  if (!entry) entry = indexed.find((x) => x.u && targets.some((target) => x.u.endsWith(target) || target.endsWith(x.u)));
  if (!entry) {
    const ids = targets.flatMap((target) => {
      const match = target.match(/\/(p|reel|status|video)\/([a-z0-9_-]+)/i) || target.match(/\/posts\/([a-z0-9_-]+)/i);
      return match ? [match[match.length - 1].toLowerCase()] : [];
    });
    if (ids.length > 0) entry = indexed.find((x) => ids.some((id) => x.u.includes(id)));
  }
  if (!entry && items.length === 1) entry = indexed[0];
  return entry?.it || null;
}

async function getMatchedKeywords(supabase: any, projectId: string) {
  const { data: ents } = await supabase
    .from("entities")
    .select("nombre, aliases, palabras_clave, platform_keywords")
    .eq("project_id", projectId)
    .eq("activo", true);

  const allKeywords = new Set<string>();
  for (const e of ents || []) {
    if (e.nombre) allKeywords.add(e.nombre);
    (e.aliases || []).forEach((a: string) => allKeywords.add(a));
    (e.palabras_clave || []).forEach((k: string) => allKeywords.add(k));
    const pk = (e.platform_keywords as any) || {};
    for (const arr of Object.values(pk)) {
      if (Array.isArray(arr)) arr.forEach((s) => typeof s === "string" && allKeywords.add(s));
    }
  }
  return Array.from(allKeywords).slice(0, 50);
}

async function upsertMention(supabase: any, projectId: string, matchedKeywords: string[], platform: Platform, item: any, original: string, resolved: string) {
  const publishedAt = extractDate(platform, item);
  const { title, description } = extractText(platform, item);
  const author = extractAuthor(platform, item);
  const eng = extractEngagement(platform, item);
  const canonicalUrl = itemUrl(item) || resolved;

  const raw_metadata = {
    ingestion_source: "manual_url_ingest",
    ingested_at: new Date().toISOString(),
    platform,
    author_name: author.name,
    author_url: author.url,
    engagement: eng,
    date_source: publishedAt ? "apify_manual" : "unavailable",
    date_confidence: publishedAt ? "high" : "unavailable",
    original_url: original !== canonicalUrl ? original : undefined,
    resolved_url: resolved !== original ? resolved : undefined,
    raw_item: item,
  };

  const uniqueUrls = Array.from(new Set([canonicalUrl, original, resolved].filter(Boolean)));
  const { data: existing } = await supabase
    .from("mentions")
    .select("id")
    .eq("project_id", projectId)
    .in("url", uniqueUrls)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      source_domain: DOMAIN_TO_SOURCE[platform],
      raw_metadata,
      is_archived: false,
      url: canonicalUrl,
    };
    if (title) updatePayload.title = title;
    if (description) updatePayload.description = description;
    if (publishedAt) updatePayload.published_at = publishedAt;

    const { error: updErr } = await supabase
      .from("mentions")
      .update(updatePayload)
      .eq("id", existing.id);
    if (updErr) throw updErr;
    return { url: original, status: "updated", mention_id: existing.id };
  }

  const { data: ins, error: insErr } = await supabase
    .from("mentions")
    .insert({
      project_id: projectId,
      url: canonicalUrl,
      title: title || `Post de ${platform}`,
      description: description || "",
      source_domain: DOMAIN_TO_SOURCE[platform],
      published_at: publishedAt,
      matched_keywords: matchedKeywords,
      raw_metadata,
      relevance_score: 1.0,
    })
    .select("id")
    .maybeSingle();
  if (insErr) throw insErr;
  if (!ins) return { url: original, status: "skipped", reason: "rechazado por filtro de relevancia" };
  return { url: original, status: "inserted", mention_id: ins.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id, jobs } = await req.json();
    if (!project_id || !Array.isArray(jobs)) {
      return new Response(JSON.stringify({ error: "project_id and jobs[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!APIFY_TOKEN) {
      return new Response(JSON.stringify({ error: "APIFY_API_TOKEN no está configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const results: Array<Record<string, unknown>> = [];
    const updatedJobs: IngestJob[] = [];
    let needsKeywords = false;
    let matchedKeywords: string[] = [];

    for (const job of jobs as IngestJob[]) {
      try {
        if (job.processed) {
          updatedJobs.push(job);
          results.push(...(job.processedResults || []));
          continue;
        }

        const run = await getApifyRun(job.runId);
        const status = run.status || job.status || "RUNNING";
        const datasetId = run.defaultDatasetId || job.datasetId || null;
        const nextJob = { ...job, status, datasetId };

        if (!isTerminal(status)) {
          updatedJobs.push(nextJob);
          continue;
        }

        const jobResults: Array<Record<string, unknown>> = [];

        if (status !== "SUCCEEDED" || !datasetId) {
          for (const { original } of job.batch || []) {
            jobResults.push({ url: original, status: "failed", reason: `Apify terminó con estado ${status}` });
          }
          results.push(...jobResults);
          updatedJobs.push({ ...nextJob, processed: true, processedResults: jobResults });
          continue;
        }

        const items = await getDatasetItems(datasetId);
        if (!needsKeywords) {
          matchedKeywords = await getMatchedKeywords(supabase, project_id);
          needsKeywords = true;
        }

        const batch = job.batch || [];
        const samePositional = items.length === batch.length;
        for (let i = 0; i < batch.length; i++) {
          const { original, resolved } = batch[i];
          let item = findMatchingItem(items, original, resolved);
          // Fallback: Apify devolvió misma cantidad de items que URLs enviadas → asume orden.
          if (!item && samePositional) item = items[i];
          if (!item) {
            jobResults.push({ url: original, status: "failed", reason: "Apify no devolvió contenido (post privado/borrado o URL no soportada)" });
            continue;
          }
          try {
            jobResults.push(await upsertMention(supabase, project_id, matchedKeywords, job.platform, item, original, resolved));
          } catch (e: any) {
            jobResults.push({ url: original, status: "failed", reason: String(e?.message || e).slice(0, 200) });
          }
        }
        results.push(...jobResults);
        updatedJobs.push({ ...nextJob, processed: true, processedResults: jobResults });
      } catch (e: any) {
        updatedJobs.push(job);
        for (const { original } of job.batch || []) {
          results.push({ url: original, status: "failed", reason: `consulta temporal: ${String(e?.message || e).slice(0, 180)}` });
        }
      }
    }

    const done = updatedJobs.every((job) => Boolean(job.processed) || isTerminal(String(job.status || "")));
    const summary = {
      inserted: results.filter((r) => r.status === "inserted").length,
      updated: results.filter((r) => r.status === "updated").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      running: updatedJobs.filter((job) => !isTerminal(String(job.status || ""))).length,
      completed: updatedJobs.filter((job) => isTerminal(String(job.status || ""))).length,
      total: updatedJobs.length,
    };

    return new Response(JSON.stringify({ ok: true, done, jobs: updatedJobs, results, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ingest-manual-urls-status error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
