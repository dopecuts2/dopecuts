// dopecuts-server/src/models/apiKey.model.ts
import { Schema, model, Document } from 'mongoose';

// A single revocable key that lets an external AI app (or anything else)
// create bookings on the owner's behalf through the /external API, without
// needing a full admin login. Only a SHA-256 hash of the raw key is ever
// stored -- the raw value is shown once, at generation time, and can't be
// retrieved again.
export interface IApiKey extends Document {
  label: string;
  keyHash: string;
  keyPrefix: string; // first few characters of the raw key, for display only
  createdAt: Date;
  lastUsedAt?: Date;
}

const apiKeySchema = new Schema<IApiKey>({
  label: { type: String, required: true, default: 'AI Booking Access' },
  keyHash: { type: String, required: true, unique: true },
  keyPrefix: { type: String, required: true },
  lastUsedAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const ApiKey = model<IApiKey>('ApiKey', apiKeySchema);
