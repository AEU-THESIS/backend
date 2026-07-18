import { Router } from 'express'
import { reportController } from '../controllers/reportController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// Protect all reporting endpoints under authentication and restrict to Admin privilege only
router.use(authenticate)
router.use(requireRoles([ROLES.ADMIN]))

router.get('/kpi-summary', reportController.getKpiSummary)
router.get('/sales-overview', reportController.getOverview)
router.get('/sales-trend', reportController.getSalesTrend)
router.get('/selling-items', reportController.getSellingItems)
router.get('/item-performance', reportController.getItemPerformance)
router.get('/category-performance', reportController.getCategoryPerformance)
router.get('/inventory-insights', reportController.getInventoryInsights)
router.get('/exports', reportController.exportCSV)

export default router
