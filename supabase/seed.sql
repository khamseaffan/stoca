-- ============================================
-- Stoca Seed Data
-- Run after migrations: supabase db reset
-- ============================================

-- ============================================
-- 1. AUTH USERS (Supabase local dev format)
-- Password for all: "password123"
-- ============================================

-- Store Owner: Sarah Chen
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'sarah@demo.com',
  '$2a$10$PznXRySFO4UbfT4GWITCP.XJGml7pHEgJHMDQId3mIlhgyWHyUhWS',
  NOW(),
  '{"first_name":"Sarah","last_name":"Chen","role":"STORE_OWNER"}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'sarah@demo.com',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"sarah@demo.com"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
);

-- Store Owner: Marcus Johnson
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'marcus@demo.com',
  '$2a$10$PznXRySFO4UbfT4GWITCP.XJGml7pHEgJHMDQId3mIlhgyWHyUhWS',
  NOW(),
  '{"first_name":"Marcus","last_name":"Johnson","role":"STORE_OWNER"}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'marcus@demo.com',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"marcus@demo.com"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
);

-- Customer: Emily Wilson
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'emily@demo.com',
  '$2a$10$PznXRySFO4UbfT4GWITCP.XJGml7pHEgJHMDQId3mIlhgyWHyUhWS',
  NOW(),
  '{"first_name":"Emily","last_name":"Wilson","role":"CUSTOMER"}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  'emily@demo.com',
  '{"sub":"33333333-3333-3333-3333-333333333333","email":"emily@demo.com"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
);

-- Customer: David Park
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'david@demo.com',
  '$2a$10$PznXRySFO4UbfT4GWITCP.XJGml7pHEgJHMDQId3mIlhgyWHyUhWS',
  NOW(),
  '{"first_name":"David","last_name":"Park","role":"CUSTOMER"}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '44444444-4444-4444-4444-444444444444',
  'david@demo.com',
  '{"sub":"44444444-4444-4444-4444-444444444444","email":"david@demo.com"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
);

-- Customer: Lisa Martinez
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'lisa@demo.com',
  '$2a$10$PznXRySFO4UbfT4GWITCP.XJGml7pHEgJHMDQId3mIlhgyWHyUhWS',
  NOW(),
  '{"first_name":"Lisa","last_name":"Martinez","role":"CUSTOMER"}'::jsonb,
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '55555555-5555-5555-5555-555555555555',
  'lisa@demo.com',
  '{"sub":"55555555-5555-5555-5555-555555555555","email":"lisa@demo.com"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
);

-- ============================================
-- 2. STORES
-- ============================================

INSERT INTO stores (id, owner_id, name, slug, description, street_address, city, state, zipcode, country, phone, email, latitude, longitude, store_type, is_active, pickup_enabled, delivery_enabled, delivery_radius_km, delivery_fee, minimum_order, operating_hours)
VALUES (
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Fresh Market',
  'fresh-market',
  'Your neighborhood grocery store with the freshest produce, quality dairy, and everyday essentials. Family-owned since 2019.',
  '123 Main St',
  'Brooklyn',
  'NY',
  '11201',
  'US',
  '(718) 555-0123',
  'hello@freshmarket.com',
  40.6892494,
  -73.9857814,
  'GROCERY',
  TRUE,
  TRUE,
  TRUE,
  3.00,
  4.99,
  15.00,
  '{
    "monday":    {"open": "08:00", "close": "21:00"},
    "tuesday":   {"open": "08:00", "close": "21:00"},
    "wednesday": {"open": "08:00", "close": "21:00"},
    "thursday":  {"open": "08:00", "close": "21:00"},
    "friday":    {"open": "08:00", "close": "21:00"},
    "saturday":  {"open": "08:00", "close": "21:00"},
    "sunday":    {"open": "10:00", "close": "18:00"}
  }'::jsonb
);

