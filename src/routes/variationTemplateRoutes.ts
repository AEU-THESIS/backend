import { Router } from 'express'
import { variationTemplateController } from '../controllers/variationTemplateController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

router.get(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  variationTemplateController.getAll
)
router.post(
  '/',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  variationTemplateController.create
)
router.get(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  variationTemplateController.getById
)
router.put(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  variationTemplateController.update
)
router.delete(
  '/:id',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  variationTemplateController.delete
)
router.post(
  '/:id/applications',
  authenticate,
  requireRoles([ROLES.ADMIN, ROLES.MANAGER]),
  variationTemplateController.apply
)

export default router
