import { Request, Response } from 'express';
import moment from 'moment-timezone';
import { CalendarSettings } from '../models/calendar.model';
import { WeeklyCalendar } from '../models/weeklyCalendar.model';
import { Booking } from '../models/booking.model';
import { Service } from '../models/service.model';
import { logger } from '../utils/logger';
import { getBusinessTimezone } from '../utils/timezone';
import {
  DAY_ORDER,
  DEFAULT_SLOT_DURATION,
  getDefaultDayHours,
  normalizeSlotDuration,
  computeSlotStep,
  resolveAdaptiveDuration,
  computeFreeGaps,
  getDaySettingsFor,
  TimeInterval,
} from '../utils/availability';

interface WeeklyDayPayload {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isEnabled: boolean;
  useDefaultHours: boolean;
  blockedTimes: Array<{ startTime: string; endTime: string; isEnabled: boolean }>;
}

interface WeeklyCalendarPayload {
  weekStart: string;
  days: WeeklyDayPayload[];
  slotDuration: number;
}

// An unconfigured day/week hasn't diverged from the Default Schedule yet,
// so it starts out toggled on (following the default) rather than frozen
// with a one-time copy of today's default values.
const buildDefaultDay = (dayOfWeek: string): WeeklyDayPayload => {
  const defaults = getDefaultDayHours(dayOfWeek);
  return {
    dayOfWeek,
    startTime: defaults.startTime,
    endTime: defaults.endTime,
    slotDuration: DEFAULT_SLOT_DURATION,
    isEnabled: defaults.isEnabled,
    useDefaultHours: true,
    blockedTimes: defaults.breaks.map((b) => ({ ...b, isEnabled: true })),
  };
};

const buildDefaultWeek = (weekStart: string): WeeklyCalendarPayload => ({
  weekStart,
  slotDuration: DEFAULT_SLOT_DURATION,
  days: DAY_ORDER.map((day) => buildDefaultDay(day)),
});

// A day toggled on dynamically mirrors the live Default Schedule, so the
// admin editor must show the current default values for it rather than
// whatever was last saved (which could be stale if the default changed).
function resolveDayForDisplay(dayObj: any): WeeklyDayPayload {
  if (dayObj.useDefaultHours) {
    const defaults = getDefaultDayHours(dayObj.dayOfWeek);
    return {
      dayOfWeek: dayObj.dayOfWeek,
      startTime: defaults.startTime,
      endTime: defaults.endTime,
      slotDuration: DEFAULT_SLOT_DURATION,
      isEnabled: dayObj.isEnabled,
      useDefaultHours: true,
      blockedTimes: defaults.breaks.map((b) => ({ ...b, isEnabled: true })),
    };
  }
  return {
    ...dayObj,
    slotDuration: normalizeSlotDuration(dayObj.slotDuration),
    useDefaultHours: false,
    blockedTimes: (dayObj.blockedTimes || []).map((b: any) => ({ ...b, isEnabled: b.isEnabled !== false })),
  };
}

async function fetchWeekData(weekStart: string): Promise<WeeklyCalendarPayload> {
  const weekly = await WeeklyCalendar.findOne({ weekStart });
  if (weekly) {
    return {
      weekStart: weekly.weekStart,
      slotDuration: normalizeSlotDuration(weekly.slotDuration),
      days: weekly.days.map((day) => {
        const dayObj = (day as any)?.toObject ? (day as any).toObject() : day;
        return resolveDayForDisplay(dayObj);
      }),
    };
  }
  return buildDefaultWeek(weekStart);
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
              useDefaultHours: Boolean(day.useDefaultHours),
              blockedTimes: (day.blockedTimes || []).map((b) => ({
                startTime: b.startTime,
                endTime: b.endTime,
                isEnabled: b.isEnabled !== false,
              })),
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
        return resolveDayForDisplay(dayObj);
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
        breaks: defaults.breaks.map((b) => ({ ...b })),
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
