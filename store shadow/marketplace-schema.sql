-- ==============================================================================
-- TRINITYCORE MARKETPLACE SCHEMA (Store Shadow)
-- Ejecutar en la base de datos `auth` (o donde residan tus tablas web/custom)
-- ==============================================================================

USE `auth`;

-- 1. Crear Cuenta de Retención ("Hold Account" / "Mercado Negro")
-- Todo personaje listado será movido a esta cuenta temporalmente para que ni
-- el dueño original pueda acceder a él in-game mientras esté publicado.
INSERT IGNORE INTO `account` (`id`, `username`, `salt`, `verifier`, `email`, `last_ip`, `vp`, `dp`) 
VALUES (1, 'MARKET_HOLD_ACCOUNT', 0x00, 0x00, 'market@shadow-azeroth.com', '127.0.0.1', 0, 0);

-- 2. Tabla de publicaciones / listados activos
CREATE TABLE IF NOT EXISTS `marketplace_listings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `seller_account` INT UNSIGNED NOT NULL COMMENT 'auth.account.id del dueño original',
  `char_guid` INT UNSIGNED NOT NULL COMMENT 'characters.characters.guid',
  `char_snapshot` LONGTEXT NOT NULL COMMENT 'JSON con datos del PJ: raza, clase, nivel, gold, items equipados',
  `price_dp` INT UNSIGNED NOT NULL COMMENT 'Precio en Donation Points (DP)',
  `status` ENUM('active','sold','cancelled') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `sold_at` TIMESTAMP NULL DEFAULT NULL,
  
  INDEX `idx_status` (`status`),
  INDEX `idx_seller` (`seller_account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Historial de transacciones de mercado
CREATE TABLE IF NOT EXISTS `marketplace_sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `listing_id` INT NOT NULL,
  `seller_id` INT UNSIGNED NOT NULL,
  `buyer_id` INT UNSIGNED NOT NULL,
  `char_guid` INT UNSIGNED NOT NULL,
  `price_dp` INT UNSIGNED NOT NULL,
  `sold_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_buyer` (`buyer_id`),
  INDEX `idx_seller_sales` (`seller_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================================================
-- ¡Listo! Las tablas de Store Shadow están integradas. 
-- El sistema transferirá atómicamente los Donation Points de la columna `dp`.
-- ==============================================================================
