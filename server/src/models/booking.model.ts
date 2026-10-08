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
  // Short, human-friendly code shown to the customer and admin (e.g.
  // "DC-7F3K2A"), distinct from the Mongo _id. Unique per booking,
  // including each guest's own booking record.
  referenceNumber: string;
  additionalGuests?: Array<{
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    serviceId?: Types.ObjectId;
    serviceName?: string;
    time?: string;
  }>;
}

const REFERENCE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

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
  referenceNumber: { type: String, required: true, unique: true },

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
        phone: { type: String },
        serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
        serviceName: { type: String },
        time: { type: String },
      },
    ],
    default: [],
  },
}, { timestamps: true });

// Backfills referenceNumber on bookings created before this field existed,
// so re-saving a legacy booking (e.g. confirming payment, cancelling) never
// fails required-field validation for a code it never got at creation time.
bookingSchema.pre('validate', async function (next) {
  if (this.referenceNumber) return next();
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += REFERENCE_CHARS[Math.floor(Math.random() * REFERENCE_CHARS.length)];
    }
    const candidate = `DC-${code}`;
    const exists = await Booking.exists({ referenceNumber: candidate });
    if (!exists) {
      this.referenceNumber = candidate;
      return next();
    }
  }
  this.referenceNumber = `DC-${Date.now().toString(36).toUpperCase()}`;
  next();
});

export const Booking = model<IBooking>('Booking', bookingSchema);
