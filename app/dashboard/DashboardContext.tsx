'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Store } from '@/types'

interface DashboardContextValue {
  store: Store
  storeId: string
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({
  store,
  children,
}: {
  store: Store
  children: ReactNode
}) {
  return (
    <DashboardContext.Provider value={{ store, storeId: store.id }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}
