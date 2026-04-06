-- ====================================================================
-- Shadow Azeroth - Robust Shop Categories Migration
-- Ejecutar en la base de datos: acore_auth
-- ====================================================================

-- 1. Crear la tabla de categorías con soporte jerárquico e imágenes
CREATE TABLE IF NOT EXISTS `shop_categories` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `slug`         VARCHAR(50)     NOT NULL,
  `name`         VARCHAR(100)    NOT NULL,
  `description`  TEXT            DEFAULT NULL,
  `icon`         VARCHAR(50)     NOT NULL DEFAULT 'Package' COMMENT 'Nombre de icono Lucide',
  `image_url`    TEXT            DEFAULT NULL COMMENT 'URL para la imagen de cabecera/tarjeta',
  `parent_id`    INT UNSIGNED    DEFAULT NULL COMMENT 'ID de la categoría padre para subsecciones',
  `order_index`  INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_slug` (`slug`),
  CONSTRAINT `fk_shop_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `shop_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Migrar categorías base desde el JSON actual
INSERT IGNORE INTO `shop_categories` (`slug`, `name`, `icon`) VALUES
('pve',         'Equipamiento PvE',      'Swords'),
('pvp',         'Equipamiento PvP',      'Shield'),
('mounts',      'Monturas y Mascotas',   'Bird'),
('gold',        'Oro',                   'Coins'),
('transmog',    'Transfiguración',       'Sparkles'),
('professions', 'Profesiones',           'Wrench'),
('lvl80',       'Subir a Nivel 80',      'ArrowUp');

-- 3. Modificar shop_items para usar VARCHAR en lugar de ENUM
-- Esto permite mayor flexibilidad sin alterar el esquema cada vez
ALTER TABLE `shop_items` 
  MODIFY COLUMN `category` VARCHAR(50) NOT NULL DEFAULT 'misc' COMMENT 'Slug de la categoría en shop_categories';

-- 4. Asegurar que los items existentes apunten a los slugs correctos (si es necesario)
-- (En este caso coinciden: 'pve', 'pvp', 'misc' ya existen en el ENUM anterior)
