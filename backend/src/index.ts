import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth.routes';
import scrapingRoutes from './routes/scraping.routes';
import projectsRoutes from './routes/projects.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/scraping', scrapingRoutes);
app.use('/api/projects', projectsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Wizr API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
