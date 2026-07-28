CREATE TABLE `variation_group_templates` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `shop_id` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(191) NOT NULL,
  `created_by` INTEGER NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `variation_group_templates_shop_id_is_active_idx`(`shop_id`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `variation_group_template_options` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `template_id` INTEGER NOT NULL,
  `option_label` VARCHAR(191) NOT NULL,
  `price_modifier` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `variation_group_template_options_template_id_display_order_idx`(`template_id`, `display_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `variation_group_templates`
  ADD CONSTRAINT `variation_group_templates_shop_id_fkey`
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `variation_group_templates`
  ADD CONSTRAINT `variation_group_templates_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `variation_group_template_options`
  ADD CONSTRAINT `variation_group_template_options_template_id_fkey`
  FOREIGN KEY (`template_id`) REFERENCES `variation_group_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
