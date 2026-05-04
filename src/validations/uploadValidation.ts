import { z } from 'zod'

export const removeImageSchema = z.object({
  imageUrl: z.string().min(1, 'Image URL is required').url('Invalid image URL'),
})

export type RemoveImageInput = z.infer<typeof removeImageSchema>
