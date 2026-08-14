-- ══════════════════════════════════════════════════════════════════════════
-- Cierre del hueco de seguridad en tablas de caja — Parte 1: funciones.
--
-- Hoy movimientos_caja/pagos/cobro_subpedidos aceptan INSERT/UPDATE/DELETE
-- directo de cualquier usuario autenticado (policy "FOR ALL USING
-- auth.uid() IS NOT NULL" — ver 20260223000002_rls_politicas.sql). Estas 4
-- funciones SECURITY DEFINER son el único camino que va a quedar permitido
-- una vez que 20260801000032_caja_rls_solo_lectura.sql cierre esas policies
-- a solo SELECT. Cada una re-implementa DENTRO de sí misma cualquier chequeo
-- de permiso que hoy vive en una RLS policy de OTRA tabla (descuentos,
-- cancelaciones) — SECURITY DEFINER bypassa RLS en todo lo que toca, así
-- que esos permisos dejan de aplicarse solos si no se repiten aquí.
--
-- ⚠️ Orden de despliegue obligatorio (ver resumen entregado aparte):
--   1. Aplicar esta migración (solo agrega funciones, no rompe nada).
--   2. Desplegar el código de frontend que ya llama a estas funciones vía
--      supabase.rpc() en vez de sus inserts directos.
--   3. Solo entonces aplicar 20260801000032 (la que sí cierra el acceso
--      directo) — aplicarla antes del paso 2 rompería el cobro en
--      producción de inmediato.
-- ══════════════════════════════════════════════════════════════════════════


-- ─── 1. cobrar_pedido_seguro ────────────────────────────────────────────────
-- Migra la lógica COMPLETA de cobrarPedido() (cobro/[pedidoId]/actions.ts),
-- no solo el insert a movimientos_caja: permiso cobro_solo_admin, permiso
-- descuentos_mesero (antes vivía como RLS en `descuentos`), validación de
-- pagos, movimiento+pagos+cobro_subpedidos, descuento de inventario de
-- ítems nunca enviados, cierre de subpedidos/pedido, liberación de
-- mesa/mesas satélite. Efecto de borde deseado: al ser una sola función
-- transaccional, un fallo a la mitad ahora revierte TODO (antes, un error
-- después del insert de movimientos_caja podía dejar ese movimiento ya
-- comprometido sin sus pagos/cobro_subpedidos — un estado a medias que la
-- versión vieja no podía evitar por estar repartida en varias llamadas).
CREATE OR REPLACE FUNCTION cobrar_pedido_seguro(
    p_pedido_id         INTEGER,
    p_turno_id          INTEGER,
    p_mesa_id           INTEGER,
    p_subpedidos        JSONB,   -- [{"id": int, "monto": numeric}, ...]
    p_total_cobrado     NUMERIC,
    p_propina           NUMERIC,
    p_pagos             JSONB,   -- [{"metodo": text, "monto": numeric, "referencia": text|null}, ...]
    p_efectivo_recibido NUMERIC,
    p_cambio            NUMERIC,
    p_descuento_valor   NUMERIC DEFAULT NULL,
    p_descuento_tipo    TEXT DEFAULT NULL,
    p_descuento_monto   NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario_id        UUID := auth.uid();
    v_es_admin          BOOLEAN;
    v_cobro_solo_admin  BOOLEAN;
    v_descuentos_mesero BOOLEAN;
    v_total_fisico       NUMERIC;
    v_suma_pagos          NUMERIC;
    v_monto_efectivo      NUMERIC;
    v_propina_efectivo    NUMERIC;
    v_propina_tarjeta     NUMERIC;
    v_movimiento_id       INTEGER;
    v_subpedido_ids       INTEGER[];
    v_total_base          NUMERIC;
    v_activos             INTEGER;
    v_mesa_temporal       BOOLEAN;
    v_sat                 RECORD;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;

    SELECT (rol = 'admin') INTO v_es_admin FROM perfiles WHERE id = v_usuario_id;
    SELECT cobro_solo_admin, descuentos_mesero
      INTO v_cobro_solo_admin, v_descuentos_mesero
      FROM config_sistema WHERE id = 1;

    -- Permiso "Cobrar solo admin" — mismo punto de verificación que ya
    -- vivía en TS; ver nota de migración futura a rol "Cajero" en
    -- database.types.ts / CobroShell.tsx (sin mover este punto, solo la
    -- fuente de dónde saca la respuesta cuando exista esa tabla).
    IF COALESCE(v_cobro_solo_admin, false) AND NOT COALESCE(v_es_admin, false) THEN
        RAISE EXCEPTION 'Cobrar está restringido a admin en este momento.';
    END IF;

    -- Validar que los pagos cubran el total físico (negocio + propina)
    v_total_fisico := p_total_cobrado + p_propina;
    SELECT COALESCE(SUM((pago->>'monto')::NUMERIC), 0) INTO v_suma_pagos
    FROM jsonb_array_elements(p_pagos) AS pago;

    IF v_suma_pagos < v_total_fisico - 0.01 THEN
        RAISE EXCEPTION 'El monto ingresado no cubre el total del pedido.';
    END IF;

    -- Cualquier cobro real invalida el aviso de "precuenta impresa hace
    -- tiempo sin cobrar" (ver marcarPrecuentaImpresa() en TS, sin cambios).
    UPDATE pedidos SET precuenta_impresa_en = NULL WHERE id = p_pedido_id;

    -- 0. Descuento, si aplica — el permiso "descuentos_mesero" antes lo
    -- imponía la policy RLS "descuentos_insert_perm" de la tabla
    -- `descuentos`; esta función la bypassa como SECURITY DEFINER, así que
    -- se reimplementa aquí explícitamente (mismo WITH CHECK: es_admin() OR
    -- descuentos_mesero).
    IF p_descuento_valor IS NOT NULL AND p_descuento_valor > 0 AND p_descuento_monto IS NOT NULL THEN
        IF NOT (COALESCE(v_es_admin, false) OR COALESCE(v_descuentos_mesero, false)) THEN
            RAISE EXCEPTION 'No tienes permiso para aplicar descuentos.';
        END IF;
        INSERT INTO descuentos (pedido_id, usuario_id, tipo, valor, monto_calculado, motivo)
        VALUES (
            p_pedido_id, v_usuario_id,
            COALESCE(p_descuento_tipo, 'porcentaje')::tipo_descuento,
            p_descuento_valor, p_descuento_monto, 'Descuento en cobro'
        );
    END IF;

    -- 1. Movimiento de caja — propina en efectivo (sale del cajón físico)
    -- vs. tarjeta/transferencia (se queda en la terminal), repartida
    -- proporcional al monto físico de cada método en pago mixto.
    SELECT COALESCE(SUM((pago->>'monto')::NUMERIC), 0) INTO v_monto_efectivo
    FROM jsonb_array_elements(p_pagos) AS pago
    WHERE pago->>'metodo' = 'efectivo';

    IF v_total_fisico > 0 THEN
        v_propina_efectivo := ROUND(((p_propina * v_monto_efectivo) / v_total_fisico) * 100) / 100;
    ELSE
        v_propina_efectivo := 0;
    END IF;
    v_propina_tarjeta := ROUND((p_propina - v_propina_efectivo) * 100) / 100;

    INSERT INTO movimientos_caja (
        turno_id, tipo, monto, propina, propina_efectivo, propina_tarjeta,
        efectivo_recibido, cambio, notas
    )
    VALUES (
        p_turno_id, 'cobro', p_total_cobrado, p_propina, v_propina_efectivo, v_propina_tarjeta,
        p_efectivo_recibido, p_cambio, NULL
    )
    RETURNING id INTO v_movimiento_id;

    -- 2. Pagos (uno por método)
    INSERT INTO pagos (movimiento_id, metodo_pago, monto, referencia)
    SELECT v_movimiento_id, (pago->>'metodo')::metodo_pago, (pago->>'monto')::NUMERIC, pago->>'referencia'
    FROM jsonb_array_elements(p_pagos) AS pago;

    -- 3. Vincular cobro a cada subpedido (distribución proporcional)
    SELECT COALESCE(SUM((sub->>'monto')::NUMERIC), 0) INTO v_total_base
    FROM jsonb_array_elements(p_subpedidos) AS sub;

    IF jsonb_array_length(p_subpedidos) > 0 THEN
        INSERT INTO cobro_subpedidos (movimiento_id, subpedido_id, monto_aplicado)
        SELECT
            v_movimiento_id,
            (sub->>'id')::INTEGER,
            CASE WHEN v_total_base > 0
                THEN ROUND(((sub->>'monto')::NUMERIC / v_total_base) * p_total_cobrado * 100) / 100
                ELSE p_total_cobrado / jsonb_array_length(p_subpedidos)
            END
        FROM jsonb_array_elements(p_subpedidos) AS sub;
    END IF;

    SELECT ARRAY_AGG((sub->>'id')::INTEGER) INTO v_subpedido_ids
    FROM jsonb_array_elements(p_subpedidos) AS sub;

    -- 3.5 Descontar inventario de ítems que nunca se enviaron a cocina
    -- (comunicados de viva voz, siguen 'pendiente') — mismo RPC ya
    -- existente que ya usaba la versión TS, sin reimplementar su lógica.
    IF v_subpedido_ids IS NOT NULL THEN
        PERFORM enviar_pendientes_de_subpedidos(v_subpedido_ids);
    END IF;

    -- 4. Marcar subpedidos cobrados como pagados
    IF v_subpedido_ids IS NOT NULL THEN
        UPDATE subpedidos SET estado = 'pagado' WHERE id = ANY(v_subpedido_ids);
    END IF;

    -- 5. ¿Quedan subpedidos activos? (pago parcial → no cerrar el pedido)
    SELECT COUNT(*) INTO v_activos FROM subpedidos WHERE pedido_id = p_pedido_id AND estado = 'activo';

    IF v_activos > 0 THEN
        RETURN jsonb_build_object('pedido_cerrado', false);
    END IF;

    -- 6. Cerrar el pedido (todos pagados)
    UPDATE pedidos SET estado = 'cerrado', cerrado_en = now() WHERE id = p_pedido_id;

    -- 7. Liberar o eliminar la mesa principal
    IF p_mesa_id IS NOT NULL THEN
        SELECT temporal INTO v_mesa_temporal FROM mesas WHERE id = p_mesa_id;

        IF COALESCE(v_mesa_temporal, false) THEN
            -- Nullear FK antes de borrar — el CHECK
            -- mesa_requerida_si_no_llevar_ni_mostrador ya permite mesa_id
            -- NULL porque el pedido ya quedó 'cerrado' arriba.
            UPDATE pedidos SET mesa_id = NULL WHERE id = p_pedido_id;
            DELETE FROM mesas WHERE id = p_mesa_id;
        ELSE
            UPDATE mesas SET estado = 'libre' WHERE id = p_mesa_id;
        END IF;
    END IF;

    -- 8. Liberar las mesas satélite unidas a este pedido (pedido_mesas) —
    -- mismo criterio que liberarMesasSatelite()/liberarUnaMesaSatelite()
    -- en TS (cobro/[pedidoId]/actions.ts, lib/mesasSatelite.ts): temporal
    -- → se borra por completo (incluida su fila de pedido_mesas, y se
    -- nulea cualquier pedido histórico que aún la referencie); mesa normal
    -- → vuelve a su posición pre-unión si se movió, y queda libre, sin
    -- borrar su fila de pedido_mesas (registro histórico a propósito).
    FOR v_sat IN
        SELECT pm.mesa_id, pm.pos_x_original, pm.pos_y_original, pm.rotacion_original, m.temporal
        FROM pedido_mesas pm
        JOIN mesas m ON m.id = pm.mesa_id
        WHERE pm.pedido_id = p_pedido_id
    LOOP
        IF COALESCE(v_sat.temporal, false) THEN
            DELETE FROM pedido_mesas WHERE mesa_id = v_sat.mesa_id;
            UPDATE pedidos SET mesa_id = NULL WHERE mesa_id = v_sat.mesa_id;
            DELETE FROM mesas WHERE id = v_sat.mesa_id;
        ELSE
            UPDATE mesas
            SET estado = 'libre',
                pos_x = COALESCE(v_sat.pos_x_original, pos_x),
                pos_y = COALESCE(v_sat.pos_y_original, pos_y),
                rotacion = COALESCE(v_sat.rotacion_original, rotacion)
            WHERE id = v_sat.mesa_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('pedido_cerrado', true);
END;
$$;


-- ─── 2. registrar_fondo_caja ────────────────────────────────────────────────
-- Migra registrarMovimiento() (mas/turno/actions.ts) — depósitos/retiros de
-- caja a media turno. Sin permiso especial más allá de sesión iniciada,
-- igual que hoy (cualquier autenticado puede registrar fondo/retiro).
CREATE OR REPLACE FUNCTION registrar_fondo_caja(
    p_turno_id INTEGER,
    p_tipo     TEXT,   -- 'fondo' | 'retiro'
    p_monto    NUMERIC,
    p_notas    TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario_id UUID := auth.uid();
    v_id INTEGER;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;
    IF p_tipo NOT IN ('fondo', 'retiro') THEN
        RAISE EXCEPTION 'Tipo de movimiento inválido.';
    END IF;
    IF p_monto <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a cero.';
    END IF;

    INSERT INTO movimientos_caja (turno_id, tipo, monto, notas, usuario_id)
    VALUES (p_turno_id, p_tipo::tipo_movimiento_caja, p_monto, p_notas, v_usuario_id)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;


-- ─── 3. anular_pedido_seguro ────────────────────────────────────────────────
-- Migra anularPedido() (cobro/[pedidoId]/actions.ts) — "Anular mesa" cuando
-- el total es $0. La versión TS de hoy NO valida el total server-side (solo
-- oculta el botón en CobroShell cuando totalPedido>0) — esta función SÍ lo
-- valida de verdad, cerrando ese hueco de paso (no solo el de caja: hoy
-- técnicamente se podría llamar a anularPedido() con un pedido con consumo
-- real y perderlo sin cobrar, sin que el servidor lo impida).
CREATE OR REPLACE FUNCTION anular_pedido_seguro(
    p_pedido_id INTEGER,
    p_mesa_id   INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario_id    UUID := auth.uid();
    v_total         NUMERIC;
    v_mesa_temporal BOOLEAN;
    v_sat           RECORD;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;

    -- Validación NUEVA, server-side: total real del pedido (ítems no
    -- cancelados de subpedidos aún no pagados) debe ser exactamente $0.
    -- Mismo cálculo que usa cobro/[pedidoId]/page.tsx para totalPedido.
    SELECT COALESCE(SUM(
        (pp.precio_unit + COALESCE((
            SELECT SUM(ppo.precio_extra)
            FROM pedido_producto_opciones ppo
            WHERE ppo.pedido_producto_id = pp.id
        ), 0)) * pp.cantidad
    ), 0)
    INTO v_total
    FROM pedido_productos pp
    JOIN subpedidos s ON s.id = pp.subpedido_id
    WHERE s.pedido_id = p_pedido_id
      AND s.estado != 'pagado'
      AND pp.estado != 'cancelado';

    IF v_total > 0 THEN
        RAISE EXCEPTION 'Solo se puede anular un pedido sin consumo (total en $0).';
    END IF;

    UPDATE pedidos SET estado = 'cerrado', cerrado_en = now() WHERE id = p_pedido_id;

    IF p_mesa_id IS NOT NULL THEN
        SELECT temporal INTO v_mesa_temporal FROM mesas WHERE id = p_mesa_id;
        IF COALESCE(v_mesa_temporal, false) THEN
            UPDATE pedidos SET mesa_id = NULL WHERE id = p_pedido_id;
            DELETE FROM mesas WHERE id = p_mesa_id;
        ELSE
            UPDATE mesas SET estado = 'libre' WHERE id = p_mesa_id;
        END IF;
    END IF;

    -- Liberar mesas satélite — mismo bloque que cobrar_pedido_seguro (ver
    -- comentario ahí; no se extrajo a una función compartida a propósito,
    -- para no crear un RPC público adicional sin su propio chequeo de
    -- permiso — ver nota general al inicio del archivo).
    FOR v_sat IN
        SELECT pm.mesa_id, pm.pos_x_original, pm.pos_y_original, pm.rotacion_original, m.temporal
        FROM pedido_mesas pm
        JOIN mesas m ON m.id = pm.mesa_id
        WHERE pm.pedido_id = p_pedido_id
    LOOP
        IF COALESCE(v_sat.temporal, false) THEN
            DELETE FROM pedido_mesas WHERE mesa_id = v_sat.mesa_id;
            UPDATE pedidos SET mesa_id = NULL WHERE mesa_id = v_sat.mesa_id;
            DELETE FROM mesas WHERE id = v_sat.mesa_id;
        ELSE
            UPDATE mesas
            SET estado = 'libre',
                pos_x = COALESCE(v_sat.pos_x_original, pos_x),
                pos_y = COALESCE(v_sat.pos_y_original, pos_y),
                rotacion = COALESCE(v_sat.rotacion_original, rotacion)
            WHERE id = v_sat.mesa_id;
        END IF;
    END LOOP;
END;
$$;


-- ─── 4. cancelar_item_seguro ────────────────────────────────────────────────
-- Migra cancelarItem() (pos/[pedidoId]/actions.ts) — cancelar un ítem ya
-- enviado a cocina. Reemplaza 3 llamadas separadas (RPC
-- cancelar_item_enviado + insert cancelaciones + insert movimientos_caja)
-- por una sola. El permiso "cancelaciones_mesero" antes lo imponía la
-- policy RLS "cancelaciones_insert_perm" de `cancelaciones`; se
-- reimplementa aquí por la misma razón que descuentos_mesero arriba.
--
-- El insert a movimientos_caja se deja en un bloque EXCEPTION propio,
-- exactamente como en el comentario original de la versión TS: "el ítem ya
-- quedó cancelado... un fallo aquí no debe reportarse como cancelación
-- fallida" — si el registro de caja fallara por algo, el ítem se queda
-- cancelado igual (solo se pierde ese renglón de caja, logueado con
-- RAISE WARNING en vez de abortar toda la operación).
CREATE OR REPLACE FUNCTION cancelar_item_seguro(
    p_pedido_producto_id INTEGER,
    p_motivo             TEXT
)
RETURNS NUMERIC  -- monto_afectado
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario_id           UUID := auth.uid();
    v_es_admin             BOOLEAN;
    v_cancelaciones_mesero BOOLEAN;
    v_pp                   RECORD;
    v_extras               NUMERIC;
    v_monto_afectado       NUMERIC;
    v_turno_id             INTEGER;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;

    SELECT (rol = 'admin') INTO v_es_admin FROM perfiles WHERE id = v_usuario_id;
    SELECT cancelaciones_mesero INTO v_cancelaciones_mesero FROM config_sistema WHERE id = 1;

    IF NOT (COALESCE(v_es_admin, false) OR COALESCE(v_cancelaciones_mesero, false)) THEN
        RAISE EXCEPTION 'No tienes permiso para cancelar ítems.';
    END IF;

    SELECT id, precio_unit, cantidad, subpedido_id INTO v_pp
    FROM pedido_productos WHERE id = p_pedido_producto_id;

    IF v_pp.id IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado.';
    END IF;

    SELECT COALESCE(SUM(precio_extra), 0) INTO v_extras
    FROM pedido_producto_opciones WHERE pedido_producto_id = v_pp.id;

    v_monto_afectado := (v_pp.precio_unit + v_extras) * v_pp.cantidad;

    SELECT p.turno_id INTO v_turno_id
    FROM subpedidos s JOIN pedidos p ON p.id = s.pedido_id
    WHERE s.id = v_pp.subpedido_id;

    -- Marca 'cancelado' + revierte inventario — ya era SECURITY DEFINER,
    -- valida por su cuenta que el ítem esté 'enviado' (RAISE EXCEPTION si
    -- no), sin reimplementar esa lógica aquí.
    PERFORM cancelar_item_enviado(p_pedido_producto_id);

    INSERT INTO cancelaciones (pedido_producto_id, usuario_id, motivo, monto_afectado)
    VALUES (p_pedido_producto_id, v_usuario_id, p_motivo, v_monto_afectado);

    BEGIN
        INSERT INTO movimientos_caja (turno_id, tipo, monto, notas, usuario_id)
        VALUES (v_turno_id, 'cancelacion', -v_monto_afectado, p_motivo, v_usuario_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[cancelar_item_seguro] error registrando movimiento de caja para pedido_producto_id=%: %',
            p_pedido_producto_id, SQLERRM;
    END;

    RETURN v_monto_afectado;
END;
$$;
