'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { cerrarSesion } from '@/app/(app)/mas/actions'

interface LogoutButtonProps {
  mensajeDespedida: string
}

export function LogoutButton({ mensajeDespedida }: LogoutButtonProps) {
  const [despidiendo, setDespidiendo] = useState(false)

  function handleClick() {
    setDespidiendo(true)
    // cerrarSesion() termina en redirect(), que interrumpe cualquier código
    // posterior a la llamada — por eso el mensaje se muestra ANTES, con un
    // temporizador, en vez de encadenado después del await.
    setTimeout(() => {
      cerrarSesion()
    }, 1600)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={despidiendo}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-red-50 disabled:opacity-60"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <LogOut size={17} strokeWidth={2} />
        </span>
        <p className="text-[14px] font-semibold text-red-600">Cerrar sesión</p>
      </button>

      {despidiendo && (
        <div className="fixed inset-0 z-[200] flex animate-fadeIn items-center justify-center bg-[#173F2E] px-10 text-center">
          <p className="text-[19px] font-semibold leading-snug text-white">{mensajeDespedida}</p>
        </div>
      )}
    </>
  )
}
