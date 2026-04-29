import 'dotenv/config'
import app from './app'
import { prisma } from './core/Service'
import { initTokenCleanupJob } from './jobs/deleteExpiredTokens'

const PORT = process.env.PORT || 3000
const ENV = process.env.NODE_ENV || 'development'

const startServer = async () => {
  try {
    // 1. Verify Database connection before booting
    await prisma.$connect()

    // 2. Initialize Background Jobs
    initTokenCleanupJob()

    // 3. Start Express server
    app.listen(PORT, () => {
      console.log(`\n===============================================`)
      console.log(`           🚀 SERVER IS LIVE 🚀`)
      console.log(`===============================================`)
      console.log(`» Environment  : ${ENV.toUpperCase()}`)
      console.log(`» Database     : CONNECTED ✅`)
      console.log(`» Port         : ${PORT}`)
      console.log(`» Health Check : http://localhost:${PORT}/health`)

      if (ENV !== 'production') {
        console.log(`» Swagger UI   : http://localhost:${PORT}/api-docs`)
      }
      console.log(`===============================================\n`)
    })
  } catch (error) {
    console.error('❌ Failed to start server. Database connection error:')
    console.error(error)
    process.exit(1)
  }
}

startServer()
