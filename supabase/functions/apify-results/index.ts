import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { datasetId, offset = 0, limit = 100 } = await req.json();

    if (!datasetId) {
      throw new Error("datasetId is required");
    }

    // Get dataset items
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&offset=${offset}&limit=${limit}`
    );

    if (!datasetResponse.ok) {
      const errorText = await datasetResponse.text();
      console.error("Apify dataset error:", errorText);
      throw new Error(`Failed to get dataset items: ${datasetResponse.status}`);
    }

    const items = await datasetResponse.json();

    console.log(`Retrieved ${items.length} items from dataset ${datasetId}`);

    return new Response(
      JSON.stringify({
        success: true,
        datasetId,
        items,
        count: items.length,
        offset,
        limit,
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
