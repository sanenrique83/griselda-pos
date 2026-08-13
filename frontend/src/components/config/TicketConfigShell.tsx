'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderB } from '@/components/ui/HeaderB'
import { Boton } from '@/components/ui/Boton'
import { guardarConfigTicket } from '@/app/(app)/mas/configuracion/actions'
import type { TicketConfig } from '@/lib/print'

const CAMPOS: { key: keyof TicketConfig; label: string; placeholder: string; hint?: string }[] = [
  { key: 'nombre', label: 'Nombre del negocio', placeholder: 'La Menuderia' },
  {
    key: 'subtitulo',
    label: 'Subtítulo',
    placeholder: 'Ej: Fonda & Artesanías',
    hint: 'Aparece debajo del nombre, en tamaño normal',
  },
  { key: 'direccion', label: 'Dirección', placeholder: 'Calle y número, ciudad' },
  { key: 'telefono', label: 'Teléfono', placeholder: 'Ej: 55 1234-5678' },
  { key: 'rfc', label: 'RFC', placeholder: 'Opcional' },
  { key: 'linea1', label: 'Línea libre 1', placeholder: 'Texto adicional' },
  { key: 'linea2', label: 'Línea libre 2', placeholder: 'Texto adicional' },
  {
    key: 'pie',
    label: 'Mensaje de despedida',
    placeholder: 'Gracias por su visita!',
    hint: 'Aparece al pie del ticket',
  },
  { key: 'pie2', label: 'Línea pie 2', placeholder: 'Opcional' },
]

interface Props {
  initialConfig: TicketConfig
}

export function TicketConfigShell({ initialConfig }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<TicketConfig>(initialConfig)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  function handleChange(key: keyof TicketConfig, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setBanner(null)
  }

  async function handleGuardar() {
    setSaving(true)
    setBanner(null)
    const result = await guardarConfigTicket(form)
    setSaving(false)
    if (result?.error) {
      setBanner(result.error)
    } else {
      setBanner('Guardado ✓')
      setTimeout(() => setBanner(null), 3000)
    }
  }

  return (
    <div className="min-h-full bg-s2">
      <HeaderB backLabel="Más" onBack={() => router.push('/mas')} titulo="Ticket de impresión" />

      <div className="px-4 py-4 space-y-5">
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Encabezado del ticket
            </p>
          </div>
          <div className="px-4 py-4 space-y-4">
            {CAMPOS.map(({ key, label, placeholder, hint }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-3">
                  {label}
                </label>
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border-[1.5px] border-border bg-s2 px-3.5 py-3 text-sm outline-none focus:border-[#173F2E]"
                />
                {hint && (
                  <p className="mt-1 text-xs text-text-3">{hint}</p>
                )}
              </div>
            ))}

            {banner && (
              <p
                className={`text-xs font-semibold ${
                  banner.includes('✓') ? 'text-[#173F2E]' : 'text-red-600'
                }`}
              >
                {banner}
              </p>
            )}

            <Boton onClick={handleGuardar} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </Boton>
          </div>
        </div>

        <div className="h-2" />
      </div>
    </div>
  )
}
