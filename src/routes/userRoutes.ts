import { Router } from 'express'
import { userController } from '../controllers/userController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// Protect all user routes
router.use(authenticate)

// Admin only can view, create, update, and delete staff
router.get('/', requireRoles([ROLES.ADMIN]), userController.getStaff)
router.post('/', requireRoles([ROLES.ADMIN]), userController.createStaff)
router.put('/:id', requireRoles([ROLES.ADMIN]), userController.updateStaff)
router.delete('/:id', requireRoles([ROLES.ADMIN]), userController.deleteStaff)

export default router
