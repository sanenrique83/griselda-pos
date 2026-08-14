-- Preferencias personales de sonido/vibración por usuario (pantalla
-- "Preferencias", antes "Cambiar mi contraseña" — ver
-- frontend/src/app/(app)/preferencias). Cada mesero/admin las controla para
-- sí mismo, por eso viven en perfiles y no en config_sistema.
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS sonido_activado BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vibracion_activada BOOLEAN NOT NULL DEFAULT true;
