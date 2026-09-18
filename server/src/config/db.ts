import mongoose from 'mongoose';

import { MONGO_URI } from './env';

import { logger } from '../utils/logger';



export const connectDB = async () => {
  
  if (!MONGO_URI || !MONGO_URI.trim()) {
    
    throw new Error('MONGO_URI is required before the API can start. Set the Railway variable without exposing it in logs.');
    
  }
  

  
  try {
    
    await mongoose.connect(MONGO_URI, {
      
      serverSelectionTimeoutMS: 30000,
      
      socketTimeoutMS: 45000,
      
      maxPoolSize: 10,
      
      minPoolSize: 1,
      
      retryWrites: true,
      
    });
    
    logger.info('📦 MongoDB connected successfully');
    
  } catch (error) {

    const rawMessage = error instanceof Error ? error.message : String(error);
    // Strip any credentials that might appear in a connection-string-shaped error message.
    const safeMessage = rawMessage.replace(/\/\/[^@/\s]+@/g, '//<redacted>@');
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    logger.error(
      `MongoDB connection failed [${errorName}]: ${safeMessage}. Verify the Railway MONGO_URI variable, Atlas network access, and database user permissions.`
    );

    throw error;

  }
  
};

















