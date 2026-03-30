import { Request, Response } from 'express';
import { Social, ISocial, SocialPlatform } from '../models/social.model';
import { logger } from '../utils/logger';

const TOP_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'twitter',
  'tiktok',
  'snapchat',
  'linkedin',
  'youtube',
  'pinterest',
  'whatsapp',
  'telegram',
];

const isValidUrl = (url: string) => /^https?:\/\//i.test(url);

export const getActiveSocials = async (_req: Request, res: Response) => {
  try {
    const socials = await Social.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.status(200).json(socials);
  } catch (error) {
    logger.error('Error fetching socials:', error);
    res.status(500).json({ message: 'Failed to fetch socials.' });
  }
};

export const getAllSocials = async (_req: Request, res: Response) => {
  try {
    const socials = await Social.find().sort({ order: 1, createdAt: -1 });
    res.status(200).json(socials);
  } catch (error) {
    logger.error('Error fetching all socials:', error);
    res.status(500).json({ message: 'Failed to fetch socials.' });
  }
};

export const createSocial = async (req: Request, res: Response) => {
  const { platform, label, url, isActive = true, order = 0 } = req.body as Partial<ISocial>;

  if (!platform || !label || !url) {
    return res.status(400).json({ message: 'Platform, label, and url are required.' });
  }
  if (!TOP_PLATFORMS.includes(platform as SocialPlatform)) {
    return res.status(400).json({ message: 'Invalid platform.' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ message: 'URL must start with http:// or https://.' });
  }

  try {
    const social = new Social({ platform, label, url, isActive, order });
    await social.save();
    res.status(201).json({ message: 'Social link created.', social });
  } catch (error) {
    logger.error('Error creating social link:', error);
    res.status(500).json({ message: 'Failed to create social link.' });
  }
};

export const updateSocial = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { platform, label, url, isActive, order } = req.body as Partial<ISocial>;

  if (platform && !TOP_PLATFORMS.includes(platform as SocialPlatform)) {
    return res.status(400).json({ message: 'Invalid platform.' });
  }
  if (url && !isValidUrl(url)) {
    return res.status(400).json({ message: 'URL must start with http:// or https://.' });
  }

  try {
    const updated = await Social.findByIdAndUpdate(
      id,
      { platform, label, url, isActive, order },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Social link not found.' });
    res.status(200).json({ message: 'Social link updated.', social: updated });
  } catch (error) {
    logger.error(`Error updating social link ${id}:`, error);
    res.status(500).json({ message: 'Failed to update social link.' });
  }
};

export const deleteSocial = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const deleted = await Social.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Social link not found.' });
    res.status(200).json({ message: 'Social link deleted.' });
  } catch (error) {
    logger.error(`Error deleting social link ${id}:`, error);
    res.status(500).json({ message: 'Failed to delete social link.' });
  }
};
