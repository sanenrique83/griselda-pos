// Formato "texto_natural" de config_sistema.formato_modificadores_ticket —
// arma una frase en español en vez de una lista de modificadores, ej.
// "Menudo Chico de Pedacito con Libro y Pata". Puro y sin dependencias de
// Supabase a propósito: lo usan tanto los sitios que construyen el payload
// de impresión (server: cobro/[pedidoId]/page.tsx, historial/actions.ts;
// client: VistaComanda.tsx) como la vista previa en vivo del editor de
// grupos en Catálogo (SeccionProductos.tsx).

export type OpcionConGrupo = {
  nombre: string
  grupoId: number
  grupoOrden: number
  grupoConector: string | null
  grupoPrefijoSeleccionUnica: string | null
}

export type GrupoConSelecciones = {
  orden: number
  conector: string | null
  prefijoSeleccionUnica: string | null
  opciones: string[] // nombres de las opciones elegidas, en el orden en que llegaron
}

// Agrupa opciones ya seleccionadas (con su grupo resuelto) por grupo,
// preservando el orden de llegada dentro de cada uno.
export function agruparPorGrupo(opciones: OpcionConGrupo[]): GrupoConSelecciones[] {
  const porGrupo = new Map<number, GrupoConSelecciones>()
  for (const o of opciones) {
    let g = porGrupo.get(o.grupoId)
    if (!g) {
      g = {
        orden: o.grupoOrden,
        conector: o.grupoConector,
        prefijoSeleccionUnica: o.grupoPrefijoSeleccionUnica,
        opciones: [],
      }
      porGrupo.set(o.grupoId, g)
    }
    g.opciones.push(o.nombre)
  }
  return [...porGrupo.values()]
}

// Varias opciones → coma + "y" antes de la última. Una sola opción con
// prefijo configurado → antepone ese prefijo.
function fragmentoGrupo(nombresOpciones: string[], prefijoSeleccionUnica: string | null): string {
  if (nombresOpciones.length === 0) return ''
  if (nombresOpciones.length === 1) {
    return prefijoSeleccionUnica ? `${prefijoSeleccionUnica} ${nombresOpciones[0]}` : nombresOpciones[0]
  }
  return `${nombresOpciones.slice(0, -1).join(', ')} y ${nombresOpciones[nombresOpciones.length - 1]}`
}

/**
 * Frase completa: nombre del producto + el fragmento de cada grupo (en su
 * orden), con el conector del grupo antepuesto si tiene uno, o pegado
 * directo si no.
 */
export function construirDescripcionNatural(
  nombreProducto: string,
  gruposConSelecciones: GrupoConSelecciones[],
): string {
  const partes = [nombreProducto]
  const gruposOrdenados = [...gruposConSelecciones]
    .filter((g) => g.opciones.length > 0)
    .sort((a, b) => a.orden - b.orden)

  for (const g of gruposOrdenados) {
    const frag = fragmentoGrupo(g.opciones, g.prefijoSeleccionUnica)
    if (!frag) continue
    partes.push(g.conector ? `${g.conector} ${frag}` : frag)
  }

  return partes.join(' ')
}
