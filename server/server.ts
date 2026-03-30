// dopecuts-server/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { connectDB } from './src/config/db';
import { PORT } from './src/config/env';
import { logger, requestLogger } from './src/utils/logger';
import { rateLimiter } from './src/middleware/rateLimiter';
import { corsWithOptions } from './src/middleware/cors';
import mainRouter from './src/routes';
import { startQueueSweeper } from './src/services/queueService';

const app = express();

app.set('trust proxy', false);

connectDB();
startQueueSweeper();

app.use(corsWithOptions);
app.use(rateLimiter);
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// NEW: mount everything at root, because the proxy is already stripping `/api/v1`
app.use('/', mainRouter);

// You can either keep this root health check here:
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Welcome to the Dopecuts API' });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message);
  res.status(500).send('Something went wrong!');
});

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});