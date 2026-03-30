// dopecut/dopecuts-server-main/src/controllers/notificationSettings.controller.ts
import { Request, Response } from 'express';
import moment from 'moment-timezone';
import { NotificationSettings } from '../models/notificationSettings.model';
import { getNotificationSettings, invalidateNotificationSettingsCache } from '../services/notificationSettingsService';
import { DEFAULT_TIMEZONE } from '../config/time';
import { logger } from '../utils/logger';

/**
 * @route GET /api/v1/notifications/settings
 * @access Private (Admin)
 */
export const getSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await getNotificationSettings();
    res.status(200).json(settings);
  } catch (err) {
    logger.error('Error fetching notification settings:', err);
    res.status(500).json({ message: 'Failed to fetch notification settings.' });
  }
};

/**
 * @route PUT /api/v1/notifications/settings
 * @access Private (Admin)
 * body: { emailEnabled?: boolean, smsEnabled?: boolean, autoSendBookingConfirmations?: boolean, timezone?: string }
 */
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const payload: Partial<{
      emailEnabled: boolean;
      smsEnabled: boolean;
      autoSendBookingConfirmations: boolean;
      timezone: string;
      siteNoticeEnabled: boolean;
      siteNoticeMessage: string;
      productNoticeEnabled: boolean;
      productNoticeMessage: string;
      calendarWeeks: number;
    }> = req.body ?? {};

    if (payload.timezone && !moment.tz.zone(payload.timezone)) {
      return res.status(400).json({ message: 'Invalid timezone supplied.' });
    }
    if (payload.calendarWeeks !== undefined) {
      if (typeof payload.calendarWeeks !== 'number' || payload.calendarWeeks < 1 || payload.calendarWeeks > 12) {
        return res.status(400).json({ message: 'calendarWeeks must be between 1 and 12.' });
      }
    }

    const updated = await NotificationSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: payload },
      { upsert: true, new: true }
    );

    invalidateNotificationSettingsCache();

    res.status(200).json({
      message: 'Notification settings updated.',
      settings: {
        ...updated.toObject(),
        timezone: updated.timezone || DEFAULT_TIMEZONE,
      },
    });
  } catch (err) {
    logger.error('Error updating notification settings:', err);
    res.status(500).json({ message: 'Failed to update notification settings.' });
  }
};

/**
 * @route GET /api/v1/notifications/notice
 * @access Public
 */
export const getSiteNotice = async (_req: Request, res: Response) => {
  try {
    const settings = await getNotificationSettings();
    res.status(200).json({
      enabled: !!settings.siteNoticeEnabled,
      message: settings.siteNoticeMessage || '',
    });
  } catch (err) {
    logger.error('Error fetching site notice:', err);
    res.status(500).json({ message: 'Failed to fetch site notice.' });
  }
};

/**
 * @route GET /api/v1/notifications/product-notice
 * @access Public
 */
export const getProductNotice = async (_req: Request, res: Response) => {
  try {
    const settings = await getNotificationSettings();
    res.status(200).json({
      enabled: !!settings.productNoticeEnabled,
      message: settings.productNoticeMessage || '',
    });
  } catch (err) {
    logger.error('Error fetching product notice:', err);
    res.status(500).json({ message: 'Failed to fetch product notice.' });
  }
};

/**
 * @route GET /api/v1/notifications/calendar-weeks
 * @access Public
 */
export const getCalendarWeeks = async (_req: Request, res: Response) => {
  try {
    const settings = await getNotificationSettings();
    res.status(200).json({ weeks: settings.calendarWeeks || 4 });
  } catch (err) {
    logger.error('Error fetching calendar weeks:', err);
    res.status(500).json({ message: 'Failed to fetch calendar weeks.' });
  }
};
