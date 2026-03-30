// src/models/product.model.ts
import { Schema, model, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  price: number;
  image?: string;
  description?: string;
  affiliateLink?: string; // <-- Added affiliate link
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    image: { type: String, trim: true },
    description: { type: String, trim: true },
    affiliateLink: { type: String, trim: true }, // <-- Added affiliate link
  },
  { timestamps: true }
);

export const Product = model<IProduct>('Product', productSchema);
