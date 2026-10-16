import api from "@/lib/api";

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

async function invokeBackendFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = 30000
): Promise<BrightDataResponse<T>> {
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

export const brightdataApi = {
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
    const result = await invokeBackendFunction<ScrapeStartResponse>(
      "brightdata-scrape",
      params,
      180000
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
    snapshotId: string,
    platform: string
  ): Promise<BrightDataResponse<ScrapeStatusResponse>> {
    const result = await invokeBackendFunction<ScrapeStatusResponse>(
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

