-- Alerta de precuenta impresa hace tiempo sin que se haya cobrado — señal
-- de que la mesa probablemente ya está lista para pagar pero nadie ha
-- vuelto a cobrar. precuenta_impresa_en se limpia (NULL) en cuanto ocurre
-- cualquier cobro real sobre el pedido (parcial o total) — ver
-- cobrarPedido() en cobro/[pedidoId]/actions.ts.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS precuenta_impresa_en TIMESTAMPTZ;

ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS alerta_precuenta_activa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS alerta_precuenta_minutos INTEGER NOT NULL DEFAULT 5;
