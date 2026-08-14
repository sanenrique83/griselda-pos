-- ══════════════════════════════════════════════════════════════════════════
-- Cierre del hueco de seguridad en tablas de caja — Parte 2: RLS.
--
-- ⚠️ NO APLICAR esta migración hasta que 20260801000031 (las 4 funciones)
-- ya esté aplicada Y el código de frontend que las usa vía supabase.rpc()
-- ya esté desplegado en producción. Aplicar esto antes rompe el cobro en
-- vivo de inmediato — las policies "FOR ALL" actuales son el único camino
-- que el código viejo (inserts directos) puede usar.
--
-- movimientos_caja, pagos, cobro_subpedidos pasan de "cualquier autenticado
-- puede insertar/actualizar/borrar directo" a "cualquier autenticado puede
-- LEER, nada más" — todo insert/update pasa exclusivamente por
-- cobrar_pedido_seguro(), registrar_fondo_caja(), anular_pedido_seguro() y
-- cancelar_item_seguro() (ver 20260801000031), cada una SECURITY DEFINER
-- con su propio chequeo de permiso adentro. reabrir_pedido() ya era
-- SECURITY DEFINER desde antes (20260727000001) — sigue funcionando igual,
-- sin tocarla: al bypassar RLS por ser SECURITY DEFINER, nunca dependió de
-- estas policies para poder hacer sus DELETE.
-- ══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "mov_caja_all_auth"  ON movimientos_caja;
DROP POLICY IF EXISTS "pagos_all_auth"     ON pagos;
DROP POLICY IF EXISTS "cobro_sub_all_auth" ON cobro_subpedidos;

CREATE POLICY "mov_caja_select_auth"
    ON movimientos_caja FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "pagos_select_auth"
    ON pagos FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "cobro_sub_select_auth"
    ON cobro_subpedidos FOR SELECT
    USING (auth.uid() IS NOT NULL);
