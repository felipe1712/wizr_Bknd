import api from "@/lib/api";

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
  rawCount?: number;
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

async function invokeBackendFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = 30000
): Promise<ApifyResponse<T>> {
  try {
    const response = await api.post(`/functions/${functionName}`, body, {
      timeout: timeoutMs,
    });
    return { success: true, data: response.data };
  } catch (error: any) {
    if (error?.code === "ECONNABORTED") {
      return {
        success: false,
        error: "Tiempo de espera agotado. Por favor intenta de nuevo.",
      };
    }
    return {
      success: false,
      error:
        error?.response?.data?.error ||
        error?.message ||
        "Error de conexiÃ³n con el servidor",
    };
  }
}

export const apifyApi = {
  async startScrape(params: {
    platform: string;
    query?: string;
    username?: string;
    hashtag?: string;
    companyUrl?: string;
    channelUrl?: string;
    subreddit?: string;
    taggedUsername?: string;
    captionFilter?: string;
    maxResults?: number;
    youtubeUploadDate?: "lastHour" | "today" | "thisWeek" | "thisMonth" | "thisYear";
    youtubeSortType?: "relevance" | "popularity";
  }): Promise<ApifyResponse<ScrapeStartResponse>> {
    const result = await invokeBackendFunction<ScrapeStartResponse>(
      "apify-scrape",
      params,
      45000
    );

    if (result.success && result.data) {
      return {
        success: result.data.success,
        data: result.data,
        error: result.data.error,
      };
    }

    return result;
  },

  async checkStatus(
    runId: string,
    platform: string,
    filterKeyword?: string
  ): Promise<ApifyResponse<ScrapeStatusResponse>> {
    const result = await invokeBackendFunction<ScrapeStatusResponse>(
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

  async getResults(
    datasetId: string,
    platform: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ApifyResponse<ScrapeResultsResponse>> {
    const result = await invokeBackendFunction<ScrapeResultsResponse>(
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

