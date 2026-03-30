// src/controllers/gallery.controller.ts
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { GalleryItem } from '../models/gallery.model';
import { Service } from '../models/service.model';
import { uploadImage, deleteImage } from '../services/imageService';
import { logger } from '../utils/logger';

/**
 * @description Create a new gallery item. Admin only.
 * @route POST /api/v1/gallery
 */
export const createGalleryItem = async (req: Request, res: Response) => {
  const { serviceId } = req.body;
  if (!serviceId) {
    return res.status(400).json({ message: 'Service is required.' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required.' });
  }

  try {
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(400).json({ message: 'Invalid service selected.' });
    }

    const imageUrl = await uploadImage(req.file, 'dopecuts/gallery');
    const serviceObjectId = new Types.ObjectId(service._id as any);

    const newGalleryItem = new GalleryItem({
      category: service.name,
      image: imageUrl,
      serviceId: serviceObjectId,
      serviceName: service.name,
    });

    const savedGalleryItem = await newGalleryItem.save();
    res.status(201).json(savedGalleryItem);
  } catch (error) {
    logger.error('Error creating gallery item:', error);
    res.status(500).json({ message: 'Failed to create gallery item.' });
  }
};

/**
 * @description Get all gallery items. Public. Can filter by category.
 * @route GET /api/v1/gallery
 * @query ?category=Category%20Name
 */
export const getAllGalleryItems = async (req: Request, res: Response) => {
  const { category } = req.query;
  const query: any = {};

  if (category) {
    query.category = category as string;
  }

  try {
    const items = await GalleryItem.find(query).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    logger.error('Error fetching gallery items:', error);
    res.status(500).json({ message: 'Failed to fetch gallery items.' });
  }
};

/**
 * @description Get a single gallery item by ID. Public.
 * @route GET /api/v1/gallery/:id
 */
export const getGalleryItemById = async (req: Request, res: Response) => {
  try {
    const item = await GalleryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Gallery item not found.' });
    }
    res.status(200).json(item);
  } catch (error) {
    logger.error(`Error fetching gallery item with id ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch gallery item.' });
  }
};

/**
 * @description Update a gallery item (category or image). Admin only.
 * @route PUT /api/v1/gallery/:id
 */
export const updateGalleryItem = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { serviceId } = req.body;

  try {
    const item = await GalleryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Gallery item not found.' });
    }

    let serviceName = item.serviceName;
    let serviceObjectId = item.serviceId as Types.ObjectId;
    if (serviceId) {
      const svc = await Service.findById(serviceId);
      if (!svc) return res.status(400).json({ message: 'Invalid service selected.' });
      serviceName = svc.name;
      serviceObjectId = new Types.ObjectId(svc._id as any);
    }

    let imageUrl = item.image;
    if (req.file) {
      await deleteImage(item.image);
      imageUrl = await uploadImage(req.file, 'dopecuts/gallery');
    }

    const updatedGalleryItem = await GalleryItem.findByIdAndUpdate(
      id,
      {
        category: serviceName,
        image: imageUrl,
        serviceId: serviceObjectId,
        serviceName,
      },
      { new: true }
    );

    res.status(200).json(updatedGalleryItem);
  } catch (error) {
    logger.error(`Error updating gallery item with id ${id}:`, error);
    res.status(500).json({ message: 'Failed to update gallery item.' });
  }
};

/**
 * @description Delete a gallery item. Admin only.
 * @route DELETE /api/v1/gallery/:id
 */
export const deleteGalleryItem = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const item = await GalleryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Gallery item not found.' });
    }

    // Delete the image from R2
    await deleteImage(item.image);

    await GalleryItem.findByIdAndDelete(id);
    res.status(200).json({ message: 'Gallery item deleted successfully.' });
  } catch (error) {
    logger.error(`Error deleting gallery item with id ${id}:`, error);
    res.status(500).json({ message: 'Failed to delete gallery item.' });
  }
};
