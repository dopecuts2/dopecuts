// src/models/service.model.ts
import { Schema, model, Document } from 'mongoose';

export interface IService extends Document {
  name: string;
  duration: number; // Duration in minutes
  price: number;
  description?: string;
}

const serviceSchema = new Schema<IService>({
  name: { 
    type: String, 
    required: true, 
    trim: true,
    unique: true 
  },
  duration: { 
    type: Number, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true 
  },

  description: { 
    type: String,
  },
}, { timestamps: true });

export const Service = model<IService>('Service', serviceSchema);