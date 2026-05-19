import { Router } from 'express'
import { productController } from '../controllers/productController'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

router.get('/', authenticate, productController.getAll)

export default router
