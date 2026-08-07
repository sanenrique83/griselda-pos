'use client'

import { ArrowLeftRight, Trash2, Hourglass, Check, Ban, type LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/components/ui/tokens'
import type { ItemComanda } from '@/app/(app)/pos/[pedidoId]/page'

const TAG: Record<ItemComanda['estado'], { label: string; icon: LucideIcon; className: string }> = {
  pendiente: {
    label: 'Pendiente',
    icon: Hourglass,
    className: 'bg-amber-50 text-amber-600',
  },
  enviado: {
    label: 'Enviado',
    icon: Check,
    className: 'bg-green-50 text-green-600',
  },
  cancelado: {
    label: 'Cancelado',
    icon: Ban,
    className: 'bg-red-50 text-red-600',
  },
}

// Ícono + etiqueta chica, misma familia visual que AccionPill/AccionIcono
// (círculo con tinte + etiqueta) pero a escala mini para caber dos por fila
// de producto — no vale la pena un componente compartido para un solo uso.
function IconAccionMini({
  icon: Icon,
  label,
  onClick,
  tintBg,
  tintText,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  tintBg: string
  tintText: string
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 active:scale-90" aria-label={label}>
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tintBg} ${tintText}`}>
        <Icon size={15} strokeWidth={2.2} />
      </span>
      <span className="w-14 text-center text-[9px] leading-tight text-text-4">{label}</span>
    </button>
  )
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
  const TagIcon = tag.icon

  const opcionesTexto = item.opciones.map((o) => o.nombre).join(' · ')

  return (
    <div
      className={`
        rounded-xl p-3 shadow-card
        ${pendiente ? 'border-[1.5px] border-amber-200 bg-amber-50/40' : 'bg-white'}
        ${cancelado ? 'opacity-55' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Cantidad × nombre */}
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="flex-shrink-0 font-mono text-sm font-bold text-[#173F2E]">
            {item.cantidad}×
          </span>
          <p className={`min-w-0 text-[14px] font-bold leading-snug text-text ${cancelado ? 'line-through' : ''}`}>
            {item.emoji && `${item.emoji} `}{item.nombre}
          </p>
        </div>

        {/* Acciones con ícono (regla #1 CLAUDE.md) */}
        {(onMover || (onCancelar && !cancelado)) && (
          <div className="flex flex-shrink-0 items-start gap-2">
            {onMover && (
              <IconAccionMini
                icon={ArrowLeftRight}
                label="Cambiar comensal"
                onClick={onMover}
                tintBg="bg-[#173F2E]/10"
                tintText="text-[#173F2E]"
              />
            )}
            {onCancelar && !cancelado && (
              <IconAccionMini
                icon={Trash2}
                label="Cancelar producto"
                onClick={onCancelar}
                tintBg="bg-red-50"
                tintText="text-red-600"
              />
            )}
          </div>
        )}
      </div>

      {/* Modificadores/variante — mismo texto de siempre (unido por " · "),
          solo se restyló el contenedor */}
      {opcionesTexto && (
        <p className="mt-0.5 pl-[26px] text-xs text-text-3">{opcionesTexto}</p>
      )}

      {item.notas && (
        <p className="mt-0.5 pl-[26px] text-xs italic text-text-3">Nota: {item.notas}</p>
      )}

      {/* Badge de estado + monto */}
      <div className="mt-2 flex items-center justify-between pl-[26px]">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.className}`}>
          <TagIcon size={11} strokeWidth={2.4} />
          {tag.label}
        </span>
        <span className={`font-mono text-[13px] font-bold ${cancelado ? 'text-text-4 line-through' : 'text-green-600'}`}>
          {formatCurrency(item.total)}
        </span>
      </div>
    </div>
  )
}
