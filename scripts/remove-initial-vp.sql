-- ============================================================
-- Shadow Azeroth — Remover VP iniciales (migración anterior)
-- Ejecutar en: acore_auth
-- ============================================================
-- NOTA: Esto revierte los 10 VP que se asignaron con estelas-migration.sql
-- Solo afecta cuentas que aún tienen exactamente 10 VP
-- Cuentas que ganaron VP adicionales NO se ven afectadas
-- ============================================================

USE `acore_auth`;

-- Ver estado antes del cambio
SELECT
  COUNT(*) AS cuentas_con_10vp,
  SUM(vp) AS total_vp_a_remover
FROM account WHERE vp = 10;

-- Remover los 10 VP iniciales
UPDATE account SET vp = 0 WHERE vp = 10;

-- Verificar resultado
SELECT
  COUNT(*) AS total_cuentas,
  SUM(CASE WHEN vp = 0 THEN 1 ELSE 0 END) AS cuentas_con_0vp,
  SUM(CASE WHEN vp > 0 THEN 1 ELSE 0 END) AS cuentas_con_vp_positivo
FROM account;
