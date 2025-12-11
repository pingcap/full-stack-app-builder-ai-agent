ALTER TABLE `user`
    ADD COLUMN `email_verified` BOOLEAN NOT NULL;

ALTER TABLE `user`
    ADD COLUMN `created_at` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL;

ALTER TABLE `user`
    ADD COLUMN `updated_at` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL;

CREATE TABLE `session`
(
    `id`         INTEGER                                   NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `expires_at` TIMESTAMP(3)                              NOT NULL,
    `token`      VARCHAR(1024)                             NOT NULL COLLATE 'ascii_bin',
    `created_at` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updated_at` TIMESTAMP(3)                              NOT NULL,
    `ip_address` VARCHAR(16),
    `user_agent` TEXT,
    `user_id`    INTEGER                                   NOT NULL,
    UNIQUE INDEX uk_session_token (token),
    FOREIGN KEY fk_session_user (user_id) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE `account`
(
    `id`                       INTEGER                                   NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `account_id`               VARCHAR(256)                              NOT NULL,
    `provider_id`              VARCHAR(256)                              NOT NULL,
    `user_id`                  INTEGER                                   NOT NULL,
    `access_token`             TEXT,
    `refresh_token`            TEXT,
    `id_token`                 TEXT,
    `access_token_expires_at`  TIMESTAMP(3),
    `refresh_token_expires_at` TIMESTAMP(3),
    `scope`                    VARCHAR(256),
    `password`                 VARCHAR(256),
    `created_at`               TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updated_at`               TIMESTAMP(3)                              NOT NULL,
    FOREIGN KEY fk_account_user (user_id) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE `verification`
(
    `id`         INTEGER                                   NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `identifier` VARCHAR(256)                              NOT NULL,
    `value`      TEXT                                      NOT NULL,
    `expires_at` TIMESTAMP(3)                              NOT NULL,
    `created_at` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updated_at` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    INDEX idx_verification_identifier_idx (identifier)
);
