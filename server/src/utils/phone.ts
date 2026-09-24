export function normalizePhoneDigits(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits;
}

/**
 * Normalize a phone number to the E.164-ish format ("+1XXXXXXXXXX") that
 * the public booking form stores on Contact/Booking records, so imported
 * contacts can be found by the exact-match phone lookup used for the
 * "returning customer" autofill. Returns null if the input can't be
 * confidently normalized (too few/many digits).
 */
export function normalizeToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.toString().trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (trimmed.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;

  return null;
}
