-- ============================================================
-- Nuevo valor de enum para reponer stock por producción de un insumo
-- derivado — EN SU PROPIA MIGRACIÓN, sin nada más (mismo motivo que
-- 20260726000008_enum_values_reventa_mostrador.sql: ALTER TYPE ... ADD
-- VALUE no puede usarse en la misma transacción en la que luego se usa ese
-- valor). registrar_produccion() lo usa en
-- 20260727000006_insumo_receta_producciones.sql.
--
-- 'salida_produccion' ya existía (Fase F, consumo del insumo crudo al
-- registrar un lote). Falta el símétrico para cuando lo que se repone es
-- stock de un insumo derivado (ej. "Adobada preparada").
-- ============================================================

ALTER TYPE tipo_movimiento_inventario ADD VALUE IF NOT EXISTS 'entrada_produccion';
