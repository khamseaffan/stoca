'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Settings,
  Bot,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Store as StoreIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ChatWindow } from '@/components/chat/ChatWindow'
import type { Store } from '@/types'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
] as const

interface DashboardShellProps {
  store: Store
  children: ReactNode
}

export function DashboardShell({ store, children }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Listen for "open chat" events from child components
  useEffect(() => {
    function handleOpenChat() {
      setChatOpen(true)
    }
    window.addEventListener('open-dashboard-chat', handleOpenChat)
    return () => window.removeEventListener('open-dashboard-chat', handleOpenChat)
  }, [])

  async function handleSignOut() {
    // Clear chat history on logout
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('stoca-chat-')) localStorage.removeItem(key)
      })
    } catch { /* ignore */ }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-secondary-200">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight text-secondary-900">
          <span className="text-primary-600">S</span>toca
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900',
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {/* AI Chat shortcut */}
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false)
            setChatOpen(true)
          }}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            chatOpen
              ? 'bg-primary-100 text-primary-700'
              : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900',
          )}
        >
          <Bot className="h-5 w-5 shrink-0" />
          AI Chat
        </button>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-secondary-200 p-4 space-y-3">
        {/* Store info */}
        <div className="flex items-center gap-3 rounded-lg bg-secondary-50 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100">
            <StoreIcon className="h-5 w-5 text-primary-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-secondary-900">
              {store.name}
            </p>
            <p className="text-xs text-secondary-500 capitalize">
              {store.store_type.toLowerCase().replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* View Store link */}
        {store.slug && (
          <Link
            href={`/store/${store.slug}`}
            target="_blank"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-600 transition-colors hover:bg-secondary-100 hover:text-secondary-900"
          >
            <ExternalLink className="h-4 w-4" />
            View Store
          </Link>
        )}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-600 transition-colors hover:bg-secondary-100 hover:text-secondary-900"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-secondary-200 bg-white lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-secondary-200 bg-white px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-secondary-600 hover:bg-secondary-100"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-lg font-bold tracking-tight text-secondary-900">
          <span className="text-primary-600">S</span>toca
        </span>
      </div>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl lg:hidden">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="lg:ml-64">
        {children}
      </main>

      {/* ── Global chat drawer — always mounted, available on all dashboard pages ── */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity',
          chatOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setChatOpen(false)}
        aria-hidden="true"
      />
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 sm:max-w-[420px]',
          chatOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <ChatWindow
          storeId={store.id}
          storeName={store.name}
          className="h-full rounded-none border-0"
        />
      </div>

      {/* Floating chat button — visible when chat is closed */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-primary-700 hover:shadow-xl lg:hidden"
          aria-label="Open AI Chat"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}
