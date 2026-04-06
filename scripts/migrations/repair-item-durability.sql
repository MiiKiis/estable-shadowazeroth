-- ============================================================
-- Repair item durability for already-delivered shop/gift items
-- Shadow Azeroth / AzerothCore Trinity-like schemas
-- ============================================================
-- What this script does:
-- 1) Creates a backup table with rows that will be changed.
-- 2) Detects if world.item_template durability column is MaxDurability or maxDurability.
-- 3) Repairs item_instance.durability where it is 0 but the template has durability > 0.
-- 4) Prints before/after counts.
--
-- Requirements:
-- - Run with enough privileges on acore_characters and acore_world.
-- - MySQL 8+ (uses IF NOT EXISTS and prepared statements).
-- ============================================================

SET @old_sql_safe_updates := @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

-- 0) Count candidates before
SELECT COUNT(*) AS candidates_before
FROM acore_characters.item_instance ii
JOIN acore_world.item_template it ON it.entry = ii.itemEntry
WHERE ii.durability = 0
  AND (
    (EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS c
      WHERE c.TABLE_SCHEMA = 'acore_world'
        AND c.TABLE_NAME = 'item_template'
        AND c.COLUMN_NAME = 'MaxDurability'
    ) AND it.MaxDurability > 0)
    OR
    (EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS c
      WHERE c.TABLE_SCHEMA = 'acore_world'
        AND c.TABLE_NAME = 'item_template'
        AND c.COLUMN_NAME = 'maxDurability'
    ) AND it.maxDurability > 0)
  );

-- 1) Backup table (idempotent)
CREATE TABLE IF NOT EXISTS acore_characters.item_instance_durability_backup (
  guid BIGINT UNSIGNED NOT NULL,
  itemEntry INT UNSIGNED NOT NULL,
  owner_guid BIGINT UNSIGNED NOT NULL,
  old_durability INT UNSIGNED NOT NULL,
  backup_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guid),
  KEY idx_item_entry (itemEntry),
  KEY idx_owner_guid (owner_guid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Detect durability column name in world.item_template
SET @durability_col := NULL;

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'acore_world'
        AND TABLE_NAME = 'item_template'
        AND COLUMN_NAME = 'MaxDurability'
    ) THEN 'MaxDurability'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'acore_world'
        AND TABLE_NAME = 'item_template'
        AND COLUMN_NAME = 'maxDurability'
    ) THEN 'maxDurability'
    ELSE NULL
  END
INTO @durability_col;

SELECT @durability_col AS detected_durability_column;

-- 3) Backup candidates + repair (only if durability column exists)
SET @backup_sql := IF(
  @durability_col IS NULL,
  'SELECT "SKIPPED: durability column not found in acore_world.item_template" AS info',
  CONCAT(
    'INSERT IGNORE INTO acore_characters.item_instance_durability_backup (guid, itemEntry, owner_guid, old_durability) ',
    'SELECT ii.guid, ii.itemEntry, ii.owner_guid, ii.durability ',
    'FROM acore_characters.item_instance ii ',
    'JOIN acore_world.item_template it ON it.entry = ii.itemEntry ',
    'WHERE ii.durability = 0 AND it.', @durability_col, ' > 0'
  )
);

PREPARE stmt_backup FROM @backup_sql;
EXECUTE stmt_backup;
DEALLOCATE PREPARE stmt_backup;

SET @repair_sql := IF(
  @durability_col IS NULL,
  'SELECT "SKIPPED: durability column not found in acore_world.item_template" AS info',
  CONCAT(
    'UPDATE acore_characters.item_instance ii ',
    'JOIN acore_world.item_template it ON it.entry = ii.itemEntry ',
    'SET ii.durability = it.', @durability_col, ' ',
    'WHERE ii.durability = 0 AND it.', @durability_col, ' > 0'
  )
);

PREPARE stmt_repair FROM @repair_sql;
EXECUTE stmt_repair;
DEALLOCATE PREPARE stmt_repair;

-- 4) Count remaining after
SET @after_sql := IF(
  @durability_col IS NULL,
  'SELECT "SKIPPED: durability column not found in acore_world.item_template" AS info',
  CONCAT(
    'SELECT COUNT(*) AS candidates_after ',
    'FROM acore_characters.item_instance ii ',
    'JOIN acore_world.item_template it ON it.entry = ii.itemEntry ',
    'WHERE ii.durability = 0 AND it.', @durability_col, ' > 0'
  )
);

PREPARE stmt_after FROM @after_sql;
EXECUTE stmt_after;
DEALLOCATE PREPARE stmt_after;

SET SQL_SAFE_UPDATES = @old_sql_safe_updates;

-- ============================================================
-- Optional rollback template (manual):
-- UPDATE acore_characters.item_instance ii
-- JOIN acore_characters.item_instance_durability_backup b ON b.guid = ii.guid
-- SET ii.durability = b.old_durability;
-- ============================================================
