-- ============================================================
-- Producción por lotes (Fase F) — recetas modo_preparacion='por_lote'
-- (ej. guisos que se cocinan una vez y se venden durante varios días).
--
-- recetas.porciones_disponibles: saldo acumulado de porciones ya cocinadas
-- y aún no vendidas. Se incrementa al registrar una producción y se
-- decrementa al vender (enviar_pedido_a_cocina), igual que insumos.stock_actual
-- pero a nivel de receta en vez de insumo crudo.
--
-- recetas.rendimiento_esperado: porciones esperadas por unidad de insumo
-- principal (ej. "4.5 tacos por kg de carne"), para comparar contra el
-- rendimiento real de cada producción.
-- ============================================================

ALTER TYPE tipo_movimiento_inventario ADD VALUE IF NOT EXISTS 'salida_produccion';

ALTER TABLE recetas
    ADD COLUMN porciones_disponibles NUMERIC(12,3) NOT NULL DEFAULT 0,
    ADD COLUMN rendimiento_esperado  NUMERIC(12,4);

-- ========================
-- PRODUCCIONES
-- Bitácora de cada lote cocinado: cuánto insumo se usó y cuántas porciones
-- rindió. El rendimiento real de cada fila = porciones_obtenidas /
-- cantidad_insumo_usado — se calcula al vuelo, no se guarda una columna
-- redundante.
-- ========================

