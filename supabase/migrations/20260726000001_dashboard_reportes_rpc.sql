-- ============================================================
-- Dashboard: reportes históricos vía RPC
-- Agregaciones que antes se hacían en JS trayendo todos los turnos
-- cerrados al frontend. Se mueven a SQL para no escanear el histórico
-- completo desde el cliente conforme crece la operación.
-- Sin SECURITY DEFINER: corren con los privilegios del usuario que
-- llama (RLS de turnos/movimientos_caja ya permite SELECT a cualquier
-- usuario autenticado, igual que hoy).
-- ============================================================

-- Turno cerrado más reciente que abrió en una fecha calendario dada
-- (America/Mexico_City), junto con su total cobrado. Usado para el
-- comparativo "vs. mismo día hace 7 días".
CREATE OR REPLACE FUNCTION dashboard_turno_por_fecha(p_fecha DATE)
RETURNS TABLE (turno_id INTEGER, total_cobrado NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT t.id, COALESCE(SUM(m.monto), 0)
    FROM turnos t
    LEFT JOIN movimientos_caja m
        ON m.turno_id = t.id AND m.tipo = 'cobro'
    WHERE t.estado = 'cerrado'
      AND (t.abierto_en AT TIME ZONE 'America/Mexico_City')::date = p_fecha
    GROUP BY t.id
    ORDER BY t.id DESC
    LIMIT 1
$$;

-- Ventas promedio por día de la semana, usando los últimos 8 turnos
-- cerrados de cada día (0=domingo … 6=sábado, America/Mexico_City).
CREATE OR REPLACE FUNCTION dashboard_ventas_promedio_dia_semana()
RETURNS TABLE (dia_semana INTEGER, promedio NUMERIC, turnos_contados INTEGER)
LANGUAGE sql STABLE AS $$
    WITH turnos_totales AS (
        SELECT
            t.id,
            EXTRACT(DOW FROM t.abierto_en AT TIME ZONE 'America/Mexico_City')::INTEGER AS dow,
            t.abierto_en,
            COALESCE(SUM(m.monto), 0) AS total_cobrado
        FROM turnos t
        LEFT JOIN movimientos_caja m
            ON m.turno_id = t.id AND m.tipo = 'cobro'
        WHERE t.estado = 'cerrado'
        GROUP BY t.id
    ),
    rankeados AS (
        SELECT
            turnos_totales.*,
            ROW_NUMBER() OVER (PARTITION BY dow ORDER BY abierto_en DESC) AS rn
        FROM turnos_totales
    )
    SELECT dow, AVG(total_cobrado), COUNT(*)::INTEGER
    FROM rankeados
    WHERE rn <= 8
    GROUP BY dow
$$;

-- Comparación de ventas promedio en fechas de temporada alta vs. el
-- mismo día de la semana en fechas normales (excluyendo las fechas
-- de temporada alta de la muestra "normal").
CREATE OR REPLACE FUNCTION dashboard_temporada_alta(p_fechas DATE[])
RETURNS TABLE (
    promedio_alta NUMERIC,
    turnos_alta INTEGER,
    promedio_normal NUMERIC,
    turnos_normal INTEGER
)
LANGUAGE sql STABLE AS $$
    WITH turnos_totales AS (
        SELECT
            t.id,
            (t.abierto_en AT TIME ZONE 'America/Mexico_City')::date AS fecha,
            EXTRACT(DOW FROM t.abierto_en AT TIME ZONE 'America/Mexico_City')::INTEGER AS dow,
            COALESCE(SUM(m.monto), 0) AS total_cobrado
        FROM turnos t
        LEFT JOIN movimientos_caja m
            ON m.turno_id = t.id AND m.tipo = 'cobro'
        WHERE t.estado = 'cerrado'
        GROUP BY t.id
    ),
    alta AS (
        SELECT * FROM turnos_totales WHERE fecha = ANY(p_fechas)
    ),
    dias_alta AS (
        SELECT DISTINCT dow FROM alta
    ),
    normal AS (
        SELECT tt.*
        FROM turnos_totales tt
        JOIN dias_alta da ON da.dow = tt.dow
        WHERE NOT (tt.fecha = ANY(p_fechas))
    )
    SELECT
        (SELECT AVG(total_cobrado) FROM alta),
        (SELECT COUNT(*)::INTEGER FROM alta),
        (SELECT AVG(total_cobrado) FROM normal),
        (SELECT COUNT(*)::INTEGER FROM normal)
$$;
