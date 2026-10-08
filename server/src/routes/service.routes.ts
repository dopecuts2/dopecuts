// dopekuts-server/src/routes/service.routes.ts
import { Router } from 'express';
import {
    createService,
    getAllServices,
    getAllServicesForAdmin,
    getServiceById,
    updateService,
    deleteService
} from '../controllers/service.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

// --- ADMIN-ONLY ROUTES ---
// Only an admin can create, update, or delete services, or see hidden ones.
router.get('/admin/all', isAdmin, getAllServicesForAdmin);
router.post('/', isAdmin, createService);
router.put('/:id', isAdmin, updateService);
router.delete('/:id', isAdmin, deleteService);

// --- PUBLIC ROUTES ---
// Anyone should be able to see the list of (visible) services to book one.
router.get('/', getAllServices);
router.get('/:id', getServiceById);

export default router;