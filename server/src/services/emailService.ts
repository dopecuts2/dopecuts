// dopecuts-server/src/services/emailService.ts
import { Resend } from 'resend';
import moment from 'moment';
import { RESEND_API_KEY, ADMIN_EMAIL } from '../config/env';
import { IBooking } from '../models/booking.model';
import { logger } from '../utils/logger';
import { getNotificationSettings } from './notificationSettingsService';

const SENDER_EMAIL = 'Roy @ Dopecuts <leeroy@emails.dopecuts.ca>';

// Centralized manage URL provided by product
const MANAGE_URL = 'https://dopecuts.ca/reschedule';

// Lazily instantiate Resend only if we have an API key
const haveResend = !!RESEND_API_KEY;
const resend = haveResend ? new Resend(RESEND_API_KEY) : null;

/**
 * Reusable "Manage appointment" block for emails.
 * Shows a primary CTA button with a plain link fallback.
 */
const manageAppointmentBlock = (introLine = 'You can reschedule or cancel your appointment at any time:') => `
  <div style="margin-top: 20px;">
    <p style="margin: 0 0 12px 0;">${introLine}</p>
    <a href="${MANAGE_URL}"
       style="display:inline-block;padding:12px 18px;border-radius:6px;
              background:#111;color:#fff;text-decoration:none;font-weight:600;">
      Manage Appointment
    </a>
    <div style="font-size:12px;color:#666;margin-top:8px;">
      If the button doesn’t work, copy and paste this link:
      <br/>
      <a href="${MANAGE_URL}" style="color:#111;">${MANAGE_URL}</a>
    </div>
  </div>
`;

