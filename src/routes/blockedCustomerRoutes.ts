import { Router } from 'express'
import { blockedCustomerController } from '../controllers/blockedCustomerController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

/**
 * Admin/Manager block-list management (keeps spam pre-orders out). Mounted at
 * /api/blocked-customers. Cashiers cannot block — blocking is a trusted action.
 */
const router = Router()

router.post(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  blockedCustomerController.create
)

router.get(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  blockedCustomerController.list
)

router.delete(
  '/:telegramUserId',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  blockedCustomerController.remove
)

export default router
