import { Schema, model, Document } from 'mongoose';

export interface IQueueSettings extends Document {
  enforcePrepayForQueue: boolean;
}

const queueSettingsSchema = new Schema<IQueueSettings>({
  enforcePrepayForQueue: { type: Boolean, default: false },
}, { timestamps: true });

export const QueueSettings = model<IQueueSettings>('QueueSettings', queueSettingsSchema);
