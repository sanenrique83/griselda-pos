-- ============================================================
-- Venta de artículos de reventa (souvenirs) + ventas de mostrador.
-- Requiere que 20260726000008_enum_values_reventa_mostrador.sql ya haya
-- sido aplicada y commiteada (valores de enum 'reventa' y 'mostrador').
-- ============================================================

-- ========================
-- pedidos: 'mostrador' se comporta como 'llevar' — sin mesa asignada.
-- Mismo patrón que la migración 20260225000001 (que ya permitía mesa_id
-- NULL también en pedidos cerrados, para poder liberar la FK antes de
-- eliminar la mesa).
-- ========================

ALTER TABLE pedidos DROP CONSTRAINT mesa_requerida_si_no_llevar;

ALTER TABLE pedidos ADD CONSTRAINT mesa_requerida_si_no_llevar_ni_mostrador
    CHECK (tipo IN ('llevar', 'mostrador') OR estado = 'cerrado' OR mesa_id IS NOT NULL);

-- ========================
-- Productos de reventa (souvenirs: tequila, cremas, llaveros, etc.)
-- No requieren cambios de código: un producto de reventa tiene una receta
-- con modo_preparacion='reventa' y exactamente un receta_insumo en
-- cantidad 1 (el artículo mismo es el insumo — ej. insumo "Llavero agave"
-- con su propio stock_actual y costo vía compra_items). Se valida en la
-- app (guardarReceta) al guardar la receta, no aquí.
--
-- aplicar_consumo_receta() (20260726000006 / 20260726000007) ya trata
-- 'reventa' de forma correcta SIN modificarse: su único branch especial es
-- 'por_lote' (resta de recetas.porciones_disponibles); cualquier otro
-- modo_preparacion — 'por_orden' y ahora 'reventa' — cae al branch por
-- defecto, que descuenta insumos.stock_actual vía receta_insumos e inserta
-- un movimientos_inventario tipo 'salida_venta'. Para un producto de
-- reventa esto descuenta exactamente 1 unidad del insumo-artículo por
-- unidad vendida, que es el comportamiento deseado.
-- ============================================================
