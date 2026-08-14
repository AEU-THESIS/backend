-- Soft delete for ingredients.
--
-- `ingredient_logs` is an immutable stock audit trail with a required FK to
-- `ingredients` and no cascade, so hard-deleting an item previously required
-- destroying its history first. Deleted items are now hidden from the catalogue
-- and their movement records stay queryable.

-- AlterTable
ALTER TABLE `ingredients` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `ingredients_shop_id_deleted_at_idx` ON `ingredients`(`shop_id`, `deleted_at`);
