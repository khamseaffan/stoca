'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type FormEvent,
  type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Store,
  Clock,
  Package,
  Rocket,
  Search,
  Camera,
  Plus,
  X,
  Trash2,
  Copy,
  ExternalLink,
  Sparkles,
  MessageSquare,
  ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/posthog'
import { cn, slugify, formatPrice } from '@/lib/utils'
import type { StoreType, GlobalProduct } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { AIRewriteButton } from '@/components/ui/AIRewriteButton'
import { ChatWindow } from '@/components/chat/ChatWindow'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Store Basics', icon: Store },
  { label: 'Hours', icon: Clock },
  { label: 'Add Products', icon: Package },
  { label: 'Review & Launch', icon: Rocket },
] as const

const STORE_TYPES: { value: StoreType; label: string }[] = [
  { value: 'GROCERY', label: 'Grocery' },
  { value: 'CONVENIENCE', label: 'Convenience' },
  { value: 'BAKERY', label: 'Bakery' },
  { value: 'BUTCHER', label: 'Butcher' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SPECIALTY_FOOD', label: 'Specialty Food' },
  { value: 'ORGANIC', label: 'Organic' },
  { value: 'DELI', label: 'Deli' },
  { value: 'FLOWER', label: 'Flower' },
  { value: 'PET', label: 'Pet' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'OTHER', label: 'Other' },
]

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

type DayHours = {
  enabled: boolean
  open: string
  close: string
}

type OperatingHoursState = Record<string, DayHours>

const DEFAULT_HOURS: OperatingHoursState = {
  monday: { enabled: true, open: '09:00', close: '21:00' },
  tuesday: { enabled: true, open: '09:00', close: '21:00' },
  wednesday: { enabled: true, open: '09:00', close: '21:00' },
  thursday: { enabled: true, open: '09:00', close: '21:00' },
  friday: { enabled: true, open: '09:00', close: '21:00' },
  saturday: { enabled: true, open: '09:00', close: '21:00' },
  sunday: { enabled: true, open: '10:00', close: '18:00' },
}

interface AddedProduct {
  id: string
  name: string
  price: number
  category: string
  description: string | null
  quantity: number
  globalProductId: string | null
  imageUrls: string[]
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function ProgressBar({
  currentStep,
  onStepClick,
}: {
  currentStep: number
  onStepClick: (step: number) => void
}) {
  return (
    <div className="w-full px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const Icon = step.icon

          return (
            <div key={step.label} className="flex flex-1 items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (isCompleted) onStepClick(index)
                  }}
                  disabled={!isCompleted}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                    isCompleted &&
                      'border-primary-600 bg-primary-600 text-white cursor-pointer hover:bg-primary-700',
                    isCurrent &&
                      'border-primary-600 bg-white text-primary-600 shadow-sm shadow-primary-200',
                    !isCompleted &&
                      !isCurrent &&
                      'border-secondary-300 bg-white text-secondary-300 cursor-default',
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </button>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium transition-colors duration-300 whitespace-nowrap',
                    isCompleted && 'text-primary-700',
                    isCurrent && 'text-primary-600',
                    !isCompleted && !isCurrent && 'text-secondary-400',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector bar */}
              {index < STEPS.length - 1 && (
                <div className="mx-3 mt-[-1.5rem] h-0.5 flex-1">
                  <div
                    className={cn(
                      'h-full rounded-full transition-colors duration-500',
                      index < currentStep
                        ? 'bg-primary-600'
                        : 'bg-secondary-200',
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Store Basics
// ---------------------------------------------------------------------------

interface StoreBasicsData {
  name: string
  storeType: StoreType
  description: string
  streetAddress: string
  city: string
  state: string
  zipcode: string
}

function StepStoreBasics({
  data,
  onChange,
  onNext,
  saving,
}: {
  data: StoreBasicsData
  onChange: (data: Partial<StoreBasicsData>) => void
  onNext: () => void
  saving: boolean
}) {
  const slug = useMemo(() => slugify(data.name), [data.name])
  const isValid = data.name.trim().length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isValid) onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-secondary-900">
          Tell us about your store
        </h2>
        <p className="mt-1 text-sm text-secondary-500">
          This information helps customers find and recognize your store.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Store Name"
            placeholder="e.g. Fresh Market Grocery"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
          {slug && (
            <p className="mt-1.5 text-xs text-secondary-400">
              Your store URL: stoca.app/store/
              <span className="font-medium text-secondary-600">{slug}</span>
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="store-type"
            className="mb-1.5 block text-sm font-medium text-secondary-700"
          >
            Store Type
          </label>
          <div className="relative">
            <select
              id="store-type"
              value={data.storeType}
              onChange={(e) =>
                onChange({ storeType: e.target.value as StoreType })
              }
              className={cn(
                'block w-full appearance-none rounded-lg border border-secondary-300 bg-white px-3 py-2 pr-10 text-sm text-secondary-900',
                'transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              )}
            >
              {STORE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-secondary-700"
            >
              Description
            </label>
            <AIRewriteButton
              context={{
                name: data.name,
                category: data.storeType,
                currentText: data.description,
              }}
              onResult={(text) => onChange({ description: text })}
            />
          </div>
          <textarea
            id="description"
            rows={3}
            placeholder="What makes your store special?"
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className={cn(
              'block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 placeholder:text-secondary-400',
              'transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              'resize-none',
            )}
          />
        </div>

        <div className="sm:col-span-2">
          <Input
            label="Street Address"
            placeholder="123 Main Street"
            value={data.streetAddress}
            onChange={(e) => onChange({ streetAddress: e.target.value })}
          />
        </div>

        <Input
          label="City"
          placeholder="New York"
          value={data.city}
          onChange={(e) => onChange({ city: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="State"
            placeholder="NY"
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value })}
          />
          <Input
            label="Zipcode"
            placeholder="10001"
            value={data.zipcode}
            onChange={(e) => onChange({ zipcode: e.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={!isValid} loading={saving} size="lg">
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Operating Hours
// ---------------------------------------------------------------------------

function StepHours({
  hours,
  onChange,
  onNext,
  onBack,
  saving,
}: {
  hours: OperatingHoursState
  onChange: (hours: OperatingHoursState) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  const updateDay = (day: string, update: Partial<DayHours>) => {
    onChange({ ...hours, [day]: { ...hours[day], ...update } })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-secondary-900">
          Set your operating hours
        </h2>
        <p className="mt-1 text-sm text-secondary-500">
          Let customers know when they can shop. You can change these later.
        </p>
      </div>

      <div className="space-y-3">
        {DAYS.map((day) => {
          const dayHours = hours[day]
          return (
            <div
              key={day}
              className={cn(
                'flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors duration-200',
                dayHours.enabled
                  ? 'border-secondary-200 bg-white'
                  : 'border-secondary-100 bg-secondary-50',
              )}
            >
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={dayHours.enabled}
                aria-label={`Toggle ${DAY_LABELS[day]}`}
                onClick={() => updateDay(day, { enabled: !dayHours.enabled })}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                  dayHours.enabled ? 'bg-primary-600' : 'bg-secondary-300',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    dayHours.enabled ? 'translate-x-5' : 'translate-x-0',
                  )}
                />
              </button>

              {/* Day label */}
              <span
                className={cn(
                  'w-24 text-sm font-medium',
                  dayHours.enabled
                    ? 'text-secondary-900'
                    : 'text-secondary-400',
                )}
              >
                {DAY_LABELS[day]}
              </span>

              {/* Time pickers */}
              {dayHours.enabled ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={dayHours.open}
                    onChange={(e) => updateDay(day, { open: e.target.value })}
                    className="rounded-md border border-secondary-300 bg-white px-2 py-1.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    aria-label={`${DAY_LABELS[day]} open time`}
                  />
                  <span className="text-sm text-secondary-400">to</span>
                  <input
                    type="time"
                    value={dayHours.close}
                    onChange={(e) => updateDay(day, { close: e.target.value })}
                    className="rounded-md border border-secondary-300 bg-white px-2 py-1.5 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    aria-label={`${DAY_LABELS[day]} close time`}
                  />
                </div>
              ) : (
                <span className="text-sm text-secondary-400">Closed</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} size="lg">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="submit" loading={saving} size="lg">
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Add Products
// ---------------------------------------------------------------------------

function CatalogBrowser({
  storeId,
  addedProductIds,
  onAddProduct,
}: {
  storeId: string
  addedProductIds: Set<string>
  onAddProduct: (product: GlobalProduct, price: number) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<GlobalProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [pricingProduct, setPricingProduct] = useState<GlobalProduct | null>(
    null,
  )
  const [price, setPrice] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchProducts = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setProducts([])
        setHasSearched(false)
        return
      }

      setLoading(true)
      setHasSearched(true)

      const { data } = await supabase
        .from('global_products')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .order('name')
        .limit(20)

      setProducts((data as GlobalProduct[]) || [])
      setLoading(false)
    },
    [supabase],
  )

  const handleSearchInput = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchProducts(value), 300)
  }

  const handleConfirmPrice = () => {
    if (!pricingProduct || !price) return
    const numericPrice = parseFloat(price)
    if (isNaN(numericPrice) || numericPrice <= 0) return

    onAddProduct(pricingProduct, numericPrice)
    setPricingProduct(null)
    setPrice('')
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search products... (e.g. milk, bread, apples)"
        value={query}
        onChange={handleSearchInput}
        icon={<Search className="h-4 w-4" />}
      />

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      )}

      {!loading && hasSearched && products.length === 0 && (
        <p className="py-6 text-center text-sm text-secondary-500">
          No products found. Try a different search term.
        </p>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1 chat-scroll">
          {products.map((product) => {
            const isAdded = addedProductIds.has(product.id)
            return (
              <div
                key={product.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                  isAdded
                    ? 'border-primary-200 bg-primary-50'
                    : 'border-secondary-200 bg-white hover:border-secondary-300',
                )}
              >
                {/* Thumbnail */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-secondary-100">
                  {product.image_urls?.[0] ? (
                    <img
                      src={product.image_urls[0]}
                      alt={product.name}
                      className="h-full w-full rounded-md object-cover"
                    />
                  ) : (
                    <Package className="h-5 w-5 text-secondary-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-secondary-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-secondary-500 truncate">
                    {product.category}
                    {product.brand ? ` - ${product.brand}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isAdded}
                  onClick={() => {
                    setPricingProduct(product)
                    setPrice('')
                  }}
                  className={cn(
                    'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    isAdded
                      ? 'bg-primary-100 text-primary-700 cursor-default'
                      : 'bg-primary-600 text-white hover:bg-primary-700',
                  )}
                >
                  {isAdded ? 'Added' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Price modal */}
      {pricingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setPricingProduct(null)}
          />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setPricingProduct(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-semibold text-secondary-900">Set price</h3>
            <p className="mt-1 text-sm text-secondary-500 truncate">
              {pricingProduct.name}
            </p>
            <div className="mt-4">
              <Input
                label="Your Price ($)"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setPricingProduct(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPrice}
                disabled={!price || parseFloat(price) <= 0}
                className="flex-1"
              >
                Add Product
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ManualProductForm({
  onAdd,
}: {
  onAdd: (product: Omit<AddedProduct, 'id' | 'globalProductId' | 'imageUrls'>) => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('10')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const numPrice = parseFloat(price)
    if (!name.trim() || isNaN(numPrice) || numPrice <= 0) return

    onAdd({
      name: name.trim(),
      price: numPrice,
      category: category.trim() || 'General',
      description: description.trim() || null,
      quantity: parseInt(quantity) || 10,
    })

    setName('')
    setPrice('')
    setCategory('')
    setDescription('')
    setQuantity('10')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Product Name"
          placeholder="e.g. Organic Whole Milk"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Price ($)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <Input
          label="Category"
          placeholder="e.g. Dairy"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <Input
          label="Quantity"
          type="number"
          min="0"
          placeholder="10"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="manual-desc"
            className="block text-sm font-medium text-secondary-700"
          >
            Description
          </label>
          <AIRewriteButton
            context={{
              name,
              price: parseFloat(price) || undefined,
              category: category || undefined,
              currentText: description,
            }}
            onResult={(text) => setDescription(text)}
          />
        </div>
        <textarea
          id="manual-desc"
          rows={2}
          placeholder="Optional product description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={cn(
            'block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 placeholder:text-secondary-400',
            'transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none',
          )}
        />
      </div>
      <Button type="submit" disabled={!name.trim() || !price}>
        <Plus className="h-4 w-4" />
        Add Product
      </Button>
    </form>
  )
}

function StepProducts({
  storeId,
  storeName,
  products,
  onAddFromCatalog,
  onAddManual,
  onRemoveProduct,
  onNext,
  onBack,
  saving,
}: {
  storeId: string
  storeName: string
  products: AddedProduct[]
  onAddFromCatalog: (product: GlobalProduct, price: number) => void
  onAddManual: (
    product: Omit<AddedProduct, 'id' | 'globalProductId' | 'imageUrls'>,
  ) => void
  onRemoveProduct: (id: string) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  const [activeOption, setActiveOption] = useState<
    'catalog' | 'scan' | 'manual' | null
  >(null)
  const [showChat, setShowChat] = useState(false)

  const addedGlobalIds = useMemo(
    () => new Set(products.filter((p) => p.globalProductId).map((p) => p.globalProductId!)),
    [products],
  )

  const optionCards = [
    {
      key: 'catalog' as const,
      icon: Search,
      title: 'Browse Catalog',
      description: 'Search our global product catalog and add items to your store',
    },
    {
      key: 'scan' as const,
      icon: Camera,
      title: 'Scan Shelves',
      description: 'Take a photo of your shelves to auto-detect products',
    },
    {
      key: 'manual' as const,
      icon: Plus,
      title: 'Add Manually',
      description: 'Manually enter product details one at a time',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-secondary-900">
          Add your products
        </h2>
        <p className="mt-1 text-sm text-secondary-500">
          Choose how you want to add products to your store. You can use
          multiple methods.
        </p>
      </div>

      <div className="flex gap-4">
        {/* Main content area */}
        <div className={cn('flex-1 min-w-0', showChat && 'max-w-[60%]')}>
          {/* Option cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {optionCards.map((card) => {
              const isActive = activeOption === card.key
              const isScan = card.key === 'scan'
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => {
                    if (isScan) {
                      setShowChat(true)
                      return
                    }
                    setActiveOption(isActive ? null : card.key)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all duration-200',
                    isActive
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-secondary-200 bg-white hover:border-secondary-300 hover:shadow-sm',
                    isScan && 'opacity-80',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-secondary-100 text-secondary-500',
                    )}
                  >
                    <card.icon className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      isActive ? 'text-primary-900' : 'text-secondary-900',
                    )}
                  >
                    {card.title}
                  </span>
                  <span className="text-xs text-secondary-500 leading-relaxed">
                    {isScan ? 'Coming soon' : card.description}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Active panel */}
          {activeOption && (
            <div className="mt-5 rounded-xl border border-secondary-200 bg-white p-5 transition-all duration-300">
              {activeOption === 'catalog' && (
                <CatalogBrowser
                  storeId={storeId}
                  addedProductIds={addedGlobalIds}
                  onAddProduct={onAddFromCatalog}
                />
              )}
              {activeOption === 'manual' && (
                <ManualProductForm onAdd={onAddManual} />
              )}
            </div>
          )}

          {/* Added products list */}
          {products.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-secondary-700">
                Added Products ({products.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 chat-scroll">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded-lg border border-secondary-200 bg-white px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100">
                      {product.imageUrls?.[0] ? (
                        <img
                          src={product.imageUrls[0]}
                          alt={product.name}
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <Package className="h-4 w-4 text-secondary-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-secondary-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-secondary-500">
                        {product.category} - Qty: {product.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-secondary-900">
                      {formatPrice(product.price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(product.id)}
                      className="shrink-0 rounded-md p-1.5 text-secondary-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Chat sidebar */}
        {showChat && (
          <div className="hidden w-[40%] shrink-0 lg:block">
            <div className="relative h-[500px]">
              <button
                type="button"
                onClick={() => setShowChat(false)}
                className="absolute -left-3 top-2 z-10 rounded-full bg-white p-1 shadow-md border border-secondary-200 text-secondary-400 hover:text-secondary-600"
                aria-label="Close chat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <ChatWindow
                storeId={storeId}
                storeName={storeName}
                className="h-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* AI help toggle (visible when chat is hidden) */}
      {!showChat && (
        <button
          type="button"
          onClick={() => setShowChat(true)}
          className="hidden lg:flex items-center gap-2 rounded-lg border border-dashed border-primary-300 bg-primary-50/50 px-4 py-2.5 text-sm text-primary-700 transition-colors hover:bg-primary-50 hover:border-primary-400"
        >
          <MessageSquare className="h-4 w-4" />
          Need help? Ask our AI assistant
        </button>
      )}

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} size="lg">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} loading={saving} size="lg">
          {products.length === 0 ? 'Skip for now' : 'Next'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — Review & Launch
// ---------------------------------------------------------------------------

function StepReview({
  storeData,
  hours,
  products,
  onBack,
  onLaunch,
  saving,
}: {
  storeData: StoreBasicsData
  hours: OperatingHoursState
  products: AddedProduct[]
  onBack: () => void
  onLaunch: () => void
  saving: boolean
}) {
  const slug = slugify(storeData.name)

  const enabledDays = DAYS.filter((d) => hours[d].enabled)

  const formatTime = (time: string) => {
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${m} ${ampm}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-secondary-900">
          Review your store
        </h2>
        <p className="mt-1 text-sm text-secondary-500">
          Everything looks good? Hit Go Live to make your store available to
          customers.
        </p>
      </div>

      {/* Store preview card */}
      <Card className="overflow-hidden" padding="none">
        {/* Banner area */}
        <div className="relative h-32 bg-gradient-to-br from-primary-500 to-primary-700">
          <div className="absolute inset-0 flex items-center justify-center">
            <Store className="h-12 w-12 text-white/30" />
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Store avatar */}
            <div className="flex h-16 w-16 -mt-12 shrink-0 items-center justify-center rounded-xl border-4 border-white bg-primary-100 shadow-sm">
              <Store className="h-7 w-7 text-primary-700" />
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-lg font-bold text-secondary-900">
                {storeData.name}
              </h3>
              <p className="text-sm text-secondary-500">
                {STORE_TYPES.find((t) => t.value === storeData.storeType)?.label}{' '}
                Store
              </p>
            </div>
          </div>

          {storeData.description && (
            <p className="mt-3 text-sm text-secondary-600 leading-relaxed">
              {storeData.description}
            </p>
          )}

          {/* Details grid */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Address */}
            <div className="rounded-lg bg-secondary-50 p-3">
              <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide">
                Location
              </p>
              <p className="mt-1 text-sm text-secondary-800">
                {[storeData.streetAddress, storeData.city, storeData.state]
                  .filter(Boolean)
                  .join(', ') || 'Not specified'}
                {storeData.zipcode ? ` ${storeData.zipcode}` : ''}
              </p>
            </div>

            {/* Hours summary */}
            <div className="rounded-lg bg-secondary-50 p-3">
              <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide">
                Hours
              </p>
              <p className="mt-1 text-sm text-secondary-800">
                {enabledDays.length === 7
                  ? 'Open 7 days'
                  : `Open ${enabledDays.length} days`}
              </p>
              {enabledDays.length > 0 && (
                <p className="text-xs text-secondary-500">
                  {formatTime(hours[enabledDays[0]].open)} -{' '}
                  {formatTime(hours[enabledDays[0]].close)}
                </p>
              )}
            </div>

            {/* Products */}
            <div className="rounded-lg bg-secondary-50 p-3">
              <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide">
                Products
              </p>
              <p className="mt-1 text-sm text-secondary-800">
                {products.length}{' '}
                {products.length === 1 ? 'product' : 'products'}
              </p>
              {products.length > 0 && (
                <p className="text-xs text-secondary-500">
                  Ready to sell
                </p>
              )}
            </div>
          </div>

          {/* Hours breakdown */}
          <div className="mt-5">
            <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide mb-2">
              Weekly Schedule
            </p>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((day) => {
                const dh = hours[day]
                return (
                  <div
                    key={day}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-center',
                      dh.enabled
                        ? 'bg-primary-50 text-primary-800'
                        : 'bg-secondary-100 text-secondary-400',
                    )}
                  >
                    <p className="text-xs font-medium">
                      {DAY_LABELS[day].slice(0, 3)}
                    </p>
                    {dh.enabled ? (
                      <p className="text-[10px] mt-0.5">
                        {formatTime(dh.open).replace(' ', '')}
                      </p>
                    ) : (
                      <p className="text-[10px] mt-0.5">Off</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Product list summary */}
          {products.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide mb-2">
                Product Catalog
              </p>
              <div className="flex flex-wrap gap-2">
                {products.slice(0, 8).map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-1 text-xs text-secondary-700"
                  >
                    {p.name}
                    <span className="ml-1.5 font-medium text-secondary-900">
                      {formatPrice(p.price)}
                    </span>
                  </span>
                ))}
                {products.length > 8 && (
                  <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-1 text-xs text-secondary-500">
                    +{products.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Store URL preview */}
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-dashed border-secondary-300 bg-secondary-50 px-3 py-2.5">
            <ExternalLink className="h-4 w-4 shrink-0 text-secondary-400" />
            <span className="text-sm text-secondary-500">
              stoca.app/store/
            </span>
            <span className="text-sm font-semibold text-primary-700">
              {slug}
            </span>
          </div>
        </div>
      </Card>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} size="lg">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onLaunch} loading={saving} size="lg">
          <Rocket className="h-4 w-4" />
          Go Live
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Celebration Screen
// ---------------------------------------------------------------------------

function CelebrationScreen({
  storeName,
  storeSlug,
}: {
  storeName: string
  storeSlug: string
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const storeUrl = `stoca.app/store/${storeSlug}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${storeUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback silent
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center py-12 text-center overflow-hidden">
      {/* CSS confetti particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="confetti-particle absolute"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
              backgroundColor: [
                '#059669',
                '#10b981',
                '#34d399',
                '#6ee7b7',
                '#fbbf24',
                '#f59e0b',
                '#3b82f6',
                '#8b5cf6',
                '#ec4899',
              ][i % 9],
              width: `${6 + Math.random() * 6}px`,
              height: `${6 + Math.random() * 6}px`,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            }}
          />
        ))}
      </div>

      {/* Checkmark */}
      <div className="celebration-check relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 shadow-lg shadow-primary-200/50">
          <Check className="h-10 w-10 text-primary-600" strokeWidth={3} />
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full bg-primary-400/20 animate-ping" />
      </div>

      <h2 className="celebration-text text-3xl font-bold text-secondary-900">
        Your store is live!
      </h2>
      <p className="celebration-text mt-2 text-secondary-500 max-w-md">
        Congratulations! <span className="font-semibold text-secondary-700">{storeName}</span> is
        now available for customers to browse and order from.
      </p>

      {/* Shareable link */}
      <div className="celebration-text mt-8 flex items-center gap-2 rounded-xl border border-secondary-200 bg-white px-4 py-3 shadow-sm">
        <ExternalLink className="h-4 w-4 text-secondary-400" />
        <span className="text-sm text-secondary-600">{storeUrl}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'ml-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
            copied
              ? 'bg-primary-100 text-primary-700'
              : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200',
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* CTA */}
      <div className="celebration-text mt-8">
        <Button
          size="lg"
          onClick={() => router.push('/dashboard')}
        >
          <Sparkles className="h-4 w-4" />
          Go to Dashboard
        </Button>
      </div>

      {/* CSS keyframes via style tag */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(calc(100vh + 20px)) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-particle {
          animation: confetti-fall linear forwards;
          top: -10px;
        }
        @keyframes celebration-in {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .celebration-check {
          animation: celebration-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .celebration-text {
          animation: celebration-in 0.5s ease-out both;
          animation-delay: 0.3s;
        }
        .celebration-text:nth-child(4) { animation-delay: 0.4s; }
        .celebration-text:nth-child(5) { animation-delay: 0.5s; }
        .celebration-text:nth-child(6) { animation-delay: 0.6s; }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Onboarding Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  // Step state
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [launched, setLaunched] = useState(false)

  // Auth
  const [userId, setUserId] = useState<string | null>(null)

  // Step 1 data
  const [storeData, setStoreData] = useState<StoreBasicsData>({
    name: '',
    storeType: 'GROCERY',
    description: '',
    streetAddress: '',
    city: '',
    state: '',
    zipcode: '',
  })
  const [storeId, setStoreId] = useState<string | null>(null)

  // Step 2 data
  const [hours, setHours] = useState<OperatingHoursState>(DEFAULT_HOURS)

  // Step 3 data
  const [products, setProducts] = useState<AddedProduct[]>([])

  // Transition direction for slide animation
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
    }
    getUser()
  }, [supabase, router])

  // Step transition helper
  const goToStep = useCallback(
    (step: number) => {
      setDirection(step > currentStep ? 'forward' : 'backward')
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep(step)
        setIsTransitioning(false)
        setError(null)
      }, 150)
    },
    [currentStep],
  )

  // Step 1: Create store in Supabase
  const handleStoreBasicsNext = useCallback(async () => {
    if (!userId) return

    setSaving(true)
    setError(null)

    try {
      const slug = slugify(storeData.name)

      if (storeId) {
        // Update existing store
        const { error: updateError } = await supabase
          .from('stores')
          .update({
            name: storeData.name,
            slug,
            store_type: storeData.storeType,
            description: storeData.description || null,
            street_address: storeData.streetAddress || null,
            city: storeData.city || null,
            state: storeData.state || null,
            zipcode: storeData.zipcode || null,
          })
          .eq('id', storeId)

        if (updateError) throw updateError
      } else {
        // Create new store
        const { data, error: insertError } = await supabase
          .from('stores')
          .insert({
            owner_id: userId,
            name: storeData.name,
            slug,
            store_type: storeData.storeType,
            description: storeData.description || null,
            street_address: storeData.streetAddress || null,
            city: storeData.city || null,
            state: storeData.state || null,
            zipcode: storeData.zipcode || null,
            is_active: false,
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        setStoreId(data.id)
        trackEvent.storeCreated(data.id)
      }

      trackEvent.onboardingStepCompleted(0)
      goToStep(1)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save store details'
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [userId, storeData, storeId, supabase, goToStep])

  // Step 2: Save operating hours
  const handleHoursNext = useCallback(async () => {
    if (!storeId) return

    setSaving(true)
    setError(null)

    try {
      // Convert to the JSONB format the schema expects
      const operatingHours: Record<string, { open: string; close: string }> = {}
      for (const day of DAYS) {
        if (hours[day].enabled) {
          operatingHours[day] = {
            open: hours[day].open,
            close: hours[day].close,
          }
        }
      }

      const { error: updateError } = await supabase
        .from('stores')
        .update({ operating_hours: operatingHours })
        .eq('id', storeId)

      if (updateError) throw updateError

      trackEvent.onboardingStepCompleted(1)
      goToStep(2)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save operating hours'
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [storeId, hours, supabase, goToStep])

  // Step 3: Add product from catalog
  const handleAddFromCatalog = useCallback(
    async (globalProduct: GlobalProduct, price: number) => {
      if (!storeId) return

      setSaving(true)
      try {
        const { data, error: insertError } = await supabase
          .from('store_products')
          .insert({
            store_id: storeId,
            global_product_id: globalProduct.id,
            name: globalProduct.name,
            description: globalProduct.description,
            price,
            category: globalProduct.category,
            subcategory: globalProduct.subcategory,
            image_urls: globalProduct.image_urls,
            quantity: 10,
            is_available: true,
          })
          .select('id')
          .single()

        if (insertError) throw insertError

        setProducts((prev) => [
          ...prev,
          {
            id: data.id,
            name: globalProduct.name,
            price,
            category: globalProduct.category,
            description: globalProduct.description,
            quantity: 10,
            globalProductId: globalProduct.id,
            imageUrls: globalProduct.image_urls,
          },
        ])
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to add product'
        setError(message)
      } finally {
        setSaving(false)
      }
    },
    [storeId, supabase],
  )

  // Step 3: Add manual product
  const handleAddManual = useCallback(
    async (
      product: Omit<AddedProduct, 'id' | 'globalProductId' | 'imageUrls'>,
    ) => {
      if (!storeId) return

      setSaving(true)
      try {
        const { data, error: insertError } = await supabase
          .from('store_products')
          .insert({
            store_id: storeId,
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            quantity: product.quantity,
            is_available: true,
          })
          .select('id')
          .single()

        if (insertError) throw insertError

        setProducts((prev) => [
          ...prev,
          {
            id: data.id,
            name: product.name,
            price: product.price,
            category: product.category,
            description: product.description,
            quantity: product.quantity,
            globalProductId: null,
            imageUrls: [],
          },
        ])
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to add product'
        setError(message)
      } finally {
        setSaving(false)
      }
    },
    [storeId, supabase],
  )

  // Step 3: Remove product
  const handleRemoveProduct = useCallback(
    async (productId: string) => {
      try {
        await supabase.from('store_products').delete().eq('id', productId)
        setProducts((prev) => prev.filter((p) => p.id !== productId))
      } catch {
        // Silent fail for demo
      }
    },
    [supabase],
  )

  // Step 3: Next
  const handleProductsNext = useCallback(() => {
    trackEvent.onboardingStepCompleted(2)
    goToStep(3)
  }, [goToStep])

  // Step 4: Launch
  const handleLaunch = useCallback(async () => {
    if (!storeId) return

    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('stores')
        .update({ is_active: true })
        .eq('id', storeId)

      if (updateError) throw updateError

      trackEvent.onboardingStepCompleted(3)
      setLaunched(true)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to launch store'
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [storeId, supabase])

  // Show loading while auth check completes
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Celebration screen
  if (launched) {
    return (
      <div className="min-h-screen bg-secondary-50">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <CelebrationScreen
            storeName={storeData.name}
            storeSlug={slugify(storeData.name)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Logo / title */}
        <div className="mb-2 text-center">
          <h1 className="text-lg font-bold text-primary-700">Stoca</h1>
          <p className="text-sm text-secondary-500">
            Set up your store in a few minutes
          </p>
        </div>

        {/* Progress bar */}
        <ProgressBar
          currentStep={currentStep}
          onStepClick={(step) => goToStep(step)}
        />

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step content with fade transition */}
        <Card
          padding="lg"
          className={cn(
            'transition-all duration-300',
            isTransitioning
              ? 'opacity-0 translate-y-2'
              : 'opacity-100 translate-y-0',
          )}
        >
          {currentStep === 0 && (
            <StepStoreBasics
              data={storeData}
              onChange={(update) =>
                setStoreData((prev) => ({ ...prev, ...update }))
              }
              onNext={handleStoreBasicsNext}
              saving={saving}
            />
          )}

          {currentStep === 1 && (
            <StepHours
              hours={hours}
              onChange={setHours}
              onNext={handleHoursNext}
              onBack={() => goToStep(0)}
              saving={saving}
            />
          )}

          {currentStep === 2 && storeId && (
            <StepProducts
              storeId={storeId}
              storeName={storeData.name}
              products={products}
              onAddFromCatalog={handleAddFromCatalog}
              onAddManual={handleAddManual}
              onRemoveProduct={handleRemoveProduct}
              onNext={handleProductsNext}
              onBack={() => goToStep(1)}
              saving={saving}
            />
          )}

          {currentStep === 3 && (
            <StepReview
              storeData={storeData}
              hours={hours}
              products={products}
              onBack={() => goToStep(2)}
              onLaunch={handleLaunch}
              saving={saving}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
