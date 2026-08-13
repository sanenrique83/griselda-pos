-- Permiso "Cobrar solo admin" (/mas/permisos): con esta columna en true, un
-- mesero puede seguir abriendo /cobro/[pedidoId], ver el total, aplicar
-- descuento e imprimir precuenta — solo el botón final "Cobrar $X" queda
-- restringido a admin (ver CobroShell.tsx). Default false = comportamiento
-- de hoy, sin cambio hasta que se active a propósito.
--
-- Nota de diseño: esta columna es un puente hacia un futuro rol "Cajero"
-- real (sistema de permisos por rol, todavía no construido) — cuando exista,
-- la fuente de la verificación en CobroShell.tsx/actions.ts debe migrar de
-- este booleano a esa tabla de permisos, sin mover el PUNTO donde se
-- verifica (ver comentario ahí).
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS cobro_solo_admin BOOLEAN NOT NULL DEFAULT false;
