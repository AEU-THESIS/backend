import { Router } from 'express'
import { authController } from '../controllers/authController'
import { authenticate } from '../middlewares/authMiddleware'
import { loginLimiter, passwordResetLimiter } from '../middlewares/rateLimiterMiddleware'

const router = Router()

router.post('/sessions', loginLimiter, authController.login)
router.delete('/sessions', authenticate, authController.logout)

// Live record of the signed-in user, so the client can refresh a changed role
// or deactivation without re-login (AT-74).
router.get('/me', authenticate, authController.me)

// Public routes — no authentication required
router.post('/password-resets', passwordResetLimiter, authController.forgotPassword)
router.put('/password-resets/:token', passwordResetLimiter, authController.resetPassword)

export default router
