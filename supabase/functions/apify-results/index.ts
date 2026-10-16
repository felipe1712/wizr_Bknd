import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  normalizeResults,
  calculateAggregateMetrics,
  type Platform,
} from "../_shared/normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN is not configured");
    }

    const { datasetId, platform = "twitter", offset = 0, limit = 100 } = await req.json();

    if (!datasetId) {
      throw new Error("datasetId is required");
    }

    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&offset=${offset}&limit=${limit}`
    );

    if (!datasetResponse.ok) {
      const errorText = await datasetResponse.text();
      console.error("Apify dataset error:", errorText);
      throw new Error(`Failed to get dataset items: ${datasetResponse.status}`);
    }

    const rawItems = await datasetResponse.json();
    const normalizedItems = normalizeResults(rawItems, platform as Platform);
    const aggregateMetrics = calculateAggregateMetrics(normalizedItems);

    console.log(`Retrieved and normalized ${normalizedItems.length} items from dataset ${datasetId} (platform: ${platform})`);

    return new Response(
      JSON.stringify({
        success: true,
        datasetId,
        platform,
        items: normalizedItems,
        rawItems,
        count: normalizedItems.length,
        offset,
        limit,
        aggregateMetrics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apify-results:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
