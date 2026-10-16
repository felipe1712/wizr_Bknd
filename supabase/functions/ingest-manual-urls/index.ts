// Ingestión manual de URLs: inicia scraping asíncrono por plataforma para evitar el timeout de 150s.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;

type Platform = "facebook" | "instagram" | "tiktok" | "twitter";

type BatchUrl = {
  original: string;
  resolved: string;
};

const ACTOR_MAP: Record<Platform, string> = {
  facebook: "apify~facebook-posts-scraper",
  instagram: "apify~instagram-scraper",
  tiktok: "clockworks~tiktok-scraper",
  twitter: "apidojo~tweet-scraper",
};

function detectPlatform(url: string): Platform | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (h.includes("facebook.com") || h.includes("fb.com") || h.includes("fb.watch")) return "facebook";
    if (h.includes("instagram.com")) return "instagram";
    if (h.includes("tiktok.com")) return "tiktok";
    if (h.includes("twitter.com") || h.includes("x.com")) return "twitter";
  } catch {}
  return null;
}

async function tryFetchCanonical(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
    });
    const finalUrl = resp.url;
    if (finalUrl && finalUrl !== url && !/login|checkpoint|\/help\//i.test(finalUrl)) {
      return finalUrl.replace(/^https?:\/\/(m|mbasic|mobile)\.facebook\.com/, "https://www.facebook.com");
    }
    const html = await resp.text();
    const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    if (canon?.[1]) return canon[1];
    const og = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
    if (og?.[1]) return og[1];
  } catch (_) { /* ignore */ }
  return null;
}

async function resolveShareUrl(url: string): Promise<string> {
  try {
    const isFbShare = /facebook\.com\/share\//i.test(url);
    const isTtShort = /^https?:\/\/(vt|vm)\.tiktok\.com\//i.test(url);
    if (!isFbShare && !isTtShort) return url;

    // Para Facebook share/ probamos primero mbasic (sin login wall) y luego www.
    const candidates: string[] = [];
    if (isFbShare) {
      candidates.push(url.replace(/^https?:\/\/(www\.)?facebook\.com/, "https://mbasic.facebook.com"));
      candidates.push(url.replace(/^https?:\/\/(www\.)?facebook\.com/, "https://m.facebook.com"));
    }
    candidates.push(url);

    for (const c of candidates) {
      const resolved = await tryFetchCanonical(c);
      if (resolved && !/facebook\.com\/share\//i.test(resolved) && !/login|checkpoint/i.test(resolved)) {
        return resolved;
      }
    }
  } catch (e) {
    console.warn("resolveShareUrl failed", url, String(e));
  }
  return url;
}

function buildInput(platform: Platform, urls: string[]) {
  switch (platform) {
    case "facebook":
      return { startUrls: urls.map((url) => ({ url })), resultsLimit: Math.max(urls.length, 1) };
    case "instagram":
      return { directUrls: urls, resultsType: "posts", resultsLimit: Math.max(urls.length, 1), addParentData: false };
    case "tiktok":
      return { postURLs: urls, resultsPerPage: Math.max(urls.length, 1), shouldDownloadVideos: false };
    case "twitter":
      return { startUrls: urls, maxItems: Math.max(urls.length, 1) };
  }
}

async function startApifyRun(platform: Platform, urls: string[]) {
  const actorId = ACTOR_MAP[platform];
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&waitForFinish=2`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildInput(platform, urls)),
    signal: AbortSignal.timeout(12000),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Apify ${actorId} ${resp.status}: ${t.slice(0, 300)}`);
  }

  const json = await resp.json();
  const run = json?.data || json;
  if (!run?.id) throw new Error(`Apify no devolvió runId para ${platform}`);
  return {
    platform,
    runId: run.id,
    datasetId: run.defaultDatasetId || null,
    status: run.status || "RUNNING",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id, urls } = await req.json();
    if (!project_id || !Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({ error: "project_id and urls[] required" }), {
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

    const grouped: Record<Platform, BatchUrl[]> = { facebook: [], instagram: [], tiktok: [], twitter: [] };
    const skipped: Array<{ url: string; status: "skipped"; reason: string }> = [];

    const normalizedUrls = Array.from(new Set(urls.map((raw: unknown) => String(raw || "").trim()).filter(Boolean)));
    const resolvedEntries = await Promise.all(normalizedUrls.map(async (u) => {
      const platform = detectPlatform(u);
      if (!platform) return { original: u, skipped: "plataforma no detectada" };
      const resolved = await resolveShareUrl(u);
      return { original: u, resolved, platform: detectPlatform(resolved) || platform };
    }));

    for (const entry of resolvedEntries) {
      if (entry.skipped || !entry.platform || !entry.resolved) {
        skipped.push({ url: entry.original, status: "skipped", reason: entry.skipped || "URL inválida" });
        continue;
      }
      grouped[entry.platform].push({ original: entry.original, resolved: entry.resolved });
    }

    const jobs: Array<{ platform: Platform; runId: string; datasetId: string | null; status: string; batch: BatchUrl[] }> = [];
    const failed: Array<{ url: string; status: "failed"; reason: string }> = [];

    await Promise.all((Object.keys(grouped) as Platform[]).map(async (platform) => {
      const batch = grouped[platform];
      if (batch.length === 0) return;
      try {
        const run = await startApifyRun(platform, batch.map((b) => b.resolved));
        jobs.push({ ...run, batch });
      } catch (e: any) {
        for (const { original } of batch) {
          failed.push({ url: original, status: "failed", reason: `apify start: ${String(e?.message || e).slice(0, 200)}` });
        }
      }
    }));

    const results = [...skipped, ...failed];
    const summary = {
      queued: jobs.reduce((sum, job) => sum + job.batch.length, 0),
      failed: failed.length,
      skipped: skipped.length,
    };

    return new Response(JSON.stringify({ ok: true, mode: "async", project_id, jobs, results, summary }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ingest-manual-urls start error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
