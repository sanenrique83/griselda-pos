-- Documentación pura — sin cambio de comportamiento.
--
-- 20260223000002_rls_politicas.sql crea la política de INSERT de
-- `descuentos` con el nombre "descuentos_insert_admin". El nombre real en
-- producción es "descuentos_insert_perm" — se renombró en algún momento
-- fuera del historial de migraciones versionado (no hay ningún DROP/CREATE
-- POLICY posterior en el repo que lo explique). El WITH CHECK es idéntico
-- en ambos (es_admin() OR descuentos_mesero), así que no hay diferencia de
-- comportamiento, solo de nombre.
--
-- Se deja este COMMENT ON POLICY (no un simple comentario de archivo SQL)
-- para que quede consultable directamente en la base — si en el futuro
-- alguien escribe una migración nueva con `DROP POLICY "descuentos_insert_admin"`
-- basándose en el archivo original, fallará silenciosamente en el sentido
-- de "no existe ese nombre" — debe usar "descuentos_insert_perm".
COMMENT ON POLICY "descuentos_insert_perm" ON descuentos IS
    'Nombre real en producción. El archivo de migración original (20260223000002_rls_politicas.sql) la crea como "descuentos_insert_admin" — mismo WITH CHECK (es_admin() OR descuentos_mesero), solo el nombre difiere. No uses el nombre viejo en un DROP POLICY futuro.';
