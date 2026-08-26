import { Request, Response, catchAsync, sendSuccess } from '../core/Controller'
import { HttpStatus } from '../constants/httpStatus'
import { reportService } from '../services/reportService'
import {
  ReportPeriodSchema,
  ItemPerformanceSchema,
  KpiSummarySchema,
  SalesTrendSchema,
  DailySummaryQuerySchema,
  SalesSummaryExportSchema,
} from '../validations/reportValidation'

export const reportController = {
  getKpiSummary: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { range, startDate, endDate } = KpiSummarySchema.parse(req.query)

    const summary = await reportService.getKpiSummary(shopId, range, startDate, endDate)
    return sendSuccess(res, summary)
  }),

  getSellingItems: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { type, period, month, startDate, endDate } = ItemPerformanceSchema.parse(req.query)

    const items = await reportService.getSellingItems(
      shopId,
      type,
      period,
      month,
      startDate,
      endDate
    )
    return sendSuccess(res, items)
  }),

  getOverview: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { period } = ReportPeriodSchema.parse(req.query)

    const overview = await reportService.getSalesOverview(shopId, period)
    return sendSuccess(res, overview)
  }),

  getSalesTrend: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { granularity, startDate, endDate } = SalesTrendSchema.parse(req.query)

    const trend = await reportService.getSalesTrend(shopId, granularity, startDate, endDate)
    return sendSuccess(res, trend)
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
  /**
   * Streams the Sales Summary ("Menu Performance") workbook for a date range.
   * Answers 204 when the window has no sales, so the client can say so instead
   * of downloading an empty sheet.
   */
  exportSalesSummary: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { startDate, endDate } = SalesSummaryExportSchema.parse(req.query)

    const workbook = await reportService.getSalesSummaryExport(shopId, startDate, endDate)

    if (!workbook) {
      return res.status(HttpStatus.NO_CONTENT).end()
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${workbook.fileName}"`)
    // The filename is the payload's identity, so let the browser read it back.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
    res.setHeader('Content-Length', workbook.buffer.length)
    return res.status(HttpStatus.OK).send(workbook.buffer)
  }),

  getReportToday: catchAsync(async (req: Request, res: Response) => {
    const shopId = req.user!.shop_id
    const { date, endDate } = DailySummaryQuerySchema.parse(req.query)

    const summary = await reportService.getDailySummary(shopId, date, endDate)
    return sendSuccess(res, summary)
  }),
}
