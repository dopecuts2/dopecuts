// dopecut/dopecuts-server-main/src/routes/notificationSettings.routes.ts
import { Router } from 'express';
import { getSettings, updateSettings, getSiteNotice, getProductNotice, getCalendarWeeks } from '../controllers/notificationSettings.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

router.get('/settings', isAdmin, getSettings);
router.put('/settings', isAdmin, updateSettings);
router.get('/notice', getSiteNotice);
router.get('/product-notice', getProductNotice);
router.get('/calendar-weeks', getCalendarWeeks);

export default router;
