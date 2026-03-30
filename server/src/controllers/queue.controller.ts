import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { QueueEntry } from '../models/queue.model';
import { logger } from '../utils/logger';
import { convertQueueEntry } from '../services/queueService';
import { getQueueSettings, updateQueueSettings } from '../services/queueSettingsService';

export const adminListQueue = async (req: Request, res: Response) => {
  try {
    const { date, status, serviceId } = req.query as { date?: string; status?: string; serviceId?: string };
    const filter: any = {};
    if (date) filter.requestedDate = date;
    if (status) filter.status = status;
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) filter.serviceId = new mongoose.Types.ObjectId(serviceId);

    const entries = await QueueEntry.find(filter).sort({ requestedDate: 1, createdAt: 1 }).lean();
    return res.status(200).json(entries);
  } catch (error) {
    logger.error('adminListQueue failed', error);
    return res.status(500).json({ message: 'Failed to fetch queue entries.' });
  }
};

export const adminUpdateQueueStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: 'pending' | 'assigned' | 'expired' };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid queue entry id.' });
    }
    if (!status || !['pending', 'assigned', 'expired'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    const updated = await QueueEntry.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'Queue entry not found.' });
    }
    return res.status(200).json({ message: 'Queue entry updated.', entry: updated });
  } catch (error) {
    logger.error('adminUpdateQueueStatus failed', error);
    return res.status(500).json({ message: 'Failed to update queue entry.' });
  }
};

export const adminConvertQueueEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { time, serviceId } = req.body as { time?: string; serviceId?: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid queue entry id.' });
    }
    if (!time) {
      return res.status(400).json({ message: 'Time is required to convert queue entry.' });
    }
    const booking = await convertQueueEntry(id, time, serviceId);
    return res.status(200).json({ message: 'Queue entry converted to booking.', booking });
  } catch (error) {
    logger.error('adminConvertQueueEntry failed', error);
    return res.status(500).json({ message: 'Failed to convert queue entry.' });
  }
};

export const adminGetQueueSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await getQueueSettings();
    return res.status(200).json(settings);
  } catch (error) {
    logger.error('adminGetQueueSettings failed', error);
    return res.status(500).json({ message: 'Failed to fetch queue settings.' });
  }
};

export const adminUpdateQueueSettings = async (req: Request, res: Response) => {
  try {
    const { enforcePrepayForQueue } = req.body as { enforcePrepayForQueue?: boolean };
    const updated = await updateQueueSettings({ enforcePrepayForQueue: Boolean(enforcePrepayForQueue) });
    return res.status(200).json(updated);
  } catch (error) {
    logger.error('adminUpdateQueueSettings failed', error);
    return res.status(500).json({ message: 'Failed to update queue settings.' });
  }
};
