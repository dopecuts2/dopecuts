import apiClient from './apiClient';

export interface ApiKeyStatus {
  active: boolean;
  keyPrefix?: string;
  createdAt?: string;
  lastUsedAt?: string | null;
}

export interface GeneratedApiKey {
  message: string;
  key: string;
  keyPrefix: string;
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  const response = await apiClient.get<ApiKeyStatus>('/api-keys');
  return response.data;
}

export async function generateApiKey(): Promise<GeneratedApiKey> {
  const response = await apiClient.post<GeneratedApiKey>('/api-keys/generate');
  return response.data;
}

export async function revokeApiKey(): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/api-keys/revoke');
  return response.data;
}
