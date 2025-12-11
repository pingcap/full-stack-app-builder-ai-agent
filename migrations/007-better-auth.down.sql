DROP TABLE `verification`;
DROP TABLE `account`;
DROP TABLE `session`;

ALTER TABLE `user`
    DROP COLUMN `updated_at` ;

ALTER TABLE `user`
    DROP COLUMN `created_at` ;

ALTER TABLE `user`
    DROP COLUMN `email_verified` ;
