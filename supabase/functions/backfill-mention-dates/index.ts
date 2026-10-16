// Backfills published_at on mentions by scraping the source URL with Firecrawl
// and extracting a publication date from page metadata / common date selectors.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface Mention {
  id: string;
  url: string;
  source_domain: string | null;
  raw_metadata: any;
}

function pickDate(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  const candidates = [
    obj.publishedTime, obj.published_time, obj.publishedAt, obj.published_at,
    obj.datePublished, obj.date_published, obj.articlePublishedTime,
    obj["article:published_time"], obj["og:published_time"], obj.pubdate,
    obj.date, obj.modifiedTime, obj.dateModified,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length >= 8) {
      const d = new Date(c);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
        return d.toISOString();
      }
    }
  }
  return null;
}

function extractFromHtml(html: string): string | null {
  if (!html) return null;
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']publishdate["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /"uploadDate"\s*:\s*"([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
        return d.toISOString();
      }
    }
  }
  return null;
}

async function scrapeDate(url: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data ?? json;
    const fromMeta = pickDate(data?.metadata);
    if (fromMeta) return fromMeta;
    return extractFromHtml(data?.rawHtml || data?.html || "");
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id, limit = 100 } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: mentions, error } = await supabase
      .from("mentions")
      .select("id, url, source_domain, raw_metadata")
      .eq("project_id", project_id)
      .is("published_at", null)
      .limit(limit);

    if (error) throw error;

    // Firecrawl no soporta FB/IG (responde 4xx "we do not support this site")
    // y para X/TikTok devuelve HTML sin fecha útil. Solo medios digitales.
    const SKIP_DOMAINS = ["facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com"];
    const eligible = (mentions as Mention[]).filter(
      (m) => m.url && !SKIP_DOMAINS.some((d) => (m.source_domain || "").includes(d))
    );

    let updated = 0, failed = 0, skipped = mentions.length - eligible.length;
    const CONCURRENCY = 5;

    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const batch = eligible.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (m) => {
        const date = await scrapeDate(m.url, apiKey);
        if (!date) return { id: m.id, ok: false };
        const { error: upErr } = await supabase
          .from("mentions")
          .update({ published_at: date })
          .eq("id", m.id);
        return { id: m.id, ok: !upErr };
      }));
      for (const r of results) r.ok ? updated++ : failed++;
    }

    return new Response(
      JSON.stringify({ total: mentions.length, eligible: eligible.length, updated, failed, skipped_social: skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
