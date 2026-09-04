import { Router } from 'express'
import { notificationController } from '../controllers/notificationController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// All notification endpoints are scoped to authenticated staff
router.use(authenticate, requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]))

router.get('/', notificationController.getAll)
router.get('/unread-count', notificationController.getUnreadCount)
router.patch('/read-all', notificationController.markAllAsRead)
router.patch('/:id/read', notificationController.markAsRead)
router.delete('/clear-all', notificationController.clearAll)
router.post('/bulk-delete', notificationController.deleteSelected)
router.delete('/:id', notificationController.delete)

export default router
