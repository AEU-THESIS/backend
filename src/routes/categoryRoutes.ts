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

export default router
