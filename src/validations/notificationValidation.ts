import { z } from 'zod'

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Notification ID must be a positive integer'),
})

export const getNotificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  read: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform(v => {
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    })
    .optional(),
  type: z.string().optional(),
})

export const bulkDeleteNotificationSchema = z.object({
  ids: z
    .array(z.coerce.number().int().positive())
    .min(1, 'At least one notification ID must be provided'),
})

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>
export type GetNotificationQuery = z.infer<typeof getNotificationQuerySchema>
export type BulkDeleteNotificationInput = z.infer<typeof bulkDeleteNotificationSchema>
