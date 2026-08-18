import { Router } from 'express';
import { googleLogin, demoLogin } from '../controllers/authController.js';

const router = Router();

router.post('/google', googleLogin);
router.post('/demo', demoLogin);

export default router;
