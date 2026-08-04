-- PIN rápido para cambiar de usuario sin cerrar sesión completa
-- (/cambiar-usuario). pin_hash nunca se expone vía RLS a ningún cliente —
-- solo se lee/escribe desde Server Actions vía el cliente admin
-- (service_role, ver lib/supabase/admin.ts), sin tocar las políticas de
-- perfiles. Intentos fallidos/bloqueo se guardan en BD (no en memoria) para
-- que el conteo sobreviva entre invocaciones serverless.
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_bloqueado_hasta TIMESTAMPTZ;
