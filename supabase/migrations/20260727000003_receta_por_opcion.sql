-- ============================================================
-- Recetas variables por opción de modificador.
--
-- Hasta ahora una receta vivía solo en el producto: receta_insumos no sabía
-- que "la carne de Tacos depende de Adobada/Bistec/Chicharrón", o que "el
-- tamaño de Menudo cambia la cantidad de carne". receta_insumos.opcion_id
-- resuelve esto: NULL = el insumo se consume siempre (como hasta ahora); un
-- valor = solo se consume si esa opción fue elegida en la línea del pedido.
-- No se distingue "reemplaza" de "agrega": si no hay fila base (opcion_id
-- NULL) para un insumo que varía por opción, no hay nada que reemplazar,
-- solo se suma lo que corresponda a la opción elegida.
-- ============================================================

ALTER TABLE receta_insumos
    ADD COLUMN opcion_id INTEGER REFERENCES opciones_modificador(id);

COMMENT ON COLUMN receta_insumos.opcion_id IS
    'NULL = insumo siempre se consume. Con valor: solo si esa opción fue elegida en pedido_producto_opciones. No hay "reemplaza": la ausencia de fila base para un insumo variable simplemente no consume nada hasta que se elige la opción.';

CREATE INDEX idx_receta_insumos_opcion ON receta_insumos(opcion_id);

-- ========================
-- aplicar_consumo_receta() — agrega p_opcion_ids al final (DEFAULT NULL) y
-- filtra receta_insumos por opcion_id IS NULL OR opcion_id = ANY(p_opcion_ids).
-- Se DROPea primero porque cambia la aridad de la función (no basta con
-- CREATE OR REPLACE al agregar un parámetro posicional intermedio a
-- reescribir por completo — se recrea entera para mayor claridad).
--
-- Cuando p_opcion_ids es NULL (default — así sigue llamándose la recursión
-- de combos fijos, sin cambios ahí), la condición "opcion_id = ANY(NULL)"
-- nunca es verdadera, así que solo se consumen los insumos base (opcion_id
-- IS NULL) — comportamiento idéntico al de antes de esta migración.
-- ========================

DROP FUNCTION IF EXISTS aplicar_consumo_receta(INTEGER, NUMERIC, NUMERIC, tipo_movimiento_inventario, TEXT, INTEGER, UUID);

