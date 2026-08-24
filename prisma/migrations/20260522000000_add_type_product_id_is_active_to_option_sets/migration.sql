-- AlterTable
ALTER TABLE `option_sets` ADD COLUMN `type` ENUM('size', 'custom') NOT NULL DEFAULT 'custom';

