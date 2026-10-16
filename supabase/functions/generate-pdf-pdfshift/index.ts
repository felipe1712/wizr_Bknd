import { corsHeaders } from "npm:@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[pdfshift] request received, content-length:", req.headers.get("content-length"));
    const body = await req.json();
    const { html, filename, header, footer, landscape, format: pageFormat } = body as {
      html?: string;
      filename?: string;
      header?: { source: string; height: string; start_at?: number };
      footer?: { source: string; height: string; start_at?: number };
      landscape?: boolean;
      format?: string;
    };
    console.log("[pdfshift] html length:", html?.length, "filename:", filename, "landscape:", landscape, "format:", pageFormat);

    if (!html) throw new Error("No HTML provided");

    const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");
    if (!PDFSHIFT_API_KEY) throw new Error("PDFSHIFT_API_KEY not configured");

    // header/footer.height MUST include unit ("28mm"). PDFShift treats unit-less
    // numbers as mm — that's what was breaking the layout.
    const payload: Record<string, unknown> = {
      source: html,
      landscape: landscape ?? false,
      use_print: true,
      format: pageFormat ?? "A4",
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    };
    if (header && header.source && header.height) {
      payload.header = {
        source: header.source,
        height: header.height,
        start_at: header.start_at ?? 1,
      };
    }
    if (footer && footer.source && footer.height) {
      payload.footer = {
        source: footer.source,
        height: footer.height,
        start_at: footer.start_at ?? 1,
      };
    }

    const response = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${PDFSHIFT_API_KEY}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PDFShift error: ${response.status} — ${err}`);
    }

    const pdfBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    return new Response(JSON.stringify({ pdf: pdfBase64, filename: filename || "reporte.pdf" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[pdfshift] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
