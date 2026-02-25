import { create } from 'zustand'
import type {
  Pedido,
  Subpedido,
  PedidoProducto,
  PedidoProductoOpcion,
} from '@/lib/types/database.types'

// Item en pantalla: producto del pedido con sus opciones seleccionadas
export interface ItemComanda extends PedidoProducto {
  opciones: PedidoProductoOpcion[]
  nombre_producto: string  // desnormalizado para mostrar en UI sin join adicional
  precio_total: number     // precio_unit * cantidad + suma de precio_extra de opciones
}

interface PedidoState {
  pedidoActivo: Pedido | null
  subpedidos: Subpedido[]
  items: ItemComanda[]
  subpedidoSeleccionado: number | null  // id del tab activo en la comanda

  setPedidoActivo: (pedido: Pedido | null) => void
  setSubpedidos: (subpedidos: Subpedido[]) => void
  setItems: (items: ItemComanda[]) => void
  setSubpedidoSeleccionado: (id: number | null) => void
  reset: () => void
}

const initialState = {
  pedidoActivo: null,
  subpedidos: [],
  items: [],
  subpedidoSeleccionado: null,
}

// Store del pedido que el mesero está manejando en pantalla.
// Se puebla al entrar a la pantalla POS de una mesa y se limpia al cobrar o salir.
export const usePedidoStore = create<PedidoState>((set) => ({
  ...initialState,

  setPedidoActivo: (pedido) => set({ pedidoActivo: pedido }),
  setSubpedidos: (subpedidos) => set({ subpedidos }),
  setItems: (items) => set({ items }),
  setSubpedidoSeleccionado: (id) => set({ subpedidoSeleccionado: id }),
  reset: () => set(initialState),
}))
