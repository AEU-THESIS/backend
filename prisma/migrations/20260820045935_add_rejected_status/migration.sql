-- AlterTable
ALTER TABLE `orders` MODIFY `fulfillment_status` ENUM('pending', 'preparing', 'ready', 'completed', 'canceled', 'rejected') NOT NULL;
