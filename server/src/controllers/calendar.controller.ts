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
const DEFAULT_SLOT_DURATION = 40;
const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ADAPTIVE_SERVICE_RULES: Array<{ keywords: string[]; duration: number }> = [
  { keywords: ['kids cut', 'kid cut'], duration: 20 },
  { keywords: ['hair line up', 'hair line-up', 'hair lineup', 'lineup'], duration: 20 },
  { keywords: ['beard trim'], duration: 20 },
  { keywords: ['deluxe'], duration: 60 },
];

function resolveAdaptiveDuration(
  serviceName: string | undefined,
  baseDuration: number,
  slotDuration?: number
) {
  const normalizedSlot = normalizeSlotDuration(slotDuration ?? DEFAULT_SLOT_DURATION);
  const normalizedBase = baseDuration || normalizedSlot;
  const normalizedName = (serviceName || '').toLowerCase();
  const rule = ADAPTIVE_SERVICE_RULES.find((r) =>
    r.keywords.some((keyword) => normalizedName.includes(keyword))
  );
  if (rule) return rule.duration;
  return Math.max(normalizedBase, normalizedSlot);
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

  if (service < baseSlot && baseSlot % service === 0) {
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
  // Promote legacy 35-minute default to the new 40-minute cadence
  if (duration === 35) return DEFAULT_SLOT_DURATION;
  return duration;
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

const buildDefaultDay = (dayOfWeek: string): WeeklyDayPayload => ({
  dayOfWeek,
  startTime: DEFAULT_START_TIME,
  endTime: DEFAULT_END_TIME,
  slotDuration: DEFAULT_SLOT_DURATION,
  isEnabled: true,
  blockedTimes: [],
});

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
    if (day && day.isEnabled) {
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

  return {
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
    slotDuration: DEFAULT_SLOT_DURATION,
    breaks: [],
    isEnabled: true,
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
    const normalized = settings.map((setting) => ({
      ...setting.toObject(),
      slotDuration: normalizeSlotDuration(setting.slotDuration),
    }));
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
    let current = startTime.clone();

    const availableSlots: string[] = [];
    const isToday = nowInTz.format('YYYY-MM-DD') === dateISO;

    if (isToday && nowInTz.isAfter(current)) {
      const minutes = nowInTz.minute();
      const remainder = minutes % slotStep;
      current = nowInTz
        .clone()
        .add(remainder === 0 ? 0 : slotStep - remainder, 'minutes')
        .seconds(0)
        .milliseconds(0);
      if (current.isBefore(startTime)) current = startTime.clone();
    }

    const overlaps = (aStart: moment.Moment, aEnd: moment.Moment, bStart: moment.Moment, bEnd: moment.Moment) =>
      aStart.isBefore(bEnd) && aEnd.isAfter(bStart);

    while (current.isBefore(endTime)) {
      const slotStart = current.clone();
      const slotEnd = slotStart.clone().add(effectiveDuration, 'minutes');
      if (slotEnd.isAfter(endTime)) break;

      let ok = true;
      for (const b of bookingsOnDate) {
        const bStart = moment.tz(`${dateISO} ${b.time}`, 'YYYY-MM-DD h:mm A', timezone);
        const bEnd = bStart.clone().add(b.duration, 'minutes');
        if (overlaps(slotStart, slotEnd, bStart, bEnd)) {
          ok = false;
          break;
        }
      }
      if (!ok) {
        current.add(slotStep, 'minutes');
        continue;
      }

      for (const block of settings.breaks || []) {
        const blockStart = moment.tz(`${dateISO} ${block.startTime}`, 'YYYY-MM-DD HH:mm', timezone);
        const blockEnd = moment.tz(`${dateISO} ${block.endTime}`, 'YYYY-MM-DD HH:mm', timezone);
        if (overlaps(slotStart, slotEnd, blockStart, blockEnd)) {
          ok = false;
          break;
        }
      }

      if (ok) {
        availableSlots.push(slotStart.format('h:mm A'));
      }

      current.add(slotStep, 'minutes');
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
