// dopecut/dopecuts-server-main/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/admin.model';
import { Otp } from '../models/otp.model';
import { sendOtpEmail } from '../services/emailService';
import { JWT_SECRET, ADMIN_PHONE } from '../config/env';
import { logger } from '../utils/logger';
import { sendSms } from '../services/smsService';

/**
 * DEV SETTINGS
 * - Toggle seeding and OTP bypass via env flags so they never affect production.
 * - By default, they only activate when NODE_ENV !== 'production'.
 */
const IS_PROD = process.env.NODE_ENV === 'production';
const DEV_SEED_ENABLED =
  (!IS_PROD && process.env.DEV_SEED !== 'false') || process.env.DEV_SEED === 'true';
const DEV_ALLOW_OTP_BYPASS =
  (!IS_PROD && process.env.DEV_ALLOW_OTP_BYPASS !== 'false') || process.env.DEV_ALLOW_OTP_BYPASS === 'true';

const DEV_TEST_EMAIL = 'grey@linconwaves.com';
const BYPASS_OTP = '000000';

const DEFAULT_ALLOWED_ADMINS = [
  process.env.ADMIN_EMAIL,
  process.env.ALLOWED_ADMIN_EMAILS,
  // Seed/admin defaults used elsewhere in the project
  'leeroy@dopecuts.ca',
  DEV_TEST_EMAIL,
]
  .join(',')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_ADMIN_EMAILS = new Set(DEFAULT_ALLOWED_ADMINS);
const OTP_SMS_EMAILS = new Set([...ALLOWED_ADMIN_EMAILS, 'leeroy@dopecuts.ca']);

/**
 * Ensure a dev admin exists. Kept inside the controller module as requested.
 * Safe to call on each request; it’s an idempotent upsert.
 */
async function ensureDevAdminSeed() {
  if (!DEV_SEED_ENABLED) return;
  await Admin.findOneAndUpdate(
    { email: DEV_TEST_EMAIL },
    { $setOnInsert: { email: DEV_TEST_EMAIL } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Step 1: Admin enters email, and we send an OTP
export const requestOtp = async (req: Request, res: Response) => {
  try {
    // Seed dev admin if enabled
    await ensureDevAdminSeed();

    const { email } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    logger.info(`requestOtp: incoming email=${normalizedEmail}, allowed=${ALLOWED_ADMIN_EMAILS.has(normalizedEmail)}`);

    // Check if the email exists in the Admin collection
    let admin = await Admin.findOne({ email: normalizedEmail });
    if (!admin && ALLOWED_ADMIN_EMAILS.has(normalizedEmail)) {
      // Auto-provision the configured admin if it doesn't exist yet (common in fresh prod)
      admin = await Admin.findOneAndUpdate(
        { email: normalizedEmail },
        { $setOnInsert: { email: normalizedEmail } },
        { new: true, upsert: true }
      );
      logger.info(`requestOtp: auto-provisioned admin=${normalizedEmail}`);
    }
    if (!admin) {
      logger.warn(`requestOtp: rejected non-whitelisted email=${normalizedEmail}`);
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Generate 6-digit OTP (not used if bypass OTP 000000 is entered during verification)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate({ email: normalizedEmail }, { otp }, { upsert: true, new: true });
    await sendOtpEmail(normalizedEmail, otp);

    if (ADMIN_PHONE && OTP_SMS_EMAILS.has(normalizedEmail)) {
      const smsText = `Dopecuts admin OTP: ${otp}. Code expires soon.`;
      sendSms(ADMIN_PHONE, smsText).then((result) => {
        logger.info('OTP SMS dispatched', { to: ADMIN_PHONE, sent: result.sent, reason: result.reason });
      }).catch((err) => {
        logger.error('Failed to send OTP SMS', { err });
      });
    }

    return res.status(200).json({ message: 'OTP sent to your email successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// Step 2: Admin verifies OTP, we return a JWT in a cookie
export const verifyOtpAndLogin = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // DEV bypass path: allow OTP "000000" when enabled
    let otpRecord = null as null | { _id: string };
    if (DEV_ALLOW_OTP_BYPASS && otp === BYPASS_OTP) {
      // No DB lookup for Otp in bypass mode
    } else {
      // Normal verification path
      const found = await Otp.findOne({ email: normalizedEmail, otp });
      if (!found) {
        return res.status(400).json({ message: 'Invalid OTP or OTP has expired' });
      }
      otpRecord = found as any;
    }

    // Since the `requestOtp` step already verified the admin exists, we can safely find them here.
    const admin = await Admin.findOne({ email: normalizedEmail });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found.' });
    }

    // Create JWT
    const token = jwt.sign({ id: admin._id, email: admin.email }, JWT_SECRET, {
      expiresIn: '7d',
    });

    // Set JWT in an HTTP-Only cookie for security
    res.cookie('token', token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Clean up the used OTP in normal flow
    if (otpRecord?._id) {
      await Otp.deleteOne({ _id: otpRecord._id });
    }

    return res.status(200).json({ message: 'Login successful', admin });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify OTP' });
  }
};