const renderGuestSection = (guests?: IBooking['additionalGuests']) => {
  if (!guests || guests.length === 0) return '';
  const rows = guests
    .map((guest) => {
      const guestService = guest.serviceName || 'Custom service';
      const guestTime = guest.time || 'TBD';
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${guest.firstName} ${guest.lastName}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${guestService}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${guestTime}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${guest.email || 'No email provided'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="margin-top: 24px;">
      <h3 style="margin-bottom: 8px;">Additional Guest Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Name</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Service</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Time</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Email</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
};

// ------------------------------
// Suppression helpers
// ------------------------------
type EmailKind =
  | 'confirmation' // customer booking confirmation
  | 'pending'      // customer pending payment
  | 'payment'      // customer payment confirmation
  | 'update'       // customer updated booking
  | 'cancel'       // customer cancellation
  | 'admin'        // admin notifications
  | 'custom'       // arbitrary messages to customer
  | 'otp';         // admin OTP

async function isEmailAllowed(kind: EmailKind): Promise<boolean> {
  const s = await getNotificationSettings(); // creates defaults if missing
  if (!s.emailEnabled) return false;
  if (kind === 'confirmation' && !s.autoSendBookingConfirmations) return false;
  return true;
}

function noResendClient(): boolean {
  if (!haveResend || !resend) {
    logger.info('Email suppressed: RESEND_API_KEY not configured.');
    return true;
  }
  return false;
}

async function guardedSend(
  kind: EmailKind,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: any }> {
  // 1) Feature suppression
  if (!(await isEmailAllowed(kind))) {
    logger.info(`Email suppressed by settings: kind=${kind}, to=${to}`);
    return { success: false, error: 'email_suppressed' };
  }

  // 2) Provider availability
  if (noResendClient()) {
    return { success: false, error: 'email_provider_disabled' };
  }

  // 3) Send
  try {
    await resend!.emails.send({ from: SENDER_EMAIL, to, subject, html });
    return { success: true };
  } catch (error) {
    logger.error('Resend send error', { to, subject, error });
    return { success: false, error };
  }
}

// ------------------------------
// Emails
// ------------------------------
export const sendOtpEmail = async (email: string, otp: string) => {
  const subject = 'Your Admin Login OTP';
  const html = `<p>Your One-Time Password is: <strong>${otp}</strong>. It is valid for 5 minutes.</p>`;
  const res = await guardedSend('otp', email, subject, html);
  if (!res.success) {
    console.error('Error sending OTP email:', res.error);
  }
  return res;
};

export const sendBookingConfirmationEmail = async (bookingDetails: IBooking) => {
  const { email, firstName, service, date, time, price, duration } = bookingDetails;
  const formattedDate = moment(date).format('MMMM DD, YYYY');

  const subject = 'Your Dopecuts Appointment is Confirmed!';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Hey ${firstName}, your booking is confirmed!</h2>
      <p>We’re excited to see you. Here are your appointment details:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Service:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${service}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Date:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${formattedDate}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Time:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${time}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Duration:</td><td style="padding: 8px; border: 1px solid #ddd;">${duration} minutes</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Total:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>$${price}</strong></td></tr>
      </table>
      ${renderGuestSection(bookingDetails.additionalGuests)}
      <p><strong>Location:</strong> 646 Upper James Street, Hamilton ON, L9C 2Z2</p>
      <p>If you need to cancel or reschedule, please do so at least 24 hours in advance.</p>
      ${manageAppointmentBlock()}
      <p style="margin-top:20px;">See you soon,<br/>The Dopecuts Team</p>
    </div>
  `;

  const res = await guardedSend('confirmation', email, subject, html);
  if (!res.success) {
    console.error(`Error sending confirmation email to ${email}:`, res.error);
  }
  return res;
};

// NEW: Pending (customer)
export const sendBookingPendingEmail = async (bookingDetails: IBooking) => {
  const { email, firstName, service, date, time, price, duration } = bookingDetails;
  const formattedDate = moment(date).format('MMMM DD, YYYY');

  const subject = 'Your Dopecuts Appointment is Pending Confirmation';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Hey ${firstName}, we’ve received your booking request!</h2>
      <p>Your appointment is currently <strong>pending</strong>. We will confirm it as soon as your payment is processed. Here are the details of your request:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Service:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${service}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Date:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${formattedDate}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Time:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${time}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Duration:</td><td style="padding: 8px; border: 1px solid #ddd;">${duration} minutes</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Total:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>$${price}</strong></td></tr>
      </table>
      ${renderGuestSection(bookingDetails.additionalGuests)}
      <p>You will receive another email once your booking is fully confirmed. No further action is needed from you at this time.</p>
      ${manageAppointmentBlock('Need to make changes while you wait?')}
      <p style="margin-top:20px;">Thanks,<br/>The Dopecuts Team</p>
    </div>
  `;

  const res = await guardedSend('pending', email, subject, html);
  if (!res.success) {
    console.error(`Error sending pending email to ${email}:`, res.error);
  }
  return res;
};

// NEW: Payment (customer)
export const sendPaymentConfirmationEmail = async (bookingDetails: IBooking) => {
  const { email, firstName, service, date, time } = bookingDetails;
  const formattedDate = moment(date).format('MMMM DD, YYYY');

  const subject = 'Payment Received - Your Dopecuts Appointment is Confirmed!';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Hey ${firstName}, your payment has been confirmed!</h2>
      <p>Your appointment is now fully confirmed. We’re excited to see you.</p>
      <p><strong>Service:</strong> ${service}</p>
      <p><strong>Date:</strong> ${formattedDate}</p>
      <p><strong>Time:</strong> ${time}</p>
      ${manageAppointmentBlock()}
      <p style="margin-top:20px;">See you soon,<br/>The Dopecuts Team</p>
    </div>
  `;

  const res = await guardedSend('payment', email, subject, html);
  if (!res.success) {
    console.error(`Error sending payment confirmation email to ${email}:`, res.error);
  }
  return res;
};

// Admin: New booking
export const sendAdminNotificationEmail = async (bookingDetails: IBooking) => {
  const { firstName, lastName, service, date, time, phone, email, notes, price, status } = bookingDetails;
  const formattedDate = moment(date).format('MMMM DD, YYYY');
  const statusText = status.charAt(0).toUpperCase() + status.slice(1);

  const subject = `New Booking (${statusText}): ${service} for ${firstName} ${lastName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>New Appointment Booked!</h2>
      <p>A new appointment has been scheduled. Details below:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Status:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${statusText}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Customer:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${firstName} ${lastName}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Email:</td><td style="padding: 8px; border: 1px solid #ddd;">${email}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Phone:</td><td style="padding: 8px; border: 1px solid #ddd;">${phone}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Service:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${service}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Date:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${formattedDate}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Time:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${time}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Price:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>$${price}</strong></td></tr>
        ${notes ? `<tr><td style="padding: 8px; border: 1px solid #ddd;">Notes:</td><td style="padding: 8px; border: 1px solid #ddd;">${notes}</td></tr>` : ''}
      </table>
    </div>
  `;

  const res = await guardedSend('admin', ADMIN_EMAIL, subject, html);
  if (!res.success) {
    console.error(`Error sending admin notification email:`, res.error);
  }
  return res;
};

// Customer: Update (no explicit return in original; keep silent)
export const sendBookingUpdateConfirmationEmail = async (bookingDetails: IBooking) => {
  const { email, firstName, service, date, time } = bookingDetails;
  const formattedDate = moment(date).format('MMMM DD, YYYY');

  const subject = 'Your Dopecuts Appointment Has Been Updated';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Hey ${firstName},</h2>
      <p>Your appointment has been successfully updated. Here are your new details:</p>
      <p><strong>Service:</strong> ${service}</p>
      <p><strong>New Date:</strong> ${formattedDate}</p>
      <p><strong>New Time:</strong> ${time}</p>
      ${manageAppointmentBlock()}
      <p style="margin-top:20px;">Thanks,<br/>The Dopecuts Team</p>
    </div>
  `;

  const res = await guardedSend('update', email, subject, html);
  if (!res.success) {
    console.error(`Error sending booking update email to ${email}:`, res.error);
  }
};

// Admin: Update (silent)
export const sendAdminUpdateNotificationEmail = async (bookingDetails: IBooking) => {
  const { firstName, lastName, service, date, time } = bookingDetails;
  const formattedDate = moment(date).format('MMMM DD, YYYY');

  const subject = `Appointment Rescheduled: ${service} for ${firstName} ${lastName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Appointment Updated</h2>
      <p>The appointment for <strong>${firstName} ${lastName}</strong> has been changed.</p>
      <p><strong>New Details:</strong></p>
      <ul>
        <li>Service: ${service}</li>
        <li>Date: ${formattedDate}</li>
        <li>Time: ${time}</li>
      </ul>
    </div>
  `;

  const res = await guardedSend('admin', ADMIN_EMAIL, subject, html);
  if (!res.success) {
    console.error('Error sending admin update notification:', res.error);
  }
};

// Customer: Cancellation (silent)
export const sendBookingCancellationEmail = async (bookingDetails: IBooking) => {
  const { email, firstName, service, date, time } = bookingDetails;
  const formattedDate = moment(date).format('MMMM DD, YYYY');

  const subject = 'Your Dopecuts Appointment Has Been Cancelled';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Hey ${firstName},</h2>
      <p>This is a confirmation that your appointment has been cancelled.</p>
      <p><strong>Cancelled Appointment Details:</strong></p>
      <ul>
        <li>Service: ${service}</li>
        <li>Date: ${formattedDate}</li>
        <li>Time: ${time}</li>
      </ul>
      <p>We hope to see you again soon.</p>
      <p>Thanks,<br/>The Dopecuts Team</p>
    </div>
  `;

  const res = await guardedSend('cancel', email, subject, html);
  if (!res.success) {
    console.error(`Error sending cancellation email to ${email}:`, res.error);
  }
};

// Admin: Cancellation (silent)
export const sendAdminCancellationNotificationEmail = async (bookingDetails: IBooking) => {
  const { firstName, lastName, service, date, time } = bookingDetails;
  const formattedDate = moment(date).format('MMMM DD, YYYY');

  const subject = `Appointment Cancelled: ${service} for ${firstName} ${lastName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Appointment Cancellation</h2>
      <p>The appointment for <strong>${firstName} ${lastName}</strong> has been cancelled.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Service: ${service}</li>
        <li>Date: ${formattedDate}</li>
        <li>Time: ${time}</li>
      </ul>
    </div>
  `;

  const res = await guardedSend('admin', ADMIN_EMAIL, subject, html);
  if (!res.success) {
    console.error('Error sending admin cancellation notification:', res.error);
  }
};

// Admin: Custom to a customer
export const sendCustomEmailToCustomer = async (email: string, subject: string, message: string) => {
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <p>Hello,</p>
      <p>You have a new message from the team at Dopecuts:</p>
      <div style="padding: 15px; border-left: 4px solid #ccc; margin: 15px 0;">
        ${message}
      </div>
      ${manageAppointmentBlock()}
      <p>Best,<br/>The Dopecuts Team</p>
    </div>
  `;

  const res = await guardedSend('custom', email, subject, html);
  if (!res.success) {
    console.error(`Error sending custom email to ${email}:`, res.error);
  }
  return res;
};

/** Sends a "we got your message" to the customer */
export const sendContactAcknowledgementEmail = async (args: {
  email: string;
  firstName?: string;
  subject: string;
}) => {
  const { email, firstName, subject } = args;
  const subj = `We received your message: ${subject}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Thanks${firstName ? `, ${firstName}` : ''} — we received your message.</h2>
      <p>Our team will get back to you as soon as possible.</p>
      <p style="margin-top:20px;">Best,<br/>The Dopecuts Team</p>
    </div>
  `;
  const res = await guardedSend('custom', email, subj, html);
  if (!res.success) {
    console.error(`Error sending contact acknowledgement to ${email}:`, res.error);
  }
  return res;
};

/** Notifies admin a new contact message has arrived */
export const sendAdminContactNotificationEmail = async (ticket: {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}) => {
  const { firstName, lastName, email, phone, subject, message } = ticket;
  const subj = `New Contact Message: ${subject} from ${firstName}${lastName ? ` ${lastName}` : ''}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>New Contact Message</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;border:1px solid #ddd;">From</td><td style="padding:8px;border:1px solid #ddd;"><strong>${firstName}${lastName ? ` ${lastName}` : ''}</strong> &lt;${email}&gt;</td></tr>
        ${phone ? `<tr><td style="padding:8px;border:1px solid #ddd;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${phone}</td></tr>` : ''}
        <tr><td style="padding:8px;border:1px solid #ddd;">Subject</td><td style="padding:8px;border:1px solid #ddd;">${subject}</td></tr>
      </table>
      <div style="margin-top:12px;padding:12px;border-left:4px solid #ccc;white-space:pre-wrap;">${message}</div>
    </div>
  `;
  const res = await guardedSend('admin', ADMIN_EMAIL, subj, html);
  if (!res.success) {
    console.error('Error sending admin contact notification:', res.error);
  }
  return res;
};

export const sendCustomerVerificationCodeEmail = async (email: string, otp: string) => {
  const subject = 'Your Dopecuts Verification Code';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <p>Your Dopecuts verification code is:</p>
      <p style="font-size: 22px; font-weight: bold; letter-spacing: 2px;">${otp}</p>
      <p>This code is valid for 5 minutes.</p>
    </div>
  `;
  const res = await guardedSend('otp', email, subject, html);
  if (!res.success) {
    console.error('Error sending customer verification code email:', res.error);
  }
  return res;
};
