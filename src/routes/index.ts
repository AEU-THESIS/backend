import { Router } from 'express'
import authRoutes from './authRoutes'
import shopRoutes from './shopRoutes'
import userRoutes from './userRoutes'
import uploadRoutes from './uploadRoutes'
import roleRoutes from './roleRoutes'

const router = Router()

// Combine all domain routes here
router.use('/auth', authRoutes)
router.use('/shops', shopRoutes)
router.use('/users', userRoutes)
router.use('/roles', roleRoutes)
router.use('/uploads', uploadRoutes)

export default router
