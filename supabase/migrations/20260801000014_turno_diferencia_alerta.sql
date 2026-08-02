-- Umbral configurable para la advertencia (no bloqueante) de diferencia de
-- efectivo al cerrar turno — si |efectivo contado - efectivo teórico| supera
-- este monto, la pantalla de cierre pide una segunda confirmación explícita
-- antes de proceder.
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS turno_diferencia_alerta_monto NUMERIC(10,2) NOT NULL DEFAULT 50;
