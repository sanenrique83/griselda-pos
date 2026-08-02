import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import Link from 'next/link'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MasPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, nombre')
    .eq('id', user.id)
    .single<Pick<Perfil, 'rol' | 'nombre'>>()

  const isAdmin = perfil?.rol === 'admin'
  const nombre = perfil?.nombre ?? 'Usuario'

  // Turno activo (solo para admin)
  let turnoActivo: { id: number; abierto_en: string } | null = null
  if (isAdmin) {
    const { data: turno } = await supabase
      .from('turnos')
      .select('id, abierto_en')
      .eq('estado', 'abierto')
      .order('abierto_en', { ascending: false })
      .limit(1)
      .maybeSingle()
    turnoActivo = turno
  }

  return (
    <div className="min-h-full bg-s2">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EA] px-4 pt-4 pb-3">
        <h1 className="text-[20px] font-bold leading-tight">Más</h1>
      </div>

      <div className="px-4 py-4 space-y-5">

        {/* ── Tarjeta de usuario ────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card px-4 py-4 flex items-center gap-3.5">
          {/* Avatar */}
          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-[16px] font-bold text-white">{iniciales(nombre)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-tight truncate">{nombre}</p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isAdmin
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-text-3'
              }`}
            >
              {isAdmin ? 'Administrador' : 'Mesero'}
            </span>
          </div>
        </div>

        {/* ── Sección: Admin ────────────────────────────────────────────────── */}
        {isAdmin && (
          <Section title="Administración">
            {/* Turno */}
            <MenuRow
              label="Turno"
              href="/mas/turno"
              badge={
                turnoActivo ? (
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Activo · desde {fmtHora(turnoActivo.abierto_en)}
                  </span>
                ) : (
                  <span className="text-[12px] font-medium text-text-4">
                    Sin turno activo
                  </span>
                )
              }
            />
            <MenuRow label="Dashboard" href="/dashboard" isLast={false} />
            <MenuRow label="Menú del día" href="/mas/menu-del-dia" isLast={false} />
            <MenuRow label="Impresoras" href="/mas/config" isLast={false} />
            <MenuRow label="Ticket" href="/mas/configuracion" isLast={false} />
            <MenuRow label="Catálogo" href="/mas/catalogo" isLast={false} />
            <MenuRow label="Mapa de mesas" href="/mas/mapa-mesas" isLast={false} />
            <MenuRow label="Inventario" href="/mas/inventario" isLast={false} />
            <MenuRow label="Corte Z" href="/mas/corte-z" isLast={false} />
            <MenuRow label="Cancelaciones" href="/mas/cancelaciones" isLast={false} />
            <MenuRow label="Permisos" href="/mas/permisos" isLast />
          </Section>
        )}

        {/* ── Sección: General (todos los roles) ──────────────────────────── */}
        <Section title="General">
          <MenuRow label="Asistencia" href="/mas/asistencia" isLast={false} />
          <MenuRow label="Recetario" href="/mas/recetario" isLast />
        </Section>

        {/* ── Sección: Cuenta ──────────────────────────────────────────────── */}
        <Section title="Cuenta">
          <LogoutRow />
        </Section>

        <div className="h-2" />
      </div>
    </div>
  )
}

// ─── Componentes de UI ────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      <div className="border-b border-[#E5E5EA] px-4 pt-3.5 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-3">
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}

function MenuRow({
  label,
  href,
  badge,
  isLast = false,
}: {
  label: string
  href: string
  badge?: React.ReactNode
  isLast?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3.5 active:bg-s2 ${
        isLast ? '' : 'border-b border-[#F2F2F7]'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-medium leading-tight">{label}</p>
        {badge && <div className="mt-0.5">{badge}</div>}
      </div>
      <span className="text-[20px] text-text-4 leading-none">›</span>
    </Link>
  )
}

function LogoutRow() {
  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <form action={logout}>
      <button
        type="submit"
        className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-red-50"
      >
        <p className="text-[14px] font-medium text-red-600">Cerrar sesión</p>
      </button>
    </form>
  )
}
