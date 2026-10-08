// dopecuts-server/src/models/customerRestriction.model.ts
import { Schema, model, Document } from 'mongoose';

// A persistent, admin-manageable restriction on a phone number, separate
// from the raw cancellation count it may have been triggered by. Keeping
// it as its own record (rather than recomputing "3+ cancellations" on
// every booking attempt) is what lets an admin actually remove it --
// otherwise the same recomputed count would just re-trigger it instantly.
export type RestrictionStatus = 'pay_now_required' | 'banned';

export interface ICustomerRestriction extends Document {
  phone: string; // original/display format
  phoneNormalized: string;
  status: RestrictionStatus;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerRestrictionSchema = new Schema<ICustomerRestriction>({
  phone: { type: String, required: true, trim: true },
  phoneNormalized: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['pay_now_required', 'banned'], required: true },
  reason: { type: String, trim: true },
}, { timestamps: true });

export const CustomerRestriction = model<ICustomerRestriction>(
  'CustomerRestriction',
  customerRestrictionSchema
);
