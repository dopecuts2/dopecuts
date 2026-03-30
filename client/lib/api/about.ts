import apiClient from './apiClient';

export interface IAbout {
  _id?: string;
  heroTitle: string;
  heroSubtitle: string;
  storyTitle: string;
  storyBody: string;
  mission: string;
  values: string[];
}

export interface IBarber {
  _id: string;
  name: string;
  role: string;
  experience?: string;
  image: string;
  order: number;
  isActive: boolean;
}

export async function getAbout(): Promise<{ about: IAbout; barbers: IBarber[] }> {
  const res = await apiClient.get<{ about: IAbout; barbers: IBarber[] }>('/about');
  return res.data;
}

export async function updateAbout(payload: Partial<IAbout>): Promise<{ message: string; about: IAbout }> {
  const res = await apiClient.put<{ message: string; about: IAbout }>('/about', payload);
  return res.data;
}

export async function createBarber(payload: {
  name: string;
  role: string;
  experience?: string;
  order?: number;
  isActive?: boolean;
  image: File;
}): Promise<{ message: string; barber: IBarber }> {
  const form = new FormData();
  form.append('name', payload.name);
  form.append('role', payload.role);
  if (payload.experience) form.append('experience', payload.experience);
  if (payload.order !== undefined) form.append('order', String(payload.order));
  form.append('isActive', String(payload.isActive ?? true));
  form.append('image', payload.image);
  const res = await apiClient.post<{ message: string; barber: IBarber }>(
    '/about/barbers',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
}

export async function updateBarber(
  id: string,
  payload: {
    name?: string;
    role?: string;
    experience?: string;
    order?: number;
    isActive?: boolean;
    image?: File | null;
  }
): Promise<{ message: string; barber: IBarber }> {
  const form = new FormData();
  if (payload.name) form.append('name', payload.name);
  if (payload.role) form.append('role', payload.role);
  if (payload.experience !== undefined) form.append('experience', payload.experience);
  if (payload.order !== undefined) form.append('order', String(payload.order));
  if (payload.isActive !== undefined) form.append('isActive', String(payload.isActive));
  if (payload.image) form.append('image', payload.image);
  const res = await apiClient.put<{ message: string; barber: IBarber }>(
    `/about/barbers/${id}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
}

export async function deleteBarber(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/about/barbers/${id}`);
  return res.data;
}
