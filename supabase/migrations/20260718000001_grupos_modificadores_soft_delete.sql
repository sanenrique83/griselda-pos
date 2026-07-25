-- Soft-delete para grupos_modificadores.
-- productos.activo y opciones_modificador.activa ya existían (schema inicial) y ya
-- se usan como soft-delete en las queries de venta. Falta la misma columna en
-- grupos_modificadores: sin ella, borrar un grupo después de "eliminar" (soft-delete)
-- todas sus opciones sigue fallando por la FK opciones_modificador.grupo_id
-- (las filas de opciones ya no se borran físicamente, solo se marcan activa=false).
ALTER TABLE grupos_modificadores
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
