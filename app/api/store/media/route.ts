import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'store-media'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 8 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const storeId = formData.get('storeId') as string | null
    const kind = formData.get('kind') as string | null

    if (!image || !storeId || !kind) {
      return NextResponse.json(
        { error: 'Missing image, storeId, or kind' },
        { status: 400 },
      )
    }

    if (!['logo', 'banner'].includes(kind)) {
      return NextResponse.json({ error: 'Invalid upload kind' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(image.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 },
      )
    }

    if (image.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 8MB' },
        { status: 400 },
      )
    }

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('owner_id', user.id)
      .single()

    if (storeError || !store) {
      return NextResponse.json(
        { error: 'Store not found or access denied' },
        { status: 403 },
      )
    }

    const extension = EXTENSIONS[image.type]
    const fileName = `${storeId}/${kind}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`

    const buffer = new Uint8Array(await image.arrayBuffer())
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: image.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload image' },
        { status: 500 },
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path)

    return NextResponse.json({ publicUrl })
  } catch (error) {
    console.error('Store media upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 },
    )
  }
}
