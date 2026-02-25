-- Permite mesa_id = NULL en pedidos cerrados (necesario para eliminar mesas temporales).
-- El CHECK original bloqueaba: tipo='mesa' AND estado='cerrado' con mesa_id=NULL,
-- impidiendo liberar la FK antes de hacer DELETE en mesas.

ALTER TABLE pedidos DROP CONSTRAINT mesa_requerida_si_no_llevar;

ALTER TABLE pedidos ADD CONSTRAINT mesa_requerida_si_no_llevar
  CHECK (tipo = 'llevar' OR estado = 'cerrado' OR mesa_id IS NOT NULL);
