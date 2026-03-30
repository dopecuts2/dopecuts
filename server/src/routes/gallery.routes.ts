// src/routes/gallery.routes.ts
import { Router } from 'express';
import {
  createGalleryItem,
  getAllGalleryItems,
  getGalleryItemById,
  updateGalleryItem,
  deleteGalleryItem,
} from '../controllers/gallery.controller';
import { isAdmin } from '../middleware/isAdmin';
import { upload } from '../middleware/upload';

const router = Router();

// --- PUBLIC ROUTES ---
router.get('/', getAllGalleryItems);
router.get('/:id', getGalleryItemById);

// --- ADMIN-ONLY ROUTES ---
// The `upload.single('image')` middleware handles a single file upload
router.post('/', isAdmin, upload.single('image'), createGalleryItem);
router.put('/:id', isAdmin, upload.single('image'), updateGalleryItem);
router.delete('/:id', isAdmin, deleteGalleryItem);

export default router;