-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `comp_reason` VARCHAR(191) NULL,
    ADD COLUMN `is_complimentary` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `orders` MODIFY `payment_status` ENUM('paid', 'unpaid', 'refunded', 'partially_refunded', 'comp') NOT NULL;
