-- 1. Create Space_Role table
CREATE TABLE `Space_Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `space_role_name_unique`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Create Space_Permission table
CREATE TABLE `Space_Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `space_permission_name_unique`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Create Space_Role_Permission table
CREATE TABLE `Space_Role_Permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `space_role_id` INTEGER NOT NULL,
    `space_permission_id` INTEGER NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `IX_Space_Role_Permission_role_id`(`space_role_id`),
    INDEX `IX_Space_Role_Permission_permission_id`(`space_permission_id`),
    UNIQUE INDEX `UX_Space_Role_Permission`(`space_role_id`, `space_permission_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `Space_Role_Permission_space_role_id_fkey` FOREIGN KEY (`space_role_id`) REFERENCES `Space_Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `Space_Role_Permission_space_permission_id_fkey` FOREIGN KEY (`space_permission_id`) REFERENCES `Space_Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Seed preset Space Roles
INSERT INTO `Space_Role` (`id`, `name`, `description`) VALUES
(1, 'Space Admin', 'Full control and administration of the monastery space'),
(2, 'Space Moderator', 'Moderate space activities, members, and review donations'),
(3, 'Space Editor', 'Create posts and initiate donations in space'),
(4, 'Space Member', 'General monastery space member with view access');

-- 5. Seed the 10 Space Permissions
INSERT INTO `Space_Permission` (`id`, `name`, `description`) VALUES
(1, 'Space.View', 'View space details, members, and general activities'),
(2, 'Space.Update', 'Update monastery space profile and details'),
(3, 'Space.Delete', 'Delete monastery space'),
(4, 'Space.Member.Invite', 'Invite new members to the monastery space'),
(5, 'Space.Member.Manage', 'Manage existing member statuses and roles'),
(6, 'Space.Member.Remove', 'Remove members from the monastery space'),
(7, 'Space.Role.Manage', 'Assign or change member roles within space'),
(8, 'Space.Post.Create', 'Create updates and posts in space'),
(9, 'Space.Donation.Create', 'Submit donation entries in space'),
(10, 'Space.Donation.Review', 'Approve, reject, or mark donations completed');

