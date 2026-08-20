-- AlterTable
ALTER TABLE `ingredients` ADD COLUMN `category_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `ingredients_category_id_idx` ON `ingredients`(`category_id`);

-- AddForeignKey
ALTER TABLE `ingredients` ADD CONSTRAINT `ingredients_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
