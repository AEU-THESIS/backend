import { Router } from 'express'
import { authController } from '../controllers/authController'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

router.post('/sessions', authController.login)
router.delete('/sessions', authenticate, authController.logout)

export default router
