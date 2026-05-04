import { Router } from 'express'
import { shopController } from '../controllers/shopController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'

const router = Router()

router.use(authenticate)

router.get('/', requireRoles(['Admin']), shopController.getSettings)
router.put('/', requireRoles(['Admin']), shopController.updateSettings)

export default router
