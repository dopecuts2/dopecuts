// dopecuts-server/src/models/calendar.model.ts
import { Schema, model, Document } from 'mongoose';

// Interface for a break time slot
export interface IBreak extends Document {
  startTime: string; // e.g., "12:00"
  endTime: string;   // e.g., "13:00"
}

// Main interface for calendar settings
export interface ICalendarSettings extends Document {
  dayOfWeek: string; // e.g., "Monday", "Tuesday"
  startTime: string; // e.g., "09:00"
  endTime: string;   // e.g., "18:00"
  slotDuration: number; // Duration in minutes, e.g., 30
  isEnabled: boolean; // Whether the shop is open on this day
  breaks: IBreak[];
}

const breakSchema = new Schema<IBreak>({
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
}, { _id: false });

const calendarSettingsSchema = new Schema<ICalendarSettings>({
  dayOfWeek: { 
    type: String, 
    required: true, 
    unique: true, 
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] 
  },
  startTime: { type: String, required: true, default: '09:00' },
  endTime: { type: String, required: true, default: '18:00' },
  slotDuration: { type: Number, required: true, default: 40 },
  isEnabled: { type: Boolean, required: true, default: true },
  breaks: { type: [breakSchema], default: [] },
}, { timestamps: true });

export const CalendarSettings = model<ICalendarSettings>('CalendarSettings', calendarSettingsSchema);
