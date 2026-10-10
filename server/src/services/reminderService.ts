import moment from 'moment-timezone';
import { Booking } from '../models/booking.model';
import { getNotificationSettings } from './notificationSettingsService';
import { sendAppointmentReminderEmail } from './emailService';
import { DEFAULT_TIMEZONE } from '../config/time';
import { logger } from '../utils/logger';

/**
 * Checks upcoming bookings against each enabled reminder's lead time and
 * sends appointment-reminder emails once their threshold is crossed. Each
 * reminder's "sent" flag is per-booking, so re-running this never double
 * sends; a booking that's already past its appointment time (and never got
 * reminded, e.g. the server was down) is marked sent without emailing, so
 * it stops being rechecked indefinitely.
 */
export async function checkAndSendReminders() {
  const settings = await getNotificationSettings();
  if (!settings.emailEnabled) return;

  const reminder1On = !!settings.reminder1Enabled;
  const reminder2On = !!settings.reminder2Enabled;
  if (!reminder1On && !reminder2On) return;

  const timezone = settings.timezone || DEFAULT_TIMEZONE;
  const now = moment.tz(timezone);

  const unsentConditions: Record<string, any>[] = [];
  if (reminder1On) unsentConditions.push({ reminder1Sent: { $ne: true } });
  if (reminder2On) unsentConditions.push({ reminder2Sent: { $ne: true } });

  const bookings = await Booking.find({
    status: { $ne: 'cancelled' },
    date: {
      $gte: moment.utc().startOf('day').toDate(),
      $lte: moment.utc().add(8, 'days').endOf('day').toDate(),
    },
    $or: unsentConditions,
  });

  for (const booking of bookings) {
    const dateISO = moment.utc(booking.date).format('YYYY-MM-DD');
    const apptMoment = moment.tz(`${dateISO} ${booking.time}`, 'YYYY-MM-DD h:mm A', timezone);
    if (!apptMoment.isValid()) continue;

    let changed = false;

    if (apptMoment.isSameOrBefore(now)) {
      // Appointment has already started/passed; stop tracking it either way.
      if (reminder1On && !booking.reminder1Sent) {
        booking.reminder1Sent = true;
        changed = true;
      }
      if (reminder2On && !booking.reminder2Sent) {
        booking.reminder2Sent = true;
        changed = true;
      }
      if (changed) await booking.save();
      continue;
    }

    if (reminder1On && !booking.reminder1Sent) {
      const dueAt = apptMoment.clone().subtract(settings.reminder1MinutesBefore, 'minutes');
      if (now.isSameOrAfter(dueAt)) {
        await sendAppointmentReminderEmail(booking, settings.reminder1MinutesBefore);
        booking.reminder1Sent = true;
        changed = true;
      }
    }

    if (reminder2On && !booking.reminder2Sent) {
      const dueAt = apptMoment.clone().subtract(settings.reminder2MinutesBefore, 'minutes');
      if (now.isSameOrAfter(dueAt)) {
        await sendAppointmentReminderEmail(booking, settings.reminder2MinutesBefore);
        booking.reminder2Sent = true;
        changed = true;
      }
    }

    if (changed) await booking.save();
  }
}

const REMINDER_SWEEP_INTERVAL_MS = 1000 * 60 * 5; // every 5 minutes
let sweepTimer: NodeJS.Timeout | null = null;

export function startReminderSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    checkAndSendReminders().catch((err) => logger.error('Reminder sweeper failed', err));
  }, REMINDER_SWEEP_INTERVAL_MS);
}