INSERT INTO stores (id, owner_id, name, slug, description, street_address, city, state, zipcode, country, phone, email, latitude, longitude, store_type, is_active, pickup_enabled, delivery_enabled, operating_hours)
VALUES (
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  'Golden Crust Bakery',
  'golden-crust',
  'Artisan bakery crafting fresh bread, pastries, and specialty cakes daily. Everything baked from scratch with love.',
  '456 Oak Ave',
  'Brooklyn',
  'NY',
  '11215',
  'US',
  '(718) 555-0456',
  'orders@goldencrust.com',
  40.6681299,
  -73.9822405,
  'BAKERY',
  TRUE,
  TRUE,
  FALSE,
  '{
    "monday":    {"open": "closed", "close": "closed"},
    "tuesday":   {"open": "07:00", "close": "17:00"},
    "wednesday": {"open": "07:00", "close": "17:00"},
    "thursday":  {"open": "07:00", "close": "17:00"},
    "friday":    {"open": "07:00", "close": "17:00"},
    "saturday":  {"open": "07:00", "close": "17:00"},
    "sunday":    {"open": "07:00", "close": "17:00"}
  }'::jsonb
);

-- ============================================
-- 3. GLOBAL PRODUCTS (40+ items)
-- ============================================

-- DAIRY
INSERT INTO global_products (id, name, description, category, subcategory, brand, barcode) VALUES
  ('gp-00000000-0000-0000-0001-000000000001', 'Whole Milk', 'Fresh whole milk, vitamin D fortified. Great for drinking, cooking, and baking.', 'Dairy', 'Milk', 'Horizon Organic', '0049000000017'),
  ('gp-00000000-0000-0000-0001-000000000002', '2% Reduced Fat Milk', 'Reduced fat milk with all the calcium and protein. A lighter option for everyday use.', 'Dairy', 'Milk', 'Organic Valley', '0049000000024'),
  ('gp-00000000-0000-0000-0001-000000000003', 'Organic Large Eggs', 'Cage-free organic large brown eggs, dozen. From pasture-raised hens.', 'Dairy', 'Eggs', 'Vital Farms', '0049000000031'),
  ('gp-00000000-0000-0000-0001-000000000004', 'Greek Yogurt Plain', 'Thick, creamy plain Greek yogurt. High in protein with live active cultures.', 'Dairy', 'Yogurt', 'Chobani', '0049000000048'),
  ('gp-00000000-0000-0000-0001-000000000005', 'Sharp Cheddar Cheese', 'Aged sharp cheddar cheese block. Rich, full flavor perfect for snacking or cooking.', 'Dairy', 'Cheese', 'Tillamook', '0049000000055'),
  ('gp-00000000-0000-0000-0001-000000000006', 'Unsalted Butter', 'Premium unsalted butter, perfect for baking and cooking. Made from sweet cream.', 'Dairy', 'Butter', 'Kerrygold', '0049000000062'),
  ('gp-00000000-0000-0000-0001-000000000007', 'Cream Cheese', 'Original cream cheese spread. Smooth, creamy, and versatile for bagels and recipes.', 'Dairy', 'Cheese', 'Philadelphia', '0049000000079'),
  ('gp-00000000-0000-0000-0001-000000000008', 'Fresh Mozzarella', 'Soft, fresh mozzarella ball packed in water. Perfect for caprese salads and pizza.', 'Dairy', 'Cheese', 'BelGioioso', '0049000000086');

