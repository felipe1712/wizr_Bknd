import api from '../api';

export interface N8nScrapeRequest {
  platform: "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "reddit";
  query?: string;
  username?: string;
  hashtag?: string;
  maxResults?: number;
  // Options specific to platforms
  youtubeUploadDate?: string;
  youtubeSortType?: string;
  companyUrl?: string;
  channelUrl?: string;
  subreddit?: string;
}

export const n8nApi = {
  /**
   * Triggers a scraping job via our Node.js backend which proxies to n8n.
   * Since this is an asynchronous process, n8n will update the database
   * behind the scenes and there's no need to poll for status.
   */
  startScrape: async (params: N8nScrapeRequest) => {
    try {
      const response = await api.post('/scraping/start', params);
      return { 
        success: true, 
        message: response.data?.message || 'Proceso de extracción iniciado.' 
      };
    } catch (error: any) {
      console.error('Error delegando tarea a n8n:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Error de conexión' 
      };
    }
  }
};
