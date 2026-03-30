import moment from 'moment-timezone';
import { DEFAULT_TIMEZONE } from '../config/time';
import { IBooking } from '../models/booking.model';

const MANAGE_LINK = 'https://dopecuts.ca/reschedule';

function formatDateDMY(date: Date | string | number): string {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function resolveTimezone(timezone?: string) {
  if (timezone && moment.tz.zone(timezone)) return timezone;
  return DEFAULT_TIMEZONE;
}

export function formatAdminBookingLine(
  booking: Pick<IBooking, 'firstName' | 'lastName' | 'service' | 'date' | 'time'>,
  timezone?: string
): string {
  const tz = resolveTimezone(timezone);
  const isoDate = moment.utc(booking.date).format('YYYY-MM-DD');
  const dateLabel = moment.tz(isoDate, 'YYYY-MM-DD', tz).format('MMM D');
  const tzLabel = moment.tz(isoDate, 'YYYY-MM-DD', tz).format('z');
  const locationLabel = tz === DEFAULT_TIMEZONE ? 'Toronto' : tz.replace('_', ' ');
  const name =
    [booking.firstName, booking.lastName].filter(Boolean).join(' ').trim() ||
    booking.firstName ||
    'Customer';
  const service = booking.service || 'Service';
  const timeLabel = booking.time ? ` @ ${booking.time}` : '';
  const tzSuffix = tzLabel ? ` ${tzLabel}` : '';
  return `${name} • ${service} on ${dateLabel}${timeLabel}${tzSuffix} (${locationLabel})`
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCustomerSms(
  type: 'pending' | 'confirmed' | 'updated' | 'cancelled' | 'payment-confirmed',
  b: IBooking
): string {
  const dmy = formatDateDMY(b.date);
  const hasGuests = Array.isArray(b.additionalGuests) && b.additionalGuests.length > 0;
  const name = hasGuests ? 'there' : b.firstName?.trim() || 'there';

  switch (type) {
    case 'pending':
      return hasGuests
        ? `Hi there, we received your DopeCuts Barber Shop booking for ${dmy} at ${b.time}. Pending confirmation for you and guests. Manage: ${MANAGE_LINK}`
        : `Hi ${name}, we received your DopeCuts Barber Shop booking for ${dmy} at ${b.time}. Pending confirmation. Manage: ${MANAGE_LINK}`;
    case 'confirmed':
      return hasGuests
        ? `Hi there, your DopeCuts Barber Shop appointments are confirmed for ${dmy} at ${b.time}. Manage: ${MANAGE_LINK}`
        : `Hi ${name}, your appointment with DopeCuts Barber Shop is confirmed for ${dmy} at ${b.time}. Manage: ${MANAGE_LINK}`;
    case 'updated':
      return hasGuests
        ? `Hi there, your group booking was updated to ${dmy} at ${b.time}. Manage: ${MANAGE_LINK}`
        : `Hi ${name}, your appointment was updated to ${dmy} at ${b.time}. Manage: ${MANAGE_LINK}`;
    case 'cancelled':
      return hasGuests
        ? `Hi there, your booking on ${dmy} at ${b.time} was cancelled. Manage: ${MANAGE_LINK}`
        : `Hi ${name}, your appointment on ${dmy} at ${b.time} was cancelled. Manage: ${MANAGE_LINK}`;
    case 'payment-confirmed':
      return hasGuests
        ? `Hi there, payment received. Your appointments are confirmed for ${dmy} at ${b.time}. Manage: ${MANAGE_LINK}`
        : `Hi ${name}, payment received. Your appointment is confirmed for ${dmy} at ${b.time}. Manage: ${MANAGE_LINK}`;
  }
}
