// dopecut/dopecuts-server-main/src/models/smsQuota.model.ts
import { Schema, model, Document } from 'mongoose';

export interface ISmsQuota extends Document {
  // dateKey format: 'YYYY-MM-DD' in server's timezone (UTC recommended)
  dateKey: string;
  count: number;
}

const smsQuotaSchema = new Schema<ISmsQuota>({
  dateKey: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
}, { timestamps: true });

// Removed duplicate index - 'unique: true' on the field already creates an index

export const SmsQuota = model<ISmsQuota>('SmsQuota', smsQuotaSchema);