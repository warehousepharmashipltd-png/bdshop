export interface User {
  id: number;
  uid: string;
  email: string;
  name: string | null;
  avatar: string | null;
  phone: string | null;
  role: 'customer' | 'staff' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  loyaltyPoints: number;
  createdAt: string;
}

export interface Address {
  id: number;
  userId: string;
  title: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountedPrice: number | null;
  stock: number;
  categoryId: number | null;
  brandId: number | null;
  ratingAverage: number;
  ratingCount: number;
  images: string; // Comma separated URLs
  videos: string | null;
  specifications: string | null; // JSON String
  featured: boolean;
  trending: boolean;
  newArrival: boolean;
  createdAt: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  name: string;
  price: number | null;
  stock: number;
  sku: string | null;
  image: string | null;
}

export interface CartItem {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
  saveForLater: boolean;
  product: Product;
  variant: ProductVariant | null;
}

export interface WishlistItem {
  id: number;
  productId: number;
  product: Product;
}

export interface Coupon {
  id: number;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount: number | null;
  minOrderAmount: number;
  expiryDate: string | null;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
}

export interface Order {
  id: number;
  userId: string;
  orderNumber: string;
  totalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  paymentMethod: 'cod' | 'card' | 'bkash' | 'nagad' | 'rocket';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  trackingNumber: string | null;
  couponId: number | null;
  createdAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number | null;
  variantId: number | null;
  name: string;
  quantity: number;
  price: number;
  discount: number;
}

export interface Review {
  id: number;
  userId: string;
  productId: number;
  rating: number;
  comment: string | null;
  isAnonymous: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface AuditLog {
  id: number;
  adminId: string | null;
  action: string;
  detail: string | null;
  ipAddress: string | null;
  device: string | null;
  createdAt: string;
}
