-- DropForeignKey
ALTER TABLE `blocked_telegram_customers` DROP FOREIGN KEY `blocked_telegram_customers_shop_id_fkey`;

-- DropIndex
DROP INDEX `blocked_telegram_customers_shop_id_telegram_user_id_blocked__idx` ON `blocked_telegram_customers`;

-- AlterTable
ALTER TABLE `blocked_telegram_customers` ADD COLUMN `telegram_username` VARCHAR(191) NULL,
    MODIFY `blocked_until` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `blocked_telegram_customers_shop_id_telegram_user_id_idx` ON `blocked_telegram_customers`(`shop_id`, `telegram_user_id`);

-- AddForeignKey
ALTER TABLE `blocked_telegram_customers` ADD CONSTRAINT `blocked_telegram_customers_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
