import { Router } from 'express'
import { notificationController } from '../controllers/notificationController'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

// All notification endpoints are scoped to authenticated staff
router.use(authenticate)

router.get('/', notificationController.getAll)
router.get('/unread-count', notificationController.getUnreadCount)
router.patch('/read-all', notificationController.markAllAsRead)
router.patch('/:id/read', notificationController.markAsRead)
router.delete('/clear-all', notificationController.clearAll)
router.post('/bulk-delete', notificationController.deleteSelected)
router.delete('/:id', notificationController.delete)

export default router