-- PRODUCE
INSERT INTO global_products (id, name, description, category, subcategory, brand) VALUES
  ('gp-00000000-0000-0000-0002-000000000001', 'Bananas', 'Ripe yellow bananas, sold by the bunch. Naturally sweet and packed with potassium.', 'Produce', 'Fruit', 'Dole'),
  ('gp-00000000-0000-0000-0002-000000000002', 'Hass Avocados', 'Creamy Hass avocados, perfect for guacamole, toast, or salads.', 'Produce', 'Fruit', NULL),
  ('gp-00000000-0000-0000-0002-000000000003', 'Organic Baby Spinach', 'Pre-washed organic baby spinach, ready to eat. 5oz container.', 'Produce', 'Vegetables', 'Earthbound Farm'),
  ('gp-00000000-0000-0000-0002-000000000004', 'Roma Tomatoes', 'Firm, meaty Roma tomatoes ideal for sauces, slicing, and salads.', 'Produce', 'Vegetables', NULL),
  ('gp-00000000-0000-0000-0002-000000000005', 'Red Bell Peppers', 'Sweet, crunchy red bell peppers. Great raw or roasted.', 'Produce', 'Vegetables', NULL),
  ('gp-00000000-0000-0000-0002-000000000006', 'Lemons', 'Fresh, juicy lemons. Essential for cooking, baking, and beverages.', 'Produce', 'Fruit', NULL),
  ('gp-00000000-0000-0000-0002-000000000007', 'Blueberries', 'Plump, sweet blueberries. Packed with antioxidants. 6oz container.', 'Produce', 'Fruit', 'Driscoll''s'),
  ('gp-00000000-0000-0000-0002-000000000008', 'Sweet Potatoes', 'Nutritious orange-flesh sweet potatoes. Great baked, mashed, or roasted.', 'Produce', 'Vegetables', NULL);

-- BAKERY
INSERT INTO global_products (id, name, description, category, subcategory, brand) VALUES
  ('gp-00000000-0000-0000-0003-000000000001', 'Sourdough Bread', 'Artisan sourdough bread with a crispy crust and tangy flavor. Naturally leavened.', 'Bakery', 'Bread', NULL),
  ('gp-00000000-0000-0000-0003-000000000002', 'Whole Wheat Bread', 'Hearty whole wheat sandwich bread. Made with 100% whole grain flour.', 'Bakery', 'Bread', NULL),
  ('gp-00000000-0000-0000-0003-000000000003', 'Butter Croissants', 'Flaky, buttery French-style croissants. Baked fresh daily.', 'Bakery', 'Pastries', NULL),
  ('gp-00000000-0000-0000-0003-000000000004', 'Chocolate Chip Cookies', 'Classic chocolate chip cookies made with real butter and semi-sweet chocolate.', 'Bakery', 'Cookies', NULL),
  ('gp-00000000-0000-0000-0003-000000000005', 'Blueberry Muffins', 'Moist blueberry muffins with a streusel crumble topping. Made with real blueberries.', 'Bakery', 'Muffins', NULL),
  ('gp-00000000-0000-0000-0003-000000000006', 'Cinnamon Rolls', 'Soft, gooey cinnamon rolls with cream cheese frosting. A breakfast favorite.', 'Bakery', 'Pastries', NULL),
  ('gp-00000000-0000-0000-0003-000000000007', 'French Baguette', 'Traditional French baguette with a golden crust and soft interior.', 'Bakery', 'Bread', NULL),
  ('gp-00000000-0000-0000-0003-000000000008', 'Almond Croissants', 'Butter croissants filled with almond cream and topped with sliced almonds.', 'Bakery', 'Pastries', NULL);

-- BEVERAGES
INSERT INTO global_products (id, name, description, category, subcategory, brand) VALUES
  ('gp-00000000-0000-0000-0004-000000000001', 'Fresh Squeezed Orange Juice', 'Not-from-concentrate orange juice. Cold-pressed for maximum freshness.', 'Beverages', 'Juice', 'Tropicana'),
  ('gp-00000000-0000-0000-0004-000000000002', 'Oat Milk Original', 'Creamy oat milk, barista edition. Froths beautifully for lattes.', 'Beverages', 'Plant Milk', 'Oatly'),
  ('gp-00000000-0000-0000-0004-000000000003', 'Ginger Lemon Kombucha', 'Raw, organic kombucha with ginger and lemon. Naturally effervescent.', 'Beverages', 'Kombucha', 'GT''s'),
  ('gp-00000000-0000-0000-0004-000000000004', 'Sparkling Water Lime', 'Refreshing lime-flavored sparkling water. Zero calories, zero sweeteners.', 'Beverages', 'Water', 'LaCroix'),
  ('gp-00000000-0000-0000-0004-000000000005', 'Cold Brew Coffee', 'Smooth, slow-steeped cold brew coffee concentrate. Bold yet never bitter.', 'Beverages', 'Coffee', 'Stumptown'),
  ('gp-00000000-0000-0000-0004-000000000006', 'Organic Green Tea', 'Premium Japanese sencha green tea bags. Light, refreshing, and rich in antioxidants.', 'Beverages', 'Tea', 'Ito En');

