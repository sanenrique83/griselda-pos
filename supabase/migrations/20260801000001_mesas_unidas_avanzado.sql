-- ========================
-- MESAS UNIDAS EN CADENA + ALERTA DE MESA SIN ATENDER
-- ========================

-- Posición de cada mesa satélite dentro de la cadena de un pedido (la mesa
-- principal, pedidos.mesa_id, es implícitamente la posición 1). Se usa para
-- calcular la geometría combinada de sillas (ver calcularPosicionesSillasCadena
-- en lib/asientos.ts) y para saber en qué orden se deben "cerrar el hueco" si
-- algún día se separa una mesa de en medio de la cadena.
ALTER TABLE pedido_mesas
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 1;

-- Alerta visual (semáforo rojo) cuando una mesa tiene pedido abierto pero
-- lleva N minutos sin que se le capture ni un producto (pendiente o enviado).
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS alerta_mesa_sin_atender BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS alerta_mesa_sin_atender_minutos INTEGER NOT NULL DEFAULT 10;
