import type { HistorialPrecioItem } from './page'

/** Convierte una fila cruda del RPC historial_precios_compras al tipo tipado. */
export function mapHistorialRow(r: any): HistorialPrecioItem {
  return {
    compraId: r.compra_id,
    fecha: r.fecha,
    numeroNota: r.numero_nota ?? null,
    compraTotal: r.compra_total,
    proveedorId: r.proveedor_id,
    proveedorNombre: r.proveedor_nombre,
    insumoId: r.insumo_id,
    insumoNombre: r.insumo_nombre,
    unidadMedida: r.unidad_medida,
    cantidad: r.cantidad,
    costoUnitario: r.costo_unitario,
    costoUnitarioAnterior: r.costo_unitario_anterior ?? null,
    diferencia: r.diferencia ?? null,
  }
}
