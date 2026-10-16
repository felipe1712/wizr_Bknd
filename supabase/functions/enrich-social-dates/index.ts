// Enriquece mentions sin published_at (FB/IG/TikTok/X) usando Apify.
// Ejecutar manualmente desde la UI de Fuentes.
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

const DOMAIN_MAP: Record<string, Platform> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "m.facebook.com": "facebook",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "mobile.twitter.com": "twitter",
};

const ACTOR_MAP: Record<Platform, string> = {
  facebook: "apify~facebook-posts-scraper",
  instagram: "apify~instagram-post-scraper",
  tiktok: "clockworks~tiktok-scraper",
  twitter: "apidojo~tweet-scraper",
};

function platformFromUrl(url: string, fallback: string | null): Platform | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [d, p] of Object.entries(DOMAIN_MAP)) {
      if (host === d || host.endsWith("." + d)) return p;
    }
  } catch {}
  if (fallback) {
    const lower = fallback.toLowerCase();
    if (lower.includes("facebook")) return "facebook";
    if (lower.includes("instagram")) return "instagram";
    if (lower.includes("tiktok")) return "tiktok";
    if (lower.includes("twitter") || lower === "x") return "twitter";
  }
  return null;
}

function buildActorInput(platform: Platform, urls: string[]) {
  switch (platform) {
    case "facebook":
      return { startUrls: urls.map((url) => ({ url })), resultsLimit: urls.length };
    case "instagram":
      return { directUrls: urls, resultsLimit: urls.length, addParentData: false };
    case "tiktok":
      return { postURLs: urls, resultsPerPage: urls.length, shouldDownloadVideos: false };
    case "twitter":
      return { startUrls: urls, maxItems: urls.length };
  }
}

function extractDate(platform: Platform, item: any): string | null {
  const candidates: any[] = [];
  switch (platform) {
    case "facebook":
      candidates.push(item.time, item.timestamp, item.publishedTime, item.date);
      break;
    case "instagram":
      candidates.push(item.timestamp, item.takenAtTimestamp, item.takenAt, item.publishedAt);
      break;
    case "tiktok":
      candidates.push(item.createTimeISO, item.createTime, item["createTime"], item.uploadedAt);
      break;
    case "twitter":
      candidates.push(item.createdAt, item.created_at, item.timestamp, item.date);
      break;
  }
  for (const c of candidates) {
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

function getItemUrl(platform: Platform, item: any): string | null {
  const u = item.url || item.postUrl || item.webVideoUrl || item.permalink || item.postLink || item.link;
  return typeof u === "string" ? u : null;
}

async function runApifySync(actorId: string, input: any): Promise<any[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=90`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Apify ${actorId} ${resp.status}: ${t.slice(0, 300)}`);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id, platforms, limit = 100, dry_run = false } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: pending, error: selErr } = await supabase
      .from("mentions")
      .select("id, url, source_domain, raw_metadata")
      .eq("project_id", project_id)
      .is("published_at", null)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (selErr) throw selErr;

    const grouped: Record<Platform, Array<{ id: string; url: string }>> = {
      facebook: [], instagram: [], tiktok: [], twitter: [],
    };

    for (const m of pending || []) {
      if (!m.url) continue;
      const meta = (m.raw_metadata as any) || {};
      if (meta.date_confidence === "unavailable") continue;
      const p = platformFromUrl(m.url, m.source_domain);
      if (!p) continue;
      if (platforms && Array.isArray(platforms) && !platforms.includes(p)) continue;
      grouped[p].push({ id: m.id, url: m.url });
    }

    const summary: Record<string, { scanned: number; updated: number; failed: number; unavailable: number; error?: string }> = {};
    let totalUpdated = 0;

    for (const platform of Object.keys(grouped) as Platform[]) {
      const batch = grouped[platform];
      summary[platform] = { scanned: batch.length, updated: 0, failed: 0, unavailable: 0 };
      if (batch.length === 0) continue;
      if (dry_run) continue;

      try {
        const urls = batch.map((b) => b.url);
        const items = await runApifySync(ACTOR_MAP[platform], buildActorInput(platform, urls.slice(0, 50)));
        const byUrl = new Map<string, any>();
        for (const it of items) {
          const u = getItemUrl(platform, it);
          if (u) byUrl.set(u, it);
        }

        const updates: Array<{ id: string; published_at: string; raw_metadata: any }> = [];
        const markUnavailable: string[] = [];

        for (const { id, url } of batch) {
          const item = byUrl.get(url) || [...byUrl.entries()].find(([k]) => url.includes(k.split("?")[0]) || k.includes(url.split("?")[0]))?.[1];
          if (!item) { markUnavailable.push(id); continue; }
          const iso = extractDate(platform, item);
          if (!iso) { markUnavailable.push(id); continue; }
          updates.push({
            id,
            published_at: iso,
            raw_metadata: { date_source: "apify_enrichment", date_confidence: "high", enriched_at: new Date().toISOString(), enriched_platform: platform },
          });
        }

        for (const u of updates) {
          const { error: updErr } = await supabase
            .from("mentions")
            .update({ published_at: u.published_at, raw_metadata: u.raw_metadata })
            .eq("id", u.id);
          if (updErr) { summary[platform].failed++; continue; }
          summary[platform].updated++;
          totalUpdated++;
        }

        if (markUnavailable.length > 0) {
          for (const id of markUnavailable) {
            await supabase
              .from("mentions")
              .update({ raw_metadata: { date_source: "apify_enrichment", date_confidence: "unavailable", attempted_at: new Date().toISOString() } })
              .eq("id", id);
            summary[platform].unavailable++;
          }
        }

        await new Promise((r) => setTimeout(r, 2000));
      } catch (e: any) {
        summary[platform].error = String(e?.message || e).slice(0, 300);
        summary[platform].failed = batch.length;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, project_id, total_scanned: (pending || []).length, total_updated: totalUpdated, by_platform: summary, dry_run }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("enrich-social-dates error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
