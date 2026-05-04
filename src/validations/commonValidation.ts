import { z } from 'zod'

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a numeric string').transform(Number),
})

export type IdParamInput = z.infer<typeof idParamSchema>
