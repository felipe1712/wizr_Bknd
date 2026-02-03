/**
 * Bright Data API client
 * Parallel implementation to Apify for A/B testing
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface BrightDataResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ScrapeStartResponse {
  success: boolean;
  runId?: string;
  datasetId?: string;
  status?: string;
  message?: string;
  error?: string;
  provider: "brightdata";
}

interface ScrapeStatusResponse {
  success: boolean;
  status: string;
  items?: unknown[];
  rawCount?: number;
  error?: string;
  provider: "brightdata";
}

async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = 30000
): Promise<BrightDataResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Edge function ${functionName} error:`, response.status, errorText);
      return {
        success: false,
        error: `Error ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Tiempo de espera agotado. Por favor intenta de nuevo.",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Error de conexión",
    };
  }
}

export const brightdataApi = {
  /**
   * Start a scraping job with Bright Data
   */
  async startScrape(params: {
    platform: string;
    jobId?: string;
    query?: string;
    username?: string;
    hashtag?: string;
    companyUrl?: string;
    channelUrl?: string;
    subreddit?: string;
    taggedUsername?: string;
    captionFilter?: string;
    maxResults?: number;
    searchType?: string;
  }): Promise<BrightDataResponse<ScrapeStartResponse>> {
    // Bright Data can occasionally be slow to ACK; keep a generous timeout.
    const result = await invokeEdgeFunction<ScrapeStartResponse>("brightdata-scrape", params, 180000);

    if (result.success && result.data) {
      return {
        success: result.data.success,
        data: result.data,
        error: result.data.error,
      };
    }

    return result;
  },

  /**
   * Check status of a running Bright Data job
   */
  async checkStatus(
    snapshotId: string,
    platform: string
  ): Promise<BrightDataResponse<ScrapeStatusResponse>> {
    const result = await invokeEdgeFunction<ScrapeStatusResponse>(
      "brightdata-status",
      { snapshotId, platform },
      30000
    );

    if (result.success && result.data) {
      return {
        success: true,
        data: result.data,
      };
    }

    return result;
  },
};

export type {
  ScrapeStartResponse,
  ScrapeStatusResponse,
  BrightDataResponse,
};
