import { Router } from 'express'
import { authController } from '../controllers/authController'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

router.post('/login', authController.login)
router.post('/logout', authenticate, authController.logout)

export default router
