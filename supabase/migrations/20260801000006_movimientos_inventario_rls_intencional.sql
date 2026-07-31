-- ========================
-- Aclaración: movimientos_inventario sin policy de escritura (intencional)
-- ========================
--
-- Ver auditoría 2026-07-31 (severidad media, punto 6). La única policy de
-- movimientos_inventario es "movimientos_inv_select_all" (SELECT), definida
-- en 20260726000003_inventario.sql — NO le falta una de INSERT/UPDATE/DELETE,
-- nunca debe agregarse una policy de escritura directa aunque a primera
-- vista parezca un hueco.
--
-- Todas las escrituras a esta tabla pasan exclusivamente por funciones
-- SECURITY DEFINER que insertan el movimiento como parte de la misma
-- transacción que actualiza insumos.stock_actual:
--   - registrar_compra()          (20260726000003_inventario.sql)
--   - aplicar_consumo_receta()    (usada por enviar_pedido_a_cocina,
--                                  cancelar_item_enviado, enviar_pendientes_de_subpedidos)
--   - registrar_produccion()      (20260726000007_produccion_por_lote.sql)
--
-- Es intencional: un movimiento de inventario nunca debe insertarse suelto,
-- siempre como parte de la operación que lo origina (compra, consumo,
-- producción, reversión), para que stock_actual se mantenga consistente con
-- la suma de sus propios movimientos. Una policy de escritura directa
-- abriría un camino paralelo que podría desincronizar esa cuenta.
--
-- Esta migración no cambia ningún dato ni permiso — solo deja constancia
-- permanente (vía COMMENT, consultable con \d+ o information_schema)
-- de que la ausencia de policy de escritura es deliberada.

COMMENT ON TABLE movimientos_inventario IS
  'Escritura SOLO vía RPC SECURITY DEFINER (registrar_compra, aplicar_consumo_receta, registrar_produccion) — a propósito sin policy de RLS de INSERT/UPDATE/DELETE. No agregar una: ver 20260801000006_movimientos_inventario_rls_intencional.sql.';

COMMENT ON POLICY "movimientos_inv_select_all" ON movimientos_inventario IS
  'Única policy de esta tabla, a propósito — es de solo lectura porque toda escritura pasa por RPCs SECURITY DEFINER, nunca por INSERT/UPDATE/DELETE directo.';
