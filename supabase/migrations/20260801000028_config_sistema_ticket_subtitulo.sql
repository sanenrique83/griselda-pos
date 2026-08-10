-- Subtítulo opcional del ticket impreso, en su propia línea de fuente
-- normal debajo del nombre del negocio (que se imprime en doble ancho) —
-- ej. "Fonda & Artesanías" debajo de "GRISELDA". Editable en
-- /mas/configuracion (TicketConfigShell), junto con el resto de campos
-- ticket_*. Nullable a propósito — sin subtítulo, esa línea simplemente no
-- se imprime.
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS ticket_subtitulo TEXT;
