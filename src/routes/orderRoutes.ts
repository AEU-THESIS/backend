import { Router } from 'express'
import { orderController } from '../controllers/orderController'
import { orderSseController } from '../controllers/orderSseController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// 1. SSE Stream subscription (Must go before /:id to avoid matching parameter id = 'stream')
router.get(
  '/stream',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderSseController.subscribe
)

// 2. Place a new order
router.post(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderController.create
)

// 3. Fetch orders (supports search, date filters, and status filters)
router.get(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderController.getAll
)

// 4. Fetch single order details
router.get(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderController.getById
)

// 5. Update order fulfillment status
router.put(
  '/:id/status',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderController.updateStatus
)

// 6. Void a whole order (reverses the money: refund + un-redeem promotions)
router.post(
  '/:id/void',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderController.void
)

// 7. Cancel a single line item (recalculates the order + partial refund)
router.post(
  '/:id/items/:itemId/cancel',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderController.cancelItem
)

// 8. Reject a pending customer pre-order from the Pre-Orders board (unpaid → rejected)
router.put(
  '/:id/reject',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  orderController.rejectPreOrder
)

export default router
