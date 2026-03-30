// dopecuts-server/src/routes/product.routes.ts
import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';
import { isAdmin } from '../middleware/isAdmin';
import { upload } from '../middleware/upload';

const router = Router();

// --- PUBLIC ROUTES ---
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// --- ADMIN-ONLY ROUTES ---
// The `upload.single('image')` middleware handles a single file upload from a form field named 'image'
router.post('/', isAdmin, upload.single('image'), createProduct);
router.put('/:id', isAdmin, upload.single('image'), updateProduct);
router.delete('/:id', isAdmin, deleteProduct);

export default router;