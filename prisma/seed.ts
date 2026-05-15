import { PrismaClient } from '../app/lib/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const adapter = new PrismaPg(connectionString)
const prisma = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function randomDate(daysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - Math.random() * daysAgo)
  d.setHours(randomBetween(7, 22), randomBetween(0, 59), 0, 0)
  return d
}

function weightedRandomDate(daysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo))
  // Weight toward lunch (11-14) and dinner (17-20) hours
  const hourWeights = [
    0, 0, 0, 0, 0, 0, 0,  // 0-6: no orders
    1, 2, 3, 5, 8, 10, 8, // 7-13: morning ramp to lunch peak
    5, 4, 5, 8, 10, 9, 6, // 14-20: afternoon to dinner peak
    3, 1, 0,               // 21-23: wind down
  ]
  const totalWeight = hourWeights.reduce((a, b) => a + b, 0)
  let r = Math.random() * totalWeight
  let hour = 0
  for (let i = 0; i < hourWeights.length; i++) {
    r -= hourWeights[i]
    if (r <= 0) { hour = i; break }
  }
  d.setHours(hour, randomBetween(0, 59), randomBetween(0, 59), 0)
  return d
}

// ---------------------------------------------------------------------------
// Brooklyn store data
// ---------------------------------------------------------------------------

const STORES = [
  {
    name: 'Park Slope Fresh Market',
    slug: 'park-slope-fresh-market',
    store_type: 'GROCERY',
    description: 'Your neighborhood grocery in the heart of Park Slope. Fresh produce, organic options, and everyday essentials since 2018.',
    street_address: '267 7th Avenue',
    city: 'Brooklyn',
    state: 'NY',
    zipcode: '11215',
    phone: '(718) 555-0142',
    latitude: 40.6712,
    longitude: -73.9791,
    pickup_enabled: true,
    delivery_enabled: true,
    delivery_fee: 3.99,
    minimum_order: 15.00,
    delivery_radius_km: 3.0,
    operating_hours: {
      monday: { open: '07:00', close: '22:00' },
      tuesday: { open: '07:00', close: '22:00' },
      wednesday: { open: '07:00', close: '22:00' },
      thursday: { open: '07:00', close: '22:00' },
      friday: { open: '07:00', close: '23:00' },
      saturday: { open: '08:00', close: '23:00' },
      sunday: { open: '08:00', close: '21:00' },
    },
    products: [
      { name: 'Organic Fuji Apples', price: 4.99, category: 'Produce', quantity: 85, description: 'Crisp, sweet organic Fuji apples from upstate New York orchards.' },
      { name: 'Baby Spinach', price: 3.49, category: 'Produce', quantity: 42, description: 'Pre-washed organic baby spinach, 5oz clamshell.' },
      { name: 'Avocados (3-pack)', price: 5.99, category: 'Produce', quantity: 30, compare_at: 7.49 },
      { name: 'Heirloom Tomatoes', price: 6.49, category: 'Produce', quantity: 18, description: 'Mixed variety heirloom tomatoes, locally grown.' },
      { name: 'Fresh Basil Bunch', price: 2.99, category: 'Produce', quantity: 12 },
      { name: 'Organic Whole Milk', price: 5.99, category: 'Dairy', quantity: 55, description: 'Hudson Valley Fresh organic whole milk, half gallon.' },
      { name: 'Greek Yogurt (Plain)', price: 6.49, category: 'Dairy', quantity: 38 },
      { name: 'Free Range Eggs (Dozen)', price: 7.99, category: 'Dairy', quantity: 60, description: 'Pasture-raised eggs from local farms.' },
      { name: 'Vermont Cheddar Block', price: 8.99, category: 'Dairy', quantity: 22, description: 'Aged 12-month sharp cheddar from Vermont.' },
      { name: 'Sourdough Bread Loaf', price: 6.49, category: 'Bakery', quantity: 15, description: 'Baked fresh daily. Crispy crust, tangy crumb.', featured: true },
      { name: 'Everything Bagels (6-pack)', price: 5.49, category: 'Bakery', quantity: 20 },
      { name: 'Multigrain Bread', price: 5.99, category: 'Bakery', quantity: 14 },
      { name: 'Atlantic Salmon Fillet', price: 14.99, category: 'Seafood', quantity: 8, description: 'Wild-caught Atlantic salmon, per pound.', featured: true },
      { name: 'Jumbo Shrimp (1lb)', price: 12.99, category: 'Seafood', quantity: 10 },
      { name: 'Grass-Fed Ground Beef', price: 9.99, category: 'Meat', quantity: 25, description: '85/15 grass-fed ground beef, 1lb package.' },
      { name: 'Organic Chicken Breast', price: 11.99, category: 'Meat', quantity: 30 },
      { name: 'Italian Sausage Links', price: 7.99, category: 'Meat', quantity: 18 },
      { name: 'Cold Brew Coffee (32oz)', price: 8.99, category: 'Beverages', quantity: 35, compare_at: 10.99 },
      { name: 'Kombucha Variety Pack', price: 11.99, category: 'Beverages', quantity: 20 },
      { name: 'Sparkling Water (12-pack)', price: 6.99, category: 'Beverages', quantity: 50 },
      { name: 'Organic Peanut Butter', price: 7.49, category: 'Pantry', quantity: 40 },
      { name: 'Extra Virgin Olive Oil', price: 12.99, category: 'Pantry', quantity: 28 },
      { name: 'Organic Quinoa (1lb)', price: 5.99, category: 'Pantry', quantity: 35 },
      { name: 'Local Wildflower Honey', price: 9.99, category: 'Pantry', quantity: 3, description: 'Raw honey from Brooklyn rooftop apiaries.' },
    ],
  },
  {
    name: 'Cobble Hill Bakehouse',
    slug: 'cobble-hill-bakehouse',
    store_type: 'BAKERY',
    description: 'Artisan breads and pastries baked fresh every morning in our Cobble Hill kitchen. Sourdough specialists since 2015.',
    street_address: '182 Court Street',
    city: 'Brooklyn',
    state: 'NY',
    zipcode: '11201',
    phone: '(718) 555-0287',
    latitude: 40.6861,
    longitude: -73.9937,
    pickup_enabled: true,
    delivery_enabled: true,
    delivery_fee: 2.99,
    minimum_order: 10.00,
    delivery_radius_km: 2.0,
    operating_hours: {
      monday: { open: '06:00', close: '19:00' },
      tuesday: { open: '06:00', close: '19:00' },
      wednesday: { open: '06:00', close: '19:00' },
      thursday: { open: '06:00', close: '19:00' },
      friday: { open: '06:00', close: '20:00' },
      saturday: { open: '07:00', close: '20:00' },
      sunday: { open: '07:00', close: '17:00' },
    },
    products: [
      { name: 'Classic Sourdough Loaf', price: 7.50, category: 'Bread', quantity: 20, description: 'Our signature 24-hour fermented sourdough with crispy crust.', featured: true },
      { name: 'Country White Bread', price: 5.50, category: 'Bread', quantity: 18 },
      { name: 'Olive Rosemary Focaccia', price: 8.99, category: 'Bread', quantity: 10, description: 'Loaded with Castelvetrano olives and fresh rosemary.' },
      { name: 'Rye Bread Loaf', price: 6.50, category: 'Bread', quantity: 12 },
      { name: 'Seeded Multigrain', price: 7.00, category: 'Bread', quantity: 14 },
      { name: 'Croissant (Butter)', price: 4.50, category: 'Pastries', quantity: 30, description: 'Flaky, buttery layers. Made with European-style butter.', featured: true },
      { name: 'Pain au Chocolat', price: 4.99, category: 'Pastries', quantity: 25, compare_at: 5.99 },
      { name: 'Almond Croissant', price: 5.50, category: 'Pastries', quantity: 15 },
      { name: 'Pistachio Raspberry Danish', price: 5.99, category: 'Pastries', quantity: 8, description: 'House-made pistachio frangipane with fresh raspberries.' },
      { name: 'Morning Bun', price: 4.75, category: 'Pastries', quantity: 12 },
      { name: 'Chocolate Chip Cookie', price: 3.50, category: 'Cookies & Bars', quantity: 40 },
      { name: 'Oatmeal Raisin Cookie', price: 3.50, category: 'Cookies & Bars', quantity: 30 },
      { name: 'Brownie', price: 4.50, category: 'Cookies & Bars', quantity: 20, description: 'Dense, fudgy brownie with sea salt flakes.' },
      { name: 'Lemon Bar', price: 4.25, category: 'Cookies & Bars', quantity: 15 },
      { name: 'Birthday Cake (6")', price: 42.00, category: 'Cakes', quantity: 3, description: 'Vanilla bean cake with buttercream. Serves 6-8. Order 24hr ahead.' },
      { name: 'Chocolate Layer Cake (6")', price: 45.00, category: 'Cakes', quantity: 2 },
      { name: 'Cinnamon Roll', price: 5.25, category: 'Pastries', quantity: 18, compare_at: 6.50 },
      { name: 'Blueberry Muffin', price: 3.99, category: 'Pastries', quantity: 22 },
      { name: 'Baguette', price: 3.99, category: 'Bread', quantity: 25 },
    ],
  },
  {
    name: 'Greenpoint Coffee Roasters',
    slug: 'greenpoint-coffee-roasters',
    store_type: 'SPECIALTY_FOOD',
    description: 'Single-origin coffees roasted in small batches right here in Greenpoint. Retail beans, cold brew, and brewing equipment.',
    street_address: '98 Franklin Street',
    city: 'Brooklyn',
    state: 'NY',
    zipcode: '11222',
    phone: '(718) 555-0391',
    latitude: 40.7294,
    longitude: -73.9577,
    pickup_enabled: true,
    delivery_enabled: false,
    delivery_fee: 0,
    minimum_order: 0,
    delivery_radius_km: null,
    operating_hours: {
      monday: { open: '06:30', close: '18:00' },
      tuesday: { open: '06:30', close: '18:00' },
      wednesday: { open: '06:30', close: '18:00' },
      thursday: { open: '06:30', close: '18:00' },
      friday: { open: '06:30', close: '19:00' },
      saturday: { open: '07:00', close: '19:00' },
      sunday: { open: '07:00', close: '17:00' },
    },
    products: [
      { name: 'Ethiopia Yirgacheffe (12oz)', price: 18.99, category: 'Whole Bean', quantity: 45, description: 'Bright, floral notes with hints of blueberry and jasmine.', featured: true },
      { name: 'Colombia Huila (12oz)', price: 16.99, category: 'Whole Bean', quantity: 50, description: 'Balanced body with caramel sweetness and citrus finish.' },
      { name: 'Guatemala Antigua (12oz)', price: 17.49, category: 'Whole Bean', quantity: 35 },
      { name: 'House Blend (12oz)', price: 14.99, category: 'Whole Bean', quantity: 60, description: 'Our everyday blend. Chocolate, nuts, and a smooth finish.' },
      { name: 'Decaf Colombia (12oz)', price: 17.99, category: 'Whole Bean', quantity: 20 },
      { name: 'Espresso Blend (12oz)', price: 16.49, category: 'Whole Bean', quantity: 40, featured: true },
      { name: 'Cold Brew Concentrate (32oz)', price: 12.99, category: 'Ready to Drink', quantity: 25, compare_at: 15.99 },
      { name: 'Nitro Cold Brew (12oz can)', price: 4.99, category: 'Ready to Drink', quantity: 60 },
      { name: 'Oat Milk Latte (12oz)', price: 5.50, category: 'Ready to Drink', quantity: 30 },
      { name: 'Chemex 6-Cup Brewer', price: 44.99, category: 'Equipment', quantity: 8 },
      { name: 'Hario V60 Dripper', price: 12.99, category: 'Equipment', quantity: 15 },
      { name: 'Baratza Encore Grinder', price: 149.99, category: 'Equipment', quantity: 4 },
      { name: 'Paper Filters (100ct)', price: 8.99, category: 'Equipment', quantity: 40 },
      { name: 'Coffee Subscription (Monthly)', price: 39.99, category: 'Subscriptions', quantity: 100, description: 'Two 12oz bags of our freshest roasts, delivered monthly.', featured: true },
    ],
  },
  {
    name: 'Atlantic Ave Deli & Provisions',
    slug: 'atlantic-ave-deli',
    store_type: 'DELI',
    description: 'Classic Brooklyn deli serving Boerum Hill since 1998. Boar\'s Head meats, house-made salads, and the best BEC in the neighborhood.',
    street_address: '345 Atlantic Avenue',
    city: 'Brooklyn',
    state: 'NY',
    zipcode: '11217',
    phone: '(718) 555-0463',
    latitude: 40.6862,
    longitude: -73.9826,
    pickup_enabled: true,
    delivery_enabled: true,
    delivery_fee: 1.99,
    minimum_order: 8.00,
    delivery_radius_km: 1.5,
    operating_hours: {
      monday: { open: '06:00', close: '21:00' },
      tuesday: { open: '06:00', close: '21:00' },
      wednesday: { open: '06:00', close: '21:00' },
      thursday: { open: '06:00', close: '21:00' },
      friday: { open: '06:00', close: '22:00' },
      saturday: { open: '07:00', close: '22:00' },
      sunday: { open: '07:00', close: '20:00' },
    },
    products: [
      { name: 'BEC on a Roll', price: 6.99, category: 'Breakfast', quantity: 100, description: 'Bacon, egg & cheese on a fresh Kaiser roll. The Brooklyn classic.', featured: true },
      { name: 'Sausage Egg & Cheese', price: 7.49, category: 'Breakfast', quantity: 100 },
      { name: 'Avocado Toast', price: 8.99, category: 'Breakfast', quantity: 50, compare_at: 10.99 },
      { name: 'Greek Yogurt Parfait', price: 6.49, category: 'Breakfast', quantity: 30 },
      { name: 'Turkey Club Sandwich', price: 12.99, category: 'Sandwiches', quantity: 100, description: 'Boar\'s Head turkey, bacon, lettuce, tomato on toasted white.' },
      { name: 'Italian Hero', price: 13.99, category: 'Sandwiches', quantity: 100, description: 'Salami, capicola, provolone, roasted peppers, vinaigrette.', featured: true },
      { name: 'Grilled Chicken Wrap', price: 11.99, category: 'Sandwiches', quantity: 80 },
      { name: 'Tuna Salad Sandwich', price: 10.99, category: 'Sandwiches', quantity: 60 },
      { name: 'House Potato Salad (1lb)', price: 6.99, category: 'Prepared Foods', quantity: 20 },
      { name: 'Coleslaw (1lb)', price: 5.99, category: 'Prepared Foods', quantity: 25 },
      { name: 'Pasta Salad (1lb)', price: 7.99, category: 'Prepared Foods', quantity: 15 },
      { name: 'Chicken Noodle Soup (Qt)', price: 8.99, category: 'Prepared Foods', quantity: 10, description: 'House-made daily with fresh vegetables.' },
      { name: 'Fountain Soda (Large)', price: 2.49, category: 'Drinks', quantity: 200 },
      { name: 'Fresh Squeezed OJ (16oz)', price: 5.99, category: 'Drinks', quantity: 30 },
      { name: 'Iced Tea (20oz)', price: 2.99, category: 'Drinks', quantity: 100 },
      { name: 'Snapple (20oz)', price: 2.49, category: 'Drinks', quantity: 80 },
    ],
  },
  {
    name: 'Stems Brooklyn',
    slug: 'stems-brooklyn',
    store_type: 'FLOWER',
    description: 'Seasonal floral design studio in Williamsburg. Hand-tied bouquets, arrangements, and wedding florals.',
    street_address: '158 North 4th Street',
    city: 'Brooklyn',
    state: 'NY',
    zipcode: '11211',
    phone: '(718) 555-0572',
    latitude: 40.7168,
    longitude: -73.9614,
    pickup_enabled: true,
    delivery_enabled: true,
    delivery_fee: 5.99,
    minimum_order: 25.00,
    delivery_radius_km: 5.0,
    operating_hours: {
      monday: { open: '09:00', close: '19:00' },
      tuesday: { open: '09:00', close: '19:00' },
      wednesday: { open: '09:00', close: '19:00' },
      thursday: { open: '09:00', close: '19:00' },
      friday: { open: '09:00', close: '20:00' },
      saturday: { open: '09:00', close: '20:00' },
      sunday: { open: '10:00', close: '17:00' },
    },
    products: [
      { name: 'Seasonal Bouquet (Small)', price: 35.00, category: 'Bouquets', quantity: 15, description: 'A petite hand-tied bouquet of the freshest seasonal blooms.', featured: true },
      { name: 'Seasonal Bouquet (Medium)', price: 55.00, category: 'Bouquets', quantity: 12 },
      { name: 'Seasonal Bouquet (Large)', price: 85.00, category: 'Bouquets', quantity: 8, featured: true },
      { name: 'Dried Flower Arrangement', price: 45.00, category: 'Arrangements', quantity: 10, description: 'Long-lasting dried blooms in a ceramic vase.' },
      { name: 'Sunflower Bunch (10 stems)', price: 25.00, category: 'Single Variety', quantity: 20 },
      { name: 'Roses (Dozen)', price: 65.00, category: 'Single Variety', quantity: 15, compare_at: 75.00 },
      { name: 'Tulips (10 stems)', price: 22.00, category: 'Single Variety', quantity: 18 },
      { name: 'Eucalyptus Bundle', price: 12.00, category: 'Greenery', quantity: 25 },
      { name: 'Potted Monstera', price: 38.00, category: 'Plants', quantity: 6, description: 'Healthy Monstera deliciosa in a 6" nursery pot.' },
      { name: 'Snake Plant (Medium)', price: 28.00, category: 'Plants', quantity: 10 },
      { name: 'Succulent Trio', price: 18.00, category: 'Plants', quantity: 14 },
      { name: 'Ceramic Vase (White)', price: 24.00, category: 'Accessories', quantity: 12 },
      { name: 'Greeting Card', price: 5.00, category: 'Accessories', quantity: 50 },
    ],
  },
  {
    name: 'Staubitz Meats',
    slug: 'staubitz-meats',
    store_type: 'BUTCHER',
    description: 'Brooklyn\'s oldest butcher shop, serving the neighborhood since 1917. Prime cuts, house-made sausages, and old-world service.',
    street_address: '222 Court Street',
    city: 'Brooklyn',
    state: 'NY',
    zipcode: '11201',
    phone: '(718) 555-0634',
    latitude: 40.6847,
    longitude: -73.9941,
    pickup_enabled: true,
    delivery_enabled: false,
    delivery_fee: 0,
    minimum_order: 0,
    delivery_radius_km: null,
    operating_hours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '19:00' },
      saturday: { open: '08:00', close: '18:00' },
      sunday: { open: 'closed', close: 'closed' },
    },
    products: [
      { name: 'NY Strip Steak', price: 24.99, category: 'Beef', quantity: 15, description: 'USDA Prime dry-aged 21 days. Per pound.', featured: true },
      { name: 'Ribeye Steak', price: 26.99, category: 'Beef', quantity: 12 },
      { name: 'Filet Mignon', price: 34.99, category: 'Beef', quantity: 8, featured: true },
      { name: 'Ground Chuck (1lb)', price: 8.99, category: 'Beef', quantity: 30 },
      { name: 'Beef Short Ribs', price: 14.99, category: 'Beef', quantity: 10 },
      { name: 'Bone-In Pork Chops (2-pack)', price: 12.99, category: 'Pork', quantity: 18 },
      { name: 'Baby Back Ribs (Rack)', price: 18.99, category: 'Pork', quantity: 8 },
      { name: 'Italian Sausage (1lb)', price: 9.99, category: 'Pork', quantity: 20, description: 'House-made with fennel and garlic. Sweet or hot.' },
      { name: 'Breakfast Sausage Patties', price: 8.49, category: 'Pork', quantity: 15 },
      { name: 'Whole Chicken', price: 14.99, category: 'Poultry', quantity: 12, description: 'Free-range Bell & Evans, 3.5-4 lbs.' },
      { name: 'Chicken Cutlets (1lb)', price: 11.99, category: 'Poultry', quantity: 20 },
      { name: 'Turkey Breast (1lb)', price: 12.99, category: 'Poultry', quantity: 10 },
      { name: 'Lamb Loin Chops', price: 22.99, category: 'Lamb', quantity: 6 },
      { name: 'Marinated Chicken Kebabs', price: 13.99, category: 'Prepared', quantity: 10, compare_at: 16.99, description: 'Ready to grill. Lemon herb marinade.' },
      { name: 'Beef Burgers (4-pack)', price: 15.99, category: 'Prepared', quantity: 14 },
    ],
  },
]

