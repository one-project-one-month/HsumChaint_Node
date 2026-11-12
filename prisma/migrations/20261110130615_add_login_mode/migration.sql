/*
  Warnings:

  - You are about to drop the column `role` on the `Invitation` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Monastery_Member` table. All the data in the column will be lost.
  - You are about to alter the column `phone` on the `users` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - A unique constraint covering the columns `[phone,is_deleted]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,is_deleted]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `space_role_id` to the `Monastery_Member` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Invitation` DROP FOREIGN KEY `Invitation_invited_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `Invitation` DROP FOREIGN KEY `Invitation_invited_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Invitation` DROP FOREIGN KEY `Invitation_monastery_space_id_fkey`;

-- DropForeignKey
ALTER TABLE `Monastery_Member` DROP FOREIGN KEY `Monastery_Member_monastery_space_id_fkey`;

-- DropForeignKey
ALTER TABLE `Monastery_Member` DROP FOREIGN KEY `Monastery_Member_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Monastery_Space` DROP FOREIGN KEY `Monastery_Space_created_by_id_fkey`;

-- DropForeignKey
ALTER TABLE `Notification` DROP FOREIGN KEY `Notification_user_id_fkey`;

-- DropIndex
DROP INDEX `users_email_key` ON `users`;

-- DropIndex
DROP INDEX `users_phone_key` ON `users`;

-- AlterTable
ALTER TABLE `Donor_List` MODIFY `donation_type_value` INTEGER NOT NULL DEFAULT 0,
    MODIFY `status_value` INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE `Invitation` DROP COLUMN `role`,
    ADD COLUMN `space_role_id` INTEGER NOT NULL DEFAULT 4,
    MODIFY `invited_by_id` INTEGER NULL,
    MODIFY `status` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Monastery_Member` DROP COLUMN `role`,
    ADD COLUMN `space_role_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Monastery_Space` MODIFY `created_by_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `type` INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE `Role_Permission` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `email_verified_at` DATETIME(3) NULL,
    ADD COLUMN `phone_verified_at` DATETIME(3) NULL,
    MODIFY `phone` VARCHAR(50) NULL;

-- CreateTable
CREATE TABLE `Space_Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `space_role_name_unique`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Space_Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `space_permission_name_unique`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Space_Role_Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `space_role_id` INTEGER NOT NULL,
    `space_permission_id` INTEGER NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `IX_Space_Role_Permission_role_id`(`space_role_id`),
    INDEX `IX_Space_Role_Permission_permission_id`(`space_permission_id`),
    UNIQUE INDEX `UX_Space_Role_Permission`(`space_role_id`, `space_permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Login_Mode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `require_phone_verification` BOOLEAN NOT NULL DEFAULT false,
    `require_email_verification` BOOLEAN NOT NULL DEFAULT false,
    `updated_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UX_Login_Mode_code`(`code`),
    INDEX `IX_Login_Mode_is_active`(`is_active`),
    INDEX `IX_Login_Mode_updated_by_id`(`updated_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Otp_Code` (
    `id` BIGINT NOT NULL,
    `user_id` INTEGER NULL,
    `channel` VARCHAR(20) NOT NULL,
    `purpose` VARCHAR(30) NOT NULL,
    `destination` VARCHAR(255) NOT NULL,
    `code_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `is_used` BOOLEAN NOT NULL DEFAULT false,
    `used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `failed_attempt_count` INTEGER NOT NULL DEFAULT 0,
    `max_attempt_count` INTEGER NOT NULL DEFAULT 5,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IX_Otp_Code_user_id`(`user_id`),
    INDEX `IX_Otp_Code_lookup`(`destination`, `channel`, `purpose`, `created_at`),
    INDEX `IX_Otp_Code_expires_at`(`expires_at`),
    INDEX `IX_Otp_Code_cleanup`(`used_at`, `expires_at`, `revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `IX_Invitation_space_role_id` ON `Invitation`(`space_role_id`);

-- CreateIndex
CREATE INDEX `IX_Monastery_Member_space_role_id` ON `Monastery_Member`(`space_role_id`);

-- CreateIndex
CREATE UNIQUE INDEX `UX_User_phone_active` ON `users`(`phone`, `is_deleted`);

-- CreateIndex
CREATE UNIQUE INDEX `UX_User_email_active` ON `users`(`email`, `is_deleted`);

-- AddForeignKey
ALTER TABLE `Space_Role_Permission` ADD CONSTRAINT `Space_Role_Permission_space_role_id_fkey` FOREIGN KEY (`space_role_id`) REFERENCES `Space_Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Space_Role_Permission` ADD CONSTRAINT `Space_Role_Permission_space_permission_id_fkey` FOREIGN KEY (`space_permission_id`) REFERENCES `Space_Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Login_Mode` ADD CONSTRAINT `Login_Mode_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Otp_Code` ADD CONSTRAINT `Otp_Code_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Monastery_Space` ADD CONSTRAINT `Monastery_Space_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Monastery_Member` ADD CONSTRAINT `Monastery_Member_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Monastery_Member` ADD CONSTRAINT `Monastery_Member_monastery_space_id_fkey` FOREIGN KEY (`monastery_space_id`) REFERENCES `Monastery_Space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Monastery_Member` ADD CONSTRAINT `Monastery_Member_space_role_id_fkey` FOREIGN KEY (`space_role_id`) REFERENCES `Space_Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_monastery_space_id_fkey` FOREIGN KEY (`monastery_space_id`) REFERENCES `Monastery_Space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_invited_user_id_fkey` FOREIGN KEY (`invited_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_space_role_id_fkey` FOREIGN KEY (`space_role_id`) REFERENCES `Space_Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `Donor_List` RENAME INDEX `donor_list_donor_id_idx` TO `IX_Donor_List_donor_id`;

-- RenameIndex
ALTER TABLE `Donor_List` RENAME INDEX `donor_list_monastery_space_id_idx` TO `IX_Donor_List_monastery_space_id`;

-- RenameIndex
ALTER TABLE `Donor_List` RENAME INDEX `donor_list_reviewer_id_idx` TO `IX_Donor_List_reviewer_id`;

-- RenameIndex
ALTER TABLE `Donor_List` RENAME INDEX `donor_list_status_created_at_idx` TO `IX_Donor_List_status_created_at`;

-- RenameIndex
ALTER TABLE `Invitation` RENAME INDEX `invitation_invited_by_id_idx` TO `IX_Invitation_invited_by_id`;

-- RenameIndex
ALTER TABLE `Invitation` RENAME INDEX `invitation_invited_user_id_idx` TO `IX_Invitation_invited_user_id`;

-- RenameIndex
ALTER TABLE `Invitation` RENAME INDEX `invitation_monastery_space_id_idx` TO `IX_Invitation_monastery_space_id`;

-- RenameIndex
ALTER TABLE `Monastery_Member` RENAME INDEX `monastery_member_monastery_space_id_idx` TO `IX_Monastery_Member_monastery_space_id`;

-- RenameIndex
ALTER TABLE `Monastery_Member` RENAME INDEX `monastery_member_user_id_monastery_space_id_unique` TO `UX_Monastery_Member_user_space`;

-- RenameIndex
ALTER TABLE `Monastery_Space` RENAME INDEX `monastery_space_created_by_id_idx` TO `IX_Monastery_Space_created_by_id`;

-- RenameIndex
ALTER TABLE `Notification` RENAME INDEX `notification_user_id_created_at_idx` TO `IX_Notification_user_id_created_at`;

-- RenameIndex
ALTER TABLE `Role_Permission` RENAME INDEX `Role_Permission_permission_id_fkey` TO `IX_Role_Permission_permission_id`;

-- RenameIndex
ALTER TABLE `Role_Permission` RENAME INDEX `role_permission_role_id_idx` TO `IX_Role_Permission_role_id`;

-- RenameIndex
ALTER TABLE `Role_Permission` RENAME INDEX `role_permission_role_id_permission_id_unique` TO `UX_Role_Permission_role_permission`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `users_role_id_fkey` TO `IX_User_role_id`;
