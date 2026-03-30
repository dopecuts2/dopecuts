// src/models/booking.model.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IBooking extends Document {
  service: string;
  price: number;
  duration: number;
  date: Date;
  time: string;
  phone: string;
  firstName: string;
  lastName?: string;
  email: string;
  notes?: string;
  // --- FIX: Changed 'later' to 'in-person' to match frontend ---
  paymentMethod: 'in-person' | 'now';
  status: 'confirmed' | 'pending' | 'cancelled';
  serviceId?: Types.ObjectId;
  phoneNormalized: string;
  cancellationNote?: string;
  additionalGuests?: Array<{
    firstName: string;
    lastName?: string;
    email?: string;
    serviceId?: Types.ObjectId;
    serviceName?: string;
    time?: string;
  }>;
}

const bookingSchema = new Schema<IBooking>({
  // Customer Info
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: false, trim: true, default: '' },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },

  // Service Info
  service: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: Number, required: true },

  // Appointment Details
  date: { type: Date, required: true },
  time: { type: String, required: true },
  notes: { type: String, trim: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
  phoneNormalized: { type: String, required: true, index: true },

  // Payment & Status
  // --- FIX: Changed 'later' to 'in-person' in the enum ---
  paymentMethod: { type: String, enum: ['in-person', 'now'], required: true },
  status: { type: String, enum: ['confirmed', 'pending', 'cancelled'], default: 'confirmed' },
  cancellationNote: { type: String, trim: true },
  additionalGuests: {
    type: [
      {
        firstName: { type: String, required: true },
        lastName: { type: String, required: false, default: '' },
        email: { type: String },
        serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
        serviceName: { type: String },
        time: { type: String },
      },
    ],
    default: [],
  },
}, { timestamps: true });

export const Booking = model<IBooking>('Booking', bookingSchema);
