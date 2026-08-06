import { Router } from 'express'
import { uploadImage, removeImage } from '../controllers/upload.controller'
import { upload } from '../utils/fileUpload'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { uploadLimiter } from '../middlewares/rateLimiterMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// Image upload/delete are restricted to Admin and Manager.
// A Cashier has no upload UI but could otherwise call these endpoints directly.
router.post(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  uploadLimiter,
  upload.single('image'),
  uploadImage
)

router.delete(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  uploadLimiter,
  removeImage
)

export default router
