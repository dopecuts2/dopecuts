import { Request, Response } from 'express';
import moment from 'moment-timezone';
import { CalendarSettings } from '../models/calendar.model';
import { WeeklyCalendar } from '../models/weeklyCalendar.model';
import { Booking } from '../models/booking.model';
import { Service } from '../models/service.model';
import { logger } from '../utils/logger';
import { getBusinessTimezone } from '../utils/timezone';

const DEFAULT_START_TIME = '11:00';
const DEFAULT_END_TIME = '19:00';
const DEFAULT_SLOT_DURATION = 45;
const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Per-weekday defaults used whenever a day hasn't been explicitly
// configured (either via Weekly Availability for that specific week, or
// via the day-of-week template). Days not listed here fall back to the
// generic DEFAULT_START_TIME/DEFAULT_END_TIME above.
const DEFAULT_DAY_HOURS: Record<string, { startTime: string; endTime: string; isEnabled: boolean }> = {
  Sunday: { startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME, isEnabled: false },
  Monday: { startTime: '11:00', endTime: '16:40', isEnabled: true },
  Tuesday: { startTime: '11:00', endTime: '16:40', isEnabled: true },
  Saturday: { startTime: '09:20', endTime: '17:20', isEnabled: true },
};

function getDefaultDayHours(dayOfWeek: string) {
  return (
    DEFAULT_DAY_HOURS[dayOfWeek] || {
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
      isEnabled: true,
    }
  );
}

function resolveAdaptiveDuration(
  _serviceName: string | undefined,
  baseDuration: number,
  slotDuration?: number
) {
  // The admin now chooses an explicit duration (15/30/45/60 min) per
  // service, so that value is authoritative -- no more inferring/forcing
  // duration from the service name or flooring it to the slot length.
  if (baseDuration) return baseDuration;
  return normalizeSlotDuration(slotDuration ?? DEFAULT_SLOT_DURATION);
}

