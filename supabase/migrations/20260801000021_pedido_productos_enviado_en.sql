-- Detalle por comensal en /pedidos (PedidosShell.tsx): cuándo se envió cada
-- línea a cocina, para mostrar "hace X min" junto a los ítems ya enviados.
ALTER TABLE pedido_productos
  ADD COLUMN IF NOT EXISTS enviado_en TIMESTAMPTZ;

-- Mismo UPDATE que ya hacía enviar_pedido_a_cocina() al marcar 'enviado' —
-- se agrega enviado_en = NOW() en el SET, el resto de la función queda
-- idéntico (copiado tal cual de la definición real en producción).
-- Nota: enviar_pendientes_de_subpedidos() (items nunca enviados a cocina,
-- reconciliados al cobrar) NO se toca a propósito — ahí enviado_en se queda
-- NULL, correctamente, porque esos ítems nunca pasaron por cocina.
CREATE OR REPLACE FUNCTION enviar_pedido_a_cocina(p_pedido_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_usuario_id UUID := auth.uid();
    v_item       RECORD;
    v_opcion_ids INTEGER[];
    v_seleccion  JSONB;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM subpedidos WHERE pedido_id = p_pedido_id) THEN
        RAISE EXCEPTION 'No hay comensales en este pedido.';
    END IF;

    FOR v_item IN
        UPDATE pedido_productos pp
        SET estado = 'enviado', enviado_en = NOW()
        FROM subpedidos s
        WHERE pp.subpedido_id = s.id
          AND s.pedido_id = p_pedido_id
          AND pp.estado = 'pendiente'
        RETURNING pp.id, pp.producto_id, pp.cantidad, pp.combo_selecciones
    LOOP
        SELECT ARRAY_AGG(opcion_id) INTO v_opcion_ids
        FROM pedido_producto_opciones
        WHERE pedido_producto_id = v_item.id;

        PERFORM aplicar_consumo_receta(
            v_item.producto_id, v_item.cantidad::NUMERIC, -1,
            'salida_venta', 'pedido_producto', v_item.id, v_usuario_id,
            v_opcion_ids
        );

        IF v_item.combo_selecciones IS NOT NULL THEN
            FOR v_seleccion IN SELECT * FROM jsonb_array_elements(v_item.combo_selecciones)
            LOOP
                PERFORM aplicar_consumo_receta(
                    (v_seleccion->>'producto_id')::INTEGER, v_item.cantidad::NUMERIC, -1,
                    'salida_venta', 'pedido_producto', v_item.id, v_usuario_id
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$function$;
