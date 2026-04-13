'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ShoppingBag, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

type Role = 'CUSTOMER' | 'STORE_OWNER'

export default function RegisterPage() {
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('CUSTOMER')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (role === 'STORE_OWNER') {
        router.push('/onboarding')
      } else {
        router.push('/')
      }

      router.refresh()
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-secondary-900">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-secondary-500">
        Join Stoca to shop or sell in your neighborhood
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Role Selection */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-secondary-700">
            I want to...
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('CUSTOMER')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-4 text-sm font-medium transition-colors',
                role === 'CUSTOMER'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-secondary-200 bg-white text-secondary-600 hover:border-secondary-300 hover:bg-secondary-50',
              )}
            >
              <ShoppingBag
                className={cn(
                  'h-6 w-6',
                  role === 'CUSTOMER' ? 'text-primary-600' : 'text-secondary-400',
                )}
              />
              Shop
            </button>

            <button
              type="button"
              onClick={() => setRole('STORE_OWNER')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-4 text-sm font-medium transition-colors',
                role === 'STORE_OWNER'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-secondary-200 bg-white text-secondary-600 hover:border-secondary-300 hover:bg-secondary-50',
              )}
            >
              <Store
                className={cn(
                  'h-6 w-6',
                  role === 'STORE_OWNER' ? 'text-primary-600' : 'text-secondary-400',
                )}
              />
              Sell
            </button>
          </div>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            type="text"
            placeholder="Jane"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            icon={<User className="h-4 w-4" />}
            required
            autoComplete="given-name"
          />

          <Input
            label="Last name"
            type="text"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            autoComplete="family-name"
          />
        </div>

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="h-4 w-4" />}
          required
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="h-4 w-4" />}
          required
          minLength={6}
          autoComplete="new-password"
        />

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          className="w-full"
          size="lg"
        >
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-secondary-500">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Sign in
        </Link>
      </p>
    </Card>
  )
}
