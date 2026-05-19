import { Router } from 'express'
import authRoutes from './authRoutes'
import shopRoutes from './shopRoutes'
import userRoutes from './userRoutes'
import uploadRoutes from './uploadRoutes'
import roleRoutes from './roleRoutes'
import categoryRoutes from './categoryRoutes'
import productRoutes from './productRoutes'
import orderRoutes from './orderRoutes'
import reportRoutes from './reportRoutes'

const router = Router()

// Combine all domain routes here
router.use('/auth', authRoutes)
router.use('/shops', shopRoutes)
router.use('/users', userRoutes)
router.use('/roles', roleRoutes)
router.use('/uploads', uploadRoutes)
router.use('/categories', categoryRoutes)
router.use('/products', productRoutes)
router.use('/orders', orderRoutes)
router.use('/reports', reportRoutes)

export default router
