import apiClient from './apiClient';

export type RestrictionStatus = 'pay_now_required' | 'banned';

export interface ICustomerRestriction {
  _id: string;
  phone: string;
  phoneNormalized: string;
  status: RestrictionStatus;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getCustomerRestrictions(): Promise<ICustomerRestriction[]> {
  const response = await apiClient.get<ICustomerRestriction[]>('/customer-restrictions');
  return response.data;
}

export async function upsertCustomerRestriction(data: {
  phone: string;
  status: RestrictionStatus;
  reason?: string;
}): Promise<{ message: string; restriction: ICustomerRestriction }> {
  const response = await apiClient.post<{ message: string; restriction: ICustomerRestriction }>(
    '/customer-restrictions',
    data
  );
  return response.data;
}

export async function deleteCustomerRestriction(id: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/customer-restrictions/${id}`);
  return response.data;
}

export async function checkPhoneRestriction(phone: string): Promise<{ status: 'none' | RestrictionStatus }> {
  const response = await apiClient.get<{ status: 'none' | RestrictionStatus }>(
    `/customer-restrictions/check/${encodeURIComponent(phone)}`
  );
  return response.data;
}
