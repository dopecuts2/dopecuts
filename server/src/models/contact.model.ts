// src/models/contact.model.ts
import { Schema, model, Document } from 'mongoose';

export interface IContact extends Document {
  name: string;
  email: string;
  phone: string;
}

const contactSchema = new Schema<IContact>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true }); // timestamps adds createdAt and updatedAt automatically

export const Contact = model<IContact>('Contact', contactSchema);