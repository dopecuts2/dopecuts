import { Router } from 'express';
import { generateApiKey, revokeApiKey, getApiKeyStatus } from '../controllers/apiKey.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();

// ADMIN ROUTES — manage the single revocable key that gates /external
router.get('/', isAdmin, getApiKeyStatus);
router.post('/generate', isAdmin, generateApiKey);
router.post('/revoke', isAdmin, revokeApiKey);

export default router;