CREATE OR REPLACE FUNCTION aplicar_consumo_receta(
    p_producto_id     INTEGER,
    p_cantidad_pedida NUMERIC,
    p_signo           NUMERIC,
    p_tipo            tipo_movimiento_inventario,
    p_referencia_tipo TEXT,
    p_referencia_id   INTEGER,
    p_usuario_id      UUID,
    p_opcion_ids      INTEGER[] DEFAULT NULL
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
        -- Combos fijos: la recursión NO propaga p_opcion_ids (los
        -- modificadores se eligen sobre la línea del combo, no sobre cada
        -- componente) — sin cambios respecto a antes de esta migración.
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

    IF v_receta.id IS NULL THEN
        RETURN; -- sin receta definida
    END IF;

    IF v_receta.modo_preparacion = 'por_lote' THEN
        -- Se descuenta del lote ya preparado, no de insumos crudos; las
        -- variantes por opción no aplican a este modo.
        UPDATE recetas
        SET porciones_disponibles = porciones_disponibles + p_signo * p_cantidad_pedida
        WHERE id = v_receta.id;
        RETURN;
    END IF;

    -- 'por_orden' / 'reventa': descuenta insumos crudos según receta_insumos,
    -- filtrando por la(s) opción(es) elegida(s) en la línea del pedido.
    FOR v_ri IN
        SELECT insumo_id, cantidad_usada
        FROM receta_insumos
        WHERE receta_id = v_receta.id
          AND (opcion_id IS NULL OR opcion_id = ANY(p_opcion_ids))
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
-- enviar_pedido_a_cocina() — ahora consulta las opciones elegidas de cada
-- línea (pedido_producto_opciones) y las pasa a aplicar_consumo_receta().
-- ========================

CREATE OR REPLACE FUNCTION enviar_pedido_a_cocina(p_pedido_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_usuario_id UUID := auth.uid();
    v_item       RECORD;
    v_opcion_ids INTEGER[];
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

-- ========================
-- cancelar_item_enviado() — misma consulta de opciones elegidas, para
-- revertir exactamente el consumo aplicado al enviar.
-- ========================

CREATE OR REPLACE FUNCTION cancelar_item_enviado(p_pedido_producto_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_usuario_id UUID := auth.uid();
    v_pp         RECORD;
    v_opcion_ids INTEGER[];
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

    SELECT ARRAY_AGG(opcion_id) INTO v_opcion_ids
    FROM pedido_producto_opciones
    WHERE pedido_producto_id = v_pp.id;

    PERFORM aplicar_consumo_receta(
        v_pp.producto_id, v_pp.cantidad::NUMERIC, 1,
        'reversion_cancelacion', 'pedido_producto', v_pp.id, v_usuario_id,
        v_opcion_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================
-- margen_productos() — se DROPea porque cambia el conjunto de columnas de
-- salida (margen_variable nuevo), lo cual CREATE OR REPLACE no permite.
--
-- Fix de correctness junto con el nuevo campo: costo_receta ahora suma solo
-- receta_insumos con opcion_id IS NULL (los que siempre se consumen). Antes
-- de esta migración sumaba TODAS las filas de receta_insumos sin distinción;
-- con variantes por opción eso sumaría alternativas mutuamente excluyentes
-- (ej. Adobada + Bistec + Chicharrón a la vez), inflando el costo. El costo
-- devuelto ahora es el "piso" de insumos fijos; margen_variable=TRUE avisa
-- que el número real depende de la opción elegida y no debe leerse como
-- exacto. Para combos, margen_variable se propaga si CUALQUIER componente
-- tiene receta variable.
-- ========================

DROP FUNCTION IF EXISTS margen_productos();

CREATE OR REPLACE FUNCTION margen_productos()
RETURNS TABLE (
    producto_id     INTEGER,
    nombre          TEXT,
    es_combo        BOOLEAN,
    precio          NUMERIC,
    costo           NUMERIC,
    costo_completo  BOOLEAN,
    margen          NUMERIC,
    margen_pct      NUMERIC,
    margen_variable BOOLEAN
)
LANGUAGE sql STABLE AS $$
    WITH costo_insumo AS (
        SELECT * FROM costo_insumos_actual()
    ),
    costo_receta AS (
        -- Costo de la receta propia de cada producto que tiene una, usando
        -- solo los insumos base (opcion_id IS NULL, se consumen siempre).
        SELECT
            r.producto_id,
            CASE
                WHEN COUNT(ri.id) FILTER (WHERE ci.costo_unitario IS NULL) > 0 THEN NULL
                ELSE COALESCE(SUM(ri.cantidad_usada * ci.costo_unitario), 0)
            END AS costo,
            COUNT(ri.id) FILTER (WHERE ci.costo_unitario IS NULL) = 0 AS completo,
            EXISTS (
                SELECT 1 FROM receta_insumos riv
                WHERE riv.receta_id = r.id AND riv.opcion_id IS NOT NULL
            ) AS margen_variable
        FROM recetas r
        LEFT JOIN receta_insumos ri ON ri.receta_id = r.id AND ri.opcion_id IS NULL
        LEFT JOIN costo_insumo ci   ON ci.insumo_id = ri.insumo_id
        GROUP BY r.producto_id, r.id
    ),
    costo_combo AS (
        -- Costo de un combo = suma de (costo de receta del componente × cantidad).
        SELECT
            cp.combo_id AS producto_id,
            CASE
                WHEN COUNT(cp.id) FILTER (WHERE cr.costo IS NULL) > 0 THEN NULL
                ELSE COALESCE(SUM(cr.costo * cp.cantidad), 0)
            END AS costo,
            COUNT(cp.id) FILTER (WHERE cr.costo IS NULL) = 0 AS completo,
            BOOL_OR(COALESCE(cr.margen_variable, FALSE)) AS margen_variable
        FROM combo_productos cp
        LEFT JOIN costo_receta cr ON cr.producto_id = cp.producto_id
        GROUP BY cp.combo_id
    )
    SELECT
        p.id,
        p.nombre,
        p.es_combo,
        p.precio,
        CASE WHEN p.es_combo THEN cc.costo ELSE cr.costo END,
        COALESCE(CASE WHEN p.es_combo THEN cc.completo ELSE cr.completo END, FALSE),
        CASE
            WHEN p.es_combo THEN CASE WHEN cc.costo IS NULL THEN NULL ELSE p.precio - cc.costo END
            ELSE CASE WHEN cr.costo IS NULL THEN NULL ELSE p.precio - cr.costo END
        END,
        CASE
            WHEN p.precio = 0 THEN NULL
            WHEN p.es_combo THEN CASE WHEN cc.costo IS NULL THEN NULL ELSE ((p.precio - cc.costo) / p.precio) * 100 END
            ELSE CASE WHEN cr.costo IS NULL THEN NULL ELSE ((p.precio - cr.costo) / p.precio) * 100 END
        END,
        CASE WHEN p.es_combo THEN COALESCE(cc.margen_variable, FALSE) ELSE COALESCE(cr.margen_variable, FALSE) END
    FROM productos p
    LEFT JOIN costo_receta cr ON cr.producto_id = p.id
    LEFT JOIN costo_combo  cc ON cc.producto_id = p.id
    WHERE p.activo = TRUE
    ORDER BY p.nombre
$$;
