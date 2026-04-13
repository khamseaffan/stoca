import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  let profile: { id: string; first_name: string; last_name: string; role: 'CUSTOMER' | 'STORE_OWNER' | 'ADMIN' } | null = null
  let cartCount = 0

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const profileData = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { id: true, first_name: true, last_name: true, role: true },
    })

    if (profileData) {
      profile = {
        id: profileData.id,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        role: profileData.role as 'CUSTOMER' | 'STORE_OWNER' | 'ADMIN',
      }
    }

    cartCount = await prisma.cart_items.count({
      where: { user_id: user.id },
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={profile} cartCount={cartCount} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
