import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8090'

/**
 * POST /api/ai/rewrite — Generate a polished description using Claude.
 * Forwards to the Python enrichment endpoint and returns just the description.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, price, category } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`rewrite:${user.id}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    const response = await fetch(`${AI_SERVICE_URL}/api/ai/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, price, category }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to generate description' },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json({ description: data.description })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
