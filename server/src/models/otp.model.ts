import { Schema, model, Document } from 'mongoose';

export interface IOtp extends Document {
  phone?: string;
  email?: string;
  otp: string;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    phone: { type: String, index: true, sparse: true },
    email: { type: String, index: true, sparse: true },
    otp: { type: String, required: true },
  },
  { timestamps: true }
);

// Auto-expire in 5 minutes
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

export const Otp = model<IOtp>('Otp', OtpSchema);