-- ============================================================
-- PASO B — Nivel 1: receta del insumo derivado.
--
-- insumo_receta: qué insumos componentes (crudos u otros derivados) lleva
-- un insumo derivado y en qué cantidad — misma idea que receta_insumos,
-- pero un nivel abajo (insumo → insumo, no producto → insumo).
--
-- producciones (Fase F) se generaliza para poder anclarse a un insumo
-- derivado además de a una receta de producto 'por_lote':
--   - receta_id  → sigue siendo el flujo de Fase F (producto por_lote):
--                  consume UN insumo "principal" (el primero de
--                  receta_insumos, simplificación ya existente) y suma el
--                  rendimiento a recetas.porciones_disponibles.
--   - insumo_id  → flujo nuevo: consume TODOS los componentes de
--                  insumo_receta (sin insumo "principal" — para eso existe
--                  insumo_receta, a diferencia de receta_insumos+Fase F) y
--                  suma el rendimiento a insumos.stock_actual.
-- Exactamente uno de los dos debe estar lleno (CHECK).
--
-- Columnas renombradas (tabla vacía en producción, sin datos que migrar,
-- confirmado): cantidad_insumo_usado → cantidad_lote, porciones_obtenidas
-- → cantidad_obtenida. Motivo: para el flujo de insumo derivado no son
-- "insumo usado"/"porciones" sino "tandas hechas" (multiplicador uniforme
-- sobre insumo_receta.cantidad_usada) y "cuánto rindió realmente".
-- ============================================================

-- ========================
-- insumo_receta
-- ========================

CREATE TABLE insumo_receta (
    id                    SERIAL PRIMARY KEY,
    insumo_id             INTEGER NOT NULL REFERENCES insumos(id),
    insumo_componente_id  INTEGER NOT NULL REFERENCES insumos(id),
    cantidad_usada        NUMERIC(12,3) NOT NULL,
    unidad_medida         unidad_medida NOT NULL,
    CONSTRAINT insumo_receta_no_autoreferencia CHECK (insumo_id <> insumo_componente_id)
);

CREATE INDEX idx_insumo_receta_insumo     ON insumo_receta(insumo_id);
CREATE INDEX idx_insumo_receta_componente ON insumo_receta(insumo_componente_id);

ALTER TABLE insumo_receta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insumo_receta_select_all"  ON insumo_receta FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "insumo_receta_admin_write" ON insumo_receta FOR ALL    USING (es_admin());

-- ========================
-- producciones — generalizar destino + renombrar columnas
-- ========================

ALTER TABLE producciones RENAME COLUMN cantidad_insumo_usado TO cantidad_lote;
ALTER TABLE producciones RENAME COLUMN porciones_obtenidas   TO cantidad_obtenida;

ALTER TABLE producciones
    ALTER COLUMN receta_id DROP NOT NULL,
    ADD COLUMN insumo_id INTEGER REFERENCES insumos(id),
    ADD CONSTRAINT producciones_un_solo_destino CHECK (
        (receta_id IS NOT NULL AND insumo_id IS NULL) OR
        (receta_id IS NULL AND insumo_id IS NOT NULL)
    );

CREATE INDEX idx_producciones_insumo ON producciones(insumo_id);

COMMENT ON COLUMN producciones.cantidad_lote IS
    'Flujo receta_id (Fase F): cantidad real del insumo "principal" usada. Flujo insumo_id: número de tandas (multiplicador uniforme sobre insumo_receta.cantidad_usada de cada componente).';
COMMENT ON COLUMN producciones.cantidad_obtenida IS
    'Cantidad real obtenida — se suma a recetas.porciones_disponibles (flujo receta_id) o a insumos.stock_actual del insumo derivado (flujo insumo_id).';

-- ========================
-- registrar_produccion() — reemplaza la versión de Fase F
-- (20260726000007). Mismo nombre y misma forma de retorno para ambos
-- flujos; internamente rama según cuál de p_receta_id / p_insumo_id venga.
-- ========================

