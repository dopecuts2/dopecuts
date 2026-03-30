import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import moment from 'moment-timezone';
import { Booking, IBooking } from '../models/booking.model';
import { Service } from '../models/service.model';
import { Contact } from '../models/contact.model';
import {
  sendBookingConfirmationEmail,
  sendAdminNotificationEmail,
  sendBookingUpdateConfirmationEmail,
  sendAdminUpdateNotificationEmail,
  sendBookingCancellationEmail,
  sendAdminCancellationNotificationEmail,
  sendBookingPendingEmail,
  sendPaymentConfirmationEmail,
  sendCustomerVerificationCodeEmail,
} from '../services/emailService';
import { logger } from '../utils/logger';
import { sendSms, sendAdminSms } from '../services/smsService';
import { Otp } from '../models/otp.model';
import { signManageToken, verifyManageToken, readManageTokenFromReq } from '../utils/manageAuth';
import { CalendarSettings } from '../models/calendar.model';
import { WeeklyCalendar } from '../models/weeklyCalendar.model';
import { buildCustomerSms, formatAdminBookingLine } from '../utils/bookingNotifications';
import { normalizePhoneDigits } from '../utils/phone';
import {
  assignQueueEntryForSlot,
  joinQueue as enqueueQueueEntry,
} from '../services/queueService';
import { getBusinessTimezone } from '../utils/timezone';

const DEFAULT_START_TIME = '11:00';
const DEFAULT_END_TIME = '19:00';
const DEFAULT_SLOT_DURATION = 40;

const ADAPTIVE_SERVICE_RULES: Array<{ keywords: string[]; duration: number }> = [
  { keywords: ['kids cut', 'kid cut'], duration: 20 },
  { keywords: ['hair line up', 'hair line-up', 'hair lineup', 'lineup'], duration: 20 },
  { keywords: ['beard trim'], duration: 20 },
  { keywords: ['deluxe'], duration: 60 },
];

/**
 * @description Helper to render short SMS line for customers.
 */
function toIdString(id: unknown): string {
  if (typeof id === 'string') return id;
  // Assume ObjectId; Mongoose default for _id
  return (id as Types.ObjectId).toHexString();
}


/**
 * @description Mask a phone number in logs (keep last 4 digits).
 */
function maskPhone(phone?: string | null): string {
  if (!phone) return 'unknown';
  return phone.replace(/\d(?=\d{4})/g, '*');
}

/**
 * @description Consistent logging for SMS outcomes.
 * Result shape is assumed { sent: boolean; reason?: string; messageId?: string }
 */
function logSmsOutcome(
  context: string,
  target: 'customer' | 'admin' | 'otp',
  toPhone: string | null | undefined,
  result: { sent: boolean; reason?: string; messageId?: string }
) {
  const who =
    target === 'admin'
      ? 'admin'
      : target === 'otp'
      ? `otp (${maskPhone(toPhone)})`
      : `customer (${maskPhone(toPhone)})`;

  if (result.sent) {
    const idFrag = result.messageId ? ` id=${result.messageId}` : '';
    logger.info(`[SMS] ${context}: sent to ${who}.${idFrag}`);
  } else {
    logger.warn(
      `[SMS] ${context}: NOT sent to ${who}. Reason=${result.reason ?? 'unknown'}`
    );
  }
}

async function ensureContactForBooking(booking: IBooking, session: mongoose.ClientSession) {
  const contactName = [booking.firstName, booking.lastName].filter(Boolean).join(' ') || booking.firstName;
  await Contact.findOneAndUpdate(
    { $or: [{ email: booking.email }, { phone: booking.phone }] },
    {
      $setOnInsert: {
        name: contactName,
        email: booking.email,
        phone: booking.phone,
      },
    },
    { upsert: true, session, new: false }
  );
}
interface AdditionalGuestRequest {
  firstName: string;
  lastName?: string;
  email?: string;
  serviceId: string;
  time: string;
}

/* -------------------------------------------------------------------------- */
/*                      Availability / Validation Utilities                    */
/* -------------------------------------------------------------------------- */

type BreakTime = { startTime: string; endTime: string };

function rangesOverlap(aStart: moment.Moment, aEnd: moment.Moment, bStart: moment.Moment, bEnd: moment.Moment) {
  return aStart.isBefore(bEnd) && aEnd.isAfter(bStart);
}

function roundUpToSlot(dt: moment.Moment, slotMinutes: number) {
  const minutes = dt.minute();
  const remainder = minutes % slotMinutes;
  if (remainder === 0) return dt.clone().seconds(0).milliseconds(0);
  return dt.clone().add(slotMinutes - remainder, 'minutes').seconds(0).milliseconds(0);
}

