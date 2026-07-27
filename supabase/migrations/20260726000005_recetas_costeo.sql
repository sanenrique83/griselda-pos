-- ============================================================
-- Recetario + costeo: 1 receta por producto, y costeo de
-- productos/combos para la pantalla "Receta" del catálogo y la
-- tabla "Margen por producto" del dashboard.
--
-- combo_productos ya existía desde 20260223000001_schema_inicial.sql
-- (combo_id, producto_id, cantidad, incluye_extras) — no se toca,
-- solo se consume aquí. Un combo NO tiene fila propia en recetas: su
-- costo es la suma de (costo de receta de cada componente × cantidad).
-- ============================================================

-- Un producto tiene a lo más una receta.
ALTER TABLE recetas
    ADD CONSTRAINT recetas_producto_unico UNIQUE (producto_id);

-- ========================
-- costo_insumos_actual()
-- Costo unitario más reciente de cada insumo (por fecha de compra),
-- mismo criterio que historial_precios_compras: "el costo actual de un
-- insumo es el costo_unitario del compra_item más reciente".
-- ========================

CREATE OR REPLACE FUNCTION costo_insumos_actual()
RETURNS TABLE (
    insumo_id      INTEGER,
    costo_unitario NUMERIC
)
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT ON (ci.insumo_id)
        ci.insumo_id,
        ci.costo_unitario
    FROM compra_items ci
    JOIN compras c ON c.id = ci.compra_id
    ORDER BY ci.insumo_id, c.fecha DESC, ci.id DESC
$$;

-- ========================
-- margen_productos()
-- Costo, precio y margen por producto activo.
--
-- costo_completo = FALSE cuando falta un dato para calcularlo:
--   - producto normal sin receta, o con algún insumo sin compra registrada
--   - combo sin componentes, o con algún componente sin receta completa
-- En ese caso costo/margen/margen_pct se devuelven NULL — nunca se
-- inventa un número.
-- ========================

CREATE OR REPLACE FUNCTION margen_productos()
RETURNS TABLE (
    producto_id    INTEGER,
    nombre         TEXT,
    es_combo       BOOLEAN,
    precio         NUMERIC,
    costo          NUMERIC,
    costo_completo BOOLEAN,
    margen         NUMERIC,
    margen_pct     NUMERIC
)
LANGUAGE sql STABLE AS $$
    WITH costo_insumo AS (
        SELECT * FROM costo_insumos_actual()
    ),
    costo_receta AS (
        -- Costo de la receta propia de cada producto que tiene una.
        SELECT
            r.producto_id,
            CASE
                WHEN COUNT(ri.id) FILTER (WHERE ci.costo_unitario IS NULL) > 0 THEN NULL
                ELSE COALESCE(SUM(ri.cantidad_usada * ci.costo_unitario), 0)
            END AS costo,
            COUNT(ri.id) FILTER (WHERE ci.costo_unitario IS NULL) = 0 AS completo
        FROM recetas r
        LEFT JOIN receta_insumos ri ON ri.receta_id = r.id
        LEFT JOIN costo_insumo ci   ON ci.insumo_id = ri.insumo_id
        GROUP BY r.producto_id
    ),
    costo_combo AS (
        -- Costo de un combo = suma de (costo de receta del componente × cantidad).
        SELECT
            cp.combo_id AS producto_id,
            CASE
                WHEN COUNT(cp.id) FILTER (WHERE cr.costo IS NULL) > 0 THEN NULL
                ELSE COALESCE(SUM(cr.costo * cp.cantidad), 0)
            END AS costo,
            COUNT(cp.id) FILTER (WHERE cr.costo IS NULL) = 0 AS completo
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
        END
    FROM productos p
    LEFT JOIN costo_receta cr ON cr.producto_id = p.id
    LEFT JOIN costo_combo  cc ON cc.producto_id = p.id
    WHERE p.activo = TRUE
    ORDER BY p.nombre
$$;
