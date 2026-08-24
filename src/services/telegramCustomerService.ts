import { prisma } from '../core/Service'

/**
 * Block-list for abusive Telegram guests, used to keep spam pre-orders out of the
 * system. A block can be permanent (blockedUntil = null) or until a specific
 * date/time (self-lifts once past). Blocking is an Admin/Manager action performed
 * in the system — never from the Telegram group (taps can't be role-verified).
 */
export const telegramCustomerService = {
  /** True if this Telegram user is currently blocked from ordering at this shop. */
  async isBlocked(shopId: number, telegramUserId: string): Promise<boolean> {
    const row = await prisma.blockedTelegramCustomer.findUnique({
      where: { shopId_telegramUserId: { shopId, telegramUserId } },
      select: { blockedUntil: true },
    })
    if (!row) return false
    // null = forever; otherwise blocked only while the date is still in the future.
    return row.blockedUntil === null || row.blockedUntil.getTime() > Date.now()
  },

  /**
   * Blocks (or re-blocks) a Telegram user. `blockedUntil` null = forever; a Date =
   * until then. Upserts so re-blocking updates the window/reason.
   */
  async block(
    shopId: number,
    telegramUserId: string,
    opts: { blockedUntil?: Date | null; reason?: string | null; telegramUsername?: string | null }
  ): Promise<void> {
    const blockedUntil = opts.blockedUntil ?? null
    await prisma.blockedTelegramCustomer.upsert({
      where: { shopId_telegramUserId: { shopId, telegramUserId } },
      create: {
        shopId,
        telegramUserId,
        telegramUsername: opts.telegramUsername ?? null,
        blockedUntil,
        reason: opts.reason ?? null,
      },
      update: {
        blockedUntil,
        reason: opts.reason ?? null,
        ...(opts.telegramUsername !== undefined
          ? { telegramUsername: opts.telegramUsername ?? null }
          : {}),
      },
    })
  },

  /** All block entries for a shop (for the management screen). */
  async list(shopId: number) {
    return prisma.blockedTelegramCustomer.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        telegramUserId: true,
        telegramUsername: true,
        blockedUntil: true,
        reason: true,
        createdAt: true,
      },
    })
  },

  /** Lifts a block. */
  async unblock(shopId: number, telegramUserId: string): Promise<void> {
    await prisma.blockedTelegramCustomer.deleteMany({ where: { shopId, telegramUserId } })
  },
}
