-- Catálogo global de ingredientes para controlar disponibilidad en opciones de modificador

CREATE TABLE IF NOT EXISTS ingredientes (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  disponible BOOLEAN NOT NULL DEFAULT true,
  creado_en  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE ingredientes IS
  'Ingredientes globales del negocio. Se vinculan a opciones_modificador para controlar disponibilidad desde un único lugar.';

ALTER TABLE opciones_modificador
  ADD COLUMN IF NOT EXISTS ingrediente_id INT REFERENCES ingredientes(id) ON DELETE SET NULL;

COMMENT ON COLUMN opciones_modificador.ingrediente_id IS
  'Ingrediente asociado a esta opción. Si el ingrediente está no disponible, la opción se oculta en el POS.';
