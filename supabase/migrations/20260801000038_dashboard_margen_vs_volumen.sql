-- F8-02: dispersión margen vs. volumen — reutiliza margen_productos() tal
-- cual (misma función que ya usa la sección "Margen de productos" del
-- Dashboard) en vez de reinventar el cálculo de costo/margen, cruzado con
-- el volumen histórico vendido (todo el tiempo, igual que margen_productos()
-- no está acotado a ningún turno — es costeo de catálogo, no un reporte del
-- turno activo).
--
-- Sin SECURITY DEFINER: corre con los privilegios del usuario que llama,
-- igual que el resto de RPCs de dashboard_reportes_rpc.sql.
CREATE OR REPLACE FUNCTION dashboard_margen_vs_volumen()
RETURNS TABLE (
    producto_id     INTEGER,
    nombre          TEXT,
    volumen         INTEGER,
    margen          NUMERIC,
    margen_pct      NUMERIC,
    margen_variable BOOLEAN
)
LANGUAGE sql STABLE AS $$
    WITH volumen_vendido AS (
        SELECT pp.producto_id, SUM(pp.cantidad)::INTEGER AS volumen
        FROM pedido_productos pp
        WHERE pp.estado != 'cancelado' AND pp.producto_id IS NOT NULL
        GROUP BY pp.producto_id
    )
    SELECT
        m.producto_id,
        m.nombre,
        COALESCE(v.volumen, 0) AS volumen,
        m.margen,
        m.margen_pct,
        m.margen_variable
    FROM margen_productos() m
    LEFT JOIN volumen_vendido v ON v.producto_id = m.producto_id
    -- Sin costo completo => margen NULL => no hay nada que graficar en el
    -- eje de margen para ese producto (mismo criterio que ya usa la tarjeta
    -- "Margen de productos", que muestra "—" en ese caso).
    WHERE m.margen IS NOT NULL
$$;
