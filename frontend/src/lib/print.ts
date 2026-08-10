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

/**
 * Suma cantidades de items idénticos (mismo nombre + mismos modificadores +
 * mismo precio unitario) en uno solo. Se usa para "Cuenta general" y "Uno
 * paga varios" — donde no importa quién pidió cada cosa, solo el total del
 * platillo. NO se usa en tickets "Individual" (ahí cada comensal debe ver
 * su propio detalle por separado, sin mezclarse con el de otros).
 */
export function consolidarItemsCliente(items: ItemCliente[]): ItemCliente[] {
  const mapa = new Map<string, ItemCliente>()
  for (const item of items) {
    // El orden alfabético es SOLO para la clave de agrupación (que dos items
    // con los mismos modificadores en distinto orden se reconozcan como
    // iguales) — lo que se guarda para mostrar conserva el orden original
    // de item.modificadores (orden de configuración: grupo/opción).
    const modsOrdenados = [...(item.modificadores ?? [])].sort()
    const clave = `${item.nombre}|${item.precio}|${modsOrdenados.join('+')}`
    const existente = mapa.get(clave)
    if (existente) {
      existente.cantidad += item.cantidad
    } else {
      mapa.set(clave, { ...item, modificadores: item.modificadores?.length ? item.modificadores : undefined })
    }
  }
  return [...mapa.values()]
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
  // Subtítulo opcional, en fuente normal, como su propia línea debajo del
  // nombre (que se imprime en doble ancho) — ej. giro del negocio.
  subtitulo: string
  direccion: string
  telefono: string
  rfc: string
  linea1: string
  linea2: string
  pie: string
  pie2: string
  // Cuántos modificadores caben por línea (cocina y cliente) — 1 = uno por
  // línea. Nombre en snake_case a propósito: se envía tal cual al servidor
  // de impresión, que lo lee como config.get('modificadores_por_linea', 1).
  modificadores_por_linea: number
  // 'texto_natural' se resuelve ANTES de armar este payload (ver
  // construirDescripcionNatural() en cobro/[pedidoId]/page.tsx,
  // historial/actions.ts y VistaComanda.tsx) — el print server nunca ve
  // este valor, solo el resultado ya embebido en `nombre`/`modificadores`.
  formato_modificadores_ticket: 'lista' | 'agrupado' | 'texto_natural'
}

export type ItemCancelacion = {
  nombre: string
  cantidad: number
  modificadores: string[]
  motivo: string
  canceladoPor: string
}

export type CorteZTurnoImpreso = {
  id: number
  apertura: string
  cierre: string | null
  cajero: string
  ventas: number
}

export type PrintPayload =
  | {
      tipo: 'corte_z'
      fecha: string
      config: TicketConfig
      ventasTotales: number
      porMetodo: { efectivo: number; tarjeta: number; transferencia: number; mixto: number }
      descuentosTotal: number
      cancelacionesTotal: number
      propinaEfectivo: number
      propinaTarjeta: number
      ticketPromedio: number
      mesasAtendidas: number
      pedidosCerrados: number
      turnos: CorteZTurnoImpreso[]
    }
  | {
      tipo: 'cocina'
      mesa: string
      mesero: string
      orden: string
      rol: string
      tipoMesa: 'mesa' | 'llevar' | 'mostrador'
      comensales: ComensalCocina[]
      /** true = reimpresión de items ya enviados (no un envío nuevo) */
      reimpresion?: boolean
      // Antes no viajaba ningún `config` en el ticket de cocina (el
      // encabezado usa mesa/mesero/orden/rol, no datos del negocio) — se
      // agrega solo para que _seccion_comensal() pueda leer
      // modificadores_por_linea, igual que ya hace el ticket de cliente.
      config: TicketConfig
    }
  | {
      tipo: 'cancelacion'
      mesa: string
      mesero: string
      items: ItemCancelacion[]
    }
  | ({
      tipo: 'cliente'
      escenario: 'individual'
      mesa: string
      config: TicketConfig
      /** Un elemento por subpedido. El servidor imprime un ticket con corte por cada uno. */
      comensales: IndividualComensal[]
    } & DatosServicioTicket)
  | ({
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
    } & DatosServicioTicket)

/**
 * Datos de servicio del pedido para el bloque de encabezado del ticket de
 * cliente (MESA/CLIENTE + comensales, MESERO + ORDEN, SERVICIO, fecha — ver
 * `_encabezado_cliente()` / `_linea_encabezado_servicio()` en
 * print_server.py). `mesero` ya viene resuelto vía `primerNombreValido()`
 * en el llamador — el print server no vuelve a calcularlo.
 */
export type DatosServicioTicket = {
  mesero: string
  /** pedidos.id como string, tal cual espera el print server (igual que en tipo:'cocina'). */
  orden: string
  tipoMesa: 'mesa' | 'llevar' | 'mostrador'
  numComensales: number | null
  /** Solo relevante para tipoMesa='llevar' — ver print_server.py. */
  clienteNombre: string | null
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
