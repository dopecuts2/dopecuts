import { Router } from 'express';
import {
  createBooking,
  getAllBookings,
  getBookingByPhone,
  getBookingByEmail,
  updateBooking,
  cancelBooking,
  confirmPayment,
  startPhoneOtp,
  verifyPhoneOtp,
  startEmailOtp,
  verifyEmailOtp,
  startManageLookup,
  verifyManageLookup,
  getManageBooking,
  joinBookingQueue,
  sendBookingMessage,
  clearAllBookingsAndQueue,
} from '../controllers/booking.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

// PUBLIC ROUTES
router.post('/', createBooking);
router.post('/queue', joinBookingQueue);
router.get('/phone/:phone', getBookingByPhone);
router.get('/email/:email', getBookingByEmail);

// Phone OTP for reschedule/cancel verification
router.post('/phone-otp/start', startPhoneOtp);
router.post('/phone-otp/verify', verifyPhoneOtp);

// Email OTP for reschedule/cancel verification
router.post('/email-otp/start', startEmailOtp);
router.post('/email-otp/verify', verifyEmailOtp);

// Reference-number-based manage lookup (reference + email or phone, code
// always sent to the booking's own email)
router.post('/manage-lookup/start', startManageLookup);
router.post('/manage-lookup/verify', verifyManageLookup);

// Token-based manage lookup (Bearer token or manageToken in body/query)
router.get('/manage', getManageBooking);

// User self-service manage (token in Authorization header or legacy email/phone+otp in body)
router.put('/manage/:id', updateBooking);
router.patch('/manage/:id/cancel', cancelBooking);

// ADMIN ROUTES
router.get('/', isAdmin, getAllBookings);
router.delete('/admin/clear-all', isAdmin, clearAllBookingsAndQueue);
router.patch('/:id/confirm-payment', isAdmin, confirmPayment);
router.put('/:id', isAdmin, updateBooking);
router.patch('/:id/cancel', isAdmin, cancelBooking);
router.post('/:id/message', isAdmin, sendBookingMessage);

export default router;
