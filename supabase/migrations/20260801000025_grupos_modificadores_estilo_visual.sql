-- Control real del estilo de visualización de un grupo de modificadores en
-- el sheet de personalización de producto (POS) — antes se inferían los
-- layouts por conteo de opciones; ahora el admin elige explícitamente entre
-- 'cajas' (grid de 4 columnas que envuelve), 'lista' (filas de ancho
-- completo) o 'chips' (píldoras compactas que envuelven, sin ícono de
-- check — el estado activo se marca con relleno de color) al crear/editar
-- el grupo en Catálogo.
ALTER TABLE grupos_modificadores
  ADD COLUMN IF NOT EXISTS estilo_visual TEXT NOT NULL DEFAULT 'cajas'
  CHECK (estilo_visual IN ('cajas', 'lista', 'chips'));
