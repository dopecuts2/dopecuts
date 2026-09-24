// src/models/contact.model.ts
import { Schema, model, Document } from 'mongoose';

export interface IContact extends Document {
  name: string;
  email: string;
  phone: string;
}

const contactSchema = new Schema<IContact>({
  name: { type: String, required: true, trim: true },
  // Email is optional: many bulk-imported customer contacts (e.g. from a
  // phone contacts export) only have a name and phone number. `sparse`
  // keeps the unique constraint for contacts that DO have an email while
  // allowing any number of contacts with no email at all.
  email: { type: String, required: false, unique: true, sparse: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true }); // timestamps adds createdAt and updatedAt automatically

export const Contact = model<IContact>('Contact', contactSchema);