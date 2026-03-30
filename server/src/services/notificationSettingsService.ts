// dopecut/dopecuts-server-main/src/services/notificationSettingsService.ts
import { NotificationSettings, INotificationSettings } from '../models/notificationSettings.model';
import { DEFAULT_TIMEZONE } from '../config/time';
import { logger } from '../utils/logger';

let cache: INotificationSettings | null = null;
let cacheTime = 0;
const TTL_MS = 30_000; // 30s cache to avoid hammering DB

export async function getNotificationSettings(): Promise<INotificationSettings> {
  const now = Date.now();
  if (cache && now - cacheTime < TTL_MS) return cache;

  let doc = await NotificationSettings.findOne({ key: 'global' });
  if (!doc) {
    logger.info('NotificationSettings not found; creating defaults.');
    doc = await NotificationSettings.create({
      key: 'global',
      emailEnabled: true,
      smsEnabled: true,
      autoSendBookingConfirmations: true,
      timezone: DEFAULT_TIMEZONE,
      siteNoticeEnabled: false,
      siteNoticeMessage: '',
      productNoticeEnabled: false,
      productNoticeMessage: '',
      calendarWeeks: 4,
    });
  } else {
    let mutated = false;
    if (!doc.timezone) {
      doc.timezone = DEFAULT_TIMEZONE;
      mutated = true;
    }
    if (doc.siteNoticeEnabled === undefined) {
      doc.siteNoticeEnabled = false;
      mutated = true;
    }
    if (doc.siteNoticeMessage === undefined) {
      doc.siteNoticeMessage = '';
      mutated = true;
    }
    if (doc.productNoticeEnabled === undefined) {
      doc.productNoticeEnabled = false;
      mutated = true;
    }
    if (doc.productNoticeMessage === undefined) {
      doc.productNoticeMessage = '';
      mutated = true;
    }
    if (doc.calendarWeeks === undefined) {
      doc.calendarWeeks = 4;
      mutated = true;
    }
    if (mutated) await doc.save();
  }
  cache = doc;
  cacheTime = now;
  return doc;
}

export function invalidateNotificationSettingsCache() {
  cache = null;
  cacheTime = 0;
}
