-- Disponibilidad automática por horario (F9-04), independiente entre
-- producto y opción de modificador, y también independiente del toggle
-- manual productos.disponible ("Menú del día") y de turnos — se basa solo
-- en la hora de reloj. NULL en ambos campos de un mismo par = sin restricción.

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS horario_desde TIME,
  ADD COLUMN IF NOT EXISTS horario_hasta TIME;

ALTER TABLE opciones_modificador
  ADD COLUMN IF NOT EXISTS horario_desde TIME,
  ADD COLUMN IF NOT EXISTS horario_hasta TIME;
