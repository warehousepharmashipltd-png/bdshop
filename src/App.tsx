import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, Search, Heart, ShoppingCart, User as UserIcon, 
  ChevronRight, Star, Tag, Truck, ShieldAlert, Sliders, 
  MapPin, Clock, Moon, Sun, Shield, Lock, Bell, MessageSquare,
  X, CheckCircle
} from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { Product, CartItem, WishlistItem, Order, Address, Category, Brand, User } from './types.ts';
import AdminPanel from './components/AdminPanel.tsx';
import SupportSection from './components/SupportSection.tsx';

export default function App() {
  // Theme Config
  const [darkMode, setDarkMode] = useState(true);

  // Authentication State
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Keyboard shortcut state for hidden admin login
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [secretAdminRoute, setSecretAdminRoute] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Taxonomy states (Brands & Categories)
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Search & Catalog Filter constraints
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(2000);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [catalogPage, setCatalogPage] = useState(1);

  // Loaded Catalog Records
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Wishlist and Cart
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  // Selected details
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productDetailsLoading, setProductDetailsLoading] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  // Reviews submission
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', isAnonymous: false });

  // Notifications alerts
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'err' | 'info' | null }>({ msg: '', type: null });

  // Checkout modal/funnel states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1); // 1: Address, 2: Payment, 3: Completed
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'cod' | 'card' | 'bkash' | 'nagad' | 'rocket'>('cod');
  
  // Coupon states
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<any>(null);

  // Addresses creation
  const [newAddressForm, setNewAddressForm] = useState({
    title: '', addressLine: '', city: '', state: '', postalCode: '', country: 'Bangladesh', isDefault: false
  });
  const [showAddressForm, setShowAddressForm] = useState(false);

  // Client Navigation / active tab state
  const [currentScreen, setCurrentScreen] = useState<'store' | 'wishlist' | 'orders' | 'support' | 'profile' | 'admin_room'>('store');
  const [ordersHistory, setOrdersHistory] = useState<Order[]>([]);

  // Toast triggers
  const showToast = (msg: string, type: 'success' | 'err' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast({ msg: '', type: null });
    }, 5000);
  };

  // Keyboard shortcut listener for admin login screen trigger (Ctrl + Shift + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAdminLogin(prev => !prev);
        showToast('Administrative console gate triggered.', 'info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Direct URL parameter trigger: ?admin=true
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
      setShowAdminLogin(true);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Monitor Auth Status Change from Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        setFirebaseUser(user);
        const token = await user.getIdToken();
        setAuthToken(token);

        // Sync with Relational Database
        try {
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setAppUser(data);
          } else {
            const err = await res.json();
            showToast(err.error || 'Identity matching declined.', 'err');
            signOut(auth);
            setFirebaseUser(null);
            setAppUser(null);
            setAuthToken(null);
          }
        } catch (e) {
          showToast('Failed to connect to core authentication API.', 'err');
        }
      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setAuthToken(null);
        setCart([]);
        setWishlist([]);
        setAddresses([]);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // Sync related customer databases after authenticated
  useEffect(() => {
    if (authToken) {
      fetchCart();
      fetchWishlist();
      fetchAddresses();
      fetchOrders();
    }
  }, [authToken]);

  // Load Categories and Brands
  const fetchTaxonomy = async () => {
    try {
      const catRes = await fetch('/api/categories');
      const brRes = await fetch('/api/brands');
      if (catRes.ok) setCategories(await catRes.json());
      if (brRes.ok) setBrands(await brRes.json());
    } catch (e) {
      console.error('Failed to load catalog variables', e);
    }
  };

  useEffect(() => {
    fetchTaxonomy();
  }, []);

  // Search suggestions auto fetch
  useEffect(() => {
    const suggest = async () => {
      if (searchQuery.trim().length === 0) {
        setSearchSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          setSearchSuggestions(await res.json());
        }
      } catch (err) {
        console.error(err);
      }
    };

    const timer = setTimeout(suggest, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Run dynamic catalog product list queries
  const fetchProducts = async () => {
    setCatalogLoading(true);
    try {
      const parts = [
        searchQuery ? `search=${encodeURIComponent(searchQuery)}` : '',
        selectedCategory ? `category=${selectedCategory}` : '',
        selectedBrand ? `brand=${selectedBrand}` : '',
        minPrice ? `minPrice=${minPrice}` : '',
        maxPrice ? `maxPrice=${maxPrice}` : '',
        sortBy ? `sort=${sortBy}` : '',
        `page=${catalogPage}`,
        `limit=12`
      ].filter(Boolean).join('&');

      const res = await fetch(`/api/catalog?${parts}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalProducts(data.totalCount || 0);
      }
    } catch (e) {
      showToast('Offline products catalog.', 'err');
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedBrand, minPrice, maxPrice, sortBy, catalogPage]);

  // Fetch Cart from Backend
  const fetchCart = async () => {
    try {
      const res = await fetch('/api/cart', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setCart(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Wishlist from Backend
  const fetchWishlist = async () => {
    try {
      const res = await fetch('/api/wishlist', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setWishlist(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Addresses from Backend
  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/profile/addresses', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAddresses(data);
        const def = data.find((a: Address) => a.isDefault);
        if (def) setSelectedAddressId(def.id);
        else if (data.length > 0) setSelectedAddressId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Order History
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setOrdersHistory(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Google OAuth login
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      showToast('Authenticated successfully with Google GoogleAuthProvider!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Login protocol rejected.', 'err');
    }
  };

  // Handle Admin Verification with ID & Password
  const handleAdminCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = adminUsername.trim().toLowerCase();
    const cleanPassword = adminPassword.trim();
    if (cleanUsername === 'admin' && cleanPassword === 'admin') {
      setAuthToken('admin-pass-bypass-secret');
      setAppUser({
        id: 0,
        uid: 'bypass-admin-uid',
        email: 'admin@pharmaship.com',
        name: 'Super Admin',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin',
        phone: '01700000000',
        role: 'admin',
        status: 'active',
        loyaltyPoints: 1000,
        createdAt: new Date().toISOString() as any,
      });
      showToast('Authenticated as Super Admin successfully!', 'success');
      setAdminUsername('');
      setAdminPassword('');
    } else {
      showToast('Error: Invalid Administrative Credentials.', 'err');
    }
  };

  // Handle Log Out
  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('Logged out of system.', 'info');
      setCurrentScreen('store');
    } catch (e) {
      showToast('Logout failure.', 'err');
    }
  };

  // Add Item to Shopping Cart
  const handleAddToCart = async (productId: number, variantId?: number | null) => {
    if (!authToken) {
      showToast('Please sign-in to purchase catalog products.', 'err');
      return;
    }
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ productId, variantId: variantId || null })
      });
      if (res.ok) {
        showToast('Item successfully locked in your cart!', 'success');
        fetchCart();
        setIsCartOpen(true);
      } else {
        const r = await res.json();
        showToast(r.error || 'Cart storage failed.', 'err');
      }
    } catch (e) {
      showToast('Shopping basket processes crashed.', 'err');
    }
  };

  // Remove elements from cart
  const handleRemoveFromCart = async (id: number) => {
    try {
      const res = await fetch(`/api/cart/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showToast('Cart element cleared.', 'success');
        fetchCart();
      }
    } catch (e) {
      showToast('Wipe items action failed.', 'err');
    }
  };

  // Alter checkout quantity
  const handleUpdateCartQty = async (id: number, quantity: number) => {
    if (quantity < 1) return;
    try {
      const res = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ id, quantity })
      });
      if (res.ok) {
        fetchCart();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Wishlist actions toggler
  const handleToggleWishlist = async (id: number) => {
    if (!authToken) {
      showToast('Please authenticate with Google first.', 'err');
      return;
    }
    try {
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ productId: id })
      });
      if (res.ok) {
        const result = await res.json();
        showToast(result.message, 'success');
        fetchWishlist();
      }
    } catch (e) {
      showToast('Wishlist action unsuccessful.', 'err');
    }
  };

  // Create Shipping Address
  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    try {
      const res = await fetch('/api/profile/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(newAddressForm)
      });
      if (res.ok) {
        showToast('New shipping address verified!', 'success');
        setNewAddressForm({ title: '', addressLine: '', city: '', state: '', postalCode: '', country: 'Bangladesh', isDefault: false });
        setShowAddressForm(false);
        fetchAddresses();
      } else {
        const r = await res.json();
        showToast(r.error || 'Address parameters rejected.', 'err');
      }
    } catch (e) {
      showToast('Addresses systems offline.', 'err');
    }
  };

  // Validate Promo Coupon Code
  const handleValidateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput) return;
    const itemsSubtotal = getCartSubtotal();
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCodeInput, amount: itemsSubtotal })
      });
      const data = await res.json();
      if (res.ok) {
        setAppliedCoupon(data);
        showToast(`Promo applied! You received $${data.calculatedDiscount} off your subtotal.`, 'success');
      } else {
        showToast(data.error || 'Coupon rejected.', 'err');
      }
    } catch (e) {
      showToast('Promo gateway offline.', 'err');
    }
  };

  // Place checkout orders
  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      showToast('Please register or pick an address to continue.', 'err');
      return;
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          addressId: selectedAddressId,
          paymentMethod: checkoutPaymentMethod,
          couponId: appliedCoupon ? appliedCoupon.couponId : null,
          calculatedSubtotal: getCartSubtotal()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setLastPlacedOrder(data);
        setCheckoutStep(3); // Completed!
        showToast('Enterprise checkout completed. Order dispatched!', 'success');
        fetchCart();
        fetchOrders();
        // Reset promo
        setAppliedCoupon(null);
        setCouponCodeInput('');
      } else {
        showToast(data.error || 'Enterprise banking portal declined transaction.', 'err');
      }
    } catch (e) {
      showToast('Payment system synchronization error.', 'err');
    }
  };

  // Cancel order autonomously
  const handleCancelOrder = async (id: number) => {
    if (!window.confirm('Do you want to cancel this order? Item stocks will automatically re-increase.')) return;
    try {
      const res = await fetch(`/api/orders/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showToast('Order successfully cancelled.', 'success');
        fetchOrders();
        fetchProducts(); // Refresh stocks
      } else {
        const r = await res.json();
        showToast(r.error || 'Cancellation timelines expired.', 'err');
      }
    } catch (e) {
      showToast('Failed to cancel order.', 'err');
    }
  };

  // Request order return
  const handleReturnOrder = async (id: number) => {
    if (!window.confirm('File a returns and refund request for this item?')) return;
    try {
      const res = await fetch(`/api/orders/${id}/return`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showToast('Refund request filed and staff alerted!', 'success');
        fetchOrders();
      }
    } catch (e) {
      showToast('Failed to process refund filing.', 'err');
    }
  };

  // Submit Product Reviews
  const handlePostReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !selectedProduct) return;
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          isAnonymous: reviewForm.isAnonymous
        })
      });
      if (res.ok) {
        showToast('Review shared! Thank you for rating this product.', 'success');
        setReviewForm({ rating: 5, comment: '', isAnonymous: false });
        // Refresh product details
        viewProductDetails(selectedProduct.slug);
      }
    } catch (e) {
      showToast('Failed to transmit review.', 'err');
    }
  };

  // Fetch product full details
  const viewProductDetails = async (slug: string) => {
    setProductDetailsLoading(true);
    setSelectedProduct(null);
    setSelectedVariantId(null);
    try {
      const res = await fetch(`/api/products/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProduct(data);
        if (data.variants && data.variants.length > 0) {
          setSelectedVariantId(data.variants[0].id);
        }
      }
    } catch (err) {
      showToast('Products catalog details offline.', 'err');
    } finally {
      setProductDetailsLoading(false);
    }
  };

  // Calculations Helpers
  const getCartSubtotal = () => {
    return cart.reduce((total, item) => {
      const basePrice = item.variant?.price || item.product.discountedPrice || item.product.price;
      return total + (basePrice * item.quantity);
    }, 0);
  };

  const getWeightyGrandTotal = () => {
    const sub = getCartSubtotal();
    const discount = appliedCoupon ? appliedCoupon.calculatedDiscount : 0;
    const shipping = sub > 500 ? 0 : 15;
    const tax = parseFloat((sub * 0.05).toFixed(2));
    return parseFloat((sub - discount + shipping + tax).toFixed(2));
  };

  return (
    <div className={`min-h-screen font-sans antialiased text-base transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Toast Alert Header */}
      {toast.msg && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl flex items-center gap-3 border shadow-[0_8px_30px_rgb(0,0,0,0.12)] font-medium animate-fade-in text-xs max-w-sm w-full ${
          darkMode ? 'bg-slate-900 text-white border-indigo-500/30' : 'bg-white text-slate-950 border-indigo-500/10'
        }`}>
          <Bell className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ADMIN CONSOLE ENTRY POPUP DIALOG */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-zoom-in ${
            darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button 
              onClick={() => setShowAdminLogin(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-xl transition ${
                darkMode ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center space-y-2 mb-6">
              <div className={`mx-auto p-3 w-12 h-12 rounded-full flex items-center justify-center border ${
                darkMode ? 'bg-indigo-950/40 text-indigo-400 border-indigo-900/45' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
              }`}>
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold font-serif text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500">Hidden Management Gate</h2>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Ctrl+Shift+A combination reveals this panel. Access requires credentials.</p>
            </div>

            {!authToken ? (
              <div className="space-y-4">
                <form onSubmit={handleAdminCredentialsLogin} className="space-y-3.5 text-left border-b border-slate-900 pb-4">
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Admin Credentials Login</p>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">ID (Username/Email)</label>
                    <input
                      type="text"
                      required
                      placeholder="Username (e.g., admin)"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className={`w-full p-2.5 rounded-xl text-xs transition focus:outline-none ${
                        darkMode ? 'bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500' : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className={`w-full p-2.5 rounded-xl text-xs transition focus:outline-none ${
                        darkMode ? 'bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500' : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs cursor-pointer transition uppercase tracking-wide"
                  >
                    Enter with Credentials
                  </button>
                  <p className={`text-[10px] text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Tip: Use ID: <span className="font-mono font-bold text-indigo-400">admin</span> & Pass: <span className="font-mono font-bold text-indigo-400">admin</span>
                  </p>
                </form>

                <div className="text-center pt-2">
                  <p className={`text-[10px] mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Or use Single Sign-on:</p>
                  <button
                    onClick={handleLogin}
                    className="w-full py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 font-bold text-[11px] cursor-pointer transition uppercase tracking-wide flex items-center justify-center gap-1.5"
                  >
                    Verify Google Account
                  </button>
                </div>
              </div>
            ) : appUser && (appUser.role === 'admin' || appUser.role === 'staff') ? (
              <div className="space-y-4">
                <p className={`text-xs text-center leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Welcome back, Admin <span className="text-indigo-500 font-bold font-mono">{appUser.name}</span>. Secure IP monitoring is active: <span className="text-slate-400 font-mono">127.0.0.1</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAdminLogin(false);
                      setCurrentScreen('admin_room');
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl font-bold text-xs cursor-pointer text-white transition text-center uppercase tracking-wider"
                  >
                    Open Console Panel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 space-y-3 bg-rose-950/20 border border-rose-900/40 rounded-2xl">
                  <ShieldAlert className="w-5 h-5 text-indigo-500 mx-auto" />
                  <p className="text-xs text-slate-300">Access Denied: Your current role is limited to <span className="font-bold underline text-white">CUSTOMER</span>. Staff privileges required.</p>
                </div>
                <div className="border-t border-slate-900 pt-4">
                  <form onSubmit={handleAdminCredentialsLogin} className="space-y-3.5 text-left">
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Login with Staff Credentials Instead</p>
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="ID (e.g. admin)"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        className={`w-full p-2.5 rounded-xl text-xs transition focus:outline-none ${
                          darkMode ? 'bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500' : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        required
                        placeholder="Password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className={`w-full p-2.5 rounded-xl text-xs transition focus:outline-none ${
                          darkMode ? 'bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500' : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs cursor-pointer transition uppercase tracking-wide"
                    >
                      Enter with Credentials
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* IF SCREEN IS THE ADMIN ROOM */}
      {currentScreen === 'admin_room' && appUser && (appUser.role === 'admin' || appUser.role === 'staff') ? (
        <AdminPanel 
          token={authToken}
          adminUser={appUser}
          onBackToStore={() => setCurrentScreen('store')}
          categories={categories}
          brands={brands}
          showToast={showToast}
          refreshTaxonomy={fetchTaxonomy}
        />
      ) : (
        <>
          {/* TOP GLOBAL BAR */}
          <nav className={`sticky top-0 z-30 transition-all duration-200 py-3.5 border-b ${
            darkMode 
              ? 'bg-slate-950/85 backdrop-blur-md border-slate-900 text-slate-100' 
              : 'bg-white/85 backdrop-blur-md border-slate-200/80 text-slate-900 shadow-xs'
          }`}>
            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-normal">
              
              <div className="flex items-center justify-between w-full md:w-auto">
                <div onClick={() => { setCurrentScreen('store'); setSelectedProduct(null); }} className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-black animate-spin-hover">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className={`text-md font-bold tracking-tight uppercase font-serif ${
                      darkMode ? 'text-white' : 'text-slate-900'
                    }`}>Fullstack E-Shop</h1>
                    <p className={`text-[9px] font-mono uppercase tracking-wider ${
                      darkMode ? 'text-slate-500' : 'text-slate-400'
                    }`}>B2C Enterprise Platform • v1.1</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:hidden">
                  <button onClick={() => setIsCartOpen(true)} className={`p-2 rounded-xl transition relative focus:outline-none ${
                    darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-900/60' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
                  }`}>
                    <ShoppingCart className="w-4.5 h-4.5 text-indigo-500" />
                    {cart.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white font-mono text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center animate-pulse">
                        {cart.length}
                      </span>
                    )}
                  </button>
                  <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-xl transition focus:outline-none ${
                    darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-900/60' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
                  }`}>
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button onClick={authToken ? handleLogout : handleLogin} className={`p-2 rounded-xl transition focus:outline-none ${
                    darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}>
                    <UserIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* SEARCH BOX WITH LIVE SUGGESTIONS */}
              <div className="flex-1 max-w-xl mx-auto w-full relative">
                <div className="relative">
                  <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    darkMode ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    type="text"
                    placeholder="Search premium electronics, sneakers, cosmetics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full rounded-xl py-2.5 pl-10.5 pr-4 text-xs transition-all duration-200 focus:outline-none focus:ring-2 ${
                      darkMode 
                        ? 'bg-slate-900 border border-slate-800 text-slate-200 focus:ring-indigo-500/30 focus:border-indigo-500' 
                        : 'bg-slate-100/80 border border-slate-200/60 text-slate-900 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white font-medium'
                    }`}
                  />
                </div>

                {/* Search suggestion drawer */}
                {searchSuggestions.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 rounded-2xl mt-1.5 shadow-2xl z-40 max-h-60 overflow-y-auto divide-y ${
                    darkMode 
                      ? 'bg-slate-950 border border-slate-800 divide-slate-900' 
                      : 'bg-white border border-slate-200 divide-slate-100'
                  }`}>
                    {searchSuggestions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSearchQuery('');
                          setSearchSuggestions([]);
                          viewProductDetails(s.slug);
                        }}
                        className={`p-3 text-xs flex items-center justify-between cursor-pointer transition ${
                          darkMode ? 'hover:bg-slate-900 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <span className="truncate pr-4 font-medium">{s.name}</span>
                        <span className="text-indigo-500 font-bold font-mono shrink-0">${s.price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ACTION LINKS */}
              <div className={`hidden md:flex items-center gap-1.5 text-xs ${
                darkMode ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <button
                  onClick={() => { setCurrentScreen('store'); setSelectedProduct(null); fetchProducts(); }}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-200 font-medium ${
                    currentScreen === 'store' && !selectedProduct 
                      ? (darkMode ? 'text-white bg-slate-900' : 'text-slate-900 bg-slate-100')
                      : (darkMode ? 'hover:text-white hover:bg-slate-900/65' : 'hover:text-slate-950 hover:bg-slate-100')
                  }`}
                >
                  Browse Catalog
                </button>
                <button
                  onClick={() => setCurrentScreen('wishlist')}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-200 font-medium ${
                    currentScreen === 'wishlist' 
                      ? (darkMode ? 'text-white bg-slate-900' : 'text-slate-900 bg-slate-100')
                      : (darkMode ? 'hover:text-white hover:bg-slate-900/65' : 'hover:text-slate-950 hover:bg-slate-100')
                  }`}
                >
                  Wishlist ({wishlist.length})
                </button>
                <button
                  onClick={() => setCurrentScreen('orders')}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-200 font-medium ${
                    currentScreen === 'orders' 
                      ? (darkMode ? 'text-white bg-slate-900' : 'text-slate-900 bg-slate-100')
                      : (darkMode ? 'hover:text-white hover:bg-slate-900/65' : 'hover:text-slate-950 hover:bg-slate-100')
                  }`}
                >
                  My Orders
                </button>
                <button
                  onClick={() => setCurrentScreen('support')}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-200 font-medium ${
                    currentScreen === 'support' 
                      ? (darkMode ? 'text-white bg-slate-900' : 'text-slate-900 bg-slate-100')
                      : (darkMode ? 'hover:text-white hover:bg-slate-900/65' : 'hover:text-slate-950 hover:bg-slate-100')
                  }`}
                >
                  Support Unit
                </button>

                <button
                  onClick={() => setIsCartOpen(true)}
                  className={`px-3 py-1.5 rounded-xl transition-all duration-200 font-semibold relative flex items-center gap-2 ${
                    isCartOpen 
                      ? (darkMode ? 'text-indigo-400 bg-slate-900' : 'text-indigo-600 bg-slate-100')
                      : (darkMode ? 'text-slate-350 hover:text-white hover:bg-slate-900/65' : 'text-slate-650 hover:text-slate-950 hover:bg-slate-100')
                  }`}
                >
                  <ShoppingCart className="w-4 h-4 text-indigo-500" />
                  Cart Box
                  {cart.length > 0 ? (
                    <span className="bg-rose-600 text-white font-mono font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                      {cart.length}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">(0)</span>
                  )}
                </button>

                {/* Dark Mode toggle & profile widget info */}
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-2 rounded-xl transition ml-1 ${
                    darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-900/60' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  {darkMode ? <Sun className="w-4 h-4 animate-pulse" /> : <Moon className="w-4 h-4" />}
                </button>

                {authToken ? (
                  <div className={`flex items-center gap-2 pl-3 border-l ${
                    darkMode ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    <img 
                      src={appUser?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=shopper`} 
                      alt="" 
                      className={`w-7 h-7 rounded-xl border ${
                        darkMode ? 'border-indigo-500/20 bg-slate-800' : 'border-indigo-500/10 bg-slate-100'
                      }`} 
                    />
                    <div className="text-left">
                      <p className={`font-bold max-w-[100px] truncate ${
                        darkMode ? 'text-white' : 'text-slate-900'
                      }`}>{appUser?.name}</p>
                      <button onClick={handleLogout} className={`text-[10px] block underline font-mono ${
                        darkMode ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'
                      }`}>Sign Out</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-505 hover:to-violet-505 text-white text-xs rounded-xl transition duration-200 font-bold shadow-xs active:scale-95 uppercase"
                  >
                    Google Login
                  </button>
                )}
              </div>

            </div>
          </nav>

          {/* MAIN CONTAINER CONTENT PAGE ROUTING */}
          <div className="max-w-7xl mx-auto px-4 py-8">
            
            {/* VIEW PRODUCT FULL DETAILS SECTION */}
            {selectedProduct ? (
              <div className="animate-fade-in space-y-8">
                {/* Back Link Header */}
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-xs text-rose-500 hover:text-rose-400 font-bold uppercase tracking-wide flex items-center gap-1.5 mb-2"
                >
                  ← Back to products directory listings
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Photo details images */}
                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden aspect-video relative">
                      <img 
                        src={selectedProduct.images.split(',')[0]} 
                        alt="" 
                        className="w-full h-full object-cover" 
                      />
                      {selectedProduct.featured && (
                        <span className="absolute top-4 left-4 bg-rose-600 text-white font-bold uppercase text-[9px] px-2.5 py-1 tracking-wider rounded-lg">Featured</span>
                      )}
                    </div>
                    {/* Related small list image references */}
                    <div className="grid grid-cols-3 gap-3">
                      {selectedProduct.images.split(',').slice(0, 3).map((url: string, idx: number) => (
                        <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 aspect-video">
                          <img src={url} alt="" className="w-full h-full object-cover opacity-70 hover:opacity-100 transition" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Core specifications specs and ratings */}
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-white font-sans">{selectedProduct.name}</h2>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center text-amber-500 gap-0.5">
                          <Star className="w-4 h-4 fill-amber-500" />
                          <span className="text-xs font-bold text-slate-300 font-mono mt-0.5">{selectedProduct.ratingAverage}</span>
                        </div>
                        <span className="text-xs text-slate-500">({selectedProduct.ratingCount} commercial reviews)</span>
                        <span className="text-xs text-indigo-400 tracking-wider uppercase font-mono font-bold bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">
                          {brands.find(b => b.id === selectedProduct.brandId)?.name || 'Direct Brand'}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">Exclusive price offer</p>
                        <h4 className="text-3xl font-black text-rose-500 font-mono mt-0.5">
                          ${selectedProduct.discountedPrice || selectedProduct.price}
                        </h4>
                        {selectedProduct.discountedPrice && (
                          <span className="text-xs text-slate-500 line-through font-mono">${selectedProduct.price}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-mono">Inventory warning</p>
                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded mt-1.5 block ${
                          selectedProduct.stock > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}>
                          {selectedProduct.stock > 0 ? `${selectedProduct.stock} items left` : 'Out of stock'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed font-sans">{selectedProduct.description}</p>

                    {/* SELECT OPTIONS VARIANT FOR CART INSERTS */}
                    {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                      <div className="space-y-2.5">
                        <span className="text-xs uppercase text-slate-400 font-bold font-mono block">Required Variant selection:</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedProduct.variants.map((v: any) => (
                            <button
                              key={v.id}
                              onClick={() => setSelectedVariantId(v.id)}
                              className={`px-3 py-2 text-xs rounded-xl font-medium border font-mono transition ${
                                selectedVariantId === v.id 
                                  ? 'bg-rose-950 text-rose-400 border-rose-500' 
                                  : 'bg-slate-950/40 text-slate-400 border-slate-800'
                              }`}
                            >
                              {v.name} {v.price ? `(+$${v.price - selectedProduct.price})` : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cart Trigger Button */}
                    <div className="flex gap-4 pt-2">
                      <button
                        disabled={selectedProduct.stock === 0}
                        onClick={() => handleAddToCart(selectedProduct.id, selectedVariantId)}
                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition font-mono block pointer"
                      >
                        {selectedProduct.stock > 0 ? '🔒 Add Item to active cart/basket' : 'Sold Out'}
                      </button>
                      <button
                        onClick={() => handleToggleWishlist(selectedProduct.id)}
                        className="px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl transition text-rose-500"
                        title="Wishlist Toggle"
                      >
                        <Heart className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Technical Specifications */}
                    {selectedProduct.specifications && (
                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl">
                        <p className="text-xs font-bold uppercase text-slate-300 font-mono mb-2">Technical specs sheet:</p>
                        <div className="divide-y divide-slate-900">
                          {JSON.parse(selectedProduct.specifications).map((spec: any, indexNum: number) => (
                            <div key={indexNum} className="flex justify-between py-2 text-xs">
                              <span className="text-slate-500">{spec.name}</span>
                              <span className="font-medium text-slate-300">{spec.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Related items panel */}
                {selectedProduct.related && selectedProduct.related.length > 0 && (
                  <div className="space-y-4 pt-6">
                    <h4 className="text-md font-bold tracking-tight text-white uppercase font-serif">Simulating related products:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {selectedProduct.related.map((rel: Product) => (
                        <div 
                          key={rel.id} 
                          onClick={() => viewProductDetails(rel.slug)}
                          className="bg-slate-950 border border-slate-850 p-3 rounded-2xl cursor-pointer hover:border-slate-700 transition"
                        >
                          <img src={rel.images.split(',')[0]} alt="" className="w-full aspect-video object-cover rounded-xl bg-slate-900" />
                          <p className="font-semibold text-xs text-slate-350 truncate mt-2">{rel.name}</p>
                          <span className="text-xs font-bold text-slate-100 font-mono block mt-1">${rel.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submitting product reviews */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-850">
                  {/* Reviews lists */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase text-slate-300">Shops reviews logs</h4>
                    <div className="space-y-3">
                      {selectedProduct.reviews && selectedProduct.reviews.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No ratings recorded for this item. Be the first!</p>
                      ) : (
                        selectedProduct.reviews?.map((rev: any) => (
                          <div key={rev.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-slate-300">{rev.isAnonymous ? 'Verified Shopper' : rev.userId}</span>
                              <div className="flex gap-0.5 text-amber-500">
                                {Array.from({ length: rev.rating }).map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-amber-500" />
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 font-sans leading-relaxed">{rev.comment}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Submission Form */}
                  <div className={`border p-6 rounded-3xl transition ${
                    darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/95 shadow-xs'
                  }`}>
                    <h4 className={`text-sm font-bold uppercase tracking-wide font-serif mb-4 ${
                      darkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}>Post Product ratings</h4>
                    {!authToken ? (
                      <p className="text-xs text-slate-500">Please sign-in to review item qualities.</p>
                    ) : (
                      <form onSubmit={handlePostReview} className="space-y-4 text-xs">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Numeric Score (1-5)</label>
                            <input
                              type="number" min="1" max="5" required
                              value={reviewForm.rating}
                              onChange={(e) => setReviewForm({ ...reviewForm, rating: parseInt(e.target.value) })}
                              className={`w-full rounded-xl p-2.5 text-xs transition focus:outline-none focus:ring-2 ${
                                darkMode 
                                  ? 'bg-slate-950 border border-slate-800 text-slate-200 focus:ring-indigo-500/20' 
                                  : 'bg-slate-50 border border-slate-200 text-slate-900 focus:ring-indigo-500/10'
                              }`}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-4">
                            <input
                              type="checkbox"
                              checked={reviewForm.isAnonymous}
                              id="is_anon"
                              onChange={(e) => setReviewForm({ ...reviewForm, isAnonymous: e.target.checked })}
                              className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="is_anon" className={`select-none cursor-pointer font-medium ${
                              darkMode ? 'text-slate-350' : 'text-slate-650'
                            }`}>Post anonymously</label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Your review testimonial</label>
                          <textarea
                            rows={3} required
                            placeholder="Draft your experiences with shipping, material, packaging..."
                            value={reviewForm.comment}
                            onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                            className={`w-full rounded-xl p-2.5 text-xs transition focus:outline-none focus:ring-2 ${
                              darkMode 
                                ? 'bg-slate-950 border border-slate-800 text-slate-200 focus:ring-indigo-500/20' 
                                : 'bg-slate-50 border border-slate-200 text-slate-900 focus:ring-indigo-500/10'
                            }`}
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-505 hover:to-violet-550 font-bold transition text-white text-xs rounded-xl cursor-pointer uppercase tracking-wider shadow-sm"
                        >
                          Submit ratings
                        </button>
                      </form>
                    )}
                  </div>
                </div>

              </div>
            ) : currentScreen === 'store' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                
                {/* SIDE FILTERS LAYOUT CONTROL BAR */}
                <aside className="lg:col-span-1 space-y-6">
                  <div className={`border p-5 rounded-3xl transition duration-150 ${
                    darkMode ? 'bg-slate-950/80 border-slate-900' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-4 font-serif ${
                      darkMode ? 'text-slate-300' : 'text-slate-800'
                    }`}>
                      <Sliders className="w-4 h-4 text-indigo-500" /> Filter parameters
                    </h3>

                    <div className="space-y-4 text-xs font-sans">
                      {/* Price boundaries */}
                      <div>
                        <span className={`font-semibold block mb-2 font-mono uppercase tracking-wider text-[10px] ${
                          darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>Retail Price thresholds:</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500 select-none block mb-0.5">Min price (৳)</span>
                            <input
                              type="number"
                              value={minPrice}
                              onChange={(e) => setMinPrice(parseInt(e.target.value) || 0)}
                              className={`w-full p-2.5 text-xs rounded-xl transition focus:outline-none focus:ring-1 focus:ring-indigo-500/45 ${
                                darkMode ? 'bg-slate-900 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-900'
                              }`}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 select-none block mb-0.5">Max price (৳)</span>
                            <input
                              type="number"
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(parseInt(e.target.value) || 2000)}
                              className={`w-full p-2.5 text-xs rounded-xl transition focus:outline-none focus:ring-1 focus:ring-indigo-500/45 ${
                                darkMode ? 'bg-slate-900 border border-slate-800 text-slate-200' : 'bg-slate-50 border border-slate-200 text-slate-900'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sorting filter options */}
                      <div>
                        <span className={`font-semibold block mb-2 font-mono uppercase tracking-wider text-[10px] ${
                          darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>Catalog sorting order:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className={`w-full p-2.5 rounded-xl text-xs transition focus:outline-none ${
                            darkMode ? 'bg-slate-900 border border-slate-800 text-slate-300' : 'bg-slate-50 border border-slate-200 text-slate-700'
                          }`}
                        >
                          <option value="newest">New Arrivals</option>
                          <option value="popular">Popularity ratings</option>
                          <option value="price_asc">Price: Low to High</option>
                          <option value="price_desc">Price: High to Low</option>
                        </select>
                      </div>

                      {/* Categories filter list */}
                      <div>
                        <span className={`font-semibold block mb-2 font-mono uppercase tracking-wider text-[10px] ${
                          darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>Nested categories:</span>
                        <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                          <button
                            onClick={() => setSelectedCategory(null)}
                            className={`w-full text-left p-2 rounded-xl transition-all duration-150 ${
                              selectedCategory === null 
                                ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-bold' : 'bg-indigo-50 text-indigo-600 font-bold') 
                                : (darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-900/40' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/70')
                            }`}
                          >
                            All Categories
                          </button>
                          {categories.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => setSelectedCategory(cat.id)}
                              className={`w-full text-left p-2 rounded-xl transition-all duration-150 truncate ${
                                selectedCategory === cat.id 
                                  ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-bold' : 'bg-indigo-50 text-indigo-650 font-bold') 
                                  : (darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-900/40' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/70')
                              }`}
                            >
                              • {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Brands list */}
                      <div>
                        <span className={`font-semibold block mb-2 font-mono uppercase tracking-wider text-[10px] ${
                          darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>Available brands:</span>
                        <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                          <button
                            onClick={() => setSelectedBrand(null)}
                            className={`w-full text-left p-2 rounded-xl transition-all duration-150 ${
                              selectedBrand === null 
                                ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-bold' : 'bg-indigo-50 text-indigo-650 font-bold') 
                                : (darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-900/40' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/70')
                            }`}
                          >
                            All Brands
                          </button>
                          {brands.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => setSelectedBrand(b.id)}
                              className={`w-full text-left p-2 rounded-xl transition-all duration-150 truncate ${
                                selectedBrand === b.id 
                                  ? (darkMode ? 'bg-indigo-950/40 text-indigo-400 font-bold' : 'bg-indigo-50 text-indigo-650 font-bold') 
                                  : (darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-900/40' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/70')
                              }`}
                            >
                              {b.logo} {b.name}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                  
                  {/* Shopping cart summary sidebar pane */}
                  <div className={`border p-5 rounded-3xl transition duration-150 ${
                    darkMode ? 'bg-slate-950/80 border-slate-900' : 'bg-white border-slate-200 shadow-sm'
                  }`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider flex items-center justify-between mb-4">
                      <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-indigo-500" /> Cart Summary</span>
                      <span className={`font-mono ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>({cart.length}) items</span>
                    </h3>

                    {cart.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 text-center">Your shopping cart is currently empty. Add products to activate checkout flow.</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="max-h-56 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                          {cart.map((item) => {
                            const activeImg = item.product.images.split(',')[0];
                            const itemPrice = item.variant?.price || item.product.discountedPrice || item.product.price;
                            return (
                              <div key={item.id} className="pt-2 flex items-center justify-between text-xs font-sans gap-2">
                                <div className="flex items-center gap-2">
                                  <img src={activeImg} alt="" className={`w-8 h-8 rounded-lg object-cover shrink-0 ${
                                    darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-200'
                                  }`} />
                                  <div className="min-w-0">
                                    <p className={`font-semibold truncate max-w-[100px] ${
                                      darkMode ? 'text-slate-250' : 'text-slate-900'
                                    }`}>{item.product.name}</p>
                                    <span className="text-[10px] text-slate-500 font-mono">৳{itemPrice} • qty: {item.quantity}</span>
                                  </div>
                                </div>
                                <button onClick={() => handleRemoveFromCart(item.id)} className="text-slate-400 hover:text-indigo-650 font-bold font-mono text-sm px-1.5 transition">×</button>
                              </div>
                            );
                          })}
                        </div>

                        <div className={`pt-3 border-t space-y-3 font-mono text-xs ${
                          darkMode ? 'border-slate-850' : 'border-slate-100'
                        }`}>
                          <div className="flex justify-between font-bold">
                            <span>Subtotal:</span>
                            <span className="text-emerald-500">৳{getCartSubtotal().toFixed(2)}</span>
                          </div>
                          
                          <button
                            onClick={() => {
                              setIsCheckoutOpen(true);
                              setCheckoutStep(1);
                            }}
                            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-505 hover:to-violet-550 font-bold text-white text-xs rounded-xl tracking-wider transition uppercase shadow-sm"
                          >
                            Proceed to Checkout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </aside>

                {/* CENTRAL CATALOG PRODUCTS bento grids */}
                <div className="lg:col-span-3 space-y-6">
                  {catalogLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className={`border p-4 rounded-3xl animate-pulse h-80 space-y-4 ${
                          darkMode ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-200'
                        }`}>
                          <div className={`w-full aspect-video rounded-2xl ${darkMode ? 'bg-slate-950' : 'bg-slate-100'}`} />
                          <div className={`w-1/2 h-4 rounded ${darkMode ? 'bg-slate-950' : 'bg-slate-100'}`} />
                          <div className={`w-1/3 h-4 rounded ${darkMode ? 'bg-slate-950' : 'bg-slate-100'}`} />
                        </div>
                      ))}
                    </div>
                  ) : products.length === 0 ? (
                    <div className={`p-16 border rounded-3xl text-center ${
                      darkMode ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200 shadow-xs'
                    }`}>
                      <p className="text-sm text-slate-500">No active products match your filter parameters. Try clearing queries.</p>
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory(null);
                          setSelectedBrand(null);
                          setMinPrice(0);
                          setMaxPrice(2000);
                        }}
                        className="px-5 py-2 mt-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl text-xs uppercase cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {products.map((prod) => {
                          const primaryImg = prod.images.split(',')[0];
                          const cat = categories.find(c => c.id === prod.categoryId)?.name || 'E-Shop Direct';
                          return (
                            <div 
                              key={prod.id}
                              className={`border rounded-3xl overflow-hidden transition-all duration-300 flex flex-col justify-between ${
                                darkMode 
                                  ? 'bg-slate-900/35 border-slate-900/80 hover:border-slate-805 hover:bg-slate-900/60 shadow-lg' 
                                  : 'bg-white border-slate-200 hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)] hover:-translate-y-0.5'
                              }`}
                            >
                              <div onClick={() => viewProductDetails(prod.slug)} className="cursor-pointer group relative">
                                <div className="aspect-video bg-slate-900 overflow-hidden relative rounded-t-3xl">
                                  <img 
                                    src={primaryImg} 
                                    alt="" 
                                    className="w-full h-full object-cover transition duration-500 group-hover:scale-103" 
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div className="p-5 space-y-2.5">
                                  <span className={`text-[9px] uppercase tracking-widest font-mono block ${
                                    darkMode ? 'text-indigo-400' : 'text-indigo-600 font-semibold'
                                  }`}>{cat}</span>
                                  <h4 className={`font-bold truncate font-sans text-sm ${
                                    darkMode ? 'text-slate-205' : 'text-slate-850'
                                  }`}>{prod.name}</h4>
                                  <div className="flex items-center gap-1.5 text-amber-500 font-mono text-[10px] font-bold">
                                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                                    <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{prod.ratingAverage} ({prod.ratingCount})</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className={`p-5 pt-0 flex items-center justify-between border-t ${
                                darkMode ? 'border-slate-850/40' : 'border-slate-100'
                              }`}>
                                <div className="font-mono">
                                  <span className={`font-black text-[15px] block ${
                                    darkMode ? 'text-indigo-400' : 'text-indigo-650'
                                  }`}>
                                    ৳{prod.discountedPrice || prod.price}
                                  </span>
                                  {prod.discountedPrice && (
                                    <span className="text-[9px] text-slate-500 line-through">৳{prod.price}</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleAddToCart(prod.id)}
                                  className={`px-3 py-2 text-[11px] font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer font-mono ${
                                    darkMode 
                                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                                      : 'bg-slate-900 hover:bg-indigo-600 text-white'
                                  }`}
                                >
                                  <ShoppingCart className="w-3.5 h-3.5" />
                                  Add to Cart
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination buttons */}
                      {totalProducts > 12 && (
                        <div className={`py-4 border-t flex justify-center items-center gap-2 font-mono text-xs ${
                          darkMode ? 'border-slate-850' : 'border-slate-150'
                        }`}>
                          <button
                            disabled={catalogPage === 1}
                            onClick={() => setCatalogPage(prev => Math.max(1, prev - 1))}
                            className={`px-3 py-1.5 border rounded-lg hover:text-indigo-500 disabled:opacity-40 transition ${
                              darkMode ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200'
                            }`}
                          >
                            Previous
                          </button>
                          <span className={`px-4 py-1.5 font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>Page {catalogPage}</span>
                          <button
                            disabled={products.length < 12}
                            onClick={() => setCatalogPage(prev => prev + 1)}
                            className={`px-3 py-1.5 border rounded-lg hover:text-indigo-500 disabled:opacity-40 transition ${
                              darkMode ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200'
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>
            ) : currentScreen === 'wishlist' ? (
              <div className="space-y-6 max-w-4xl mx-auto animate-fade-in font-sans">
                <h3 className={`text-md font-bold tracking-tight uppercase font-serif ${
                  darkMode ? 'text-white' : 'text-slate-900'
                }`}>Shoppers Wishlist ({wishlist.length})</h3>
                {wishlist.length === 0 ? (
                  <div className={`border p-12 rounded-3xl text-center ${
                    darkMode ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200'
                  }`}>
                    <p className="text-slate-500 text-xs font-mono">Your wishlist is currently blank.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {wishlist.map((item) => (
                      <div key={item.id} className={`border p-4 rounded-3xl flex flex-col justify-between ${
                        darkMode ? 'bg-slate-950/70 border-slate-850' : 'bg-white border-slate-200 shadow-xs'
                      }`}>
                        <div>
                          <img src={item.product.images.split(',')[0]} alt="" className="w-full aspect-video object-cover rounded-2xl" referrerPolicy="no-referrer" />
                          <h4 className={`font-semibold text-xs mt-2 truncate ${darkMode ? 'text-slate-200' : 'text-slate-850'}`}>{item.product.name}</h4>
                          <span className={`font-bold font-mono text-xs block mt-1 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>৳{item.product.price}</span>
                        </div>
                        <div className={`flex gap-2 mt-4 pt-4 border-t font-mono text-xs ${
                          darkMode ? 'border-slate-850/50' : 'border-slate-100'
                        }`}>
                          <button 
                            onClick={() => handleAddToCart(item.product.id)}
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-center text-white font-bold transition"
                          >
                            AddToCart
                          </button>
                          <button
                            onClick={() => handleToggleWishlist(item.product.id)}
                            className={`p-2 rounded-xl border font-bold transition ${
                              darkMode ? 'bg-slate-900 border-slate-800 text-rose-450 hover:bg-slate-800' : 'bg-red-50 border-red-100 text-rose-600 hover:bg-red-100'
                            }`}
                          >
                            Erase
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : currentScreen === 'orders' ? (
              <div className="space-y-6 max-w-4xl mx-auto animate-fade-in font-sans">
                <h3 className="text-md font-bold tracking-tight text-white uppercase font-sans">Order tracking logs</h3>
                {ordersHistory.length === 0 ? (
                  <div className="p-12 bg-slate-950 border border-slate-850 rounded-2xl text-center">
                    <p className="text-slate-500 font-mono text-xs">You have completely clear order history directories.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ordersHistory.map((ord) => (
                      <details key={ord.id} className="group bg-slate-950 border border-slate-850 rounded-xl p-5 cursor-pointer">
                        <summary className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 select-none">
                          <div>
                            <span className="font-bold text-slate-200 font-mono">{ord.orderNumber}</span>
                            <p className="text-[10px] text-slate-500 mt-0.5">{new Date(ord.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] uppercase font-bold font-mono">
                            <span className={`px-2 py-0.5 rounded ${
                              ord.status === 'delivered' ? 'bg-emerald-950 text-emerald-400' :
                              ord.status === 'cancelled' ? 'bg-rose-955 text-rose-450' : 'bg-orange-950 text-orange-400'
                            }`}>
                              {ord.status}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-900 text-slate-400 rounded">
                              {ord.paymentStatus}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-950 text-indigo-400 rounded">
                              ৳{ord.totalAmount}
                            </span>
                          </div>
                        </summary>

                        <div className="mt-4 pt-4 border-t border-slate-900 cursor-default space-y-4 font-mono text-xs">
                          {/* Shipping Details */}
                          <div className="p-3 bg-slate-900 rounded-lg">
                            <span className="block font-bold text-slate-400 font-sans uppercase mb-1 text-[10px]">Tracking and shipping:</span>
                            <p>Cargo Tracking Code: <span className="text-indigo-400">{ord.trackingNumber || 'PROVISIONING'}</span></p>
                            <p className="font-sans text-slate-500 text-[11px] mt-1">Status changes are instantaneous. Check your email inbox for automatic reminders.</p>
                          </div>

                          {/* Order actions (cancel / refund) */}
                          <div className="flex gap-2">
                            {ord.status === 'pending' && (
                              <button
                                onClick={() => handleCancelOrder(ord.id)}
                                className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-400 rounded font-bold"
                              >
                                Cancel Order
                              </button>
                            )}
                            {ord.status === 'delivered' && (
                              <button
                                onClick={() => handleReturnOrder(ord.id)}
                                className="px-3 py-1.5 bg-indigo-950 hover:bg-slate-900 text-indigo-400 rounded border border-indigo-900/30"
                              >
                                File Instant Return Refund
                              </button>
                            )}
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            ) : currentScreen === 'support' ? (
              <div className="max-w-4xl mx-auto animate-fade-in">
                <SupportSection token={authToken} showToast={showToast} darkMode={darkMode} />
              </div>
            ) : null}

          </div>

          {/* ACTIVE CHECKOUT Funnel MODAL DRAWER */}
          {isCheckoutOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-end">
              <div className="bg-slate-950 border-l border-slate-800 w-full max-w-lg h-full text-slate-200 flex flex-col justify-between font-sans shadow-2xl animate-slide-in">
                
                {/* Header checkout */}
                <div className="p-6 border-b border-slate-850 flex items-center justify-between bg-slate-950">
                  <div>
                    <h5 className="font-bold text-md text-white tracking-tight uppercase flex items-center gap-2">
                      <Truck className="w-5 h-5 text-rose-500" /> secure Transaction Checkout
                    </h5>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Verified SSL payment integration gateway</p>
                  </div>
                  <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-6 h-6 animate-spin-hover" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {checkoutStep === 1 && (
                    <div className="space-y-4 animate-fade-in text-xs">
                      <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Step 1: Pick Shipping Address</h4>
                      
                      {addresses.length === 0 ? (
                        <p className="text-slate-500 italic">No delivery address saved found.</p>
                      ) : (
                        <div className="space-y-2">
                          {addresses.map((a) => (
                            <div
                              key={a.id}
                              onClick={() => setSelectedAddressId(a.id)}
                              className={`p-3.5 rounded-xl border cursor-pointer text-left transition ${
                                selectedAddressId === a.id 
                                  ? 'bg-rose-950/20 border-rose-500 text-slate-200' 
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-900/50'
                              }`}
                            >
                              <span className="font-bold text-white block mb-0.5">{a.title} {a.isDefault && <span className="text-[9px] bg-rose-600 px-1.5 rounded ml-1 text-white uppercase font-bold">Default</span>}</span>
                              <p className="text-xs">{a.addressLine}, {a.city}, {a.state} {a.postalCode}</p>
                              <span className="text-[10.5px] italic text-slate-500 block mt-1">Country: {a.country}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Address button */}
                      {!showAddressForm ? (
                        <button
                          onClick={() => setShowAddressForm(true)}
                          className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:text-white text-xs font-semibold"
                        >
                          + Create New Address card
                        </button>
                      ) : (
                        <form onSubmit={handleCreateAddress} className="space-y-3 bg-slate-950 border border-slate-850 p-4 rounded-xl">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-slate-500 font-bold uppercase">Address title (Label)</label>
                              <input
                                type="text" required placeholder="e.g. Home, Work"
                                value={newAddressForm.title}
                                onChange={(e) => setNewAddressForm({ ...newAddressForm, title: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-200 text-xs"
                              />
                            </div>
                            <div>
                              <input
                                type="text" required placeholder="Address Line"
                                value={newAddressForm.addressLine}
                                onChange={(e) => setNewAddressForm({ ...newAddressForm, addressLine: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-200 text-xs mt-4"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text" required placeholder="City"
                              value={newAddressForm.city}
                              onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                              className="bg-slate-900 border border-slate-800 p-2 rounded text-slate-200 text-xs"
                            />
                            <input
                              type="text" required placeholder="State"
                              value={newAddressForm.state}
                              onChange={(e) => setNewAddressForm({ ...newAddressForm, state: e.target.value })}
                              className="bg-slate-900 border border-slate-800 p-2 rounded text-slate-200 text-xs"
                            />
                            <input
                              type="text" required placeholder="Postal Code"
                              value={newAddressForm.postalCode}
                              onChange={(e) => setNewAddressForm({ ...newAddressForm, postalCode: e.target.value })}
                              className="bg-slate-900 border border-slate-800 p-2 rounded text-slate-200 text-xs font-mono"
                            />
                          </div>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-rose-600 rounded text-xs text-white font-bold cursor-pointer"
                          >
                            Save Address profile
                          </button>
                        </form>
                      )}

                      <div className="pt-4 border-t border-slate-900">
                        <button
                          disabled={!selectedAddressId}
                          onClick={() => setCheckoutStep(2)}
                          className="w-full py-3 bg-rose-600 hover:bg-rose-500 font-bold text-white rounded-lg transition disabled:opacity-45"
                        >
                          Continue to Payment
                        </button>
                      </div>
                    </div>
                  )}

                  {checkoutStep === 2 && (
                    <div className="space-y-6 animate-fade-in text-xs font-sans">
                      <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Step 2: Payment Portal Methods</h4>
                      
                      {/* BD simulated payment options */}
                      <div className="grid grid-cols-1 gap-2.5">
                        {[
                          { id: 'cod', title: 'Cash On Delivery (COD)', desc: 'Inspect packages physically before paying.' },
                          { id: 'card', title: 'SSLCommerz (Credit / Debit Card)', desc: 'Visa, MasterCard, Amex secure simulation gateway encryption.' },
                          { id: 'bkash', title: 'bKash mobile wallet', desc: 'Instant OTP simulation cellular payment.' },
                          { id: 'nagad', title: 'Nagad digital wallet', desc: '0% extra fees instant payment processing.' },
                        ].map((m) => (
                          <div
                            key={m.id}
                            onClick={() => setCheckoutPaymentMethod(m.id as any)}
                            className={`p-3 rounded-xl border cursor-pointer text-left transition ${
                              checkoutPaymentMethod === m.id 
                                ? 'bg-rose-950/20 border-rose-500 text-slate-200' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-900/50'
                            }`}
                          >
                            <span className="font-bold text-white block mb-0.5">{m.title}</span>
                            <p className="text-[11px] text-slate-550">{m.desc}</p>
                          </div>
                        ))}
                      </div>

                      {/* Promo coupon inputs checks */}
                      <div className="p-4 bg-slate-900 border border-slate-850 rounded-xl">
                        <span className="font-bold font-mono uppercase text-[10px] block mb-2 text-slate-400">Coupon Code bonus:</span>
                        <form onSubmit={handleValidateCoupon} className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. WELCOME10, EID500"
                            value={couponCodeInput}
                            onChange={(e) => setCouponCodeInput(e.target.value)}
                            className="bg-slate-950 border border-slate-800 p-2 rounded text-slate-200 text-xs font-mono uppercase focus:ring-1 focus:ring-rose-500 focus:outline-none"
                          />
                          <button type="submit" className="px-3 bg-slate-800 border-rose-950 hover:bg-slate-700 text-white font-bold rounded">Apply</button>
                        </form>
                      </div>

                      {/* Summary checks */}
                      <div className="font-mono bg-slate-950 border border-slate-850 p-4 rounded-xl divide-y divide-slate-900">
                        <div className="flex justify-between py-1 px-1">
                          <span>Basket Subtotal:</span>
                          <span>৳{getCartSubtotal().toFixed(2)}</span>
                        </div>
                        {appliedCoupon && (
                          <div className="flex justify-between py-1 text-rose-450 px-1">
                            <span>Coupon Discount:</span>
                            <span>-৳{appliedCoupon.calculatedDiscount}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-1 px-1 text-slate-450">
                          <span>Shipping fees:</span>
                          <span>৳{getCartSubtotal() > 500 ? '0.00' : '15.00'}</span>
                        </div>
                        <div className="flex justify-between py-1 px-1 text-slate-450">
                          <span>Govt Tax (5%):</span>
                          <span>৳{(getCartSubtotal() * 0.05).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between py-2 font-black text-rose-500 text-sm px-1">
                          <span>Grand Total Due:</span>
                          <span>৳{getWeightyGrandTotal()}</span>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4 border-t border-slate-900">
                        <button
                          onClick={() => setCheckoutStep(1)}
                          className="px-4 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-300 font-semibold rounded-lg"
                        >
                          Go Back
                        </button>
                        <button
                          onClick={handlePlaceOrder}
                          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs rounded-lg transition uppercase tracking-wide cursor-pointer"
                        >
                          Submit Order Transaction
                        </button>
                      </div>
                    </div>
                  )}

                  {checkoutStep === 3 && lastPlacedOrder && (
                    <div className="space-y-6 animate-fade-in text-center py-8">
                      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900/50 flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-md font-bold text-white uppercase tracking-wider">Transaction successful!</h4>
                        <p className="text-xs text-slate-400 mt-2">Your packing team has been dispatched.</p>
                      </div>
                      
                      <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-2 text-xs font-mono text-left">
                        <p>Order Serial #: <span className="text-slate-200 font-bold">{lastPlacedOrder.orderNumber}</span></p>
                        <p>Freight tracking: <span className="text-rose-400 font-bold">{lastPlacedOrder.trackingNumber}</span></p>
                        <p>Loyalty pts earned: <span className="text-amber-500 font-bold">+{lastPlacedOrder.loyaltyPointsEarned} pts</span></p>
                      </div>

                      <button
                        onClick={() => {
                          setIsCheckoutOpen(false);
                          setCurrentScreen('orders');
                        }}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 font-bold text-white rounded-lg uppercase text-xs"
                      >
                        Track Shipment elements
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* FLOATING ACTION CART LAUNCHER */}
          {!isCartOpen && !isCheckoutOpen && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-tr from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center border border-indigo-500/10"
              title="Open Cart Box"
            >
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-mono text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                  {cart.length}
                </span>
              )}
            </button>
          )}

          {/* ACTIVE GLOBAL CART BOX DRAWER */}
          {isCartOpen && (
            <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-end animate-fade-in">
              {/* Drawer Backdrop Close */}
              <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />
              
              <div className={`relative w-full max-w-md h-full flex flex-col justify-between font-sans shadow-2xl animate-slide-in border-l transition duration-200 ${
                darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                
                {/* Header */}
                <div className={`p-6 border-b flex items-center justify-between ${
                  darkMode ? 'border-slate-850 bg-slate-950' : 'border-slate-100 bg-slate-50'
                }`}>
                  <div>
                    <h5 className={`font-bold text-md tracking-tight uppercase flex items-center gap-2 font-serif ${
                      darkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      <ShoppingCart className="w-5 h-5 text-indigo-500" /> Active Cart Box
                    </h5>
                    <p className={`text-[10px] font-mono mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Manage item counts and review subtotals</p>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className={`focus:outline-none transition cursor-pointer ${
                    darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}>
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {!authToken ? (
                    <div className="text-center py-10 space-y-3">
                      <p className="text-xs text-slate-500">You must sign in with Google to use the Shopping Cart.</p>
                      <button
                        onClick={() => { setIsCartOpen(false); handleLogin(); }}
                        className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl uppercase transition cursor-pointer"
                      >
                        Authenticate Login
                      </button>
                    </div>
                  ) : cart.length === 0 ? (
                    <div className="text-center py-16 space-y-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
                        darkMode ? 'bg-slate-900 border border-slate-800 text-slate-400' : 'bg-slate-100 border border-slate-150 text-slate-500'
                      }`}>
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-slate-500">Your shopping cart is currently blank.</p>
                      <button
                        onClick={() => setIsCartOpen(false)}
                        className="text-xs text-indigo-500 hover:underline block mx-auto py-1 font-semibold cursor-pointer"
                      >
                        ← Keep Browsing Products
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((item) => {
                        const activeImg = item.product.images.split(',')[0];
                        const itemPrice = item.variant?.price || item.product.discountedPrice || item.product.price;
                        return (
                          <div 
                            key={item.id} 
                            className={`p-4 rounded-2xl border flex items-center gap-4 transition ${
                              darkMode ? 'bg-slate-900/40 border-slate-850' : 'bg-slate-50 border-slate-200 shadow-xs'
                            }`}
                          >
                            <img 
                              src={activeImg} 
                              alt="" 
                              className={`w-14 h-14 rounded-xl object-cover shrink-0 ${
                                darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'
                              }`} 
                              referrerPolicy="no-referrer"
                            />
                            
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-bold text-xs truncate ${
                                darkMode ? 'text-slate-205' : 'text-slate-800'
                              }`}>{item.product.name}</h4>
                              
                              {item.variant && (
                                <span className="text-[10px] text-indigo-400 font-mono block">Variant: {item.variant.name}</span>
                              )}
                              
                              <p className={`font-extrabold text-xs font-mono mt-1 ${
                                darkMode ? 'text-indigo-400' : 'text-indigo-650'
                              }`}>
                                ৳{itemPrice} <span className="text-xs text-slate-400 font-normal">/ unit</span>
                              </p>

                              {/* QUANTITY CONTROLS */}
                              <div className="flex items-center gap-2.5 mt-2">
                                <button
                                  onClick={() => {
                                    if (item.quantity === 1) {
                                      handleRemoveFromCart(item.id);
                                    } else {
                                      handleUpdateCartQty(item.id, item.quantity - 1);
                                    }
                                  }}
                                  className={`w-6 h-6 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center border cursor-pointer focus:outline-none ${
                                    darkMode ? 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  title="Reduce quantity"
                                >
                                  -
                                </button>
                                <span className="font-mono text-xs font-bold w-4 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => handleUpdateCartQty(item.id, item.quantity + 1)}
                                  className={`w-6 h-6 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center border cursor-pointer focus:outline-none ${
                                    darkMode ? 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  title="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* REMOVE BUTTON */}
                            <button
                              onClick={() => handleRemoveFromCart(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition mt-auto focus:outline-none cursor-pointer"
                              title="Delete item from cart"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer totals & action */}
                {authToken && cart.length > 0 && (
                  <div className={`p-6 border-t ${
                    darkMode ? 'border-slate-850 bg-slate-950' : 'border-slate-100 bg-slate-50'
                  }`}>
                    <div className="space-y-1.5 mb-6">
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>Items Cart Subtotal:</span>
                        <span className="font-mono text-sm font-semibold">৳{getCartSubtotal().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center font-bold">
                        <span>Grand Subtotal (excl. VAT):</span>
                        <span className={`font-mono text-md ${
                          darkMode ? 'text-indigo-400' : 'text-indigo-650'
                        }`}>৳{getCartSubtotal().toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsCartOpen(false)}
                        className={`px-4 py-3 border rounded-xl text-center text-xs font-semibold select-none flex-1 transition cursor-pointer ${
                          darkMode ? 'bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800' : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        Keep Shopping
                      </button>
                      <button
                        onClick={() => {
                          setIsCartOpen(false);
                          setIsCheckoutOpen(true);
                          setCheckoutStep(1);
                        }}
                        className="py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-550 hover:to-violet-550 font-bold text-white text-xs rounded-xl tracking-wider uppercase transition flex-1 text-center shadow-lg cursor-pointer"
                      >
                        Checkout Now
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </>
      )}

    </div>
  );
}
