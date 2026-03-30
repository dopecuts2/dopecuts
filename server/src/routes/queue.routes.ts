import { Router } from 'express';
import {
  adminListQueue,
  adminUpdateQueueStatus,
  adminConvertQueueEntry,
  adminGetQueueSettings,
  adminUpdateQueueSettings,
} from '../controllers/queue.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

router.get('/settings', isAdmin, adminGetQueueSettings);
router.put('/settings', isAdmin, adminUpdateQueueSettings);
router.get('/', isAdmin, adminListQueue);
router.patch('/:id/status', isAdmin, adminUpdateQueueStatus);
router.post('/:id/convert', isAdmin, adminConvertQueueEntry);

export default router;
