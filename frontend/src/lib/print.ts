export interface ItemCocina {
  cantidad: number
  nombre: string
  modificadores: string[]
  nota?: string
  esBebida?: boolean
}

export interface ComensalCocina {
  comensal: string
  items: ItemCocina[]
}

export type ItemCliente = {
  nombre: string
  cantidad: number
  precio: number // precio unitario consolidado (base + extras)
  modificadores?: string[]
}

export type IndividualComensal = {
  comensalNombre: string
  items: ItemCliente[]
  subtotal: number
  total: number
  metodo?: string
  recibido?: number | null
  cambio?: number | null
}

export type TicketConfig = {
  nombre: string
  direccion: string
  telefono: string
  rfc: string
  linea1: string
  linea2: string
  pie: string
  pie2: string
}

export type PrintPayload =
  | {
      tipo: 'cocina'
      mesa: string
      mesero: string
      orden: string
      rol: string
      tipoMesa: 'mesa' | 'llevar'
      comensales: ComensalCocina[]
    }
  | {
      tipo: 'cliente'
      escenario: 'individual'
      mesa: string
      config: TicketConfig
      /** Un elemento por subpedido. El servidor imprime un ticket con corte por cada uno. */
      comensales: IndividualComensal[]
    }
  | {
      tipo: 'cliente'
      escenario: 'global' | 'varios' | 'dividir' | 'precuenta'
      mesa: string
      items: ItemCliente[]
      subtotal: number
      descuento?: number
      propina: number
      total: number
      metodo: string
      recibido: number | null
      cambio: number | null
      config: TicketConfig
      comensalesSeleccionados?: string[] // varios
      parteActual?: number               // dividir
      totalPartes?: number               // dividir
    }

const _printBase =
  process.env.NEXT_PUBLIC_PRINT_SERVER_URL ?? 'http://192.168.1.31:5000'
const PRINT_SERVER = _printBase.endsWith('/print')
  ? _printBase
  : `${_printBase.replace(/\/$/, '')}/print`

export async function imprimirTicket(
  payload: PrintPayload,
  enabled = true,
): Promise<boolean> {
  if (!enabled) return true // impresión deshabilitada globalmente — no es un error
  try {
    const res = await fetch(PRINT_SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
