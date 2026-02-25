-- Ampliar config_sistema con datos bancarios para transferencia y permisos de mesero
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS transferencia_banco    TEXT,
  ADD COLUMN IF NOT EXISTS transferencia_clabe    TEXT,
  ADD COLUMN IF NOT EXISTS transferencia_titular  TEXT,
  ADD COLUMN IF NOT EXISTS cancelar_pedido_mesero BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ver_dashboard_mesero   BOOLEAN NOT NULL DEFAULT FALSE;
