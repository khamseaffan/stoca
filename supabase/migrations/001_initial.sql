-- Home Store v2 — Supabase Schema
-- PostgreSQL 15 + pgvector

CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '' CHECK (length(first_name) <= 100),
    last_name TEXT NOT NULL DEFAULT '' CHECK (length(last_name) <= 100),
    role TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER', 'STORE_OWNER', 'ADMIN')),
    phone TEXT CHECK (length(phone) <= 20),
    avatar_url TEXT,
    preferred_language TEXT DEFAULT 'en' CHECK (length(preferred_language) <= 10),
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- Auto-create profile on signup (ADMIN role blocked from client)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        CASE
            WHEN NEW.raw_user_meta_data->>'role' IN ('CUSTOMER', 'STORE_OWNER')
            THEN NEW.raw_user_meta_data->>'role'
            ELSE 'CUSTOMER'
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORES
-- ============================================
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(name) <= 255),
    slug TEXT UNIQUE CHECK (length(slug) <= 100),
    description TEXT CHECK (length(description) <= 5000),
    street_address TEXT CHECK (length(street_address) <= 255),
    city TEXT CHECK (length(city) <= 100),
    state TEXT CHECK (length(state) <= 100),
    zipcode TEXT CHECK (length(zipcode) <= 20),
    country TEXT DEFAULT 'US',
    phone TEXT CHECK (length(phone) <= 20),
    email TEXT CHECK (length(email) <= 255),
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    store_type TEXT NOT NULL CHECK (store_type IN (
        'GROCERY', 'CONVENIENCE', 'BAKERY', 'BUTCHER', 'PHARMACY',
        'HARDWARE', 'SPECIALTY_FOOD', 'ORGANIC', 'DELI', 'FLOWER',
        'PET', 'ELECTRONICS', 'OTHER'
    )),
    logo_url TEXT,
    banner_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_radius_km NUMERIC(5,2),
    delivery_fee NUMERIC(10,2) DEFAULT 0 CHECK (delivery_fee >= 0),
    minimum_order NUMERIC(10,2) DEFAULT 0 CHECK (minimum_order >= 0),
    operating_hours JSONB DEFAULT '{}',
    stripe_account_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_city ON stores(city);
CREATE INDEX idx_stores_type ON stores(store_type);
CREATE INDEX idx_stores_active ON stores(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_stores_location ON stores(latitude, longitude) WHERE latitude IS NOT NULL;

-- ============================================
-- GLOBAL PRODUCTS (Shared Catalog Templates)
-- ============================================
CREATE TABLE public.global_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(name) <= 500),
    description TEXT CHECK (length(description) <= 10000),
    category TEXT NOT NULL CHECK (length(category) <= 100),
    subcategory TEXT CHECK (length(subcategory) <= 100),
    brand TEXT CHECK (length(brand) <= 100),
    barcode TEXT CHECK (length(barcode) <= 50),
    image_urls TEXT[] DEFAULT '{}',
    attributes JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gp_category ON global_products(category);
CREATE INDEX idx_gp_brand ON global_products(brand);
CREATE INDEX idx_gp_barcode ON global_products(barcode);
CREATE INDEX idx_gp_search ON global_products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(brand, '')));
CREATE INDEX idx_gp_embedding ON global_products USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- STORE PRODUCTS (Store-specific listings)
-- ============================================
CREATE TABLE public.store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    global_product_id UUID REFERENCES global_products(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (length(name) <= 500),
    description TEXT CHECK (length(description) <= 10000),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(10,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
    category TEXT CHECK (length(category) <= 100),
    subcategory TEXT CHECK (length(subcategory) <= 100),
    image_urls TEXT[] DEFAULT '{}',
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_stock_threshold INTEGER DEFAULT 5,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    attributes JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sp_store ON store_products(store_id);
CREATE INDEX idx_sp_global ON store_products(global_product_id);
CREATE INDEX idx_sp_category ON store_products(store_id, category);
CREATE INDEX idx_sp_available ON store_products(store_id, is_available) WHERE is_available = TRUE;
CREATE INDEX idx_sp_featured ON store_products(store_id, is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_sp_search ON store_products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_sp_embedding ON store_products USING hnsw (embedding vector_cosine_ops);
CREATE UNIQUE INDEX idx_sp_store_global ON store_products(store_id, global_product_id) WHERE global_product_id IS NOT NULL;

-- ============================================
-- CART ITEMS
-- ============================================
CREATE TABLE public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    store_product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    captured_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, store_id, store_product_id)
);

CREATE INDEX idx_cart_user_store ON cart_items(user_id, store_id);

-- Trigger: captured_price always set from product's actual price (prevents client manipulation)
CREATE OR REPLACE FUNCTION set_cart_captured_price()
RETURNS TRIGGER AS $$
BEGIN
    SELECT price INTO NEW.captured_price
    FROM store_products WHERE id = NEW.store_product_id;
    IF NEW.captured_price IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cart_price
    BEFORE INSERT OR UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION set_cart_captured_price();

-- ============================================
-- ORDERS (created ONLY via create_order_from_cart RPC)
-- ============================================
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
        'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'
    )),
    order_type TEXT NOT NULL CHECK (order_type IN ('PICKUP', 'DELIVERY')),
    subtotal NUMERIC(10,2) NOT NULL,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,
    delivery_address JSONB,
    customer_notes TEXT CHECK (length(customer_notes) <= 2000),
    store_notes TEXT CHECK (length(store_notes) <= 2000),
    payment_intent_id TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_store ON orders(store_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(store_id, status);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    store_product_id UUID REFERENCES store_products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL CHECK (length(product_name) <= 500),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oi_order ON order_items(order_id);

-- ============================================
-- PAYMENTS (mutated ONLY server-side via Stripe webhook)
-- ============================================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    stripe_payment_intent_id TEXT UNIQUE,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED'
    )),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id);

