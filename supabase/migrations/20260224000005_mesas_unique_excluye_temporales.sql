-- Corrige el índice único de mesas para:
--   1. Excluir mesas temporales (creadas por "Compartir mesa") de la restricción.
--   2. Excluir mesas inactivas (soft-delete) de la restricción.
--
-- Resultado: solo las mesas no-temporales y activas compiten por (area_id, numero).
-- Las mesas temporales pueden reutilizar cualquier número sin conflicto.

-- Eliminar el índice anterior (si existe, de la migración 20260224000004)
DROP INDEX IF EXISTS mesas_area_numero_activa_idx;

-- Eliminar también la restricción inline original por si no se aplicó 000004
ALTER TABLE mesas DROP CONSTRAINT IF EXISTS mesas_numero_key;

-- Crear el índice correcto: activas + NO temporales
CREATE UNIQUE INDEX mesas_area_numero_activa_idx
  ON mesas(area_id, numero)
  WHERE activa = true AND temporal = false;
