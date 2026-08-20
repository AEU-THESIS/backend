-- AlterTable
ALTER TABLE `ingredient_logs` ADD COLUMN `unit_cost` DECIMAL(12, 4) NULL;

-- AlterTable
ALTER TABLE `ingredients` ADD COLUMN `unit_cost` DECIMAL(12, 4) NOT NULL DEFAULT 0.0000;
