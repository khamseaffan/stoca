import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8090'

/**
 * POST /api/ai/image — Image upload for AI inventory scanning.
 *
 * Expects FormData: image (File), storeId (string).
 * Authenticates caller, verifies store ownership, uploads image to
 * Supabase Storage (inventory-scans bucket), then forwards the public URL
 * to the Python service's /api/tools/scan-inventory endpoint.
 *
 * Returns: { image_url: string, scan_result: object }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const storeId = formData.get('storeId') as string | null

    if (!image || !storeId) {
      return NextResponse.json({ error: 'Missing image or storeId' }, { status: 400 })
    }

    // Verify the user owns this store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('owner_id', user.id)
      .single()

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found or access denied' }, { status: 403 })
    }

    // Upload image to Supabase Storage
    const fileExt = image.name.split('.').pop() || 'jpg'
    const fileName = `${storeId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`

    const arrayBuffer = await image.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('inventory-scans')
      .upload(fileName, buffer, {
        contentType: image.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Get the public URL for the uploaded image
    const { data: { publicUrl } } = supabase.storage
      .from('inventory-scans')
      .getPublicUrl(uploadData.path)

    // Call the Python service to process the image
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    const scanResponse = await fetch(`${AI_SERVICE_URL}/api/tools/scan-inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        store_id: storeId,
        image_url: publicUrl,
      }),
    })

    if (!scanResponse.ok) {
      const errorText = await scanResponse.text()
      return NextResponse.json(
        { error: `Scan failed: ${errorText}`, image_url: publicUrl },
        { status: scanResponse.status }
      )
    }

    const scanResult = await scanResponse.json()

    return NextResponse.json({
      image_url: publicUrl,
      scan_result: scanResult,
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    )
  }
}
