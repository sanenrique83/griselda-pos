-- Control real del estilo de visualización de un grupo de modificadores en
-- el sheet de personalización de producto (POS) — antes se inferían 3
-- layouts por conteo de opciones; ahora el admin elige explícitamente entre
-- solo 2 ('cajas' = grid de 4 columnas que envuelve, 'lista' = filas de
-- ancho completo) al crear/editar el grupo en Catálogo.
ALTER TABLE grupos_modificadores
  ADD COLUMN IF NOT EXISTS estilo_visual TEXT NOT NULL DEFAULT 'cajas'
  CHECK (estilo_visual IN ('cajas', 'lista'));
