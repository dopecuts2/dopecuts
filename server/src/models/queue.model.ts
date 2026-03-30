import { Schema, model, Document, Types } from 'mongoose';

export interface IQueueEntry extends Document {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  phoneNormalized: string;
  serviceId: Types.ObjectId;
  serviceName: string;
  requestedDate: string; // YYYY-MM-DD
  desiredTime?: string; // optional preferred time label, e.g., "3:30 PM"
  preferAnytime?: boolean;
  preferredPaymentMethod: 'in-person' | 'now';
  status: 'pending' | 'assigned' | 'expired';
  notes?: string;
  assignedBooking?: Types.ObjectId;
  assignedTime?: string;
  additionalGuests?: Array<{
    firstName: string;
    lastName?: string;
    email?: string;
  }>;
}

const queueEntrySchema = new Schema<IQueueEntry>({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: false, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  phoneNormalized: { type: String, required: true, index: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  serviceName: { type: String, required: true },
  requestedDate: { type: String, required: true },
  desiredTime: { type: String, trim: true },
  preferAnytime: { type: Boolean, default: true },
  preferredPaymentMethod: { type: String, enum: ['in-person', 'now'], default: 'in-person' },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'expired'],
    default: 'pending',
  },
  notes: { type: String, trim: true },
  assignedBooking: { type: Schema.Types.ObjectId, ref: 'Booking' },
  assignedTime: { type: String },
  additionalGuests: {
    type: [
      {
        firstName: { type: String, required: true },
        lastName: { type: String, required: false, default: '' },
        email: { type: String },
      },
    ],
    default: [],
  },
}, { timestamps: true });

export const QueueEntry = model<IQueueEntry>('QueueEntry', queueEntrySchema);
