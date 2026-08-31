import {
  Request,
  Response,
  catchAsync,
  sendSuccess,
  HttpStatus,
  Messages,
} from '../core/Controller'
import { idParamSchema } from '../validations/commonValidation'
import {
  adjustInventoryItemSchema,
  createInventoryItemSchema,
  inventoryExpenseReportExportQuerySchema,
  inventoryExpenseReportQuerySchema,
  inventoryHistoryExportQuerySchema,
  inventoryHistoryQuerySchema,
  inventoryQuerySchema,
  updateInventoryItemSchema,
} from '../validations/inventoryValidation'
import { inventoryService } from '../services/inventoryService'
import { inventoryExportService } from '../services/inventoryExportService'
import type { ExportedWorkbook } from '../services/inventoryExportService'
import { processImage } from '../utils/fileUpload'

const getUploadedImageUrl = async (req: Request) => {
  if (!req.file) return undefined
  return processImage(req.file.buffer)
}

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Streams a generated workbook back as a file attachment. */
const sendWorkbook = (res: Response, workbook: ExportedWorkbook) => {
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE)
  res.setHeader('Content-Disposition', `attachment; filename="${workbook.fileName}"`)
  // The filename is the payload's identity, so let the browser read it back.
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
  res.setHeader('Content-Length', workbook.buffer.length)
  return res.status(HttpStatus.OK).send(workbook.buffer)
}

export const inventoryController = {
  getAll: catchAsync(async (req: Request, res: Response) => {
    const query = inventoryQuerySchema.parse(req.query)
    const result = await inventoryService.getAll(req.user!.shop_id, query)
    return sendSuccess(res, result)
  }),

  getValuation: catchAsync(async (req: Request, res: Response) => {
    const valuation = await inventoryService.getValuation(req.user!.shop_id)
    return sendSuccess(res, valuation)
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const body = createInventoryItemSchema.parse(req.body)
    const imageUrl = await getUploadedImageUrl(req)
    const item = await inventoryService.create(req.user!.shop_id, req.user!.user_id, body, imageUrl)
    return sendSuccess(res, item, Messages.CREATED, HttpStatus.CREATED)
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const body = updateInventoryItemSchema.parse(req.body)
    const imageUrl = await getUploadedImageUrl(req)
    const item = await inventoryService.update(id, req.user!.shop_id, body, imageUrl)
    return sendSuccess(res, item)
  }),

  delete: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    await inventoryService.delete(id, req.user!.shop_id)
    return sendSuccess(res, null)
  }),

  adjust: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const body = adjustInventoryItemSchema.parse(req.body)
    const item = await inventoryService.adjust(id, req.user!.shop_id, req.user!.user_id, body)
    return sendSuccess(res, item)
  }),

  getHistory: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const query = inventoryHistoryQuerySchema.parse(req.query)
    const history = await inventoryService.getHistory(id, req.user!.shop_id, query)
    return sendSuccess(res, history)
  }),

  getExpenseReport: catchAsync(async (req: Request, res: Response) => {
    const query = inventoryExpenseReportQuerySchema.parse(req.query)
    const report = await inventoryService.getExpenseReport(req.user!.shop_id, query)
    return sendSuccess(res, report)
  }),

  /** Streams the Expense Report workbook for the selected range as .xlsx bytes. */
  exportExpenseReport: catchAsync(async (req: Request, res: Response) => {
    const query = inventoryExpenseReportExportQuerySchema.parse(req.query)
    const workbook = await inventoryExportService.getExpenseReportWorkbook(req.user!.shop_id, query)
    return sendWorkbook(res, workbook)
  }),

  /** Streams one item's Stock History workbook for the selected range as .xlsx bytes. */
  exportHistory: catchAsync(async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params)
    const query = inventoryHistoryExportQuerySchema.parse(req.query)
    const workbook = await inventoryExportService.getHistoryWorkbook(id, req.user!.shop_id, query)
    return sendWorkbook(res, workbook)
  }),
}
