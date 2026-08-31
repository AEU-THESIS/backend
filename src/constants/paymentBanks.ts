// Fallback bank list served to the POS KHQR bank selector when a shop has not
// configured its own `paymentBanks` (Shop.paymentBanks is null or empty). ABA is the
// most common Cambodian café acquirer, so it is the sensible pre-selected default.
export const DEFAULT_PAYMENT_BANKS = ['ABA'] as const