-- SNACKS
INSERT INTO global_products (id, name, description, category, subcategory, brand) VALUES
  ('gp-00000000-0000-0000-0005-000000000001', 'Trail Mix', 'Classic trail mix with almonds, cashews, raisins, and dark chocolate chips.', 'Snacks', 'Nuts & Seeds', 'Planters'),
  ('gp-00000000-0000-0000-0005-000000000002', 'Organic Granola', 'Crunchy maple pecan granola made with organic oats and real maple syrup.', 'Snacks', 'Cereal & Granola', 'Bear Naked'),
  ('gp-00000000-0000-0000-0005-000000000003', 'Dark Chocolate Bar 72%', 'Single-origin dark chocolate bar, 72% cacao. Rich, smooth, and ethically sourced.', 'Snacks', 'Chocolate', 'Hu'),
  ('gp-00000000-0000-0000-0005-000000000004', 'Organic Tortilla Chips', 'Stone-ground yellow corn tortilla chips. Lightly salted and perfectly crispy.', 'Snacks', 'Chips', 'Late July'),
  ('gp-00000000-0000-0000-0005-000000000005', 'Classic Hummus', 'Smooth, creamy hummus made with chickpeas, tahini, and lemon. 10oz container.', 'Snacks', 'Dips', 'Sabra'),
  ('gp-00000000-0000-0000-0005-000000000006', 'Roasted Mixed Nuts', 'Lightly salted roasted mixed nuts: almonds, cashews, pecans, and Brazil nuts.', 'Snacks', 'Nuts & Seeds', 'Planters'),
  ('gp-00000000-0000-0000-0005-000000000007', 'Sea Salt Popcorn', 'Light and fluffy popcorn with a touch of sea salt. Non-GMO whole grain.', 'Snacks', 'Popcorn', 'SkinnyPop');

-- ============================================
-- 4. STORE PRODUCTS
-- ============================================