function resolveAdaptiveDuration(
  serviceName: string | undefined,
  baseDuration: number,
  slotDuration?: number
) {
  const normalizedSlot = normalizeSlotDuration(slotDuration ?? DEFAULT_SLOT_DURATION);
  const normalizedBase = baseDuration || normalizedSlot;
  const normalizedName = (serviceName || '').toLowerCase();
  const rule = ADAPTIVE_SERVICE_RULES.find((r) =>
    r.keywords.some((keyword) => normalizedName.includes(keyword))
  );
  if (rule) return rule.duration;
  // Default services should consume at least one full slot; keep longer durations intact.
  return Math.max(normalizedBase, normalizedSlot);
}

function gcd(a: number, b: number): number {
  let x = Math.max(a, 0);
  let y = Math.max(b, 0);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function computeSlotStep(slotDuration: number, serviceDuration: number) {
  const baseSlot = normalizeSlotDuration(slotDuration || DEFAULT_SLOT_DURATION);
  const service = serviceDuration || baseSlot;

  // If the service equals the slot, stay on the base cadence.
  if (service === baseSlot) return baseSlot;

  // If the service is shorter and divides cleanly, allow tighter cadence (e.g., 20 min inside 40).
  if (service < baseSlot && baseSlot % service === 0) {
    return service;
  }

  // If the service is longer, use a shared divisor only when it keeps at least half-slot granularity (e.g., 60 vs 40 -> 20).
  if (service > baseSlot) {
    const divisor = gcd(baseSlot, service);
    if (divisor >= baseSlot / 2) return divisor;
    return baseSlot;
  }

  // Fallback to the base cadence (covers non-divisible shorter services like 35m).
  return baseSlot;
}

function normalizeSlotDuration(duration?: number | null) {
  if (!duration) return DEFAULT_SLOT_DURATION;
  // Promote legacy 35-minute default to the new 40-minute cadence
  if (duration === 35) return DEFAULT_SLOT_DURATION;
  return duration;
}

async function getDaySettingsFor(dateISO: string, timezone: string) {
  const target = moment.tz(dateISO, 'YYYY-MM-DD', timezone);
  const dayOfWeek = target.format('dddd');
  const weekStart = target.clone().startOf('isoWeek').format('YYYY-MM-DD');

  const weekly = await WeeklyCalendar.findOne({ weekStart });
  if (weekly) {
    const day = weekly.days.find((d) => d.dayOfWeek === dayOfWeek);
    if (day) {
      return {
        startTime: day.startTime,
        endTime: day.endTime,
        slotDuration: normalizeSlotDuration(day.slotDuration),
        breaks: day.blockedTimes,
        isEnabled: day.isEnabled,
      };
    }
  }

  const fallback = await CalendarSettings.findOne({ dayOfWeek });
  if (fallback) {
    return {
      startTime: fallback.startTime,
      endTime: fallback.endTime,
      slotDuration: normalizeSlotDuration(fallback.slotDuration),
      breaks: fallback.breaks,
      isEnabled: fallback.isEnabled,
    };
  }

  return {
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
    slotDuration: DEFAULT_SLOT_DURATION,
    breaks: [],
    isEnabled: true,
  };
}

function computeAvailableSlots(
  dateISO: string,
  serviceDuration: number,
  settings: {
    startTime: string; // 'HH:mm'
    endTime: string;   // 'HH:mm'
    slotDuration: number;
    breaks: BreakTime[];
    isEnabled: boolean;
  },
  bookingsOnDate: Array<IBooking & { _id: any }>,
  timezone: string,
  nowInTz: moment.Moment = moment.tz(timezone)
): string[] {
  if (!settings || !settings.isEnabled) return [];

  const { startTime, endTime, slotDuration, breaks } = settings;
  const normalizedSlot = normalizeSlotDuration(slotDuration);
  const slotStep = computeSlotStep(normalizedSlot, serviceDuration);

  // Day boundaries
  const dayStart = moment.tz(`${dateISO} ${startTime}`, 'YYYY-MM-DD HH:mm', timezone);
  const dayEnd = moment.tz(`${dateISO} ${endTime}`, 'YYYY-MM-DD HH:mm', timezone);

  // Start from either dayStart or rounded-up "now" if today
  let current = dayStart.clone();
  const isToday = nowInTz.format('YYYY-MM-DD') === dateISO;
  if (isToday && nowInTz.isAfter(current)) {
    current = roundUpToSlot(nowInTz.clone(), slotStep);
    if (current.isBefore(dayStart)) current = dayStart.clone();
  }

  const available: string[] = [];

  while (current.isBefore(dayEnd)) {
    const slotStart = current.clone();
    const slotEnd = slotStart.clone().add(serviceDuration, 'minutes');

    // If service doesn't fit before close, stop.
    if (slotEnd.isAfter(dayEnd)) break;

    let ok = true;

    // Overlap with existing non-cancelled bookings
    for (const b of bookingsOnDate) {
      if (b.status === 'cancelled') continue;
      const bStart = moment.tz(`${dateISO} ${b.time}`, 'YYYY-MM-DD h:mm A', timezone);
      const bEnd = bStart.clone().add(b.duration, 'minutes');
      if (rangesOverlap(slotStart, slotEnd, bStart, bEnd)) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      current.add(slotStep, 'minutes');
      continue;
    }

    // Overlap with breaks
    for (const brk of breaks || []) {
      const brkStart = moment.tz(`${dateISO} ${brk.startTime}`, 'YYYY-MM-DD HH:mm', timezone);
      const brkEnd = moment.tz(`${dateISO} ${brk.endTime}`, 'YYYY-MM-DD HH:mm', timezone);
      if (rangesOverlap(slotStart, slotEnd, brkStart, brkEnd)) {
        ok = false;
        break;
      }
    }

    if (ok) {
      available.push(slotStart.format('h:mm A'));
    }

    current.add(slotStep, 'minutes');
  }

  return available;
}

async function validateRequestedSlotOrSuggest(
  dateISO: string,
  timeLabel: string, // 'h:mm A'
  serviceDuration: number,
  ignoreBookingId?: string,
  session?: mongoose.ClientSession | null
): Promise<{ ok: true } | { ok: false; reason: string; suggestions: string[] }> {
  const timezone = await getBusinessTimezone();
  const settings = await getDaySettingsFor(dateISO, timezone);
  if (!settings || !settings.isEnabled) {
    return { ok: false, reason: 'The shop is closed on the selected day.', suggestions: [] };
  }

  const dayStart = moment.tz(`${dateISO} ${settings.startTime}`, 'YYYY-MM-DD HH:mm', timezone);
  const dayEnd = moment.tz(`${dateISO} ${settings.endTime}`, 'YYYY-MM-DD HH:mm', timezone);
  const start = moment.tz(`${dateISO} ${timeLabel}`, 'YYYY-MM-DD h:mm A', timezone);
  const end = start.clone().add(serviceDuration, 'minutes');

  // In-day window check
  if (start.isBefore(dayStart) || end.isAfter(dayEnd)) {
    const suggestions = computeAvailableSlots(
      dateISO,
      serviceDuration,
      settings,
      await Booking.find({
        date: {
          $gte: moment.utc(dateISO, 'YYYY-MM-DD').startOf('day').toDate(),
          $lte: moment.utc(dateISO, 'YYYY-MM-DD').endOf('day').toDate(),
        },
        ...(ignoreBookingId ? { _id: { $ne: ignoreBookingId } } : {}),
      }).session(session ?? null),
      timezone
    );
    return { ok: false, reason: 'Selected time does not fit within business hours.', suggestions };
  }

  // Past-time check when date is today
  const nowInTz = moment.tz(timezone);
  if (nowInTz.format('YYYY-MM-DD') === dateISO && start.isBefore(nowInTz)) {
    const suggestions = computeAvailableSlots(
      dateISO,
      serviceDuration,
      settings,
      await Booking.find({
        date: {
          $gte: moment.utc(dateISO, 'YYYY-MM-DD').startOf('day').toDate(),
          $lte: moment.utc(dateISO, 'YYYY-MM-DD').endOf('day').toDate(),
        },
        ...(ignoreBookingId ? { _id: { $ne: ignoreBookingId } } : {}),
      }).session(session ?? null),
      timezone,
      nowInTz
    );
    return { ok: false, reason: 'Selected time is in the past.', suggestions };
  }

  // Existing bookings on the date
  const bookingsOnDate = await Booking.find({
    date: {
      $gte: moment.utc(dateISO, 'YYYY-MM-DD').startOf('day').toDate(),
      $lte: moment.utc(dateISO, 'YYYY-MM-DD').endOf('day').toDate(),
    },
    ...(ignoreBookingId ? { _id: { $ne: ignoreBookingId } } : {}),
  }).session(session ?? null);

  // Overlap with bookings
  for (const b of bookingsOnDate) {
    if (b.status === 'cancelled') continue;
    const bStart = moment.tz(`${dateISO} ${b.time}`, 'YYYY-MM-DD h:mm A', timezone);
    const bEnd = bStart.clone().add(b.duration, 'minutes');
    if (rangesOverlap(start, end, bStart, bEnd)) {
      const suggestions = computeAvailableSlots(
        dateISO,
        serviceDuration,
        settings,
        bookingsOnDate,
        timezone,
        moment.tz(timezone)
      );
      return { ok: false, reason: 'Selected time conflicts with another booking.', suggestions };
    }
  }

  // Overlap with breaks
  for (const brk of settings.breaks || []) {
    const brkStart = moment.tz(`${dateISO} ${brk.startTime}`, 'YYYY-MM-DD HH:mm', timezone);
    const brkEnd = moment.tz(`${dateISO} ${brk.endTime}`, 'YYYY-MM-DD HH:mm', timezone);
    if (rangesOverlap(start, end, brkStart, brkEnd)) {
      const suggestions = computeAvailableSlots(
        dateISO,
        serviceDuration,
        settings,
        bookingsOnDate,
        timezone,
        moment.tz(timezone)
      );
      return { ok: false, reason: 'Selected time overlaps a break.', suggestions };
    }
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                                  Handlers                                  */
/* -------------------------------------------------------------------------- */

/**
 * Create a booking
 */
export const createBooking = async (req: Request, res: Response) => {
  const {
    serviceId,
    date,
    time,
    phone,
    firstName,
    lastName,
    email,
    notes,
    paymentMethod,
    additionalGuests,
  } = req.body;

  if (!serviceId || !date || !time || !phone || !firstName || !email || !paymentMethod) {
    return res.status(400).json({ message: 'Missing required booking information.' });
  }

  const normalizedPhone = normalizePhoneDigits(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Invalid phone number provided.' });
  }

  const cancellationCount = await Booking.countDocuments({
    phoneNormalized: normalizedPhone,
    status: 'cancelled',
  });

  if (cancellationCount >= 3 && paymentMethod !== 'now') {
    return res.status(403).json({
      message: 'Due to prior cancellations we require prepayment. Select Pay Now to continue.',
    });
  }

  const guestRequests: AdditionalGuestRequest[] = Array.isArray(additionalGuests)
    ? additionalGuests
        .map((guest: any) => ({
          firstName: (guest?.firstName || '').trim(),
          lastName: (guest?.lastName || '').trim(),
          email: guest?.email ? String(guest.email).toLowerCase() : undefined,
          serviceId: guest?.serviceId,
          time: guest?.time,
        }))
        .filter(
          (guest) =>
            guest.firstName &&
            guest.serviceId &&
            guest.time
        )
    : [];

  const dateISO = moment.utc(date).format('YYYY-MM-DD');

  try {
    const selectedService = await Service.findById(serviceId);
    if (!selectedService) {
      return res.status(400).json({ message: 'Invalid service selected.' });
    }

    const timezone = await getBusinessTimezone();
    const daySettings = await getDaySettingsFor(dateISO, timezone);
    if (!daySettings || !daySettings.isEnabled) {
      return res.status(409).json({
        message: 'The shop is closed on the selected day.',
        suggestions: [],
      });
    }

    const effectiveDuration = resolveAdaptiveDuration(
      selectedService.name,
      selectedService.duration,
      daySettings.slotDuration
    );

    const existingBookings = await Booking.find({
      date: {
        $gte: moment.utc(dateISO, 'YYYY-MM-DD').startOf('day').toDate(),
        $lte: moment.utc(dateISO, 'YYYY-MM-DD').endOf('day').toDate(),
      },
      status: { $ne: 'cancelled' },
    });

    const availableSlots = computeAvailableSlots(
      dateISO,
      effectiveDuration,
      daySettings,
      existingBookings,
      timezone
    );

    if (guestRequests.length > 0 && availableSlots.length < guestRequests.length + 1) {
      return res.status(409).json({
        message: 'Not enough availability on that day to add a guest.',
        suggestions: [],
      });
    }

    const normalizedLastName = (lastName || '').trim();
    const primaryFullName = [firstName, normalizedLastName].filter(Boolean).join(' ');

    const session = await mongoose.startSession();
    let primaryBooking: IBooking | null = null;
    const extraBookings: IBooking[] = [];
    const guestMeta: IBooking['additionalGuests'] = [];

    try {
      await session.withTransaction(async () => {
        const slotCheck = await validateRequestedSlotOrSuggest(
          dateISO,
          time,
          effectiveDuration,
          undefined,
          session
        );
        if (slotCheck.ok !== true) {
          throw { __isSlotError: true, reason: slotCheck.reason, suggestions: slotCheck.suggestions };
        }

        const status = paymentMethod === 'now' ? 'pending' : 'confirmed';

        const newBooking = new Booking({
          firstName,
          lastName: normalizedLastName,
          email: String(email).toLowerCase(),
          phone,
          phoneNormalized: normalizedPhone,
          service: selectedService.name,
          serviceId: selectedService._id as Types.ObjectId,
          price: selectedService.price,
          duration: effectiveDuration,
          date: moment.utc(dateISO, 'YYYY-MM-DD').toDate(),
          time,
          notes,
          paymentMethod,
          status,
        });

        primaryBooking = await newBooking.save({ session });
        if (!primaryBooking) {
          throw new Error('Failed to save booking.');
        }

        await ensureContactForBooking(primaryBooking, session);

        for (const guest of guestRequests) {
          const guestService = await Service.findById(guest.serviceId).session(session);
          if (!guestService) {
            throw new Error('Invalid service selected for additional guest.');
          }
          const guestDuration = resolveAdaptiveDuration(
            guestService.name,
            guestService.duration,
            daySettings.slotDuration
          );

          const guestSlotCheck = await validateRequestedSlotOrSuggest(
            dateISO,
            guest.time,
            guestDuration,
            undefined,
            session
          );
          if (guestSlotCheck.ok !== true) {
            throw { __isSlotError: true, reason: guestSlotCheck.reason, suggestions: guestSlotCheck.suggestions };
          }

            const guestLastName = (guest.lastName || '').trim();
            const guestBooking = new Booking({
              firstName: guest.firstName,
              lastName: guestLastName,
              email: guest.email || String(email).toLowerCase(),
              phone,
              phoneNormalized: normalizedPhone,
              service: guestService.name,
              serviceId: guestService._id as Types.ObjectId,
              price: guestService.price,
            duration: guestDuration,
            date: moment.utc(dateISO, 'YYYY-MM-DD').toDate(),
            time: guest.time,
            notes: primaryFullName ? `Guest linked with ${primaryFullName}` : 'Guest booking',
            paymentMethod,
            status,
          });

          const savedGuest = await guestBooking.save({ session });
          extraBookings.push(savedGuest);
            guestMeta.push({
              firstName: guest.firstName,
              lastName: guestLastName,
              email: guest.email,
              serviceId: guestService._id as Types.ObjectId,
              serviceName: guestService.name,
              time: guest.time,
            });

          await ensureContactForBooking(savedGuest, session);
        }

        if (guestMeta.length > 0 && primaryBooking) {
          primaryBooking = await Booking.findByIdAndUpdate(
            primaryBooking._id,
            { additionalGuests: guestMeta },
            { new: true, session }
          );
          if (!primaryBooking) {
            throw new Error('Primary booking missing after updating guest metadata.');
          }
        }
      });
    } finally {
      await session.endSession();
    }

    if (!primaryBooking) {
      throw new Error('Booking could not be created due to an unexpected error.');
    }

    const confirmedPrimaryBooking: IBooking = primaryBooking;

    const allBookings = [confirmedPrimaryBooking, ...extraBookings];
    const pricingSummary = {
      primaryPrice: confirmedPrimaryBooking.price,
      additionalPrices: extraBookings.map((b) => b.price),
      computedTotal: (confirmedPrimaryBooking.price || 0) + extraBookings.reduce((sum, b) => sum + (b.price || 0), 0),
    };
    logger.info('Booking created with pricing summary', {
      bookingId: confirmedPrimaryBooking._id,
      additionalCount: extraBookings.length,
      ...pricingSummary,
    });

    await Promise.all(
      allBookings.map(async (booking) => {
        const isPending = booking.status === 'pending';
        if (isPending) {
          await sendBookingPendingEmail(booking).catch((err) =>
            logger.error('Failed to send customer pending email:', err)
          );
        } else {
          await sendBookingConfirmationEmail(booking).catch((err) =>
            logger.error('Failed to send customer confirmation email:', err)
          );
        }

        const smsText = buildCustomerSms(
          booking.status === 'pending' ? 'pending' : 'confirmed',
          booking
        );
        const smsResult = await sendSms(booking.phone, smsText);
        logSmsOutcome('createBooking', 'customer', booking.phone, smsResult);
      })
    );

    sendAdminNotificationEmail(confirmedPrimaryBooking).catch((err) =>
      logger.error('Failed to send admin notification email:', err)
    );

    const adminLine = formatAdminBookingLine(confirmedPrimaryBooking, timezone);
    const guestSuffix =
      extraBookings.length > 0
        ? ` [+${extraBookings.length} guest${extraBookings.length > 1 ? 's' : ''}]`
        : '';
    const adminMsg = confirmedPrimaryBooking.status === 'pending'
      ? `New PENDING booking: ${adminLine}${guestSuffix}`
      : `New CONFIRMED booking: ${adminLine}${guestSuffix}`;
    const adminSmsRes = await sendAdminSms(adminMsg);
    logSmsOutcome('createBooking', 'admin', null, adminSmsRes);

    res.status(201).json({
      message: 'Booking request received!',
      booking: confirmedPrimaryBooking,
      additionalBookings: extraBookings,
    });
  } catch (error: any) {
    if (error?.__isSlotError) {
      return res.status(409).json({
        message: error.reason,
        suggestions: error.suggestions,
      });
    }
    logger.error('Error creating booking:', error);
    if (error instanceof Error) {
      if (error.message === 'Invalid service selected.') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Failed to create booking.', error: error.message });
    }
    return res.status(500).json({ message: 'An unknown error occurred while creating the booking.' });
  }
};
export const joinBookingQueue = async (req: Request, res: Response) => {
  try {
    const entry = await enqueueQueueEntry(req.body);
    res.status(201).json({ message: 'You are on the queue for the selected day.', entry });
  } catch (error: any) {
    logger.error('Error joining booking queue:', error);
    const status = error?.message?.includes('already') ? 409 : 400;
    res.status(status).json({ message: error?.message || 'Failed to join the queue.' });
  }
};

/**
 * Get all bookings (admin)
 */
export const getAllBookings = async (_req: Request, res: Response) => {
  try {
    const bookings = await Booking.find().sort({ date: -1, time: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    logger.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
};

/**
 * Get an upcoming booking by phone (public)
 */
export const getBookingByPhone = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }
    const today = moment.utc().startOf('day').toDate();
    const booking = await Booking.findOne({
      phone,
      date: { $gte: today },
      status: { $ne: 'cancelled' }
    }).sort({ date: 1, time: 1 });
    if (!booking) {
      return res.status(404).json({ message: 'No upcoming booking found for this phone number.' });
    }
    res.status(200).json(booking);
  } catch (error) {
    logger.error('Error fetching booking by phone:', error);
    res.status(500).json({ message: 'Failed to fetch booking.' });
  }
};

/**
 * Get upcoming booking by email (public)
 */
export const getBookingByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }
    const today = moment.utc().startOf('day').toDate();
    const booking = await Booking.findOne({
      email: String(email).toLowerCase(),
      date: { $gte: today },
      status: { $ne: 'cancelled' }
    }).sort({ date: 1, time: 1 });
    if (!booking) {
      return res.status(404).json({ message: 'No upcoming booking found for this email.' });
    }
    res.status(200).json(booking);
  } catch (error) {
    logger.error('Error fetching booking by email:', error);
    res.status(500).json({ message: 'Failed to fetch booking.' });
  }
};

