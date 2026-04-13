/**
 * Prisma client singleton.
 *
 * Uses the Prisma 7 PrismaPg driver adapter for direct PostgreSQL connection.
 * Bypasses Supabase RLS — use for all data queries in Server Components and
 * API routes. In development, the client is cached on globalThis to survive
 * hot reloads without exhausting database connections.
 *
 * Supabase client is still used for Auth, Storage, and Realtime.
 */
import { PrismaClient } from '@/lib/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const adapter = new PrismaPg(connectionString)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
