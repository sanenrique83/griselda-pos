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
  precio: number
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
      mesa: string
      items: ItemCliente[]
      subtotal: number
      propina: number
      total: number
      metodo: string
      recibido: number | null
      cambio: number | null
    }

const _printBase =
  process.env.NEXT_PUBLIC_PRINT_SERVER_URL ?? 'http://192.168.1.31:5000'
const PRINT_SERVER = _printBase.endsWith('/print')
  ? _printBase
  : `${_printBase.replace(/\/$/, '')}/print`

export async function imprimirTicket(payload: PrintPayload): Promise<boolean> {
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
