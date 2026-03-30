// dopekuts/lib/api/email.ts
import apiClient from './apiClient';

// --- Interfaces ---

export interface CustomEmailData {
    email: string;
    subject: string;
    message: string;
}

// --- Admin-Only API Functions ---

/**
 * Send a custom email to a customer.
 * @param data - { email, subject, message }
 * @access Private (Admin only)
 */
export async function sendCustomEmail(data: CustomEmailData): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/email/send-custom', data);
    return response.data;
}