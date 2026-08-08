-- Imagen opcional por opción de modificador (ej. una foto por guisado en
-- Modo captura rápida / estilo 'cajas') — nullable a propósito: una opción
-- sin imagen propia cae en la foto/emoji del producto padre en vez de
-- quedar vacía (ver SheetCapturaPida.tsx / SheetModificadores.tsx). Mismo
-- mecanismo de subida que productos.foto_url (subirImagenProducto(), bucket
-- "productos") — no se duplica lógica de upload.
--
-- Nota: esta columna ya fue aplicada manualmente en la base real porque se
-- agregó por error a la migración 20260801000025 después de que esa
-- migración ya se había corrido (supabase CLI no reconsidera un archivo ya
-- marcado como aplicado). Esta migración documenta el estado real del
-- historial; IF NOT EXISTS la hace segura de correr aunque la columna ya
-- exista en producción.
ALTER TABLE opciones_modificador
  ADD COLUMN IF NOT EXISTS foto_url TEXT;
