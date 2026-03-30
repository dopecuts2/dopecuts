// src/controllers/service.controller.ts
import { Request, Response } from 'express';
import { Service } from '../models/service.model';
import { logger } from '../utils/logger';

/**
 * @description Create a new service.
 * @route POST /api/v1/services
 * @access Private (Admin only)
 */
export const createService = async (req: Request, res: Response) => {
  const { name, duration, price, description } = req.body;

  if (!name || duration === undefined || price === undefined) {
    return res.status(400).json({ message: 'Name, duration, and price are required.' });
  }

  try {
    const existingService = await Service.findOne({ name });
    if (existingService) {
      return res.status(409).json({ message: 'A service with this name already exists.' });
    }

    const newService = new Service({ name, duration, price, description });
    await newService.save();
    
    res.status(201).json({ message: 'Service created successfully.', service: newService });
  } catch (error) {
    logger.error('Error creating service:', error);
    res.status(500).json({ message: 'Failed to create service.' });
  }
};

/**
 * @description Get all services.
 * @route GET /api/v1/services
 * @access Private (Admin only)
 */
export const getAllServices = async (req: Request, res: Response) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.status(200).json(services);
  } catch (error) {
    logger.error('Error fetching services:', error);
    res.status(500).json({ message: 'Failed to fetch services.' });
  }
};

/**
 * @description Get a single service by its ID.
 * @route GET /api/v1/services/:id
 * @access Private (Admin only)
 */
export const getServiceById = async (req: Request, res: Response) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    res.status(200).json(service);
  } catch (error) {
    logger.error(`Error fetching service with id ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch service.' });
  }
};

/**
 * @description Update an existing service.
 * @route PUT /api/v1/services/:id
 * @access Private (Admin only)
 */
export const updateService = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, duration, price, description } = req.body;

  if (!name && duration === undefined && price === undefined && description === undefined) {
    return res.status(400).json({ message: 'At least one field (name, duration, price, description) must be provided for update.' });
  }

  try {
    const updatedService = await Service.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updatedService) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    res.status(200).json({ message: 'Service updated successfully.', service: updatedService });
  } catch (error) {
    logger.error(`Error updating service ${id}:`, error);
    res.status(500).json({ message: 'Failed to update service.' });
  }
};

/**
 * @description Delete a service.
 * @route DELETE /api/v1/services/:id
 * @access Private (Admin only)
 */
export const deleteService = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deletedService = await Service.findByIdAndDelete(id);
    if (!deletedService) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    res.status(200).json({ message: 'Service deleted successfully.' });
  } catch (error) {
    logger.error(`Error deleting service ${id}:`, error);
    res.status(500).json({ message: 'Failed to delete service.' });
  }
};