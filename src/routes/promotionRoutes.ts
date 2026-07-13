import { Router } from 'express'
import { promotionController } from '../controllers/promotionController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// Promotions are a back-office concern: Admin (Head Staff) and Manager only.
router.use(authenticate)
router.use(requireRoles([ROLES.ADMIN, ROLES.MANAGER]))

router.get('/', promotionController.getAll)
router.get('/:id', promotionController.getOne)
router.post('/', promotionController.create)
router.put('/:id', promotionController.update)
router.delete('/:id', promotionController.remove)

export default router
