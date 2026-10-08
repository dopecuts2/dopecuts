import moment from 'moment-timezone';
import { DEFAULT_TIMEZONE } from '../config/time';
import { Booking, IBooking } from '../models/booking.model';

const MANAGE_LINK = 'https://dopecuts.online/reschedule';
export const SHOP_ADDRESS = '646 Upper James Street, Hamilton, ON L9C 2Z2';
export const SHOP_MAPS_LINK = 'https://maps.google.com/?q=646+Upper+James+Street+Hamilton+ON+L9C+2Z2';
export const SHOP_PHONE = '(365) 323-3680';
export const SHOP_EMAIL = 'leeroy@dopecuts.ca';
export const RESTRICTED_BOOKING_MESSAGE =
  `This phone number has been restricted from booking online. ` +
  `Please contact DopeCuts to resolve this -- call ${SHOP_PHONE}, email ${SHOP_EMAIL}, ` +
  `or use the contact form at dopecuts.online/contact.`;

const REFERENCE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I, easy to read aloud

/**
 * Generates a short, human-friendly booking reference (e.g. "DC-7F3K2A"),
 * checking the database for a collision each time. Collisions are
 * astronomically unlikely (33^6 possibilities) but cheap to guard against.
 */
export async function generateUniqueReferenceNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += REFERENCE_CHARS[Math.floor(Math.random() * REFERENCE_CHARS.length)];
    }
    const candidate = `DC-${code}`;
    const exists = await Booking.exists({ referenceNumber: candidate });
    if (!exists) return candidate;
  }
  // Practically unreachable fallback if we somehow collided 5 times in a row.
  return `DC-${Date.now().toString(36).toUpperCase()}`;
}

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
  booking: Pick<IBooking, 'firstName' | 'lastName' | 'service' | 'date' | 'time' | 'phone' | 'email'>,
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
  const contact = [booking.phone, booking.email].filter(Boolean).join(' • ');
  const contactSuffix = contact ? ` (${contact})` : '';
  return `${name}${contactSuffix} • ${service} on ${dateLabel}${timeLabel}${tzSuffix} (${locationLabel})`
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a "Add to Google Calendar" link for a booking (no OAuth/API key
 * needed -- this is just Google Calendar's public "render" URL scheme).
 * Works for both the customer's own invite and the owner's, since both
 * just need a one-tap way to add the same appointment to their calendar.
 */
export function buildGoogleCalendarLink(
  booking: Pick<IBooking, 'date' | 'time' | 'duration' | 'service'>
): string {
  const tz = DEFAULT_TIMEZONE;
  const isoDate = moment.utc(booking.date).format('YYYY-MM-DD');
  const start = moment.tz(`${isoDate} ${booking.time}`, 'YYYY-MM-DD h:mm A', tz);
  const end = start.clone().add(booking.duration || 30, 'minutes');
  const fmt = (m: moment.Moment) => m.clone().utc().format('YYYYMMDD[T]HHmmss[Z]');
  const dates = `${fmt(start)}/${fmt(end)}`;
  const text = encodeURIComponent(`${booking.service || 'Appointment'} at DopeCuts`);
  const details = encodeURIComponent('Booked via dopecuts.online');
  const location = encodeURIComponent(SHOP_ADDRESS);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
}

/**
 * Builds a compact " Guests: Jane Doe (416-555-1234), John Smith." suffix
 * for admin SMS, listing each added guest's name and phone (if provided)
 * instead of just a count. Accepts either the additionalGuests subdocument
 * shape or full guest Booking documents (both have firstName/lastName/phone).
 */
export function formatGuestListForSms(
  guests?: Array<{ firstName: string; lastName?: string; phone?: string }>
): string {
  if (!guests || guests.length === 0) return '';
  const entries = guests.map((guest) => {
    const name = [guest.firstName, guest.lastName].filter(Boolean).join(' ').trim() || 'Guest';
    return guest.phone ? `${name} (${guest.phone})` : name;
  });
  return ` Guests: ${entries.join(', ')}.`;
}

export function buildCustomerSms(
  type: 'pending' | 'confirmed' | 'updated' | 'cancelled' | 'payment-confirmed',
  b: IBooking
): string {
  const dmy = formatDateDMY(b.date);
  const hasGuests = Array.isArray(b.additionalGuests) && b.additionalGuests.length > 0;
  const name = hasGuests ? 'there' : b.firstName?.trim() || 'there';
  const directions = ` We're at ${SHOP_ADDRESS}. Directions: ${SHOP_MAPS_LINK}`;

  switch (type) {
    case 'pending':
      return hasGuests
        ? `Hi there, we received your DopeCuts Barber Shop booking for ${dmy} at ${b.time}. Pending confirmation for you and guests.${directions} Manage: ${MANAGE_LINK}`
        : `Hi ${name}, we received your DopeCuts Barber Shop booking for ${dmy} at ${b.time}. Pending confirmation.${directions} Manage: ${MANAGE_LINK}`;
    case 'confirmed':
      return hasGuests
        ? `Hi there, your DopeCuts Barber Shop appointments are confirmed for ${dmy} at ${b.time}.${directions} Manage: ${MANAGE_LINK}`
        : `Hi ${name}, your appointment with DopeCuts Barber Shop is confirmed for ${dmy} at ${b.time}.${directions} Manage: ${MANAGE_LINK}`;
    case 'updated':
      return hasGuests
        ? `Hi there, your group booking was updated to ${dmy} at ${b.time}.${directions} Manage: ${MANAGE_LINK}`
        : `Hi ${name}, your appointment was updated to ${dmy} at ${b.time}.${directions} Manage: ${MANAGE_LINK}`;
    case 'cancelled':
      return hasGuests
        ? `Hi there, your booking on ${dmy} at ${b.time} was cancelled. Manage: ${MANAGE_LINK}`
        : `Hi ${name}, your appointment on ${dmy} at ${b.time} was cancelled. Manage: ${MANAGE_LINK}`;
    case 'payment-confirmed':
      return hasGuests
        ? `Hi there, payment received. Your appointments are confirmed for ${dmy} at ${b.time}.${directions} Manage: ${MANAGE_LINK}`
        : `Hi ${name}, payment received. Your appointment is confirmed for ${dmy} at ${b.time}.${directions} Manage: ${MANAGE_LINK}`;
  }
}
