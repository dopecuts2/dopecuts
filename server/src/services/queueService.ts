import moment from 'moment-timezone';
import { Types } from 'mongoose';
import { Booking, IBooking } from '../models/booking.model';
import { QueueEntry, IQueueEntry } from '../models/queue.model';
import { Service } from '../models/service.model';
import {
  sendBookingConfirmationEmail,
  sendAdminNotificationEmail,
  sendBookingPendingEmail,
} from './emailService';
import { sendSms, sendAdminSms } from './smsService';
import { logger } from '../utils/logger';
import { buildCustomerSms, formatAdminBookingLine } from '../utils/bookingNotifications';
import { normalizePhoneDigits } from '../utils/phone';
import { getBusinessTimezone } from '../utils/timezone';

const SWEEP_INTERVAL_MS = 1000 * 60 * 15; // every 15 minutes
const ADAPTIVE_SERVICE_RULES: Array<{ keywords: string[]; duration: number }> = [
  { keywords: ['kids cut', 'kid cut'], duration: 20 },
  { keywords: ['hair line up', 'hair line-up', 'hair lineup', 'lineup'], duration: 20 },
  { keywords: ['beard trim'], duration: 20 },
  { keywords: ['deluxe'], duration: 60 },
];

function resolveAdaptiveDuration(serviceName: string | undefined, baseDuration: number) {
  const normalized = (serviceName || '').toLowerCase();
  const rule = ADAPTIVE_SERVICE_RULES.find((r) =>
    r.keywords.some((keyword) => normalized.includes(keyword))
  );
  return rule ? rule.duration : baseDuration;
}
export interface QueueJoinPayload {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  serviceId: string;
  requestedDate: string; // YYYY-MM-DD
  desiredTime?: string;
  preferAnytime?: boolean;
  preferredPaymentMethod?: 'in-person' | 'now';
  notes?: string;
  additionalGuests?: Array<{
    firstName: string;
    lastName?: string;
    email?: string;
  }>;
}

async function expireEntry(entry: IQueueEntry) {
  entry.status = 'expired';
  await entry.save();

  const message = `Hi ${entry.firstName}, we weren’t able to find an opening on ${entry.requestedDate}. Please try booking another day.`;
  const smsRes = await sendSms(entry.phone, message);
  if (!smsRes.sent) {
    logger.warn('Queue: failed to notify user about no availability', { reason: smsRes.reason, phone: entry.phone });
  }
}

export async function joinQueue(payload: QueueJoinPayload) {
  const {
    phone,
    firstName,
    lastName,
    email,
    serviceId,
    requestedDate,
    desiredTime,
    preferAnytime,
    preferredPaymentMethod = 'in-person',
    notes,
    additionalGuests = [],
  } = payload;

  const normalized = normalizePhoneDigits(phone);
  if (!normalized) {
    throw new Error('Valid phone is required to join the queue.');
  }

  const targetDate = moment.utc(requestedDate, 'YYYY-MM-DD', true);
  if (!targetDate.isValid() || targetDate.isBefore(moment.utc().startOf('day'))) {
    throw new Error('Queue requests must be for today or a future date.');
  }

  const service = await Service.findById(serviceId);
  if (!service) {
    throw new Error('Invalid service selected for queue.');
  }

  const existing = await QueueEntry.findOne({
    phoneNormalized: normalized,
    serviceId,
    requestedDate: targetDate.format('YYYY-MM-DD'),
    status: 'pending',
  });

  const cancellationCount = await Booking.countDocuments({
    phoneNormalized: normalized,
    status: 'cancelled',
  });

  if (existing) {
    throw new Error('You are already in the queue for this service and day.');
  }

  // Payment rule intentionally not enforced for queue entries; admins will assign payment method later.

  const normalizedLastName = (lastName || '').trim();
  const sanitizedGuests = additionalGuests.map((guest) => ({
    firstName: guest.firstName,
    lastName: (guest.lastName || '').trim(),
    email: guest.email?.toLowerCase(),
  }));

  const entry = new QueueEntry({
    firstName,
    lastName: normalizedLastName,
    email: email?.toLowerCase(),
    phone,
    phoneNormalized: normalized,
    serviceId,
    serviceName: service.name,
    requestedDate: targetDate.format('YYYY-MM-DD'),
    desiredTime: (desiredTime || '').trim() || undefined,
    preferAnytime: preferAnytime !== false,
    preferredPaymentMethod,
    notes,
    additionalGuests: sanitizedGuests,
  });

  await entry.save();
  return entry;
}

