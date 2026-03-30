import apiClient from './apiClient';

export type QueueStatus = 'pending' | 'assigned' | 'expired';

export interface IQueueEntry {
  _id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  requestedDate: string;
  desiredTime?: string;
  preferAnytime?: boolean;
  preferredPaymentMethod: 'in-person' | 'now';
  status: QueueStatus;
  notes?: string;
  additionalGuests?: Array<{ firstName: string; lastName?: string; email?: string }>;
  createdAt?: string;
}

export async function adminListQueue(params: { date?: string; status?: QueueStatus; serviceId?: string } = {}) {
  const res = await apiClient.get<IQueueEntry[]>('/queue', { params });
  return res.data;
}

export async function adminUpdateQueueStatus(id: string, status: QueueStatus) {
  const res = await apiClient.patch<{ message: string; entry: IQueueEntry }>(`/queue/${id}/status`, { status });
  return res.data;
}

export interface QueueSettingsResponse {
  enforcePrepayForQueue: boolean;
}

export async function adminGetQueueSettings() {
  const res = await apiClient.get<QueueSettingsResponse>('/queue/settings');
  return res.data;
}

export async function adminUpdateQueueSettings(payload: QueueSettingsResponse) {
  const res = await apiClient.put<QueueSettingsResponse>('/queue/settings', payload);
  return res.data;
}

export async function adminConvertQueueEntry(id: string, time: string, serviceId?: string) {
  const res = await apiClient.post<{ message: string; booking: any }>(`/queue/${id}/convert`, { time, serviceId });
  return res.data;
}