// Brooklyn customer profiles
const CUSTOMERS = [
  { first_name: 'Sarah', last_name: 'Chen', email: 'sarah.chen@example.com' },
  { first_name: 'Marcus', last_name: 'Williams', email: 'marcus.w@example.com' },
  { first_name: 'Elena', last_name: 'Rodriguez', email: 'elena.r@example.com' },
  { first_name: 'James', last_name: 'O\'Brien', email: 'james.ob@example.com' },
  { first_name: 'Priya', last_name: 'Patel', email: 'priya.p@example.com' },
  { first_name: 'David', last_name: 'Kim', email: 'david.kim@example.com' },
  { first_name: 'Aaliyah', last_name: 'Johnson', email: 'aaliyah.j@example.com' },
  { first_name: 'Michael', last_name: 'Rossi', email: 'michael.r@example.com' },
  { first_name: 'Yuki', last_name: 'Tanaka', email: 'yuki.t@example.com' },
  { first_name: 'Olivia', last_name: 'Bennett', email: 'olivia.b@example.com' },
]

// Store owners
const OWNERS = [
  { id: 'a0a0a0a0-0000-0000-0000-000000000001', first_name: 'Demo', last_name: 'Owner', email: 'demo@stoca.local' },
  { id: 'a0a0a0a0-0000-0000-0000-000000000002', first_name: 'Sarah', last_name: 'Martinez', email: 'sarah@demo.com' },
  { id: 'a0a0a0a0-0000-0000-0000-000000000003', first_name: 'Marcus', last_name: 'Johnson', email: 'marcus@demo.com' },
]

