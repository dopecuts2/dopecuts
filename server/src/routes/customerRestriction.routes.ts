import { Router } from 'express';
import {
  getCustomerRestrictions,
  upsertCustomerRestriction,
  deleteCustomerRestriction,
  checkPhoneRestriction,
} from '../controllers/customerRestriction.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

// PUBLIC ROUTE
router.get('/check/:phone', checkPhoneRestriction);

// ADMIN ROUTES
router.get('/', isAdmin, getCustomerRestrictions);
router.post('/', isAdmin, upsertCustomerRestriction);
router.delete('/:id', isAdmin, deleteCustomerRestriction);

export default router;
