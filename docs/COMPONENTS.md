# Stoca Component Catalog

## Chat Components (The Showpiece)

### ChatWindow

**File**: `app/components/chat/ChatWindow.tsx` (`'use client'`)  
**Used in**: Dashboard main page (right 35% panel), Onboarding step 3 (sidebar)

The most polished component in the project. A full-height streaming chat interface powered by AI SDK v6.

**Props**:
```typescript
interface ChatWindowProps {
  storeId: string      // Store UUID — passed to /api/ai/chat
  storeName: string    // Displayed in the header
  className?: string   // Additional container classes
}
```

**Usage**:
```tsx
<ChatWindow
  storeId={store.id}
  storeName={store.name}
  className="h-[600px]"
/>
```

**Features**:
- Uses `useChat()` from `@ai-sdk/react` with transport pointing to `/api/ai/chat`
- Auto-scrolls to bottom on new messages via ref + useEffect
- Typing indicator: 3 bouncing dots shown when `status === 'submitted'` and last message is from user
- Suggestion chips when empty: "Show low stock alerts", "Today's sales summary", "Recent orders"
- Image upload: hidden file input triggered by Camera button, preview shown above input
- Send button: emerald when active, gray when disabled (empty input or loading)
- Custom scrollbar via `.chat-scroll` CSS class

**State management**: The component manages its own input state (`inputValue`) rather than using `useChat`'s built-in input (which was removed in AI SDK v6). Messages and streaming status come from the hook.

---

### ChatMessage

**File**: `app/components/chat/ChatMessage.tsx` (`'use client'`)  
**Used in**: ChatWindow (renders each message in the messages array)

**Props**:
```typescript
interface ChatMessageProps {
  message: UIMessage   // From AI SDK v6 — has role, parts[]
  isLast: boolean      // Used for potential "still streaming" indicators
}
```

**Usage**:
```tsx
{messages.map((message, i) => (
  <ChatMessage key={message.id} message={message} isLast={i === messages.length - 1} />
))}
```

**Rendering logic**:
- Extracts text from `message.parts` where `type === 'text'`, joins into a single string
- Extracts tool parts where `type` starts with `'tool-'` or equals `'dynamic-tool'`
- Extracts file parts where `type === 'file'` for image attachments
- User messages: right-aligned, emerald background, `rounded-br-sm`
- Assistant messages: left-aligned, white with border, `rounded-bl-sm`
- Text rendering: parses `**bold**`, `` `inline code` ``, bullet points (`-`/`*`), numbered lists
- Each message has a small circular avatar (Bot icon for assistant, User icon for user)
- Entrance animation: `chat-message-in` (fade + slide up, 300ms)

---

### ToolCallCard

**File**: `app/components/chat/ToolCallCard.tsx` (`'use client'`)  
**Used in**: ChatMessage (rendered for each tool invocation part)

**Props**:
```typescript
interface ToolCallCardProps {
  toolPart: {
    type: string           // 'tool-<name>' or 'dynamic-tool'
    toolCallId: string
    toolName?: string      // Present on dynamic-tool parts
    state: string          // 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
    input?: unknown        // Tool arguments
    output?: unknown       // Tool result
    errorText?: string     // Error message on failure
  }
}
```

**Usage**:
```tsx
<ToolCallCard toolPart={part} />
```

**Visual states**:
| State | Left border | Indicator |
|---|---|---|
| `input-streaming`, `input-available` | Amber | Spinner + "Running..." |
| `output-available` (success) | Green | Checkmark + result summary |
| `output-available` (with error in output) | Red | Alert + error message |
| `output-error` | Red | Alert + errorText |

**Icon mapping** (by tool name keyword):
| Keyword | Icon |
|---|---|
| `price` | DollarSign |
| `product`, `add`, `remove`, `stock` | Package |
| `order`, `status` | ShoppingCart |
| `store`, `hours`, `info` | Store |
| `promotion` | Tag |
| `sales`, `top`, `analytics` | BarChart3 |
| `search` | Search |
| `inventory`, `image` | Camera |
| default | Wrench |

**Result summary**: Parses the output object to show human-readable summaries like "Price updated to $4.99", "3 products found", "Revenue: $247.50". Falls back to "Done" or the raw message.

**Expandable**: Clicking a completed card toggles a detail panel showing full JSON of input arguments and output result.

---

### ImageUploadPreview

**File**: `app/components/chat/ImageUploadPreview.tsx` (`'use client'`)  
**Used in**: ChatWindow (shown above input when an image is selected)

**Props**:
```typescript
interface ImageUploadPreviewProps {
  imageUrl: string     // Object URL for the preview thumbnail
  fileName: string     // Original file name (truncated in display)
  onRemove: () => void // Clear the selected image
  onScan: () => void   // Trigger inventory scan message
}
```

**Usage**:
```tsx
<ImageUploadPreview
  imageUrl={imagePreview}
  fileName={selectedImage.name}
  onRemove={clearImage}
  onScan={handleScan}
/>
```

Renders a compact bar: 40x40 thumbnail, truncated filename, "Scan Inventory" button (primary), and X remove button. Uses `chat-slide-up` entrance animation.

---

## Commerce Components

### ProductCard

**File**: `app/components/commerce/ProductCard.tsx` (`'use client'`)  
**Used in**: Store page (product grid), Search results, Onboarding step 3

**Props**:
```typescript
interface ProductCardProps {
  product: StoreProduct
  onAddToCart: (productId: string) => void
}
```

**Usage**:
```tsx
<ProductCard product={product} onAddToCart={(id) => addToCart(id)} />
```

