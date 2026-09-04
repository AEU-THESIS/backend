export const USD_SYMBOL = '$'
export const KHR_SYMBOL = '៛'
/** Older shop rows stored the ISO code where the symbol belongs. */
export const LEGACY_KHR_CODE = 'KHR'

export const DEFAULT_EXCHANGE_RATE = 4100

/** A shop row can hold the legacy code or nothing at all; both normalise here. */
export const normalizeCurrencySymbol = (symbol?: string | null) => {
  if (symbol === LEGACY_KHR_CODE) return KHR_SYMBOL
  return symbol || USD_SYMBOL
}
