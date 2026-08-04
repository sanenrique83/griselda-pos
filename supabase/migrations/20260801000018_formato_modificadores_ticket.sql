-- Tercera opción de formato de modificadores en el ticket impreso: frase en
-- español natural en vez de lista — ej. "Menudo Chico de Pedacito con Libro
-- y Pata". 'lista' y 'agrupado' son las dos que ya existen (gobernadas hoy
-- por config_sistema.modificadores_por_linea) — no se toca su comportamiento.
ALTER TABLE grupos_modificadores
  ADD COLUMN IF NOT EXISTS conector TEXT,
  ADD COLUMN IF NOT EXISTS prefijo_seleccion_unica TEXT;

ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS formato_modificadores_ticket TEXT NOT NULL DEFAULT 'agrupado'
    CHECK (formato_modificadores_ticket IN ('lista', 'agrupado', 'texto_natural'));
