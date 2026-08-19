// dopecuts-server/server.ts

import express, { Request, Response, NextFunction } from 'express';

import mongoose from 'mongoose';

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



app.use(corsWithOptions);

app.use(rateLimiter);

app.use(express.json());

app.use(cookieParser());

app.use(requestLogger);



// The proxy already strips /api/v1.

app.use('/', mainRouter);



app.get('/', (req: Request, res: Response) => {
  
  res.status(200).json({ message: 'Welcome to the Dopecuts API' });
  
});



app.get('/health', (req: Request, res: Response) => {
  
  const databaseConnected = mongoose.connection.readyState === 1;
  
  res.status(databaseConnected ? 200 : 503).json({
    
    status: databaseConnected ? 'ok' : 'degraded',
    
    database: databaseConnected ? 'connected' : 'disconnected',
    
  });
  
});



app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  
  logger.error(err.message);
  
  res.status(500).send('Something went wrong!');
  
});



async function bootstrap() {
  
  try {
    
    await connectDB();
    
    startQueueSweeper();
    
    app.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`));
    
  } catch (error) {
    
    logger.error('API startup stopped because MongoDB is unavailable. Correct the Railway database configuration and redeploy.');
    
    process.exit(1);
    
  }
  
}



void bootstrap();



















