// dopecut/dopecuts-server-main/src/routes/contact.routes.ts
import { Router } from 'express';
import {
    createContact,
    getAllContacts,
    getContactById,
    updateContact,
    deleteContact,
    lookupContactByPhone,
} from '../controllers/contact.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

// ---- Public lookup (no auth) ----
/**
 * @route   GET api/v1/contacts/lookup/phone/:phone
 * @desc    Lookup a contact by phone for autofill
 * @access  Public
 */
router.get('/lookup/phone/:phone', lookupContactByPhone);

// ---- Admin-protected routes ----

/**
 * @route   POST api/v1/contacts
 * @desc    Create a new contact
 * @access  Private (Admin only)
 */
router.post('/', isAdmin, createContact);

/**
 * @route   GET api/v1/contacts
 * @desc    Get all contacts
 * @access  Private (Admin only)
 */
router.get('/', isAdmin, getAllContacts);

/**
 * @route   GET api/v1/contacts/:id
 * @desc    Get a single contact by its ID
 * @access  Private (Admin only)
 */
router.get('/:id', isAdmin, getContactById);

/**
 * @route   PUT api/v1/contacts/:id
 * @desc    Update a contact by its ID
 * @access  Private (Admin only)
 */
router.put('/:id', isAdmin, updateContact);

/**
 * @route   DELETE api/v1/contacts/:id
 * @desc    Delete a contact by its ID
 * @access  Private (Admin only)
 */
router.delete('/:id', isAdmin, deleteContact);

export default router;