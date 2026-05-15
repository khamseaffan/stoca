'use client'

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Check,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  MapPin,
  Save,
  Settings,
  Store as StoreIcon,
  Truck,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { isRenderableImageUrl } from '@/lib/images'
import { cn, slugify } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useDashboard } from '../DashboardContext'
import type { Store, StoreType } from '@/types'

const STORE_TYPES: StoreType[] = [
  'GROCERY',
  'CONVENIENCE',
  'BAKERY',
  'BUTCHER',
  'PHARMACY',
  'HARDWARE',
  'SPECIALTY_FOOD',
  'ORGANIC',
  'DELI',
  'FLOWER',
  'PET',
  'ELECTRONICS',
  'OTHER',
]

const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
] as const

type DayKey = (typeof DAYS)[number]['key']
type MediaKind = 'logo' | 'banner'

type HoursState = Record<DayKey, { enabled: boolean; open: string; close: string }>

interface SettingsForm {
  name: string
  slug: string
  description: string
  storeType: StoreType
  isActive: boolean
  phone: string
  email: string
  streetAddress: string
  city: string
  state: string
  zipcode: string
  country: string
  logoUrl: string
  bannerUrl: string
  pickupEnabled: boolean
  deliveryEnabled: boolean
  deliveryRadiusKm: string
  deliveryFee: string
  minimumOrder: string
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function initialHours(store: Store): HoursState {
  const operatingHours = store.operating_hours as Partial<
    Record<DayKey, { open: string; close: string }>
  >

  return DAYS.reduce((acc, day) => {
    const hours = operatingHours[day.key]
    acc[day.key] = {
      enabled: Boolean(hours),
      open: hours?.open ?? '09:00',
      close: hours?.close ?? '17:00',
    }
    return acc
  }, {} as HoursState)
}

function initialForm(store: Store): SettingsForm {
  return {
    name: store.name,
    slug: store.slug ?? slugify(store.name),
    description: store.description ?? '',
    storeType: store.store_type,
    isActive: store.is_active,
    phone: store.phone ?? '',
    email: store.email ?? '',
    streetAddress: store.street_address ?? '',
    city: store.city ?? '',
    state: store.state ?? '',
    zipcode: store.zipcode ?? '',
    country: store.country ?? 'US',
    logoUrl: store.logo_url ?? '',
    bannerUrl: store.banner_url ?? '',
    pickupEnabled: store.pickup_enabled,
    deliveryEnabled: store.delivery_enabled,
    deliveryRadiusKm: store.delivery_radius_km?.toString() ?? '',
    deliveryFee: store.delivery_fee.toString(),
    minimumOrder: store.minimum_order.toString(),
  }
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toMoneyValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export default function StoreSettingsPage() {
  const { store } = useDashboard()
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = useState<SettingsForm>(() => initialForm(store))
  const [hours, setHours] = useState<HoursState>(() => initialHours(store))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<MediaKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const storeUrl = form.slug ? `/store/${form.slug}` : null
  const enabledDays = useMemo(
    () => DAYS.filter((day) => hours[day.key].enabled).length,
    [hours],
  )

  function updateField<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateHours<K extends keyof HoursState[DayKey]>(
    day: DayKey,
    key: K,
    value: HoursState[DayKey][K],
  ) {
    setHours((current) => ({
      ...current,
      [day]: { ...current[day], [key]: value },
    }))
  }

  async function handleMediaUpload(
    event: ChangeEvent<HTMLInputElement>,
    kind: MediaKind,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(kind)
    setError(null)

    const uploadData = new FormData()
    uploadData.append('image', file)
    uploadData.append('storeId', store.id)
    uploadData.append('kind', kind)

    try {
      const response = await fetch('/api/store/media', {
        method: 'POST',
        body: uploadData,
      })
      const result = (await response.json()) as {
        publicUrl?: string
        error?: string
      }

      if (!response.ok || !result.publicUrl) {
        throw new Error(result.error ?? 'Failed to upload image')
      }

      if (kind === 'logo') {
        updateField('logoUrl', result.publicUrl)
      } else {
        updateField('bannerUrl', result.publicUrl)
      }

      toast({
        title: `${kind === 'logo' ? 'Logo' : 'Banner'} uploaded`,
        description: 'Save settings to publish the new image.',
        variant: 'success',
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload image'
      setError(message)
      toast({
        title: 'Upload failed',
        description: message,
        variant: 'error',
      })
    } finally {
      setUploading(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const normalizedSlug = slugify(form.slug || form.name)
    if (!form.name.trim()) {
      setError('Store name is required.')
      setSaving(false)
      return
    }
    if (!normalizedSlug) {
      setError('Store URL slug is required.')
      setSaving(false)
      return
    }
    if (!form.pickupEnabled && !form.deliveryEnabled) {
      setError('Enable at least one fulfillment option.')
      setSaving(false)
      return
    }
    if (form.logoUrl.trim() && !isRenderableImageUrl(form.logoUrl)) {
      setError('Logo URL must point directly to an image, not a webpage.')
      setSaving(false)
      return
    }
    if (form.bannerUrl.trim() && !isRenderableImageUrl(form.bannerUrl)) {
      setError('Banner URL must point directly to an image, not a webpage.')
      setSaving(false)
      return
    }

    const operatingHours = DAYS.reduce(
      (acc, day) => {
        const dayHours = hours[day.key]
        if (dayHours.enabled) {
          acc[day.key] = {
            open: dayHours.open,
            close: dayHours.close,
          }
        }
        return acc
      },
      {} as Record<string, { open: string; close: string }>,
    )

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        name: form.name.trim(),
        slug: normalizedSlug,
        description: form.description.trim() || null,
        store_type: form.storeType,
        is_active: form.isActive,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        street_address: form.streetAddress.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zipcode: form.zipcode.trim() || null,
        country: form.country.trim() || 'US',
        logo_url: form.logoUrl.trim() || null,
        banner_url: form.bannerUrl.trim() || null,
        pickup_enabled: form.pickupEnabled,
        delivery_enabled: form.deliveryEnabled,
        delivery_radius_km: form.deliveryEnabled
          ? toNullableNumber(form.deliveryRadiusKm)
          : null,
        delivery_fee: form.deliveryEnabled ? toMoneyValue(form.deliveryFee) : 0,
        minimum_order: toMoneyValue(form.minimumOrder),
        operating_hours: operatingHours,
      })
      .eq('id', store.id)

    if (updateError) {
      setError(updateError.message)
      toast({
        title: 'Settings were not saved',
        description: updateError.message,
        variant: 'error',
      })
      setSaving(false)
      return
    }

    setForm((current) => ({ ...current, slug: normalizedSlug }))
    router.refresh()
    toast({ title: 'Store settings saved', variant: 'success' })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
      <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Store Settings</h1>
          <p className="text-sm text-secondary-500">
            Manage your storefront, fulfillment, and operating details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={form.isActive ? 'success' : 'default'}>
            {form.isActive ? 'Live' : 'Draft'}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('open-dashboard-chat'))}
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Ask Agent</span>
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <StoreIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-secondary-900">Store Profile</h2>
                <p className="text-sm text-secondary-500">
                  Public information customers see across Stoca.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Store name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                required
              />
              <Input
                label="Store URL slug"
                value={form.slug}
                onChange={(event) => updateField('slug', event.target.value)}
                onBlur={() => updateField('slug', slugify(form.slug || form.name))}
                required
              />
              <div className="md:col-span-2">
                <label
                  htmlFor="description"
                  className="mb-1.5 block text-sm font-medium text-secondary-700"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  rows={4}
                  className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="A short summary of your store."
                />
              </div>
              <div>
                <label
                  htmlFor="store-type"
                  className="mb-1.5 block text-sm font-medium text-secondary-700"
                >
                  Store type
                </label>
                <select
                  id="store-type"
                  value={form.storeType}
                  onChange={(event) =>
                    updateField('storeType', event.target.value as StoreType)
                  }
                  className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  {STORE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {titleCase(type)}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-secondary-200 px-3 py-2">
                <span>
                  <span className="block text-sm font-medium text-secondary-900">
                    Store is visible
                  </span>
                  <span className="block text-xs text-secondary-500">
                    Active stores can appear in search and storefront pages.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateField('isActive', event.target.checked)}
                  className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
              </label>
            </div>
          </Card>

          <Card>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-secondary-900">Contact & Location</h2>
                <p className="text-sm text-secondary-500">
                  Keep customer contact and address information current.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Phone"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                type="tel"
              />
              <Input
                label="Email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                type="email"
              />
              <Input
                label="Street address"
                value={form.streetAddress}
                onChange={(event) => updateField('streetAddress', event.target.value)}
                className="md:col-span-2"
              />
              <Input
                label="City"
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
              />
              <Input
                label="State"
                value={form.state}
                onChange={(event) => updateField('state', event.target.value)}
              />
              <Input
                label="ZIP code"
                value={form.zipcode}
                onChange={(event) => updateField('zipcode', event.target.value)}
              />
              <Input
                label="Country"
                value={form.country}
                onChange={(event) => updateField('country', event.target.value)}
              />
            </div>
          </Card>

          <Card>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-secondary-900">Fulfillment</h2>
                <p className="text-sm text-secondary-500">
                  Configure pickup and local delivery options.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-lg border border-secondary-200 px-3 py-2">
                <span>
                  <span className="block text-sm font-medium text-secondary-900">
                    Pickup
                  </span>
                  <span className="block text-xs text-secondary-500">
                    Customers can collect orders in store.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.pickupEnabled}
                  onChange={(event) =>
                    updateField('pickupEnabled', event.target.checked)
                  }
                  className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-secondary-200 px-3 py-2">
                <span>
                  <span className="block text-sm font-medium text-secondary-900">
                    Delivery
                  </span>
                  <span className="block text-xs text-secondary-500">
                    Customers can request local delivery.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.deliveryEnabled}
                  onChange={(event) =>
                    updateField('deliveryEnabled', event.target.checked)
                  }
                  className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
              </label>
              <Input
                label="Delivery radius (km)"
                type="number"
                min="0"
                step="0.1"
                value={form.deliveryRadiusKm}
                disabled={!form.deliveryEnabled}
                onChange={(event) =>
                  updateField('deliveryRadiusKm', event.target.value)
                }
              />
              <Input
                label="Delivery fee"
                type="number"
                min="0"
                step="0.01"
                value={form.deliveryFee}
                disabled={!form.deliveryEnabled}
                onChange={(event) => updateField('deliveryFee', event.target.value)}
                icon={<DollarSign className="h-4 w-4" />}
              />
              <Input
                label="Minimum order"
                type="number"
                min="0"
                step="0.01"
                value={form.minimumOrder}
                onChange={(event) => updateField('minimumOrder', event.target.value)}
                icon={<DollarSign className="h-4 w-4" />}
              />
            </div>
          </Card>

          <Card>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-secondary-900">Operating Hours</h2>
                <p className="text-sm text-secondary-500">
                  Set the days and hours your store accepts orders.
                </p>
              </div>
            </div>

            <div className="divide-y divide-secondary-100 rounded-lg border border-secondary-200">
              {DAYS.map((day) => {
                const dayHours = hours[day.key]
                return (
                  <div
                    key={day.key}
                    className="grid gap-3 px-4 py-3 sm:grid-cols-[80px_1fr_1fr_64px] sm:items-center"
                  >
                    <span className="text-sm font-medium text-secondary-900">
                      {day.label}
                    </span>
                    <Input
                      aria-label={`${day.label} open time`}
                      type="time"
                      value={dayHours.open}
                      disabled={!dayHours.enabled}
                      onChange={(event) =>
                        updateHours(day.key, 'open', event.target.value)
                      }
                    />
                    <Input
                      aria-label={`${day.label} close time`}
                      type="time"
                      value={dayHours.close}
                      disabled={!dayHours.enabled}
                      onChange={(event) =>
                        updateHours(day.key, 'close', event.target.value)
                      }
                    />
                    <label className="flex items-center gap-2 text-sm text-secondary-700 sm:justify-end">
                      <input
                        type="checkbox"
                        checked={dayHours.enabled}
                        onChange={(event) =>
                          updateHours(day.key, 'enabled', event.target.checked)
                        }
                        className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                      />
                      Open
                    </label>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-secondary-900">Status</h2>
                <p className="text-sm text-secondary-500">Store readiness summary.</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-secondary-500">Visibility</span>
                <Badge variant={form.isActive ? 'success' : 'default'}>
                  {form.isActive ? 'Live' : 'Draft'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary-500">Fulfillment</span>
                <span className="font-medium text-secondary-900">
                  {form.pickupEnabled && form.deliveryEnabled
                    ? 'Pickup + Delivery'
                    : form.pickupEnabled
                      ? 'Pickup'
                      : form.deliveryEnabled
                        ? 'Delivery'
                        : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-secondary-500">Open days</span>
                <span className="font-medium text-secondary-900">{enabledDays}</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-secondary-900">Storefront</h2>
                <p className="text-sm text-secondary-500">Preview public store access.</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-700">
                {storeUrl ?? 'Add a slug to create a storefront URL.'}
              </div>
              {storeUrl && (
                <a
                  href={storeUrl}
                  target="_blank"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  View storefront
                </a>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-secondary-900">Brand Media</h2>
                <p className="text-sm text-secondary-500">Optional hosted image URLs.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  label="Logo URL"
                  value={form.logoUrl}
                  onChange={(event) => updateField('logoUrl', event.target.value)}
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleMediaUpload(event, 'logo')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={uploading === 'logo'}
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4" />
                  Upload Logo
                </Button>
              </div>

              <div className="space-y-2">
                <Input
                  label="Banner URL"
                  value={form.bannerUrl}
                  onChange={(event) => updateField('bannerUrl', event.target.value)}
                />
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleMediaUpload(event, 'banner')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={uploading === 'banner'}
                  onClick={() => bannerInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4" />
                  Upload Banner
                </Button>
              </div>
            </div>
          </Card>

          <div className="sticky bottom-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={saving}
              className={cn('w-full shadow-lg', saving && 'shadow-none')}
            >
              <Save className="h-4 w-4" />
              Save Store Settings
            </Button>
          </div>
        </aside>
      </div>
    </form>
  )
}