export async function assignQueueEntryForSlot(cancelledBooking: IBooking) {
  if (!cancelledBooking.date || !cancelledBooking.time || !cancelledBooking.serviceId) {
    return;
  }

  const timezone = await getBusinessTimezone();
  const dateKey = moment.utc(cancelledBooking.date).format('YYYY-MM-DD');
  const entry = await QueueEntry.findOne({
    requestedDate: dateKey,
    serviceId: cancelledBooking.serviceId,
    status: 'pending',
  }).sort({ createdAt: 1 });

  if (!entry) {
    return;
  }

  const service = await Service.findById(entry.serviceId);
  if (!service) {
    logger.warn('Queue: service disappeared while assigning queue entry', {
      serviceId: entry.serviceId,
      queueEntry: entry._id,
    });
    entry.status = 'expired';
    await entry.save();
    return;
  }

  const sanitizedGuests =
    (entry.additionalGuests || []).map((guest) => ({
      firstName: guest.firstName,
      lastName: guest.lastName || '',
      email: guest.email,
    })) || [];

  const bookingData = {
    firstName: entry.firstName,
    lastName: entry.lastName || '',
    email: entry.email || cancelledBooking.email,
    phone: entry.phone,
    phoneNormalized: entry.phoneNormalized,
    service: service.name,
    serviceId: service._id,
    price: service.price,
    duration: resolveAdaptiveDuration(service.name, service.duration),
    date: moment.utc(entry.requestedDate, 'YYYY-MM-DD').toDate(),
    time: cancelledBooking.time,
    notes: entry.notes ? `Queue assignment: ${entry.notes}` : 'Assigned from queue',
    paymentMethod: entry.preferredPaymentMethod || 'in-person',
    status: (entry.preferredPaymentMethod || 'in-person') === 'now' ? 'pending' : 'confirmed',
    additionalGuests: sanitizedGuests,
  };

  const newBooking = new Booking(bookingData);
  const savedBooking = await newBooking.save();

  entry.status = 'assigned';
  entry.assignedBooking = savedBooking._id as Types.ObjectId;
  entry.assignedTime = cancelledBooking.time;
  await entry.save();

  // Send notifications
  const customerEmailPromise =
    savedBooking.status === 'pending'
      ? sendBookingPendingEmail(savedBooking)
      : sendBookingConfirmationEmail(savedBooking);

  customerEmailPromise.catch((err) =>
    logger.error('Queue: failed to send customer email after assignment', err)
  );

  sendAdminNotificationEmail(savedBooking).catch((err) =>
    logger.error('Queue: failed to notify admin of queue assignment', err)
  );

  const smsType = savedBooking.status === 'pending' ? 'pending' : 'confirmed';
  const smsText = buildCustomerSms(smsType, savedBooking);
  const smsResult = await sendSms(savedBooking.phone, smsText);
  if (!smsResult.sent) {
    logger.warn('Queue: failed to SMS customer after assignment', { reason: smsResult.reason, phone: savedBooking.phone });
  }

  const adminLine = formatAdminBookingLine(savedBooking, timezone);
  const guestSuffix =
    savedBooking.additionalGuests && savedBooking.additionalGuests.length > 0
      ? ` [+${savedBooking.additionalGuests.length} guest${savedBooking.additionalGuests.length > 1 ? 's' : ''}]`
      : '';
  const adminSmsText = `Queue slot assigned: ${adminLine}${guestSuffix}`;
  sendAdminSms(adminSmsText).catch((err) =>
    logger.error('Queue: failed to SMS admin after assignment', err)
  );
}

