-- Extiende reabrir_pedido() (F7-02) para el modelo persistente de "unir
-- mesas" (pedido_mesas, ver 20260728000003_pedido_mesas.sql):
--   1. Al reabrir, vuelve a ocupar la mesa principal Y todas las mesas
--      satélite del pedido (pedido_mesas), no solo la principal.
--   2. El chequeo de conflicto de mesa ya ocupada revisa también si alguna
--      de esas mesas (principal o satélite) quedó ligada mientras tanto a
--      OTRO pedido abierto, ya sea como su mesa principal o como su satélite.
--
-- Nota: liberarMesasSatelite() (cobro/[pedidoId]/actions.ts) NO borra la fila
-- de pedido_mesas de una mesa normal al liberarla — solo pone mesas.estado
-- de vuelta a 'libre'. Por eso esta función todavía puede encontrar esas
-- filas para saber qué mesas satélite tenía el pedido antes de cerrarse.

CREATE OR REPLACE FUNCTION reabrir_pedido(p_pedido_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_turno_id         INTEGER;
    v_turno_abierto_id INTEGER;
    v_mesa_id          INTEGER;
    v_mesa_ids         INTEGER[];
    v_otro_pedido_id   INTEGER;
    v_movimiento_ids   INTEGER[];
BEGIN
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede reabrir un pedido.';
    END IF;

    SELECT id INTO v_turno_abierto_id FROM turnos WHERE estado = 'abierto' LIMIT 1;
    IF v_turno_abierto_id IS NULL THEN
        RAISE EXCEPTION 'No hay un turno activo.';
    END IF;

    SELECT turno_id, mesa_id INTO v_turno_id, v_mesa_id FROM pedidos WHERE id = p_pedido_id;
    IF v_turno_id IS NULL THEN
        RAISE EXCEPTION 'Pedido no encontrado.';
    END IF;

    IF v_turno_id != v_turno_abierto_id THEN
        RAISE EXCEPTION 'El pedido no pertenece al turno activo.';
    END IF;

    -- Mesa principal + mesas satélite (unión persistente) de este pedido.
    SELECT ARRAY(
        SELECT DISTINCT mesa_id FROM (
            SELECT v_mesa_id AS mesa_id
            UNION ALL
            SELECT pm.mesa_id FROM pedido_mesas pm WHERE pm.pedido_id = p_pedido_id
        ) todas
        WHERE mesa_id IS NOT NULL
    ) INTO v_mesa_ids;

    -- Si alguna de esas mesas ya quedó ligada a OTRO pedido abierto mientras
    -- este estaba cerrado (como su mesa principal o como su satélite), no se
    -- puede reabrir ciegamente sin terminar con dos pedidos sobre la misma mesa.
    IF array_length(v_mesa_ids, 1) > 0 THEN
        SELECT p.id INTO v_otro_pedido_id
        FROM pedidos p
        WHERE p.estado = 'abierto' AND p.id != p_pedido_id AND p.mesa_id = ANY(v_mesa_ids)
        LIMIT 1;

        IF v_otro_pedido_id IS NULL THEN
            SELECT pm2.pedido_id INTO v_otro_pedido_id
            FROM pedido_mesas pm2
            JOIN pedidos p2 ON p2.id = pm2.pedido_id
            WHERE p2.estado = 'abierto' AND pm2.pedido_id != p_pedido_id AND pm2.mesa_id = ANY(v_mesa_ids)
            LIMIT 1;
        END IF;

        IF v_otro_pedido_id IS NOT NULL THEN
            RAISE EXCEPTION 'Una de las mesas de este pedido ya tiene otro pedido activo, no se puede reabrir.';
        END IF;
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

    -- Devolver todas las mesas (principal + satélite) a ocupada.
    IF array_length(v_mesa_ids, 1) > 0 THEN
        UPDATE mesas SET estado = 'ocupada' WHERE id = ANY(v_mesa_ids);
    END IF;

    -- Reabrir el pedido
    UPDATE pedidos
    SET estado = 'abierto', cerrado_en = NULL
    WHERE id = p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
