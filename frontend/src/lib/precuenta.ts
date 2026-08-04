import { minutosTranscurridos } from './tiempoMesa'

// Aviso de precuenta impresa hace tiempo sin que se haya cobrado — indicador
// APARTE del semáforo de color de la mesa (ver colorMesa.ts): ese refleja
// atención/urgencia de la comanda, esto es una señal independiente de que
// probablemente ya están listos para pagar.
export function minutosDesdePrecuenta(precuentaImpresaEn: string, ahoraMs: number = Date.now()): number {
  return minutosTranscurridos(precuentaImpresaEn, ahoraMs)
}

export function mostrarAvisoPrecuenta(
  precuentaImpresaEn: string | null,
  alertaActiva: boolean,
  alertaMinutos: number,
  ahoraMs: number = Date.now(),
): boolean {
  if (!alertaActiva || !precuentaImpresaEn) return false
  return minutosDesdePrecuenta(precuentaImpresaEn, ahoraMs) >= alertaMinutos
}
