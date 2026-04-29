import cron from 'node-cron'
import { prisma } from '../core/Service'

/**
 * Deletes tokens from the BlacklistedToken table that have already expired.
 */
export const deleteExpiredBlacklistedTokens = async () => {
  try {
    const now = new Date()
    const result = await prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    })

    if (result.count > 0) {
      console.log(
        `[CLEANUP] Deleted ${result.count} expired blacklisted tokens at ${now.toISOString()}`
      )
    }
  } catch (error) {
    console.error('[CLEANUP] Error deleting expired tokens:', error)
  }
}

/**
 * Initializes the cleanup job to run on a schedule.
 * Default: Every day at midnight (0 0 * * *)
 */
export const initTokenCleanupJob = () => {
  // Schedule: Minute Hour DayOfMonth Month DayOfWeek
  cron.schedule('0 0 * * *', async () => {
    await deleteExpiredBlacklistedTokens()
  })

  console.log('[JOBS] Token cleanup job initialized (Daily at Midnight)')
}