**Features**:
- Image area: `aspect-square` with Next.js Image, or Package icon placeholder on `bg-secondary-100`
- Price: `formatPrice()`, with struck-through `compare_at_price` if present
- Stock indicators:
  - `quantity === 0` or `!is_available`: gray overlay, "Out of Stock" badge, button disabled
  - `quantity > 0 && quantity <= low_stock_threshold`: amber "Only X left" text
- Card is a Next.js `Link` to `/product/${product.id}`
- "Add to Cart" button stops event propagation (doesn't navigate)
- Hover: `shadow-md` transition

---

### StoreCard

**File**: `app/components/commerce/StoreCard.tsx` (Server Component)  
**Used in**: Landing page (featured stores), Search results

**Props**:
```typescript
interface StoreCardProps {
  store: Pick<Store, 'id' | 'name' | 'slug' | 'store_type' | 'city' | 'state' | 'logo_url'>
}
```

**Usage**:
```tsx
<StoreCard store={{ id, name, slug, store_type, city, state, logo_url }} />
```

Renders as a `Link` to `/store/${slug}`. Shows a 60x60 logo image or a circle with the store's initial on `primary-600` background. Store type is displayed as a Badge with underscores replaced and title-cased.

---

### CartDrawer

**File**: `app/components/commerce/CartDrawer.tsx` (`'use client'`)  
**Used in**: Currently unused (available for Navbar integration)

**Props**:
```typescript
interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: CartWithItems[]
  onUpdateQuantity: (itemId: string, quantity: number) => void
  onRemoveItem: (itemId: string) => void
}
```

Fixed right slide-in panel (`translate-x` animation) with `bg-black/50` overlay. Groups items by store using `useMemo`. Each item shows thumbnail, name, price, quantity controls (minus/plus), line total, and remove (Trash2) button. Sticky footer with subtotal and checkout button. Empty state with ShoppingBag icon.

---

## UI Components

### Button

**File**: `app/components/ui/Button.tsx` (`'use client'`, `forwardRef`)

**Props**:
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'  // default: 'primary'
  size?: 'sm' | 'md' | 'lg'       // default: 'md'
  loading?: boolean                // Shows spinner, disables button
}
```

**Usage**:
```tsx
<Button variant="primary" size="lg" loading={isSubmitting}>Save Changes</Button>
<Button variant="danger" size="sm">Delete</Button>
<Button variant="ghost" onClick={onCancel}>Cancel</Button>
```

---

### Badge / OrderStatusBadge

**File**: `app/components/ui/Badge.tsx` (Server Component)

**Badge props**:
```typescript
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'  // default: 'default'
  size?: 'sm' | 'md'      // default: 'sm'
  children: React.ReactNode
  className?: string
}
```

**OrderStatusBadge** — maps `OrderStatus` to appropriate badge:
```typescript
function OrderStatusBadge({ status }: { status: OrderStatus })
```

| Status | Variant | Label |
|---|---|---|
| `PENDING` | info | Pending |
| `CONFIRMED` | info | Confirmed |
| `PREPARING` | warning | Preparing |
| `READY_FOR_PICKUP` | success | Ready for Pickup |
| `OUT_FOR_DELIVERY` | success | Out for Delivery |
| `DELIVERED` | success | Delivered |
| `COMPLETED` | success | Completed |
| `CANCELLED` | danger | Cancelled |

**Usage**:
```tsx
<OrderStatusBadge status={order.status} />
```

---

### Modal

**File**: `app/components/ui/Modal.tsx` (`'use client'`)

**Props**:
```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'   // default: 'md'
}
```

**Usage**:
```tsx
<Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="Order Details" size="lg">
  <OrderDetailContent order={selectedOrder} />
</Modal>
```

Uses `createPortal` to render into `document.body`. Features: ESC key close, click-outside close, body scroll lock, `aria-modal` attribute.

---

### Other UI Components

| Component | File | Description |
|---|---|---|
| **Input** | `ui/Input.tsx` | Label, error state, optional left icon. `forwardRef`. |
| **Card** | `ui/Card.tsx` | `bg-white rounded-xl shadow-sm border`. Padding: none/sm/md/lg. |
| **LoadingSpinner** | `ui/LoadingSpinner.tsx` | SVG spinner in `primary-600`. Sizes: sm/md/lg. |
| **EmptyState** | `ui/EmptyState.tsx` | Centered icon + title + description + optional action. |

---

## Layout Components

### Navbar

**File**: `app/components/layout/Navbar.tsx` (`'use client'`)  
**Used in**: `(public)/layout.tsx`, `(customer)/layout.tsx`

**Props**:
```typescript
interface NavbarProps {
  user: { id: string; first_name: string; last_name: string; role: 'CUSTOMER' | 'STORE_OWNER' | 'ADMIN' } | null
  cartCount: number
}
```

**Features**:
- Sticky `top-0 z-50` with white background and bottom border
- Logo: "Stoca" with "S" in `text-primary-600`, links to `/`
- Search bar (hidden on mobile): rounded-full input, navigates to `/search?q=...`
- Cart icon: ShoppingCart with count badge (caps at "99+"), links to `/cart`
- Authenticated: avatar circle with initials, dropdown with "Dashboard" (store owners only), "My Orders", "Sign Out"
- Unauthenticated: "Login" link + "Register" primary button
- Mobile: hamburger menu (Menu/X toggle) with slide-down panel

### Footer

**File**: `app/components/layout/Footer.tsx` (Server Component)

Minimal footer with copyright and links (About, Contact, Terms). `border-t` separator. Responsive: stacked on mobile, row on `sm:`.
