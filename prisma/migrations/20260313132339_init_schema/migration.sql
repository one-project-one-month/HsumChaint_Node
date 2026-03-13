-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('Monk', 'Donor') NOT NULL,
    `fcm_token` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `is_deleted` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `monkId` INTEGER NULL,
    `donorId` INTEGER NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_monkId_key`(`monkId`),
    UNIQUE INDEX `users_donorId_key`(`donorId`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_role_isActive_idx`(`role`, `isActive`),
    INDEX `users_monkId_idx`(`monkId`),
    INDEX `users_donorId_idx`(`donorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `donors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone_no` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `donors_name_email_idx`(`name`, `email`),
    INDEX `donors_phone_no_idx`(`phone_no`),
    INDEX `donors_email_idx`(`email`),
    UNIQUE INDEX `donors_id_name_key`(`id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monasteries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `address` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by_id` INTEGER NOT NULL,

    UNIQUE INDEX `monasteries_created_by_id_key`(`created_by_id`),
    INDEX `monasteries_name_idx`(`name`),
    INDEX `monasteries_address_idx`(`address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `refresh_token` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,

    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `pickup_time` DATETIME(3) NULL,
    `dropoff_time` DATETIME(3) NULL,
    `dropoff_notification_time` DATETIME(3) NULL,
    `pickup_notification_time` DATETIME(3) NULL,

    UNIQUE INDEX `user_settings_user_id_key`(`user_id`),
    INDEX `user_settings_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` ENUM('invitation', 'donation', 'system', 'hsum_chaint') NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    INDEX `notifications_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invitations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('admin', 'editor', 'viewer') NOT NULL,
    `status` ENUM('pending', 'accept', 'reject') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `monastery_space_id` INTEGER NOT NULL,
    `invited_user_id` INTEGER NOT NULL,
    `invited_by_id` INTEGER NOT NULL,

    INDEX `invitations_monastery_space_id_idx`(`monastery_space_id`),
    INDEX `invitations_invited_user_id_idx`(`invited_user_id`),
    INDEX `invitations_invited_by_id_idx`(`invited_by_id`),
    INDEX `invitations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monastery_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('Owner', 'Editor', 'Viewer') NOT NULL,
    `is_owner` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `monastery_id` INTEGER NOT NULL,
    `user_id` INTEGER NULL,

    INDEX `monastery_members_is_owner_idx`(`is_owner`),
    INDEX `monastery_members_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `donation_lists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
    `donation_due_date` DATETIME(3) NOT NULL,
    `created_date` DATETIME(3) NOT NULL,
    `update_at` DATETIME(3) NULL,
    `monastery_id` INTEGER NOT NULL,
    `donor_name` VARCHAR(191) NOT NULL,
    `donor_id` INTEGER NOT NULL,
    `reviewer_id` INTEGER NULL,
    `donation_type_id` INTEGER NOT NULL,

    UNIQUE INDEX `donation_lists_donor_name_key`(`donor_name`),
    INDEX `donation_lists_donor_id_idx`(`donor_id`),
    INDEX `donation_lists_donation_type_id_idx`(`donation_type_id`),
    INDEX `donation_lists_monastery_id_idx`(`monastery_id`),
    INDEX `donation_lists_reviewer_id_idx`(`reviewer_id`),
    INDEX `donation_lists_donor_id_donation_due_date_idx`(`donor_id`, `donation_due_date`),
    INDEX `donation_lists_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `donation_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `donation_type` ENUM('OneTime', 'Monthly') NOT NULL,
    `duration` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `donation_types_donation_type_idx`(`donation_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_monkId_fkey` FOREIGN KEY (`monkId`) REFERENCES `monastery_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_donorId_fkey` FOREIGN KEY (`donorId`) REFERENCES `donors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monasteries` ADD CONSTRAINT `monasteries_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `monastery_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_monastery_space_id_fkey` FOREIGN KEY (`monastery_space_id`) REFERENCES `monasteries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_invited_user_id_fkey` FOREIGN KEY (`invited_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monastery_members` ADD CONSTRAINT `monastery_members_monastery_id_fkey` FOREIGN KEY (`monastery_id`) REFERENCES `monasteries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monastery_members` ADD CONSTRAINT `monastery_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_lists` ADD CONSTRAINT `donation_lists_monastery_id_fkey` FOREIGN KEY (`monastery_id`) REFERENCES `monasteries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_lists` ADD CONSTRAINT `donation_lists_donor_id_donor_name_fkey` FOREIGN KEY (`donor_id`, `donor_name`) REFERENCES `donors`(`id`, `name`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_lists` ADD CONSTRAINT `donation_lists_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `monastery_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_lists` ADD CONSTRAINT `donation_lists_donation_type_id_fkey` FOREIGN KEY (`donation_type_id`) REFERENCES `donation_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
