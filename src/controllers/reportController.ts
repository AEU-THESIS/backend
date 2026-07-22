import { Request, Response, catchAsync, sendSuccess } from '../core/Controller'
import { reportService } from '../services/reportService'
import { ReportPeriodSchema, DailySummaryQuerySchema } from '../validations/reportValidation'

export const reportController = {
  getOverview: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { period } = ReportPeriodSchema.parse(req.query)

    const overview = await reportService.getSalesOverview(shopId, period)
    return sendSuccess(res, overview)
  }),

  getItemPerformance: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { period } = ReportPeriodSchema.parse(req.query)

    const performance = await reportService.getItemPerformance(shopId, period)
    return sendSuccess(res, performance)
  }),

  getCategoryPerformance: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { period } = ReportPeriodSchema.parse(req.query)

    const performance = await reportService.getCategoryPerformance(shopId, period)
    return sendSuccess(res, performance)
  }),

  getInventoryInsights: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const insights = await reportService.getInventoryInsights(shopId)
    return sendSuccess(res, insights)
  }),

  exportCSV: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { type, period } = ReportPeriodSchema.parse(req.query)

    const csvContent = await reportService.getCSVExportData(shopId, type, period)

    const filename = `report_${type}_${period}_${new Date().toISOString().slice(0, 10)}.csv`

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(csvContent)
  }),
  getReportToday: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { date } = DailySummaryQuerySchema.parse(req.query)

    const summary = await reportService.getDailySummary(shopId, date)
    return sendSuccess(res, summary)
  }),
}
