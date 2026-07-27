-- ============================================================
-- Historial de precios de compra por insumo
-- Permite ver, compra tras compra, cómo cambió el costo_unitario que
-- cobra cada proveedor por cada insumo — para detectar subidas de precio.
--
-- El LAG() se particiona por (insumo_id, proveedor_id): compara el precio
-- de este proveedor contra SU propia compra anterior de ese insumo, no
-- contra otros proveedores. Se calcula sobre el histórico completo filtrado
-- (para que la comparación "vs. anterior" sea correcta) y solo al final se
-- recorta a p_limit filas — nunca se trae el histórico completo al frontend.
-- ============================================================

CREATE OR REPLACE FUNCTION historial_precios_compras(
    p_proveedor_id INTEGER DEFAULT NULL,
    p_limit        INTEGER DEFAULT 100
)
RETURNS TABLE (
    compra_id               INTEGER,
    fecha                   DATE,
    numero_nota             TEXT,
    compra_total            NUMERIC,
    proveedor_id            INTEGER,
    proveedor_nombre        TEXT,
    insumo_id               INTEGER,
    insumo_nombre           TEXT,
    unidad_medida           unidad_medida,
    cantidad                NUMERIC,
    costo_unitario          NUMERIC,
    costo_unitario_anterior NUMERIC,
    diferencia              NUMERIC
)
LANGUAGE sql STABLE AS $$
    WITH items AS (
        SELECT
            ci.id AS compra_item_id,
            c.id AS compra_id,
            c.fecha,
            c.numero_nota,
            c.total AS compra_total,
            c.proveedor_id,
            prov.nombre AS proveedor_nombre,
            ci.insumo_id,
            ins.nombre AS insumo_nombre,
            ins.unidad_medida,
            ci.cantidad,
            ci.costo_unitario,
            LAG(ci.costo_unitario) OVER (
                PARTITION BY ci.insumo_id, c.proveedor_id
                ORDER BY c.fecha, ci.id
            ) AS costo_unitario_anterior
        FROM compra_items ci
        JOIN compras c     ON c.id = ci.compra_id
        JOIN insumos ins   ON ins.id = ci.insumo_id
        JOIN proveedores prov ON prov.id = c.proveedor_id
        WHERE p_proveedor_id IS NULL OR c.proveedor_id = p_proveedor_id
    )
    SELECT
        compra_id, fecha, numero_nota, compra_total, proveedor_id, proveedor_nombre,
        insumo_id, insumo_nombre, unidad_medida, cantidad, costo_unitario,
        costo_unitario_anterior,
        costo_unitario - costo_unitario_anterior AS diferencia
    FROM items
    ORDER BY fecha DESC, compra_id DESC, insumo_id
    LIMIT p_limit
$$;
