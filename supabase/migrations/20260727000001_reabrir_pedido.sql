-- Reabrir un pedido ya cobrado.
-- Solo Admin, y solo si el pedido pertenece al turno abierto actual.
--
-- Nota: pedido_productos.estado (estado_producto_pedido) NUNCA toma el valor
-- 'pagado' — ese enum solo tiene 'pendiente' | 'enviado' | 'cancelado'. Lo que
-- cobrarPedido marca como 'pagado' es subpedidos.estado. Por eso esta función
-- revierte subpedidos (no pedido_productos) de 'pagado' a 'activo'.
--
-- No toca el inventario ya descontado ni el estado de la mesa: se maneja
-- aparte si hace falta.

CREATE OR REPLACE FUNCTION reabrir_pedido(p_pedido_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_turno_id         INTEGER;
    v_turno_abierto_id INTEGER;
    v_movimiento_ids   INTEGER[];
BEGIN
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede reabrir un pedido.';
    END IF;

    SELECT id INTO v_turno_abierto_id FROM turnos WHERE estado = 'abierto' LIMIT 1;
    IF v_turno_abierto_id IS NULL THEN
        RAISE EXCEPTION 'No hay un turno activo.';
    END IF;

    SELECT turno_id INTO v_turno_id FROM pedidos WHERE id = p_pedido_id;
    IF v_turno_id IS NULL THEN
        RAISE EXCEPTION 'Pedido no encontrado.';
    END IF;

    IF v_turno_id != v_turno_abierto_id THEN
        RAISE EXCEPTION 'El pedido no pertenece al turno activo.';
    END IF;

    -- Movimientos de caja generados por cobros de este pedido
    SELECT ARRAY_AGG(DISTINCT cs.movimiento_id)
    INTO v_movimiento_ids
    FROM cobro_subpedidos cs
    JOIN subpedidos s ON s.id = cs.subpedido_id
    WHERE s.pedido_id = p_pedido_id;

    IF v_movimiento_ids IS NOT NULL THEN
        DELETE FROM pagos            WHERE movimiento_id = ANY(v_movimiento_ids);
        DELETE FROM cobro_subpedidos WHERE movimiento_id = ANY(v_movimiento_ids);
        DELETE FROM movimientos_caja WHERE id = ANY(v_movimiento_ids);
    END IF;

    -- Reactivar comensales ya cobrados
    UPDATE subpedidos
    SET estado = 'activo'
    WHERE pedido_id = p_pedido_id AND estado = 'pagado';

    -- Reabrir el pedido
    UPDATE pedidos
    SET estado = 'abierto', cerrado_en = NULL
    WHERE id = p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
