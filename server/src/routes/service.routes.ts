// dopekuts-server/src/routes/service.routes.ts
import { Router } from 'express';
import {     
    createService,     
    getAllServices,     
    getServiceById,     
    updateService,     
    deleteService 
} from '../controllers/service.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

// --- PUBLIC ROUTES ---
// Anyone should be able to see the list of services to book one.
router.get('/', getAllServices);
router.get('/:id', getServiceById);

// --- ADMIN-ONLY ROUTES ---
// Only an admin can create, update, or delete services.
router.post('/', isAdmin, createService);
router.put('/:id', isAdmin, updateService);
router.delete('/:id', isAdmin, deleteService);

export default router;