import { Router } from 'express';
import { createBooking } from '../controllers/booking.controller';
import { requireApiKey } from '../middleware/requireApiKey';

const router = Router();

// Lets an authorized external AI app create a booking with the same
// payload shape (and the same validation/notifications) as the public
// booking form, gated by the revocable key from Admin Settings instead
// of being open to the public.
router.post('/bookings', requireApiKey, createBooking);

export default router;
