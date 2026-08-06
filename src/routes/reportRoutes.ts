import { Router } from 'express'
import { reportController } from '../controllers/reportController'
import { authenticate } from '../middlewares/authMiddleware'
import { requireRoles } from '../middlewares/roleMiddleware'
import { ROLES } from '../constants/roles'

const router = Router()

// All reporting endpoints require authentication.
router.use(authenticate)
const reportingRoles = requireRoles([ROLES.ADMIN, ROLES.MANAGER])

router.get('/kpi-summary', reportingRoles, reportController.getKpiSummary)
router.get('/sales-overview', reportingRoles, reportController.getOverview)
router.get('/sales-trend', reportingRoles, reportController.getSalesTrend)
router.get('/selling-items', reportingRoles, reportController.getSellingItems)
router.get('/item-performance', reportingRoles, reportController.getItemPerformance)
router.get('/category-performance', reportingRoles, reportController.getCategoryPerformance)
router.get('/inventory-insights', reportingRoles, reportController.getInventoryInsights)
router.get('/exports', reportingRoles, reportController.exportCSV)

// Daily summary is additionally available to Cashiers.
router.get(
  '/daily-summary',
  requireRoles([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]),
  reportController.getReportToday
)

export default router
