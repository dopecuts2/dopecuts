// dopekuts/lib/api/contact.ts
import apiClient from './apiClient';

// --- Interfaces ---

export interface IContact {
    _id: string;
    name: string;
    email: string;
    phone: string;
    createdAt: string;
    updatedAt: string;
}

export type ContactData = Omit<IContact, '_id' | 'createdAt' | 'updatedAt'>;

// --- Admin-Only API Functions ---

/**
 * Create a new contact.
 * @access Private (Admin only)
 */
export async function createContact(data: ContactData): Promise<IContact> {
    const response = await apiClient.post<IContact>('/contacts', data);
    return response.data;
}

/**
 * Get all contacts.
 * @access Private (Admin only)
 */
export async function getAllContacts(): Promise<IContact[]> {
    const response = await apiClient.get<IContact[]>('/contacts');
    return response.data;
}

/**
 * Get a single contact by its ID.
 * @access Private (Admin only)
 */
export async function getContactById(id: string): Promise<IContact> {
    const response = await apiClient.get<IContact>(`/contacts/${id}`);
    return response.data;
}

/**
 * Update an existing contact.
 * @access Private (Admin only)
 */
export async function updateContact(id: string, data: Partial<ContactData>): Promise<IContact> {
    const response = await apiClient.put<IContact>(`/contacts/${id}`, data);
    return response.data;
}

/**
 * Delete a contact by its ID.
 * @access Private (Admin only)
 */
export async function deleteContact(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/contacts/${id}`);
    return response.data;
}

export interface IContactLookup {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cancellationCount: number;
}

/**
 * Public lookup by phone for autofill during booking.
 * @access Public
 */
export async function getContactByPhone(phone: string): Promise<IContactLookup> {
  const res = await apiClient.get<IContactLookup>(`/contacts/lookup/phone/${encodeURIComponent(phone)}`);
  return res.data;
}
