import { Router } from 'express';
import { isAdmin } from '../middleware/isAdmin';
import {
  createSocial,
  deleteSocial,
  getActiveSocials,
  getAllSocials,
  updateSocial,
} from '../controllers/social.controller';

const router = Router();

// Public: active socials
router.get('/', getActiveSocials);

// Admin: full CRUD
router.get('/all', isAdmin, getAllSocials);
router.post('/', isAdmin, createSocial);
router.put('/:id', isAdmin, updateSocial);
router.delete('/:id', isAdmin, deleteSocial);

export default router;
