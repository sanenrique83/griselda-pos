-- Cuántos modificadores caben por línea en los tickets impresos (cocina y
-- cliente) — ahorra espacio de papel cuando hay muchos modificadores.
-- 1 = comportamiento actual (uno por línea).
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS modificadores_por_linea INTEGER NOT NULL DEFAULT 1;
