-- DropForeignKey
ALTER TABLE `option_set_elements` DROP FOREIGN KEY `option_set_elements_option_set_id_fkey`;

-- DropForeignKey
ALTER TABLE `product_option_sets` DROP FOREIGN KEY `product_option_sets_option_set_id_fkey`;

-- DropForeignKey
ALTER TABLE `product_option_sets` DROP FOREIGN KEY `product_option_sets_product_id_fkey`;

-- DropIndex
DROP INDEX `option_set_elements_option_set_id_fkey` ON `option_set_elements`;

-- DropIndex
DROP INDEX `product_option_sets_option_set_id_fkey` ON `product_option_sets`;

-- DropIndex
DROP INDEX `product_option_sets_product_id_fkey` ON `product_option_sets`;

-- AlterTable
ALTER TABLE `option_sets` ALTER COLUMN `type` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `option_set_elements` ADD CONSTRAINT `option_set_elements_option_set_id_fkey` FOREIGN KEY (`option_set_id`) REFERENCES `option_sets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_option_sets` ADD CONSTRAINT `product_option_sets_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_option_sets` ADD CONSTRAINT `product_option_sets_option_set_id_fkey` FOREIGN KEY (`option_set_id`) REFERENCES `option_sets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
