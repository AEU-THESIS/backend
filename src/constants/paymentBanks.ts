// Fallback bank list served to the POS KHQR bank selector when a shop has not
// configured its own `paymentBanks` (Shop.paymentBanks is null or empty). ABA is the
// most common Cambodian café acquirer, so it is the sensible pre-selected default.
export const DEFAULT_PAYMENT_BANKS = ['ABA'] as const

// The `payment_banks` column is JSON and may be null (never configured) or an empty
// array (admin removed them all). Normalise to a clean list of non-empty, trimmed
// strings and fall back to the default (ABA) whenever nothing usable is stored, so the
// POS bank selector — and the order-creation allowlist — always have at least one bank.
export function normalizePaymentBanks(rawPaymentBanks: unknown): string[] {
  const list = Array.isArray(rawPaymentBanks)
    ? rawPaymentBanks
        .filter((bank): bank is string => typeof bank === 'string' && bank.trim().length > 0)
        .map(bank => bank.trim())
    : []
  return list.length > 0 ? list : [...DEFAULT_PAYMENT_BANKS]
}
