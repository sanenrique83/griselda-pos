'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  ClipboardList,
  Clock,
  BarChart2,
  MoreHorizontal,
} from 'lucide-react'
import type { RolUsuario } from '@/lib/types/database.types'

interface Tab {
  href: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
}

const TABS: Tab[] = [
  { href: '/mesas',     label: 'Mesas',     icon: LayoutGrid },
  { href: '/pedidos',   label: 'Pedidos',   icon: ClipboardList },
  { href: '/historial', label: 'Historial', icon: Clock },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2, adminOnly: true },
  { href: '/mas',       label: 'Más',       icon: MoreHorizontal },
]

interface BottomNavProps {
  rol: RolUsuario
  pedidosActivos?: number   // badge en tab Pedidos
}

export function BottomNav({ rol, pedidosActivos = 0 }: BottomNavProps) {
  const pathname = usePathname()

  const tabs = TABS.filter((t) => !t.adminOnly || rol === 'admin')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface pb-safe">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-[#173F2E]' : 'text-text-3'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {tab.href === '/pedidos' && pedidosActivos > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#173F2E] px-1 text-[10px] font-bold text-white">
                    {pedidosActivos > 99 ? '99+' : pedidosActivos}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
