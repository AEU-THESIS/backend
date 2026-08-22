import { Router } from 'express'
import { categoryController } from '../controllers/categoryController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

router.get(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  categoryController.getAll
)

router.post(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  categoryController.create
)

router.put(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  categoryController.update
)

router.delete(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  categoryController.remove
)
export default router
