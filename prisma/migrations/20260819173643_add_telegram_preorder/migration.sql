-- AlterTable
ALTER TABLE `orders` ADD COLUMN `delivery_lat` DECIMAL(10, 7) NULL,
    ADD COLUMN `delivery_lng` DECIMAL(10, 7) NULL,
    ADD COLUMN `telegram_user_id` VARCHAR(191) NULL,
    ADD COLUMN `telegram_username` VARCHAR(191) NULL,
    MODIFY `fulfillment_status` ENUM('pending', 'preparing', 'ready', 'completed', 'canceled') NOT NULL;

-- CreateTable
CREATE TABLE `blocked_telegram_customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_id` INTEGER NOT NULL,
    `telegram_user_id` VARCHAR(191) NOT NULL,
    `blocked_until` DATETIME(3) NOT NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `blocked_telegram_customers_shop_id_telegram_user_id_blocked__idx`(`shop_id`, `telegram_user_id`, `blocked_until`),
    UNIQUE INDEX `blocked_telegram_customers_shop_id_telegram_user_id_key`(`shop_id`, `telegram_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `blocked_telegram_customers` ADD CONSTRAINT `blocked_telegram_customers_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
