-- ============================================================
-- Shadow Azeroth — Migración: Refactorización Sistema Donaciones
-- Fecha: 2026-03-26
-- Ejecutar en: acore_auth
-- ============================================================

-- ─── 1. PRECIOS DUALES en shop_items ────────────────────────
-- Cada item ahora tiene precio en ambas monedas (0 = no disponible en esa moneda)
ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS price_dp INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'Precio en Donaciones (DP). 0 = no disponible con DP',
  ADD COLUMN IF NOT EXISTS price_vp INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'Precio en Estelas (VP). 0 = no disponible con Estelas';

-- Migrar datos existentes del precio único a dual:
-- Si currency='dp', copiar price a price_dp
-- Si currency='vp', copiar price a price_vp
UPDATE shop_items SET price_dp = price WHERE currency = 'dp' AND price_dp = 0;
UPDATE shop_items SET price_vp = price WHERE currency = 'vp' AND price_vp = 0;

-- ─── 2. ACCEPT_GIFTS en account ─────────────────────────────
-- Modo Streamer: permite a usuarios desactivar recepción de regalos
ALTER TABLE account
  ADD COLUMN IF NOT EXISTS accept_gifts TINYINT(1) UNSIGNED NOT NULL DEFAULT 1
    COMMENT '1 = acepta regalos, 0 = modo streamer (sin regalos)';

-- ─── 3. TABLA PENDING_GIFTS (Escrow) ────────────────────────
-- Para regalos de servicios (Level Boost) que requieren confirmación
CREATE TABLE IF NOT EXISTS pending_gifts (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  donor_account   INT UNSIGNED     NOT NULL COMMENT 'Cuenta del donante que paga',
  recipient_account INT UNSIGNED   NOT NULL COMMENT 'Cuenta del destinatario',
  character_guid  INT UNSIGNED     NOT NULL COMMENT 'GUID del PJ destinatario',
  character_name  VARCHAR(60)      NOT NULL DEFAULT '',
  shop_item_id    INT UNSIGNED     NOT NULL COMMENT 'FK a shop_items.id',
  item_name       VARCHAR(120)     NOT NULL DEFAULT '',
  currency_used   ENUM('vp','dp')  NOT NULL DEFAULT 'dp',
  price_paid      INT UNSIGNED     NOT NULL DEFAULT 0,
  service_type    VARCHAR(50)      NOT NULL DEFAULT 'level_boost',
  service_data    TEXT             NULL,
  status          ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     TIMESTAMP        NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_donor       (donor_account),
  KEY idx_recipient   (recipient_account),
  KEY idx_status      (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Escrow: regalos pendientes de confirmación del destinatario';

-- ─── 4. Verificación ────────────────────────────────────────
SELECT 'shop_items schema' AS task,
       COUNT(*) AS items_with_dual_price
FROM shop_items WHERE price_dp > 0 OR price_vp > 0;

SELECT 'account schema' AS task,
       COUNT(*) AS accounts_with_gifts_flag
FROM account WHERE accept_gifts = 1;

-- ============================================================
-- NOTAS:
-- • price_dp / price_vp: si ambos > 0, el usuario elige moneda
-- • Si price_vp > 0 y elige VP → regalo bloqueado (Soulbound)
-- • accept_gifts = 0 → el usuario rechaza todos los regalos
-- • pending_gifts: solo para level_boost y servicios críticos
-- ============================================================
