-- Reemplaza la restricción UNIQUE global en numero por un índice único
-- parcial en (area_id, numero) que solo aplica a mesas activas.
--
-- Esto permite reutilizar números cuando una mesa fue eliminada (activa = false)
-- y permite el mismo número en distintas áreas (ej. Mesa 1 en Interior y Terraza).

-- 1. Eliminar la restricción inline original
ALTER TABLE mesas DROP CONSTRAINT IF EXISTS mesas_numero_key;

-- 2. Crear índice único parcial: solo mesas activas, por área
CREATE UNIQUE INDEX IF NOT EXISTS mesas_area_numero_activa_idx
  ON mesas(area_id, numero)
  WHERE activa = true;
