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

export const Barber = model<IBarber>('Barber', barberSchema);
