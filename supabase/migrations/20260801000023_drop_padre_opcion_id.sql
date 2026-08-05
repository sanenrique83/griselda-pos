-- Elimina grupos_modificadores.padre_opcion_id, deprecada desde
-- 20260728000005_grupo_modificador_padres.sql (reemplazada por la tabla
-- grupo_modificador_padres). Su FK (fk_padre_opcion) causó ambigüedad de
-- embed PostgREST (PGRST201) entre opciones_modificador y
-- grupos_modificadores; el DROP la tumba junto con la columna.
--
-- Verificado contra la base real antes de escribir este DROP: 0 filas con
-- padre_opcion_id IS NOT NULL sin su equivalente en grupo_modificador_padres
-- (de hecho 0 filas con el valor viejo poblado; los 145 registros ya viven
-- en la tabla nueva).

ALTER TABLE grupos_modificadores DROP COLUMN padre_opcion_id;
