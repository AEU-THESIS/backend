import { Router } from 'express'
import authRoutes from './authRoutes'
import shopRoutes from './shopRoutes'
import userRoutes from './userRoutes'
import uploadRoutes from './uploadRoutes'
import roleRoutes from './roleRoutes'
import inventoryRoutes from './inventoryRoutes'

const router = Router()

// Combine all domain routes here
router.use('/auth', authRoutes)
router.use('/shops', shopRoutes)
router.use('/users', userRoutes)
router.use('/roles', roleRoutes)
router.use('/uploads', uploadRoutes)
router.use('/inventory', inventoryRoutes)

export default router
