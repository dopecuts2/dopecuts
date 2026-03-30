import apiClient from './apiClient';

// --- Interfaces ---

export interface AdditionalGuest {
  firstName: string;
  lastName?: string;
  email?: string;
  serviceId: string;
  time: string;
  serviceName?: string;
}

export interface IBooking {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  service: string;
  price: number;
  duration: number;
  date: string; // ISO string format
  time: string;
  notes?: string;
  paymentMethod: 'now' | 'in-person';
  status: 'pending' | 'confirmed' | 'cancelled';
  serviceId?: string;
  phoneNormalized?: string;
  additionalGuests?: AdditionalGuest[];
  cancellationNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingData {
  serviceId: string;
  date: string; // e.g., "YYYY-MM-DD"
  time: string; // e.g., "10:00 AM"
  phone: string; // E.164 preferred, but backend accepts as provided
  firstName: string;
  lastName?: string;
  email: string;
  notes?: string;
  paymentMethod: 'now' | 'in-person';
  additionalGuests?: AdditionalGuest[];
}

/**
 * For public self-service update:
 * Provide either:
 *   - Authorization: Bearer <token> (recommended)
 *   - OR `email` (matches booking.email)
 *   - OR `phone` + `otp` (from phone OTP flow)
 * Admins do not need email/phone/otp.
 */
export interface UpdateBookingData {
  serviceId?: string;
  date?: string;
  time?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  email?: string; // public legacy: ONE of (email) OR (phone + otp)
  notes?: string;
  cancellationNote?: string;
  otp?: string;   // used with phone for OTP verification (legacy)
}

/**
 * For public self-service cancel:
 * Provide either:
 *   - Authorization: Bearer <token> (recommended)
 *   - OR `email`
 *   - OR `phone` + `otp`
 * Admins do not need a body.
 */
export interface CancelBookingData {
  email?: string;
  phone?: string;
  otp?: string;
  cancellationNote?: string;
}

export interface QueueJoinPayload {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  serviceId: string;
  requestedDate: string;
  desiredTime?: string;
  preferAnytime?: boolean;
  preferredPaymentMethod?: 'now' | 'in-person';
  notes?: string;
  additionalGuests?: AdditionalGuest[];
}

export interface PhoneOtpStartPayload {
  phone: string;
}

export interface PhoneOtpVerifyPayload {
  phone: string;
  otp: string;
}

export interface EmailOtpStartPayload {
  email: string;
}

export interface EmailOtpVerifyPayload {
  email: string;
  otp: string;
}

export interface VerifyResponse {
  message: string;
  token: string; // manage token (JWT)
}

export interface ManageLookupResponse {
  booking: IBooking;
}

/** Shape for backend 409 conflict (slot invalid) */
export interface SlotConflictErrorPayload {
  message: string;
  suggestions?: string[];
}

// --- Helpers ---

function authHeader(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function rethrowWithSuggestions(err: any) {
  const status = err?.response?.status;
  if (status === 409) {
    const payload = err?.response?.data as SlotConflictErrorPayload;
    const out: any = new Error(payload?.message || 'Selected time is unavailable.');
    out.status = 409;
    out.suggestions = payload?.suggestions || [];
    throw out;
  }
  throw err;
}

// --- API Functions ---

/**
 * Create a new booking.
 * Returns 201 with { message, booking } on success.
 * Throws Error with { status:409, suggestions:string[] } when slot invalid.
 * @access Public
 */
export async function createBooking(
  data: CreateBookingData
): Promise<{ message: string; booking: IBooking; additionalBookings?: IBooking[] }> {
  try {
    const response = await apiClient.post<{ message: string; booking: IBooking; additionalBookings?: IBooking[] }>(
      '/bookings',
      data
    );
    return response.data;
  } catch (err) {
    rethrowWithSuggestions(err);
  }
  // Typescript flow
  throw new Error('Unexpected error creating booking');
}

/**
 * Get an upcoming booking by the user's phone number. (Legacy path)
 * @access Public
 */
export async function getBookingByPhone(phone: string): Promise<IBooking> {
  const response = await apiClient.get<IBooking>(`/bookings/phone/${phone}`);
  return response.data;
}

/**
 * Get an upcoming booking by the user's email. (Legacy path)
 * @access Public
 */
export async function getBookingByEmail(email: string): Promise<IBooking> {
  const response = await apiClient.get<IBooking>(`/bookings/email/${encodeURIComponent(email)}`);
  return response.data;
}

/**
 * Token-based manage lookup for the current user's upcoming booking.
 * Pass the manage token from verifyPhoneOtp/verifyEmailOtp.
 * @access Public (with token)
 */
export async function getManageBooking(token: string): Promise<ManageLookupResponse> {
  const response = await apiClient.get<ManageLookupResponse>(
    '/bookings/manage',
    { headers: authHeader(token) }
  );
  return response.data;
}

/**
 * Start phone OTP for self-service (reschedule/cancel).
 * Sends a 6-digit code via SMS.
 * @access Public
 */
export async function startPhoneOtp(payload: PhoneOtpStartPayload): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/bookings/phone-otp/start`,
    payload
  );
  return response.data;
}

/**
 * Verify phone OTP for self-service (reschedule/cancel).
 * Returns a short-lived manage token.
 * @access Public
 */
export async function verifyPhoneOtp(payload: PhoneOtpVerifyPayload): Promise<VerifyResponse> {
  const response = await apiClient.post<VerifyResponse>(
    `/bookings/phone-otp/verify`,
    payload
  );
  return response.data;
}

/**
 * Start email OTP for self-service (reschedule/cancel).
 * Sends a 6-digit code via email.
 * @access Public
 */
export async function startEmailOtp(payload: EmailOtpStartPayload): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/bookings/email-otp/start`,
    payload
  );
  return response.data;
}

