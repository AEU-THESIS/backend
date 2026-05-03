import { Router } from 'express'
import { shopController } from '../controllers/shopController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'

const router = Router()

router.use(authenticate)
router.use(requireRoles(['Admin']))

router.get('/settings', shopController.getSettings)
router.put('/settings', shopController.updateSettings)

export default router
