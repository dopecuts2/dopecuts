import apiClient from './apiClient';

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'tiktok'
  | 'snapchat'
  | 'linkedin'
  | 'youtube'
  | 'pinterest'
  | 'whatsapp'
  | 'telegram';

export interface ISocial {
  _id: string;
  platform: SocialPlatform;
  label: string;
  url: string;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function getActiveSocials(): Promise<ISocial[]> {
  const res = await apiClient.get<ISocial[]>('/socials');
  return res.data;
}

export async function getAllSocials(): Promise<ISocial[]> {
  const res = await apiClient.get<ISocial[]>('/socials/all');
  return res.data;
}

export async function createSocial(payload: Partial<ISocial>): Promise<{ message: string; social: ISocial }> {
  const res = await apiClient.post<{ message: string; social: ISocial }>('/socials', payload);
  return res.data;
}

export async function updateSocial(id: string, payload: Partial<ISocial>): Promise<{ message: string; social: ISocial }> {
  const res = await apiClient.put<{ message: string; social: ISocial }>(`/socials/${id}`, payload);
  return res.data;
}

export async function deleteSocial(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/socials/${id}`);
  return res.data;
}
