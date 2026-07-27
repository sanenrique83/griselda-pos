-- ============================================================
-- Consumo de inventario al enviar a cocina / cancelar ítem.
--
-- recetas.modo_preparacion distingue:
--   'por_orden' — se prepara al momento del pedido; consume insumos crudos
--                 directamente vía receta_insumos (lo que hace esta migración).
--   'por_lote'  — se prepara en tandas y se vende de un lote ya hecho; el
--                 descuento aquí es sobre recetas.porciones_disponibles, no
--                 sobre insumos crudos — se implementa en Fase F. Por ahora
--                 estos productos NO tocan inventario al enviarse a cocina.
--
-- Todas las recetas ya existentes (Fase D) quedan 'por_orden' por default.
-- ============================================================

CREATE TYPE modo_preparacion_receta AS ENUM ('por_orden', 'por_lote');

ALTER TABLE recetas
    ADD COLUMN modo_preparacion modo_preparacion_receta NOT NULL DEFAULT 'por_orden';

-- ========================
-- aplicar_consumo_receta()
-- Aplica (o revierte) el consumo de insumos de un producto al enviarlo a
-- cocina / cancelarlo. Si el producto es combo, recorre sus combo_productos
-- y se llama a sí misma por cada componente, multiplicando la cantidad del
-- componente por la cantidad pedida del combo — respeta el modo_preparacion
-- propio de cada componente. Un producto normal sin receta, o con receta
-- 'por_lote', no genera movimiento aquí (silenciosamente, no es un error).
--
-- p_signo: -1 = sale de inventario (venta), +1 = regresa (reversión de
-- cancelación) — igual que el signo de movimientos_inventario.cantidad.
-- ========================

CREATE OR REPLACE FUNCTION aplicar_consumo_receta(
    p_producto_id     INTEGER,
    p_cantidad_pedida NUMERIC,
    p_signo           NUMERIC,
    p_tipo            tipo_movimiento_inventario,
    p_referencia_tipo TEXT,
    p_referencia_id   INTEGER,
    p_usuario_id      UUID
)
RETURNS VOID AS $$
DECLARE
    v_es_combo BOOLEAN;
    v_receta   RECORD;
    v_ri       RECORD;
    v_comp     RECORD;
BEGIN
    SELECT es_combo INTO v_es_combo FROM productos WHERE id = p_producto_id;
    IF v_es_combo IS NULL THEN
        RETURN; -- producto no encontrado: nada que hacer
    END IF;

    IF v_es_combo THEN
        FOR v_comp IN
            SELECT producto_id, cantidad
            FROM combo_productos
            WHERE combo_id = p_producto_id
        LOOP
            PERFORM aplicar_consumo_receta(
                v_comp.producto_id,
                p_cantidad_pedida * v_comp.cantidad,
                p_signo, p_tipo, p_referencia_tipo, p_referencia_id, p_usuario_id
            );
        END LOOP;
        RETURN;
    END IF;

    SELECT id, modo_preparacion INTO v_receta
    FROM recetas
    WHERE producto_id = p_producto_id;

    IF v_receta.id IS NULL OR v_receta.modo_preparacion <> 'por_orden' THEN
        RETURN; -- sin receta definida, o 'por_lote' (Fase F)
    END IF;

    FOR v_ri IN
        SELECT insumo_id, cantidad_usada
        FROM receta_insumos
        WHERE receta_id = v_receta.id
    LOOP
        INSERT INTO movimientos_inventario
            (insumo_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id)
        VALUES (
            v_ri.insumo_id, p_tipo,
            p_signo * v_ri.cantidad_usada * p_cantidad_pedida,
            p_referencia_tipo, p_referencia_id, p_usuario_id
        );

        UPDATE insumos
        SET stock_actual = stock_actual + p_signo * v_ri.cantidad_usada * p_cantidad_pedida
        WHERE id = v_ri.insumo_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================
-- enviar_pedido_a_cocina()
-- Marca 'enviado' solo los pedido_productos que seguían 'pendiente' y
-- descuenta su inventario en la misma transacción — atómico con el cambio
-- de estado. Llamar de nuevo con ítems ya enviados no los vuelve a
-- descontar (el UPDATE solo toca los que aún estaban 'pendiente').
-- ========================

CREATE OR REPLACE FUNCTION enviar_pedido_a_cocina(p_pedido_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_usuario_id UUID := auth.uid();
    v_item       RECORD;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM subpedidos WHERE pedido_id = p_pedido_id) THEN
        RAISE EXCEPTION 'No hay comensales en este pedido.';
    END IF;

    FOR v_item IN
        UPDATE pedido_productos pp
        SET estado = 'enviado'
        FROM subpedidos s
        WHERE pp.subpedido_id = s.id
          AND s.pedido_id = p_pedido_id
          AND pp.estado = 'pendiente'
        RETURNING pp.id, pp.producto_id, pp.cantidad
    LOOP
        PERFORM aplicar_consumo_receta(
            v_item.producto_id, v_item.cantidad::NUMERIC, -1,
            'salida_venta', 'pedido_producto', v_item.id, v_usuario_id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================
-- cancelar_item_enviado()
-- Marca 'cancelado' un pedido_producto que estaba 'enviado' y revierte su
-- consumo de inventario en la misma transacción. Rechaza ítems que no
-- estén 'enviado' (ya cancelados, o aún 'pendiente' — esos usan
-- eliminarProductoPendiente() en su lugar, sin tocar inventario).
-- ========================

CREATE OR REPLACE FUNCTION cancelar_item_enviado(p_pedido_producto_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_usuario_id UUID := auth.uid();
    v_pp         RECORD;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;

    SELECT id, producto_id, cantidad, estado
    INTO v_pp
    FROM pedido_productos
    WHERE id = p_pedido_producto_id
    FOR UPDATE;

    IF v_pp.id IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado.';
    END IF;

    IF v_pp.estado <> 'enviado' THEN
        RAISE EXCEPTION 'Este ítem no está enviado a cocina.';
    END IF;

    UPDATE pedido_productos SET estado = 'cancelado' WHERE id = p_pedido_producto_id;

    PERFORM aplicar_consumo_receta(
        v_pp.producto_id, v_pp.cantidad::NUMERIC, 1,
        'reversion_cancelacion', 'pedido_producto', v_pp.id, v_usuario_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
