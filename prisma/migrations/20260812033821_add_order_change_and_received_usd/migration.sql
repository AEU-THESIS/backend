-- AlterTable
ALTER TABLE `orders` ADD COLUMN `change_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `received_amount_usd` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
