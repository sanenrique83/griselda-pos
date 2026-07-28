-- ============================================================
-- PASO D — aplicar_consumo_receta() vía opciones_modificador.insumo_id.
--
-- Cierra el rediseño de recetas de dos niveles. Antes (20260727000003)
-- filtraba receta_insumos por una columna opcion_id que ya no existe
-- (retirada en 20260727000007, Paso C). Ahora la función misma resuelve,
-- para el producto que se está consumiendo:
--   - v_insumos_opcion:   insumo_id de TODAS las opciones de modificador de
--                         este producto — son los insumos "variables"
--                         (alternativas mutuamente excluyentes entre sí,
--                         ej. Adobada/Bistec/Chicharrón).
--   - v_insumos_elegidos: insumo_id de las opciones que de verdad fueron
--                         elegidas en esta línea del pedido (p_opcion_ids,
--                         igual que antes — viene de pedido_producto_opciones
--                         vía enviar_pedido_a_cocina()/cancelar_item_enviado(),
--                         SIN CAMBIOS en esas dos funciones).
-- Una fila de receta_insumos se consume si su insumo_id NO está en
-- v_insumos_opcion (insumo "de siempre"), o SÍ está en v_insumos_elegidos
-- (la opción variable que realmente se pidió). El insumo puede ser
-- 'comprado' o 'derivado' (Paso B) — da igual aquí, solo se descuenta
-- stock_actual como siempre; la reposición de un derivado es cosa de su
-- propio historial de producción.
--
-- Firma sin cambios (p_opcion_ids sigue ahí, mismo significado desde el
-- llamador) — no hace falta DROP, un CREATE OR REPLACE basta. modo 'por_lote'
-- y recursión de combos fijos: sin cambios de fondo.
--
-- Requiere que 20260727000007_receta_insumos_simplificar.sql (Paso C) ya
-- haya quitado receta_insumos.opcion_id — aplicar ambas juntas.
-- ============================================================

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
    v_es_combo         BOOLEAN;
    v_receta           RECORD;
    v_ri               RECORD;
    v_comp             RECORD;
    v_insumos_opcion   INTEGER[];
    v_insumos_elegidos INTEGER[];
BEGIN
    SELECT es_combo INTO v_es_combo FROM productos WHERE id = p_producto_id;
    IF v_es_combo IS NULL THEN
        RETURN; -- producto no encontrado: nada que hacer
    END IF;

    IF v_es_combo THEN
        -- Combos fijos: la recursión NO propaga p_opcion_ids (los
        -- modificadores se eligen sobre la línea del combo, no sobre cada
        -- componente) — sin cambios respecto a antes.
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
        -- Se descuenta del lote ya preparado, no de insumos crudos —
        -- las opciones de modificador no aplican a este modo.
        UPDATE recetas
        SET porciones_disponibles = porciones_disponibles + p_signo * p_cantidad_pedida
        WHERE id = v_receta.id;
        RETURN;
    END IF;

    -- insumo_id de TODAS las opciones de modificador (activas, de grupos
    -- activos) de este producto — son los insumos "variables por opción".
    SELECT COALESCE(ARRAY_AGG(DISTINCT om.insumo_id), ARRAY[]::INTEGER[])
    INTO v_insumos_opcion
    FROM grupos_modificadores gm
    JOIN opciones_modificador om ON om.grupo_id = gm.id
    WHERE gm.producto_id = p_producto_id
      AND gm.activo = TRUE
      AND om.activa = TRUE
      AND om.insumo_id IS NOT NULL;

    -- insumo_id de las opciones efectivamente elegidas en esta línea del
    -- pedido. Sin filtro de activa/activo: debe resolver igual al enviar
    -- (signo -1) y al cancelar (signo +1), aunque la opción se haya
    -- desactivado entretanto — si no, la reversión quedaría descuadrada.
    SELECT COALESCE(ARRAY_AGG(DISTINCT om.insumo_id), ARRAY[]::INTEGER[])
    INTO v_insumos_elegidos
    FROM opciones_modificador om
    WHERE om.id = ANY(p_opcion_ids)
      AND om.insumo_id IS NOT NULL;

    -- 'por_orden' / 'reventa': descuenta insumos crudos según receta_insumos
    -- — siempre los "de siempre", condicionalmente los elegidos.
    FOR v_ri IN
        SELECT insumo_id, cantidad_usada
        FROM receta_insumos
        WHERE receta_id = v_receta.id
          AND (
              NOT (insumo_id = ANY(v_insumos_opcion))
              OR insumo_id = ANY(v_insumos_elegidos)
          )
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
