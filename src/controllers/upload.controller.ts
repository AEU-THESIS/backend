import { Request, Response } from 'express'
import { processImage, deleteImage } from '../utils/fileUpload'
import { catchAsync, sendSuccess, AppError, HttpStatus } from '../core/Controller'
import { removeImageSchema } from '../validations/uploadValidation'

export const uploadImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError('No image file provided.', HttpStatus.BAD_REQUEST)
  }

  // Process the image using sharp
  const imageUrl = await processImage(req.file.buffer)

  sendSuccess(res, { url: imageUrl }, 'Image uploaded successfully')
})

export const removeImage = catchAsync(async (req: Request, res: Response) => {
  const { imageUrl } = removeImageSchema.parse(req.body)

  deleteImage(imageUrl)

  sendSuccess(res, null, 'Image deleted successfully')
})
