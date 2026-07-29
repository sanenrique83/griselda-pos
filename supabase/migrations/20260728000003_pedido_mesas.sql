-- ========================
-- PEDIDO_MESAS
-- "Unir mesas" pasa de ser instantáneo (mover comensales y liberar la mesa
-- origen) a persistente: la mesa origen queda ocupada como mesa satélite del
-- mismo pedido destino hasta que ese pedido se cobre por completo. Esta tabla
-- registra esas mesas satélite; la mesa "principal" del pedido sigue siendo
-- pedidos.mesa_id como siempre.
-- ========================

CREATE TABLE pedido_mesas (
    id         SERIAL PRIMARY KEY,
    pedido_id  INTEGER NOT NULL REFERENCES pedidos(id),
    mesa_id    INTEGER NOT NULL REFERENCES mesas(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pedido_mesa_unico UNIQUE (pedido_id, mesa_id)
);

ALTER TABLE pedido_mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedido_mesas_all_auth" ON pedido_mesas FOR ALL USING (auth.uid() IS NOT NULL);
