/**
 * Apify API client with robust timeout handling
 * Uses native fetch with AbortController to prevent browser timeout issues
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface ApifyResponse<T = unknown> {
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
}

interface ScrapeStatusResponse {
  success: boolean;
  status: string;
  items?: unknown[];
  stats?: {
    pagesLoaded?: number;
    pagesQueued?: number;
    itemsFound?: number;
    requestsFinished?: number;
  };
  rawCount?: number; // Count before filtering
  aggregateMetrics?: Record<string, unknown>;
  error?: string;
}

interface ScrapeResultsResponse {
  success: boolean;
  items?: unknown[];
  totalCount?: number;
  hasMore?: boolean;
  aggregateMetrics?: Record<string, unknown>;
  error?: string;
}

async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = 30000
): Promise<ApifyResponse<T>> {
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

export const apifyApi = {
  /**
   * Start a scraping job
   */
  async startScrape(params: {
    platform: string;
    query?: string;
    username?: string;
    hashtag?: string;
    companyUrl?: string;
    channelUrl?: string;
    subreddit?: string;
    maxResults?: number;
  }): Promise<ApifyResponse<ScrapeStartResponse>> {
    const result = await invokeEdgeFunction<ScrapeStartResponse>("apify-scrape", params, 45000);

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
   * Check status of a running job
   */
  async checkStatus(
    runId: string,
    platform: string,
    filterKeyword?: string
  ): Promise<ApifyResponse<ScrapeStatusResponse>> {
    const result = await invokeEdgeFunction<ScrapeStatusResponse>(
      "apify-status",
      { runId, platform, filterKeyword },
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

  /**
   * Get results from a completed job
   */
  async getResults(
    datasetId: string,
    platform: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ApifyResponse<ScrapeResultsResponse>> {
    const result = await invokeEdgeFunction<ScrapeResultsResponse>(
      "apify-results",
      { datasetId, platform, ...options },
      60000
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
  ScrapeResultsResponse,
  ApifyResponse,
};
