import { Schema, model, Document } from 'mongoose';

export interface IBlockedTime extends Document {
  startTime: string;
  endTime: string;
  // Whether this break still blocks time. Defaults to true (including for
  // documents saved before this flag existed) -- turning it off opens that
  // window up to customers without losing the configured start/end times.
  isEnabled: boolean;
}

export interface IWeeklyCalendarDay {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isEnabled: boolean;
  // When true, this day ignores its own startTime/endTime/blockedTimes and
  // dynamically follows the shop's Default Schedule instead -- so editing
  // the default later updates every day still toggled on, with no need to
  // re-save each week.
  useDefaultHours: boolean;
  blockedTimes: Array<{ startTime: string; endTime: string; isEnabled: boolean }>;
}

export interface IWeeklyCalendar extends Document {
  weekStart: string; // YYYY-MM-DD (ISO week start)
  days: IWeeklyCalendarDay[];
  slotDuration: number;
}

const blockedTimeSchema = new Schema<IBlockedTime>({
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  isEnabled: { type: Boolean, required: true, default: true },
}, { _id: false });

const weeklyDaySchema = new Schema<IWeeklyCalendarDay>({
  dayOfWeek: {
    type: String,
    required: true,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  slotDuration: { type: Number, required: true, default: 40 },
  isEnabled: { type: Boolean, required: true, default: true },
  useDefaultHours: { type: Boolean, required: true, default: false },
  blockedTimes: {
    type: [blockedTimeSchema],
    default: [],
  },
}, { _id: false });

const weeklyCalendarSchema = new Schema<IWeeklyCalendar>({
  weekStart: { type: String, required: true, unique: true },
  days: { type: [weeklyDaySchema], required: true },
  slotDuration: { type: Number, required: true, default: 40 },
}, { timestamps: true });

export const WeeklyCalendar = model<IWeeklyCalendar>('WeeklyCalendar', weeklyCalendarSchema);
