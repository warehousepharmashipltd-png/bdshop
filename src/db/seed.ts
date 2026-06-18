import { db } from './index.ts';
import { categories, brands, products, variants, coupons } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function seedDatabase() {
  try {
    // Check if products already exist
    const existingProducts = await db.select().from(products).limit(1);
    if (existingProducts.length > 0) {
      console.log('Database already seeded. Skipping seed process.');
      return;
    }

    console.log('Seeding database with default e-commerce data...');

    // 1. Seed Categories
    const electronics = await db.insert(categories).values({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Gadgets, smartphones, laptops and accessories.'
    }).returning();

    const apparel = await db.insert(categories).values({
      name: 'Apparel',
      slug: 'apparel',
      description: 'Premium clothing, shoes, and lifestyle bags.'
    }).returning();

    const healthBeauty = await db.insert(categories).values({
      name: 'Health & Beauty',
      slug: 'health-beauty',
      description: 'Skincare, makeup, and wellness essentials.'
    }).returning();

    // Subcategories
    const smartphones = await db.insert(categories).values({
      name: 'Smartphones',
      slug: 'smartphones',
      description: 'Mobile devices and accessories.',
      parentId: electronics[0].id
    }).returning();

    const footwear = await db.insert(categories).values({
      name: 'Footwear',
      slug: 'footwear',
      description: 'Premium sports and lifestyle shoes.',
      parentId: apparel[0].id
    }).returning();

    // 2. Seed Brands
    const apple = await db.insert(brands).values({
      name: 'Apple',
      slug: 'apple',
      description: 'Innovators of hardware and software ecosystems.',
      logo: '🍏'
    }).returning();

    const samsung = await db.insert(brands).values({
      name: 'Samsung',
      slug: 'samsung',
      description: 'Leading electronics and household manufacturers.',
      logo: '📱'
    }).returning();

    const nike = await db.insert(brands).values({
      name: 'Nike',
      slug: 'nike',
      description: 'Premium athletics apparel and shoes.',
      logo: '✔'
    }).returning();

    // 3. Seed Coupons
    await db.insert(coupons).values([
      {
        code: 'WELCOME10',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscount: 50,
        minOrderAmount: 200,
        active: true,
        usageLimit: 100,
        usageCount: 0,
      },
      {
        code: 'EID500',
        discountType: 'fixed',
        discountValue: 500,
        maxDiscount: 500,
        minOrderAmount: 2000,
        active: true,
        usageLimit: 200,
        usageCount: 0,
      }
    ]);

    // 4. Seed Products
    // Product 1: iPhone 15 Pro
    const iphone = await db.insert(products).values({
      name: 'iPhone 15 Pro Max',
      slug: 'iphone-15-pro-max',
      description: 'The pinnacle of mobile engineering featuring titanium framing, advanced A17 Pro core processors, and professional-grade triple cameras.',
      price: 1399.99,
      discountedPrice: 1299.99,
      stock: 45,
      categoryId: smartphones[0].id,
      brandId: apple[0].id,
      ratingAverage: 4.8,
      ratingCount: 154,
      images: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=600&auto=format&fit=crop,https://images.unsplash.com/photo-1695048133036-7e5af8f97479?q=80&w=600&auto=format&fit=crop',
      videos: 'https://www.w3schools.com/html/mov_bbb.mp4',
      specifications: JSON.stringify([
        { name: 'Processor', value: 'A17 Pro Chip' },
        { name: 'Display', value: '6.7-inch Super Retina XDR OLED' },
        { name: 'Storage', value: '256GB / 512GB / 1TB' },
        { name: 'Material', value: 'Aerospace-Grade Titanium' }
      ]),
      featured: true,
      trending: true,
      newArrival: false,
    }).returning();

    // Variants for iPhone
    await db.insert(variants).values([
      { productId: iphone[0].id, name: '256GB - Natural Titanium', price: 1299.99, stock: 15, sku: 'IP15-NAT-256' },
      { productId: iphone[0].id, name: '512GB - Natural Titanium', price: 1499.99, stock: 15, sku: 'IP15-NAT-512' },
      { productId: iphone[0].id, name: '256GB - cosmic Black', price: 1299.99, stock: 15, sku: 'IP15-BLK-256' }
    ]);

    // Product 2: Galaxy S24 Ultra
    const galaxy = await db.insert(products).values({
      name: 'Galaxy S24 Ultra',
      slug: 'galaxy-s24-ultra',
      description: 'Unleash mobile intelligence with Galaxy AI, featuring real-time translations, unmatched zoom clarity, and titanium outer framing.',
      price: 1199.99,
      discountedPrice: 1099.99,
      stock: 60,
      categoryId: smartphones[0].id,
      brandId: samsung[0].id,
      ratingAverage: 4.7,
      ratingCount: 112,
      images: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=600&auto=format&fit=crop,https://images.unsplash.com/photo-1610945415295-d9b21034b5fc?q=80&w=600&auto=format&fit=crop',
      specifications: JSON.stringify([
        { name: 'Processor', value: 'Snapdragon 8 Gen 3 for Galaxy' },
        { name: 'Camera', value: '200MP Quad Rear Camera' },
        { name: 'S-Pen', value: 'Included (In-body slot)' }
      ]),
      featured: false,
      trending: true,
      newArrival: true,
    }).returning();

    await db.insert(variants).values([
      { productId: galaxy[0].id, name: '12GB/256GB - Titanium Gray', price: 1099.99, stock: 30, sku: 'S24U-GRY-256' },
      { productId: galaxy[0].id, name: '12GB/512GB - Titanium Yellow', price: 1199.99, stock: 30, sku: 'S24U-YEL-512' }
    ]);

    // Product 3: Nike Air Max
    const shoes = await db.insert(products).values({
      name: 'Nike Air Max 270',
      slug: 'nike-air-max-270',
      description: 'Nike\'s first lifestyle Air Max delivers style, comfort and giant dual-aspect air cushioning.',
      price: 159.99,
      discountedPrice: 139.99,
      stock: 120,
      categoryId: footwear[0].id,
      brandId: nike[0].id,
      ratingAverage: 4.6,
      ratingCount: 208,
      images: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop,https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?q=80&w=600&auto=format&fit=crop',
      specifications: JSON.stringify([
        { name: 'Activity', value: 'Running / Lifestyle' },
        { name: 'Material', value: 'Mesh / Synthetic' },
        { name: 'Air Unit', value: 'Max Air 270 heel unit' }
      ]),
      featured: true,
      trending: false,
      newArrival: true,
    }).returning();

    await db.insert(variants).values([
      { productId: shoes[0].id, name: 'Red / Size 9', price: 139.99, stock: 40, sku: 'NK-AM270-RD-9' },
      { productId: shoes[0].id, name: 'Black / Size 10', price: 139.99, stock: 50, sku: 'NK-AM270-BL-10' },
      { productId: shoes[0].id, name: 'White / Size 11', price: 139.99, stock: 30, sku: 'NK-AM270-WH-11' }
    ]);

    console.log('Database successfully seeded with categories, brands, coupons, products and variants!');
  } catch (error) {
    console.error('Failed to seed database:', error);
  }
}
