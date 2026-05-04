import { Request, Response } from 'express'
import { processImage, deleteImage } from '../utils/fileUpload'

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided.',
      })
    }

    // Process the image using sharp
    const imageUrl = await processImage(req.file.buffer)

    return res.status(200).json({
      success: true,
      data: {
        url: imageUrl,
      },
      message: 'Image uploaded successfully',
    })
  } catch (error: any) {
    console.error('[Upload Error]', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image.',
      error: error.message,
    })
  }
}

export const removeImage = async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'No image URL provided.',
      })
    }

    deleteImage(imageUrl)

    return res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    })
  } catch (error: any) {
    console.error('[Delete Error]', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete image.',
      error: error.message,
    })
  }
}
