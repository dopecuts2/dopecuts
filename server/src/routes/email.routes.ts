// dopecuts-server/src/routes/email.routes.ts
import { Router } from 'express';
import { sendCustomEmail } from '../controllers/email.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

/**
 * @route   POST api/v1/email/send-custom
 * @desc    Send a custom email to a customer
 * @access  Private (Admin only)
 */
router.post('/send-custom', isAdmin, sendCustomEmail);

export default router;