import { relations } from 'drizzle-orm';
import { pgTable, serial, text, integer, doublePrecision, boolean, timestamp } from 'drizzle-orm/pg-core';

// 1. Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  phone: text('phone'),
  role: text('role').default('customer').notNull(), // 'customer' | 'staff' | 'admin'
  status: text('status').default('active').notNull(), // 'active' | 'suspended' | 'banned'
  loyaltyPoints: integer('loyalty_points').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Addresses Table
export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userId: text('user_uid').references(() => users.uid, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(), // e.g. 'Home', 'Office'
  addressLine: text('address_line').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  postalCode: text('postal_code').notNull(),
  country: text('country').default('Bangladesh').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Categories Table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  parentId: integer('parent_id'), // Self-link for subcategories
});

// 4. Brands Table
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  description: text('description'),
});

// 5. Products Table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  price: doublePrecision('price').notNull(),
  discountedPrice: doublePrecision('discounted_price'),
  stock: integer('stock').default(0).notNull(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  brandId: integer('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  ratingAverage: doublePrecision('rating_average').default(0.0).notNull(),
  ratingCount: integer('rating_count').default(0).notNull(),
  images: text('images').notNull(), // Comma-separated list or JSON-stringified URLs
  videos: text('videos'), // Comma-separated video URLs
  specifications: text('specifications'), // JSON stringified specifications object
  featured: boolean('featured').default(false).notNull(),
  trending: boolean('trending').default(false).notNull(),
  newArrival: boolean('new_arrival').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Product Variants Table (Size, Color, etc.)
export const variants = pgTable('variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // e.g. 'Red / L'
  price: doublePrecision('price'), // Override base price if custom variant
  stock: integer('stock').default(0).notNull(),
  sku: text('sku'),
  image: text('image'),
});

// 7. Cart Items Table
export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  userId: text('user_uid').references(() => users.uid, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => variants.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').default(1).notNull(),
  saveForLater: boolean('save_for_later').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Wishlist Table
export const wishlist = pgTable('wishlist', {
  id: serial('id').primaryKey(),
  userId: text('user_uid').references(() => users.uid, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Coupons Table
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  discountType: text('discount_type').default('percentage').notNull(), // 'percentage' | 'fixed'
  discountValue: doublePrecision('discount_value').notNull(),
  maxDiscount: doublePrecision('max_discount'),
  minOrderAmount: doublePrecision('min_order_amount').default(0.0).notNull(),
  expiryDate: timestamp('expiry_date'),
  active: boolean('active').default(true).notNull(),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0).notNull(),
});

// 10. Orders Table
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: text('user_uid').references(() => users.uid, { onDelete: 'cascade' }).notNull(),
  orderNumber: text('order_number').notNull().unique(),
  totalAmount: doublePrecision('total_amount').notNull(),
  discountAmount: doublePrecision('discount_amount').default(0.0).notNull(),
  shippingAmount: doublePrecision('shipping_amount').default(0.0).notNull(),
  taxAmount: doublePrecision('tax_amount').default(0.0).notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
  paymentMethod: text('payment_method').default('cod').notNull(), // 'cod' | 'card' | 'bkash' | 'nagad' | 'rocket'
  paymentStatus: text('payment_status').default('pending').notNull(), // 'pending' | 'paid' | 'failed' | 'refunded'
  trackingNumber: text('tracking_number'),
  couponId: integer('coupon_id').references(() => coupons.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Order Items Table
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: integer('variant_id').references(() => variants.id, { onDelete: 'set null' }),
  name: text('name').notNull(), // Snapshot product name in case product changes
  quantity: integer('quantity').notNull(),
  price: doublePrecision('price').notNull(),
  discount: doublePrecision('discount').default(0.0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Product Reviews Table
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  userId: text('user_uid').references(() => users.uid, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  rating: integer('rating').notNull(), // 1 to 5
  comment: text('comment'),
  isAnonymous: boolean('is_anonymous').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Support Tickets Table
export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  userId: text('user_uid').references(() => users.uid, { onDelete: 'cascade' }).notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').default('open').notNull(), // 'open' | 'in_progress' | 'closed'
  priority: text('priority').default('medium').notNull(), // 'low' | 'medium' | 'high'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminId: text('admin_uid').references(() => users.uid, { onDelete: 'set null' }),
  action: text('action').notNull(), // e.g. 'create_product', 'ban_user'
  detail: text('detail'),
  ipAddress: text('ip_address'),
  device: text('device'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  cartItems: many(cartItems),
  wishlist: many(wishlist),
  orders: many(orders),
  reviews: many(reviews),
  supportTickets: many(supportTickets),
  auditLogs: many(auditLogs),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  variants: many(variants),
  cartItems: many(cartItems),
  wishlist: many(wishlist),
  reviews: many(reviews),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: 'subCategories' }),
  subcategories: many(categories, { relationName: 'subCategories' }),
  products: many(products),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, { fields: [cartItems.userId], references: [users.uid] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
  variant: one(variants, { fields: [cartItems.variantId], references: [variants.id] }),
}));

export const wishlistRelations = relations(wishlist, ({ one }) => ({
  user: one(users, { fields: [wishlist.userId], references: [users.uid] }),
  product: one(products, { fields: [wishlist.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.uid] }),
  items: many(orderItems),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(variants, { fields: [orderItems.variantId], references: [variants.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, { fields: [reviews.userId], references: [users.uid] }),
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.uid] }),
}));
