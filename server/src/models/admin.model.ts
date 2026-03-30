import { Schema, model } from 'mongoose';

const adminSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
}, { timestamps: true });

export const Admin = model('Admin', adminSchema);