/**
 * Start phone OTP for reschedule/cancel (public)
 */
export const startPhoneOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone is required.' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await Otp.create({ phone, otp });
    const smsRes = await sendSms(phone, `Dopecuts verification code: ${otp} (valid 5 min)`);
    logSmsOutcome('startPhoneOtp', 'otp', phone, smsRes);

    if (!smsRes.sent) {
      return res.status(429).json({
        message: 'Unable to send verification code by SMS right now. Try again later or use email route.',
        reason: smsRes.reason
      });
    }
    res.status(200).json({ message: 'Verification code sent via SMS.' });
  } catch (err) {
    logger.error('Error starting phone OTP:', err);
    res.status(500).json({ message: 'Failed to start verification.' });
  }
};

/**
 * Verify phone OTP (public) -> returns manage token
 */
export const verifyPhoneOtp = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP are required.' });

  try {
    const record = await Otp.findOne({ phone, otp }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(401).json({ message: 'Invalid or expired code.' });
    }
    await Otp.deleteMany({ phone });

    const token = signManageToken({ phone });
    res.status(200).json({ message: 'Phone verified.', token });
  } catch (err) {
    logger.error('Error verifying phone OTP:', err);
    res.status(500).json({ message: 'Verification failed.' });
  }
};

/**
 * Start email OTP (public)
 */
