import { supabase } from '@/integrations/supabase/client';

export type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
};

export type SearchResult = {
  url: string;
  title: string;
  description: string;
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    sourceURL?: string;
    statusCode?: number;
    publishedDate?: string;
  };
};

export type ScrapeResult = {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    sourceURL?: string;
    statusCode?: number;
  };
};

type SearchOptions = {
  limit?: number;
  lang?: string;
  country?: string;
  tbs?: 'qdr:h' | 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y'; // hour, day, week, month, year
};

type ScrapeOptions = {
  formats?: ('markdown' | 'html' | 'links')[];
  onlyMainContent?: boolean;
  waitFor?: number;
};

export const firecrawlApi = {
  /**
   * Search the web for news and content
   */
  async search(query: string, options?: SearchOptions): Promise<FirecrawlResponse<SearchResult[]>> {
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-search', {
        body: { query, options },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Handle Firecrawl response structure
      if (data?.success === false) {
        return { success: false, error: data.error };
      }

      return { 
        success: true, 
        data: data?.data || [] 
      };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Search failed' 
      };
    }
  },

  /**
   * Scrape a single URL for content
   */
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse<ScrapeResult>> {
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { url, options },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.success === false) {
        return { success: false, error: data.error };
      }

      return { 
        success: true, 
        data: data?.data || data 
      };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Scrape failed' 
      };
    }
  },

  /**
   * Search news specifically (helper method)
   */
  async searchNews(
    query: string, 
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day',
    limit = 10
  ): Promise<FirecrawlResponse<SearchResult[]>> {
    const tbsMap = {
      hour: 'qdr:h',
      day: 'qdr:d',
      week: 'qdr:w',
      month: 'qdr:m',
    } as const;

    return this.search(query, {
      limit,
      tbs: tbsMap[timeRange],
      lang: 'es',
      country: 'MX',
    });
  },
};
