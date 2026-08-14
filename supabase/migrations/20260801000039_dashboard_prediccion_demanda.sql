-- F8-03: predicción de demanda para mañana — mismo patrón de "mismo día de
-- la semana histórico" que ya usan dashboard_ventas_promedio_dia_semana()
-- (CTE turnos_totales/rankeados, ROW_NUMBER + tope de 8 turnos comparables)
-- y dashboard_alerta_ventas_bajas() (CTE "parametros" para fijar el día
-- objetivo vía EXTRACT(DOW) sobre NOW() en America/Mexico_City) — aquí el
-- objetivo es el DOW de MAÑANA, no el de hoy, y se compara el total
-- COMPLETO de cada turno histórico (no acotado a una hora de corte, como sí
-- hace la alerta en tiempo real) porque se está proyectando el día entero.
--
-- Sin SECURITY DEFINER: corre con los privilegios del usuario que llama,
-- igual que el resto de RPCs de dashboard_reportes_rpc.sql.
CREATE OR REPLACE FUNCTION dashboard_prediccion_demanda()
RETURNS TABLE (dia_semana INTEGER, promedio NUMERIC, turnos_comparados INTEGER)
LANGUAGE sql STABLE AS $$
    WITH parametros AS (
        SELECT EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Mexico_City') + INTERVAL '1 day')::INTEGER AS dow_manana
    ),
    turnos_totales AS (
        SELECT
            t.id,
            t.abierto_en,
            COALESCE(SUM(m.monto), 0) AS total_cobrado
        FROM turnos t
        JOIN parametros
            ON EXTRACT(DOW FROM t.abierto_en AT TIME ZONE 'America/Mexico_City')::INTEGER = parametros.dow_manana
        LEFT JOIN movimientos_caja m
            ON m.turno_id = t.id AND m.tipo = 'cobro'
        WHERE t.estado = 'cerrado'
        GROUP BY t.id, t.abierto_en
    ),
    rankeados AS (
        SELECT
            turnos_totales.*,
            ROW_NUMBER() OVER (ORDER BY abierto_en DESC) AS rn
        FROM turnos_totales
    )
    SELECT
        (SELECT dow_manana FROM parametros),
        AVG(total_cobrado),
        COUNT(*)::INTEGER
    FROM rankeados
    WHERE rn <= 8
$$;