-- ============================================
-- PROMOTIONS
-- ============================================
CREATE TABLE public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    store_product_id UUID REFERENCES store_products(id) ON DELETE CASCADE,
    title TEXT CHECK (length(title) <= 255),
    discount_percent NUMERIC(5,2) CHECK (discount_percent > 0 AND discount_percent <= 100),
    discount_amount NUMERIC(10,2) CHECK (discount_amount > 0),
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (discount_percent IS NOT NULL OR discount_amount IS NOT NULL)
);

CREATE INDEX idx_promo_store ON promotions(store_id, is_active) WHERE is_active = TRUE;

-- ============================================
-- AI CONVERSATION LOG
-- ============================================
CREATE TABLE public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    session_id UUID NOT NULL DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content JSONB NOT NULL,
    tool_calls JSONB,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conv_store ON ai_conversations(store_id, created_at DESC);
CREATE INDEX idx_ai_conv_session ON ai_conversations(session_id, created_at);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_gp_updated BEFORE UPDATE ON global_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sp_updated BEFORE UPDATE ON store_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cart_updated BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_promo_updated BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles: own profile always visible, store owners visible for store pages
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile and store owners readable" ON profiles FOR SELECT
    USING (id = auth.uid() OR role = 'STORE_OWNER');
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Stores: anyone reads active, owners CRUD their own
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active stores readable" ON stores FOR SELECT
    USING (is_active = TRUE OR owner_id = auth.uid());
CREATE POLICY "Owners create stores" ON stores FOR INSERT
    WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update own stores" ON stores FOR UPDATE
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete own stores" ON stores FOR DELETE
    USING (owner_id = auth.uid());

-- Global products: anyone reads (admin mutations via service role only)
ALTER TABLE global_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global products readable" ON global_products FOR SELECT USING (true);

-- Store products: anyone reads available, store owners manage their own
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Available products readable" ON store_products FOR SELECT
    USING (is_available = TRUE OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Owners insert products" ON store_products FOR INSERT
    WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Owners update products" ON store_products FOR UPDATE
    USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Owners delete products" ON store_products FOR DELETE
    USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Cart: users see/modify only their own
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own cart" ON cart_items FOR ALL USING (user_id = auth.uid());

-- Orders: NO direct INSERT policy. Orders created ONLY via create_order_from_cart() RPC.
-- Customers read their orders. Store owners read+update their store's orders.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers see own orders" ON orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Store owners see store orders" ON orders FOR SELECT
    USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Store owners update orders" ON orders FOR UPDATE
    USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Order items: visible with parent order
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible with order" ON order_items FOR SELECT
    USING (order_id IN (
        SELECT id FROM orders WHERE user_id = auth.uid()
        UNION
        SELECT id FROM orders WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    ));

-- Payments: SELECT only (mutations via service role webhook handler)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible with order" ON payments FOR SELECT
    USING (order_id IN (
        SELECT id FROM orders WHERE user_id = auth.uid()
        UNION
        SELECT id FROM orders WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    ));

-- Promotions: anyone reads active, owners manage their own (split policies for clarity)
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active promotions readable" ON promotions FOR SELECT
    USING (is_active = TRUE OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Owners insert promotions" ON promotions FOR INSERT
    WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Owners update promotions" ON promotions FOR UPDATE
    USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));
CREATE POLICY "Owners delete promotions" ON promotions FOR DELETE
    USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- AI conversations: store owners only
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners see conversations" ON ai_conversations FOR ALL
    USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- ============================================
-- ATOMIC ORDER CREATION (uses auth.uid(), no user_id param)
-- ============================================
CREATE OR REPLACE FUNCTION create_order_from_cart(
    p_store_id UUID,
    p_order_type TEXT,
    p_delivery_address JSONB DEFAULT NULL,
    p_customer_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_order_id UUID;
    v_subtotal NUMERIC(10,2);
    v_delivery_fee NUMERIC(10,2) := 0;
    v_total NUMERIC(10,2);
    v_item RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT COALESCE(SUM(captured_price * quantity), 0) INTO v_subtotal
    FROM cart_items WHERE user_id = v_user_id AND store_id = p_store_id;

    IF v_subtotal = 0 THEN
        RAISE EXCEPTION 'Cart is empty for this store';
    END IF;

    IF p_order_type = 'DELIVERY' THEN
        SELECT COALESCE(delivery_fee, 0) INTO v_delivery_fee FROM stores WHERE id = p_store_id;
    END IF;

    v_total := v_subtotal + v_delivery_fee;

    INSERT INTO orders (user_id, store_id, status, order_type, subtotal, tax, delivery_fee, total, delivery_address, customer_notes)
    VALUES (v_user_id, p_store_id, 'PENDING', p_order_type, v_subtotal, 0, v_delivery_fee, v_total, p_delivery_address, p_customer_notes)
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT ci.*, sp.name AS product_name
        FROM cart_items ci JOIN store_products sp ON ci.store_product_id = sp.id
        WHERE ci.user_id = v_user_id AND ci.store_id = p_store_id
    LOOP
        INSERT INTO order_items (order_id, store_product_id, product_name, quantity, unit_price, total_price)
        VALUES (v_order_id, v_item.store_product_id, v_item.product_name, v_item.quantity, v_item.captured_price, v_item.captured_price * v_item.quantity);

        UPDATE store_products SET quantity = GREATEST(quantity - v_item.quantity, 0) WHERE id = v_item.store_product_id;
    END LOOP;

    DELETE FROM cart_items WHERE user_id = v_user_id AND store_id = p_store_id;

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
