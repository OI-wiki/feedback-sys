CREATE TABLE IF NOT EXISTS `metas` (
    `key` TEXT PRIMARY KEY,
    `value` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `pages` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `path` TEXT UNIQUE NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_path ON `pages`(`path`);

CREATE TABLE IF NOT EXISTS `offsets` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `page_id` INTEGER NOT NULL,
    `start` INTEGER NOT NULL,
    `end` INTEGER NOT NULL,
    FOREIGN KEY(`page_id`) REFERENCES `pages`(`id`)
);
CREATE INDEX IF NOT EXISTS idx_offsets ON `offsets`(`start`, `end`);
CREATE INDEX IF NOT EXISTS idx_page_id ON `offsets`(`page_id`);

CREATE TABLE IF NOT EXISTS `commenters`(
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `oauth_provider` TEXT NOT NULL,
    `oauth_user_id` TEXT NOT NULL,
    `name` TEXT NOT NULL,
    UNIQUE(`oauth_provider`, `oauth_user_id`) 
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_provider_oauth_user_id ON `commenters`(`oauth_provider`, `oauth_user_id`);

CREATE TABLE IF NOT EXISTS `comments` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `offset_id` INTEGER NOT NULL, 
    `commenter_id` INTEGER NOT NULL, 
    `comment` TEXT NOT NULL,
    `created_time` TEXT NOT NULL, -- SQLite currently not support TIMESTAMP, use ISO 8601 DateTime
    FOREIGN KEY(`offset_id`) REFERENCES `offsets`(`id`),
    FOREIGN KEY(`commenter_id`) REFERENCES `commenters`(`id`)
);
CREATE INDEX IF NOT EXISTS idx_offset_id ON `comments`(`offset_id`);
CREATE INDEX IF NOT EXISTS idx_commenter_id ON `comments`(`commenter_id`);