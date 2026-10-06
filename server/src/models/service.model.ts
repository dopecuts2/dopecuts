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
    required: true,
    // Union of both admin-selectable duration presets (standard:
    // 15/30/45/60, legacy: 20/40) so switching the active preset never
    // invalidates a service saved under the other one.
    enum: {
      values: [15, 20, 30, 40, 45, 60],
      message: 'Duration must be one of 15, 20, 30, 40, 45, or 60 minutes.',
    },
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