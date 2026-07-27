-- ============================================================
-- Griselda POS — Inventario: proveedores, insumos, compras, recetas
-- ============================================================
-- "insumos" reemplaza el nombre "ingredientes" del spec original para no
-- chocar con la tabla `ingredientes` ya existente (20260225000003), que es
-- un catálogo simple de disponibilidad para opciones_modificador y no tiene
-- relación con este esquema de costos/stock.
--
-- movimientos_inventario es la bitácora auditable de todo cambio de stock.
-- Nunca se inserta directo (ninguna policy de INSERT/UPDATE/DELETE para
-- usuarios) — solo la función registrar_compra() (SECURITY DEFINER) escribe
-- ahí, igual que set_estado_mesa() en 20260223000002_rls_politicas.sql.
-- ============================================================

-- ========================
-- ENUMS
-- ========================

CREATE TYPE unidad_medida AS ENUM ('kg', 'g', 'l', 'ml', 'pieza', 'paquete');

CREATE TYPE tipo_movimiento_inventario AS ENUM (
    'entrada_compra',
    'salida_venta',
    'merma',
    'ajuste',
    'reversion_cancelacion'
);

-- ========================
-- PROVEEDORES
-- ========================

CREATE TABLE proveedores (
    id         SERIAL PRIMARY KEY,
    nombre     TEXT NOT NULL,
    telefono   TEXT,
    contacto   TEXT,
    notas      TEXT,
    activo     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- INSUMOS
-- stock_actual se actualiza únicamente vía movimientos_inventario
-- (registrar_compra() al día de hoy; futuras funciones para venta/merma/ajuste).
-- ========================

CREATE TABLE insumos (
    id            SERIAL PRIMARY KEY,
    nombre        TEXT NOT NULL,
    unidad_medida unidad_medida NOT NULL,
    stock_actual  NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0,
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- COMPRAS
-- Encabezado de una compra a un proveedor.
-- ========================

CREATE TABLE compras (
    id           SERIAL PRIMARY KEY,
    proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
    fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
    numero_nota  TEXT,
    total        NUMERIC(10,2) NOT NULL,
    usuario_id   UUID REFERENCES auth.users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- COMPRA_ITEMS
-- Líneas de una compra. Cada fila ES el historial de precio de ese insumo
-- en esa fecha — el "costo actual" de un insumo es el costo_unitario del
-- compra_item más reciente (join con compras.fecha), sin tabla aparte.
-- ========================

CREATE TABLE compra_items (
    id             SERIAL PRIMARY KEY,
    compra_id      INTEGER NOT NULL REFERENCES compras(id),
    insumo_id      INTEGER NOT NULL REFERENCES insumos(id),
    cantidad       NUMERIC(12,3) NOT NULL,
    costo_unitario NUMERIC(10,2) NOT NULL,
    costo_total    NUMERIC(10,2) NOT NULL
);

-- ========================
-- RECETAS
-- El recetario: producto + preparación. El costo de una receta se calcula
-- a partir de receta_insumos (cantidad_usada × costo actual del insumo).
-- ========================

CREATE TABLE recetas (
    id              SERIAL PRIMARY KEY,
    producto_id     INTEGER NOT NULL REFERENCES productos(id),
    nombre          TEXT NOT NULL,
    rendimiento     TEXT,             -- ej. "1 porción" / "10 tacos"
    instrucciones   TEXT,             -- pasos de preparación, texto libre o numerado
    tiempo_prep_min INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- RECETA_INSUMOS
-- Qué insumos lleva cada receta y en qué cantidad.
-- ========================

CREATE TABLE receta_insumos (
    id             SERIAL PRIMARY KEY,
    receta_id      INTEGER NOT NULL REFERENCES recetas(id),
    insumo_id      INTEGER NOT NULL REFERENCES insumos(id),
    cantidad_usada NUMERIC(12,3) NOT NULL,
    unidad_medida  unidad_medida NOT NULL
);

-- ========================
-- MOVIMIENTOS_INVENTARIO
-- Bitácora auditable de todo cambio de stock.
-- ========================

CREATE TABLE movimientos_inventario (
    id              SERIAL PRIMARY KEY,
    insumo_id       INTEGER NOT NULL REFERENCES insumos(id),
    tipo            tipo_movimiento_inventario NOT NULL,
    cantidad        NUMERIC(12,3) NOT NULL,  -- positivo = entra, negativo = sale
    referencia_tipo TEXT,                    -- ej. 'compra', 'pedido_producto'
    referencia_id   INTEGER,
    usuario_id      UUID REFERENCES auth.users(id),
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- Índices
-- ========================

CREATE INDEX idx_compras_proveedor          ON compras(proveedor_id);
CREATE INDEX idx_compra_items_compra        ON compra_items(compra_id);
CREATE INDEX idx_compra_items_insumo        ON compra_items(insumo_id);
CREATE INDEX idx_recetas_producto           ON recetas(producto_id);
CREATE INDEX idx_receta_insumos_receta      ON receta_insumos(receta_id);
CREATE INDEX idx_receta_insumos_insumo      ON receta_insumos(insumo_id);
CREATE INDEX idx_movimientos_inv_insumo     ON movimientos_inventario(insumo_id);
CREATE INDEX idx_movimientos_inv_tipo       ON movimientos_inventario(tipo);
CREATE INDEX idx_movimientos_inv_referencia ON movimientos_inventario(referencia_tipo, referencia_id);

-- ========================
-- RLS
-- Mismo patrón que productos: admin escribe, cualquier autenticado lee.
-- movimientos_inventario es la excepción: solo SELECT, ningún INSERT/UPDATE/
-- DELETE vía policy — solo registrar_compra() (SECURITY DEFINER) escribe ahí.
-- ========================

ALTER TABLE proveedores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras              ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE receta_insumos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_select_all"  ON proveedores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "proveedores_admin_write" ON proveedores FOR ALL    USING (es_admin());

CREATE POLICY "insumos_select_all"  ON insumos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "insumos_admin_write" ON insumos FOR ALL    USING (es_admin());

CREATE POLICY "compras_select_all"  ON compras FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "compras_admin_write" ON compras FOR ALL    USING (es_admin());

CREATE POLICY "compra_items_select_all"  ON compra_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "compra_items_admin_write" ON compra_items FOR ALL    USING (es_admin());

CREATE POLICY "recetas_select_all"  ON recetas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "recetas_admin_write" ON recetas FOR ALL    USING (es_admin());

CREATE POLICY "receta_insumos_select_all"  ON receta_insumos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "receta_insumos_admin_write" ON receta_insumos FOR ALL    USING (es_admin());

-- Sin policy de INSERT/UPDATE/DELETE a propósito: solo lectura para usuarios.
CREATE POLICY "movimientos_inv_select_all" ON movimientos_inventario FOR SELECT USING (auth.uid() IS NOT NULL);

-- ========================
-- registrar_compra()
-- Inserta la compra, sus items y los movimientos de inventario en una sola
-- transacción, y actualiza insumos.stock_actual. SECURITY DEFINER: corre
-- con los privilegios del dueño de la función (bypassa RLS de
-- movimientos_inventario), por eso valida es_admin() internamente en vez
-- de depender de las policies de las tablas que toca.
--
-- p_items: jsonb, arreglo de objetos {"insumo_id", "cantidad", "costo_unitario"}
-- Devuelve el id de la compra creada.
-- ========================

CREATE OR REPLACE FUNCTION registrar_compra(
    p_proveedor_id INTEGER,
    p_fecha        DATE,
    p_numero_nota  TEXT,
    p_items        JSONB
)
RETURNS INTEGER AS $$
DECLARE
    v_compra_id      INTEGER;
    v_total          NUMERIC(10,2);
    v_item           JSONB;
    v_insumo_id      INTEGER;
    v_cantidad       NUMERIC(12,3);
    v_costo_unitario NUMERIC(10,2);
BEGIN
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden registrar compras.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La compra debe tener al menos un item.';
    END IF;

    SELECT COALESCE(SUM((item->>'cantidad')::NUMERIC * (item->>'costo_unitario')::NUMERIC), 0)
    INTO v_total
    FROM jsonb_array_elements(p_items) AS item;

    INSERT INTO compras (proveedor_id, fecha, numero_nota, total, usuario_id)
    VALUES (p_proveedor_id, COALESCE(p_fecha, CURRENT_DATE), p_numero_nota, v_total, auth.uid())
    RETURNING id INTO v_compra_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_insumo_id      := (v_item->>'insumo_id')::INTEGER;
        v_cantidad       := (v_item->>'cantidad')::NUMERIC;
        v_costo_unitario := (v_item->>'costo_unitario')::NUMERIC;

        IF v_cantidad <= 0 THEN
            RAISE EXCEPTION 'La cantidad del insumo % debe ser mayor a cero.', v_insumo_id;
        END IF;

        INSERT INTO compra_items (compra_id, insumo_id, cantidad, costo_unitario, costo_total)
        VALUES (v_compra_id, v_insumo_id, v_cantidad, v_costo_unitario, v_cantidad * v_costo_unitario);

        INSERT INTO movimientos_inventario
            (insumo_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id)
        VALUES
            (v_insumo_id, 'entrada_compra', v_cantidad, 'compra', v_compra_id, auth.uid());

        UPDATE insumos SET stock_actual = stock_actual + v_cantidad WHERE id = v_insumo_id;
    END LOOP;

    RETURN v_compra_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
