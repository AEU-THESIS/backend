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

router.post('/', authenticate, requireRoles([ROLES.ADMIN, ROLES.MANAGER]), productController.create)

router.get(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  productController.getById
)

router.put(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  productController.update
)

router.delete(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  productController.remove
)

export default router
