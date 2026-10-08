import { Request, Response } from 'express';
import { CustomerRestriction, RestrictionStatus } from '../models/customerRestriction.model';
import { normalizePhoneDigits } from '../utils/phone';
import { logger } from '../utils/logger';

/**
 * Public: check a phone number's restriction status before/while booking,
 * independent of whether it has a Contact record (an admin-added
 * restriction may predate any booking history for that number).
 */
export const checkPhoneRestriction = async (req: Request, res: Response) => {
  const phoneParam = (req.params.phone || '').trim();
  const phoneNormalized = normalizePhoneDigits(phoneParam);
  if (!phoneNormalized) {
    return res.status(400).json({ message: 'Invalid phone number.' });
  }
  try {
    const restriction = await CustomerRestriction.findOne({ phoneNormalized });
    res.status(200).json({ status: restriction?.status || 'none' });
  } catch (error) {
    logger.error('Error checking phone restriction:', error);
    res.status(500).json({ message: 'Failed to check restriction status.' });
  }
};

/** List every restricted/pay-now-required phone number (admin). */
export const getCustomerRestrictions = async (_req: Request, res: Response) => {
  try {
    const restrictions = await CustomerRestriction.find().sort({ createdAt: -1 });
    res.status(200).json(restrictions);
  } catch (error) {
    logger.error('Error fetching customer restrictions:', error);
    res.status(500).json({ message: 'Failed to fetch restrictions.' });
  }
};

/** Add or update a restriction for a phone number (admin). */
export const upsertCustomerRestriction = async (req: Request, res: Response) => {
  const { phone, status, reason } = req.body as { phone?: string; status?: RestrictionStatus; reason?: string };

  if (!phone || !status || !['pay_now_required', 'banned'].includes(status)) {
    return res.status(400).json({ message: 'Phone and a valid status are required.' });
  }

  const phoneNormalized = normalizePhoneDigits(phone);
  if (!phoneNormalized) {
    return res.status(400).json({ message: 'Invalid phone number.' });
  }

  try {
    const restriction = await CustomerRestriction.findOneAndUpdate(
      { phoneNormalized },
      { phone, phoneNormalized, status, reason: reason?.trim() || undefined },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ message: 'Restriction saved.', restriction });
  } catch (error) {
    logger.error('Error saving customer restriction:', error);
    res.status(500).json({ message: 'Failed to save restriction.' });
  }
};

/** Remove a restriction entirely -- the number can book normally again (admin). */
export const deleteCustomerRestriction = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const deleted = await CustomerRestriction.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Restriction not found.' });
    }
    res.status(200).json({ message: 'Restriction removed.' });
  } catch (error) {
    logger.error('Error deleting customer restriction:', error);
    res.status(500).json({ message: 'Failed to delete restriction.' });
  }
};
