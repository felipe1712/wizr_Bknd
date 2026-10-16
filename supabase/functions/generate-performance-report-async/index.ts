import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

declare const EdgeRuntime: {
  waitUntil?: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PayloadSchema = z.object({
  reportMode: z.enum(["brand", "benchmark"]),
  clientName: z.string().min(1),
  brandName: z.string().optional(),
  strategicFocus: z.string().optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
    label: z.string(),
  }),
  profiles: z.array(z.record(z.any())).min(1),
  kpis: z.array(z.record(z.any())).default([]),
  topPosts: z.array(z.record(z.any())).default([]),
  analytics: z.record(z.any()),
});

const CreateSchema = z.object({
  action: z.literal("create"),
  payload: PayloadSchema,
});

const StatusSchema = z.object({
  action: z.literal("status"),
  jobId: z.string().uuid(),
});

async function getClients(req: Request) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase credentials not configured");
  }

  const authHeader = req.headers.get("authorization") || "";

  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  return { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, authedClient, serviceClient };
}

async function requireUser(req: Request) {
  const { authedClient } = await getClients(req);
  const { data, error } = await authedClient.auth.getUser();

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  return data.user;
}

async function processJob(
  jobId: string,
  payload: z.infer<typeof PayloadSchema>,
  supabaseUrl: string,
  serviceRoleKey: string,
  serviceClient: ReturnType<typeof createClient>,
) {
  try {
    await (serviceClient as any)
      .from("smart_report_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
      })
      .eq("id", jobId);

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-performance-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    if (!response.ok) {
      let errorMessage = `Report generation failed with status ${response.status}`;
      try {
        const parsed = JSON.parse(text);
        errorMessage = parsed.error || errorMessage;
      } catch {
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }

    const result = JSON.parse(text);

    await (serviceClient as any)
      .from("smart_report_jobs")
      .update({
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);
  } catch (error) {
    await (serviceClient as any)
      .from("smart_report_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (body?.action === "status") {
      const parsed = StatusSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const user = await requireUser(req);
      const { serviceClient } = await getClients(req);

      const { data, error } = await (serviceClient as any)
        .from("smart_report_jobs")
        .select("id, status, result, error_message")
        .eq("id", parsed.data.jobId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        jobId: data.id,
        status: data.status,
        result: data.result,
        error: data.error_message,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await requireUser(req);
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, serviceClient } = await getClients(req);

    const { data: job, error } = await (serviceClient as any)
      .from("smart_report_jobs")
      .insert({
        user_id: user.id,
        status: "pending",
        request_payload: parsed.data.payload,
      })
      .select("id")
      .single();

    if (error) throw error;

    const work = processJob(
      job.id,
      parsed.data.payload,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      serviceClient,
    );

    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      EdgeRuntime.waitUntil(work);
    } else {
      void work;
    }

    return new Response(JSON.stringify({ jobId: job.id, status: "pending" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});