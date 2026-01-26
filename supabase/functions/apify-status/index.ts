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

    const { runId } = await req.json();

    if (!runId) {
      throw new Error("runId is required");
    }

    // Get run status
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Apify status error:", errorText);
      throw new Error(`Failed to get run status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.data.status;
    const datasetId = statusData.data.defaultDatasetId;

    console.log(`Run ${runId} status: ${status}`);

    let items: unknown[] = [];

    // If the run is finished, get the results
    if (status === "SUCCEEDED" && datasetId) {
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=100`
      );

      if (datasetResponse.ok) {
        items = await datasetResponse.json();
        console.log(`Retrieved ${items.length} items from dataset`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        status,
        isFinished: ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status),
        items: status === "SUCCEEDED" ? items : [],
        stats: statusData.data.stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in apify-status:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
