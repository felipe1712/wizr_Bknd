import { Request, Response } from 'express';
import axios from 'axios';

export const startScraping = async (req: Request, res: Response) => {
  try {
    const { platform, query, username, hashtag, companyUrl, channelUrl, subreddit, maxResults } = req.body;
    
    // Validate required fields (at least we need to know the platform)
    if (!platform) {
      return res.status(400).json({ error: 'La plataforma es obligatoria.' });
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (!n8nWebhookUrl) {
      console.warn("N8N_WEBHOOK_URL no está configurado en el archivo .env del backend.");
      // We return success so the frontend doesn't crash during setup, but warn the user
      return res.status(200).json({ 
        success: true, 
        message: 'Advertencia: N8N_WEBHOOK_URL no configurado, pero la petición fue simulada con éxito.' 
      });
    }

    // Forward the exact same payload to n8n
    const n8nPayload = {
      platform,
      query,
      username,
      hashtag,
      companyUrl,
      channelUrl,
      subreddit,
      maxResults: maxResults || 25,
      timestamp: new Date().toISOString()
    };

    console.log(`[Scraping] Delegando tarea a n8n para plataforma: ${platform}`);
    
    // We don't await the full processing of n8n, we just post to its webhook.
    // N8n should return an immediate 200 OK acknowledgment.
    const response = await axios.post(n8nWebhookUrl, n8nPayload, {
      timeout: 10000 // 10 seconds max to acknowledge
    });

    return res.status(200).json({
      success: true,
      message: 'La tarea ha sido delegada a n8n correctamente.',
      data: response.data
    });

  } catch (error: any) {
    console.error('Error al contactar webhook de n8n:', error.message);
    return res.status(500).json({ 
      error: 'Error al comunicarse con el orquestador n8n.',
      details: error.message 
    });
  }
};
