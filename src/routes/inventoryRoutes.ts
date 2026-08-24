import { Router } from 'express'
import { inventoryController } from '../controllers/inventoryController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'
import { upload } from '../utils/fileUpload'

const router = Router()

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

router.use(authenticate)
router.use(requireRoles([ROLES.ADMIN, ROLES.MANAGER]))

router.get('/', inventoryController.getAll)
router.get('/valuations', inventoryController.getValuation)
router.get('/expense-report', inventoryController.getExpenseReport)
router.post('/', upload.single('image'), inventoryController.create)
router.put('/:id', upload.single('image'), inventoryController.update)
router.delete('/:id', inventoryController.delete)
router.post('/:id/adjustments', inventoryController.adjust)
router.get('/:id/history', inventoryController.getHistory)

export default router
