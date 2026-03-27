-- ============================================================
-- Shadow Azeroth — Sistema de Estelas por Niveles (Anti-Farm)
-- Ejecutar en: acore_auth
-- ============================================================

USE `acore_auth`;

-- Tabla de tracking: una cuenta solo recibe la recompensa UNA VEZ por nivel hito
CREATE TABLE IF NOT EXISTS `estelas_level_rewards_log` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `account_id` INT UNSIGNED NOT NULL,
  `reward_level` SMALLINT UNSIGNED NOT NULL COMMENT 'Nivel hito: 10, 40, 70',
  `estelas_awarded` INT UNSIGNED NOT NULL COMMENT 'Cantidad de Estelas (VP) otorgadas',
  `character_guid` INT UNSIGNED NOT NULL COMMENT 'GUID del personaje que triggereó la recompensa',
  `character_name` VARCHAR(32) NOT NULL COMMENT 'Nombre del personaje (para auditoría)',
  `awarded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_reward_level` (`account_id`, `reward_level`),
  KEY `idx_account` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Anti-farm: 1 recompensa por cuenta por nivel hito';

-- ============================================================
-- Verificar que la tabla se creó correctamente
-- ============================================================
SELECT 'estelas_level_rewards_log' AS tabla, COUNT(*) AS existe
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'estelas_level_rewards_log';
