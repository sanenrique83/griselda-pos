-- ============================================================
-- Nuevos valores de enum para venta de reventa (souvenirs) y ventas de
-- mostrador — EN SU PROPIA MIGRACIÓN, sin nada más.
--
-- ALTER TYPE ... ADD VALUE no puede usarse dentro de la misma transacción
-- en la que luego se USA ese valor (comparaciones, CHECK constraints,
-- casts explícitos, etc.) — Postgres exige que el commit de esta migración
-- ocurra primero. Cualquier función/constraint/policy que referencie
-- 'reventa' o 'mostrador' va en una migración posterior
-- (20260726000009_reventa_mostrador.sql).
-- ============================================================

ALTER TYPE modo_preparacion_receta ADD VALUE IF NOT EXISTS 'reventa';
ALTER TYPE tipo_pedido             ADD VALUE IF NOT EXISTS 'mostrador';
