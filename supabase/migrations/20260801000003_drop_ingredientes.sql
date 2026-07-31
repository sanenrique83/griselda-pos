-- ========================
-- DROP de `ingredientes` (paso manual pendiente desde
-- 20260727000004_unificar_insumos_ingredientes.sql)
-- ========================
--
-- `ingredientes` quedó completamente reemplazada por `insumos` desde esa
-- migración, que dejó la tabla vieja intacta "como respaldo" con el DROP
-- pendiente de un paso manual, una vez confirmada la migración de datos.
--
-- Verificado por introspección directa de la base real antes de escribir
-- este archivo:
--   - Las 60 filas de `ingredientes` tienen equivalente en `insumos` por
--     LOWER(TRIM(nombre)) — cero filas sin matchear.
--   - Las 182 filas de `opciones_modificador` que todavía traen
--     `ingrediente_id` ya tienen `insumo_id` lleno (la migración de datos se
--     completó correctamente en su momento) — cero filas huérfanas.
--   - `opciones_modificador.ingrediente_id` es la única FK en todo el
--     esquema que apunta a `ingredientes`.
--   - El frontend ya no consulta la tabla `ingredientes` en ningún lado
--     (Catálogo → "Ingredientes" lee de `insumos` desde esa misma
--     migración, solo se conservó el nombre en la UI).
--
-- `ingredientes` era además la única tabla de todo `public` con RLS
-- deshabilitado (nunca se le habilitó en su migración de creación) — este
-- DROP cierra ese hueco de seguridad de raíz, en vez de solo taparlo
-- agregándole RLS a una tabla que ya no se usa.

ALTER TABLE opciones_modificador
  DROP COLUMN IF EXISTS ingrediente_id;

DROP TABLE IF EXISTS ingredientes;
