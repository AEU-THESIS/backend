-- Adds the `categories.type` column. It is defined in schema.prisma
-- (enum CategoryType: product | inventory) but was never captured in a migration,
-- so databases built from committed migrations via `prisma migrate deploy` lacked
-- it, causing P2022 on category/menu reads. `IF NOT EXISTS` keeps this safe on any
-- environment where the column was already patched in by hand.
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `type` ENUM('product', 'inventory') NOT NULL DEFAULT 'product';
