// dopecut/dopecuts-server-main/src/config/env.ts
import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 5001;
export const MONGO_URI = process.env.MONGO_URI as string;
export const JWT_SECRET = process.env.JWT_SECRET as string;
export const RESEND_API_KEY = process.env.RESEND_API_KEY as string;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'dopecuts.ca@gmail.com';

// Cloudflare R2
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
export const CLOUDFLARE_PUBLIC_URL = process.env.CLOUDFLARE_PUBLIC_URL;

// AWS SNS (SMS)
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// SMS config
export const SMS_SENDER_ID = process.env.SMS_SENDER_ID; // string; may be alpha or numeric
export const SMS_FORCE_SENDER_ID = process.env.SMS_FORCE_SENDER_ID === 'true'; // try SenderID even for +1
export const ADMIN_PHONE = process.env.ADMIN_PHONE;     // required for admin SMS
export const SMS_DAILY_LIMIT = Number(process.env.SMS_DAILY_LIMIT || 20);