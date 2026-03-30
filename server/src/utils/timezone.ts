import moment from 'moment-timezone';
import { DEFAULT_TIMEZONE } from '../config/time';
import { getNotificationSettings } from '../services/notificationSettingsService';
import { logger } from './logger';

let cachedTimezone = DEFAULT_TIMEZONE;
let cachedAt = 0;
const TTL_MS = 30_000;

export async function getBusinessTimezone(): Promise<string> {
  const now = Date.now();
  if (cachedAt && now - cachedAt < TTL_MS && cachedTimezone) return cachedTimezone;

  try {
    const settings = await getNotificationSettings();
    const tz = settings?.timezone;
    cachedTimezone = tz && moment.tz.zone(tz) ? tz : DEFAULT_TIMEZONE;
  } catch (err) {
    logger.warn('Failed to load business timezone; using default.', { err });
    cachedTimezone = DEFAULT_TIMEZONE;
  }
  cachedAt = now;
  return cachedTimezone;
}
