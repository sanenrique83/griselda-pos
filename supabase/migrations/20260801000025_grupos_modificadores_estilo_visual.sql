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

-- Imagen opcional por opción de modificador (ej. una foto por guisado en
-- Modo captura rápida / estilo 'cajas') — nullable a propósito: una opción
-- sin imagen propia cae en la foto/emoji del producto padre en vez de
-- quedar vacía (ver SheetCapturaPida.tsx / SheetModificadores.tsx). Mismo
-- mecanismo de subida que productos.foto_url (subirImagenProducto(), bucket
-- "productos") — no se duplica lógica de upload.
ALTER TABLE opciones_modificador
  ADD COLUMN IF NOT EXISTS foto_url TEXT;