DROP FUNCTION IF EXISTS registrar_produccion(INTEGER, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION registrar_produccion(
    p_receta_id         INTEGER DEFAULT NULL,
    p_insumo_id         INTEGER DEFAULT NULL,
    p_cantidad_lote     NUMERIC DEFAULT NULL,
    p_cantidad_obtenida NUMERIC DEFAULT NULL,
    p_notas             TEXT DEFAULT NULL
)
RETURNS TABLE (
    produccion_id        INTEGER,
    rendimiento_real     NUMERIC,
    rendimiento_esperado NUMERIC,
    diferencia_pct       NUMERIC
) AS $$
DECLARE
    v_usuario_id      UUID := auth.uid();
    v_produccion_id   INTEGER;
    v_rendimiento     NUMERIC;
    -- rama receta_id (Fase F)
    v_receta          RECORD;
    v_insumo_ppal_id  INTEGER;
    v_insumo_ppal_nom TEXT;
    v_num_insumos     INTEGER;
    -- rama insumo_id (Paso B)
    v_insumo          RECORD;
    v_comp            RECORD;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión.';
    END IF;
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden registrar producción.';
    END IF;

    IF (p_receta_id IS NULL) = (p_insumo_id IS NULL) THEN
        RAISE EXCEPTION 'Debes indicar exactamente un destino: receta o insumo.';
    END IF;
    IF p_cantidad_lote IS NULL OR p_cantidad_lote <= 0 THEN
        RAISE EXCEPTION 'La cantidad de lote/tandas debe ser mayor a cero.';
    END IF;
    IF p_cantidad_obtenida IS NULL OR p_cantidad_obtenida <= 0 THEN
        RAISE EXCEPTION 'La cantidad obtenida debe ser mayor a cero.';
    END IF;

    -- ════════════════════════════════════════════════════════════════════
    -- Flujo A: receta de producto 'por_lote' (Fase F, sin cambios de fondo)
    -- ════════════════════════════════════════════════════════════════════
    IF p_receta_id IS NOT NULL THEN
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

        SELECT ri.insumo_id, i.nombre INTO v_insumo_ppal_id, v_insumo_ppal_nom
        FROM receta_insumos ri
        JOIN insumos i ON i.id = ri.insumo_id
        WHERE ri.receta_id = p_receta_id
        ORDER BY ri.id
        LIMIT 1;

        IF v_num_insumos > 1 THEN
            RAISE NOTICE 'La receta % tiene % insumos definidos; se usó "%" (el primero registrado) para el costeo del lote.',
                p_receta_id, v_num_insumos, v_insumo_ppal_nom;
        END IF;

        INSERT INTO producciones (receta_id, fecha, cantidad_lote, cantidad_obtenida, usuario_id, notas)
        VALUES (p_receta_id, CURRENT_DATE, p_cantidad_lote, p_cantidad_obtenida, v_usuario_id, p_notas)
        RETURNING id INTO v_produccion_id;

        INSERT INTO movimientos_inventario
            (insumo_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id)
        VALUES
            (v_insumo_ppal_id, 'salida_produccion', -p_cantidad_lote, 'produccion', v_produccion_id, v_usuario_id);

        UPDATE insumos SET stock_actual = stock_actual - p_cantidad_lote WHERE id = v_insumo_ppal_id;

        UPDATE recetas
        SET porciones_disponibles = porciones_disponibles + p_cantidad_obtenida
        WHERE id = p_receta_id;

        v_rendimiento := p_cantidad_obtenida / p_cantidad_lote;

        RETURN QUERY SELECT
            v_produccion_id,
            v_rendimiento,
            v_receta.rendimiento_esperado,
            CASE
                WHEN v_receta.rendimiento_esperado IS NULL OR v_receta.rendimiento_esperado = 0 THEN NULL
                ELSE ((v_rendimiento - v_receta.rendimiento_esperado) / v_receta.rendimiento_esperado) * 100
            END;
        RETURN;
    END IF;

    -- ════════════════════════════════════════════════════════════════════
    -- Flujo B: insumo derivado (Paso B) — consume TODOS los componentes de
    -- insumo_receta, escalados por p_cantidad_lote ("tandas"). Sin insumo
    -- "principal": para eso existe insumo_receta, a diferencia de
    -- receta_insumos+Fase F.
    -- ════════════════════════════════════════════════════════════════════
    SELECT id, modo_obtencion, nombre INTO v_insumo
    FROM insumos
    WHERE id = p_insumo_id;

    IF v_insumo.id IS NULL THEN
        RAISE EXCEPTION 'Insumo no encontrado.';
    END IF;
    IF v_insumo.modo_obtencion <> 'derivado' THEN
        RAISE EXCEPTION 'Este insumo no está marcado como derivado (con receta propia).';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM insumo_receta WHERE insumo_id = p_insumo_id) THEN
        RAISE EXCEPTION 'Este insumo no tiene receta de componentes definida.';
    END IF;

    INSERT INTO producciones (insumo_id, fecha, cantidad_lote, cantidad_obtenida, usuario_id, notas)
    VALUES (p_insumo_id, CURRENT_DATE, p_cantidad_lote, p_cantidad_obtenida, v_usuario_id, p_notas)
    RETURNING id INTO v_produccion_id;

    FOR v_comp IN
        SELECT insumo_componente_id, cantidad_usada
        FROM insumo_receta
        WHERE insumo_id = p_insumo_id
    LOOP
        INSERT INTO movimientos_inventario
            (insumo_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id)
        VALUES (
            v_comp.insumo_componente_id, 'salida_produccion',
            -(v_comp.cantidad_usada * p_cantidad_lote),
            'produccion', v_produccion_id, v_usuario_id
        );

        UPDATE insumos
        SET stock_actual = stock_actual - (v_comp.cantidad_usada * p_cantidad_lote)
        WHERE id = v_comp.insumo_componente_id;
    END LOOP;

    INSERT INTO movimientos_inventario
        (insumo_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id)
    VALUES
        (p_insumo_id, 'entrada_produccion', p_cantidad_obtenida, 'produccion', v_produccion_id, v_usuario_id);

    UPDATE insumos SET stock_actual = stock_actual + p_cantidad_obtenida WHERE id = p_insumo_id;

    v_rendimiento := p_cantidad_obtenida / p_cantidad_lote;

    -- Sin rendimiento_esperado a nivel de insumo (no forma parte de este
    -- diseño) — se informa el real, esperado/diferencia quedan en NULL.
    RETURN QUERY SELECT v_produccion_id, v_rendimiento, NULL::NUMERIC, NULL::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
