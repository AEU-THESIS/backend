-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `canceled_at` DATETIME(3) NULL,
    ADD COLUMN `canceled_quantity` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `void_reason` TEXT NULL,
    ADD COLUMN `voided_at` DATETIME(3) NULL,
    ADD COLUMN `voided_by_user_id` INTEGER NULL,
    MODIFY `payment_status` ENUM('paid', 'unpaid', 'refunded', 'partially_refunded') NOT NULL,
    MODIFY `fulfillment_status` ENUM('preparing', 'ready', 'completed', 'canceled') NOT NULL;

-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `user_id` INTEGER NULL,
    MODIFY `status` ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_voided_by_user_id_fkey` FOREIGN KEY (`voided_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
