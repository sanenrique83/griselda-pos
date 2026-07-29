-- ========================
-- GRUPO_MODIFICADOR_PADRES
-- Generaliza grupos_modificadores.padre_opcion_id (una sola opción activadora)
-- a N opciones activadoras: el grupo se muestra si el cliente eligió CUALQUIERA
-- de ellas (OR, no requiere todas). Ver cargarModificadores() y grupoVisible()
-- en el frontend.
--
-- padre_opcion_id se deja sin usar a propósito — el código ya no la lee, pero
-- no se elimina la columna en esta migración (paso manual posterior, una vez
-- confirmado que grupo_modificador_padres cubre todos los casos existentes).
-- ========================

CREATE TABLE grupo_modificador_padres (
    id        SERIAL PRIMARY KEY,
    grupo_id  INTEGER NOT NULL REFERENCES grupos_modificadores(id),
    opcion_id INTEGER NOT NULL REFERENCES opciones_modificador(id),
    CONSTRAINT grupo_modificador_padre_unico UNIQUE (grupo_id, opcion_id)
);

ALTER TABLE grupo_modificador_padres ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que grupos_modificadores: cualquier autenticado lee (necesario
-- en el POS para resolver visibilidad), solo admin escribe (se edita en Catálogo).
CREATE POLICY "grupo_mod_padres_select_all"  ON grupo_modificador_padres FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "grupo_mod_padres_admin_write" ON grupo_modificador_padres FOR ALL    USING (es_admin());

-- Migrar los datos existentes de padre_opcion_id (1 opción por grupo) hacia
-- la nueva tabla (N opciones por grupo).
INSERT INTO grupo_modificador_padres (grupo_id, opcion_id)
SELECT id, padre_opcion_id
FROM grupos_modificadores
WHERE padre_opcion_id IS NOT NULL
ON CONFLICT (grupo_id, opcion_id) DO NOTHING;
