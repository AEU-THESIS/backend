-- AlterTable
ALTER TABLE `ingredients` ADD COLUMN `cost_currency` VARCHAR(191) NOT NULL DEFAULT '$',
    ADD COLUMN `last_unit_cost` DECIMAL(12, 4) NOT NULL DEFAULT 0.0000;