CREATE TABLE producciones (
    id                    SERIAL PRIMARY KEY,
    receta_id             INTEGER NOT NULL REFERENCES recetas(id),
    fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
    cantidad_insumo_usado NUMERIC(12,3) NOT NULL CHECK (cantidad_insumo_usado > 0),
    porciones_obtenidas   NUMERIC(12,3) NOT NULL CHECK (porciones_obtenidas > 0),
    usuario_id            UUID REFERENCES auth.users(id),
    notas                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_producciones_receta ON producciones(receta_id);
CREATE INDEX idx_producciones_fecha  ON producciones(fecha);

ALTER TABLE producciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "producciones_select_all"  ON producciones FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "producciones_admin_write" ON producciones FOR ALL    USING (es_admin());

-- ========================
-- aplicar_consumo_receta() — reemplaza la versión de Fase E
-- (20260726000006). Mismo punto de entrada desde enviar_pedido_a_cocina() y
-- cancelar_item_enviado(): el branch 'por_lote', antes vacío, ahora resta
-- (o regresa, según p_signo) de recetas.porciones_disponibles en vez de
-- tocar insumos crudos. La reversión por cancelación funciona automáticamente
-- porque cancelar_item_enviado() ya llama a esta misma función con signo +1.
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

    IF v_receta.id IS NULL THEN
        RETURN; -- sin receta definida
    END IF;

    IF v_receta.modo_preparacion = 'por_lote' THEN
        -- Se descuenta del lote ya preparado, no de insumos crudos. Fase F
        -- (registrar_produccion) es quien repone porciones_disponibles.
        UPDATE recetas
        SET porciones_disponibles = porciones_disponibles + p_signo * p_cantidad_pedida
        WHERE id = v_receta.id;
        RETURN;
    END IF;

    -- 'por_orden': descuenta insumos crudos según receta_insumos.
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
-- registrar_produccion()
-- Registra un lote cocinado: descuenta el insumo principal de la receta
-- (el primero en receta_insumos por id — si hay más de uno se avisa por
-- NOTICE) del inventario, y suma porciones_obtenidas a
-- recetas.porciones_disponibles (se acumula, nunca se reinicia). Devuelve
-- el rendimiento real de este lote y su comparación contra
-- rendimiento_esperado.
-- ========================

CREATE OR REPLACE FUNCTION registrar_produccion(
    p_receta_id             INTEGER,
    p_cantidad_insumo_usado NUMERIC,
    p_porciones_obtenidas   NUMERIC,
    p_notas                 TEXT DEFAULT NULL
)
RETURNS TABLE (
    produccion_id       INTEGER,
    rendimiento_real     NUMERIC,
    rendimiento_esperado NUMERIC,
    diferencia_pct       NUMERIC
) AS $$
DECLARE
    v_usuario_id    UUID := auth.uid();
    v_receta        RECORD;
    v_insumo_id     INTEGER;
    v_insumo_nombre TEXT;
    v_num_insumos   INTEGER;
    v_produccion_id INTEGER;
    v_rendimiento   NUMERIC;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden registrar producción.';
    END IF;
    IF p_cantidad_insumo_usado IS NULL OR p_cantidad_insumo_usado <= 0 THEN
        RAISE EXCEPTION 'La cantidad de insumo usado debe ser mayor a cero.';
    END IF;
    IF p_porciones_obtenidas IS NULL OR p_porciones_obtenidas <= 0 THEN
        RAISE EXCEPTION 'Las porciones obtenidas deben ser mayores a cero.';
    END IF;

    SELECT id, modo_preparacion, rendimiento_esperado INTO v_receta
    FROM recetas
    WHERE id = p_receta_id;

    IF v_receta.id IS NULL THEN
        RAISE EXCEPTION 'Receta no encontrada.';
    END IF;
    IF v_receta.modo_preparacion <> 'por_lote' THEN
        RAISE EXCEPTION 'Esta receta no está marcada como producción por lote.';
    END IF;

    SELECT COUNT(*) INTO v_num_insumos FROM receta_insumos WHERE receta_id = p_receta_id;
    IF v_num_insumos = 0 THEN
        RAISE EXCEPTION 'Esta receta no tiene insumos definidos.';
    END IF;

    -- Insumo principal = el primero registrado (menor id). Si hay más de
    -- uno, se avisa — el llamador debe revisar si esto es correcto.
    SELECT ri.insumo_id, i.nombre INTO v_insumo_id, v_insumo_nombre
    FROM receta_insumos ri
    JOIN insumos i ON i.id = ri.insumo_id
    WHERE ri.receta_id = p_receta_id
    ORDER BY ri.id
    LIMIT 1;

    IF v_num_insumos > 1 THEN
        RAISE NOTICE 'La receta % tiene % insumos definidos; se usó "%" (el primero registrado) para el costeo del lote.',
            p_receta_id, v_num_insumos, v_insumo_nombre;
    END IF;

    INSERT INTO producciones (receta_id, fecha, cantidad_insumo_usado, porciones_obtenidas, usuario_id, notas)
    VALUES (p_receta_id, CURRENT_DATE, p_cantidad_insumo_usado, p_porciones_obtenidas, v_usuario_id, p_notas)
    RETURNING id INTO v_produccion_id;

    INSERT INTO movimientos_inventario
        (insumo_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id)
    VALUES
        (v_insumo_id, 'salida_produccion', -p_cantidad_insumo_usado, 'produccion', v_produccion_id, v_usuario_id);

    UPDATE insumos SET stock_actual = stock_actual - p_cantidad_insumo_usado WHERE id = v_insumo_id;

    UPDATE recetas
    SET porciones_disponibles = porciones_disponibles + p_porciones_obtenidas
    WHERE id = p_receta_id;

    v_rendimiento := p_porciones_obtenidas / p_cantidad_insumo_usado;

    RETURN QUERY SELECT
        v_produccion_id,
        v_rendimiento,
        v_receta.rendimiento_esperado,
        CASE
            WHEN v_receta.rendimiento_esperado IS NULL OR v_receta.rendimiento_esperado = 0 THEN NULL
            ELSE ((v_rendimiento - v_receta.rendimiento_esperado) / v_receta.rendimiento_esperado) * 100
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================
-- consumo_diario_recetas_lote()
-- Consumo promedio diario de los últimos p_dias días para cada receta
-- 'por_lote', reconstruido desde pedido_productos (la venta real) —no se
-- necesita una bitácora aparte: 'enviado' ya excluye ítems cancelados
-- (revertidos) porque su estado vuelve a 'cancelado'. Cuenta ventas
-- directas del producto dueño de la receta y ventas como componente de
-- un combo (cantidad del pedido × cantidad del componente en el combo).
-- ========================

CREATE OR REPLACE FUNCTION consumo_diario_recetas_lote(p_dias INTEGER DEFAULT 14)
RETURNS TABLE (
    receta_id               INTEGER,
    receta_nombre           TEXT,
    producto_id             INTEGER,
    producto_nombre         TEXT,
    porciones_disponibles   NUMERIC,
    consumo_total           NUMERIC,
    consumo_promedio_diario NUMERIC
)
LANGUAGE sql STABLE AS $$
    WITH recetas_lote AS (
        SELECT r.id AS receta_id, r.nombre AS receta_nombre, r.producto_id,
               p.nombre AS producto_nombre, r.porciones_disponibles
        FROM recetas r
        JOIN productos p ON p.id = r.producto_id
        WHERE r.modo_preparacion = 'por_lote'
    ),
    ventas_directas AS (
        SELECT rl.receta_id, SUM(pp.cantidad) AS cantidad
        FROM recetas_lote rl
        JOIN pedido_productos pp
            ON pp.producto_id = rl.producto_id
           AND pp.estado = 'enviado'
           AND pp.created_at >= NOW() - make_interval(days => p_dias)
        GROUP BY rl.receta_id
    ),
    ventas_combo AS (
        SELECT rl.receta_id, SUM(pp.cantidad * cp.cantidad) AS cantidad
        FROM recetas_lote rl
        JOIN combo_productos cp ON cp.producto_id = rl.producto_id
        JOIN pedido_productos pp
            ON pp.producto_id = cp.combo_id
           AND pp.estado = 'enviado'
           AND pp.created_at >= NOW() - make_interval(days => p_dias)
        GROUP BY rl.receta_id
    )
    SELECT
        rl.receta_id,
        rl.receta_nombre,
        rl.producto_id,
        rl.producto_nombre,
        rl.porciones_disponibles,
        COALESCE(vd.cantidad, 0) + COALESCE(vc.cantidad, 0),
        (COALESCE(vd.cantidad, 0) + COALESCE(vc.cantidad, 0))::NUMERIC / NULLIF(p_dias, 0)
    FROM recetas_lote rl
    LEFT JOIN ventas_directas vd ON vd.receta_id = rl.receta_id
    LEFT JOIN ventas_combo   vc ON vc.receta_id = rl.receta_id
$$;
