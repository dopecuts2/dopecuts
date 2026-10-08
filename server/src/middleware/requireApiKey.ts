import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ApiKey } from '../models/apiKey.model';
import { logger } from '../utils/logger';

function hashKey(rawKey: string) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Gates the external (AI app) booking API behind the single revocable key
 * generated in Admin Settings. Expects `Authorization: Bearer <key>`.
 */
export const requireApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ message: 'Missing API key.' });
  }
  const rawKey = header.slice(7).trim();
  if (!rawKey) {
    return res.status(401).json({ message: 'Missing API key.' });
  }

  try {
    const keyHash = hashKey(rawKey);
    const record = await ApiKey.findOne({ keyHash });
    if (!record) {
      return res.status(401).json({ message: 'Invalid or revoked API key.' });
    }
    record.lastUsedAt = new Date();
    record.save().catch((err) => logger.error('Failed to record API key use:', err));
    next();
  } catch (error) {
    logger.error('Error validating API key:', error);
    res.status(500).json({ message: 'Failed to validate API key.' });
  }
};
