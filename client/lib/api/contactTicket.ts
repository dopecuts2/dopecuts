// dopecut/dopekuts-main/lib/api/contact-tickets.ts
import apiClient from './apiClient';

// --- Interfaces ---

export interface ContactFormData {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export type ContactStatus = 'open' | 'answered' | 'closed';

export interface ContactResponse {
  subject: string;
  message: string;
  sentAt: string;
  sentBy?: string; // Admin _id
}

export interface ContactTicket {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactStatus;
  adminNotes?: string;
  responses: ContactResponse[];
  meta?: { ip?: string | null; userAgent?: string | null; source?: 'web' | 'mobile' | 'other' };
  closedAt?: string | null;
  closedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Public API ---

/**
 * Submit contact form (public)
 */
export async function submitContactForm(data: ContactFormData): Promise<{ message: string; ticketId: string }> {
  const res = await apiClient.post<{ message: string; ticketId: string }>('/contact-tickets', data);
  return res.data;
}

// --- Admin API ---

export interface ListTicketsParams {
  page?: number;
  limit?: number;
  status?: ContactStatus;
  q?: string;
  sort?: string; // "createdAt:desc" etc.
}

export interface ListTicketsResponse {
  items: ContactTicket[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * List tickets (admin; requires cookie auth)
 */
export async function listContactTickets(params: ListTicketsParams = {}): Promise<ListTicketsResponse> {
  const res = await apiClient.get<ListTicketsResponse>('/contact-tickets', { params });
  return res.data;
}

/**
 * Get a single ticket by id (admin)
 */
export async function getContactTicket(id: string): Promise<ContactTicket> {
  const res = await apiClient.get<ContactTicket>(`/contact-tickets/${id}`);
  return res.data;
}

/**
 * Respond to a ticket (admin). Sends an email to the customer and records the response.
 */
export async function respondToContactTicket(id: string, payload: { subject: string; message: string }): Promise<{
  message: string;
  ticket: ContactTicket;
}> {
  const res = await apiClient.post<{ message: string; ticket: ContactTicket }>(`/contact-tickets/${id}/respond`, payload);
  return res.data;
}

/**
 * Close a ticket (admin). Optionally notifies the customer.
 */
export async function closeContactTicket(
  id: string,
  payload: { note?: string; notifyCustomer?: boolean; subject?: string; message?: string } = {}
): Promise<{
  message: string;
  ticket: ContactTicket;
}> {
  const res = await apiClient.patch<{ message: string; ticket: ContactTicket }>(`/contact-tickets/${id}/close`, payload);
  return res.data;
}