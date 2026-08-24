-- Fix `ingredients.cost_currency`.
--
-- The column was introduced with a blanket `DEFAULT '$'`, so every pre-existing
-- ingredient was labelled in dollars regardless of its shop. New items already
-- derive the symbol from `shops.currency_symbol`, so a shop configured in riel
-- would show a dollar sign against a riel cost.
--
-- Done as a forward migration rather than by editing the original: that one has
-- already been applied, and rewriting it would break the migration checksum for
-- every environment that ran it.

-- Backfill each ingredient's currency from its owning shop.
UPDATE `ingredients` `i`
    JOIN `shops` `s` ON `s`.`id` = `i`.`shop_id`
    SET `i`.`cost_currency` = `s`.`currency_symbol`;

-- The currency is always derived from the owning shop, never assumed.
ALTER TABLE `ingredients` ALTER COLUMN `cost_currency` DROP DEFAULT;
