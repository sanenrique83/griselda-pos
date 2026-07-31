-- Documenta 8 columnas de config_sistema que ya existen en producción
-- (alimentan TicketConfigShell en /mas/configuracion) pero nunca tuvieron
-- migración ni estaban reflejadas en database.types.ts — ver auditoría de
-- 2026-07-31. Tipos y defaults tal como existen hoy en la base real
-- (introspección directa, information_schema.columns): las 8 son TEXT,
-- nullable, sin más restricciones.
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS ticket_nombre TEXT DEFAULT 'La Menuderia',
  ADD COLUMN IF NOT EXISTS ticket_direccion TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket_telefono TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket_rfc TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket_linea1 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket_linea2 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket_pie TEXT DEFAULT 'Gracias por su visita!',
  ADD COLUMN IF NOT EXISTS ticket_pie2 TEXT DEFAULT '';
