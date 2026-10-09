// Shared business-hours/availability resolution logic, used by both the
// public availability endpoint (calendar.controller.ts) and booking
// creation/validation (booking.controller.ts). Kept in one place so the
// two can never drift on what counts as "open" for a given day.
import moment from 'moment-timezone';
import { CalendarSettings } from '../models/calendar.model';
import { WeeklyCalendar } from '../models/weeklyCalendar.model';

export const DEFAULT_START_TIME = '11:00';
export const DEFAULT_END_TIME = '19:00';
export const DEFAULT_SLOT_DURATION = 45;
export const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface DefaultDayHours {
  startTime: string;
  endTime: string;
  isEnabled: boolean;
  breaks: Array<{ startTime: string; endTime: string }>;
}

// Per-weekday defaults used whenever a day hasn't been explicitly
// configured (either via Weekly Availability for that specific week, or
// via the day-of-week template). Days not listed here fall back to the
// generic DEFAULT_START_TIME/DEFAULT_END_TIME above.
export const DEFAULT_DAY_HOURS: Record<string, DefaultDayHours> = {
  Sunday: { startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME, isEnabled: false, breaks: [] },
  Monday: {
    startTime: '11:00',
    endTime: '16:20',
    isEnabled: true,
    breaks: [{ startTime: '13:00', endTime: '13:40' }],
  },
  Tuesday: {
    startTime: '11:00',
    endTime: '16:20',
    isEnabled: true,
    breaks: [{ startTime: '13:00', endTime: '13:40' }],
  },
  Wednesday: {
    startTime: '11:00',
    endTime: '20:20',
    isEnabled: true,
    breaks: [
      { startTime: '13:40', endTime: '14:20' },
      { startTime: '16:20', endTime: '17:00' },
    ],
  },
  Thursday: {
    startTime: '11:00',
    endTime: '20:20',
    isEnabled: true,
    breaks: [
      { startTime: '13:40', endTime: '14:20' },
      { startTime: '16:20', endTime: '17:00' },
    ],
  },
  Friday: {
    startTime: '11:00',
    endTime: '20:20',
    isEnabled: true,
    breaks: [
      { startTime: '13:40', endTime: '14:20' },
      { startTime: '16:20', endTime: '17:00' },
    ],
  },
  Saturday: {
    startTime: '09:20',
    endTime: '17:20',
    isEnabled: true,
    breaks: [
      { startTime: '12:00', endTime: '12:40' },
      { startTime: '14:40', endTime: '15:20' },
    ],
  },
};

export function getDefaultDayHours(dayOfWeek: string): DefaultDayHours {
  return (
    DEFAULT_DAY_HOURS[dayOfWeek] || {
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
      isEnabled: true,
      breaks: [],
    }
  );
}

export function normalizeSlotDuration(duration?: number | null) {
  if (!duration) return DEFAULT_SLOT_DURATION;
  // Promote legacy slot-duration defaults to the current cadence
  if (duration === 35 || duration === 40) return DEFAULT_SLOT_DURATION;
  return duration;
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

export function computeSlotStep(slotDuration: number, serviceDuration: number) {
  const baseSlot = normalizeSlotDuration(slotDuration || DEFAULT_SLOT_DURATION);
  const service = serviceDuration || baseSlot;

  // If the service equals the slot, stay on the base cadence.
  if (service === baseSlot) return baseSlot;

  // If the service is shorter than the base slot, offer start times
  // spaced by the service's own duration (its explicit, admin-chosen
  // value), rather than a derived/finer cadence that wouldn't match
  // what was configured for the service.
  if (service < baseSlot) {
    return service;
  }

  // If the service is longer, use a shared divisor only when it keeps at least half-slot granularity (e.g., 60 vs 45 -> 15).
  if (service > baseSlot) {
    const divisor = gcd(baseSlot, service);
    if (divisor >= baseSlot / 2) return divisor;
    return baseSlot;
  }

  // Fallback to the base cadence (covers non-divisible shorter services like 35m).
  return baseSlot;
}

export function resolveAdaptiveDuration(
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

export interface TimeInterval {
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
export function computeFreeGaps(
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

export interface ResolvedDaySettings {
  startTime: string;
  endTime: string;
  slotDuration: number;
  breaks: Array<{ startTime: string; endTime: string }>;
  isEnabled: boolean;
}

/**
 * Resolves the effective hours/breaks/open-state for a given calendar
 * date: a specific Weekly Availability override takes priority, then the
 * per-weekday CalendarSettings template, then the hardcoded defaults.
 * Each break's own `isEnabled` flag (defaulting to true for older
 * documents that predate the flag) decides whether it still blocks time.
 */
export async function getDaySettingsFor(dateISO: string, timezone: string): Promise<ResolvedDaySettings> {
  const target = moment.tz(dateISO, 'YYYY-MM-DD', timezone);
  const dayOfWeek = target.format('dddd');
  const weekStart = target.clone().startOf('isoWeek').format('YYYY-MM-DD');

  const weekly = await WeeklyCalendar.findOne({ weekStart });
  if (weekly) {
    const day = weekly.days.find((d) => d.dayOfWeek === dayOfWeek);
    if (day && !day.useDefaultHours) {
      return {
        startTime: day.startTime,
        endTime: day.endTime,
        slotDuration: normalizeSlotDuration(day.slotDuration),
        breaks: (day.blockedTimes || []).filter((b) => b.isEnabled !== false),
        isEnabled: day.isEnabled,
      };
    }
    if (day && day.useDefaultHours) {
      const defaults = getDefaultDayHours(dayOfWeek);
      return {
        startTime: defaults.startTime,
        endTime: defaults.endTime,
        slotDuration: DEFAULT_SLOT_DURATION,
        breaks: defaults.breaks.map((b) => ({ ...b })),
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
      breaks: (fallback.breaks || []).filter((b: any) => b.isEnabled !== false),
      isEnabled: fallback.isEnabled,
    };
  }

  const defaults = getDefaultDayHours(dayOfWeek);
  return {
    startTime: defaults.startTime,
    endTime: defaults.endTime,
    slotDuration: DEFAULT_SLOT_DURATION,
    breaks: defaults.breaks.map((b) => ({ ...b })),
    isEnabled: defaults.isEnabled,
  };
}
