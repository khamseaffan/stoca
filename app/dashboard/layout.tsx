import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { DashboardProvider } from './DashboardContext'
import { DashboardShell } from './DashboardShell'
import type { Store, StoreType } from '@/types'

export const metadata = {
  title: 'Dashboard | Stoca',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile and verify role
  const profile = await prisma.profiles.findUnique({
    where: { id: user.id },
    select: { id: true, role: true },
  })

  if (!profile || profile.role !== 'STORE_OWNER') {
    redirect('/')
  }

  // Fetch the owner's store
  const rawStore = await prisma.stores.findFirst({
    where: { owner_id: user.id },
  })

  if (!rawStore) {
    redirect('/onboarding')
  }

  const store: Store = {
    ...rawStore,
    store_type: rawStore.store_type as StoreType,
    country: rawStore.country ?? 'US',
    latitude: rawStore.latitude ? Number(rawStore.latitude) : null,
    longitude: rawStore.longitude ? Number(rawStore.longitude) : null,
    delivery_fee: Number(rawStore.delivery_fee ?? 0),
    minimum_order: Number(rawStore.minimum_order ?? 0),
    delivery_radius_km: rawStore.delivery_radius_km ? Number(rawStore.delivery_radius_km) : null,
    operating_hours: (rawStore.operating_hours ?? {}) as Store['operating_hours'],
    created_at: rawStore.created_at.toISOString(),
    updated_at: rawStore.updated_at.toISOString(),
  }

  return (
    <DashboardProvider store={store}>
      <DashboardShell store={store}>
        {children}
      </DashboardShell>
    </DashboardProvider>
  )
}