export const startEmailOtp = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await Otp.create({ email: String(email).toLowerCase(), otp });
    const out = await sendCustomerVerificationCodeEmail(email, otp);
    if (!out.success) {
      return res.status(429).json({
        message: 'Unable to send verification code by email right now. Try again or use phone route.',
      });
    }
    res.status(200).json({ message: 'Verification code sent via email.' });
  } catch (err) {
    logger.error('Error starting email OTP:', err);
    res.status(500).json({ message: 'Failed to start verification.' });
  }
};

/**
 * Verify email OTP (public) -> returns manage token
 */
export const verifyEmailOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });

  try {
    const record = await Otp.findOne({ email: String(email).toLowerCase(), otp }).sort({ createdAt: -1 });
    if (!record) {
      return res.status(401).json({ message: 'Invalid or expired code.' });
    }
    await Otp.deleteMany({ email: String(email).toLowerCase() });

    const token = signManageToken({ email: String(email).toLowerCase() });
    res.status(200).json({ message: 'Email verified.', token });
  } catch (err) {
    logger.error('Error verifying email OTP:', err);
    res.status(500).json({ message: 'Verification failed.' });
  }
};

/**
 * Token-based "manage" lookup (public)
 */
export const getManageBooking = async (req: Request, res: Response) => {
  try {
    const token = readManageTokenFromReq(req);
    if (!token) return res.status(401).json({ message: 'Missing manage token.' });

    const idt = verifyManageToken(token);
    if (!idt) return res.status(401).json({ message: 'Invalid manage token.' });

    const today = moment.utc().startOf('day').toDate();

    const q: any = { date: { $gte: today }, status: { $ne: 'cancelled' } };
    if (idt.phone) q.phone = idt.phone;
    if (idt.email) q.email = idt.email;

    const booking = await Booking.findOne(q).sort({ date: 1, time: 1 });
    if (!booking) {
      return res.status(404).json({ message: 'No upcoming booking found.' });
    }
    res.status(200).json({ booking });
  } catch (error) {
    logger.error('Error in getManageBooking:', error);
    res.status(500).json({ message: 'Failed to fetch booking.' });
  }
};

