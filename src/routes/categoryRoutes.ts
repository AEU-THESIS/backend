import { Router } from 'express'
import { categoryController } from '../controllers/categoryController'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

router.get('/', authenticate, categoryController.getAll)

export default router
