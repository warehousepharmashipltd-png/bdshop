import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, BarChart2, Users, ShoppingBag, Plus, Save,
  Trash2, FileText, CheckCircle, Clock, AlertTriangle, X, 
  Settings, Award, RefreshCw, Key, Shield, Eye, EyeOff
} from 'lucide-react';
import { Product, Order, User, Coupon, AuditLog, Category, Brand } from '../types.ts';

interface AdminPanelProps {
  token: string | null;
  adminUser: User;
  onBackToStore: () => void;
  categories: Category[];
  brands: Brand[];
  showToast: (msg: string, type?: 'success' | 'err') => void;
  refreshTaxonomy: () => Promise<void>;
}

export default function AdminPanel({ token, adminUser, onBackToStore, categories, brands, showToast, refreshTaxonomy }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'customers' | 'coupons' | 'audit_logs'>('dashboard');
  
  // Dashboard states
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Lists states
  const [productList, setProductList] = useState<Product[]>([]);
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [customerList, setCustomerList] = useState<User[]>([]);
  const [couponList, setCouponList] = useState<Coupon[]>([]);

  // Modals / Form States
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [viewingInvoiceOrder, setViewingInvoiceOrder] = useState<Order | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

  // New Coupon Form
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 100,
    active: true,
  });

  // Force loading stats
  const fetchStatsAndInfo = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        const err = await response.json();
        showToast(err.error || 'Failed to load executive statistics.', 'err');
      }
    } catch (e) {
      showToast('Analytics platform offline.', 'err');
    } finally {
      setLoadingStats(false);
    }
  };

  // Products CRUD fetching
  const refreshProducts = async () => {
    try {
      // Catalog includes all elements
      const res = await fetch('/api/catalog?limit=50');
      if (res.ok) {
        const data = await res.json();
        setProductList(data.products || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrderList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshCustomers = async () => {
    try {
      const res = await fetch('/api/admin/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStatsAndInfo();
      refreshProducts();
      refreshOrders();
      refreshCustomers();
    }
  }, [token]);

  // Add Category Modal / Form States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatParentId, setNewCatParentId] = useState<number | null>(null);

  // Add Brand Modal / Form States
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandSlug, setNewBrandSlug] = useState('');
  const [newBrandDesc, setNewBrandDesc] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('');

  // Handle Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      showToast('Name is a required field', 'err');
      return;
    }
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCatName.trim(),
          slug: newCatSlug.trim() || undefined,
          description: newCatDesc.trim() || undefined,
          parentId: newCatParentId,
        })
      });
      if (res.ok) {
        showToast('Successfully appended a new category!', 'success');
        setIsCategoryModalOpen(false);
        setNewCatName('');
        setNewCatSlug('');
        setNewCatDesc('');
        setNewCatParentId(null);
        await refreshTaxonomy();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to construct category', 'err');
      }
    } catch (err) {
      showToast('Error crafting category database entry', 'err');
    }
  };

  // Handle Create Brand
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) {
      showToast('Name is a required field', 'err');
      return;
    }
    try {
      const res = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newBrandName.trim(),
          slug: newBrandSlug.trim() || undefined,
          description: newBrandDesc.trim() || undefined,
          logo: newBrandLogo.trim() || undefined,
        })
      });
      if (res.ok) {
        showToast('Successfully appended a new brand!', 'success');
        setIsBrandModalOpen(false);
        setNewBrandName('');
        setNewBrandSlug('');
        setNewBrandDesc('');
        setNewBrandLogo('');
        await refreshTaxonomy();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to construct brand', 'err');
      }
    } catch (err) {
      showToast('Error crafting brand database entry', 'err');
    }
  };

  // Handle Save (Create / Update) Catalog items
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.slug || editingProduct?.price === undefined) {
      showToast('Please fulfill the core product properties.', 'err');
      return;
    }

    const method = editingProduct.id ? 'PUT' : 'POST';
    const url = editingProduct.id 
      ? `/api/admin/products/${editingProduct.id}` 
      : '/api/admin/products';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingProduct)
      });
      
      const resData = await res.json();
      if (res.ok) {
        showToast(editingProduct.id ? 'Product parameters saved!' : 'Product uploaded to marketplace!', 'success');
        setIsProductModalOpen(false);
        setEditingProduct(null);
        refreshProducts();
        fetchStatsAndInfo();
      } else {
        showToast(resData.error || 'Server rejected product configuration.', 'err');
      }
    } catch (err) {
      showToast('Failed to connect to database API.', 'err');
    }
  };

  // Erase products
  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Are you absolutely sure you want to delete this product listing from storage?')) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        showToast('Product erased from registry.', 'success');
        refreshProducts();
        fetchStatsAndInfo();
      } else {
        showToast('Removal rejected by permissions rules.', 'err');
      }
    } catch (e) {
      showToast('Failed to execute delete.', 'err');
    }
  };

  // Change Customer statuses or administrative privileges
  const handleUpdateCustomer = async (uid: string, status: string, role: string) => {
    try {
      const res = await fetch(`/api/admin/customers/${uid}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, role })
      });
      if (res.ok) {
        showToast('Customer directory card updated!', 'success');
        refreshCustomers();
        fetchStatsAndInfo();
      } else {
        showToast('Failed to modify user.', 'err');
      }
    } catch (e) {
      showToast('Network connection failed.', 'err');
    }
  };

  // Alter Order Statuses
  const handleUpdateOrderStatus = async (id: number, status: string, paymentStatus?: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, paymentStatus })
      });
      if (res.ok) {
        showToast('Order database record modified.', 'success');
        refreshOrders();
        fetchStatsAndInfo();
      } else {
        showToast('Status change declined.', 'err');
      }
    } catch (e) {
      showToast('Transaction portal error.', 'err');
    }
  };

  // Create Campaign Coupons
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code) return;
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCoupon)
      });
      if (res.ok) {
        showToast('Enterprise code campaign listed!', 'success');
        setNewCoupon({ code: '', discountType: 'percentage', discountValue: 10, minOrderAmount: 100, active: true });
        fetchStatsAndInfo();
      } else {
        const r = await res.json();
        showToast(r.error || 'Failed to generate code.', 'err');
      }
    } catch (e) {
      showToast('Catalog offline.', 'err');
    }
  };

  // Invoice display setup
  const viewInvoice = async (ord: Order) => {
    try {
      const res = await fetch(`/api/orders/${ord.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setViewingInvoiceOrder(ord);
        setInvoiceItems(data.items || []);
      }
    } catch (e) {
      showToast('Failed to fetch detailed billing elements.', 'err');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Admin header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-600 rounded-lg text-white">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Console System Control</h1>
            <p className="text-xs text-rose-400 font-mono">Enterprise Console • {adminUser.role.toUpperCase()}: {adminUser.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchStatsAndInfo}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button 
            onClick={onBackToStore}
            className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 font-medium transition"
          >
            Exit Control Room
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 bg-slate-950 border-r border-slate-800 p-4 shrink-0 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible">
          {[
            { id: 'dashboard', label: 'Overview Metrics', icon: BarChart2 },
            { id: 'products', label: 'E-Shop Products', icon: ShoppingBag },
            { id: 'orders', label: 'System Orders', icon: FileText },
            { id: 'customers', label: 'User Directory', icon: Users },
            { id: 'coupons', label: 'Coupon Campaigns', icon: Award },
            { id: 'audit_logs', label: 'Security Audits', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition whitespace-nowrap md:w-full ${
                  activeTab === tab.id 
                    ? 'bg-rose-950/40 text-rose-400 border border-rose-900/50' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </aside>

        {/* Console Workspace */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {loadingStats ? (
            <div className="h-96 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
              <p className="text-sm text-slate-400 font-mono">Reassembling core databases...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW METRICS */}
              {activeTab === 'dashboard' && stats && (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-mono text-slate-400 uppercase">Gross Revenue</p>
                      <h3 className="text-3xl font-bold font-mono text-emerald-400 mt-2">৳{stats.counters.revenueSum}</h3>
                      <div className="flex items-center gap-1 mt-2 text-xs text-emerald-500">
                        <TrendingUp className="w-3 h-3" />
                        <span>+12.4% vs last week</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-mono text-slate-400 uppercase">Gross Orders</p>
                      <h3 className="text-3xl font-bold font-mono text-white mt-2">{stats.counters.ordersCount}</h3>
                      <div className="flex items-center gap-1 mt-2 text-xs text-rose-400">
                        <span>All channels total</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-mono text-slate-400 uppercase">Total Shoppers</p>
                      <h3 className="text-3xl font-bold font-mono text-white mt-2">{stats.counters.customersCount}</h3>
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-400 font-mono">
                        <span>Database scale</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-mono text-slate-400 uppercase">Catalog Items</p>
                      <h3 className="text-3xl font-bold font-mono text-white mt-2">{stats.counters.productsCount}</h3>
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                        <span>Active listings</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                      <p className="text-xs font-mono text-slate-400 uppercase">Bonus Coupons</p>
                      <h3 className="text-3xl font-bold font-mono text-indigo-400 mt-2">{stats.counters.couponsCount}</h3>
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                        <span>Active voucher codes</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational stats row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Simulated Sales Chart */}
                    <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-6 rounded-xl">
                      <h3 className="text-sm font-bold font-mono uppercase text-slate-300 mb-6">Gross Sales Performance (UTC)</h3>
                      <div className="h-64 flex items-end justify-between gap-4 pt-4 border-b border-slate-800">
                        {stats.revenueHistory.map((itemValue: any, idx: number) => {
                          const percentageHeight = Math.min(100, Math.max(10, (itemValue.revenue / 7000) * 100));
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end">
                              <span className="text-xs font-mono font-bold text-emerald-400 opacity-0 group-hover:opacity-100 transition duration-150 mb-1">
                                ৳{itemValue.revenue}
                              </span>
                              <div 
                                style={{ height: `${percentageHeight}%` }} 
                                className="w-full bg-slate-800 group-hover:bg-rose-600 rounded-t-md transition duration-300 relative"
                              >
                                <div className="absolute inset-0 bg-emerald-500 opacity-30 group-hover:opacity-0 rounded-t-md transition duration-300" />
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase">{itemValue.date}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pending Fulfilments & stock warnings */}
                    <div className="space-y-6">
                      <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl">
                        <h3 className="text-sm font-bold font-mono uppercase text-slate-300 mb-4">Pipeline Fulfilments</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                            <span className="text-xs text-slate-300 font-medium">Pending Processing</span>
                            <span className="px-2 py-1 text-xs font-bold font-mono text-orange-400 bg-orange-950/30 rounded-md">
                              {stats.orderStatuses.pending} orders
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                            <span className="text-xs text-slate-300 font-medium">In Transit</span>
                            <span className="px-2 py-1 text-xs font-bold font-mono text-blue-400 bg-blue-950/30 rounded-md">
                              {stats.orderStatuses.shipped + stats.orderStatuses.processing} orders
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                            <span className="text-xs text-slate-300 font-medium">Delivered & Complete</span>
                            <span className="px-2 py-1 text-xs font-bold font-mono text-emerald-400 bg-emerald-950/30 rounded-md">
                              {stats.orderStatuses.delivered} orders
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stock Alerts */}
                      <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl">
                        <h3 className="text-sm font-bold font-mono uppercase text-rose-400 flex items-center gap-2 mb-4">
                          <AlertTriangle className="w-4 h-4" /> Stock Forecasting Alerts
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {stats.stockAlerts.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">Inventory logs are completely healthy.</p>
                          ) : (
                            stats.stockAlerts.map((prod: any) => (
                              <div key={prod.id} className="flex justify-between items-center text-xs p-2 bg-slate-900/50 border border-slate-800 rounded">
                                <span className="text-slate-300 truncate max-w-[150px]">{prod.name}</span>
                                <span className="text-rose-400 font-bold font-mono bg-rose-950/20 px-1.5 py-0.5 rounded border border-rose-900/30">
                                  {prod.stock} units left
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRODUCTS TABLE */}
              {activeTab === 'products' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 p-4 border border-slate-800 rounded-xl">
                    <div>
                      <h4 className="text-md font-bold tracking-tight">Active Online Listings</h4>
                      <p className="text-xs text-slate-400 mt-1 font-mono">Create, update, or remove physical items in checkout databases.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 font-medium flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Category
                      </button>
                      <button
                        onClick={() => setIsBrandModalOpen(true)}
                        className="px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 font-medium flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Brand
                      </button>
                      <button
                        onClick={() => {
                          setEditingProduct({
                            name: '',
                            slug: '',
                            description: '',
                            price: 99.99,
                            discountedPrice: null,
                            stock: 10,
                            categoryId: categories[0]?.id || null,
                            brandId: brands[0]?.id || null,
                            images: '',
                            featured: false,
                            trending: false,
                            newArrival: true,
                          });
                          setIsProductModalOpen(true);
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 rounded-lg text-white font-medium flex items-center gap-2 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add Catalog Product
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 uppercase font-mono tracking-wider">
                            <th className="p-4">SKU/Product details</th>
                            <th className="p-4">Category</th>
                            <th className="p-4">Price / Discount</th>
                            <th className="p-4">Inventory</th>
                            <th className="p-4">Badges</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {productList.map((prod) => {
                            const mainImg = prod.images.split(',')[0];
                            const catName = categories.find(c => c.id === prod.categoryId)?.name || 'Direct';
                            return (
                              <tr key={prod.id} className="hover:bg-slate-900/30 transition">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <img src={mainImg} alt="" className="w-10 h-10 object-cover rounded-md bg-slate-800 border border-slate-700" />
                                    <div>
                                      <p className="font-bold text-slate-200 font-sans text-sm">{prod.name}</p>
                                      <p className="text-[10px] text-slate-500 font-mono truncate max-w-[170px]">slug: {prod.slug}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 text-slate-300 font-sans font-medium">{catName}</td>
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-100">৳{prod.price}</span>
                                    {prod.discountedPrice && (
                                      <span className="text-emerald-400 font-bold">৳{prod.discountedPrice}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs leading-none font-bold ${
                                    prod.stock < 15 
                                      ? 'bg-rose-950 text-rose-400 border border-rose-900/30' 
                                      : 'bg-slate-900 text-slate-300'
                                  }`}>
                                    {prod.stock} left
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-wrap gap-1">
                                    {prod.featured && <span className="bg-amber-950 text-amber-500 px-1.5 py-0.5 rounded text-[9px] font-bold">Featured</span>}
                                    {prod.trending && <span className="bg-teal-950 text-teal-400 px-1.5 py-0.5 rounded text-[9px] font-bold">Trending</span>}
                                    {prod.newArrival && <span className="bg-sky-950 text-sky-400 px-1.5 py-0.5 rounded text-[9px] font-bold">New</span>}
                                  </div>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingProduct(prod);
                                        setIsProductModalOpen(true);
                                      }}
                                      className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(prod.id)}
                                      className="p-2 bg-red-950/40 hover:bg-red-950/80 text-rose-400 rounded border border-red-900/30"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SYSTEM ORDERS */}
              {activeTab === 'orders' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl">
                    <h4 className="text-md font-bold tracking-tight">Purchase Logs and Processing Pipeline</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">Simulate real-time status updates, invoice generation, and refunds.</p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 uppercase font-mono tracking-wider">
                            <th className="p-4">Order Record #</th>
                            <th className="p-4">Checkout Total</th>
                            <th className="p-4">Platform Gateway</th>
                            <th className="p-4">Fulfillment Status</th>
                            <th className="p-4">Payment Registry</th>
                            <th className="p-4 text-right">Controls</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {orderList.map((ord) => (
                            <tr key={ord.id} className="hover:bg-slate-900/30 transition">
                              <td className="p-4 font-bold text-slate-200">
                                <div>
                                  <span>{ord.orderNumber}</span>
                                  <p className="text-[10px] text-slate-500 block font-normal">{new Date(ord.createdAt).toLocaleString()}</p>
                                </div>
                              </td>
                              <td className="p-4 font-bold text-slate-100">৳{ord.totalAmount}</td>
                              <td className="p-4">
                                <span className="uppercase text-[10px] bg-slate-900 px-2 py-1 rounded font-bold">{ord.paymentMethod}</span>
                              </td>
                              <td className="p-4">
                                <select
                                  value={ord.status}
                                  onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value)}
                                  className="bg-slate-900 text-xs text-slate-200 border border-slate-800 font-medium px-2 py-1 rounded focus:outline-none focus:border-rose-500"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="processing">Processing</option>
                                  <option value="shipped">Shipped</option>
                                  <option value="delivered">Delivered</option>
                                  <option value="cancelled">Cancelled</option>
                                  <option value="returned">Returned</option>
                                </select>
                              </td>
                              <td className="p-4">
                                <button
                                  onClick={() => handleUpdateOrderStatus(ord.id, ord.status, ord.paymentStatus === 'paid' ? 'pending' : 'paid')}
                                  className={`px-2 py-1 text-[10px] rounded font-bold cursor-pointer transition ${
                                    ord.paymentStatus === 'paid' 
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' 
                                      : 'bg-orange-950 text-orange-400 border border-orange-900'
                                  }`}
                                >
                                  {ord.paymentStatus.toUpperCase()}
                                </button>
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => viewInvoice(ord)}
                                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 rounded text-xs font-semibold text-white transition flex items-center gap-1.5 ml-auto"
                                >
                                  <FileText className="w-3 h-3" /> View Invoice
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: USER DIRECTORY */}
              {activeTab === 'customers' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl">
                    <h4 className="text-md font-bold tracking-tight">System Account Directory</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">Audit consumer accounts, assign staff permissions levels, or suspend bad actors.</p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 uppercase font-mono tracking-wider">
                            <th className="p-4">User Details</th>
                            <th className="p-4">Contact email</th>
                            <th className="p-4">System Role</th>
                            <th className="p-4">Profile Status</th>
                            <th className="p-4">Loyalty points</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {customerList.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-900/30 transition">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-rose-950/20 text-rose-400 border border-rose-900 flex items-center justify-center font-bold">
                                    {user.name ? user.name[0].toUpperCase() : 'U'}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-200">{user.name}</p>
                                    <p className="text-[9px] text-slate-500">ID: {user.uid}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-slate-300 font-sans">{user.email}</td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  user.role === 'admin' 
                                    ? 'bg-rose-950 text-rose-400 border border-rose-900' 
                                    : user.role === 'staff' 
                                    ? 'bg-blue-950 text-blue-400 border border-blue-900' 
                                    : 'bg-slate-900 text-slate-400'
                                }`}>
                                  {user.role.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  user.status === 'active' 
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' 
                                    : 'bg-red-950 text-red-400 border border-red-900'
                                }`}>
                                  {user.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-4 text-indigo-400 font-bold">{user.loyaltyPoints} pts</td>
                              <td className="p-4 text-right text-slate-300">
                                <div className="flex justify-end gap-2">
                                  {/* Role Toggle Button */}
                                  <button
                                    onClick={() => handleUpdateCustomer(
                                      user.uid, 
                                      user.status, 
                                      user.role === 'admin' ? 'customer' : 'admin'
                                    )}
                                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-850 rounded"
                                  >
                                    Toggle Role
                                  </button>
                                  
                                  {/* Ban / Suspend Button */}
                                  <button
                                    onClick={() => handleUpdateCustomer(
                                      user.uid, 
                                      user.status === 'active' ? 'banned' : 'active', 
                                      user.role
                                    )}
                                    className={`px-2 py-1 rounded font-bold ${
                                      user.status === 'active' 
                                        ? 'bg-red-950/40 text-rose-400 hover:bg-red-950/80 border border-red-900/30' 
                                        : 'bg-slate-900 text-slate-300 border border-slate-800'
                                    }`}
                                  >
                                    {user.status === 'active' ? 'Ban' : 'Unban'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: COUPON VOUCHERS */}
              {activeTab === 'coupons' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                  <div className="lg:col-span-1 bg-slate-950 p-6 border border-slate-800 rounded-xl h-fit">
                    <h4 className="text-md font-bold tracking-tight mb-4">Create Promo Coupon Campaign</h4>
                    <form onSubmit={handleCreateCoupon} className="space-y-4">
                      <div>
                        <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Coupon Code</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SUMMER50"
                          value={newCoupon.code}
                          onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono text-sm focus:ring-1 focus:ring-rose-500 focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Type</label>
                          <select
                            value={newCoupon.discountType}
                            onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed (৳)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Value</label>
                          <input
                            type="number"
                            required
                            value={newCoupon.discountValue}
                            onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: parseFloat(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Min Order Total (৳)</label>
                        <input
                          type="number"
                          required
                          value={newCoupon.minOrderAmount}
                          onChange={(e) => setNewCoupon({ ...newCoupon, minOrderAmount: parseFloat(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 font-bold transition text-white rounded-lg text-xs mt-2 cursor-pointer"
                      >
                        Publish Promo Code
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-2 bg-slate-950 p-6 border border-slate-800 rounded-xl font-mono">
                    <h4 className="text-md font-bold tracking-tight text-slate-200 mb-4 font-sans">Active Enterprise Vouchers</h4>
                    <div className="space-y-3">
                      {/* Standard Seeder mock coupons display support */}
                      <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-900 rounded font-bold">WELCOME10</span>
                          <p className="text-slate-400 text-xs mt-1.5 font-sans">10% discount | Min Order ৳200</p>
                        </div>
                        <span className="text-xs text-slate-500 font-sans">Active Campaign</span>
                      </div>
                      <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="px-2 py-0.5 bg-teal-950 text-teal-400 border border-teal-900 rounded font-bold">EID500</span>
                          <p className="text-slate-400 text-xs mt-1.5 font-sans">৳500 Flat discount | Min Order ৳2000</p>
                        </div>
                        <span className="text-xs text-slate-500 font-sans">Active Campaign</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: SECURITY AUDITS */}
              {activeTab === 'audit_logs' && (
                <div className="space-y-6 animate-fade-in font-mono">
                  <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl font-sans">
                    <h4 className="text-md font-bold tracking-tight">Console Historical Activity Register</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">Trace secure IP connections, administrative product creation catalogs, bans and toggled roles.</p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 max-h-[500px] overflow-y-auto">
                    {stats.recentLogs.length === 0 ? (
                      <p className="text-xs text-slate-500 italic font-sans p-4 text-center">No control modifications registered inside logs.</p>
                    ) : (
                      stats.recentLogs.map((log: AuditLog) => (
                        <div key={log.id} className="p-3 bg-slate-900/60 border border-slate-850 rounded text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                            <span className="text-rose-400 font-bold max-w-xs">{log.action.toUpperCase()}</span>
                            <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-300 font-mono whitespace-pre-wrap">{log.detail}</p>
                          <div className="mt-2 pt-2 border-t border-slate-850 text-[10px] text-slate-500 flex justify-between">
                            <span>Client User: {log.adminId || 'System'}</span>
                            <span>Mapped Host: {log.ipAddress} • {log.device}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* MODAL 1: PRODUCT BUILDER (CREATE / EDIT) */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-2xl text-slate-100 max-h-[90vh] overflow-y-auto animate-zoom-in">
            <div className="p-6 border-b border-slate-850 flex items-center justify-between">
              <h5 className="text-lg font-bold">{editingProduct.id ? 'Modify Catalog Product' : 'Add Product Listing'}</h5>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Product Name</label>
                  <input
                    type="text" required
                    value={editingProduct.name || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Slug Identifier</label>
                  <input
                    type="text" required
                    value={editingProduct.slug || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, slug: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm font-mono"
                    placeholder="e.g. premium-leather-belt"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Description Paragraph</label>
                <textarea
                  rows={3}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Retail Price (৳)</label>
                  <input
                    type="number" step="0.01" required
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Promo Sale Price (৳)</label>
                  <input
                    type="number" step="0.01"
                    value={editingProduct.discountedPrice || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, discountedPrice: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm font-mono"
                    placeholder="Leave blank"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1 font-mono">Stock Level</label>
                  <input
                    type="number" required
                    value={editingProduct.stock || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Product Category</label>
                  <select
                    value={editingProduct.categoryId || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300"
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Product Brand</label>
                  <select
                    value={editingProduct.brandId || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brandId: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300"
                  >
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1 font-mono">Images URLs (Comma separated)</label>
                <input
                  type="text" required
                  placeholder="https://image-url-1.com,https://image-url-2.com"
                  value={editingProduct.images || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, images: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm font-mono text-slate-300"
                />
              </div>

              {/* Badges row */}
              <div className="flex bg-slate-900 p-3 rounded-lg border border-slate-850 justify-between">
                <span className="text-xs uppercase font-bold text-slate-400 text-center flex items-center">Marketing Flags:</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editingProduct.featured || false} 
                      onChange={(e) => setEditingProduct({ ...editingProduct, featured: e.target.checked })}
                    />
                    <span>Featured</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editingProduct.trending || false} 
                      onChange={(e) => setEditingProduct({ ...editingProduct, trending: e.target.checked })}
                    />
                    <span>Trending</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={editingProduct.newArrival || false} 
                      onChange={(e) => setEditingProduct({ ...editingProduct, newArrival: e.target.checked })}
                    />
                    <span>New Arrival</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs font-bold text-white transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Product Parameters
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INVOICE VIEWER */}
      {viewingInvoiceOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto font-sans p-8 relative animate-zoom-in">
            <button
              onClick={() => setViewingInvoiceOrder(null)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5 animate-spin-hover" />
            </button>
            
            {/* Printable Area */}
            <div className="space-y-6">
              {/* Invoice Title */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div>
                  <h2 className="text-2xl font-black text-rose-600 tracking-tight uppercase">Fullstack E-SHOP</h2>
                  <p className="text-xs text-slate-500 mt-1">Enterprise B2C Sales Fulfilment Systems</p>
                </div>
                <div className="text-right">
                  <h6 className="text-xl font-bold tracking-tight">COMMERCIAL INVOICE</h6>
                  <p className="text-xs text-slate-500 mt-1">Order Ref: <span className="font-mono font-bold text-slate-900">{viewingInvoiceOrder.orderNumber}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold uppercase text-slate-400 block mb-1">Billed To (Firebase Profile):</span>
                  <p className="text-sm font-semibold">{adminUser.name || 'System User'}</p>
                  <p className="text-slate-500 mt-0.5">{viewingInvoiceOrder.userId}</p>
                  <p className="text-slate-500">Contact: {adminUser.email}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold uppercase text-slate-400 block mb-1">Purchase Details:</span>
                  <p className="font-medium mt-0.5">Invoice Date: {new Date(viewingInvoiceOrder.createdAt).toLocaleDateString()}</p>
                  <p className="font-medium">Tracking #: <span className="font-mono">{viewingInvoiceOrder.trackingNumber || 'PENDING'}</span></p>
                  <p className="font-medium uppercase">Gateway: {viewingInvoiceOrder.paymentMethod} ({viewingInvoiceOrder.paymentStatus})</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2.5">Purchased item description</th>
                    <th className="py-2.5 text-center">Qty</th>
                    <th className="py-2.5 text-right">Unit Price</th>
                    <th className="py-2.5 text-right">Ext. Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {invoiceItems.map((itemValue, idx) => (
                    <tr key={idx} className="text-slate-800">
                      <td className="py-3 font-medium">{itemValue.name}</td>
                      <td className="py-3 text-center font-mono">{itemValue.quantity}</td>
                      <td className="py-3 text-right font-mono">৳{itemValue.price}</td>
                      <td className="py-3 text-right font-mono">৳{(itemValue.price * itemValue.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total calculations */}
              <div className="border-t border-slate-200 pt-4 flex justify-end">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Discount code:</span>
                    <span className="font-mono">-৳{viewingInvoiceOrder.discountAmount}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Shipping fee:</span>
                    <span className="font-mono">৳{viewingInvoiceOrder.shippingAmount}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Tax (5%):</span>
                    <span className="font-mono">৳{viewingInvoiceOrder.taxAmount}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold">
                    <span>Total Amount due:</span>
                    <span className="font-mono text-emerald-600">৳{viewingInvoiceOrder.totalAmount}</span>
                  </div>
                </div>
              </div>

              {/* Footer notice */}
              <div className="pt-6 border-t border-slate-150 text-center text-[10px] text-slate-400">
                <p>Thank you for choosing Enterprise E-Commerce. All transactions are secure and encrypted.</p>
                <p className="mt-1">Generated automatically by System Controller • Cloud PostgreSQL Platform API</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CATEGORY CREATION */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-lg text-slate-100 animate-zoom-in">
            <div className="p-6 border-b border-slate-850 flex items-center justify-between">
              <h5 className="text-lg font-bold">Add New Category</h5>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Category Name *</label>
                <input
                  type="text" required
                  placeholder="e.g. Tablets"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Slug Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. tablet-devices (optional - auto-generated if blank)"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Enter category purpose or description..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Parent Category</label>
                <select
                  value={newCatParentId || ''}
                  onChange={(e) => setNewCatParentId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs font-bold text-white transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: BRAND CREATION */}
      {isBrandModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-lg text-slate-100 animate-zoom-in">
            <div className="p-6 border-b border-slate-850 flex items-center justify-between">
              <h5 className="text-lg font-bold">Add New Brand</h5>
              <button onClick={() => setIsBrandModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateBrand} className="p-6 space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Brand Name *</label>
                <input
                  type="text" required
                  placeholder="e.g. Samsung"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Slug Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. samsung-brand (optional - auto-generated if blank)"
                  value={newBrandSlug}
                  onChange={(e) => setNewBrandSlug(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Enter brand background or description..."
                  value={newBrandDesc}
                  onChange={(e) => setNewBrandDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-slate-400 mb-1">Logo URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://logo-source.com/logo.png"
                  value={newBrandLogo}
                  onChange={(e) => setNewBrandLogo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBrandModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs font-bold text-white transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
