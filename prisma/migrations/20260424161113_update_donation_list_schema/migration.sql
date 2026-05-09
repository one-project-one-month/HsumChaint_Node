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
CREATE TABLE `donation_lists` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `status` ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
    `donation_due_date` DATETIME(3) NOT NULL,
    `recurrence` ENUM('OneTime', 'Weekly', 'Monthly') NOT NULL DEFAULT 'OneTime',
    `add_reminder` BOOLEAN NOT NULL DEFAULT false,
    `created_date` DATETIME(3) NOT NULL,
    `update_at` DATETIME(3) NULL,
    `donation_type_id` INTEGER NOT NULL,

    INDEX `donation_lists_donation_type_id_idx`(`donation_type_id`),
    INDEX `donation_lists_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `donation_list_donors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `donation_list_id` INTEGER NOT NULL,
    `donor_id` INTEGER NOT NULL,

    INDEX `donation_list_donors_donation_list_id_idx`(`donation_list_id`),
    INDEX `donation_list_donors_donor_id_idx`(`donor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `donation_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `donation_type` ENUM('Breakfast', 'Lunch', 'Dinner') NOT NULL,
    `duration` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `donation_types_donation_type_idx`(`donation_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `donation_lists` ADD CONSTRAINT `donation_lists_donation_type_id_fkey` FOREIGN KEY (`donation_type_id`) REFERENCES `donation_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_list_donors` ADD CONSTRAINT `donation_list_donors_donation_list_id_fkey` FOREIGN KEY (`donation_list_id`) REFERENCES `donation_lists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `donation_list_donors` ADD CONSTRAINT `donation_list_donors_donor_id_fkey` FOREIGN KEY (`donor_id`) REFERENCES `donors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