function gcd(a: number, b: number): number {
  let x = Math.max(a, 0);
  let y = Math.max(b, 0);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function computeSlotStep(slotDuration: number, serviceDuration: number) {
  const baseSlot = normalizeSlotDuration(slotDuration || DEFAULT_SLOT_DURATION);
  const service = serviceDuration || baseSlot;

  if (service === baseSlot) return baseSlot;

  // If the service is shorter than the base slot, offer start times
  // spaced by the service's own duration (its explicit, admin-chosen
  // value), rather than a derived/finer cadence that wouldn't match
  // what was configured for the service.
  if (service < baseSlot) {
    return service;
  }

  if (service > baseSlot) {
    const divisor = gcd(baseSlot, service);
    if (divisor >= baseSlot / 2) return divisor;
    return baseSlot;
  }

  return baseSlot;
}

function normalizeSlotDuration(duration?: number | null) {
  if (!duration) return DEFAULT_SLOT_DURATION;
  // Promote legacy slot-duration defaults to the current cadence
  if (duration === 35 || duration === 40) return DEFAULT_SLOT_DURATION;
  return duration;
}

interface TimeInterval {
  start: moment.Moment;
  end: moment.Moment;
}

/**
 * Merge a list of occupied intervals (clamped to [dayStart, dayEnd]) and
 * return the free gaps between them, in chronological order. This is the
 * basis of "gap-based" availability: rather than walking a fixed clock
 * grid and discarding any tick that overlaps a booking, we work out the
 * actual free windows first, so a slot can start right where the
 * previous booking ends (e.g. 2:45) instead of only at grid marks.
 */
function computeFreeGaps(
  dayStart: moment.Moment,
  dayEnd: moment.Moment,
  occupied: TimeInterval[]
): TimeInterval[] {
  const clamped = occupied
    .map((iv) => ({
      start: moment.max(iv.start, dayStart),
      end: moment.min(iv.end, dayEnd),
    }))
    .filter((iv) => iv.start.isBefore(iv.end))
    .sort((a, b) => a.start.valueOf() - b.start.valueOf());

  const merged: TimeInterval[] = [];
  for (const iv of clamped) {
    const last = merged[merged.length - 1];
    if (last && !iv.start.isAfter(last.end)) {
      if (iv.end.isAfter(last.end)) last.end = iv.end;
    } else {
      merged.push({ start: iv.start.clone(), end: iv.end.clone() });
    }
  }

  const gaps: TimeInterval[] = [];
  let cursor = dayStart.clone();
  for (const iv of merged) {
    if (iv.start.isAfter(cursor)) {
      gaps.push({ start: cursor.clone(), end: iv.start.clone() });
    }
    if (iv.end.isAfter(cursor)) cursor = iv.end.clone();
  }
  if (cursor.isBefore(dayEnd)) {
    gaps.push({ start: cursor.clone(), end: dayEnd.clone() });
  }
  return gaps;
}

interface WeeklyDayPayload {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isEnabled: boolean;
  blockedTimes: Array<{ startTime: string; endTime: string }>;
}

interface WeeklyCalendarPayload {
  weekStart: string;
  days: WeeklyDayPayload[];
  slotDuration: number;
}

const buildDefaultDay = (dayOfWeek: string): WeeklyDayPayload => {
  const defaults = getDefaultDayHours(dayOfWeek);
  return {
    dayOfWeek,
    startTime: defaults.startTime,
    endTime: defaults.endTime,
    slotDuration: DEFAULT_SLOT_DURATION,
    isEnabled: defaults.isEnabled,
    blockedTimes: [],
  };
};

const buildDefaultWeek = (weekStart: string): WeeklyCalendarPayload => ({
  weekStart,
  slotDuration: DEFAULT_SLOT_DURATION,
  days: DAY_ORDER.map((day) => buildDefaultDay(day)),
});

async function fetchWeekData(weekStart: string): Promise<WeeklyCalendarPayload> {
  const weekly = await WeeklyCalendar.findOne({ weekStart });
  if (weekly) {
    return {
      weekStart: weekly.weekStart,
      slotDuration: normalizeSlotDuration(weekly.slotDuration),
      days: weekly.days.map((day) => {
        const dayObj = (day as any)?.toObject ? (day as any).toObject() : day;
        return {
          ...dayObj,
          slotDuration: normalizeSlotDuration(dayObj.slotDuration),
        };
      }),
    };
  }
  return buildDefaultWeek(weekStart);
}

async function getDaySettingsFor(dateISO: string, timezone: string) {
  const target = moment.tz(dateISO, 'YYYY-MM-DD', timezone);
  const dayOfWeek = target.format('dddd');
  const weekStart = target.clone().startOf('isoWeek').format('YYYY-MM-DD');

  const weekly = await WeeklyCalendar.findOne({ weekStart });
  if (weekly) {
    const day = weekly.days.find((d) => d.dayOfWeek === dayOfWeek);
    if (day) {
      return {
        startTime: day.startTime,
        endTime: day.endTime,
        slotDuration: normalizeSlotDuration(day.slotDuration),
        breaks: day.blockedTimes,
        isEnabled: day.isEnabled,
      };
    }
  }

  const fallback = await CalendarSettings.findOne({ dayOfWeek });
  if (fallback) {
    return {
      startTime: fallback.startTime,
      endTime: fallback.endTime,
      slotDuration: normalizeSlotDuration(fallback.slotDuration),
      breaks: fallback.breaks,
      isEnabled: fallback.isEnabled,
    };
  }

  const defaults = getDefaultDayHours(dayOfWeek);
  return {
    startTime: defaults.startTime,
    endTime: defaults.endTime,
    slotDuration: DEFAULT_SLOT_DURATION,
    breaks: [],
    isEnabled: defaults.isEnabled,
  };
}

export const getWeeklySchedules = async (req: Request, res: Response) => {
  try {
    const weeksParam = Number(req.query.weeks) || 4;
    const startParam = req.query.start as string | undefined;
    const baseStart = startParam
      ? moment.utc(startParam, 'YYYY-MM-DD', true)
      : moment.utc().startOf('isoWeek');
    if (!baseStart.isValid()) {
      return res.status(400).json({ message: 'Invalid start date' });
    }

    const weeks: WeeklyCalendarPayload[] = [];
    for (let i = 0; i < weeksParam; i++) {
      const weekStart = baseStart.clone().add(i, 'weeks').startOf('isoWeek').format('YYYY-MM-DD');
      const weekData = await fetchWeekData(weekStart);
      weeks.push(weekData);
    }

    res.status(200).json(weeks);
  } catch (error) {
    logger.error('Error fetching calendar settings:', error);
    res.status(500).json({ message: 'Failed to fetch calendar settings.' });
  }
};

export const updateWeeklySchedules = async (req: Request, res: Response) => {
  const payload: WeeklyCalendarPayload[] = req.body;

  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({ message: 'Request body must be an array of weekly schedules.' });
  }

  try {
    const bulkOps = payload.map((week) => ({
      updateOne: {
        filter: { weekStart: week.weekStart },
        update: {
          $set: {
            slotDuration: normalizeSlotDuration(week.slotDuration ?? DEFAULT_SLOT_DURATION),
            days: week.days.map((day) => ({
              dayOfWeek: day.dayOfWeek,
              startTime: day.startTime,
              endTime: day.endTime,
              slotDuration: normalizeSlotDuration(day.slotDuration),
              isEnabled: day.isEnabled,
              blockedTimes: day.blockedTimes || [],
            })),
          },
        },
        upsert: true,
      },
    }));

    await WeeklyCalendar.bulkWrite(bulkOps);
    const updated = await WeeklyCalendar.find().sort({ weekStart: 1 });
    const normalizedWeeks = updated.map((week) => ({
      weekStart: week.weekStart,
      slotDuration: normalizeSlotDuration(week.slotDuration),
      days: week.days.map((day) => {
        const dayObj = (day as any)?.toObject ? (day as any).toObject() : day;
        return {
          ...dayObj,
          slotDuration: normalizeSlotDuration(dayObj.slotDuration),
        };
      }),
    }));
    res.status(200).json({ message: 'Weekly schedule updated successfully.', weeks: normalizedWeeks });
  } catch (error) {
    logger.error('Error updating weekly calendar settings:', error);
    res.status(500).json({ message: 'Failed to update calendar settings.' });
  }
};

