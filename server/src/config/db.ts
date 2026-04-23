import mongoose from 'mongoose';
import { MONGO_URI } from './env';
import { logger } from '../utils/logger';

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});
    logger.info('📦 MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);   
  }
};