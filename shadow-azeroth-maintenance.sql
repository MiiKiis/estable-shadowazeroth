-- ============================================================
-- SHADOW AZEROTH - Script SQL Maestro de Verificación y Limpieza
-- Ejecutar en el servidor MySQL del VPS
-- IMPORTANTE: Hacer backup antes de ejecutar los DELETE
-- ============================================================

-- ============================================================
-- PARTE 1: VERIFICACIÓN DE ESTRUCTURA
-- ============================================================

-- 1.1 Verificar columnas dp y vp en acore_auth.account
SELECT 
  COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'acore_auth'
  AND TABLE_NAME = 'account'
  AND COLUMN_NAME IN ('dp', 'vp', 'email', 'expansion');

-- 1.2 Agregar columnas dp y vp si no existen (idempotente)
ALTER TABLE acore_auth.account
  ADD COLUMN IF NOT EXISTS dp INT NOT NULL DEFAULT 0 COMMENT 'Donation Points',
  ADD COLUMN IF NOT EXISTS vp INT NOT NULL DEFAULT 0 COMMENT 'Vote Points';

-- 1.3 Verificar que tu cuenta miikiis tiene rango 3
SELECT a.id, a.username, aa.SecurityLevel, aa.RealmID
FROM acore_auth.account a
LEFT JOIN acore_auth.account_access aa ON a.id = aa.AccountID
WHERE UPPER(a.username) = 'MIIKIIS';

-- 1.4 Asegurar rango 3 en todos los reinos (si no está)
DELETE FROM acore_auth.account_access WHERE AccountID = 171;
INSERT INTO acore_auth.account_access (AccountID, SecurityLevel, RealmID)
VALUES (171, 3, -1);

-- 1.5 Verificar puntos actuales de miikiis
SELECT id, username, dp, vp FROM acore_auth.account WHERE id = 171;

-- ============================================================
-- PARTE 2: VERIFICACIÓN DEL FORO
-- Tablas en acore_auth (forum_topics, forum_comments)
-- ============================================================

-- 2.1 Ver cuántos topics tienen autor huérfano (cuenta eliminada)
SELECT COUNT(*) AS topics_huerfanos
FROM acore_auth.forum_topics t
LEFT JOIN acore_auth.account a ON t.author_id = a.id
WHERE a.id IS NULL;

-- 2.2 Ver cuántos comments tienen autor huérfano
SELECT COUNT(*) AS comments_huerfanos
FROM acore_auth.forum_comments c
LEFT JOIN acore_auth.account a ON c.author_id = a.id
WHERE a.id IS NULL;

-- 2.3 Reasignar topics huérfanos al admin (ID 171)
UPDATE acore_auth.forum_topics t
LEFT JOIN acore_auth.account a ON t.author_id = a.id
SET t.author_id = 171
WHERE a.id IS NULL;

-- 2.4 Reasignar comments huérfanos al admin (ID 171)
UPDATE acore_auth.forum_comments c
LEFT JOIN acore_auth.account a ON c.author_id = a.id
SET c.author_id = 171
WHERE a.id IS NULL;

-- 2.5 Asegurar columna 'completed' en forum_topics
ALTER TABLE acore_auth.forum_topics
  ADD COLUMN IF NOT EXISTS completed TINYINT(1) NOT NULL DEFAULT 0 AFTER locked;

-- ============================================================
-- PARTE 3: LIMPIEZA DE PERSONAJES HUÉRFANOS EN acore_characters
-- (personajes de cuentas 1-110 que fueron eliminadas)
-- ============================================================

-- 3.1 Ver cuántos personajes quedan de cuentas eliminadas (1-110)
SELECT COUNT(*) AS personajes_huerfanos
FROM acore_characters.characters
WHERE account BETWEEN 1 AND 110
  AND account NOT IN (SELECT id FROM acore_auth.account);

-- 3.2 Ver los personajes afectados (SOLO LECTURA, no borra nada)
SELECT guid, name, race, class, level, account
FROM acore_characters.characters
WHERE account BETWEEN 1 AND 110
  AND account NOT IN (SELECT id FROM acore_auth.account)
ORDER BY level DESC;

