// dopecut/dopecuts-server-main/src/models/notificationSettings.model.ts
import { Schema, model, Document } from 'mongoose';

export interface INotificationSettings extends Document {
  // Single-document config; we keep a stable key to avoid multiples
  key: 'global';
  emailEnabled: boolean;                 // master switch for all customer/admin emails
  smsEnabled: boolean;                   // master switch for all SMS (customer + admin)
  autoSendBookingConfirmations: boolean; // controls ONLY the auto "booking confirmed" email
  timezone: string;                      // IANA tz, e.g. "America/Toronto"
  siteNoticeEnabled: boolean;
  siteNoticeMessage: string;
  productNoticeEnabled: boolean;
  productNoticeMessage: string;
  calendarWeeks: number;
  // Which set of selectable service durations the admin Services page
  // offers: 'standard' = 15/30/45/60 min, 'legacy' = 20/40 min (matches
  // the scheme the old dopecuts.ca site used).
  durationPreset: 'standard' | 'legacy';
  // Appointment reminder emails: two independently toggleable reminders,
  // each firing a configurable number of minutes before the appointment.
  reminder1Enabled: boolean;
  reminder1MinutesBefore: number;
  reminder2Enabled: boolean;
  reminder2MinutesBefore: number;
}

const notificationSettingsSchema = new Schema<INotificationSettings>({
  key: { type: String, required: true, unique: true, default: 'global' },
  emailEnabled: { type: Boolean, required: true, default: true },
  smsEnabled: { type: Boolean, required: true, default: true },
  autoSendBookingConfirmations: { type: Boolean, required: true, default: true },
  timezone: { type: String, required: true, default: 'America/Toronto' },
  siteNoticeEnabled: { type: Boolean, required: true, default: false },
  siteNoticeMessage: { type: String, default: '' },
  productNoticeEnabled: { type: Boolean, required: true, default: false },
  productNoticeMessage: { type: String, default: '' },
  calendarWeeks: { type: Number, required: true, default: 3, min: 1, max: 12 },
  durationPreset: {
    type: String,
    required: true,
    enum: ['standard', 'legacy'],
    default: 'standard',
  },
  reminder1Enabled: { type: Boolean, required: true, default: true },
  reminder1MinutesBefore: { type: Number, required: true, default: 90, min: 5, max: 10080 },
  reminder2Enabled: { type: Boolean, required: true, default: true },
  reminder2MinutesBefore: { type: Number, required: true, default: 1440, min: 5, max: 10080 },
}, { timestamps: true });

// Removed duplicate index - 'unique: true' on the field already creates an index

export const NotificationSettings = model<INotificationSettings>(
  'NotificationSettings',
  notificationSettingsSchema
);
