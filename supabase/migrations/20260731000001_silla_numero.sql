-- Silla física en la que se sentó cada comensal — solo el número, nunca
-- coordenadas: la posición visual de cada silla se calcula en el frontend a
-- partir de mesas.capacidad/forma/tamano/rotacion, que ya existen.
ALTER TABLE subpedidos
  ADD COLUMN IF NOT EXISTS silla_numero INTEGER;

-- Sentido en que se numeran las sillas alrededor de la mesa (silla 1 fija,
-- el resto en sentido horario si es TRUE, antihorario si es FALSE).
ALTER TABLE mesas
  ADD COLUMN IF NOT EXISTS asientos_horario BOOLEAN NOT NULL DEFAULT TRUE;
