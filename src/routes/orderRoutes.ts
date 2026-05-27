import { Router } from 'express'
import { orderController } from '../controllers/orderController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

router.post(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderController.create
)

export default router
