import { create } from 'zustand'
import type { Turno, Perfil } from '@/lib/types/database.types'

interface TurnoState {
  turnoActivo: Turno | null
  perfil: Perfil | null

  setTurnoActivo: (turno: Turno | null) => void
  setPerfil: (perfil: Perfil | null) => void
}

// Store del turno activo y el perfil del usuario en sesión.
// Se inicializa al cargar el layout protegido y se limpia al cerrar sesión.
export const useTurnoStore = create<TurnoState>((set) => ({
  turnoActivo: null,
  perfil: null,

  setTurnoActivo: (turno) => set({ turnoActivo: turno }),
  setPerfil: (perfil) => set({ perfil }),
}))