/**
 * Update/Reschedule booking (public with manage token; admin bypass)
 * Also supports legacy auth: email OR phone+otp (consumes OTP)
 */
export const updateBooking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { serviceId, ...updateData } = req.body;

  const timezone = await getBusinessTimezone();
  const session = await mongoose.startSession();

  try {
    let booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Auth: Admin OR manage token OR legacy
    let authorized = false;
    if (req.admin) {
      authorized = true;
    } else {
      const token = readManageTokenFromReq(req);
      if (token) {
        const idt = verifyManageToken(token);
        if (idt && ((idt.phone && idt.phone === booking.phone) || (idt.email && idt.email === booking.email))) {
          authorized = true;
        }
      }

      if (!authorized) {
        const { email, phone, otp, cancellationNote } = req.body;
        if (email && booking.email === String(email).toLowerCase()) {
          authorized = true;
        } else if (phone && otp && booking.phone === phone) {
          const otpRec = await Otp.findOne({ phone, otp }).sort({ createdAt: -1 });
          if (!otpRec) {
            return res.status(403).json({ message: 'Forbidden: Invalid phone verification code.' });
          }
          authorized = true;
          await Otp.deleteMany({ phone });
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to edit this booking.' });
    }

    // Determine target values (existing or updates)
    let targetDateISO = booking.date ? moment.utc(booking.date).format('YYYY-MM-DD') : undefined;
    if (updateData.date) {
      targetDateISO = moment.utc(updateData.date).format('YYYY-MM-DD');
    }

    let targetTime = booking.time;
    if (updateData.time) {
      targetTime = updateData.time;
    }

    // If service changes, pull new service meta
    let targetServiceName = booking.service;
    let targetPrice = booking.price;
    let targetDuration = booking.duration;
    let targetServiceId = booking.serviceId;

    if (serviceId) {
      const selectedService = await Service.findById(serviceId);
      if (!selectedService) {
        return res.status(400).json({ message: 'Invalid service selected.' });
      }
      targetServiceName = selectedService.name;
      targetPrice = selectedService.price;
      targetDuration = resolveAdaptiveDuration(selectedService.name, selectedService.duration);
      targetServiceId = selectedService._id as Types.ObjectId;

      (updateData as any).service = selectedService.name;
      (updateData as any).price = selectedService.price;
      (updateData as any).duration = targetDuration;
      (updateData as any).serviceId = selectedService._id;
    }

    // Normalize duration to current adaptive rules (even if service unchanged)
    targetDuration = resolveAdaptiveDuration(targetServiceName, targetDuration);

    // Validate only if date or time or service duration changed
    const requiresTimeValidation =
      (typeof targetDateISO === 'string' && (updateData.date || updateData.time || serviceId));

    if (requiresTimeValidation && targetDateISO && targetTime) {
      const ignoreId = toIdString(booking._id); // <-- FIX: cast _id (unknown) to a safe string

      const slotCheck = await validateRequestedSlotOrSuggest(
        targetDateISO,
        targetTime,
        targetDuration,
        ignoreId
      );

      if (slotCheck.ok !== true) {
        return res.status(409).json({
          message: slotCheck.reason,
          suggestions: slotCheck.suggestions,
        });
      }
    }

    // Persist with a transaction to reduce race conditions
    await session.withTransaction(async () => {
      const updatePayload: any = { ...updateData };
      if (targetServiceId) {
        updatePayload.serviceId = targetServiceId;
      }
      updatePayload.duration = targetDuration;
      if (updatePayload.phone) {
        updatePayload.phoneNormalized = normalizePhoneDigits(updatePayload.phone);
      }
      if (updatePayload.date) {
        updatePayload.date = moment.utc(targetDateISO!, 'YYYY-MM-DD').toDate();
      }
      const updated = await Booking.findByIdAndUpdate(id, updatePayload, { new: true, session });
      if (!updated) {
        throw new Error('Booking not found after update attempt.');
      }
      booking = updated;
    });

    // Emails
    sendBookingUpdateConfirmationEmail(booking).catch(err => logger.error("Failed to send customer update email:", err));
    sendAdminUpdateNotificationEmail(booking).catch(err => logger.error("Failed to send admin update email:", err));

    // SMS
    const cSmsText = buildCustomerSms('updated', booking);
    const cSms = await sendSms(booking.phone, cSmsText);
    logSmsOutcome('updateBooking', 'customer', booking.phone, cSms);

    const adminLine = formatAdminBookingLine(booking, timezone);
    const guestSuffix =
      booking.additionalGuests && booking.additionalGuests.length > 0
        ? ` [+${booking.additionalGuests.length} guest${booking.additionalGuests.length > 1 ? 's' : ''}]`
        : '';
    const aSms = await sendAdminSms(`Booking UPDATED: ${adminLine}${guestSuffix}`);
    logSmsOutcome('updateBooking', 'admin', null, aSms);

    res.status(200).json({ message: 'Booking updated successfully!', booking });
  } catch (error) {
    logger.error(`Error updating booking ${id}:`, error);
    res.status(500).json({ message: 'Failed to update booking.' });
  } finally {
    await session.endSession();
  }
};

/**
 * Cancel booking (public with manage token; admin bypass)
 * Also supports legacy auth: email OR phone+otp (consumes OTP)
 */
export const cancelBooking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const timezone = await getBusinessTimezone();
  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    const { email, phone, otp, cancellationNote } = req.body;

    // Auth: Admin OR manage token OR legacy
    let authorized = false;

    if (req.admin) {
      authorized = true;
    } else {
      const token = readManageTokenFromReq(req);
      if (token) {
        const idt = verifyManageToken(token);
        if (idt && ((idt.phone && idt.phone === booking.phone) || (idt.email && idt.email === booking.email))) {
          authorized = true;
        }
      }

      if (!authorized) {
        const { email, phone, otp } = req.body;

        if (email && booking.email === String(email).toLowerCase()) {
          authorized = true;
        } else if (phone && otp && booking.phone === phone) {
          const otpRec = await Otp.findOne({ phone, otp }).sort({ createdAt: -1 });
          if (!otpRec) {
            return res.status(403).json({ message: 'Forbidden: Invalid phone verification code.' });
          }
          authorized = true;
          await Otp.deleteMany({ phone });
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to cancel this booking.' });
    }

    if (cancellationNote) {
      booking.cancellationNote = cancellationNote;
    }

    booking.status = 'cancelled';
    await booking.save();

    assignQueueEntryForSlot(booking).catch((err) =>
      logger.error('Queue assignment after cancel failed:', err)
    );

    // Emails
    sendBookingCancellationEmail(booking).catch(err => logger.error("Failed to send customer cancellation email:", err));
    sendAdminCancellationNotificationEmail(booking).catch(err => logger.error("Failed to send admin cancellation email:", err));

    // SMS
    const cSmsText = buildCustomerSms('cancelled', booking);
    const cSms = await sendSms(booking.phone, cSmsText);
    logSmsOutcome('cancelBooking', 'customer', booking.phone, cSms);

    const adminLine = formatAdminBookingLine(booking, timezone);
    const guestSuffix =
      booking.additionalGuests && booking.additionalGuests.length > 0
        ? ` [+${booking.additionalGuests.length} guest${booking.additionalGuests.length > 1 ? 's' : ''}]`
        : '';
    const aSms = await sendAdminSms(`Booking CANCELLED: ${adminLine}${guestSuffix}`);
    logSmsOutcome('cancelBooking', 'admin', null, aSms);

    res.status(200).json({ message: 'Booking cancelled successfully.' });
  } catch (error) {
    logger.error(`Error cancelling booking ${id}:`, error);
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
};

/**
 * Admin: send a custom SMS to a booking's phone number
 */
export const sendBookingMessage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ message: 'Message content is required.' });
  }

  const trimmed = message.trim().slice(0, 500);

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (!booking.phone) {
      return res.status(400).json({ message: 'Booking has no phone number.' });
    }

    const smsResult = await sendSms(booking.phone, trimmed);
    logSmsOutcome('admin-custom-message', 'customer', booking.phone, smsResult);

    if (!smsResult.sent) {
      return res
        .status(429)
        .json({ message: 'Unable to send message right now.', reason: smsResult.reason || 'unknown' });
    }

    res.status(200).json({ message: 'Message sent.' });
  } catch (error) {
    logger.error('Error sending booking message:', error);
    res.status(500).json({ message: 'Failed to send message.' });
  }
};

/**
 * Confirm payment (admin)
 */
export const confirmPayment = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'This booking is not pending payment and cannot be confirmed.' });
    }

    booking.status = 'confirmed';
    const updatedBooking = await booking.save();

    // Email
    sendPaymentConfirmationEmail(updatedBooking)
      .catch(err => logger.error("Failed to send payment confirmation email:", err));

    // SMS
    const cSmsText = buildCustomerSms('payment-confirmed', updatedBooking);
    const cSms = await sendSms(updatedBooking.phone, cSmsText);
    logSmsOutcome('confirmPayment', 'customer', updatedBooking.phone, cSms);

    res.status(200).json({ message: 'Payment confirmed and booking is now confirmed.', booking: updatedBooking });

  } catch (error) {
    logger.error(`Error confirming payment for booking ${id}:`, error);
    res.status(500).json({ message: 'Failed to confirm payment.' });
  }
};
