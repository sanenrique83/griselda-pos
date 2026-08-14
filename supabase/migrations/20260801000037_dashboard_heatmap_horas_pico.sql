-- F8-01: heatmap de horas pico — mismo patrón de dashboard_ventas_promedio_dia_semana()
-- (CTE de totales por turno, rankeados por recencia, tope de 8 turnos
-- comparables por combinación, luego AVG), extendido con la dimensión hora.
-- No se puede reusar esa función tal cual porque agrupa a nivel turno
-- (t.abierto_en) y aquí se necesita granularidad de hora real de cada cobro
-- (movimientos_caja.created_at) — así que el total por combinación
-- día×hora se agrega primero por turno (SUM), igual que el original agrega
-- por turno antes de promediar entre turnos.
--
-- Sin SECURITY DEFINER: corre con los privilegios del usuario que llama,
-- igual que el resto de RPCs de dashboard_reportes_rpc.sql.
CREATE OR REPLACE FUNCTION dashboard_heatmap_horas_pico()
RETURNS TABLE (dia_semana INTEGER, hora INTEGER, promedio NUMERIC, turnos_contados INTEGER)
LANGUAGE sql STABLE AS $$
    WITH cobros_por_hora AS (
        SELECT
            t.id AS turno_id,
            t.abierto_en,
            EXTRACT(DOW FROM m.created_at AT TIME ZONE 'America/Mexico_City')::INTEGER AS dow,
            EXTRACT(HOUR FROM m.created_at AT TIME ZONE 'America/Mexico_City')::INTEGER AS hora,
            SUM(m.monto) AS total_hora
        FROM movimientos_caja m
        JOIN turnos t ON t.id = m.turno_id
        WHERE m.tipo = 'cobro' AND t.estado = 'cerrado'
        GROUP BY t.id, dow, hora
    ),
    rankeados AS (
        SELECT
            cobros_por_hora.*,
            ROW_NUMBER() OVER (PARTITION BY dow, hora ORDER BY abierto_en DESC) AS rn
        FROM cobros_por_hora
    )
    SELECT dow, hora, AVG(total_hora), COUNT(*)::INTEGER
    FROM rankeados
    WHERE rn <= 8
    GROUP BY dow, hora
$$;
