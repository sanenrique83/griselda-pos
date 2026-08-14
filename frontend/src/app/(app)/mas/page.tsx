import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database.types'
import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  ArrowLeftRight, Clock, BarChart3, Package, Printer, Users, ReceiptText,
  FileText, BookOpen, Armchair, Scissors, XCircle, Shield, Headphones,
  NotebookText, LogOut, Monitor, ChevronRight, SlidersHorizontal,
} from 'lucide-react'
import { primerNombreValido } from '@/lib/nombreUsuario'
import { HeaderA } from '@/components/ui/HeaderA'
import pkg from '../../../../package.json'

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
  const nombre = primerNombreValido(perfil?.nombre)

  // Turno activo — visible para cualquier rol en la tarjeta de perfil (antes
  // solo se consultaba para admin, porque solo admin veía el acceso rápido
  // "Turno"; ese acceso sigue siendo admin-only — /mas/turno redirige a
  // cualquier no-admin — pero el ESTADO del turno es información de solo
  // lectura razonable para cualquiera, y el mockup la muestra siempre).
  const { data: turnoActivo } = await supabase
    .from('turnos')
    .select('id, abierto_en')
    .eq('estado', 'abierto')
    .order('abierto_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="min-h-full bg-s2">
      <HeaderA titulo="Más" subtitulo="Configuración y administración" turnoId={turnoActivo?.id ?? null} />

      <div className="px-4 py-4 space-y-5">

        {/* ── Tarjeta de usuario ────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="px-4 py-4 flex items-center gap-3.5">
            <div className="h-12 w-12 flex-shrink-0 rounded-full bg-[#173F2E] flex items-center justify-center">
              <span className="text-[16px] font-bold text-white">{iniciales(nombre)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight truncate">{nombre}</p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  isAdmin
                    ? 'bg-[#173F2E]/10 text-[#173F2E]'
                    : 'bg-gray-100 text-text-3'
                }`}
              >
                {isAdmin ? 'Administrador' : 'Mesero'}
              </span>
            </div>
            <div className="h-9 w-px flex-shrink-0 bg-[#E5E5EA]" />
            <div className="flex-shrink-0 text-right">
              {turnoActivo ? (
                <span className="flex items-center justify-end gap-1 text-[13px] font-semibold text-[#173F2E]">
                  <span className="h-2 w-2 rounded-full bg-[#173F2E]" />
                  Turno activo
                </span>
              ) : (
                <span className="text-[13px] font-semibold text-text-4">Sin turno</span>
              )}
              <p className="mt-0.5 text-[11px] text-text-3">
                {turnoActivo ? `desde ${fmtHora(turnoActivo.abierto_en)}` : '—'}
              </p>
            </div>
          </div>
          <Link
            href="/preferencias"
            className="flex items-center gap-2 border-t border-[#F2F2F7] px-4 py-2.5 text-[12px] font-medium text-text-3 active:bg-s2"
          >
            <SlidersHorizontal size={13} strokeWidth={2.2} />
            Preferencias
          </Link>
        </div>

        {/* ── Cambiar de usuario (PIN rápido) ─────────────────────────────────
            Prominente y pegado arriba a propósito, no como una fila más del
            menú alfabético de Admin — es una acción operativa de uso muy
            frecuente (cambio de turno a media mesa), disponible para
            cualquier rol, no solo admin. */}
        <Link
          href="/cambiar-usuario"
          className="flex items-center gap-3 rounded-2xl bg-[#173F2E] px-4 py-4 text-white shadow-[0_4px_14px_rgba(23,63,46,.32)] active:scale-[.98]"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
            <ArrowLeftRight size={20} strokeWidth={2} />
          </span>
          <div className="flex-1 text-left">
            <div className="text-[15px] font-semibold">Cambiar de usuario</div>
            <div className="mt-0.5 text-[12px] opacity-80">Con PIN, sin cerrar sesión</div>
          </div>
          <ChevronRight size={18} strokeWidth={2.2} className="opacity-70" />
        </Link>

        {/* ── Accesos rápidos (admin) ─────────────────────────────────────── */}
        {isAdmin && (
          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Accesos rápidos
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <AccesoRapido
                icon={Clock}
                label="Turno"
                href="/mas/turno"
                sub={
                  turnoActivo
                    ? { text: `Activo · desde ${fmtHora(turnoActivo.abierto_en)}`, tono: 'positivo' }
                    : { text: 'Sin turno activo', tono: 'neutro' }
                }
              />
              <AccesoRapido icon={BarChart3} label="Dashboard" href="/dashboard" />
              <AccesoRapido icon={Package} label="Inventario" href="/mas/inventario" />
              <AccesoRapido icon={Printer} label="Impresoras" href="/mas/config" />
              <AccesoRapido icon={Users} label="Usuarios" href="/mas/usuarios" />
              <AccesoRapido icon={ReceiptText} label="Menú del día" href="/mas/menu-del-dia" />
            </div>
          </div>
        )}

        {/* ── Administración: Operación / Caja / Seguridad ─────────────────── */}
        {isAdmin && (
          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
              Administración
            </p>
            <div className="rounded-2xl bg-white shadow-card overflow-hidden px-4 py-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ColumnaAdmin title="Operación">
                <FilaAdmin icon={FileText} label="Ticket" href="/mas/configuracion" />
                <FilaAdmin icon={BookOpen} label="Catálogo" href="/mas/catalogo" />
                <FilaAdmin icon={Armchair} label="Mapa de mesas" href="/mas/mapa-mesas" />
              </ColumnaAdmin>
              <ColumnaAdmin title="Caja">
                <FilaAdmin icon={Scissors} label="Corte Z" href="/mas/corte-z" />
                <FilaAdmin icon={XCircle} label="Cancelaciones" href="/mas/cancelaciones" />
              </ColumnaAdmin>
              <ColumnaAdmin title="Seguridad">
                <FilaAdmin icon={Shield} label="Permisos" href="/mas/permisos" />
              </ColumnaAdmin>
            </div>
          </div>
        )}

        {/* ── General (todos los roles) ────────────────────────────────────── */}
        <div>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
            General
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <AccesoRapido icon={Headphones} label="Asistencia" href="/mas/asistencia" />
            <AccesoRapido icon={NotebookText} label="Recetario" href="/mas/recetario" />
          </div>
        </div>

        {/* ── Cuenta ────────────────────────────────────────────────────────── */}
        <div>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Cuenta
          </p>
          <div className="rounded-2xl bg-white shadow-card overflow-hidden">
            <LogoutRow />
          </div>
        </div>

        {/* ── Sistema — solo "Versión" (dato real de package.json). El resto
            del pie del mockup ("Sincronizado"/"Servidor"/"Licencia PRO") es
            lenguaje de SaaS/licenciamiento que se decidió dejar fuera hasta
            la conversación de vender esto a otros negocios — no hay ningún
            mecanismo de sincronización, servidor propio ni licencia que
            reportar hoy. */}
        <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-text-4">
          <Monitor size={12} strokeWidth={2} />
          Versión {pkg.version}
        </div>

        <div className="h-2" />
      </div>
    </div>
  )
}

