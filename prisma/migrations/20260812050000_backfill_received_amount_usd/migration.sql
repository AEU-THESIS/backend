-- Backfill `received_amount_usd` for orders created before the column existed
-- (it defaulted to 0.00). This keeps currency-agnostic reporting correct for
-- historical sales.
--   * KHR orders: convert the received riel to USD using the order's own snapshot rate.
--   * USD orders: the received amount already is USD.
-- `change_amount` is intentionally left at its default for legacy rows: the old
-- flow never captured the change given, and reconstructing it under the new
-- rounding rules would invent data rather than record what actually happened.
UPDATE `orders`
SET `received_amount_usd` = CASE
    WHEN `payment_currency` = 'KHR' AND `exchange_rate_snapshot` > 0
      THEN ROUND(`received_amount` / `exchange_rate_snapshot`, 2)
    ELSE `received_amount`
  END
WHERE `received_amount_usd` = 0.00
  AND `received_amount` <> 0.00;
