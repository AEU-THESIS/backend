import { Router } from 'express'
import authRoutes from './authRoutes'
import shopRoutes from './shopRoutes'
import userRoutes from './userRoutes'
import uploadRoutes from './uploadRoutes'
import roleRoutes from './roleRoutes'
import inventoryRoutes from './inventoryRoutes'
import categoryRoutes from './categoryRoutes'
import productRoutes from './productRoutes'
import orderRoutes from './orderRoutes'
import reportRoutes from './reportRoutes'
import promotionRoutes from './promotionRoutes'
import variationTemplateRoutes from './variationTemplateRoutes'
import publicRoutes from './publicRoutes'
import blockedCustomerRoutes from './blockedCustomerRoutes'

const router = Router()

// Combine all domain routes here
router.use('/auth', authRoutes)
router.use('/shops', shopRoutes)
router.use('/users', userRoutes)
router.use('/roles', roleRoutes)
router.use('/uploads', uploadRoutes)
router.use('/inventories', inventoryRoutes)
router.use('/categories', categoryRoutes)
router.use('/products', productRoutes)
router.use('/orders', orderRoutes)
router.use('/reports', reportRoutes)
router.use('/promotions', promotionRoutes)
router.use('/variation-templates', variationTemplateRoutes)
// Public customer-facing routes (Telegram Mini App pre-orders + Telegram webhook).
router.use('/public', publicRoutes)
// Admin/Manager block-list management (anti-spam for pre-orders).
router.use('/blocked-customers', blockedCustomerRoutes)

export default router
