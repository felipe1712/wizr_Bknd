import { Router } from 'express';
import { startScraping } from '../controllers/scraping.controller';

const router = Router();

// Endpoint que el frontend llamará (POST /api/scraping/start)
router.post('/start', startScraping);

export default router;
