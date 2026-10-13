import { Schema, model, Document, Types } from 'mongoose';

export interface IBarber extends Document {
  name: string;
  role: string;
  experience: string;
  image: string;
  order: number;
  isActive: boolean;
}

const barberSchema = new Schema<IBarber>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    experience: { type: String, default: '', trim: true },
    image: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Lets the public "active barbers, in order" query use the index instead
// of an in-memory sort, which can hit MongoDB's 32MB sort limit once a
// photo is stored as an oversized inline data URL (see imageService's
// fallback) rather than a small R2 link.
barberSchema.index({ isActive: 1, order: 1, createdAt: 1 });

export const Barber = model<IBarber>('Barber', barberSchema);
