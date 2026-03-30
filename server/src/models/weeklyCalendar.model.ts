import { Schema, model, Document } from 'mongoose';

export interface IBlockedTime extends Document {
  startTime: string;
  endTime: string;
}

export interface IWeeklyCalendarDay {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isEnabled: boolean;
  blockedTimes: Array<{ startTime: string; endTime: string }>;
}

export interface IWeeklyCalendar extends Document {
  weekStart: string; // YYYY-MM-DD (ISO week start)
  days: IWeeklyCalendarDay[];
  slotDuration: number;
}

const blockedTimeSchema = new Schema<IBlockedTime>({
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
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
