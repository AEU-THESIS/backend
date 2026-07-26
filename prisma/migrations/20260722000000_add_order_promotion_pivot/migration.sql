-- CreateTable
CREATE TABLE `order_promotion` (
    `order_id` INTEGER NOT NULL,
    `promotion_id` INTEGER NOT NULL,
    `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,

    INDEX `order_promotion_promotion_id_idx`(`promotion_id`),
    PRIMARY KEY (`order_id`, `promotion_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order_promotion` ADD CONSTRAINT `order_promotion_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_promotion` ADD CONSTRAINT `order_promotion_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
