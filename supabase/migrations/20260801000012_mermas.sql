-- Mermas de inventario (producto echado a perder, derramado, etc.) como
-- concepto propio, distinto de venta/cancelación/compra. Reutiliza el mismo
-- mecanismo de movimientos_inventario que ya usan registrar_compra() y
-- registrar_produccion() — tipo='merma' ya existía en el enum
-- tipo_movimiento_inventario sin usar, así que no hace falta ALTER TYPE.

CREATE TABLE mermas (
    id         SERIAL PRIMARY KEY,
    insumo_id  INTEGER NOT NULL REFERENCES insumos(id),
    cantidad   NUMERIC(12,3) NOT NULL,
    motivo     TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mermas_insumo ON mermas(insumo_id);
CREATE INDEX idx_mermas_created_at ON mermas(created_at);

ALTER TABLE mermas ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que insumos/compras: lectura para cualquier usuario
-- autenticado, escritura directa solo para admin. El INSERT real de una
-- merma pasa por registrar_merma() (SECURITY DEFINER) para mantener
-- mermas y movimientos_inventario sincronizados en una sola transacción —
-- ver comentario de intención en movimientos_inventario_rls_intencional.
CREATE POLICY "mermas_select_all"  ON mermas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mermas_admin_write" ON mermas FOR ALL    USING (es_admin());

-- Registra una merma: descuenta insumos.stock_actual, inserta el movimiento
-- de inventario (tipo='merma', cantidad negativa) y la fila de detalle en
-- mermas con su motivo — todo en una sola transacción, mismo patrón que
-- registrar_compra()/registrar_produccion().
CREATE OR REPLACE FUNCTION registrar_merma(
    p_insumo_id INTEGER,
    p_cantidad  NUMERIC,
    p_motivo    TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_merma_id INTEGER;
BEGIN
    IF NOT es_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden registrar mermas.';
    END IF;

    IF p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a cero.';
    END IF;

    IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
        RAISE EXCEPTION 'Indica un motivo.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM insumos WHERE id = p_insumo_id) THEN
        RAISE EXCEPTION 'Insumo no encontrado.';
    END IF;

    INSERT INTO mermas (insumo_id, cantidad, motivo, usuario_id)
    VALUES (p_insumo_id, p_cantidad, btrim(p_motivo), auth.uid())
    RETURNING id INTO v_merma_id;

    INSERT INTO movimientos_inventario
        (insumo_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, notas)
    VALUES
        (p_insumo_id, 'merma', -p_cantidad, 'merma', v_merma_id, auth.uid(), btrim(p_motivo));

    UPDATE insumos SET stock_actual = stock_actual - p_cantidad WHERE id = p_insumo_id;

    RETURN v_merma_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