// Which owner runs which stores (by index into STORES array)
const STORE_OWNER_MAP: Record<number, number> = {
  0: 0, // Park Slope Fresh Market → demo@stoca.local
  1: 0, // Cobble Hill Bakehouse → demo@stoca.local
  2: 0, // Greenpoint Coffee Roasters → demo@stoca.local
  3: 1, // Atlantic Ave Deli → sarah@demo.com
  4: 1, // Stems Brooklyn → sarah@demo.com
  5: 2, // Staubitz Meats → marcus@demo.com
}

const ORDER_STATUSES = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'DELIVERED', 'DELIVERED', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'CANCELLED']

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding database...\n')

  // Clear existing data in correct order
  console.log('Clearing existing data...')
  await prisma.order_items.deleteMany()
  await prisma.payments.deleteMany()
  await prisma.orders.deleteMany()
  await prisma.cart_items.deleteMany()
  await prisma.ai_conversations.deleteMany()
  await prisma.promotions.deleteMany()
  await prisma.store_products.deleteMany()
  await prisma.global_products.deleteMany()
  await prisma.stores.deleteMany()
  await prisma.profiles.deleteMany()
  // Also clear auth users we previously seeded
  await prisma.$executeRawUnsafe(`DELETE FROM auth.identities WHERE user_id::text LIKE 'a0a0a0a0-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM auth.users WHERE id::text LIKE 'a0a0a0a0-%'`)

  // bcrypt hash for "password123"
  const passwordHash = '$2a$10$CiYEmCLXv0QOdvqLr2r9L.OsbMf4zjrdQEB4uDqJ.W1eIGTRQ8Lfy'
  const instanceId = '00000000-0000-0000-0000-000000000000'

  // Create owner auth users (trigger creates profiles)
  console.log('Creating owner auth users...')
  for (const o of OWNERS) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, reauthentication_token, email_change, phone_change, phone_change_token)
      VALUES ($1::uuid, $2::uuid, $3, $4, NOW(), $5::jsonb, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '', '', '', '', '')
    `, o.id, instanceId, o.email, passwordHash,
      JSON.stringify({ first_name: o.first_name, last_name: o.last_name, role: 'STORE_OWNER' })
    )
    await prisma.$executeRawUnsafe(`
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES ($1::uuid, $1::uuid, $2, $3::jsonb, 'email', NOW(), NOW(), NOW())
    `, o.id, o.email, JSON.stringify({ sub: o.id, email: o.email }))
  }

  // Create customer auth users (trigger creates profiles)
  console.log('Creating customer auth users...')
  const customers: { id: string }[] = []
  for (let i = 0; i < CUSTOMERS.length; i++) {
    const c = CUSTOMERS[i]
    const customerId = `a0a0a0a0-0000-0000-0000-00000000010${i}`
    await prisma.$executeRawUnsafe(`
      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, reauthentication_token, email_change, phone_change, phone_change_token)
      VALUES ($1::uuid, $2::uuid, $3, $4, NOW(), $5::jsonb, 'authenticated', 'authenticated', NOW(), NOW(), '', '', '', '', '', '', '', '')
    `, customerId, instanceId, c.email, passwordHash,
      JSON.stringify({ first_name: c.first_name, last_name: c.last_name, role: 'CUSTOMER' })
    )
    await prisma.$executeRawUnsafe(`
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES ($1::uuid, $1::uuid, $2, $3::jsonb, 'email', NOW(), NOW(), NOW())
    `, customerId, c.email, JSON.stringify({ sub: customerId, email: c.email }))
    customers.push({ id: customerId })
  }

  // Create stores and products
  let totalOrders = 0
  for (let storeIdx = 0; storeIdx < STORES.length; storeIdx++) {
    const storeData = STORES[storeIdx]
    const ownerIdx = STORE_OWNER_MAP[storeIdx] ?? 0
    const storeOwner = OWNERS[ownerIdx]
    console.log(`\nCreating store: ${storeData.name} (owner: ${storeOwner.email})`)

    const store = await prisma.stores.create({
      data: {
        owner_id: storeOwner.id,
        name: storeData.name,
        slug: storeData.slug,
        store_type: storeData.store_type,
        description: storeData.description,
        street_address: storeData.street_address,
        city: storeData.city,
        state: storeData.state,
        zipcode: storeData.zipcode,
        phone: storeData.phone,
        latitude: storeData.latitude,
        longitude: storeData.longitude,
        pickup_enabled: storeData.pickup_enabled,
        delivery_enabled: storeData.delivery_enabled,
        delivery_fee: storeData.delivery_fee,
        minimum_order: storeData.minimum_order,
        delivery_radius_km: storeData.delivery_radius_km,
        operating_hours: storeData.operating_hours,
        is_active: true,
      },
    })

    // Create products
    const products = []
    for (const p of storeData.products) {
      const product = await prisma.store_products.create({
        data: {
          store_id: store.id,
          name: p.name,
          price: p.price,
          category: p.category,
          description: p.description ?? null,
          quantity: p.quantity,
          is_available: true,
          is_featured: (p as { featured?: boolean }).featured ?? false,
          compare_at_price: (p as { compare_at?: number }).compare_at ?? null,
          low_stock_threshold: 5,
        },
      })
      products.push(product)
    }
    console.log(`  ${products.length} products created`)

    // Create promotions
    const promoCount = randomBetween(1, 3)
    for (let i = 0; i < promoCount; i++) {
      const promoProduct = pick(products)
      await prisma.promotions.create({
        data: {
          store_id: store.id,
          store_product_id: promoProduct.id,
          title: pick([
            'Weekend Special',
            'New Customer Deal',
            'Happy Hour',
            'Flash Sale',
            'Bundle & Save',
            'Loyalty Reward',
            'Seasonal Special',
          ]),
          discount_percent: pick([10, 15, 20, 25]),
          is_active: Math.random() > 0.3,
        },
      })
    }

    // Create orders (30-50 per store, spread over 30 days)
    const orderCount = randomBetween(30, 50)
    console.log(`  Creating ${orderCount} orders...`)

    for (let i = 0; i < orderCount; i++) {
      const customer = pick(customers)
      const orderDate = weightedRandomDate(30)
      const status = pick(ORDER_STATUSES)

      // Pick 1-5 random products for this order
      const itemCount = randomBetween(1, 5)
      const orderProducts = pickN(products, Math.min(itemCount, products.length))

      const orderItems = orderProducts.map((p) => {
        const qty = randomBetween(1, 3)
        return {
          store_product_id: p.id,
          product_name: p.name,
          quantity: qty,
          unit_price: Number(p.price),
          total_price: Number(p.price) * qty,
        }
      })

      const subtotal = orderItems.reduce((s, item) => s + item.total_price, 0)
      const tax = parseFloat((subtotal * 0.08875).toFixed(2)) // NYC sales tax
      const isDelivery = storeData.delivery_enabled && Math.random() > 0.5
      const deliveryFee = isDelivery ? storeData.delivery_fee : 0
      const total = parseFloat((subtotal + tax + deliveryFee).toFixed(2))

      const updatedAt = new Date(orderDate)
      if (status === 'COMPLETED' || status === 'DELIVERED') {
        updatedAt.setMinutes(updatedAt.getMinutes() + randomBetween(15, 90))
      } else if (status === 'CANCELLED') {
        updatedAt.setMinutes(updatedAt.getMinutes() + randomBetween(5, 30))
      }

      await prisma.orders.create({
        data: {
          user_id: customer.id,
          store_id: store.id,
          status,
          order_type: isDelivery ? 'DELIVERY' : 'PICKUP',
          subtotal,
          tax,
          delivery_fee: deliveryFee,
          total,
          created_at: orderDate,
          updated_at: updatedAt,
          customer_notes: Math.random() > 0.8
            ? pick([
                'Please ring the bell',
                'Leave at the door',
                'Extra napkins please',
                'No onions on the sandwich',
                'Call when ready',
                'Buzzer is #4A',
              ])
            : null,
          order_items: {
            create: orderItems.map((item) => ({
              store_product_id: item.store_product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            })),
          },
        },
      })
      totalOrders++
    }
  }

  console.log(`\n--- Seed complete ---`)
  console.log(`Owner: ${OWNER.email}`)
  console.log(`Customers: ${CUSTOMERS.length}`)
  console.log(`Stores: ${STORES.length}`)
  console.log(`Total orders: ${totalOrders}`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
