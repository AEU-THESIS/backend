import { Router } from 'express'
import { shopController } from '../controllers/shopController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// Protect shop routes securely
router.use(authenticate)

// Any authenticated role may READ settings (currency, exchange rate, order-management
// flag are needed app-wide). Editing stays Admin-only.
router.get(
  '/settings',
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  shopController.getSettings
)
router.put('/settings', requireRoles([ROLES.ADMIN]), shopController.updateSettings)

// Only Admins can create shops
router.post('/', requireRoles([ROLES.ADMIN]), shopController.create)
router.get('/', shopController.getAll)

export default router
