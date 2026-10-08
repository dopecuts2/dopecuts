// lib/api/service.ts
import apiClient from './apiClient';

// --- Interfaces ---

export interface IService {
    _id: string;
    name: string;
    duration: number; // in minutes
    price: number;
    description?: string; // <-- ADDED
    isVisible?: boolean; // false = hidden from the public booking site; defaults to true
    createdAt: string;
    updatedAt: string;
}

// ServiceData will now correctly include the optional 'description' field
export type ServiceData = Omit<IService, '_id' | 'createdAt' | 'updatedAt'>;

// --- Public API Functions ---

/**
 * Get all services.
 * @access Public
 */
export async function getAllServices(): Promise<IService[]> {
    const response = await apiClient.get<IService[]>('/services');
    return response.data;
}

/**
 * Get a single service by its ID.
 * @access Public
 */
export async function getServiceById(id: string): Promise<IService> {
    const response = await apiClient.get<IService>(`/services/${id}`);
    return response.data;
}

// --- Admin-Only API Functions ---

/**
 * Get every service, including hidden ones, for the admin Services page.
 * @access Private (Admin only)
 */
export async function getAllServicesForAdmin(): Promise<IService[]> {
    const response = await apiClient.get<IService[]>('/services/admin/all');
    return response.data;
}

/**
 * Create a new service.
 * @access Private (Admin only)
 */
export async function createService(data: ServiceData): Promise<{ message: string, service: IService }> {
    const response = await apiClient.post<{ message: string, service: IService }>('/services', data);
    return response.data;
}

/**
 * Update an existing service.
 * @access Private (Admin only)
 */
export async function updateService(id: string, data: Partial<ServiceData>): Promise<{ message: string, service: IService }> {
    const response = await apiClient.put<{ message: string, service: IService }>(`/services/${id}`, data);
    return response.data;
}

/**
 * Delete a service by its ID.
 * @access Private (Admin only)
 */
export async function deleteService(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/services/${id}`);
    return response.data;
}