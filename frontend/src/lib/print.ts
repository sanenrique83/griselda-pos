export type ItemCocina = {
  cantidad: number
  nombre: string
  modificadores: string[]
  nota: string
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
      items: ItemCocina[]
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

const PRINT_SERVER =
  process.env.NEXT_PUBLIC_PRINT_SERVER_URL ?? 'http://192.168.1.31:5000/print'

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