export const getCalendarSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await CalendarSettings.find().sort({ dayOfWeek: 1 });
    const byDay = new Map(settings.map((setting) => [setting.dayOfWeek, setting]));

    // There is no admin UI to configure this per-weekday template, so an
    // empty/partial collection (e.g. a fresh install) must not silently
    // block every date on the public booking page. Fall back to the same
    // "open every day" default that Weekly Availability already uses.
    const normalized = DAY_ORDER.map((dayOfWeek) => {
      const existing = byDay.get(dayOfWeek);
      if (existing) {
        return {
          ...existing.toObject(),
          slotDuration: normalizeSlotDuration(existing.slotDuration),
        };
      }
      const defaults = getDefaultDayHours(dayOfWeek);
      return {
        dayOfWeek,
        startTime: defaults.startTime,
        endTime: defaults.endTime,
        slotDuration: DEFAULT_SLOT_DURATION,
        isEnabled: defaults.isEnabled,
        breaks: [],
      };
    });

    res.status(200).json(normalized);
  } catch (error) {
    logger.error('Error fetching calendar settings:', error);
    res.status(500).json({ message: 'Failed to fetch calendar settings.' });
  }
};

export const updateCalendarSettings = async (req: Request, res: Response) => {
  const settingsUpdates = req.body;
  if (!Array.isArray(settingsUpdates) || settingsUpdates.length === 0) {
    return res.status(400).json({ message: 'Request body must be a non-empty array of settings.' });
  }
  try {
    const bulkOps = settingsUpdates.map((setting: any) => ({
      updateOne: {
        filter: { dayOfWeek: setting.dayOfWeek },
        update: {
          ...setting,
          slotDuration: normalizeSlotDuration(setting.slotDuration),
        },
        upsert: true,
      },
    }));
    await CalendarSettings.bulkWrite(bulkOps);
    const updatedSettings = await CalendarSettings.find();
    const normalizedSettings = updatedSettings.map((setting) => ({
      ...setting.toObject(),
      slotDuration: normalizeSlotDuration(setting.slotDuration),
    }));
    res.status(200).json({ message: 'Calendar settings updated successfully.', settings: normalizedSettings });
  } catch (error) {
    logger.error('Error updating calendar settings:', error);
    res.status(500).json({ message: 'Failed to update calendar settings.' });
  }
};

