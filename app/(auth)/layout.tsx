import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block text-3xl font-bold tracking-tight">
            <span className="text-primary-600">S</span>
            <span className="text-secondary-900">toca</span>
          </Link>
          <p className="mt-2 text-sm text-secondary-500">
            Your neighborhood stores, online
          </p>
        </div>

        {children}
      </div>
    </div>
  )
}
