-- Separar la propina en efectivo (retirable físicamente del cajón) de la
-- propina en tarjeta/transferencia (queda en la terminal bancaria y nunca
-- toca el cajón). movimientos_caja.propina se conserva como total histórico.

ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS propina_efectivo NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS propina_tarjeta  NUMERIC NOT NULL DEFAULT 0;

UPDATE movimientos_caja SET propina_efectivo = propina WHERE propina > 0;
