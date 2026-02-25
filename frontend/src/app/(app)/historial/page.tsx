import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistorialShell } from '@/components/historial/HistorialShell'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type PagoResumen = {
  metodo: 'efectivo' | 'tarjeta' | 'transferencia'
  monto: number
}

export type ReciboData = {
  id: number           // movimiento_id
  createdAt: string
  mesaLabel: string
  total: number
  efectivoRecibido: number | null
  cambio: number | null
  pagos: PagoResumen[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HistorialPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Turno activo
  const { data: turno } = await supabase
    .from('turnos')
    .select('id')
    .eq('estado', 'abierto')
    .order('abierto_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!turno) {
    return <HistorialShell recibos={[]} sinTurno />
  }

  // Cobros del turno con pagos y trazabilidad de mesa
  const { data: movimientos } = await supabase
    .from('movimientos_caja')
    .select(
      `id, monto, efectivo_recibido, cambio, created_at,
       pagos(metodo_pago, monto),
       cobro_subpedidos(
         subpedidos(
           pedidos(
             tipo, mesa_id,
             mesas(numero, nombre)
           )
         )
       )`,
    )
    .eq('turno_id', turno.id)
    .eq('tipo', 'cobro')
    .order('created_at', { ascending: false })

  const recibos: ReciboData[] = (movimientos ?? []).map((m: any) => {
    // Obtener el primer pedido referenciado para la etiqueta de mesa
    const primerSubpedido = (m.cobro_subpedidos ?? [])[0]
    const pedido = primerSubpedido?.subpedidos?.pedidos

    let mesaLabel = 'Para llevar'
    if (pedido) {
      if (pedido.tipo === 'mesa' && pedido.mesas) {
        const mesa = pedido.mesas as { numero: number; nombre: string | null }
        mesaLabel = `Mesa ${mesa.nombre ?? mesa.numero}`
      } else if (pedido.tipo === 'llevar') {
        mesaLabel = 'Para llevar'
      }
    }

    const pagos: PagoResumen[] = (m.pagos ?? []).map((p: any) => ({
      metodo: p.metodo_pago as PagoResumen['metodo'],
      monto: p.monto,
    }))

    return {
      id: m.id,
      createdAt: m.created_at,
      mesaLabel,
      total: m.monto,
      efectivoRecibido: m.efectivo_recibido,
      cambio: m.cambio,
      pagos,
    }
  })

  return <HistorialShell recibos={recibos} sinTurno={false} />
}
