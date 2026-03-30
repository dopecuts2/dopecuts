import { Router } from 'express';
import { sendMessageCampaign } from '../controllers/message.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

router.post('/send', isAdmin, sendMessageCampaign);

export default router;
