-- ==============================================================================
-- SHADOW AZEROTH - TOTAL STORE RESTORATION (Premium Schema)
-- Ejecutar este script en la base de datos `auth` (o `acore_auth`)
-- ==============================================================================

USE `auth`; -- Asegúrate de que el nombre sea el correcto para tu DB auth

-- 1. Asegurar columnas de puntos en la tabla account (VP y DP)
ALTER TABLE `account`
  ADD COLUMN IF NOT EXISTS `vp` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Estelas / Vote Points',
  ADD COLUMN IF NOT EXISTS `dp` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Donation Points';

-- 2. Eliminar tabla si existe (por seguridad, aunque el error dice que no existe)
DROP TABLE IF EXISTS `shop_items`;

-- 3. Crear la tabla principal de la tienda con soporte para servicios premium
CREATE TABLE `shop_items` (
  `id`               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `item_id`          INT UNSIGNED     NOT NULL DEFAULT 0 
    COMMENT 'ID del item original de WoW (para icono y Wowhead)',
  `name`             VARCHAR(100)     NOT NULL DEFAULT '' 
    COMMENT 'Nombre mostrado en la tienda',
  `description`      TEXT             DEFAULT NULL,
  `image`            VARCHAR(100)     DEFAULT 'inv_misc_questionmark' 
    COMMENT 'Icono (inv_sword_01, etc.)',
  
  -- Precios
  `price`            INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Precio legacy (obsoleto)',
  `currency`         VARCHAR(10)      NOT NULL DEFAULT 'dp' COMMENT 'Moneda legacy (obsoleto)',
  `price_dp`         INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Donation Points (Recomendado)',
  `price_vp`         INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Estelas (Recomendado)',
  
  -- Calidad y Categoría
  `quality`          VARCHAR(20)      NOT NULL DEFAULT 'comun' COMMENT 'comun, raro, epico, etc.',
  `category`         VARCHAR(50)      NOT NULL DEFAULT 'misc' COMMENT 'Slug de la categoría',
  `tier`             INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '0-11 para Tiers PvE',
  `class_mask`       INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'Filtro por clase (bitmask)',
  
  -- SOAP / Entrega
  `soap_item_entry`  INT UNSIGNED     DEFAULT NULL COMMENT 'ID real a entregar via comando',
  `soap_item_count`  INT UNSIGNED     NOT NULL DEFAULT 1 COMMENT 'Cantidad del item',
  
  -- Servicios Avanzados
  `service_type`     VARCHAR(50)      NOT NULL DEFAULT 'none' COMMENT 'none, profession, level_boost, etc.',
  `service_data`     TEXT             DEFAULT NULL COMMENT 'JSON con datos (skills, niveles, etc.)',
  
  -- Filtros Extra
  `faction`          VARCHAR(10)      NOT NULL DEFAULT 'all' COMMENT 'all, horda, alianza',
  `item_level`       INT UNSIGNED     NOT NULL DEFAULT 0,
  
  PRIMARY KEY (`id`),
  INDEX `idx_category` (`category`),
  INDEX `idx_service` (`service_type`),
  INDEX `idx_item_id` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Shadow Azeroth - Premium Store Table';

-- 4. Opcional: Items base de prueba (Elimina -- para activar)
/*
INSERT INTO `shop_items` (`name`, `item_id`, `price_dp`, `price_vp`, `quality`, `category`, `service_type`) VALUES
('Montura de Prueba', 30609, 10, 0, 'epico', 'monturas', 'none'),
('Empujón Nivel 80', 0, 50, 0, 'legendario', 'lvl80', 'level_boost');
*/

-- ==============================================================================
-- ¡Listo! Ahora el Panel Administrativo funcionará correctamente.
-- ==============================================================================
