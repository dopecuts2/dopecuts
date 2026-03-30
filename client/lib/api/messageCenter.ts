import apiClient from './apiClient';

export interface MessageChannelSummary {
  attempted: number;
  succeeded: number;
  skipped: number;
  failed: Array<{ contactId: string; reason: string }>;
}

export interface MessageCampaignPayload {
  contactIds?: string[];
  sendToAll?: boolean;
  email?: {
    subject: string;
    message: string;
  };
  sms?: {
    message: string;
  };
}

export interface MessageCampaignResponse {
  totalRecipients: number;
  email?: MessageChannelSummary;
  sms?: MessageChannelSummary;
}

export async function sendMessageCampaign(
  payload: MessageCampaignPayload
): Promise<MessageCampaignResponse> {
  const response = await apiClient.post<MessageCampaignResponse>('/messages/send', payload);
  return response.data;
}
