import express from 'express'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import routes from './routes'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger.config'
import { errorHandler } from './middlewares/errorHandler'
import { redactSensitiveFields } from './utils/sanitizer'

const app = express()

/**
 * -----------------------------
 * Security middlewares
 * -----------------------------
 */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)

/**
 * -----------------------------
 * Dynamic CORS depending on Environment
 * -----------------------------
 */
const allowList =
  process.env.NODE_ENV === 'production'
    ? ['https://routincafe.com'] // Strict Production Domains
    : ['http://localhost:5173', 'http://localhost:3000'] // Local / Staging React Vite ports

app.use(
  cors({
    origin: (origin, callback) => {
      // If no origin (e.g. Server-to-Server, mobile app) or explicitly allowed
      if (!origin || allowList.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Blocked by CORS Policy'))
      }
    },
  })
)

/**
 * -----------------------------
 * Global API Rate Limiting (DOS Protection)
 * -----------------------------
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000 /* 15 minutes */,
  max: 100 /* Limit each IP to 100 requests per 15 mins */,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
})
app.use('/api', limiter)

/**
 * -----------------------------
 * Body parsing
 * -----------------------------
 */
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')))

/**
 * -----------------------------
 * Request Debugging (Local Only)
 * -----------------------------
 */
if (process.env.ENABLE_REQUEST_DEBUG === 'true') {
  app.use((req, _res, next) => {
    console.log(`\n[DEBUG] ${new Date().toLocaleTimeString()} | ${req.method} ${req.originalUrl}`)
    if (req.body && Object.keys(req.body).length) {
      const sanitizedBody = redactSensitiveFields(req.body)
      console.log('📦 Body:', JSON.stringify(sanitizedBody, null, 2))
    }
    if (req.query && Object.keys(req.query).length) {
      const sanitizedQuery = redactSensitiveFields(req.query)
      console.log('🔍 Query:', sanitizedQuery)
    }
    next()
  })
}

/**
 * -----------------------------
 * Routes
 * -----------------------------
 */
app.use('/api', routes)

/**
 * -----------------------------
 * Health check
 * -----------------------------
 */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

/**
 * -----------------------------
 * Swagger UI - NEVER expose in production
 * -----------------------------
 */
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
}

/**
 * -----------------------------
 * Global Error Handler
 * -----------------------------
 */
app.use(errorHandler)

export default app