/**
 * Verify email OTP for self-service (reschedule/cancel).
 * Returns a short-lived manage token.
 * @access Public
 */
export async function verifyEmailOtp(payload: EmailOtpVerifyPayload): Promise<VerifyResponse> {
  const response = await apiClient.post<VerifyResponse>(
    `/bookings/email-otp/verify`,
    payload
  );
  return response.data;
}

/**
 * Update a booking as a customer (public).
 * Preferred: pass `token` to authorize with Bearer; body can be changes only.
 * Legacy: omit token and include either `email` OR `phone` + `otp` in `data`.
 *
 * Throws Error with { status:409, suggestions:string[] } if target slot is invalid.
 * @access Public
 */
export async function updateBookingPublic(
  id: string,
  data: UpdateBookingData,
  token?: string
): Promise<{ message: string; booking: IBooking }> {
  try {
    const response = await apiClient.put<{ message: string; booking: IBooking }>(
      `/bookings/manage/${id}`,
      data,
      { headers: authHeader(token) }
    );
    return response.data;
  } catch (err) {
    rethrowWithSuggestions(err);
  }
  throw new Error('Unexpected error updating booking');
}

/**
 * Update a booking as an admin.
 * Throws 409 with suggestions if slot invalid.
 * @access Private (Admin only)
 */
export async function updateBookingAdmin(
  id: string,
  data: UpdateBookingData
): Promise<{ message: string; booking: IBooking }> {
  try {
    const response = await apiClient.put<{ message: string; booking: IBooking }>(
      `/bookings/${id}`,
      data
    );
    return response.data;
  } catch (err) {
    rethrowWithSuggestions(err);
  }
  throw new Error('Unexpected error updating booking (admin)');
}

/**
 * Cancel a booking as a customer (public).
 * Preferred: pass `token` to authorize with Bearer; body can be empty.
 * Legacy: omit token and include either `email` OR `phone` + `otp` in `data`.
 * @access Public
 */
export async function cancelBookingPublic(
  id: string,
  data: CancelBookingData = {},
  token?: string
): Promise<{ message: string }> {
  const response = await apiClient.patch<{ message: string }>(
    `/bookings/manage/${id}/cancel`,
    data,
    { headers: authHeader(token) }
  );
  return response.data;
}

export async function joinBookingQueue(data: QueueJoinPayload): Promise<{ message: string; entry: any }> {
  const response = await apiClient.post<{ message: string; entry: any }>(
    '/bookings/queue',
    data
  );
  return response.data;
}

/**
 * Cancel a booking as an admin.
 * @access Private (Admin only)
 */
export async function cancelBookingAdmin(
  id: string,
  data: { cancellationNote?: string } = {}
): Promise<{ message: string }> {
  const response = await apiClient.patch<{ message: string }>(
    `/bookings/${id}/cancel`,
    data
  );
  return response.data;
}

// --- Admin-Only Functions ---

/**
 * Get all bookings, sorted by most recent.
 * @access Private (Admin only)
 */
export async function getAllBookings(): Promise<IBooking[]> {
  const response = await apiClient.get<IBooking[]>('/bookings');
  return response.data;
}

/**
 * Send a custom message (SMS) to a booking's phone.
 * @access Private (Admin only)
 */
export async function sendBookingMessage(
  id: string,
  message: string
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(`/bookings/${id}/message`, { message });
  return response.data;
}

/**
 * Confirm payment for a booking and change its status from 'pending' to 'confirmed'.
 * @access Private (Admin only)
 */
export async function confirmPayment(
  id: string
): Promise<{ message: string; booking: IBooking }> {
  const response = await apiClient.patch<{ message: string; booking: IBooking }>(
    `/bookings/${id}/confirm-payment`
  );
  return response.data;
}
