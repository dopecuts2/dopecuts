import { Request, Response } from 'express';
import crypto from 'crypto';
import { ApiKey } from '../models/apiKey.model';
import { logger } from '../utils/logger';

const KEY_PREFIX = 'dcai_';

function hashKey(rawKey: string) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generates a new API key for external (AI app) booking access, replacing
 * any key that already exists -- there's only ever one active key at a
 * time, so generating a new one is also how you revoke a compromised one.
 * The raw key is returned exactly once; only its hash is stored.
 */
export const generateApiKey = async (_req: Request, res: Response) => {
  try {
    const rawKey = `${KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 6);

    await ApiKey.deleteMany({});
    await ApiKey.create({ label: 'AI Booking Access', keyHash, keyPrefix });

    res.status(201).json({
      message: 'API key generated. Copy it now -- it will not be shown again.',
      key: rawKey,
      keyPrefix,
    });
  } catch (error) {
    logger.error('Error generating API key:', error);
    res.status(500).json({ message: 'Failed to generate API key.' });
  }
};

/** Revokes (deletes) the active API key, if any. */
export const revokeApiKey = async (_req: Request, res: Response) => {
  try {
    await ApiKey.deleteMany({});
    res.status(200).json({ message: 'API key revoked.' });
  } catch (error) {
    logger.error('Error revoking API key:', error);
    res.status(500).json({ message: 'Failed to revoke API key.' });
  }
};

/** Returns whether a key exists and its metadata -- never the key itself. */
export const getApiKeyStatus = async (_req: Request, res: Response) => {
  try {
    const existing = await ApiKey.findOne().sort({ createdAt: -1 });
    if (!existing) {
      return res.status(200).json({ active: false });
    }
    res.status(200).json({
      active: true,
      keyPrefix: existing.keyPrefix,
      createdAt: existing.createdAt,
      lastUsedAt: existing.lastUsedAt || null,
    });
  } catch (error) {
    logger.error('Error fetching API key status:', error);
    res.status(500).json({ message: 'Failed to fetch API key status.' });
  }
};