export async function convertQueueEntry(entryId: string, time: string, overrideServiceId?: string) {
  const entry = await QueueEntry.findById(entryId);
  if (!entry) {
    throw new Error('Queue entry not found.');
  }
  const timezone = await getBusinessTimezone();
  const serviceToUse = overrideServiceId || entry.serviceId;
  const service = await Service.findById(serviceToUse);
  if (!service) {
    throw new Error('Service not found for queue entry.');
  }

  const bookingData = {
    firstName: entry.firstName,
    lastName: entry.lastName || '',
    email: entry.email || undefined,
    phone: entry.phone,
    phoneNormalized: entry.phoneNormalized,
    service: service.name,
    serviceId: service._id,
    price: service.price,
    duration: resolveAdaptiveDuration(service.name, service.duration),
    date: moment.utc(entry.requestedDate, 'YYYY-MM-DD').toDate(),
    time,
    notes: entry.notes ? `Queue conversion: ${entry.notes}` : 'Converted from queue',
    paymentMethod: entry.preferredPaymentMethod || 'in-person',
    status: (entry.preferredPaymentMethod || 'in-person') === 'now' ? 'pending' : 'confirmed',
    additionalGuests: entry.additionalGuests,
  };

  const newBooking = new Booking(bookingData);
  const savedBooking = await newBooking.save();

  entry.status = 'assigned';
  entry.assignedBooking = savedBooking._id as Types.ObjectId;
  entry.assignedTime = time;
  await entry.save();

  const customerEmailPromise =
    savedBooking.status === 'pending'
      ? sendBookingPendingEmail(savedBooking)
      : sendBookingConfirmationEmail(savedBooking);

  customerEmailPromise.catch((err) =>
    logger.error('Queue: failed to send customer email after manual convert', err)
  );

  sendAdminNotificationEmail(savedBooking).catch((err) =>
    logger.error('Queue: failed to notify admin of manual queue conversion', err)
  );

  const smsType = savedBooking.status === 'pending' ? 'pending' : 'confirmed';
  const smsText = buildCustomerSms(smsType, savedBooking);
  const smsResult = await sendSms(savedBooking.phone, smsText);
  if (!smsResult.sent) {
    logger.warn('Queue: failed to SMS customer after manual conversion', { reason: smsResult.reason, phone: savedBooking.phone });
  }

  const adminLine = formatAdminBookingLine(savedBooking, timezone);
  const guestSuffix =
    savedBooking.additionalGuests && savedBooking.additionalGuests.length > 0
      ? ` [+${savedBooking.additionalGuests.length} guest${savedBooking.additionalGuests.length > 1 ? 's' : ''}]`
      : '';
  const adminSmsText = `Queue entry converted: ${adminLine}${guestSuffix}`;
  sendAdminSms(adminSmsText).catch((err) =>
    logger.error('Queue: failed to SMS admin after manual conversion', err)
  );

  return savedBooking;
}

export async function expirePendingQueueEntries() {
  const now = moment.utc();
  const entries = await QueueEntry.find({ status: 'pending' });
  await Promise.all(
    entries.map(async (entry) => {
      const targetDayEnd = moment.utc(entry.requestedDate, 'YYYY-MM-DD').endOf('day');
      if (now.isAfter(targetDayEnd)) {
        await expireEntry(entry);
      }
    })
  );
}

let sweepTimer: NodeJS.Timeout | null = null;
export function startQueueSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    expirePendingQueueEntries().catch((err) =>
      logger.error('Queue sweeper failed', err)
    );
  }, SWEEP_INTERVAL_MS);
}
