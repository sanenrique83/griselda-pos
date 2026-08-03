-- Mesa fuera de servicio: no aparece como "libre" seleccionable para abrir
-- un pedido nuevo, pero tampoco cuenta como "ocupada" — se muestra con su
-- propio color/etiqueta distintiva (gris + 🔧), independiente del semáforo
-- de ocupación existente (ver lib/colorMesa.ts).
ALTER TABLE mesas
  ADD COLUMN IF NOT EXISTS fuera_de_servicio BOOLEAN NOT NULL DEFAULT false;