-- 3.3 BORRAR personajes huérfanos (DESCOMENTA SOLO SI ESTÁS SEGURO)
-- ⚠️ ESTO ES IRREVERSIBLE - Verifica primero con 3.2 ⚠️
/*
-- Primero borramos datos asociados (inventario, skills, etc.)
DELETE FROM acore_characters.character_inventory
  WHERE guid IN (
    SELECT guid FROM acore_characters.characters
    WHERE account BETWEEN 1 AND 110
      AND account NOT IN (SELECT id FROM acore_auth.account)
  );

DELETE FROM acore_characters.character_skills
  WHERE guid IN (
    SELECT guid FROM acore_characters.characters
    WHERE account BETWEEN 1 AND 110
      AND account NOT IN (SELECT id FROM acore_auth.account)
  );

DELETE FROM acore_characters.item_instance
  WHERE owner_guid IN (
    SELECT guid FROM acore_characters.characters
    WHERE account BETWEEN 1 AND 110
      AND account NOT IN (SELECT id FROM acore_auth.account)
  );

-- Borrar mails de cuentas eliminadas
DELETE FROM acore_characters.mail
  WHERE sender IN (
    SELECT guid FROM acore_characters.characters
    WHERE account BETWEEN 1 AND 110
      AND account NOT IN (SELECT id FROM acore_auth.account)
  )
  OR receiver IN (
    SELECT guid FROM acore_characters.characters
    WHERE account BETWEEN 1 AND 110
      AND account NOT IN (SELECT id FROM acore_auth.account)
  );

-- Borrar guilds de cuentas eliminadas
DELETE FROM acore_characters.guild
  WHERE leaderguid IN (
    SELECT guid FROM acore_characters.characters
    WHERE account BETWEEN 1 AND 110
      AND account NOT IN (SELECT id FROM acore_auth.account)
  );

-- Finalmente borrar los personajes
DELETE FROM acore_characters.characters
  WHERE account BETWEEN 1 AND 110
    AND account NOT IN (SELECT id FROM acore_auth.account);
*/

-- ============================================================
-- PARTE 4: TIENDA - shop_items y shop_purchases
-- Tablas en acore_auth
-- ============================================================

-- 4.1 Verificar que las tablas de tienda existen
SHOW TABLES FROM acore_auth LIKE 'shop%';

-- 4.2 Crear tabla shop_items si no existe
CREATE TABLE IF NOT EXISTS acore_auth.shop_items (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  item_id         INT UNSIGNED  NOT NULL DEFAULT 0,
  name            VARCHAR(120)  NOT NULL DEFAULT '',
  image           VARCHAR(120)  NULL,
  price           INT UNSIGNED  NOT NULL DEFAULT 0,
  currency        ENUM('vp','dp') NOT NULL DEFAULT 'dp',
  quality         ENUM('pobre','comun','poco_comun','raro','epico','legendario') NOT NULL DEFAULT 'comun',
  category        VARCHAR(60)   NOT NULL DEFAULT 'misc',
  tier            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  class_mask      INT UNSIGNED  NOT NULL DEFAULT 0,
  soap_item_entry INT UNSIGNED  NULL,
  soap_item_count INT UNSIGNED  NOT NULL DEFAULT 1,
  service_type    ENUM('none','name_change','race_change','faction_change','level_boost','gold_pack','profession','character_transfer','bundle') NOT NULL DEFAULT 'none',
  service_data    TEXT          NULL,
  active          TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_category_tier (category, tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4.3 Crear tabla shop_purchases si no existe
CREATE TABLE IF NOT EXISTS acore_auth.shop_purchases (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id     INT UNSIGNED NOT NULL,
  item_id        INT UNSIGNED NOT NULL,
  item_name      VARCHAR(120) NOT NULL DEFAULT '',
  currency       ENUM('vp','dp') NOT NULL,
  price          INT UNSIGNED NOT NULL,
  character_guid INT UNSIGNED NULL,
  character_name VARCHAR(60)  NOT NULL DEFAULT '',
  is_gift        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_account_created (account_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PARTE 5: VERIFICACIÓN SOAP
-- ============================================================

-- 5.1 Verificar que miikiis tiene email configurado (necesario para SOAP)
SELECT id, username, email, expansion FROM acore_auth.account WHERE id = 171;

-- 5.2 Verificar cuenta de seguridad PIN
SELECT account_id FROM acore_auth.account_security_pin WHERE account_id = 171;

-- ============================================================
-- PARTE 6: RESUMEN FINAL
-- ============================================================
SELECT 
  (SELECT COUNT(*) FROM acore_auth.account) AS total_cuentas,
  (SELECT COUNT(*) FROM acore_characters.characters) AS total_personajes,
  (SELECT COUNT(*) FROM acore_auth.forum_topics) AS total_topics,
  (SELECT COUNT(*) FROM acore_auth.forum_comments) AS total_comentarios,
  (SELECT COUNT(*) FROM acore_auth.shop_items) AS total_items_tienda,
  (SELECT COUNT(*) FROM acore_auth.shop_purchases) AS total_compras;
