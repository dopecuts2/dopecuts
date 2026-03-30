// dopecut/dopecuts-server-main/src/models/contactTicket.model.ts
import { Schema, model, Types, Document } from 'mongoose';

export type ContactStatus = 'open' | 'answered' | 'closed';

export interface IContactResponse {
  subject: string;
  message: string;
  sentAt: Date;
  sentBy?: Types.ObjectId; // Admin._id
}

export interface IContactTicket extends Document {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;

  status: ContactStatus;
  adminNotes?: string;

  responses: IContactResponse[];

  meta?: {
    ip?: string | null;
    userAgent?: string | null;
    source?: 'web' | 'mobile' | 'other';
  };

  closedAt?: Date | null;
  closedBy?: Types.ObjectId | null; // Admin._id

  createdAt: Date;
  updatedAt: Date;
}

const contactResponseSchema = new Schema<IContactResponse>(
  {
    subject: { type: String, required: true },
    message: { type: String, required: true },
    sentAt: { type: Date, required: true, default: () => new Date() },
    sentBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { _id: false }
);

const contactTicketSchema = new Schema<IContactTicket>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ['open', 'answered', 'closed'],
      default: 'open',
      index: true,
    },
    adminNotes: { type: String },

    responses: { type: [contactResponseSchema], default: [] },

    meta: {
      ip: String,
      userAgent: String,
      source: { type: String, enum: ['web', 'mobile', 'other'], default: 'web' },
    },

    closedAt: { type: Date, default: null },
    closedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

// Search convenience
contactTicketSchema.index(
  { firstName: 'text', lastName: 'text', email: 'text', subject: 'text', message: 'text' },
  { name: 'contact_text_idx' }
);

export const ContactTicket = model<IContactTicket>('ContactTicket', contactTicketSchema);