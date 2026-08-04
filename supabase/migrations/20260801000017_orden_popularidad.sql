-- Cuarta opción de config_sistema.orden_modificadores: 'popularidad', ordena
-- las opciones de cada grupo por cuántas veces se eligieron en los últimos
-- `orden_popularidad_dias` días — calculado al vuelo en cargarModificadores()/
-- cargarGuisados() (POS), nunca en el editor de Catálogo (que se queda con
-- el orden alfabético/personalizado existente cuando el modo es 'popularidad').
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS orden_popularidad_dias INTEGER NOT NULL DEFAULT 30;

ALTER TABLE config_sistema
  DROP CONSTRAINT IF EXISTS config_sistema_orden_modificadores_check;
ALTER TABLE config_sistema
  ADD CONSTRAINT config_sistema_orden_modificadores_check
    CHECK (orden_modificadores IN ('alfabetico_asc', 'alfabetico_desc', 'personalizado', 'popularidad'));

-- Cuenta de veces que cada opción (de la lista p_opcion_ids) se eligió en
-- pedidos de los últimos p_dias días — pedido_producto_opciones →
-- pedido_productos → subpedidos → pedidos.created_at. Acotado a los ids que
-- pide el caller (opciones de un solo producto), no un escaneo global.
CREATE OR REPLACE FUNCTION popularidad_opciones_modificador(
    p_opcion_ids INTEGER[],
    p_dias INTEGER
)
RETURNS TABLE (
    opcion_id INTEGER,
    conteo BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT ppo.opcion_id, COUNT(*) AS conteo
    FROM pedido_producto_opciones ppo
    JOIN pedido_productos pp ON pp.id = ppo.pedido_producto_id
    JOIN subpedidos sp ON sp.id = pp.subpedido_id
    JOIN pedidos p ON p.id = sp.pedido_id
    WHERE ppo.opcion_id = ANY(p_opcion_ids)
      AND p.created_at >= NOW() - (p_dias || ' days')::interval
    GROUP BY ppo.opcion_id;
$$;
