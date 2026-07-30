-- Sub-pestañas para Inventario → Insumos, definidas por el usuario (ej.
-- "Carnes", "Guisados") — mismo propósito que categorias para Productos,
-- pero sin soft-delete (activa): el borrado aquí es definitivo, ver abajo.
CREATE TABLE tipos_insumo (
    id     SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    orden  INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE tipos_insumo ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que el resto de Catálogo/Inventario: todos leen, solo admin escribe.
CREATE POLICY "tipos_insumo_select_all"  ON tipos_insumo FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "tipos_insumo_admin_write" ON tipos_insumo FOR ALL    USING (es_admin());

-- Nullable a propósito: clasificar insumos existentes es opcional, no
-- inmediato — los que no se clasifiquen caen en "Sin clasificar" en el
-- frontend. ON DELETE SET NULL: si se borra un tipo, sus insumos vuelven a
-- "sin clasificar" en vez de bloquear el borrado o arrastrarlos con él.
ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS tipo_insumo_id INTEGER REFERENCES tipos_insumo(id) ON DELETE SET NULL;
