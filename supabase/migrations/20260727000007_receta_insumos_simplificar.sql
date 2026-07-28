-- ============================================================
-- PASO C — Simplificar el porcionado del producto.
--
-- receta_insumos.opcion_id (20260727000003_receta_por_opcion.sql) queda
-- reemplazada por completo por el modelo de dos niveles: ya no hace falta
-- que una fila de receta_insumos "sepa" que corresponde a una opción de
-- modificador — eso se detecta automáticamente comparando su insumo_id
-- contra opciones_modificador.insumo_id (Paso A), sin nada que capturar ni
-- mantener a mano. receta_insumos vuelve a ser (receta_id, insumo_id,
-- cantidad_usada, unidad_medida): solo "cuánto de este insumo usa este
-- producto". Confirmado 0 filas con opcion_id IS NOT NULL antes de este
-- DROP — no hay dato que migrar.
--
-- IMPORTANTE — orden de aplicación: aplicar_consumo_receta() (Paso D,
-- pendiente) todavía filtra receta_insumos por opcion_id/p_opcion_ids. Si
-- esta migración se aplica SOLA, enviar_pedido_a_cocina() y
-- cancelar_item_enviado() empiezan a fallar en el primer pedido que se
-- envíe a cocina (columna inexistente). Aplicar junto con, o inmediatamente
-- antes de, la migración de Paso D — no dejar el sistema en este estado
-- intermedio en producción.
--
-- margen_productos() SÍ se corrige aquí (no es aplicar_consumo_receta, y
-- quedaría rota igual si no se toca): la detección de "insumo variable por
-- opción" para efectos de costeo pasa de opcion_id a la misma comparación
-- por insumo_id contra opciones_modificador.
-- ============================================================

DROP INDEX IF EXISTS idx_receta_insumos_opcion;
ALTER TABLE receta_insumos DROP COLUMN opcion_id;

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
    -- insumo_ids que corresponden a alguna opción de modificador activa del
    -- producto dueño de la receta (ej. insumo "Adobada" ↔ opción "Adobada"
    -- del grupo "Tipo de carne"). Estas filas de receta_insumos son
    -- alternativas mutuamente excluyentes entre sí, no costos que se sumen.
    opcion_insumos AS (
        SELECT gm.producto_id, om.insumo_id
        FROM grupos_modificadores gm
        JOIN opciones_modificador om ON om.grupo_id = gm.id
        WHERE om.insumo_id IS NOT NULL
          AND gm.activo = TRUE
          AND om.activa = TRUE
    ),
    costo_receta AS (
        -- Costo de la receta propia usando solo los insumos "de siempre"
        -- (su insumo_id no corresponde a ninguna opción de modificador de
        -- este producto). margen_variable indica que además hay insumos
        -- variables por opción, no incluidos en este costo "piso".
        SELECT
            r.producto_id,
            CASE
                WHEN COUNT(ri.id) FILTER (WHERE ci.costo_unitario IS NULL) > 0 THEN NULL
                ELSE COALESCE(SUM(ri.cantidad_usada * ci.costo_unitario), 0)
            END AS costo,
            COUNT(ri.id) FILTER (WHERE ci.costo_unitario IS NULL) = 0 AS completo,
            EXISTS (
                SELECT 1
                FROM receta_insumos riv
                JOIN opcion_insumos oi
                    ON oi.producto_id = r.producto_id AND oi.insumo_id = riv.insumo_id
                WHERE riv.receta_id = r.id
            ) AS margen_variable
        FROM recetas r
        LEFT JOIN receta_insumos ri
            ON ri.receta_id = r.id
           AND NOT EXISTS (
               SELECT 1 FROM opcion_insumos oi
               WHERE oi.producto_id = r.producto_id AND oi.insumo_id = ri.insumo_id
           )
        LEFT JOIN costo_insumo ci ON ci.insumo_id = ri.insumo_id
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
