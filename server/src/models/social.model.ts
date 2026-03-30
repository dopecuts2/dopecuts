import { Schema, model, Document } from 'mongoose';

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'tiktok'
  | 'snapchat'
  | 'linkedin'
  | 'youtube'
  | 'pinterest'
  | 'whatsapp'
  | 'telegram';

export interface ISocial extends Document {
  platform: SocialPlatform;
  label: string;
  url: string;
  isActive: boolean;
  order: number;
}

const socialSchema = new Schema<ISocial>(
  {
    platform: {
      type: String,
      required: true,
      enum: [
        'instagram',
        'facebook',
        'twitter',
        'tiktok',
        'snapchat',
        'linkedin',
        'youtube',
        'pinterest',
        'whatsapp',
        'telegram',
      ],
    },
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Social = model<ISocial>('Social', socialSchema);
