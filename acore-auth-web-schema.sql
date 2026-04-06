-- Shadow Azeroth web schema (safe / idempotent)
-- Execute this in: acore_auth
-- Goal: avoid register/shop errors and support separate forum profile

USE `acore_auth`;

-- --------------------------------------------------------------------
-- 1) account columns needed by web/API
-- --------------------------------------------------------------------

-- email (register API tries to use it; API already has fallback, but this avoids fallback path)
SET @has_email := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'account' AND column_name = 'email'
);
SET @sql := IF(@has_email = 0,
  'ALTER TABLE `account` ADD COLUMN `email` VARCHAR(255) NULL AFTER `username`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vp (vote points)
SET @has_vp := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'account' AND column_name = 'vp'
);
SET @sql := IF(@has_vp = 0,
  'ALTER TABLE `account` ADD COLUMN `vp` INT UNSIGNED NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- dp (donation points)
SET @has_dp := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'account' AND column_name = 'dp'
);
SET @sql := IF(@has_dp = 0,
  'ALTER TABLE `account` ADD COLUMN `dp` INT UNSIGNED NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- unique index on email (optional but recommended)
SET @has_uq_email := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'account' AND index_name = 'uq_account_email'
);
SET @sql := IF(@has_uq_email = 0,
  'ALTER TABLE `account` ADD UNIQUE KEY `uq_account_email` (`email`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------------------
-- 2) Forum profile (separate name for forum, does not alter core login)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `forum_profiles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` INT UNSIGNED NOT NULL,
  `forum_name` VARCHAR(32) NOT NULL,
  `avatar_url` VARCHAR(255) NULL,
  `bio` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_forum_profiles_account` (`account_id`),
  UNIQUE KEY `uq_forum_profiles_name` (`forum_name`),
  CONSTRAINT `fk_forum_profiles_account`
    FOREIGN KEY (`account_id`) REFERENCES `account`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- 3) Shop items table used by /api/shop/items and /api/shop/purchase
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shop_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `image` VARCHAR(100) NULL,
  `price` INT UNSIGNED NOT NULL,
  `currency` ENUM('vp','dp') NOT NULL DEFAULT 'vp',
  `quality` ENUM('comun','poco_comun','raro','epico','legendario') NOT NULL DEFAULT 'comun',
  `category` ENUM('pve','pvp','misc') NOT NULL DEFAULT 'misc',
  `tier` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `class_mask` INT UNSIGNED NOT NULL DEFAULT 0,
  `soap_item_entry` INT UNSIGNED NULL,
  `soap_item_count` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_shop_category_tier` (`category`, `tier`),
  KEY `idx_shop_class_mask` (`class_mask`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- 4) Forum system (Topics and Comments)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `forum_topics` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `category` ENUM('general','support','guides','guild','reports','suggestions','announcements') NOT NULL DEFAULT 'general',
  `author_id` INT UNSIGNED NOT NULL,
  `pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `locked` TINYINT(1) NOT NULL DEFAULT 0,
  `completed` TINYINT(1) NOT NULL DEFAULT 0,
  `views` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_forum_topics_author` (`author_id`),
  KEY `idx_forum_topics_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `forum_comments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `topic_id` INT UNSIGNED NOT NULL,
  `author_id` INT UNSIGNED NOT NULL,
  `comment` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_forum_comments_topic` (`topic_id`),
  KEY `idx_forum_comments_author` (`author_id`),
  CONSTRAINT `fk_forum_comments_topic`
    FOREIGN KEY (`topic_id`) REFERENCES `forum_topics`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- 5) Purchase History (for account transparency)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shop_purchases` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` INT UNSIGNED NOT NULL,
  `item_id` INT UNSIGNED NOT NULL,
  `item_name` VARCHAR(120) NOT NULL DEFAULT '',
  `currency` ENUM('vp','dp') NOT NULL,
  `price` INT UNSIGNED NOT NULL,
  `character_guid` INT UNSIGNED NULL,
  `character_name` VARCHAR(60) NOT NULL DEFAULT '',
  `is_gift` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_account_created` (`account_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------
-- 6) Summary / Checks
-- --------------------------------------------------------------------
SELECT 'Forum tables' AS status, COUNT(*) AS count 
FROM information_schema.tables 
WHERE table_schema = DATABASE() AND table_name IN ('forum_topics', 'forum_comments');

SELECT 'Shop purchases exists' AS status, COUNT(*) AS count
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = 'shop_purchases';
