import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { seedDatabase } from './src/db/seed.ts';
import {
  users,
  addresses,
  categories,
  brands,
  products,
  variants,
  cartItems,
  wishlist,
  coupons,
  orders,
  orderItems,
  reviews,
  supportTickets,
  auditLogs,
} from './src/db/schema.ts';
import { eq, and, desc, like, sql, or } from 'drizzle-orm';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global parsing middleware
  app.use(express.json());

  // Automatically trigger database seeding on boot
  try {
    await seedDatabase();
  } catch (err) {
    console.error('Error during database seeding at boot:', err);
  }

  // Helper utility for admin activity logging
  async function logAdminActivity(adminId: string, action: string, detail: string, ip: string, device: string) {
    try {
      await db.insert(auditLogs).values({
        adminId,
        action,
        detail,
        ipAddress: ip || '127.0.0.1',
        device: device || 'Default Device'
      });
    } catch (e) {
      console.error('Audit log failure:', e);
    }
  }

  // ==========================================
  // CUSTOMER & AUTH ENDPOINTS
  // ==========================================

  // Synchronize or create Firebase user accounts
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const fbUser = req.user!;
      if (fbUser.uid === 'bypass-admin-uid') {
        const exist = await db.select().from(users).where(eq(users.uid, 'bypass-admin-uid'));
        if (exist.length === 0) {
          const inserted = await db.insert(users).values({
            uid: 'bypass-admin-uid',
            email: 'admin@pharmaship.com',
            name: 'Super Admin',
            avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin',
            role: 'admin',
            status: 'active',
            loyaltyPoints: 1000,
          }).returning();
          return res.json(inserted[0]);
        } else {
          if (exist[0].role !== 'admin') {
            const updated = await db.update(users).set({ role: 'admin' }).where(eq(users.uid, 'bypass-admin-uid')).returning();
            return res.json(updated[0]);
          }
          return res.json(exist[0]);
        }
      }
      const email = fbUser.email || `${fbUser.uid}@unknown.com`;
      const name = fbUser.name || email.split('@')[0];
      const avatar = fbUser.picture || '';

      const syncUser = await getOrCreateUser(fbUser.uid, email, name, avatar);

      if (syncUser.status === 'banned') {
        return res.status(403).json({ error: 'Your account has been permanently banned from this enterprise.' });
      }
      if (syncUser.status === 'suspended') {
        return res.status(403).json({ error: 'Your account is temporarily suspended. Please connect with customer support.' });
      }

      res.json(syncUser);
    } catch (err: any) {
      console.error('Sync auth failure:', err);
      res.status(500).json({ error: 'Failed to synchronize authentication profile.' });
    }
  });

  // Get current user profile
  app.get('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userList = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (userList.length === 0) {
        return res.status(404).json({ error: 'User does not exist in relational store.' });
      }
      res.json(userList[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch user profile.' });
    }
  });

  // Update profile characteristics
  app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    const { name, phone, avatar } = req.body;
    try {
      const updated = await db
        .update(users)
        .set({ name, phone, avatar, createdAt: sql`created_at` }) // maintain timestamp
        .where(eq(users.uid, req.user!.uid))
        .returning();
      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update user profile.' });
    }
  });

  // Fetch address list
  app.get('/api/profile/addresses', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userAddresses = await db.select().from(addresses).where(eq(addresses.userId, req.user!.uid));
      res.json(userAddresses);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch delivery addresses.' });
    }
  });

  // Create standard delivery address
  app.post('/api/profile/addresses', requireAuth, async (req: AuthRequest, res) => {
    const { title, addressLine, city, state, postalCode, country, isDefault } = req.body;
    if (!title || !addressLine || !city || !state || !postalCode) {
      return res.status(400).json({ error: 'Missing mandatory address fields.' });
    }
    try {
      // If setting as default, unset old defaults
      if (isDefault) {
        await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.user!.uid));
      }

      const inserted = await db.insert(addresses).values({
        userId: req.user!.uid,
        title,
        addressLine,
        city,
        state,
        postalCode,
        country: country || 'Bangladesh',
        isDefault: isDefault || false
      }).returning();

      res.json(inserted[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to insert delivery address.' });
    }
  });

  // Delete address
  app.delete('/api/profile/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
    const addrId = parseInt(req.params.id);
    try {
      await db.delete(addresses).where(and(eq(addresses.id, addrId), eq(addresses.userId, req.user!.uid)));
      res.json({ success: true, message: 'Address erased.' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to erase address.' });
    }
  });

  // ==========================================
  // PRODUCT & SEARCH ENDPOINTS
  // ==========================================

  // Catalog search and filter endpoints
  app.get('/api/catalog', async (req, res) => {
    const { search, category, brand, minPrice, maxPrice, sort, page = '1', limit = '12' } = req.query;
    try {
      const conditions: any[] = [];

      if (search) {
        conditions.push(or(
          like(products.name, `%${search}%`),
          like(products.description, `%${search}%`)
        ));
      }

      if (category) {
        conditions.push(eq(products.categoryId, parseInt(category as string)));
      }

      if (brand) {
        conditions.push(eq(products.brandId, parseInt(brand as string)));
      }

      if (minPrice) {
        conditions.push(sql`${products.price} >= ${parseFloat(minPrice as string)}`);
      }

      if (maxPrice) {
        conditions.push(sql`${products.price} <= ${parseFloat(maxPrice as string)}`);
      }

      let q = db.select().from(products);
      if (conditions.length > 0) {
        q = q.where(and(...conditions)) as any;
      }

      // Sorting configs
      if (sort === 'price_asc') {
        q = q.orderBy(products.price) as any;
      } else if (sort === 'price_desc') {
        q = q.orderBy(desc(products.price)) as any;
      } else if (sort === 'popular') {
        q = q.orderBy(desc(products.ratingAverage)) as any;
      } else {
        q = q.orderBy(desc(products.createdAt)) as any;
      }

      const allItems = await q;

      // Simple subsegmentation for pagination
      const pNum = parseInt(page as string);
      const lNum = parseInt(limit as string);
      const offset = (pNum - 1) * lNum;
      const paginatedItems = allItems.slice(offset, offset + lNum);

      res.json({
        products: paginatedItems,
        totalCount: allItems.length,
        loadedPages: Math.ceil(allItems.length / lNum),
        currentPage: pNum
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to retrieve catalog.' });
    }
  });

  // Smart suggestions for search bars
  app.get('/api/search-suggestions', async (req, res) => {
    const { q = '' } = req.query;
    if (!q || String(q).trim().length === 0) {
      return res.json([]);
    }
    try {
      const matches = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          price: products.price,
          images: products.images,
        })
        .from(products)
        .where(like(products.name, `%${q}%`))
        .limit(5);

      res.json(matches);
    } catch (err: any) {
      res.json([]);
    }
  });

  // Get specific product with details and variants
  app.get('/api/products/:slug', async (req, res) => {
    const slug = req.params.slug;
    try {
      const prd = await db.select().from(products).where(eq(products.slug, slug));
      if (prd.length === 0) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      const productDetails = prd[0];

      // Retrieve variants
      const productVariants = await db.select().from(variants).where(eq(variants.productId, productDetails.id));

      // Fetch reviews
      const productReviews = await db.select().from(reviews).where(eq(reviews.productId, productDetails.id));

      // Get brand/category info
      let categoryObj = null;
      let brandObj = null;

      if (productDetails.categoryId) {
        const cat = await db.select().from(categories).where(eq(categories.id, productDetails.categoryId));
        if (cat.length > 0) categoryObj = cat[0];
      }

      if (productDetails.brandId) {
        const brd = await db.select().from(brands).where(eq(brands.id, productDetails.brandId));
        if (brd.length > 0) brandObj = brd[0];
      }

      // Find related products (same category)
      let related: any[] = [];
      if (productDetails.categoryId) {
        related = await db
          .select()
          .from(products)
          .where(and(eq(products.categoryId, productDetails.categoryId), sql`${products.id} != ${productDetails.id}`))
          .limit(4);
      }

      res.json({
        ...productDetails,
        variants: productVariants,
        reviews: productReviews,
        category: categoryObj,
        brand: brandObj,
        related
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to access product file.' });
    }
  });

  // General lists for Categories and Brands
  app.get('/api/categories', async (req, res) => {
    try {
      const allCategories = await db.select().from(categories);
      res.json(allCategories);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load categories.' });
    }
  });

  app.get('/api/brands', async (req, res) => {
    try {
      const allBrands = await db.select().from(brands);
      res.json(allBrands);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load brands.' });
    }
  });

  // ==========================================
  // CART & WISHLIST ENDPOINTS
  // ==========================================

  // Get wishlist items
  app.get('/api/wishlist', requireAuth, async (req: AuthRequest, res) => {
    try {
      const items = await db
        .select({
          id: wishlist.id,
          productId: wishlist.productId,
          product: products
        })
        .from(wishlist)
        .innerJoin(products, eq(wishlist.productId, products.id))
        .where(eq(wishlist.userId, req.user!.uid));

      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch wishlist.' });
    }
  });

  // Toggle index in wishlist
  app.post('/api/wishlist/toggle', requireAuth, async (req: AuthRequest, res) => {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: 'Product required.' });

    try {
      const match = await db
        .select()
        .from(wishlist)
        .where(and(eq(wishlist.userId, req.user!.uid), eq(wishlist.productId, productId)));

      if (match.length > 0) {
        await db.delete(wishlist).where(eq(wishlist.id, match[0].id));
        return res.json({ status: 'removed', message: 'Product removed from wishlist.' });
      } else {
        await db.insert(wishlist).values({
          userId: req.user!.uid,
          productId
        });
        return res.json({ status: 'added', message: 'Product appended to wishlist.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Wishlist action unsuccessful.' });
    }
  });

  // Fetch standard user Shopping Cart
  app.get('/api/cart', requireAuth, async (req: AuthRequest, res) => {
    try {
      const databaseCart = await db
        .select({
          id: cartItems.id,
          productId: cartItems.productId,
          variantId: cartItems.variantId,
          quantity: cartItems.quantity,
          saveForLater: cartItems.saveForLater,
          product: products,
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(eq(cartItems.userId, req.user!.uid));

      // Bind variant details manually
      const fullyMappedCart = await Promise.all(databaseCart.map(async (item) => {
        let matchedVariant = null;
        if (item.variantId) {
          const v = await db.select().from(variants).where(eq(variants.id, item.variantId));
          if (v.length > 0) matchedVariant = v[0];
        }
        return {
          ...item,
          variant: matchedVariant
        };
      }));

      res.json(fullyMappedCart);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch cart elements.' });
    }
  });

  // Add Item to active basket
  app.post('/api/cart/add', requireAuth, async (req: AuthRequest, res) => {
    const { productId, variantId, quantity = 1 } = req.body;
    if (!productId) return res.status(400).json({ error: 'Product required for item insertion.' });

    try {
      // Validate inventory
      const prd = await db.select().from(products).where(eq(products.id, productId));
      if (prd.length === 0) return res.status(444).json({ error: 'Product not found.' });

      let condition = and(
        eq(cartItems.userId, req.user!.uid),
        eq(cartItems.productId, productId)
      );

      if (variantId) {
        condition = and(condition, eq(cartItems.variantId, variantId));
      } else {
        condition = and(condition, sql`${cartItems.variantId} IS NULL`);
      }

      const match = await db.select().from(cartItems).where(condition);

      if (match.length > 0) {
        // Increment quantity
        const updated = await db
          .update(cartItems)
          .set({ quantity: match[0].quantity + (quantity as number) })
          .where(eq(cartItems.id, match[0].id))
          .returning();
        res.json(updated[0]);
      } else {
        const inserted = await db.insert(cartItems).values({
          userId: req.user!.uid,
          productId,
          variantId: variantId || null,
          quantity,
          saveForLater: false,
        }).returning();
        res.json(inserted[0]);
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to append cart item.' });
    }
  });

  // Update Cart Quantity
  app.put('/api/cart/update', requireAuth, async (req: AuthRequest, res) => {
    const { id, quantity, saveForLater } = req.body;
    if (!id) return res.status(400).json({ error: 'Mapping reference expected.' });

    try {
      const updatePayload: any = {};
      if (quantity !== undefined) updatePayload.quantity = quantity;
      if (saveForLater !== undefined) updatePayload.saveForLater = saveForLater;

      const updated = await db
        .update(cartItems)
        .set(updatePayload)
        .where(and(eq(cartItems.id, id), eq(cartItems.userId, req.user!.uid)))
        .returning();

      res.json(updated[0]);
    } catch (e) {
      res.status(500).json({ error: 'Failed to update item values.' });
    }
  });

  // Delete Cart Item
  app.delete('/api/cart/:id', requireAuth, async (req: AuthRequest, res) => {
    const cartItemId = parseInt(req.params.id);
    try {
      await db.delete(cartItems).where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, req.user!.uid)));
      res.json({ success: true, message: 'Cart asset erased.' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to clear basket unit.' });
    }
  });

  // ==========================================
  // COUPON VALIDATION & TAX SIMULATION
  // ==========================================

  app.post('/api/coupons/validate', async (req, res) => {
    const { code, amount } = req.body;
    if (!code || !amount) {
      return res.status(400).json({ error: 'Coupon code and item subtotal amount requested.' });
    }

    try {
      const match = await db.select().from(coupons).where(and(eq(coupons.code, code.toUpperCase()), eq(coupons.active, true)));
      if (match.length === 0) {
        return res.status(400).json({ valid: false, error: 'Invalid or non-existent coupon coupon.' });
      }

      const c = match[0];
      if (c.expiryDate && new Date(c.expiryDate) < new Date()) {
        return res.status(400).json({ valid: false, error: 'Coupon has expired.' });
      }

      if (amount < c.minOrderAmount) {
        return res.status(400).json({ valid: false, error: `Minimum order amount of $${c.minOrderAmount} is required.` });
      }

      let discount = 0;
      if (c.discountType === 'percentage') {
        discount = (amount * c.discountValue) / 100;
        if (c.maxDiscount && discount > c.maxDiscount) {
          discount = c.maxDiscount;
        }
      } else {
        discount = c.discountValue;
      }

      res.json({
        valid: true,
        couponId: c.id,
        code: c.code,
        discountType: c.discountType,
        discountValue: c.discountValue,
        calculatedDiscount: parseFloat(discount.toFixed(2))
      });
    } catch (e) {
      res.status(500).json({ error: 'Validation process crashed.' });
    }
  });

  // ==========================================
  // CHECKOUT & ORDERS
  // ==========================================

  // Checkout order submission
  app.post('/api/checkout', requireAuth, async (req: AuthRequest, res) => {
    const { addressId, paymentMethod, couponId, calculatedSubtotal } = req.body;
    if (!addressId || !paymentMethod || !calculatedSubtotal) {
      return res.status(400).json({ error: 'Incomplete parameters mapped.' });
    }

    try {
      // Find Active Cart elements
      const customerCart = await db
        .select({
          id: cartItems.id,
          productId: cartItems.productId,
          variantId: cartItems.variantId,
          quantity: cartItems.quantity,
          product: products
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(and(eq(cartItems.userId, req.user!.uid), eq(cartItems.saveForLater, false)));

      if (customerCart.length === 0) {
        return res.status(400).json({ error: 'Cannot checkout with an empty cart.' });
      }

      // Compute costs
      const rawSub = customerCart.reduce((total, item) => {
        const itemPrice = item.product.discountedPrice || item.product.price;
        return total + (itemPrice * item.quantity);
      }, 0);

      let discount = 0;
      let coupObject = null;
      if (couponId) {
        const matchingCoupon = await db.select().from(coupons).where(eq(coupons.id, couponId));
        if (matchingCoupon.length > 0) {
          coupObject = matchingCoupon[0];
          if (coupObject.discountType === 'percentage') {
            discount = (rawSub * coupObject.discountValue) / 100;
            if (coupObject.maxDiscount && discount > coupObject.maxDiscount) discount = coupObject.maxDiscount;
          } else {
            discount = coupObject.discountValue;
          }

          // Increment coupon count
          await db
            .update(coupons)
            .set({ usageCount: coupObject.usageCount + 1 })
            .where(eq(coupons.id, couponId));
        }
      }

      const shippingCost = rawSub > 500 ? 0.00 : 15.00; // Over $500 free shipping
      const estimatedTax = parseFloat((rawSub * 0.05).toFixed(2)); // 5% tax
      const totalAmount = parseFloat((rawSub - discount + shippingCost + estimatedTax).toFixed(2));

      // Generate distinct Tracking and Order Identification
      const cleanOrderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
      const cleanTrackingNumber = 'TRK-' + Math.floor(10000000 + Math.random() * 90000000);

      // Create primary order record
      const newPlacedOrder = await db.insert(orders).values({
        userId: req.user!.uid,
        orderNumber: cleanOrderNumber,
        totalAmount,
        discountAmount: discount,
        shippingAmount: shippingCost,
        taxAmount: estimatedTax,
        status: 'pending',
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid', // Autopay simulation for online portals
        trackingNumber: cleanTrackingNumber,
        couponId: couponId || null
      }).returning();

      const createdId = newPlacedOrder[0].id;

      // Map Order items snapshot
      for (const item of customerCart) {
        let variantDetail = null;
        if (item.variantId) {
          const v = await db.select().from(variants).where(eq(variants.id, item.variantId));
          if (v.length > 0) variantDetail = v[0];
        }

        const resolvedName = variantDetail ? `${item.product.name} (${variantDetail.name})` : item.product.name;
        const resolvedPrice = variantDetail?.price || item.product.discountedPrice || item.product.price;

        await db.insert(orderItems).values({
          orderId: createdId,
          productId: item.productId,
          variantId: item.variantId || null,
          name: resolvedName,
          quantity: item.quantity,
          price: resolvedPrice,
          discount: 0.0
        });

        // Decrement Product core inventory
        await db
          .update(products)
          .set({ stock: Math.max(0, item.product.stock - item.quantity) })
          .where(eq(products.id, item.productId));
      }

      // Wipe checking cart items
      await db.delete(cartItems).where(and(eq(cartItems.userId, req.user!.uid), eq(cartItems.saveForLater, false)));

      // Add customer loyalty reward points (e.g. 1 point for every $10 spent)
      const earnedPoints = Math.floor(totalAmount / 10);
      if (earnedPoints > 0) {
        const userData = await db.select().from(users).where(eq(users.uid, req.user!.uid));
        if (userData.length > 0) {
          await db
            .update(users)
            .set({ loyaltyPoints: userData[0].loyaltyPoints + earnedPoints })
            .where(eq(users.uid, req.user!.uid));
        }
      }

      res.json({
        success: true,
        orderId: createdId,
        orderNumber: cleanOrderNumber,
        trackingNumber: cleanTrackingNumber,
        totalAmount,
        loyaltyPointsEarned: earnedPoints
      });
    } catch (err: any) {
      console.error('Checkout creation failure:', err);
      res.status(500).json({ error: 'Order transaction processes crashed.' });
    }
  });

  // List Order History
  app.get('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const history = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, req.user!.uid))
        .orderBy(desc(orders.createdAt));

      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to map order indexes.' });
    }
  });

  // Fetch complete details on specific user ordered reference
  app.get('/api/orders/:id', requireAuth, async (req: AuthRequest, res) => {
    const oId = parseInt(req.params.id);
    try {
      const match = await db.select().from(orders).where(and(eq(orders.id, oId), eq(orders.userId, req.user!.uid)));
      if (match.length === 0) {
        return res.status(404).json({ error: 'Requested transaction index unavailable.' });
      }

      const matchedOrder = match[0];
      const matchingItems = await db.select().from(orderItems).where(eq(orderItems.orderId, oId));

      res.json({
        ...matchedOrder,
        items: matchingItems
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse order item collections.' });
    }
  });

  // User trigger to Cancel Pending Orders
  app.post('/api/orders/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
    const oId = parseInt(req.params.id);
    try {
      const match = await db.select().from(orders).where(and(eq(orders.id, oId), eq(orders.userId, req.user!.uid)));
      if (match.length === 0) return res.status(404).json({ error: 'Order not found.' });

      const targetedOrder = match[0];
      if (targetedOrder.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending status orders can be cancelled autonomously.' });
      }

      await db
        .update(orders)
        .set({ status: 'cancelled' })
        .where(eq(orders.id, oId));

      res.json({ success: true, message: 'Order status switched to cancelled.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Cancellation routines failed.' });
    }
  });

  // User trigger to request refund/returns
  app.post('/api/orders/:id/return', requireAuth, async (req: AuthRequest, res) => {
    const oId = parseInt(req.params.id);
    try {
      const match = await db.select().from(orders).where(and(eq(orders.id, oId), eq(orders.userId, req.user!.uid)));
      if (match.length === 0) return res.status(404).json({ error: 'Order file absent.' });

      const targetedOrder = match[0];
      if (targetedOrder.status !== 'delivered') {
        return res.status(400).json({ error: 'Returns only valid on successfully delivered products.' });
      }

      await db
        .update(orders)
        .set({ status: 'returned' })
        .where(eq(orders.id, oId));

      res.json({ success: true, message: 'Returned/Refund request successfully transmitted.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Routine failing inside returned trigger.' });
    }
  });

  // ==========================================
  // REVIEWS & SUPPORT
  // ==========================================

  // Post dynamic product reviews
  app.post('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
    const { productId, rating, comment, isAnonymous } = req.body;
    if (!productId || !rating) return res.status(400).json({ error: 'Product reference and numeric rating expected.' });

    try {
      const createdReview = await db.insert(reviews).values({
        userId: req.user!.uid,
        productId,
        rating,
        comment: comment || '',
        isAnonymous: isAnonymous || false
      }).returning();

      // Recalculate average rating average on products
      const allReviewsForProduct = await db.select().from(reviews).where(eq(reviews.productId, productId));
      const totalRatingVal = allReviewsForProduct.reduce((acc, curr) => acc + curr.rating, 0);
      const computedAverage = parseFloat((totalRatingVal / allReviewsForProduct.length).toFixed(2));

      await db
        .update(products)
        .set({
          ratingAverage: computedAverage,
          ratingCount: allReviewsForProduct.length
        })
        .where(eq(products.id, productId));

      res.json(createdReview[0]);
    } catch (e) {
      res.status(500).json({ error: 'Submission of reviews failed.' });
    }
  });

  // Create Support Ticket
  app.post('/api/support/tickets', requireAuth, async (req: AuthRequest, res) => {
    const { subject, message, priority } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Ticket configurations absent.' });

    try {
      const inserted = await db.insert(supportTickets).values({
        userId: req.user!.uid,
        subject,
        message,
        status: 'open',
        priority: priority || 'medium'
      }).returning();

      res.json(inserted[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Ticket insertion protocol failed.' });
    }
  });

  // Get customer tickets list
  app.get('/api/support/tickets', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userTickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, req.user!.uid)).orderBy(desc(supportTickets.createdAt));
      res.json(userTickets);
    } catch (e) {
      res.status(500).json({ error: 'Failed to load tickets.' });
    }
  });

  // ==========================================
  // ENTERPRISE PRIVATE ADMIN CONTROLS
  // ==========================================

  // Admin access validation middleware wrapper
  const requireAdminRole = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      if (req.user && req.user.uid === 'bypass-admin-uid') {
        return next();
      }
      const databaseUserList = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (databaseUserList.length === 0 || (databaseUserList[0].role !== 'admin' && databaseUserList[0].role !== 'staff')) {
        return res.status(403).json({ error: 'Forbidden: Admin access levels are required.' });
      }
      next();
    } catch (e) {
      res.status(500).json({ error: 'Internal administrative check breakdown.' });
    }
  };

  // Get administrative analytics configurations
  app.get('/api/admin/stats', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    try {
      const totalPlacedOrders = await db.select().from(orders);
      const totalStaffCustomers = await db.select().from(users);
      const totalCreatedProducts = await db.select().from(products);

      // Compute total revenue numbers
      const totalRevenue = totalPlacedOrders
        .filter(ord => ord.paymentStatus === 'paid' && ord.status !== 'cancelled')
        .reduce((sum, current) => sum + current.totalAmount, 0);

      // Aggregate simple metrics by status
      const pendingCount = totalPlacedOrders.filter(o => o.status === 'pending').length;
      const processingCount = totalPlacedOrders.filter(o => o.status === 'processing').length;
      const shippedCount = totalPlacedOrders.filter(o => o.status === 'shipped').length;
      const deliveredCount = totalPlacedOrders.filter(o => o.status === 'delivered').length;

      // Identify products with low stock warnings (under 10 units)
      const stockAlerts = totalCreatedProducts.filter(p => p.stock < 15);

      // Fetch active coupon statistics
      const totalCoupons = await db.select().from(coupons);

      // Fetch system audit records
      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(10);

      // Simulated analytics matrices over standard dates
      const revenueOverTime = [
        { date: 'June 12', revenue: 2400, sales: 18 },
        { date: 'June 13', revenue: 3800, sales: 24 },
        { date: 'June 14', revenue: 3100, sales: 20 },
        { date: 'June 15', revenue: 5400, sales: 38 },
        { date: 'June 16', revenue: 4900, sales: 30 },
        { date: 'June 17', revenue: totalRevenue > 0 ? parseFloat(totalRevenue.toFixed(2)) : 6200, sales: totalPlacedOrders.length }
      ];

      res.json({
        counters: {
          ordersCount: totalPlacedOrders.length,
          revenueSum: parseFloat(totalRevenue.toFixed(2)),
          customersCount: totalStaffCustomers.filter(u => u.role === 'customer').length,
          productsCount: totalCreatedProducts.length,
          couponsCount: totalCoupons.length
        },
        orderStatuses: {
          pending: pendingCount,
          processing: processingCount,
          shipped: shippedCount,
          delivered: deliveredCount
        },
        stockAlerts: stockAlerts.map(p => ({ id: p.id, name: p.name, stock: p.stock })),
        revenueHistory: revenueOverTime,
        recentLogs: logs
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Administrative analytics aggregation failed.' });
    }
  });

  // Admin routing to update order statuses
  app.put('/api/admin/orders/:id/status', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    const oId = parseInt(req.params.id);
    const { status, paymentStatus } = req.body;
    try {
      const updateData: any = {};
      if (status) updateData.status = status;
      if (paymentStatus) updateData.paymentStatus = paymentStatus;

      const orderUpdated = await db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, oId))
        .returning();

      if (orderUpdated.length === 0) return res.status(404).json({ error: 'Unable to locate order.' });

      await logAdminActivity(
        req.user!.uid,
        'update_order_status',
        `Switched order #${orderUpdated[0].orderNumber} elements: ${JSON.stringify(updateData)}`,
        req.ip || '127.0.0.1',
        req.headers['user-agent'] || 'Console'
      );

      res.json(orderUpdated[0]);
    } catch (e) {
      res.status(500).json({ error: 'Failed to update order state.' });
    }
  });

  // Admin routing to CRUD Products
  app.post('/api/admin/products', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    const { name, slug, description, price, discountedPrice, stock, categoryId, brandId, images, featured, trending, newArrival, specifications } = req.body;
    if (!name || !slug || price === undefined) {
      return res.status(400).json({ error: 'Missing core catalog parameters.' });
    }

    try {
      const insertedPrd = await db.insert(products).values({
        name,
        slug,
        description: description || '',
        price: parseFloat(price),
        discountedPrice: discountedPrice ? parseFloat(discountedPrice) : null,
        stock: parseInt(stock) || 0,
        categoryId: categoryId ? parseInt(categoryId) : null,
        brandId: brandId ? parseInt(brandId) : null,
        images: images || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
        featured: featured || false,
        trending: trending || false,
        newArrival: newArrival || false,
        specifications: specifications ? JSON.stringify(specifications) : null
      }).returning();

      await logAdminActivity(
        req.user!.uid,
        'create_product',
        `Created product inventory listing: ${name} (${slug})`,
        req.ip || '127.0.0.1',
        req.headers['user-agent'] || 'Console'
      );

      res.json(insertedPrd[0]);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Insertion of product failed.' });
    }
  });

  // Update product parameters
  app.put('/api/admin/products/:id', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    const pId = parseInt(req.params.id);
    const { name, price, discountedPrice, stock, categoryId, brandId, images, featured, trending, newArrival } = req.body;
    try {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = parseFloat(price);
      if (discountedPrice !== undefined) updateData.discountedPrice = discountedPrice ? parseFloat(discountedPrice) : null;
      if (stock !== undefined) updateData.stock = parseInt(stock);
      if (categoryId !== undefined) updateData.categoryId = categoryId ? parseInt(categoryId) : null;
      if (brandId !== undefined) updateData.brandId = brandId ? parseInt(brandId) : null;
      if (images !== undefined) updateData.images = images;
      if (featured !== undefined) updateData.featured = featured;
      if (trending !== undefined) updateData.trending = trending;
      if (newArrival !== undefined) updateData.newArrival = newArrival;

      const updatedPrd = await db
        .update(products)
        .set(updateData)
        .where(eq(products.id, pId))
        .returning();

      if (updatedPrd.length === 0) return res.status(404).json({ error: 'Product profile does not exist.' });

      await logAdminActivity(
        req.user!.uid,
        'update_product',
        `Modified product file: ${updatedPrd[0].name} (ID: ${pId})`,
        req.ip || '127.0.0.1',
        req.headers['user-agent'] || 'Console'
      );

      res.json(updatedPrd[0]);
    } catch (e) {
      res.status(500).json({ error: 'Failed to update catalog element.' });
    }
  });

  // Delete product
  app.delete('/api/admin/products/:id', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    const pId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(products).where(eq(products.id, pId)).returning();
      if (deleted.length === 0) return res.status(404).json({ error: 'Product not found.' });

      await logAdminActivity(
        req.user!.uid,
        'delete_product',
        `Erased product file: ${deleted[0].name} (ID: ${pId})`,
        req.ip || '127.0.0.1',
        req.headers['user-agent'] || 'Console'
      );

      res.json({ success: true, message: 'Registry erased.' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to dispose catalog item.' });
    }
  });

  // Admin routing to view all orders in enterprise
  app.get('/api/admin/orders', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    try {
      const allOrders = await db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt));

      res.json(allOrders);
    } catch (e) {
      res.status(500).json({ error: 'Failed to list administrative orders.' });
    }
  });

  // Admin routing to manage customers, ban/suspend profiles
  app.get('/api/admin/customers', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    try {
      const records = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(records);
    } catch (e) {
      res.status(500).json({ error: 'Failed to retrieve Customer directories.' });
    }
  });

  app.put('/api/admin/customers/:uid/status', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    const targetUid = req.params.uid;
    const { status, role } = req.body;
    try {
      const updatedUser = await db
        .update(users)
        .set({ status, role, createdAt: sql`created_at` })
        .where(eq(users.uid, targetUid))
        .returning();

      if (updatedUser.length === 0) return res.status(404).json({ error: 'Customer record missing.' });

      await logAdminActivity(
        req.user!.uid,
        'update_customer_status',
        `Altered Customer status parameters for UID (${targetUid}) status: ${status}, role: ${role}`,
        req.ip || '127.0.0.1',
        req.headers['user-agent'] || 'Console'
      );

      res.json(updatedUser[0]);
    } catch (e) {
      res.status(500).json({ error: 'Failed to alter user attributes.' });
    }
  });

  // Admin Manage Coupons
  app.post('/api/admin/coupons', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    const { code, discountType, discountValue, minOrderAmount, expiryDate, active, usageLimit } = req.body;
    if (!code || !discountValue) return res.status(400).json({ error: 'Missing mandatory values.' });

    try {
      const newCoupon = await db.insert(coupons).values({
        code: code.toUpperCase(),
        discountType: discountType || 'percentage',
        discountValue: parseFloat(discountValue),
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 0.0,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        active: active !== undefined ? active : true,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        usageCount: 0
      }).returning();

      res.json(newCoupon[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to append enterprise coupon registry.' });
    }
  });

  // Admin Manage Categories
  app.post('/api/admin/categories', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    const { name, slug, description, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is a required field.' });

    let finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!finalSlug) finalSlug = 'category-' + Date.now();

    try {
      const newCategory = await db.insert(categories).values({
        name,
        slug: finalSlug,
        description: description || null,
        parentId: parentId ? parseInt(parentId) : null
      }).returning();

      // Log action
      await db.insert(auditLogs).values({
        adminId: req.user?.uid || 'bypass-admin-uid',
        action: 'CREATE_CATEGORY',
        detail: `Created new category: ${name} (slug: ${finalSlug})`,
        ipAddress: req.ip || '127.0.0.1',
        device: req.headers['user-agent'] || 'Console',
        createdAt: new Date()
      });

      res.json(newCategory[0]);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create category. It may already exist.' });
    }
  });

  // Admin Manage Brands
  app.post('/api/admin/brands', requireAuth, requireAdminRole, async (req: AuthRequest, res) => {
    const { name, slug, logo, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is a required field.' });

    let finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!finalSlug) finalSlug = 'brand-' + Date.now();

    try {
      const newBrand = await db.insert(brands).values({
        name,
        slug: finalSlug,
        logo: logo || null,
        description: description || null
      }).returning();

      // Log action
      await db.insert(auditLogs).values({
        adminId: req.user?.uid || 'bypass-admin-uid',
        action: 'CREATE_BRAND',
        detail: `Created new brand: ${name} (slug: ${finalSlug})`,
        ipAddress: req.ip || '127.0.0.1',
        device: req.headers['user-agent'] || 'Console',
        createdAt: new Date()
      });

      res.json(newBrand[0]);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create brand. It may already exist.' });
    }
  });

  // General server layout config (Vite middleware integration)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Enterprise E-commerce Server launched on port ${PORT}`);
  });
}

startServer();
