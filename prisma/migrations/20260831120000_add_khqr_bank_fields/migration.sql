-- Manual KHQR payment (AT-112): record which bank a customer paid via for a KHQR
-- order, and let each shop configure the list of banks shown in the POS selector.

-- AlterTable: bank used for a manual KHQR (bank transfer) payment; null for cash.
ALTER TABLE `orders` ADD COLUMN `bank_name` VARCHAR(191) NULL;

-- AlterTable: per-shop configurable list of KHQR banks (JSON array of strings).
ALTER TABLE `shops` ADD COLUMN `payment_banks` JSON NULL;
