import { enrichWithDate } from "../_shared/normalize.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, options } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching:', query, 'Options:', JSON.stringify(options || {}));

    // Build request body - NOTE: tbs temporal filter often returns 0 results in Firecrawl
    // We request more results and let the client filter by date if needed
    const requestBody: Record<string, unknown> = {
      query,
      limit: Math.min((options?.limit || 15) * 2, 50), // Request extra to compensate for client-side filtering
      lang: options?.lang || 'es',
      country: options?.country || 'MX',
    };

    // Only add tbs if explicitly requested, but warn that it may not work reliably
    if (options?.tbs) {
      console.log('Warning: tbs temporal filter may return 0 results. Using fallback strategy.');
      // Try with tbs first, but we'll retry without it if we get 0 results
    }

    // Scrape options if requested
    if (options?.scrapeOptions) {
      requestBody.scrapeOptions = options.scrapeOptions;
    }

    // First attempt: try with tbs if provided
    let response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...requestBody,
        ...(options?.tbs ? { tbs: options.tbs } : {}),
      }),
    });

    let data = await response.json();

    // If tbs was used and returned 0 results, retry without tbs
    if (options?.tbs && response.ok && (!data.data || data.data.length === 0)) {
      console.log('tbs filter returned 0 results, retrying without temporal filter...');
      
      response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      data = await response.json();
      
      if (data.data && data.data.length > 0) {
        console.log('Fallback successful, found', data.data.length, 'results (without temporal filter)');
        // Add a warning so the client knows temporal filtering wasn't applied server-side
        data.warning = 'Temporal filter not applied server-side. Results may include older content.';
        data.tbsFallbackUsed = true;
      }
    }

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Search successful, found', data.data?.length || 0, 'results');

    // Enrich each result with publishedAt + dateConfidence parsed from
    // metadata or snippet. Preserves original metadata for downstream use.
    if (Array.isArray(data.data)) {
      data.data = data.data.map((r: Record<string, unknown>) => {
        const enriched = enrichWithDate({
          title: r.title as string,
          description: r.description as string,
          metadata: r.metadata as Record<string, unknown>,
        });
        return {
          ...r,
          publishedAt: enriched.publishedAt,
          dateConfidence: enriched.dateConfidence,
        };
      });
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
