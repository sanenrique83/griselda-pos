-- Cierre de sesión automático por inactividad, configurable sin tocar código.
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS timeout_inactividad_minutos INTEGER NOT NULL DEFAULT 15;
