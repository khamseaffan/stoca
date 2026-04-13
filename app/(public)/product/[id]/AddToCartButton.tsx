'use client'

import { useState, useCallback } from 'react'
import { ShoppingCart, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface AddToCartButtonProps {
  productId: string
  storeId: string
  available: boolean
}

export function AddToCartButton({
  productId,
  storeId,
  available,
}: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleAddToCart = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { error } = await supabase.from('cart_items').upsert(
      {
        user_id: user.id,
        store_id: storeId,
        store_product_id: productId,
        quantity: 1,
        captured_price: 0, // DB trigger sets actual price
      },
      { onConflict: 'user_id,store_id,store_product_id' }
    )

    setLoading(false)

    if (!error) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    }
  }, [productId, storeId])

  if (!available) {
    return (
      <Button variant="secondary" size="lg" disabled className="w-full sm:w-auto">
        Out of Stock
      </Button>
    )
  }

  return (
    <Button
      variant="primary"
      size="lg"
      loading={loading}
      onClick={handleAddToCart}
      className="w-full sm:w-auto"
    >
      {success ? (
        <>
          <Check className="h-5 w-5" />
          Added to Cart
        </>
      ) : (
        <>
          <ShoppingCart className="h-5 w-5" />
          Add to Cart
        </>
      )}
    </Button>
  )
}
