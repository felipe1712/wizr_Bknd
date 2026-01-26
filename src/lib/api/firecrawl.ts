import { supabase } from '@/integrations/supabase/client';

export type FirecrawlResponse<T = unknown> = {
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
  // Added fields for entity matching
  matchedEntityId?: string;
  matchedEntityName?: string;
  matchedKeywords?: string[];
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

export interface EntityForSearch {
  id: string;
  nombre: string;
  palabras_clave: string[];
  aliases: string[];
}

/**
 * Build a search query from entity data
 * Uses a simple, direct search query to maximize results
 */
export function buildEntitySearchQuery(entity: EntityForSearch): string {
  // Simple approach: just use the entity name with "noticias" for news context
  // Complex boolean queries often return fewer or no results
  return `"${entity.nombre}" noticias`;
}

/**
 * Match search results against entity keywords
 * Returns the matched keywords for each result
 */
export function matchResultsToEntity(
  results: SearchResult[],
  entity: EntityForSearch
): SearchResult[] {
  const searchTerms = [
    entity.nombre.toLowerCase(),
    ...entity.aliases.map((a) => a.toLowerCase()),
    ...entity.palabras_clave.map((k) => k.toLowerCase()),
  ];

  return results.map((result) => {
    const content = `${result.title} ${result.description}`.toLowerCase();
    const matchedKeywords = searchTerms.filter((term) => content.includes(term));

    return {
      ...result,
      matchedEntityId: entity.id,
      matchedEntityName: entity.nombre,
      matchedKeywords,
    };
  });
}

/**
 * Retry wrapper for API calls with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`Attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export const firecrawlApi = {
  /**
   * Search the web for news and content with automatic retry
   */
  async search(query: string, options?: SearchOptions): Promise<FirecrawlResponse<SearchResult[]>> {
    try {
      const result = await withRetry(async () => {
        const { data, error } = await supabase.functions.invoke('firecrawl-search', {
          body: { query, options },
        });

        if (error) {
          throw new Error(error.message);
        }

        // Handle Firecrawl response structure
        if (data?.success === false) {
          throw new Error(data.error || 'Search failed');
        }

        return data;
      });

      return { 
        success: true, 
        data: result?.data || [] 
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      console.error('Search failed after retries:', errorMessage);
      return { 
        success: false, 
        error: errorMessage.includes('Failed to fetch') 
          ? 'La búsqueda tardó demasiado. Por favor intenta de nuevo.'
          : errorMessage
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

  /**
   * Search for mentions of a specific entity
   */
  async searchEntity(
    entity: EntityForSearch,
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day',
    limit = 10
  ): Promise<FirecrawlResponse<SearchResult[]>> {
    const query = buildEntitySearchQuery(entity);
    const response = await this.searchNews(query, timeRange, limit);

    if (response.success && response.data) {
      // Enrich results with entity matching information
      const enrichedResults = matchResultsToEntity(response.data, entity);
      return { success: true, data: enrichedResults };
    }

    return response;
  },

  /**
   * Search for mentions across multiple entities
   */
  async searchMultipleEntities(
    entities: EntityForSearch[],
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day',
    limitPerEntity = 5
  ): Promise<FirecrawlResponse<SearchResult[]>> {
    if (entities.length === 0) {
      return { success: true, data: [] };
    }

    try {
      // Search for each entity in parallel
      const searchPromises = entities.map((entity) =>
        this.searchEntity(entity, timeRange, limitPerEntity)
      );

      const results = await Promise.all(searchPromises);

      // Combine all results
      const allResults: SearchResult[] = [];
      const seenUrls = new Set<string>();
      const errors: string[] = [];

      for (const result of results) {
        if (result.success && result.data) {
          for (const item of result.data) {
            // Deduplicate by URL
            if (!seenUrls.has(item.url)) {
              seenUrls.add(item.url);
              allResults.push(item);
            }
          }
        } else if (!result.success) {
          errors.push(result.error || 'Search failed');
        }
      }

      // If *everything* failed, report a real error instead of a misleading "0 results".
      if (allResults.length === 0 && errors.length === entities.length) {
        return {
          success: false,
          error:
            errors.find((e) => e.includes('tardó demasiado')) ||
            errors[0] ||
            'No se pudo completar la búsqueda. Intenta de nuevo.',
        };
      }

      // Sort by published date if available, otherwise by position
      allResults.sort((a, b) => {
        const dateA = a.metadata?.publishedDate ? new Date(a.metadata.publishedDate).getTime() : 0;
        const dateB = b.metadata?.publishedDate ? new Date(b.metadata.publishedDate).getTime() : 0;
        return dateB - dateA;
      });

      return { success: true, data: allResults };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Multi-entity search failed',
      };
    }
  },
};
