import multer from 'express' // just to satisfy typescript if needed
import { Request } from 'express'
import multerLib from 'multer'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'

// Ensure upload directory exists (always anchored to process root / volume mount)
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public/uploads')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Configure multer to store files in memory
const storage = multerLib.memoryStorage()

// File filter to accept only images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multerLib.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else {
    cb(new Error('Not an image! Please upload an image.'))
  }
}

export const upload = multerLib({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

export const processImage = async (buffer: Buffer): Promise<string> => {
  const filename = `${uuidv4()}.webp`
  const filepath = path.join(UPLOAD_DIR, filename)

  await sharp(buffer)
    .resize(400, 400, {
      fit: sharp.fit.cover,
      position: sharp.strategy.entropy,
    })
    .webp({ quality: 80 })
    .toFile(filepath)

  return `/uploads/${filename}`
}

export const deleteImage = (imageUrl: string): void => {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return

  const filename = path.basename(imageUrl)
  const resolvedPath = path.resolve(UPLOAD_DIR, filename)

  // Security check: ensure the resolved path is strictly within the upload directory
  if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
    console.warn(`Blocked deletion attempt for path outside uploads: ${resolvedPath}`)
    return
  }

  if (fs.existsSync(resolvedPath)) {
    try {
      fs.unlinkSync(resolvedPath)
    } catch (err) {
      console.error(`Failed to delete image ${resolvedPath}:`, err)
    }
  }
}