// ─── Componentes de UI ────────────────────────────────────────────────────────

function AccesoRapido({
  icon: Icon,
  label,
  href,
  sub,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
  href: string
  sub?: { text: string; tono: 'positivo' | 'neutro' }
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-white shadow-card px-3.5 py-3.5 active:opacity-80"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#173F2E]/10 text-[#173F2E]">
        <Icon size={19} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-tight text-text">{label}</p>
        {sub && (
          <p className={`mt-0.5 text-[11px] font-medium ${sub.tono === 'positivo' ? 'text-[#173F2E]' : 'text-text-4'}`}>
            {sub.text}
          </p>
        )}
      </div>
      <ChevronRight size={16} strokeWidth={2.2} className="flex-shrink-0 text-text-4" />
    </Link>
  )
}

function ColumnaAdmin({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#173F2E]">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function FilaAdmin({
  icon: Icon,
  label,
  href,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
  href: string
}) {
  return (
    <Link href={href} className="flex items-center gap-2 py-1.5 active:opacity-70">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-s2 text-text-2">
        <Icon size={14} strokeWidth={2} />
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{label}</p>
      <ChevronRight size={14} strokeWidth={2.2} className="flex-shrink-0 text-text-4" />
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
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-red-50"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <LogOut size={17} strokeWidth={2} />
        </span>
        <p className="text-[14px] font-semibold text-red-600">Cerrar sesión</p>
      </button>
    </form>
  )
}
