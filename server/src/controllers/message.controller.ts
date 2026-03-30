import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Contact } from '../models/contact.model';
import { sendCustomEmailToCustomer } from '../services/emailService';
import { sendSms } from '../services/smsService';
import { logger } from '../utils/logger';

type EmailPayload = {
  subject: string;
  message: string;
};

type SmsPayload = {
  message: string;
};

type MessageCampaignPayload = {
  contactIds?: string[];
  sendToAll?: boolean;
  email?: EmailPayload;
  sms?: SmsPayload;
};

type ChannelSummary = {
  attempted: number;
  succeeded: number;
  skipped: number;
  failed: Array<{ contactId: string; reason: string }>;
};

const createChannelSummary = (): ChannelSummary => ({
  attempted: 0,
  succeeded: 0,
  skipped: 0,
  failed: [],
});

export const sendMessageCampaign = async (req: Request, res: Response) => {
  const { contactIds, sendToAll, email, sms } = (req.body ?? {}) as MessageCampaignPayload;
  const wantsEmail = Boolean(email);
  const wantsSms = Boolean(sms);

  if (!wantsEmail && !wantsSms) {
    return res.status(400).json({ message: 'At least one channel (email or sms) is required.' });
  }

  if (wantsEmail) {
    if (!email?.subject?.trim() || !email?.message?.trim()) {
      return res.status(400).json({ message: 'Email channel requires a subject and message.' });
    }
  }

  if (wantsSms) {
    if (!sms?.message?.trim()) {
      return res.status(400).json({ message: 'SMS channel requires a message body.' });
    }
  }

  const normalizedContactIds = Array.isArray(contactIds)
    ? Array.from(
        new Set(
          contactIds
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
      )
    : [];

  if (!sendToAll && normalizedContactIds.length === 0) {
    return res
      .status(400)
      .json({ message: 'Specify at least one contact or enable sendToAll to message everyone.' });
  }

  try {
    const idFilter = normalizedContactIds.map((id) => new mongoose.Types.ObjectId(id));
    const query = sendToAll ? {} : { _id: { $in: idFilter } };
    const recipients = await Contact.find(query).lean();

    if (recipients.length === 0) {
      return res.status(404).json({ message: 'No contacts were found for the requested recipients.' });
    }

    const emailSummary = wantsEmail ? createChannelSummary() : undefined;
    const smsSummary = wantsSms ? createChannelSummary() : undefined;
    const smsMessage = sms?.message.trim() ?? '';
    const emailMessage = email?.message.trim() ?? '';
    const emailSubject = email?.subject.trim() ?? '';

    for (const contact of recipients) {
      const contactId = contact._id?.toString() ?? 'unknown';

      if (smsSummary) {
        smsSummary.attempted += 1;
        if (!contact.phone) {
          smsSummary.skipped += 1;
          smsSummary.failed.push({ contactId, reason: 'missing_phone' });
        } else {
          try {
            const result = await sendSms(contact.phone, smsMessage);
            if (result.sent) {
              smsSummary.succeeded += 1;
            } else {
              const reason = result.reason || 'sms_failed';
              smsSummary.failed.push({ contactId, reason });
            }
          } catch (error) {
            smsSummary.failed.push({
              contactId,
              reason: error instanceof Error ? error.message : 'sms_exception',
            });
            logger.warn('SMS dispatch failed for contact', { contactId, error });
          }
        }
      }

      if (emailSummary) {
        emailSummary.attempted += 1;
        if (!contact.email) {
          emailSummary.skipped += 1;
          emailSummary.failed.push({ contactId, reason: 'missing_email' });
        } else {
          try {
            const result = await sendCustomEmailToCustomer(contact.email, emailSubject, emailMessage);
            if (result.success) {
              emailSummary.succeeded += 1;
            } else {
              const reason =
                typeof result.error === 'string'
                  ? result.error
                  : result.error instanceof Error
                  ? result.error.message
                  : 'email_service_failed';
              emailSummary.failed.push({ contactId, reason });
              logger.warn('Email dispatch failed for contact', { contactId, reason });
            }
          } catch (error) {
            emailSummary.failed.push({
              contactId,
              reason: error instanceof Error ? error.message : 'email_exception',
            });
            logger.warn('Email dispatch exception', { contactId, error });
          }
        }
      }
    }

    const responsePayload: {
      totalRecipients: number;
      email?: ChannelSummary;
      sms?: ChannelSummary;
    } = {
      totalRecipients: recipients.length,
    };
    if (emailSummary) responsePayload.email = emailSummary;
    if (smsSummary) responsePayload.sms = smsSummary;

    logger.info('Message campaign dispatched', {
      totalRecipients: recipients.length,
      email: emailSummary ? emailSummary.succeeded : undefined,
      sms: smsSummary ? smsSummary.succeeded : undefined,
    });

    return res.status(200).json(responsePayload);
  } catch (error) {
    logger.error('Failed to dispatch message campaign:', error);
    return res.status(500).json({ message: 'Failed to send messages.' });
  }
};
