import { Router } from 'express'
import { orderController } from '../controllers/orderController'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

router.post('/', authenticate, orderController.create)

export default router
