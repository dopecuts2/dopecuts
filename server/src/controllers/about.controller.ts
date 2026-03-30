import { Request, Response } from 'express';
import { About } from '../models/about.model';
import { Barber } from '../models/barber.model';
import { uploadImage, deleteImage } from '../services/imageService';
import { logger } from '../utils/logger';

const ensureAboutDoc = async () => {
  let doc = await About.findOne();
  if (!doc) {
    doc = new About({
      heroTitle: 'About DopeCuts',
      heroSubtitle: 'Experience the art of grooming.',
      storyTitle: 'Our Story',
      storyBody:
        'What started as a neighborhood shop has become the city’s most trusted destination for premium grooming.',
      mission: 'To craft confidence through exceptional grooming.',
      values: [
        'Excellence in every cut',
        'Respect for traditional craftsmanship',
        'Innovation in modern techniques',
        'Building lasting relationships',
      ],
    });
    await doc.save();
  }
  return doc;
};

export const getAbout = async (_req: Request, res: Response) => {
  try {
    const about = await ensureAboutDoc();
    const barbers = await Barber.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.status(200).json({ about, barbers });
  } catch (error) {
    logger.error('Error fetching about page:', error);
    res.status(500).json({ message: 'Failed to fetch about page.' });
  }
};

export const updateAbout = async (req: Request, res: Response) => {
  const { heroTitle, heroSubtitle, storyTitle, storyBody, mission, values } = req.body;
  try {
    const about = await ensureAboutDoc();
    about.heroTitle = heroTitle ?? about.heroTitle;
    about.heroSubtitle = heroSubtitle ?? about.heroSubtitle;
    about.storyTitle = storyTitle ?? about.storyTitle;
    about.storyBody = storyBody ?? about.storyBody;
    about.mission = mission ?? about.mission;
    if (Array.isArray(values)) {
      about.values = values;
    }
    await about.save();
    res.status(200).json({ message: 'About updated.', about });
  } catch (error) {
    logger.error('Error updating about page:', error);
    res.status(500).json({ message: 'Failed to update about page.' });
  }
};

export const createBarber = async (req: Request, res: Response) => {
  const { name, role, experience, order = 0, isActive = true } = req.body;
  if (!name || !role) {
    return res.status(400).json({ message: 'Name and role are required.' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required.' });
  }
  try {
    const imageUrl = await uploadImage(req.file, 'dopecuts/barbers');
    const barber = new Barber({
      name,
      role,
      experience,
      order,
      isActive,
      image: imageUrl,
    });
    await barber.save();
    res.status(201).json({ message: 'Barber created.', barber });
  } catch (error) {
    logger.error('Error creating barber:', error);
    res.status(500).json({ message: 'Failed to create barber.' });
  }
};

export const updateBarber = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, role, experience, order, isActive } = req.body;
  try {
    const barber = await Barber.findById(id);
    if (!barber) return res.status(404).json({ message: 'Barber not found.' });

    if (name) barber.name = name;
    if (role) barber.role = role;
    if (experience !== undefined) barber.experience = experience;
    if (order !== undefined) barber.order = order;
    if (isActive !== undefined) barber.isActive = isActive;

    if (req.file) {
      await deleteImage(barber.image);
      barber.image = await uploadImage(req.file, 'dopecuts/barbers');
    }

    await barber.save();
    res.status(200).json({ message: 'Barber updated.', barber });
  } catch (error) {
    logger.error(`Error updating barber ${id}:`, error);
    res.status(500).json({ message: 'Failed to update barber.' });
  }
};

export const deleteBarber = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const barber = await Barber.findById(id);
    if (!barber) return res.status(404).json({ message: 'Barber not found.' });
    await deleteImage(barber.image);
    await Barber.findByIdAndDelete(id);
    res.status(200).json({ message: 'Barber deleted.' });
  } catch (error) {
    logger.error(`Error deleting barber ${id}:`, error);
    res.status(500).json({ message: 'Failed to delete barber.' });
  }
};
