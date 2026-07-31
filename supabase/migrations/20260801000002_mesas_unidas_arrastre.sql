-- ========================
-- UNIÓN DE MESAS POR ARRASTRE + REACOMODO VISUAL
-- ========================

-- Posición/rotación de una mesa satélite ANTES de moverla visualmente para
-- que quede pegada a la mesa principal (arrastre imantado en
-- /mas/mapa-mesas). Solo se llenan para mesas normales (temporal = false) —
-- las temporales se borran por completo al cobrar (liberarMesasSatelite), así
-- que no tienen "posición original" a la que regresar.
--
-- Al cobrar el pedido (o anularlo), la mesa se regresa a esta posición antes
-- de que se libere (ver liberarMesasSatelite en cobro/[pedidoId]/actions.ts).
-- La fila de pedido_mesas NO se borra en ese momento (se conserva como
-- registro histórico para reabrir_pedido, igual que antes de este cambio),
-- así que estas columnas quedan disponibles pero sin efecto una vez que la
-- mesa ya volvió a su lugar.
ALTER TABLE pedido_mesas
  ADD COLUMN IF NOT EXISTS pos_x_original INTEGER,
  ADD COLUMN IF NOT EXISTS pos_y_original INTEGER,
  ADD COLUMN IF NOT EXISTS rotacion_original INTEGER;