export const getAvailability = async (req: Request, res: Response) => {
  const { date } = req.params;
  const timezone = await getBusinessTimezone();
  const targetDate = moment.tz(date, 'YYYY-MM-DD', timezone);

  if (!targetDate.isValid()) {
    return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD.' });
  }

  try {
    const dateISO = targetDate.format('YYYY-MM-DD');
    const settings = await getDaySettingsFor(dateISO, timezone);
    if (!settings.isEnabled) return res.status(200).json([]);

    let serviceDuration: number | null = null;
    const { serviceId, serviceDuration: sd } = req.query as { serviceId?: string; serviceDuration?: string };

    if (serviceId) {
      const svc = await Service.findById(serviceId);
      if (!svc) {
        return res.status(400).json({ message: 'Invalid service specified.' });
      }
      serviceDuration = resolveAdaptiveDuration(svc.name, svc.duration, settings.slotDuration);
    } else if (sd) {
      const n = parseInt(sd, 10);
      if (!isNaN(n) && n > 0) serviceDuration = n;
    }

    const effectiveDuration = serviceDuration ?? settings.slotDuration;

    const bookingsOnDate = await Booking.find({
      date: {
        $gte: moment.utc(dateISO, 'YYYY-MM-DD').startOf('day').toDate(),
        $lte: moment.utc(dateISO, 'YYYY-MM-DD').endOf('day').toDate(),
      },
      status: { $ne: 'cancelled' },
    });

    const nowInTz = moment.tz(timezone);
    const startTime = moment.tz(`${dateISO} ${settings.startTime}`, 'YYYY-MM-DD HH:mm', timezone);
    const endTime = moment.tz(`${dateISO} ${settings.endTime}`, 'YYYY-MM-DD HH:mm', timezone);

    const slotStep = computeSlotStep(settings.slotDuration, effectiveDuration);
    const isToday = nowInTz.format('YYYY-MM-DD') === dateISO;

    const occupied: TimeInterval[] = [];
    for (const b of bookingsOnDate) {
      const bStart = moment.tz(`${dateISO} ${b.time}`, 'YYYY-MM-DD h:mm A', timezone);
      const bEnd = bStart.clone().add(b.duration, 'minutes');
      occupied.push({ start: bStart, end: bEnd });
    }
    for (const block of settings.breaks || []) {
      const blockStart = moment.tz(`${dateISO} ${block.startTime}`, 'YYYY-MM-DD HH:mm', timezone);
      const blockEnd = moment.tz(`${dateISO} ${block.endTime}`, 'YYYY-MM-DD HH:mm', timezone);
      occupied.push({ start: blockStart, end: blockEnd });
    }

    const gaps = computeFreeGaps(startTime, endTime, occupied);
    const availableSlots: string[] = [];

    for (const gap of gaps) {
      let candidate = gap.start.clone();

      if (isToday && nowInTz.isAfter(candidate)) {
        const minutes = nowInTz.minute();
        const remainder = minutes % slotStep;
        const rounded = nowInTz
          .clone()
          .add(remainder === 0 ? 0 : slotStep - remainder, 'minutes')
          .seconds(0)
          .milliseconds(0);
        if (rounded.isAfter(candidate)) candidate = rounded;
      }

      while (true) {
        const candidateEnd = candidate.clone().add(effectiveDuration, 'minutes');
        if (candidateEnd.isAfter(gap.end)) break;
        availableSlots.push(candidate.format('h:mm A'));
        candidate = candidate.clone().add(slotStep, 'minutes');
      }
    }

    res.status(200).json(availableSlots);
  } catch (error) {
    logger.error(`Error fetching availability for ${date}:`, error);
    res.status(500).json({ message: 'Failed to fetch availability.' });
  }
};

export const getTimezone = async (_req: Request, res: Response) => {
  try {
    const timezone = await getBusinessTimezone();
    res.status(200).json({ timezone });
  } catch (err) {
    logger.error('Error fetching timezone:', err);
    res.status(500).json({ message: 'Failed to fetch timezone.' });
  }
};
