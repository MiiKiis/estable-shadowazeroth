-- ============================================================
-- Shadow Azeroth — Migración: Sistema de Estelas (VP Refactor)
-- Fecha: 2026-03-26
-- ============================================================
-- Ejecutar en la base de datos: auth (acore_auth)
-- ============================================================

-- 1. Dar 10 Estelas iniciales a todas las cuentas existentes
--    que actualmente tengan 0 VP (VP = Estelas en la DB)
UPDATE account
SET vp = 10
WHERE vp = 0 OR vp IS NULL;

-- 2. Crear tabla de log de intercambios DP -> Estelas
--    (el API la crea automáticamente, pero aquí la dejamos explícita)
CREATE TABLE IF NOT EXISTS estelas_exchange_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id INT UNSIGNED NOT NULL,
  dp_spent INT UNSIGNED NOT NULL,
  estelas_received INT UNSIGNED NOT NULL,
  rate INT UNSIGNED NOT NULL DEFAULT 10,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_account (account_id),
  CONSTRAINT fk_exchange_account FOREIGN KEY (account_id)
    REFERENCES account (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Log de intercambios DP->Estelas';

-- 3. Verificar resultados
SELECT
  COUNT(*) AS total_cuentas,
  SUM(vp) AS total_estelas_distribuidas,
  MIN(vp) AS min_estelas,
  MAX(vp) AS max_estelas,
  AVG(vp) AS promedio_estelas
FROM account;

-- ============================================================
-- NOTAS IMPORTANTES:
-- • vp (Vote Points) en la DB = "Estelas" en la UI
-- • Las Estelas son SOULBOUND: no se pueden regalar/transferir
-- • DP se pueden transferir para regalos e ítems para otros
-- • Tasa de cambio: 1 DP = 10 Estelas (configurable en API)
-- • El registro requiere 10 DP + 10 Estelas iniciales
-- ============================================================
