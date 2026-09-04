-- CreateTable
CREATE TABLE `telegram_customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `telegram_user_id` VARCHAR(191) NOT NULL,
    `telegram_username` VARCHAR(191) NULL,
    `language_code` VARCHAR(191) NOT NULL DEFAULT 'en',
    `last_customer_name` VARCHAR(191) NULL,
    `last_customer_phone` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `telegram_customers_telegram_user_id_key`(`telegram_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
