-- DropForeignKey
ALTER TABLE `Role_Permission` DROP FOREIGN KEY `Role_Permission_permission_id_fkey`;

-- DropForeignKey
ALTER TABLE `Role_Permission` DROP FOREIGN KEY `Role_Permission_role_id_fkey`;

-- AlterTable
ALTER TABLE `Monastery_Member` MODIFY `role` INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE `Monastery_Space` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `donor_list_status_created_at_idx` ON `Donor_List`(`status_value`, `created_at`);

-- CreateIndex
CREATE UNIQUE INDEX `monastery_member_user_id_monastery_space_id_unique` ON `Monastery_Member`(`user_id`, `monastery_space_id`);

-- CreateIndex
CREATE INDEX `monastery_space_is_deleted_idx` ON `Monastery_Space`(`is_deleted`);

-- CreateIndex
CREATE INDEX `notification_user_id_created_at_idx` ON `Notification`(`user_id`, `created_at`);

-- CreateIndex
CREATE UNIQUE INDEX `permission_name_unique` ON `Permission`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `role_name_unique` ON `Role`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `role_permission_role_id_permission_id_unique` ON `Role_Permission`(`role_id`, `permission_id`);

-- AddForeignKey
ALTER TABLE `Role_Permission` ADD CONSTRAINT `Role_Permission_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role_Permission` ADD CONSTRAINT `Role_Permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `Donor_List` RENAME INDEX `Donor_List_donor_id_fkey` TO `donor_list_donor_id_idx`;

-- RenameIndex
ALTER TABLE `Donor_List` RENAME INDEX `Donor_List_monastery_space_id_fkey` TO `donor_list_monastery_space_id_idx`;

-- RenameIndex
ALTER TABLE `Donor_List` RENAME INDEX `Donor_List_reviewer_id_fkey` TO `donor_list_reviewer_id_idx`;

-- RenameIndex
ALTER TABLE `Invitation` RENAME INDEX `Invitation_invited_by_id_fkey` TO `invitation_invited_by_id_idx`;

-- RenameIndex
ALTER TABLE `Invitation` RENAME INDEX `Invitation_invited_user_id_fkey` TO `invitation_invited_user_id_idx`;

-- RenameIndex
ALTER TABLE `Invitation` RENAME INDEX `Invitation_monastery_space_id_fkey` TO `invitation_monastery_space_id_idx`;

-- RenameIndex
ALTER TABLE `Monastery_Member` RENAME INDEX `Monastery_Member_monastery_space_id_fkey` TO `monastery_member_monastery_space_id_idx`;

-- RenameIndex
ALTER TABLE `Monastery_Space` RENAME INDEX `Monastery_Space_created_by_id_fkey` TO `monastery_space_created_by_id_idx`;

-- CreateIndex
CREATE INDEX `role_permission_role_id_idx` ON `Role_Permission`(`role_id`);
