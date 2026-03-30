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
}

const notificationSettingsSchema = new Schema<INotificationSettings>({
  key: { type: String, required: true, unique: true, default: 'global' },
  emailEnabled: { type: Boolean, required: true, default: true },
  smsEnabled: { type: Boolean, required: true, default: true },
  autoSendBookingConfirmations: { type: Boolean, required: true, default: true },
  timezone: { type: String, required: true, default: 'America/Toronto' },
  siteNoticeEnabled: { type: Boolean, required: true, default: false },
  siteNoticeMessage: { type: String, required: true, default: '' },
  productNoticeEnabled: { type: Boolean, required: true, default: false },
  productNoticeMessage: { type: String, required: true, default: '' },
  calendarWeeks: { type: Number, required: true, default: 4, min: 1, max: 12 },
}, { timestamps: true });

// Removed duplicate index - 'unique: true' on the field already creates an index

export const NotificationSettings = model<INotificationSettings>(
  'NotificationSettings',
  notificationSettingsSchema
);
