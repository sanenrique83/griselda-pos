-- ============================================================
-- enviar_pendientes_de_subpedidos() — descuenta inventario de ítems que
-- nunca pasaron por "Enviar a cocina" antes de cobrarlos.
--
-- Hueco encontrado: cobrarPedido() marca subpedidos.estado='pagado' pero
-- nunca revisaba si sus pedido_productos seguían en 'pendiente' (flujo real
-- del negocio: ítems simples se comunican de viva voz, sin pasar por
-- "Enviar"). Como aplicar_consumo_receta() solo se disparaba desde
-- enviar_pedido_a_cocina(), esos ítems se cobraban y el pedido se cerraba
-- sin descontar nunca su inventario.
--
-- Mismo cuerpo que enviar_pedido_a_cocina() (UPDATE...RETURNING + resolver
-- p_opcion_ids desde pedido_producto_opciones + aplicar_consumo_receta()),
-- pero acotada a una lista de subpedido_id en vez de a todo el pedido — para
-- no descontar/marcar pendientes de subpedidos que no se están cobrando
-- ahora mismo ("Uno paga varios" cobra solo una parte de los comensales).
-- Por eso no se reutiliza enviar_pedido_a_cocina(pedidoId) tal cual.
--
-- Se llama desde cobrarPedido() (frontend) justo antes de marcar
-- subpedidos.estado='pagado'.
--
-- Segura de llamar sin pendientes: el UPDATE solo toca filas en 'pendiente'
-- — si todos los ítems de esos subpedidos ya estaban 'enviado' (el caso de
-- todos los días, cuando sí se manda todo a cocina antes de cobrar), la
-- consulta RETURNING no regresa filas, el loop no itera, y la función
-- retorna sin error ni efecto alguno. No requiere que existan comensales ni
-- pendientes — a diferencia de enviar_pedido_a_cocina(), aquí no hace falta
-- ese chequeo porque cobrarPedido() ya validó que esos subpedido_id existen.
-- ============================================================

CREATE OR REPLACE FUNCTION enviar_pendientes_de_subpedidos(p_subpedido_ids INTEGER[])
RETURNS VOID AS $$
DECLARE
    v_usuario_id UUID := auth.uid();
    v_item       RECORD;
    v_opcion_ids INTEGER[];
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;

    FOR v_item IN
        UPDATE pedido_productos pp
        SET estado = 'enviado'
        WHERE pp.subpedido_id = ANY(p_subpedido_ids)
          AND pp.estado = 'pendiente'
        RETURNING pp.id, pp.producto_id, pp.cantidad
    LOOP
        SELECT ARRAY_AGG(opcion_id) INTO v_opcion_ids
        FROM pedido_producto_opciones
        WHERE pedido_producto_id = v_item.id;

        PERFORM aplicar_consumo_receta(
            v_item.producto_id, v_item.cantidad::NUMERIC, -1,
            'salida_venta', 'pedido_producto', v_item.id, v_usuario_id,
            v_opcion_ids
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
