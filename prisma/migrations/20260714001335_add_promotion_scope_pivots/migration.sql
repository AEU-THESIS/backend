-- AlterTable
ALTER TABLE `promotions` ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `scope` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    MODIFY `discount_value` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- CreateTable
CREATE TABLE `promotion_category` (
    `promotion_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,

    INDEX `promotion_category_category_id_idx`(`category_id`),
    PRIMARY KEY (`promotion_id`, `category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promotion_product` (
    `promotion_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,

    INDEX `promotion_product_product_id_idx`(`product_id`),
    PRIMARY KEY (`promotion_id`, `product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `promotions_shop_id_idx` ON `promotions`(`shop_id`);

-- AddForeignKey
ALTER TABLE `promotion_category` ADD CONSTRAINT `promotion_category_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promotion_category` ADD CONSTRAINT `promotion_category_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promotion_product` ADD CONSTRAINT `promotion_product_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promotion_product` ADD CONSTRAINT `promotion_product_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
