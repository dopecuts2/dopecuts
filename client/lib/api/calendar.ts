import apiClient from './apiClient';

export interface IBreak {
  startTime: string;
  endTime: string;
}

export interface ICalendarSettings {
  _id?: string;
  dayOfWeek: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  isEnabled: boolean;
  startTime: string;
  endTime: string;
  slotDuration: number;
  breaks: IBreak[];
}

export interface IBlockedTime {
  startTime: string;
  endTime: string;
}

export interface IWeeklyDay {
  dayOfWeek: ICalendarSettings['dayOfWeek'];
  startTime: string;
  endTime: string;
  slotDuration: number;
  isEnabled: boolean;
  blockedTimes: IBlockedTime[];
}

export interface IWeeklyCalendar {
  _id?: string;
  weekStart: string;
  days: IWeeklyDay[];
  slotDuration: number;
}

export async function getCalendarTimezone(): Promise<{ timezone: string }> {
  const response = await apiClient.get<{ timezone: string }>('/calendar/timezone');
  return response.data;
}

export async function getCalendarSettings(): Promise<ICalendarSettings[]> {
  const response = await apiClient.get<ICalendarSettings[]>('/calendar/settings');
  return response.data;
}

export async function getWeeklyCalendar(
  weeks?: number,
  start?: string
): Promise<IWeeklyCalendar[]> {
  const params: Record<string, string | number> = {};
  if (typeof weeks === 'number') params.weeks = weeks;
  if (start) params.start = start;
  const response = await apiClient.get<IWeeklyCalendar[]>('/calendar/weeks', { params });
  return response.data;
}

export async function updateWeeklyCalendar(
  weeks: IWeeklyCalendar[]
): Promise<{ message: string; weeks: IWeeklyCalendar[] }> {
  const response = await apiClient.put<{ message: string; weeks: IWeeklyCalendar[] }>(
    '/calendar/weeks',
    weeks
  );
  return response.data;
}

export async function getAvailability(
  date: string,
  opts?: { serviceId?: string; serviceDuration?: number }
): Promise<string[]> {
  const params: Record<string, string | number> = {};
  if (opts?.serviceId) params.serviceId = opts.serviceId;
  if (typeof opts?.serviceDuration === 'number') params.serviceDuration = opts.serviceDuration;
  const response = await apiClient.get<string[]>(`/calendar/availability/${date}`, { params });
  return response.data;
}

export async function updateCalendarSettings(
  settings: ICalendarSettings[]
): Promise<{ message: string; settings: ICalendarSettings[] }> {
  const response = await apiClient.put<{ message: string; settings: ICalendarSettings[] }>(
    '/calendar/settings',
    settings
  );
  return response.data;
}
