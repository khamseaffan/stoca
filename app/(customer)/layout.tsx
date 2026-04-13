import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: { id: string; first_name: string; last_name: string; role: 'CUSTOMER' | 'STORE_OWNER' | 'ADMIN' } | null = null
  let cartCount = 0

  if (user) {
    const [profileResult, cartCountResult] = await Promise.all([
      prisma.profiles.findUnique({
        where: { id: user.id },
        select: { id: true, first_name: true, last_name: true, role: true },
      }),
      prisma.cart_items.count({
        where: { user_id: user.id },
      }),
    ])

    profile = profileResult
      ? { ...profileResult, role: profileResult.role as 'CUSTOMER' | 'STORE_OWNER' | 'ADMIN' }
      : null
    cartCount = cartCountResult
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={profile} cartCount={cartCount} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
