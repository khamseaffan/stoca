'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, ShoppingCart, Menu, X, ChevronDown, User, LayoutDashboard, Package, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'

interface NavbarProps {
  user: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'role'> | null
  cartCount: number
}

export function Navbar({ user, cartCount }: NavbarProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change (via Escape key as a proxy)
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
      setSearchQuery('')
      setMobileMenuOpen(false)
    }
  }

  const initials = user ? getInitials(`${user.first_name} ${user.last_name}`) : ''

  return (
    <header className="sticky top-0 z-50 w-full border-b border-secondary-200 bg-white">
      <nav className="mx-auto flex h-16 max-w-7xl items-center px-4">
        {/* Left: Logo */}
        <Link
          href="/"
          className="mr-4 flex shrink-0 items-center text-xl font-bold tracking-tight text-secondary-900"
        >
          <span className="text-primary-600">S</span>toca
        </Link>

        {/* Center: Search (hidden on mobile) */}
        <form
          onSubmit={handleSearch}
          className="mx-4 hidden flex-1 md:block"
        >
          <div className="relative max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stores and products..."
              className="w-full rounded-full bg-secondary-100 py-2 pl-10 pr-4 text-sm text-secondary-900 placeholder:text-secondary-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-0"
            />
          </div>
        </form>

        {/* Right: Cart + User menu */}
        <div className="ml-auto flex items-center gap-2">
          {/* Cart */}
          <Link
            href="/cart"
            className="relative inline-flex items-center justify-center rounded-lg p-2 text-secondary-600 transition-colors hover:bg-secondary-100 hover:text-secondary-900"
            aria-label={`Shopping cart with ${cartCount} items`}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-xs font-semibold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/* User menu (desktop) */}
          {user ? (
            <div ref={userMenuRef} className="relative hidden md:block">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary-100',
                  userMenuOpen && 'bg-secondary-100',
                )}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                  {initials}
                </span>
                <span className="max-w-[120px] truncate font-medium text-secondary-700">
                  {user.first_name}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-secondary-400 transition-transform',
                    userMenuOpen && 'rotate-180',
                  )}
                />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 overflow-hidden rounded-lg border border-secondary-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-secondary-100 px-4 py-2">
                    <p className="text-sm font-medium text-secondary-900">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-secondary-500">
                      {user.role === 'STORE_OWNER' ? 'Store Owner' : 'Customer'}
                    </p>
                  </div>
                  {user.role === 'STORE_OWNER' && (
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-secondary-700 transition-colors hover:bg-secondary-50"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  )}
                  <Link
                    href="/orders"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-secondary-700 transition-colors hover:bg-secondary-50"
                  >
                    <Package className="h-4 w-4" />
                    My Orders
                  </Link>
                  <div className="border-t border-secondary-100">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        router.push('/auth/signout')
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-secondary-700 transition-colors hover:bg-secondary-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-secondary-700 transition-colors hover:bg-secondary-100"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                Register
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-secondary-600 transition-colors hover:bg-secondary-100 md:hidden"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile slide-down panel */}
      {mobileMenuOpen && (
        <div className="border-t border-secondary-200 bg-white md:hidden">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-4">
            {/* Mobile search */}
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stores and products..."
                  className="w-full rounded-full bg-secondary-100 py-2 pl-10 pr-4 text-sm text-secondary-900 placeholder:text-secondary-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </form>

            {/* Mobile nav links */}
            <div className="space-y-1">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                      {initials}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-secondary-900">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-secondary-500">
                        {user.role === 'STORE_OWNER' ? 'Store Owner' : 'Customer'}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-secondary-100 pt-1">
                    {user.role === 'STORE_OWNER' && (
                      <Link
                        href="/dashboard"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-700 transition-colors hover:bg-secondary-50"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Link>
                    )}
                    <Link
                      href="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-700 transition-colors hover:bg-secondary-50"
                    >
                      <Package className="h-4 w-4" />
                      My Orders
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false)
                        router.push('/auth/signout')
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-700 transition-colors hover:bg-secondary-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary-700 transition-colors hover:bg-secondary-50"
                  >
                    <User className="h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg bg-primary-600 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
