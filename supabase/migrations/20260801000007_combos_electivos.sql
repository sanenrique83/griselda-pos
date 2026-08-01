-- ========================
-- COMBOS ELECTIVOS (F7-04)
-- El cliente elige una opción por "slot" (ej. Bebida a elegir), sin tocar el
-- modelo de combos fijos que ya funciona (combo_productos/combo_productos).
-- ========================

CREATE TABLE combo_slots (
    id        SERIAL PRIMARY KEY,
    combo_id  INTEGER NOT NULL REFERENCES productos(id),
    nombre    TEXT NOT NULL,
    requerido BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE combo_slot_opciones (
    id          SERIAL PRIMARY KEY,
    slot_id     INTEGER NOT NULL REFERENCES combo_slots(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id)
);

-- Formato: [{"slot_id": 3, "producto_id": 45}] — una entrada por slot con
-- selección; los slots sin selección (requerido=false, sin elegir) no
-- aparecen en el arreglo.
ALTER TABLE pedido_productos ADD COLUMN combo_selecciones JSONB;

-- RLS: mismo patrón catálogo que el resto de las tablas de producto/combo
-- (admin escribe, cualquier usuario autenticado lee) — ver combo_productos.
ALTER TABLE combo_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_slot_opciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "combo_slots_select_all" ON combo_slots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "combo_slots_admin_write" ON combo_slots FOR ALL USING (es_admin());

CREATE POLICY "combo_slot_opciones_select_all" ON combo_slot_opciones FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "combo_slot_opciones_admin_write" ON combo_slot_opciones FOR ALL USING (es_admin());

-- ========================
-- Consumo de inventario para combos electivos
--
-- aplicar_consumo_receta() ya recorre combo_productos (componentes fijos)
-- cuando el producto es un combo — eso sigue exactamente igual. Los slots
-- electivos no viven en aplicar_consumo_receta() porque esa función no
-- conoce el pedido_producto concreto que se está enviando/cancelando, solo
-- el producto_id — necesita combo_selecciones, que vive en la fila de
-- pedido_productos. Por eso el recorrido de combo_selecciones se agrega en
-- los 2 llamadores que ya traen esa fila completa: enviar_pedido_a_cocina()
-- y cancelar_item_enviado(). Misma mecánica que la recursión de combos
-- fijos (una llamada a aplicar_consumo_receta por elección), sin propagar
-- p_opcion_ids a esa sub-llamada — fuera de alcance en esta versión que el
-- producto elegido en un slot tenga a su vez sus propios modificadores.
-- ========================

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
        SET estado = 'enviado'
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

CREATE OR REPLACE FUNCTION cancelar_item_enviado(p_pedido_producto_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_usuario_id UUID := auth.uid();
    v_pp         RECORD;
    v_opcion_ids INTEGER[];
    v_seleccion  JSONB;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;

    SELECT id, producto_id, cantidad, estado, combo_selecciones
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

    SELECT ARRAY_AGG(opcion_id) INTO v_opcion_ids
    FROM pedido_producto_opciones
    WHERE pedido_producto_id = v_pp.id;

    PERFORM aplicar_consumo_receta(
        v_pp.producto_id, v_pp.cantidad::NUMERIC, 1,
        'reversion_cancelacion', 'pedido_producto', v_pp.id, v_usuario_id,
        v_opcion_ids
    );

    IF v_pp.combo_selecciones IS NOT NULL THEN
        FOR v_seleccion IN SELECT * FROM jsonb_array_elements(v_pp.combo_selecciones)
        LOOP
            PERFORM aplicar_consumo_receta(
                (v_seleccion->>'producto_id')::INTEGER, v_pp.cantidad::NUMERIC, 1,
                'reversion_cancelacion', 'pedido_producto', v_pp.id, v_usuario_id
            );
        END LOOP;
    END IF;
END;
$function$;