-- 6. Seed Space Role Permissions
-- Space Admin (1): All 10 permissions
INSERT INTO `Space_Role_Permission` (`space_role_id`, `space_permission_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10);

-- Space Moderator (2): View, Invite, Manage, Post, Donation Create, Donation Review
INSERT INTO `Space_Role_Permission` (`space_role_id`, `space_permission_id`) VALUES
(2, 1), (2, 4), (2, 5), (2, 8), (2, 9), (2, 10);

-- Space Editor (3): View, Post, Donation Create
INSERT INTO `Space_Role_Permission` (`space_role_id`, `space_permission_id`) VALUES
(3, 1), (3, 8), (3, 9);

-- Space Member (4): View
INSERT INTO `Space_Role_Permission` (`space_role_id`, `space_permission_id`) VALUES
(4, 1);

-- 7. Migrate Monastery_Member: replace column role with space_role_id
ALTER TABLE `Monastery_Member` DROP FOREIGN KEY `Monastery_Member_user_id_fkey`;
ALTER TABLE `Monastery_Member` DROP FOREIGN KEY `Monastery_Member_monastery_space_id_fkey`;

ALTER TABLE `Monastery_Member` ADD COLUMN `space_role_id` INTEGER NULL;

UPDATE `Monastery_Member`
SET `space_role_id` = CASE
    WHEN `is_owner` = 1 THEN 1
    WHEN `role` = 4 THEN 1
    WHEN `role` = 5 THEN 2
    WHEN `role` = 6 THEN 3
    WHEN `role` = 7 THEN 4
    ELSE 4
END;

ALTER TABLE `Monastery_Member` MODIFY COLUMN `space_role_id` INTEGER NOT NULL;
ALTER TABLE `Monastery_Member` DROP COLUMN `role`;

ALTER TABLE `Monastery_Member` ADD CONSTRAINT `Monastery_Member_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Monastery_Member` ADD CONSTRAINT `Monastery_Member_monastery_space_id_fkey` FOREIGN KEY (`monastery_space_id`) REFERENCES `Monastery_Space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Monastery_Member` ADD CONSTRAINT `Monastery_Member_space_role_id_fkey` FOREIGN KEY (`space_role_id`) REFERENCES `Space_Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX `IX_Monastery_Member_space_role_id` ON `Monastery_Member`(`space_role_id`);

-- 8. Migrate Invitation: replace column role with space_role_id
ALTER TABLE `Invitation` DROP FOREIGN KEY `Invitation_monastery_space_id_fkey`;
ALTER TABLE `Invitation` DROP FOREIGN KEY `Invitation_invited_user_id_fkey`;
ALTER TABLE `Invitation` DROP FOREIGN KEY `Invitation_invited_by_id_fkey`;

ALTER TABLE `Invitation` ADD COLUMN `space_role_id` INTEGER NULL;

UPDATE `Invitation`
SET `space_role_id` = CASE
    WHEN `role` = 4 THEN 1
    WHEN `role` = 5 THEN 2
    WHEN `role` = 6 THEN 3
    WHEN `role` = 7 THEN 4
    ELSE 4
END;

ALTER TABLE `Invitation` MODIFY COLUMN `space_role_id` INTEGER NOT NULL DEFAULT 4;
ALTER TABLE `Invitation` DROP COLUMN `role`;

ALTER TABLE `Invitation` MODIFY COLUMN `invited_by_id` INTEGER NULL;
ALTER TABLE `Invitation` MODIFY COLUMN `status` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_monastery_space_id_fkey` FOREIGN KEY (`monastery_space_id`) REFERENCES `Monastery_Space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_invited_user_id_fkey` FOREIGN KEY (`invited_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_space_role_id_fkey` FOREIGN KEY (`space_role_id`) REFERENCES `Space_Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX `IX_Invitation_space_role_id` ON `Invitation`(`space_role_id`);

-- 9. Update Monastery_Space foreign keys and nullability
ALTER TABLE `Monastery_Space` DROP FOREIGN KEY `Monastery_Space_created_by_id_fkey`;
ALTER TABLE `Monastery_Space` MODIFY COLUMN `created_by_id` INTEGER NULL;
ALTER TABLE `Monastery_Space` ADD CONSTRAINT `Monastery_Space_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 10. Update Donor_List foreign keys, nullability and defaults
ALTER TABLE `Donor_List` DROP FOREIGN KEY `Donor_List_monastery_space_id_fkey`;
ALTER TABLE `Donor_List` DROP FOREIGN KEY `Donor_List_donor_id_fkey`;

ALTER TABLE `Donor_List` MODIFY COLUMN `donor_id` INTEGER NULL;
ALTER TABLE `Donor_List` MODIFY COLUMN `donation_type_value` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `Donor_List` MODIFY COLUMN `status_value` INTEGER NOT NULL DEFAULT 2;

ALTER TABLE `Donor_List` ADD CONSTRAINT `Donor_List_monastery_space_id_fkey` FOREIGN KEY (`monastery_space_id`) REFERENCES `Monastery_Space`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Donor_List` ADD CONSTRAINT `Donor_List_donor_id_fkey` FOREIGN KEY (`donor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 11. Update Notification foreign keys and defaults
ALTER TABLE `Notification` DROP FOREIGN KEY `Notification_user_id_fkey`;
ALTER TABLE `Notification` MODIFY COLUMN `type` INTEGER NOT NULL DEFAULT 2;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 12. Update Role_Permission is_deleted column and cascade foreign keys
ALTER TABLE `Role_Permission` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `Role_Permission` DROP FOREIGN KEY `Role_Permission_role_id_fkey`;
ALTER TABLE `Role_Permission` DROP FOREIGN KEY `Role_Permission_permission_id_fkey`;

ALTER TABLE `Role_Permission` ADD CONSTRAINT `Role_Permission_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Role_Permission` ADD CONSTRAINT `Role_Permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 13. Soft delete any legacy space roles from system Role table
UPDATE `Role` SET `is_deleted` = true WHERE `id` IN (4, 5, 6, 7, 8);

-- 14. Rename indexes to match standard naming conventions
ALTER TABLE `Donor_List` RENAME INDEX `donor_list_donor_id_idx` TO `IX_Donor_List_donor_id`;
ALTER TABLE `Donor_List` RENAME INDEX `donor_list_monastery_space_id_idx` TO `IX_Donor_List_monastery_space_id`;
ALTER TABLE `Donor_List` RENAME INDEX `donor_list_reviewer_id_idx` TO `IX_Donor_List_reviewer_id`;
ALTER TABLE `Donor_List` RENAME INDEX `donor_list_status_created_at_idx` TO `IX_Donor_List_status_created_at`;

ALTER TABLE `Invitation` RENAME INDEX `invitation_invited_by_id_idx` TO `IX_Invitation_invited_by_id`;
ALTER TABLE `Invitation` RENAME INDEX `invitation_invited_user_id_idx` TO `IX_Invitation_invited_user_id`;
ALTER TABLE `Invitation` RENAME INDEX `invitation_monastery_space_id_idx` TO `IX_Invitation_monastery_space_id`;

ALTER TABLE `Monastery_Member` RENAME INDEX `monastery_member_monastery_space_id_idx` TO `IX_Monastery_Member_monastery_space_id`;
ALTER TABLE `Monastery_Member` RENAME INDEX `monastery_member_user_id_monastery_space_id_unique` TO `UX_Monastery_Member_user_space`;

ALTER TABLE `Monastery_Space` RENAME INDEX `monastery_space_created_by_id_idx` TO `IX_Monastery_Space_created_by_id`;

ALTER TABLE `Notification` RENAME INDEX `notification_user_id_created_at_idx` TO `IX_Notification_user_id_created_at`;

CREATE INDEX `IX_Role_Permission_permission_id` ON `Role_Permission`(`permission_id`);
CREATE INDEX `IX_Role_Permission_role_id` ON `Role_Permission`(`role_id`);
ALTER TABLE `Role_Permission` RENAME INDEX `role_permission_role_id_permission_id_unique` TO `UX_Role_Permission_role_permission`;
