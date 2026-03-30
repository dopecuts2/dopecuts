// dopecut/dopecuts-server-main/src/routes/contact.routes.ts
import { Router } from 'express';
import {
  submitContact,
  adminListTickets,
  adminGetTicket,
  adminRespondToTicket,
  adminCloseTicket,
} from '../controllers/contactticket.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

/**
 * Public
 * POST /contact
 */
router.post('/', submitContact);

/**
 * Admin
 * GET    /admin/contact           -> list
 * GET    /admin/contact/:id       -> get by id
 * POST   /admin/contact/:id/respond -> respond to ticket (sends email + record)
 * PATCH  /admin/contact/:id/close -> close ticket (optional email)
 */
router.get('/', isAdmin, adminListTickets);
router.get('/:id', isAdmin, adminGetTicket);
router.post('/:id/respond', isAdmin, adminRespondToTicket);
router.patch('/:id/close', isAdmin, adminCloseTicket);

export default router;