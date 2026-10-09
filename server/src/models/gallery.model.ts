// src/models/gallery.model.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IGalleryItem extends Document {
  category: string;
  image: string;
  serviceId: Types.ObjectId;
  serviceName: string;
}

const galleryItemSchema = new Schema<IGalleryItem>(
  {
    category: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    serviceName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Lets the default findAll sort use the index instead of an in-memory sort,
// which previously hit MongoDB's 32MB sort limit once a few items were
// stored as oversized inline data URLs (see imageService's fallback).
galleryItemSchema.index({ createdAt: -1 });

export const GalleryItem = model<IGalleryItem>('GalleryItem', galleryItemSchema);
