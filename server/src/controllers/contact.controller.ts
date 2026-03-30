// dopecut/dopecuts-server-main/src/controllers/contact.controller.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Contact } from '../models/contact.model';
import { Booking } from '../models/booking.model';
import { normalizePhoneDigits } from '../utils/phone';
import { logger } from '../utils/logger';

/**
 * @description Create a new contact.
 * @route POST /api/v1/contacts
 * @access Private (Admin only)
 */
export const createContact = async (req: Request, res: Response) => {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
        return res.status(400).json({ message: 'Name, email, and phone are required fields.' });
    }

    try {
        // Check for existing contact with the same email or phone
        const existingContact = await Contact.findOne({ $or: [{ email }, { phone }] });
        if (existingContact) {
            return res.status(409).json({ message: 'A contact with this email or phone number already exists.' });
        }

        const newContact = new Contact({ name, email, phone });
        const savedContact = await newContact.save();

        res.status(201).json(savedContact);
    } catch (error) {
        logger.error('Error creating contact:', error);
        if (error instanceof mongoose.Error.ValidationError) {
             return res.status(400).json({ message: 'Validation failed', errors: error.errors });
        }
        res.status(500).json({ message: 'Failed to create contact.' });
    }
};

/**
 * @description Get all contacts.
 * @route GET /api/v1/contacts
 * @access Private (Admin only)
 */
export const getAllContacts = async (_req: Request, res: Response) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.status(200).json(contacts);
    } catch (error) {
        logger.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Failed to fetch contacts.' });
    }
};

/**
 * @description Get a single contact by ID.
 * @route GET /api/v1/contacts/:id
 * @access Private (Admin only)
 */
export const getContactById = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid contact ID format.' });
    }

    try {
        const contact = await Contact.findById(id);
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found.' });
        }
        res.status(200).json(contact);
    } catch (error) {
        logger.error(`Error fetching contact ${id}:`, error);
        res.status(500).json({ message: 'Failed to fetch contact.' });
    }
};

/**
 * @description Update a contact by ID.
 * @route PUT /api/v1/contacts/:id
 * @access Private (Admin only)
 */
export const updateContact = async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid contact ID format.' });
    }
    
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'Request body cannot be empty for an update.' });
    }

    try {
        const updatedContact = await Contact.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!updatedContact) {
            return res.status(404).json({ message: 'Contact not found.' });
        }
        res.status(200).json(updatedContact);
    } catch (error: any) {
        logger.error(`Error updating contact ${id}:`, error);
        // Handle potential duplicate key errors on update
        if (error.code === 11000) {
            return res.status(409).json({ message: 'A contact with this email or phone number already exists.' });
        }
        res.status(500).json({ message: 'Failed to update contact.' });
    }
};

/**
 * @description Delete a contact by ID.
 * @route DELETE /api/v1/contacts/:id
 * @access Private (Admin only)
 */
export const deleteContact = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid contact ID format.' });
    }

    try {
        const deletedContact = await Contact.findByIdAndDelete(id);
        if (!deletedContact) {
            return res.status(404).json({ message: 'Contact not found.' });
        }
        res.status(200).json({ message: 'Contact deleted successfully.' });
    } catch (error) {
        logger.error(`Error deleting contact ${id}:`, error);
        res.status(500).json({ message: 'Failed to delete contact.' });
    }
};

/**
 * @description PUBLIC: Lookup contact by phone. Returns name (and split first/last), email, phone.
 * @route GET /api/v1/contacts/lookup/phone/:phone
 * @access Public
 */
export const lookupContactByPhone = async (req: Request, res: Response) => {
  const phoneParam = (req.params.phone || '').trim();
  if (!phoneParam) {
    return res.status(400).json({ message: 'Phone parameter is required.' });
  }

  try {
    const contact = await Contact.findOne({ phone: phoneParam });
    if (!contact) {
      return res.status(404).json({ message: 'No contact found for this phone.' });
    }

    const cancellationCount = await Booking.countDocuments({
      phoneNormalized: normalizePhoneDigits(contact.phone),
      status: 'cancelled',
    });

    // Split name into first/last best-effort for easier client autofill
    const [firstName, ...rest] = (contact.name || '').trim().split(/\s+/);
    const lastName = rest.join(' ');

    return res.status(200).json({
      name: contact.name,
      firstName: firstName || '',
      lastName: lastName || '',
      email: contact.email,
      phone: contact.phone,
      cancellationCount,
    });
  } catch (error) {
    logger.error('Error looking up contact by phone:', error);
    return res.status(500).json({ message: 'Failed to lookup contact.' });
  }
};
