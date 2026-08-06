import { Router } from 'express'
import { shopController } from '../controllers/shopController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// Protect shop routes securely
router.use(authenticate)

router.get('/settings', requireRoles([ROLES.ADMIN]), shopController.getSettings)
router.put('/settings', requireRoles([ROLES.ADMIN]), shopController.updateSettings)

// Only Admins can create shops
router.post('/', requireRoles([ROLES.ADMIN]), shopController.create)
// Admin-only: returns just the caller's own shop (service scopes by shop_id).
router.get('/', requireRoles([ROLES.ADMIN]), shopController.getAll)

export default router
