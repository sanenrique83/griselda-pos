-- productos nunca tuvo columna `orden` (a diferencia de areas, categorias,
-- grupos_modificadores y opciones_modificador, que sí la tienen desde el
-- esquema inicial). Las queries que hacían .order('orden') sobre productos
-- fallaban silenciosamente (PostgREST devuelve error de columna inexistente,
-- data queda null, el catálogo se ve vacío).
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;

-- Modo de orden del catálogo: alfabético (asc/desc) o el orden manual
-- (drag-and-drop) guardado en la columna `orden` de cada tabla.
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS orden_productos TEXT NOT NULL DEFAULT 'personalizado'
    CHECK (orden_productos IN ('alfabetico_asc', 'alfabetico_desc', 'personalizado')),
  ADD COLUMN IF NOT EXISTS orden_modificadores TEXT NOT NULL DEFAULT 'personalizado'
    CHECK (orden_modificadores IN ('alfabetico_asc', 'alfabetico_desc', 'personalizado'));
