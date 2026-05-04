import { z } from 'zod'

export const createUserSchema = z.object({
  shopId: z.number().int().positive('Shop ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const createStaffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  roleId: z.number().int().positive('Role ID is required'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export type CreateStaffInput = z.infer<typeof createStaffSchema>

export const updateStaffSchema = createStaffSchema.partial().extend({
  roleId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>

export const getStaffQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number).pipe(z.number().positive()),
  limit: z.string().optional().default('10').transform(Number).pipe(z.number().positive()),
  search: z.string().optional(),
})

export type GetStaffQueryInput = z.infer<typeof getStaffQuerySchema>
