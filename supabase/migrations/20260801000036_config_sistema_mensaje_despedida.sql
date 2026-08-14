-- Mensaje de despedida mostrado brevemente en pantalla al cerrar sesión
-- (distinto de ticket_pie, que es el pie del ticket IMPRESO — no confundir).
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS mensaje_despedida TEXT NOT NULL
    DEFAULT '¡Gracias por tu trabajo hoy! Nos vemos pronto.';
