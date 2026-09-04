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

  // ── Customer profile (language preference + remembered contact details) ──────
  // These are global per Telegram user (not shop-scoped): the language is how the
  // bot talks to the person, and their name/phone are the same across shops.

  /** Supported Mini App / bot languages, matching the frontend i18n locale codes. */
  SUPPORTED_LANGUAGES: ['en', 'kh'] as const,

  /** Normalizes any input to a supported language code, defaulting to English. */
  normalizeLanguage(input?: string | null): 'en' | 'kh' {
    return input === 'kh' ? 'kh' : 'en'
  },

  /**
   * The language the bot should use for this Telegram user. Falls back to English
   * for a user who has never set a preference (or on any lookup error).
   */
  async getLanguage(telegramUserId: string): Promise<'en' | 'kh'> {
    if (!telegramUserId) return 'en'
    const row = await prisma.telegramCustomer.findUnique({
      where: { telegramUserId },
      select: { languageCode: true },
    })
    return this.normalizeLanguage(row?.languageCode)
  },

  /**
   * Persists the user's language choice (from the bot `/language` command or the
   * Mini App toggle). Upserts so a first-time user is created on the spot.
   */
  async setLanguage(
    telegramUserId: string,
    language: string,
    telegramUsername?: string | null
  ): Promise<'en' | 'kh'> {
    const languageCode = this.normalizeLanguage(language)
    await prisma.telegramCustomer.upsert({
      where: { telegramUserId },
      create: {
        telegramUserId,
        languageCode,
        telegramUsername: telegramUsername ?? null,
      },
      update: {
        languageCode,
        // Only refresh the username when a real value is supplied; a null/undefined
        // must never wipe a previously stored username (parity with name/phone).
        ...(telegramUsername != null ? { telegramUsername } : {}),
      },
    })
    return languageCode
  },

  /** The remembered profile for pre-filling checkout (name, phone, language). */
  async getProfile(telegramUserId: string) {
    if (!telegramUserId) return null
    const row = await prisma.telegramCustomer.findUnique({
      where: { telegramUserId },
      select: { lastCustomerName: true, lastCustomerPhone: true, languageCode: true },
    })
    if (!row) return { name: null, phone: null, language: 'en' as const }
    return {
      name: row.lastCustomerName,
      phone: row.lastCustomerPhone,
      language: this.normalizeLanguage(row.languageCode),
    }
  },

  /**
   * Remembers the contact details a guest used on an order so the next checkout can
   * pre-fill them. Never overrides an existing language preference. Best-effort:
   * callers invoke this fire-and-forget after the order is safely persisted.
   */
  async rememberContact(
    telegramUserId: string,
    details: { name?: string | null; phone?: string | null; telegramUsername?: string | null }
  ): Promise<void> {
    if (!telegramUserId) return
    const name = details.name?.trim() || null
    const phone = details.phone?.trim() || null
    await prisma.telegramCustomer.upsert({
      where: { telegramUserId },
      create: {
        telegramUserId,
        lastCustomerName: name,
        lastCustomerPhone: phone,
        telegramUsername: details.telegramUsername ?? null,
      },
      update: {
        // Only overwrite when a value was actually provided, so a blank field on a
        // later order doesn't wipe previously remembered details.
        ...(name !== null ? { lastCustomerName: name } : {}),
        ...(phone !== null ? { lastCustomerPhone: phone } : {}),
        // Same guard as name/phone — never overwrite a stored username with null.
        ...(details.telegramUsername != null ? { telegramUsername: details.telegramUsername } : {}),
      },
    })
  },
}
