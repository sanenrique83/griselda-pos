'use client'

import type { ItemComanda } from '@/app/(app)/pos/[pedidoId]/page'

const TAG = {
  pendiente: {
    label: '⏳ Pendiente',
    className: 'bg-blue-50 text-blue-600',
  },
  enviado: {
    label: '✓ Enviado',
    className: 'bg-green-50 text-green-600',
  },
  cancelado: {
    label: '✕ Cancelado',
    className: 'bg-red-50 text-red-600',
  },
}

export function ItemComandaRow({
  item,
  onCancelar,
  onMover,
}: {
  item: ItemComanda
  onCancelar?: () => void
  onMover?: () => void
}) {
  const cancelado = item.estado === 'cancelado'
  const pendiente = item.estado === 'pendiente'
  const tag = TAG[item.estado]

  const opcionesTexto = item.opciones.map((o) => o.nombre).join(' · ')

  return (
    <div
      className={`
        relative rounded-xl p-3 shadow-card
        ${pendiente ? 'border-[1.5px] border-blue-200 bg-blue-50' : 'bg-white'}
        ${cancelado ? 'opacity-55' : ''}
      `}
    >
      {(onMover || (onCancelar && item.estado !== 'cancelado')) && (
        <div className="mb-1.5 flex items-center justify-end gap-1.5">
          {onMover && (
            <button
              onClick={onMover}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[13px] font-bold text-blue-600 active:scale-90"
              aria-label="Mover a otro comensal"
            >
              ⇄
            </button>
          )}
          {onCancelar && item.estado !== 'cancelado' && (
            <button
              onClick={onCancelar}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-[15px] font-bold text-red-600 active:scale-90"
              aria-label={pendiente ? 'Eliminar ítem' : 'Cancelar ítem'}
            >
              ×
            </button>
          )}
        </div>
      )}
      <div className="flex items-start gap-2.5">
        {/* Cantidad */}
        <span className="w-5 flex-shrink-0 pt-px font-mono text-sm font-semibold text-blue-600">
          {item.cantidad}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-[13px] font-medium leading-snug ${
              cancelado ? 'line-through' : ''
            }`}
          >
            {item.emoji && `${item.emoji} `}{item.nombre}
          </p>

          {opcionesTexto && (
            <p className="mt-0.5 text-xs text-text-3">{opcionesTexto}</p>
          )}

          {item.notas && (
            <p className="mt-0.5 text-xs italic text-text-3">
              Nota: {item.notas}
            </p>
          )}

          {/* Badge de estado */}
          <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.className}`}
          >
            {tag.label}
          </span>
        </div>

        {/* Precio */}
        <span
          className={`flex-shrink-0 font-mono text-[13px] font-medium ${
            cancelado ? 'text-text-4 line-through' : 'text-green-600'
          }`}
        >
          ${item.total.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
