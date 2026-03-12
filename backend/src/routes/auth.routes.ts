import { Router } from 'express';
import { register, login, getMe, recoverPassword, resetPassword, requestAccess } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/recover-password', recoverPassword);
router.post('/reset-password', resetPassword);
router.post('/access-request', requestAccess);

export default router;
