import dns from "node:dns";
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import meetingsRouter from './server/routes/meetings.js';
import { logger } from './server/utilities/logger.js';
import { connectDB } from './server/database/mongodb.js';

dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

async function startServer() {

  await connectDB();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Request logger middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      logger.info(`${req.method} ${req.path}`, 'system');
    }
    next();
  });

  // REST API Routes
  app.use('/api/meetings', meetingsRouter);

  // Healthcheck API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'AI Google Meet Bot Server',
      timestamp: new Date().toISOString(),
      geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
    });
  });

  // Catch-all 404 handler for unmatched /api requests to prevent HTML fallthrough
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global API error handler
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error(`API Error: ${err?.message || err}`, 'system');
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Starting Vite development middleware on port 3000...', 'system');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    logger.info('Serving static assets from dist folder in production mode...', 'system');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.success(`🚀 AI Google Meet Bot Server running at http://0.0.0.0:${PORT}`, 'system');
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
