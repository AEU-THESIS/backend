/*
  Warnings:

  - You are about to drop the column `product_id` on the `option_sets` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `option_sets` table. All the data in the column will be lost.
  - Made the column `price` on table `products` required. This step will fail if there are existing NULL values in that column.

*/

-- AlterTable
ALTER TABLE `products` ADD COLUMN `type` ENUM('drink', 'food') NOT NULL DEFAULT 'drink';
