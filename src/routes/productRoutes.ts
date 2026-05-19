import { Router } from 'express'
import { productController } from '../controllers/productController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

router.get(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  productController.getAll
)

export default router
