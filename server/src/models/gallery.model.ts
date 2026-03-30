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

export const GalleryItem = model<IGalleryItem>('GalleryItem', galleryItemSchema);
