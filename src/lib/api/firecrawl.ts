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
 * Combines the entity name, aliases, and keywords into an optimized search query
 */
export function buildEntitySearchQuery(entity: EntityForSearch): string {
  const terms: string[] = [];
  
  // Add the main entity name (quoted for exact match)
  terms.push(`"${entity.nombre}"`);
  
  // Add aliases (quoted for exact match)
  entity.aliases.forEach((alias) => {
    if (alias.trim()) {
      terms.push(`"${alias.trim()}"`);
    }
  });
  
  // Keywords are used as context modifiers, not quoted
  // Only add first 3 keywords to avoid overly complex queries
  const keywordContext = entity.palabras_clave
    .slice(0, 3)
    .filter((k) => k.trim())
    .join(' ');
  
  // Combine: OR logic for name/aliases, AND for keyword context
  const nameAliasQuery = terms.join(' OR ');
  
  if (keywordContext) {
    return `(${nameAliasQuery}) ${keywordContext}`;
  }
  
  return nameAliasQuery;
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

      for (const result of results) {
        if (result.success && result.data) {
          for (const item of result.data) {
            // Deduplicate by URL
            if (!seenUrls.has(item.url)) {
              seenUrls.add(item.url);
              allResults.push(item);
            }
          }
        }
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
