import { Router } from 'express';
import { requestOtp, verifyOtpAndLogin } from '../controllers/auth.controller';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtpAndLogin);

export default router;