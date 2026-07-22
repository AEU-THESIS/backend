import { Router } from 'express'
import { promotionController } from '../controllers/promotionController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

router.use(authenticate)

// Cashiers need active promotions to apply discounts at the POS, so this route is
// open to all authenticated staff. It must be declared before the /:id route and
// the Admin/Manager guard below.
router.get(
  '/active',
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  promotionController.getActive
)

// Everything else is a back-office concern: Admin (Head Staff) and Manager only.
router.use(requireRoles([ROLES.ADMIN, ROLES.MANAGER]))

router.get('/', promotionController.getAll)
router.get('/:id', promotionController.getOne)
router.post('/', promotionController.create)
router.put('/:id', promotionController.update)
router.delete('/:id', promotionController.remove)

export default router
