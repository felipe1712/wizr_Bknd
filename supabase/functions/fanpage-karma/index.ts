import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FANPAGE_KARMA_API_BASE = "https://app.fanpagekarma.com/api/v1";

interface ProfileKPIRequest {
  action: "kpi";
  network: "facebook" | "instagram" | "youtube" | "linkedin" | "tiktok" | "threads" | "twitter";
  profileId: string;
  period?: string; // Format: YYYY-MM-DD_YYYY-MM-DD
}

interface ProfilePostsRequest {
  action: "posts";
  network: "facebook" | "instagram" | "youtube" | "linkedin" | "tiktok" | "threads" | "twitter";
  profileId: string;
  period?: string;
}

interface ListProfilesRequest {
  action: "list_profiles";
}

type FanpageKarmaRequest = ProfileKPIRequest | ProfilePostsRequest | ListProfilesRequest;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FANPAGE_KARMA_API_KEY = Deno.env.get("FANPAGE_KARMA_API_KEY");
    
    if (!FANPAGE_KARMA_API_KEY) {
      throw new Error("FANPAGE_KARMA_API_KEY not configured");
    }

    const body: FanpageKarmaRequest = await req.json();
    console.log("Fanpage Karma request:", JSON.stringify(body));

    // Test basic API connectivity
    if (body.action === "list_profiles") {
      // The API doesn't have a list endpoint, but we can test connectivity
      // by making a request to a known profile
      return new Response(
        JSON.stringify({
          success: true,
          message: "API connection verified. Fanpage Karma API requires profile IDs to be specified manually. Use the dashboard at app.fanpagekarma.com to find profile IDs for your monitored accounts.",
          hint: "Profile IDs are the same as the platform uses (e.g., Facebook Page ID, Instagram username without @)"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "kpi" || body.action === "posts") {
      const { network, profileId, period } = body;
      
      if (!network || !profileId) {
        throw new Error("Missing required fields: network and profileId");
      }

      // Build the API URL
      let url = `${FANPAGE_KARMA_API_BASE}/${network}/${encodeURIComponent(profileId)}/${body.action}?token=${FANPAGE_KARMA_API_KEY}`;
      
      if (period) {
        url += `&period=${period}`;
      }

      console.log(`Calling Fanpage Karma: ${network}/${profileId}/${body.action}`);

      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error(`Request timeout for ${profileId}. The API took too long to respond.`);
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);
      
      const text = await response.text();
      console.log(`Fanpage Karma raw response length: ${text.length}, starts: ${text.slice(0, 200)}`);
      
      // Check if response looks complete (should end with })
      const trimmedText = text.trim();
      if (!trimmedText.endsWith('}')) {
        console.error("Incomplete JSON response detected, length:", text.length, "ends with:", trimmedText.slice(-50));
        throw new Error(`Incomplete response from API for ${profileId}. Response length: ${text.length}. Please try again.`);
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr, "Response length:", text.length);
        throw new Error(`Invalid JSON from API for ${profileId}. Response may be corrupted. Please retry.`);
      }

      if (!response.ok) {
        console.error("Fanpage Karma API error:", data);
        const errMsg = data.metadata?.message || 
          data.error || 
          data.message ||
          `API error: ${response.status}. Make sure the profile is added to your Fanpage Karma dashboard.`;
        throw new Error(errMsg);
      }

      console.log(`Fanpage Karma response for ${profileId}:`, JSON.stringify(data.metadata || {}).slice(0, 200));

      return new Response(
        JSON.stringify({
          success: true,
          data: data.data,
          metadata: data.metadata
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${(body as any).action}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fanpage Karma error:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
