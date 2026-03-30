// dopecuts-server/src/routes/index.ts
import { Router } from 'express';
import authRouter from './auth.routes';
import bookingRouter from './booking.routes';
import calendarRouter from './calendar.routes';
import emailRouter from './email.routes';
import messageRouter from './message.routes';
import contactRouter from './contact.routes'; // <-- Import the new contact router
import serviceRouter from './service.routes';
import productRouter from './product.routes';
import notificationSettingsRouter from './notificationSettings.routes';
import ContactTicket from './contactTicket.routes'; // <-- Import the contact ticket router
import galleryRouter from './gallery.routes';
import socialRouter from './social.routes';
import aboutRouter from './about.routes';
import queueRouter from './queue.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/bookings', bookingRouter);
router.use('/calendar', calendarRouter);
router.use('/email', emailRouter);
router.use('/messages', messageRouter);
router.use('/contacts', contactRouter); // <-- Add the contact routes
router.use('/services', serviceRouter); // <-- Add the service routes
router.use('/products', productRouter); // <-- Add the product routes
router.use('/notifications', notificationSettingsRouter); // <-- Add notification settings routes
router.use('/contact-tickets', ContactTicket);
router.use('/gallery', galleryRouter);
router.use('/socials', socialRouter);
router.use('/about', aboutRouter);
router.use('/queue', queueRouter);

export default router;
