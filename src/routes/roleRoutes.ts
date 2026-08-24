import { Router } from 'express'
import { roleController } from '../controllers/roleController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'

const router = Router()

router.use(authenticate)

router.get('/', requireRoles(['Admin', 'Manager']), roleController.getAll)

export default router
