-- AlterTable
ALTER TABLE `products` ADD COLUMN `price_mode` ENUM('fixed', 'by_size') NOT NULL DEFAULT 'fixed';
