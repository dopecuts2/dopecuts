// dopecut/dopecuts-server-main/src/services/smsService.ts
import { SNSClient, PublishCommand, SetSMSAttributesCommand } from '@aws-sdk/client-sns';
import moment from 'moment';
import {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  SMS_SENDER_ID,
  SMS_FORCE_SENDER_ID,
  ADMIN_PHONE,
  SMS_DAILY_LIMIT,
} from '../config/env';
import { SmsQuota } from '../models/smsQuota.model';
import { logger } from '../utils/logger';
import { getNotificationSettings } from './notificationSettingsService';

// ------------------------------
// AWS SNS bootstrap
// ------------------------------
const haveAwsCreds =
  !!AWS_ACCESS_KEY_ID &&
  !!AWS_SECRET_ACCESS_KEY &&
  !!AWS_REGION;

let snsClient: SNSClient | null = null;

async function initSmsAttributes() {
  if (!snsClient) return;
  try {
    const cmd = new SetSMSAttributesCommand({
      attributes: {
        DefaultSMSType: 'Transactional',
        MonthlySpendLimit: '100',
      },
    });
    await snsClient.send(cmd);
    logger.info('SNS SMS attributes set (Transactional; MonthlySpendLimit=100).');
  } catch (err) {
    logger.warn('SetSMSAttributes failed (non-fatal):', err);
  }
}

if (haveAwsCreds) {
  snsClient = new SNSClient({
    region: AWS_REGION!, // must be an SMS-enabled region (e.g., us-east-1)
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID!,
      secretAccessKey: AWS_SECRET_ACCESS_KEY!,
    },
  });

  logger.info('AWS SNS client initialized for SMS', {
    region: AWS_REGION,
    hasKey: !!AWS_ACCESS_KEY_ID,
    hasSecret: !!AWS_SECRET_ACCESS_KEY,
  });

  initSmsAttributes().catch((e) => logger.warn('initSmsAttributes failed:', e));
} else {
  logger.warn('AWS SNS credentials/region not configured. SMS disabled.');
}

// ------------------------------
// Helpers
// ------------------------------
const todayKey = () => moment().utc().format('YYYY-MM-DD');

async function incrementAndCheckQuota(): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const key = todayKey();
    const doc = await SmsQuota.findOneAndUpdate(
      { dateKey: key },
      { $inc: { count: 1 } },
      { upsert: true, new: true }
    );
    const used = doc.count;
    const remaining = Math.max(0, SMS_DAILY_LIMIT - used);
    return { allowed: used <= SMS_DAILY_LIMIT, remaining };
  } catch (err) {
    logger.error('Failed to update SMS quota counter:', err);
    return { allowed: false, remaining: 0 };
  }
}

async function peekQuota(): Promise<{ allowed: boolean; remaining: number; used: number }> {
  const key = todayKey();
  const doc = await SmsQuota.findOne({ dateKey: key });
  const used = doc?.count || 0;
  const remaining = Math.max(0, SMS_DAILY_LIMIT - used);
  return { allowed: used < SMS_DAILY_LIMIT, remaining, used };
}

