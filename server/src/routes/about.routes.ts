import { Router } from 'express';
import { getAbout, updateAbout, createBarber, updateBarber, deleteBarber } from '../controllers/about.controller';
import { isAdmin } from '../middleware/isAdmin';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/', getAbout);
router.put('/', isAdmin, updateAbout);
router.post('/barbers', isAdmin, upload.single('image'), createBarber);
router.put('/barbers/:id', isAdmin, upload.single('image'), updateBarber);
router.delete('/barbers/:id', isAdmin, deleteBarber);

export default router;
