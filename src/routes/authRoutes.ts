import { Router } from 'express'
import { authController } from '../controllers/authController'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

router.post('/sessions', authController.login)
router.delete('/sessions', authenticate, authController.logout)

// Public routes — no authentication required
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)

export default router
