import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_ACCOUNT_ID,
  CLOUDFLARE_PUBLIC_URL,
} from '../config/env';

const R2_ENDPOINT =
  process.env.R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

if (!R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  logger.warn('R2 storage is not fully configured. Image uploads will fail.');
}

const r2Client =
  R2_BUCKET_NAME && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT
    ? new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID!,
          secretAccessKey: R2_SECRET_ACCESS_KEY!,
        },
      })
    : null;

const PUBLIC_BASE = CLOUDFLARE_PUBLIC_URL || (R2_BUCKET_NAME && R2_ENDPOINT ? `${R2_ENDPOINT}/${R2_BUCKET_NAME}` : '');

function buildKey(prefix: string, fileName: string) {
  const safeName = fileName.replace(/\s+/g, '-');
  return `${prefix}/${uuidv4()}-${Date.now()}-${safeName}`;
}

function toPublicUrl(key: string) {
  if (!PUBLIC_BASE) return key;
  return `${PUBLIC_BASE}/${key}`;
}

function keyFromUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) {
    const base = PUBLIC_BASE?.endsWith('/') ? PUBLIC_BASE : `${PUBLIC_BASE}/`;
    if (PUBLIC_BASE && base && url.startsWith(base)) {
      return url.slice(base.length);
    }
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return parts.slice(-2).join('/');
      }
    } catch {
      return null;
    }
  }
  return url;
}

export async function uploadImage(
  file: Express.Multer.File,
  prefix = 'dopecuts/uploads'
): Promise<string> {
  if (!file) throw new Error('No file provided to uploadImage');

  const fallbackDataUrl = () =>
    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  // If storage is not configured, fall back to inline data URL (keeps local/dev flowing).
  if (!r2Client || !R2_BUCKET_NAME) {
    logger.warn('R2 client not configured; returning data URL fallback for image upload.');
    return fallbackDataUrl();
  }

  const key = buildKey(prefix, file.originalname);
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    return toPublicUrl(key);
  } catch (error) {
    // If cloud upload fails (e.g., SSL issues), fall back to data URL so admins can proceed.
    logger.error('Error uploading image to R2, falling back to data URL:', error);
    return fallbackDataUrl();
  }
}

export async function deleteImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;
  // Data URLs or non-http values are stored inline; nothing to delete remotely.
  if (imageUrl.startsWith('data:')) return;
  if (!r2Client || !R2_BUCKET_NAME) {
    logger.warn('R2 client not configured; skipping delete.');
    return;
  }
  const key = keyFromUrl(imageUrl);
  if (!key) return;
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    logger.error('Error deleting image from R2:', error);
  }
}
