// dopecut/dopekuts-main/lib/api/notifications.ts
import apiClient from './apiClient';

export interface NotificationSettings {
  _id: string;
  key: 'global';
  emailEnabled: boolean;
  smsEnabled: boolean;
  autoSendBookingConfirmations: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  siteNoticeEnabled: boolean;
  siteNoticeMessage: string;
  productNoticeEnabled: boolean;
  productNoticeMessage: string;
  calendarWeeks: number;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const { data } = await apiClient.get<NotificationSettings>('/notifications/settings');
  return data;
}

export async function updateNotificationSettings(
  payload: Partial<Pick<NotificationSettings, 'emailEnabled' | 'smsEnabled' | 'autoSendBookingConfirmations' | 'timezone' | 'siteNoticeEnabled' | 'siteNoticeMessage' | 'productNoticeEnabled' | 'productNoticeMessage' | 'calendarWeeks'>>
): Promise<{ message: string; settings: NotificationSettings }> {
  const { data } = await apiClient.put<{ message: string; settings: NotificationSettings }>(
    '/notifications/settings',
    payload
  );
  return data;
}

export interface SiteNotice {
  enabled: boolean;
  message: string;
}

export async function getSiteNotice(): Promise<SiteNotice> {
  const { data } = await apiClient.get<SiteNotice>('/notifications/notice');
  return data;
}

export async function getProductNotice(): Promise<SiteNotice> {
  const { data } = await apiClient.get<SiteNotice>('/notifications/product-notice');
  return data;
}

export async function getCalendarWeeks(): Promise<{ weeks: number }> {
  const { data } = await apiClient.get<{ weeks: number }>('/notifications/calendar-weeks');
  return data;
}
