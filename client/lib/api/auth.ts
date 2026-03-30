// dopekuts/lib/api/auth.ts
import apiClient from './apiClient';

// --- Interfaces ---

export interface RequestOtpData {
  email: string;
}

export interface VerifyOtpData {
  email: string;
  otp: string;
}

export interface Admin {
  _id: string;
  email: string;
  // Add other admin properties if they exist in your model
}

export interface LoginResponse {
  message: string;
  admin: Admin;
}

// --- API Functions ---

/**
 * Step 1: Request an OTP to be sent to the admin's email address.
 *
 * @param data - { email } of the admin.
 * @returns A promise that resolves to a success message.
 */
export async function requestOtp(data: RequestOtpData): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/request-otp', data);
  return response.data;
}

/**
 * Step 2: Verify the OTP to log in and receive a session cookie.
 *
 * @param data - { email, otp } from the admin.
 * @returns A promise that resolves to a success message and the admin's data.
 */
export async function verifyOtpAndLogin(data: VerifyOtpData): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/verify-otp', data);
  return response.data;
}