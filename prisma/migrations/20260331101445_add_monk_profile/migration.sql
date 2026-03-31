-- DropIndex
DROP INDEX `refresh_tokens_refresh_token_revoked_at_idx` ON `refresh_tokens`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `contactPhone` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `monk_profile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `monastery_name` VARCHAR(191) NOT NULL,
    `monastery_address` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `monk_profile_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `refresh_tokens_refresh_token_user_id_revoked_at_idx` ON `refresh_tokens`(`refresh_token`, `user_id`, `revoked_at`);

-- AddForeignKey
ALTER TABLE `monk_profile` ADD CONSTRAINT `monk_profile_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
