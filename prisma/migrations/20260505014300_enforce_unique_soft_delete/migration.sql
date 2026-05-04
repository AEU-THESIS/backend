-- DropIndex
DROP INDEX `users_email_key` ON `users`;

-- DropIndex
DROP INDEX `users_employee_id_key` ON `users`;

-- AlterTable
ALTER TABLE
    `users`
ADD
    COLUMN `invite_expires` DATETIME(3) NULL,
ADD
    COLUMN `invite_token` TEXT NULL,
ADD
    COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `users_email_is_deleted_key` ON `users`(`email`, `is_deleted`);

-- CreateIndex
CREATE UNIQUE INDEX `users_employee_id_is_deleted_key` ON `users`(`employee_id`, `is_deleted`);