-- ============================================================
-- Griselda POS — Migración 002: Row Level Security
-- ============================================================
-- Política general:
--   Admin → acceso total (SELECT, INSERT, UPDATE, DELETE)
--   Mesero → acceso operativo (sin config, sin cierre de turno)
--   Anónimo → sin acceso (Supabase bloquea por defecto con RLS activo)
-- ============================================================

-- ========================
-- Activar RLS en todas las tablas
-- ========================

ALTER TABLE perfiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_sistema      ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE impresoras          ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_impresora    ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_productos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_modificadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE opciones_modificador ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE subpedidos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_producto_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancelaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE descuentos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_caja    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobro_subpedidos    ENABLE ROW LEVEL SECURITY;

-- ========================
-- PERFILES
-- Cada usuario ve y edita solo su propio perfil.
-- Admin puede ver todos.
-- ========================

CREATE POLICY "perfil_propio_select"
    ON perfiles FOR SELECT
    USING (id = auth.uid() OR es_admin());

CREATE POLICY "perfil_propio_update"
    ON perfiles FOR UPDATE
    USING (id = auth.uid() OR es_admin());

-- Solo el trigger (SECURITY DEFINER) inserta perfiles. Sin policy de INSERT manual.

-- ========================
-- CONFIG_SISTEMA — solo Admin
-- ========================

CREATE POLICY "config_admin_select"
    ON config_sistema FOR SELECT
    USING (es_admin());

CREATE POLICY "config_admin_update"
    ON config_sistema FOR UPDATE
    USING (es_admin());

-- ========================
-- CATÁLOGO (areas, mesas, impresoras, grupos_impresora, categorias,
--           productos, combo_productos, grupos_modificadores, opciones_modificador)
-- SELECT: Admin + Mesero (necesitan ver el menú)
-- INSERT/UPDATE/DELETE: solo Admin
-- ========================

-- areas
CREATE POLICY "areas_select_all"    ON areas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "areas_admin_write"   ON areas FOR ALL    USING (es_admin());

-- mesas
CREATE POLICY "mesas_select_all"   ON mesas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mesas_admin_write"  ON mesas FOR ALL    USING (es_admin());

-- El estado de la mesa (libre/ocupada) NUNCA lo actualiza el cliente directamente.
-- Lo hace la función SECURITY DEFINER set_estado_mesa, llamada desde Server Actions
-- al abrir o cerrar un pedido. Esto garantiza que el cambio de estado siempre
-- ocurre junto con la transacción del pedido, sin exponer UPDATE en RLS.
CREATE OR REPLACE FUNCTION set_estado_mesa(p_mesa_id INTEGER, p_estado estado_mesa)
RETURNS VOID AS $$
BEGIN
    UPDATE mesas SET estado = p_estado WHERE id = p_mesa_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- impresoras
CREATE POLICY "impresoras_select_all"  ON impresoras FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "impresoras_admin_write" ON impresoras FOR ALL    USING (es_admin());

-- grupos_impresora
CREATE POLICY "grupos_imp_select_all"  ON grupos_impresora FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "grupos_imp_admin_write" ON grupos_impresora FOR ALL    USING (es_admin());

-- categorias
CREATE POLICY "categorias_select_all"  ON categorias FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "categorias_admin_write" ON categorias FOR ALL    USING (es_admin());

-- productos
CREATE POLICY "productos_select_all"  ON productos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "productos_admin_write" ON productos FOR ALL    USING (es_admin());

-- El Admin activa/desactiva disponibilidad diaria
-- El Mesero NO puede cambiar disponible (eso es función del Admin en "menú del día")
-- Nota: si se decide que el mesero también puede marcar agotados, ajustar esta policy.

-- combo_productos
CREATE POLICY "combos_select_all"  ON combo_productos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "combos_admin_write" ON combo_productos FOR ALL    USING (es_admin());

-- grupos_modificadores
CREATE POLICY "grupos_mod_select_all"  ON grupos_modificadores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "grupos_mod_admin_write" ON grupos_modificadores FOR ALL    USING (es_admin());

-- opciones_modificador
CREATE POLICY "opciones_select_all"  ON opciones_modificador FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "opciones_admin_write" ON opciones_modificador FOR ALL    USING (es_admin());

-- ========================
-- TURNOS — Admin abre/cierra, ambos ven el turno activo
-- ========================

CREATE POLICY "turnos_select_all"   ON turnos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "turnos_admin_write"  ON turnos FOR ALL    USING (es_admin());

-- ========================
-- OPERACIÓN: pedidos, subpedidos, pedido_productos, pedido_producto_opciones
-- Admin + Mesero tienen acceso completo durante el turno.
-- ========================

CREATE POLICY "pedidos_all_auth"  ON pedidos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "subpedidos_all_auth" ON subpedidos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "ped_prod_all_auth" ON pedido_productos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "ped_prod_opc_all_auth" ON pedido_producto_opciones FOR ALL USING (auth.uid() IS NOT NULL);

-- ========================
-- CANCELACIONES
-- INSERT: Admin siempre. Mesero solo si cancelaciones_mesero=TRUE en config.
-- SELECT: ambos.
-- ========================

CREATE POLICY "cancelaciones_select_all"
    ON cancelaciones FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "cancelaciones_insert_admin"
    ON cancelaciones FOR INSERT
    WITH CHECK (
        es_admin()
        OR (
            SELECT cancelaciones_mesero FROM config_sistema WHERE id = 1
        )
    );

-- ========================
-- DESCUENTOS
-- INSERT: Admin siempre. Mesero solo si descuentos_mesero=TRUE en config.
-- SELECT: ambos.
-- ========================

CREATE POLICY "descuentos_select_all"
    ON descuentos FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "descuentos_insert_admin"
    ON descuentos FOR INSERT
    WITH CHECK (
        es_admin()
        OR (
            SELECT descuentos_mesero FROM config_sistema WHERE id = 1
        )
    );

-- ========================
-- CAJA: movimientos_caja, pagos, cobro_subpedidos
-- Admin + Mesero insertan (cobros). Solo Admin ve reportes completos en UI,
-- pero a nivel DB ambos pueden SELECT (el filtro de UI lo hace el frontend).
-- ========================

CREATE POLICY "mov_caja_all_auth"     ON movimientos_caja FOR ALL  USING (auth.uid() IS NOT NULL);
CREATE POLICY "pagos_all_auth"        ON pagos FOR ALL              USING (auth.uid() IS NOT NULL);
CREATE POLICY "cobro_sub_all_auth"    ON cobro_subpedidos FOR ALL   USING (auth.uid() IS NOT NULL);
