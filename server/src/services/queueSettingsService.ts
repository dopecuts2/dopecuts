import { QueueSettings, IQueueSettings } from '../models/queueSettings.model';

export async function getQueueSettings(): Promise<IQueueSettings> {
  const existing = await QueueSettings.findOne();
  if (existing) return existing;
  const created = await QueueSettings.create({ enforcePrepayForQueue: false });
  return created;
}

export async function updateQueueSettings(payload: Partial<Pick<IQueueSettings, 'enforcePrepayForQueue'>>): Promise<IQueueSettings> {
  const current = await getQueueSettings();
  const updated = await QueueSettings.findByIdAndUpdate(
    current._id,
    { $set: payload },
    { new: true }
  );
  return updated || current;
}
