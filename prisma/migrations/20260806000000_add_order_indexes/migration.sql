-- CreateIndex
CREATE INDEX `orders_shop_id_created_at_idx` ON `orders`(`shop_id`, `created_at`);

-- CreateIndex
CREATE INDEX `orders_shop_id_payment_status_created_at_idx` ON `orders`(`shop_id`, `payment_status`, `created_at`);

-- CreateIndex
CREATE INDEX `orders_shop_id_fulfillment_status_idx` ON `orders`(`shop_id`, `fulfillment_status`);

-- CreateIndex
CREATE INDEX `transactions_order_id_idx` ON `transactions`(`order_id`);