function normalizeE164(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return s;
  if (s.startsWith('+')) return s.replace(/\s+/g, '');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`; // assume NANPA
  if (digits.length > 0 && !digits.startsWith('1') && !digits.startsWith('0')) {
    // generic best-effort: treat as international without the '+'
    return `+${digits}`;
  }
  return `+${digits}`;
}

function isNanpa(phone: string): boolean {
  return /^\+1\d{7,15}$/.test(phone);
}

async function smsFeatureEnabled(): Promise<boolean> {
  try {
    const settings = await getNotificationSettings();
    if (settings && typeof settings.smsEnabled === 'boolean') {
      return settings.smsEnabled;
    }
    return true; // default allow
  } catch (err) {
    logger.warn('getNotificationSettings failed; allowing SMS by default', { err });
    return true;
  }
}

// ------------------------------
// Public API
// ------------------------------
export async function sendSms(
  phone: string,
  message: string
): Promise<{ sent: boolean; reason?: string; details?: any; messageId?: string }> {
  const target = normalizeE164(phone);

  logger.info('SMS send attempt', {
    to: target,
    len: message?.length ?? 0,
    region: AWS_REGION,
    trySenderId: !!SMS_SENDER_ID,
    forceSenderIdForPlus1: SMS_FORCE_SENDER_ID,
  });

  if (!(await smsFeatureEnabled())) {
    logger.info('SMS suppressed by notification settings.');
    return { sent: false, reason: 'sms_disabled' };
  }

  if (!snsClient) {
    logger.warn('SMS not sent: SNS client unavailable (check AWS creds/region).');
    return { sent: false, reason: 'sms_disabled' };
  }

  const pre = await peekQuota();
  if (!pre.allowed) {
    logger.warn('SMS quota exhausted', { used: pre.used, limit: SMS_DAILY_LIMIT });
    return { sent: false, reason: 'quota_exhausted' };
  }

  const baseAttrs: Record<string, any> = {
    'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
  };

  const shouldAttachSenderId = !!SMS_SENDER_ID && (SMS_FORCE_SENDER_ID || !isNanpa(target));
  const attrsWithSenderId = { ...baseAttrs };
  if (shouldAttachSenderId) {
    attrsWithSenderId['AWS.SNS.SMS.SenderID'] = {
      DataType: 'String',
      StringValue: String(SMS_SENDER_ID),
    };
  } else if (SMS_SENDER_ID && !SMS_FORCE_SENDER_ID && isNanpa(target)) {
    logger.info('Skipping SenderID for +1 destination (set SMS_FORCE_SENDER_ID=true to try anyway).', {
      to: target,
      senderId: SMS_SENDER_ID,
    });
  }

  const publish = async (attrs: Record<string, any>) => {
    return snsClient!.send(new PublishCommand({
      Message: message,
      PhoneNumber: target,
      MessageAttributes: attrs,
    }));
  };

  try {
    let out = await publish(attrsWithSenderId);

    const { allowed, remaining } = await incrementAndCheckQuota();
    if (!allowed) logger.warn('SMS quota hit right after send');

    const messageId = (out as any)?.MessageId;
    logger.info('SMS sent', {
      to: target,
      usedSenderId: shouldAttachSenderId ? SMS_SENDER_ID : undefined,
      messageId,
      remaining,
      meta: (out as any)?.$metadata,
    });

    return { sent: true, details: out, messageId };
  } catch (e1: any) {
    if (shouldAttachSenderId) {
      logger.warn('SenderID attempt failed; retrying without SenderID', {
        to: target, code: e1?.name || e1?.code, message: e1?.message,
      });
      try {
        const out2 = await publish(baseAttrs);

        const { allowed, remaining } = await incrementAndCheckQuota();
        if (!allowed) logger.warn('SMS quota hit right after fallback send');

        const messageId = (out2 as any)?.MessageId;
        logger.info('SMS sent (fallback, no SenderID)', {
          to: target, messageId, remaining,
          meta: (out2 as any)?.$metadata,
        });

        return { sent: true, details: out2, messageId };
      } catch (e2: any) {
        logger.error('SMS failed after fallback', {
          to: target, code: e2?.name || e2?.code, message: e2?.message, meta: e2?.$metadata,
        });
        return { sent: false, reason: 'send_error', details: { code: e2?.name || e2?.code, message: e2?.message } };
      }
    }

    logger.error('SMS failed', {
      to: target, code: e1?.name || e1?.code, message: e1?.message, meta: e1?.$metadata,
    });
    return { sent: false, reason: 'send_error', details: { code: e1?.name || e1?.code, message: e1?.message } };
  }
}

export async function sendAdminSms(
  message: string
): Promise<{ sent: boolean; reason?: string; details?: any; messageId?: string }> {
  if (!(await smsFeatureEnabled())) {
    logger.info('Admin SMS suppressed by notification settings.');
    return { sent: false, reason: 'sms_disabled' };
  }

  if (!ADMIN_PHONE) {
    logger.warn('ADMIN_PHONE not configured; skipping admin SMS.');
    return { sent: false, reason: 'no_admin_phone' };
  }

  return sendSms(ADMIN_PHONE, message);
}