-- Fresh Market (~18 products, mix of all categories)
INSERT INTO store_products (id, store_id, global_product_id, name, description, price, category, subcategory, quantity, low_stock_threshold, is_available, is_featured) VALUES
  -- Dairy
  ('sp-fm-0000-0000-0000-000000000001', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0001-000000000001', 'Whole Milk', 'Horizon Organic whole milk, vitamin D fortified. Half gallon.', 4.99, 'Dairy', 'Milk', 24, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000002', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0001-000000000002', '2% Reduced Fat Milk', 'Organic Valley 2% milk. Half gallon.', 4.49, 'Dairy', 'Milk', 18, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000003', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0001-000000000003', 'Organic Large Eggs', 'Vital Farms pasture-raised eggs, dozen.', 6.99, 'Dairy', 'Eggs', 30, 5, TRUE, TRUE),
  ('sp-fm-0000-0000-0000-000000000004', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0001-000000000004', 'Greek Yogurt Plain', 'Chobani plain Greek yogurt, 32oz.', 5.49, 'Dairy', 'Yogurt', 15, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000005', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0001-000000000005', 'Sharp Cheddar Cheese', 'Tillamook sharp cheddar block, 8oz.', 5.99, 'Dairy', 'Cheese', 12, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000006', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0001-000000000006', 'Unsalted Butter', 'Kerrygold pure Irish butter, 8oz.', 4.49, 'Dairy', 'Butter', 20, 5, TRUE, FALSE),
  -- Produce
  ('sp-fm-0000-0000-0000-000000000007', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0002-000000000001', 'Bananas', 'Fresh bananas, per bunch (~5-6).', 1.49, 'Produce', 'Fruit', 50, 10, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000008', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0002-000000000002', 'Hass Avocados', 'Ripe Hass avocados, each.', 1.99, 'Produce', 'Fruit', 35, 8, TRUE, TRUE),
  ('sp-fm-0000-0000-0000-000000000009', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0002-000000000003', 'Organic Baby Spinach', 'Earthbound Farm organic baby spinach, 5oz.', 3.99, 'Produce', 'Vegetables', 2, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000010', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0002-000000000007', 'Blueberries', 'Driscoll''s fresh blueberries, 6oz.', 4.99, 'Produce', 'Fruit', 8, 5, TRUE, FALSE),
  -- Bakery
  ('sp-fm-0000-0000-0000-000000000011', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0003-000000000001', 'Sourdough Bread', 'Fresh baked artisan sourdough loaf.', 5.99, 'Bakery', 'Bread', 6, 3, TRUE, TRUE),
  ('sp-fm-0000-0000-0000-000000000012', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0003-000000000002', 'Whole Wheat Bread', '100% whole wheat sandwich bread loaf.', 4.49, 'Bakery', 'Bread', 10, 3, TRUE, FALSE),
  -- Beverages
  ('sp-fm-0000-0000-0000-000000000013', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0004-000000000001', 'Fresh Squeezed Orange Juice', 'Tropicana pure premium OJ, 52oz.', 5.49, 'Beverages', 'Juice', 14, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000014', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0004-000000000002', 'Oat Milk Original', 'Oatly barista edition oat milk, 32oz.', 5.99, 'Beverages', 'Plant Milk', 10, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000015', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0004-000000000005', 'Cold Brew Coffee', 'Stumptown cold brew concentrate, 10.5oz.', 8.99, 'Beverages', 'Coffee', 3, 5, TRUE, FALSE),
  -- Snacks
  ('sp-fm-0000-0000-0000-000000000016', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0005-000000000004', 'Organic Tortilla Chips', 'Late July organic sea salt tortilla chips, 11oz.', 4.29, 'Snacks', 'Chips', 22, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000017', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0005-000000000005', 'Classic Hummus', 'Sabra classic hummus, 10oz.', 4.49, 'Snacks', 'Dips', 16, 5, TRUE, FALSE),
  ('sp-fm-0000-0000-0000-000000000018', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gp-00000000-0000-0000-0005-000000000003', 'Dark Chocolate Bar 72%', 'Hu dark chocolate bar, organic, 2.1oz.', 4.99, 'Snacks', 'Chocolate', 1, 5, TRUE, FALSE);

-- Golden Crust Bakery (~10 products, bakery focus + some beverages)
INSERT INTO store_products (id, store_id, global_product_id, name, description, price, category, subcategory, quantity, low_stock_threshold, is_available, is_featured) VALUES
  -- Bakery items
  ('sp-gc-0000-0000-0000-000000000001', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0003-000000000001', 'Sourdough Bread', 'House-baked sourdough with a 48-hour ferment. Our signature loaf.', 6.99, 'Bakery', 'Bread', 15, 5, TRUE, TRUE),
  ('sp-gc-0000-0000-0000-000000000002', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0003-000000000003', 'Butter Croissants', 'Flaky, golden croissants made with French-style butter. Pack of 2.', 5.49, 'Bakery', 'Pastries', 20, 5, TRUE, TRUE),
  ('sp-gc-0000-0000-0000-000000000003', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0003-000000000004', 'Chocolate Chip Cookies', 'Giant chocolate chip cookies, each. Made with Belgian chocolate.', 3.49, 'Bakery', 'Cookies', 30, 5, TRUE, FALSE),
  ('sp-gc-0000-0000-0000-000000000004', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0003-000000000005', 'Blueberry Muffins', 'Jumbo blueberry muffins with streusel topping, each.', 3.99, 'Bakery', 'Muffins', 12, 5, TRUE, FALSE),
  ('sp-gc-0000-0000-0000-000000000005', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0003-000000000006', 'Cinnamon Rolls', 'Fresh-baked cinnamon rolls with cream cheese glaze, each.', 4.49, 'Bakery', 'Pastries', 8, 3, TRUE, TRUE),
  ('sp-gc-0000-0000-0000-000000000006', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0003-000000000007', 'French Baguette', 'Traditional French baguette, baked fresh every morning.', 3.99, 'Bakery', 'Bread', 18, 5, TRUE, FALSE),
  ('sp-gc-0000-0000-0000-000000000007', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0003-000000000008', 'Almond Croissants', 'Croissants filled with house-made almond cream and topped with sliced almonds.', 5.99, 'Bakery', 'Pastries', 10, 3, TRUE, FALSE),
  ('sp-gc-0000-0000-0000-000000000008', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0003-000000000002', 'Whole Wheat Bread', 'Hearty whole wheat loaf made with local flour.', 5.49, 'Bakery', 'Bread', 2, 5, TRUE, FALSE),
  -- Beverages
  ('sp-gc-0000-0000-0000-000000000009', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0004-000000000005', 'Cold Brew Coffee', 'House-made cold brew, 12oz bottle.', 4.99, 'Beverages', 'Coffee', 25, 5, TRUE, FALSE),
  ('sp-gc-0000-0000-0000-000000000010', 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'gp-00000000-0000-0000-0004-000000000002', 'Oat Milk Original', 'Oatly oat milk for your coffee. 32oz.', 5.99, 'Beverages', 'Plant Milk', 8, 5, TRUE, FALSE);

-- ============================================
-- 5. SAMPLE ORDERS
-- ============================================

-- Order 1: PENDING — Emily at Fresh Market (3 items)
INSERT INTO orders (id, user_id, store_id, status, order_type, subtotal, tax, delivery_fee, total, customer_notes, created_at)
VALUES (
  'ord-00000000-0000-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'PENDING',
  'PICKUP',
  16.47,
  1.48,
  0.00,
  17.95,
  'Please pick ripe avocados!',
  NOW() - INTERVAL '15 minutes'
);

INSERT INTO order_items (id, order_id, store_product_id, product_name, quantity, unit_price, total_price) VALUES
  ('oi-00000000-0000-0000-0001-000000000001', 'ord-00000000-0000-0000-0000-000000000001', 'sp-fm-0000-0000-0000-000000000003', 'Organic Large Eggs', 1, 6.99, 6.99),
  ('oi-00000000-0000-0000-0001-000000000002', 'ord-00000000-0000-0000-0000-000000000001', 'sp-fm-0000-0000-0000-000000000008', 'Hass Avocados', 3, 1.99, 5.97),
  ('oi-00000000-0000-0000-0001-000000000003', 'ord-00000000-0000-0000-0000-000000000001', 'sp-fm-0000-0000-0000-000000000009', 'Organic Baby Spinach', 1, 3.99, 3.99);

-- Order 2: CONFIRMED — David at Fresh Market (2 items)
INSERT INTO orders (id, user_id, store_id, status, order_type, subtotal, tax, delivery_fee, total, created_at)
VALUES (
  'ord-00000000-0000-0000-0000-000000000002',
  '44444444-4444-4444-4444-444444444444',
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'CONFIRMED',
  'DELIVERY',
  10.98,
  0.99,
  4.99,
  16.96,
  NOW() - INTERVAL '45 minutes'
);

INSERT INTO order_items (id, order_id, store_product_id, product_name, quantity, unit_price, total_price) VALUES
  ('oi-00000000-0000-0000-0002-000000000001', 'ord-00000000-0000-0000-0000-000000000002', 'sp-fm-0000-0000-0000-000000000011', 'Sourdough Bread', 1, 5.99, 5.99),
  ('oi-00000000-0000-0000-0002-000000000002', 'ord-00000000-0000-0000-0000-000000000002', 'sp-fm-0000-0000-0000-000000000001', 'Whole Milk', 1, 4.99, 4.99);

-- Order 3: PREPARING — Lisa at Golden Crust (4 items)
INSERT INTO orders (id, user_id, store_id, status, order_type, subtotal, tax, delivery_fee, total, created_at)
VALUES (
  'ord-00000000-0000-0000-0000-000000000003',
  '55555555-5555-5555-5555-555555555555',
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'PREPARING',
  'PICKUP',
  19.96,
  1.80,
  0.00,
  21.76,
  NOW() - INTERVAL '1 hour'
);

INSERT INTO order_items (id, order_id, store_product_id, product_name, quantity, unit_price, total_price) VALUES
  ('oi-00000000-0000-0000-0003-000000000001', 'ord-00000000-0000-0000-0000-000000000003', 'sp-gc-0000-0000-0000-000000000002', 'Butter Croissants', 2, 5.49, 10.98),
  ('oi-00000000-0000-0000-0003-000000000002', 'ord-00000000-0000-0000-0000-000000000003', 'sp-gc-0000-0000-0000-000000000005', 'Cinnamon Rolls', 1, 4.49, 4.49),
  ('oi-00000000-0000-0000-0003-000000000003', 'ord-00000000-0000-0000-0000-000000000003', 'sp-gc-0000-0000-0000-000000000009', 'Cold Brew Coffee', 1, 4.99, 4.99),
  ('oi-00000000-0000-0000-0003-000000000004', 'ord-00000000-0000-0000-0000-000000000003', 'sp-gc-0000-0000-0000-000000000003', 'Chocolate Chip Cookies', 2, 3.49, 6.98);

-- Order 4: COMPLETED — Emily at Golden Crust (2 items)
INSERT INTO orders (id, user_id, store_id, status, order_type, subtotal, tax, delivery_fee, total, created_at)
VALUES (
  'ord-00000000-0000-0000-0000-000000000004',
  '33333333-3333-3333-3333-333333333333',
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'COMPLETED',
  'PICKUP',
  12.48,
  1.12,
  0.00,
  13.60,
  NOW() - INTERVAL '3 hours'
);

INSERT INTO order_items (id, order_id, store_product_id, product_name, quantity, unit_price, total_price) VALUES
  ('oi-00000000-0000-0000-0004-000000000001', 'ord-00000000-0000-0000-0000-000000000004', 'sp-gc-0000-0000-0000-000000000001', 'Sourdough Bread', 1, 6.99, 6.99),
  ('oi-00000000-0000-0000-0004-000000000002', 'ord-00000000-0000-0000-0000-000000000004', 'sp-gc-0000-0000-0000-000000000002', 'Butter Croissants', 1, 5.49, 5.49);

-- Order 5: DELIVERED — David at Fresh Market (5 items)
INSERT INTO orders (id, user_id, store_id, status, order_type, subtotal, tax, delivery_fee, total, delivery_address, created_at)
VALUES (
  'ord-00000000-0000-0000-0000-000000000005',
  '44444444-4444-4444-4444-444444444444',
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'DELIVERED',
  'DELIVERY',
  27.44,
  2.47,
  4.99,
  34.90,
  '{"street": "789 Park Slope Ave", "city": "Brooklyn", "state": "NY", "zipcode": "11215"}'::jsonb,
  NOW() - INTERVAL '1 day'
);

INSERT INTO order_items (id, order_id, store_product_id, product_name, quantity, unit_price, total_price) VALUES
  ('oi-00000000-0000-0000-0005-000000000001', 'ord-00000000-0000-0000-0000-000000000005', 'sp-fm-0000-0000-0000-000000000001', 'Whole Milk', 1, 4.99, 4.99),
  ('oi-00000000-0000-0000-0005-000000000002', 'ord-00000000-0000-0000-0000-000000000005', 'sp-fm-0000-0000-0000-000000000003', 'Organic Large Eggs', 1, 6.99, 6.99),
  ('oi-00000000-0000-0000-0005-000000000003', 'ord-00000000-0000-0000-0000-000000000005', 'sp-fm-0000-0000-0000-000000000007', 'Bananas', 2, 1.49, 2.98),
  ('oi-00000000-0000-0000-0005-000000000004', 'ord-00000000-0000-0000-0000-000000000005', 'sp-fm-0000-0000-0000-000000000013', 'Fresh Squeezed Orange Juice', 1, 5.49, 5.49),
  ('oi-00000000-0000-0000-0005-000000000005', 'ord-00000000-0000-0000-0000-000000000005', 'sp-fm-0000-0000-0000-000000000015', 'Cold Brew Coffee', 1, 8.99, 8.99);
