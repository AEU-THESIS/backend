import { Router } from 'express'
import { uploadImage, removeImage } from '../controllers/upload.controller'
import { upload } from '../utils/fileUpload'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

// Endpoint for uploading an image
// We require authentication to upload images
router.post('/', authenticate, upload.single('image'), uploadImage)
router.delete('/', authenticate, removeImage)

export default router
