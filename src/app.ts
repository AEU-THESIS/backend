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
import { UPLOAD_DIR } from './utils/fileUpload'

const app = express()

/**
 * -----------------------------
 * Trust the reverse-proxy chain
 * -----------------------------
 * In staging/production the request path is: Cloudflare -> nginx -> this app.
 * Without `trust proxy`, Express reads the socket peer (the nginx container IP)
 * as `req.ip`, which is IDENTICAL for every user. Rate limiters keyed on
 * `req.ip` would then share a single bucket across the whole team, so one busy
 * user (or a few staff at once) blocks everyone.
 *
 * Setting the number of trusted hops makes Express resolve the REAL client IP
 * from `X-Forwarded-For`. Default 2 = [nginx, Cloudflare]; override with
 * TRUST_PROXY_HOPS if the deployment topology changes. Locally (no proxy /
 * no X-Forwarded-For) this safely falls back to the socket IP.
 */
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 2))

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
    ? ['https://staging.routinecafe.site'] // Strict Production Domains
    : ['http://localhost:5173', 'http://localhost:3000'] // Local / Staging React Vite ports

app.use(
  cors({
    origin: (origin, callback) => {
      // If no origin (e.g. Server-to-Server, mobile app) or explicitly allowed
      if (!origin || allowList.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    },
  })
)

/**
 * -----------------------------
 * Global API Rate Limiting (DoS protection)
 * -----------------------------
 * A safety net against scripted abuse — NOT a throttle on normal staff work.
 * Keyed on the real client IP (see `trust proxy` above).
 *
 * Defaults: 300 requests / 60s per IP. A single-page POS fires many requests
 * per screen, so the previous 100 / 15min was far too tight for interactive
 * use. The short 60s window also means anyone who does hit the cap is cleared
 * within a minute instead of being locked out for 15. Tune via env without a
 * redeploy: RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX.
 */
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  standardHeaders: true,
  legacyHeaders: false,
  // The realtime order stream is a long-lived SSE connection the browser
  // auto-reconnects; it must never burn the request budget.
  skip: req => req.originalUrl.startsWith('/api/orders/stream'),
  message: {
    success: false,
    message: 'Too many requests, please slow down and try again in a moment.',
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
app.use('/uploads', express.static(UPLOAD_DIR))

/**
 * -----------------------------
 * Request Debugging (Local Only)
 * -----------------------------
 */
if (process.env.ENABLE_REQUEST_DEBUG === 'true') {
  app.use((req, _res, next) => {
    console.log(`\n[DEBUG] ${new Date().toLocaleTimeString()} | ${req.method} ${req.path}`)
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
