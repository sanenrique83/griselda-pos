-- Permiso de Panel del turno (/mesas): sin este permiso, un mesero solo ve
-- Mesas ocupadas/Clientes/Tiempo promedio en el Panel del turno — Ticket
-- promedio y Cobro pendiente quedan ocultos hasta que Admin lo active desde
-- /mas/permisos. Admin siempre ve los 5 tiles, sin importar este valor.
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS panel_turno_mesero_financiero BOOLEAN NOT NULL DEFAULT false;
