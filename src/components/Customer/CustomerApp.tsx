import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Home,
  UtensilsCrossed,
  ShoppingBag,
  Clock,
  User,
  Search,
  Plus,
  Minus,
  Trash2,
  Bike,
  Store,
  MessageCircle,
  Bell,
  ChevronRight,
  Flame,
  Sparkles,
  ArrowRight,
  Download,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Phone,
  LogIn,
  RotateCcw,
  Check,
  X,
  Share2,
} from 'lucide-react';
import {
  Product,
  ProductVariant,
  StoreSettings,
  Transaction,
  OrderType,
} from '../../types';
import {
  formatRupiah,
  sanitizeWhatsAppNumber,
  DELIVERY_MIN_ORDER_AMOUNT,
  checkStoreStatus,
} from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { subscribeToFirebaseOrders } from '../../services/firebase';
import { CustomerProductDetailModal } from './CustomerProductDetailModal';
import { CustomerCheckoutModal, CustomerCartItem } from './CustomerCheckoutModal';
import { CustomerOrderTrackingModal } from './CustomerOrderTrackingModal';
import { BrandLogo } from '../Common/BrandLogo';
import { parseCustomerSubRoute, syncCustomerUrl } from '../../utils/routes';

interface CustomerAppProps {
  products: Product[];
  variants?: ProductVariant[];
  settings: StoreSettings;
  initialServiceType?: 'Takeaway' | 'Delivery';
  onBackToStaffDashboard?: () => void;
  onOpenStaffLogin?: () => void;
  onOrderCreated?: (transaction: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type TabType = 'home' | 'menu' | 'cart' | 'orders' | 'profile';

export const CustomerApp: React.FC<CustomerAppProps> = ({
  products,
  variants = [],
  settings,
  initialServiceType = 'Takeaway',
  onBackToStaffDashboard,
  onOpenStaffLogin,
  onOrderCreated,
  showToast,
}) => {
  // Parse initial route parameters from URL (/customer/menu, /customer/checkout, ?order=delivery, etc.)
  const initialRouteData = useMemo(() => {
    return parseCustomerSubRoute(
      typeof window !== 'undefined' ? window.location.pathname : '',
      typeof window !== 'undefined' ? window.location.search : ''
    );
  }, []);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<TabType>(() => initialRouteData.tab || 'home');
  const [currentServiceType, setCurrentServiceType] = useState<'Takeaway' | 'Delivery'>(() => {
    return initialRouteData.serviceType || initialServiceType;
  });

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    syncCustomerUrl(tab);
  };

  // Search query & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'name'>('popular');

  // Cart state persisted to sessionStorage/localStorage
  const [cart, setCart] = useState<CustomerCartItem[]>(() => {
    try {
      const saved = localStorage.getItem('wbk_customer_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save cart changes
  useEffect(() => {
    try {
      localStorage.setItem('wbk_customer_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Selected product for Detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Checkout modal (pre-opened if route is /customer/checkout)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(() => Boolean(initialRouteData.openCheckout));

  // Order Tracking modal & tracked order
  const [trackedOrder, setTrackedOrder] = useState<Transaction | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  // My Orders list from storage & Firebase
  const [myOrders, setMyOrders] = useState<Transaction[]>(() => {
    const all = StorageService.getTransactions();
    const phone = localStorage.getItem('wbk_customer_phone') || '';
    if (phone) {
      return all.filter((tx) => tx.no_whatsapp && tx.no_whatsapp.includes(phone.slice(-6)));
    }
    return all.slice(0, 10);
  });
  const [orderFilterTab, setOrderFilterTab] = useState<'Semua' | 'Diproses' | 'Selesai' | 'Dibatalkan'>('Semua');

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Profile states
  const [customerProfile, setCustomerProfile] = useState(() => ({
    name: localStorage.getItem('wbk_customer_name') || 'Pelanggan Bang Kobra',
    phone: localStorage.getItem('wbk_customer_phone') || '',
    email: localStorage.getItem('wbk_customer_email') || '',
    savedAddress: localStorage.getItem('wbk_customer_address') || 'Komplek Asrama DQM',
  }));
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(customerProfile.name);
  const [editPhone, setEditPhone] = useState(customerProfile.phone);
  const [editEmail, setEditEmail] = useState(customerProfile.email);
  const [editAddress, setEditAddress] = useState(customerProfile.savedAddress);

  // Listen for native beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Subscribe to real-time orders for customer
  useEffect(() => {
    const unsubscribe = subscribeToFirebaseOrders((orders) => {
      const phone = localStorage.getItem('wbk_customer_phone') || '';
      if (phone) {
        const filtered = orders.filter(
          (o) => o.no_whatsapp && o.no_whatsapp.includes(phone.slice(-6))
        );
        if (filtered.length > 0) {
          setMyOrders(filtered);
        }
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Check store status
  const storeStatus = useMemo(() => checkStoreStatus(settings), [settings]);

  // Categories definitions (Section C)
  const categoriesList = [
    { id: 'Semua', label: '🌟 Semua' },
    { id: 'Makanan', label: '🍚 Makanan' },
    { id: 'Mie', label: '🍜 Mie' },
    { id: 'Minuman', label: '🥤 Minuman' },
    { id: 'Kopi', label: '☕ Kopi' },
    { id: 'Jus', label: '🍹 Jus' },
    { id: 'Snack', label: '🍟 Snack' },
    { id: 'Paket', label: '📦 Paket' },
  ];

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.status !== 'Nonaktif')
      .filter((p) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.nama.toLowerCase().includes(q);
          const matchDesc = p.deskripsi?.toLowerCase().includes(q);
          const matchKat = p.kategori.toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchKat) return false;
        }

        // Category filter
        if (selectedCategory === 'Semua') return true;
        const nameLower = p.nama.toLowerCase();
        const catLower = p.kategori.toLowerCase();

        if (selectedCategory === 'Mie') {
          return catLower.includes('mie') || nameLower.includes('mie') || nameLower.includes('indomie');
        }
        if (selectedCategory === 'Kopi') {
          return catLower.includes('kopi') || nameLower.includes('kopi') || nameLower.includes('coffee');
        }
        if (selectedCategory === 'Jus') {
          return catLower.includes('jus') || nameLower.includes('jus') || nameLower.includes('juice');
        }
        if (selectedCategory === 'Snack') {
          return catLower.includes('snack') || catLower.includes('gorengan') || nameLower.includes('snack') || nameLower.includes('kentang');
        }
        if (selectedCategory === 'Paket') {
          return catLower.includes('paket') || nameLower.includes('paket') || nameLower.includes('combo');
        }
        if (selectedCategory === 'Makanan') {
          return catLower.includes('makanan') || nameLower.includes('nasi') || nameLower.includes('ayam');
        }
        if (selectedCategory === 'Minuman') {
          return catLower.includes('minuman') || catLower.includes('jus') || catLower.includes('kopi') || catLower.includes('teh');
        }
        return p.kategori === selectedCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.harga_jual - b.harga_jual;
        if (sortBy === 'price-desc') return b.harga_jual - a.harga_jual;
        if (sortBy === 'name') return a.nama.localeCompare(b.nama);
        // Popular: items with higher sales or in-stock priority
        return (b.stok > 0 ? 1 : 0) - (a.stok > 0 ? 1 : 0);
      });
  }, [products, searchQuery, selectedCategory, sortBy]);

  // Favorite products (Section D)
  const favoriteProducts = useMemo(() => {
    return products
      .filter((p) => p.status !== 'Nonaktif')
      .slice(0, 8); // Top favorites
  }, [products]);

  // Total cart calculation
  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.variant ? item.variant.price : item.product.harga_jual;
      return sum + price * item.qty;
    }, 0);
  }, [cart]);

  // Add to cart handler
  const handleAddToCart = (
    product: Product,
    variant: ProductVariant | undefined,
    qty: number,
    notes: string
  ) => {
    const cartKey = `${product.id}_${variant ? variant.variantId : 'def'}_${notes.trim()}`;

    setCart((prev) => {
      const idx = prev.findIndex((item) => item.cartKey === cartKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].qty += qty;
        return next;
      }
      return [
        ...prev,
        {
          cartKey,
          product,
          variant,
          qty,
          notes,
        },
      ];
    });

    showToast?.(`+${qty} ${product.nama} masuk ke keranjang!`, 'success');
  };

  // Quick plus button from product cards
  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stok <= 0) return;

    // If product has variants, open detail modal so customer can choose flavor/variant
    const hasVar =
      product.hasVariants ||
      variants.some((v) => v.productId === product.id || v.productId === product.sku) ||
      product.nama.toLowerCase().includes('indomie');

    if (hasVar) {
      setSelectedProduct(product);
      setIsDetailModalOpen(true);
      return;
    }

    handleAddToCart(product, undefined, 1, '');
  };

  // Stepper handlers inside Cart
  const handleUpdateCartQty = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartKey === cartKey) {
            const nextQty = item.qty + delta;
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CustomerCartItem[]
    );
  };

  const handleRemoveCartItem = (cartKey: string) => {
    setCart((prev) => prev.filter((it) => it.cartKey !== cartKey));
  };

  // Chat Kasir WhatsApp handler (Section P)
  const handleChatKasir = (customMsg?: string) => {
    const rawNumber = settings.whatsappNumber || '6281234567890';
    const cleanNumber = sanitizeWhatsAppNumber(rawNumber);
    const msg = customMsg || 'Halo WARUNG BANG KOBRA, saya ingin bertanya tentang pesanan.';
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.href = url;
    }
  };

  // PWA Install click
  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast?.('Aplikasi Warung Bang Kobra berhasil dipasang!', 'success');
      }
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  // Banner carousel items
  const bannerList = [
    {
      title: 'MENU FAVORIT HARI INI',
      subtitle: 'Pesan sekarang, nikmati lebih cepat & lezat',
      bg: 'from-red-600 via-rose-600 to-amber-600',
      badge: '🔥 PALING LARIS',
      actionText: 'Lihat Menu',
      img: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'DELIVERY AREA DQM',
      subtitle: 'Antar hangat ke asrama & staf Pesantren DQM',
      bg: 'from-amber-600 via-orange-600 to-red-600',
      badge: '🛵 MIN. BELANJA RP20.000',
      actionText: 'Pesan Antar',
      img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'SPESIAL INDOMIE & MIE',
      subtitle: 'Rasa Aceh, Rendang, Geprek, Soto & Telur',
      bg: 'from-red-700 via-red-600 to-orange-600',
      badge: '🍜 BANYAK PILIHAN RASA',
      actionText: 'Pilih Rasa',
      img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80',
    },
  ];

  const [activeBanner, setActiveBanner] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % bannerList.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [bannerList.length]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col font-sans select-none antialiased">
      {/* Container: Centered on larger displays to preserve mobile-first app feel */}
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto flex-1 flex flex-col bg-white shadow-xl relative min-h-screen pb-24 sm:pb-28">
        
        {/* ================= PWA INSTALL PROMPT BANNER ================= */}
        {showInstallBanner && deferredPrompt && (
          <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-2.5 flex items-center justify-between shadow-md text-xs sticky top-0 z-40 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 shrink-0 text-white animate-bounce" />
              <div>
                <span className="font-black block">Pasang Aplikasi Warung</span>
                <span className="text-white/80 text-[11px] block">Akses lebih cepat langsung dari layar HP</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallPWA}
                className="bg-white text-red-600 px-3 py-1 rounded-xl font-bold shadow-sm hover:bg-gray-100 transition cursor-pointer"
              >
                Pasang
              </button>
              <button
                type="button"
                onClick={() => setShowInstallBanner(false)}
                className="text-white/70 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STORE STATUS ALERT (If closed) ================= */}
        {!storeStatus.isOpen && (
          <div className="bg-amber-500 text-stone-950 px-4 py-2 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{storeStatus.reason || 'Warung sedang tutup sementara.'} Tetap dapat melihat menu.</span>
            </div>
          </div>
        )}

        {/* ================= TOP CUSTOMER HEADER ================= */}
        <header className="px-4 py-3.5 bg-white border-b border-gray-100 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Brand Logo & Welcoming Greeting */}
            <div className="flex items-center gap-3">
              <BrandLogo size="md" className="rounded-2xl shrink-0 shadow-md shadow-red-600/20" />
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-black text-gray-900 tracking-tight leading-none">
                    {settings.storeName || 'WARUNG BANG KOBRA'}
                  </h1>
                </div>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                  Selamat Datang 👋 • Mau pesan apa hari ini?
                </p>
              </div>
            </div>

            {/* Right Quick Action Icons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* WhatsApp Kasir Button */}
              <button
                type="button"
                onClick={() => handleChatKasir()}
                title="Hubungi Kasir via WhatsApp"
                className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
              </button>

              {/* Order Status Notification Icon */}
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                title="Status Pesanan"
                className="w-9 h-9 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition active:scale-95 cursor-pointer relative shadow-xs"
              >
                <Bell className="w-4 h-4" />
                {myOrders.some((o) => o.status === 'MENUNGGU' || o.status === 'DIPROSES' || o.status === 'SIAP') && (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-white absolute top-1 right-1 animate-pulse" />
                )}
              </button>

              {/* Cart Counter Icon */}
              <button
                type="button"
                onClick={() => setActiveTab('cart')}
                title="Keranjang Belanja"
                className="w-9 h-9 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition active:scale-95 cursor-pointer relative shadow-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ================= TAB 1: HOME (BERANDA) ================= */}
        {activeTab === 'home' && (
          <div className="space-y-6 p-4 animate-in fade-in duration-200">
            {/* 1. Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Cari makanan atau minuman favorit..."
                className="w-full pl-11 pr-4 py-3 bg-gray-100/80 hover:bg-gray-100 focus:bg-white rounded-2xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 2. Premium Banner Carousel (Section B) */}
            <div className="relative overflow-hidden rounded-3xl shadow-lg">
              <div
                className={`p-5 bg-gradient-to-r ${bannerList[activeBanner].bg} text-white flex items-center justify-between gap-4 min-h-[140px] sm:min-h-[160px] transition-all duration-500`}
              >
                <div className="flex-1 space-y-1.5 z-10">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md inline-block">
                    {bannerList[activeBanner].badge}
                  </span>
                  <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                    {bannerList[activeBanner].title}
                  </h3>
                  <p className="text-xs text-white/90 leading-snug">
                    {bannerList[activeBanner].subtitle}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('menu')}
                    className="mt-2 text-xs font-bold bg-white text-gray-900 px-3.5 py-1.5 rounded-xl shadow-md hover:bg-gray-100 transition inline-flex items-center gap-1 active:scale-95 cursor-pointer"
                  >
                    {bannerList[activeBanner].actionText}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-28 sm:w-36 h-28 sm:h-36 rounded-2xl overflow-hidden shadow-inner shrink-0 rotate-2 border-2 border-white/20">
                  <img
                    src={bannerList[activeBanner].img}
                    alt="Promo"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Dots Indicator */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {bannerList.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveBanner(i)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      activeBanner === i ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 3. Horizontal Categories (Section C) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-gray-900">Kategori</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('menu')}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5 cursor-pointer"
                >
                  Lihat Semua
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Horizontal Scroll Pill */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                {categoriesList.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/30 scale-[1.02]'
                          : 'bg-gray-100/90 text-gray-700 hover:bg-gray-200/80 border border-gray-200/50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Section: Favorit Pelanggan (Section D - Grid 2 Kolom) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                  <h3 className="text-sm font-black text-gray-900">Favorit Pelanggan</h3>
                </div>
                <span className="text-[11px] text-gray-400 font-medium">Menu Terlaris</span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {favoriteProducts.map((p) => {
                  const isOut = p.stok <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setIsDetailModalOpen(true);
                      }}
                      className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                    >
                      {/* Product Thumbnail */}
                      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 relative mb-2.5">
                        <img
                          src={p.foto || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80'}
                          alt={p.nama}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80';
                          }}
                        />

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-xs">
                            ⭐ Favorit
                          </span>
                        </div>

                        {isOut && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                            <span className="px-3 py-1 rounded-xl bg-red-600 text-white text-xs font-black shadow-md">
                              HABIS
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 leading-tight group-hover:text-red-600 transition">
                          {p.nama}
                        </h4>
                        <span className="text-[11px] text-gray-400 capitalize block mt-0.5">
                          {p.kategori}
                        </span>
                      </div>

                      {/* Price & Add Button */}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-black text-red-600">
                          {formatRupiah(p.harga_jual)}
                        </span>

                        <button
                          type="button"
                          disabled={isOut}
                          onClick={(e) => handleQuickAdd(p, e)}
                          title={isOut ? 'Stok Habis' : 'Tambah ke Keranjang'}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition active:scale-90 cursor-pointer shadow-sm ${
                            isOut
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/30'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Delivery Information Card */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-red-600 shrink-0">
                  <Bike className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-gray-900">
                    Layanan Delivery Pesantren DQM
                  </h4>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Minimal belanja {formatRupiah(settings.deliveryMinOrder || DELIVERY_MIN_ORDER_AMOUNT)}, pesanan diantar kurir sampai tujuan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('Semua');
                  setActiveTab('menu');
                }}
                className="shrink-0 p-2 text-red-600 hover:text-red-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 2: MENU PRODUK (Section E) ================= */}
        {activeTab === 'menu' && (
          <div className="p-4 space-y-4 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">Menu Kami</h2>
                <p className="text-xs text-gray-500">
                  Pilihan lengkap makanan & minuman segar
                </p>
              </div>
              <span className="text-xs text-gray-400 font-bold bg-gray-100 px-2.5 py-1 rounded-full">
                {filteredProducts.length} Produk
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Cari menu..."
                className="w-full pl-11 pr-4 py-2.5 bg-gray-100 focus:bg-white rounded-2xl text-xs sm:text-sm text-gray-800 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Horizontal Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
              {categoriesList.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Sort Options */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-bold text-gray-800 border-none focus:outline-none cursor-pointer"
              >
                <option value="popular">🔥 Paling Populer</option>
                <option value="price-asc">💵 Harga Terendah</option>
                <option value="price-desc">💎 Harga Tertinggi</option>
                <option value="name">🔤 Nama (A - Z)</option>
              </select>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-3">
                <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 stroke-1" />
                <p className="text-sm font-medium">
                  Tidak ada menu yang sesuai dengan pencarian Anda.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('Semua');
                  }}
                  className="text-xs text-red-600 font-bold hover:underline"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {filteredProducts.map((p) => {
                  const isOut = p.stok <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setIsDetailModalOpen(true);
                      }}
                      className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                    >
                      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 relative mb-2">
                        <img
                          src={p.foto || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80'}
                          alt={p.nama}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        {isOut && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="px-3 py-1 rounded-xl bg-red-600 text-white text-xs font-black shadow-md">
                              HABIS
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 leading-tight group-hover:text-red-600 transition">
                          {p.nama}
                        </h4>
                        <span className="text-[10px] text-gray-400 capitalize block mt-0.5">
                          {p.kategori}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-black text-red-600">
                          {formatRupiah(p.harga_jual)}
                        </span>
                        <button
                          type="button"
                          disabled={isOut}
                          onClick={(e) => handleQuickAdd(p, e)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition active:scale-90 cursor-pointer shadow-sm ${
                            isOut
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/30'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: KERANJANG SAYA (Section H) ================= */}
        {activeTab === 'cart' && (
          <div className="p-4 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-black text-gray-900">Keranjang Saya</h2>
                <p className="text-xs text-gray-500">
                  {cart.length} Jenis menu dipilih
                </p>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Kosongkan
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-20 text-center text-gray-400 space-y-3">
                <div className="w-20 h-20 rounded-full bg-gray-100 text-gray-300 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <h3 className="text-base font-bold text-gray-700">Keranjang Masih Kosong</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Belum ada menu yang ditambahkan. Yuk, cari makanan atau minuman lezat hari ini!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('menu')}
                  className="mt-2 px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-red-600/20 transition cursor-pointer"
                >
                  Mulai Pesan Menu
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cart Items List */}
                <div className="divide-y divide-gray-100">
                  {cart.map((item) => {
                    const price = item.variant ? item.variant.price : item.product.harga_jual;
                    return (
                      <div key={item.cartKey} className="py-3.5 flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200/50">
                          <img
                            src={item.product.foto || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=200&auto=format&fit=crop&q=80'}
                            alt={item.product.nama}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {item.product.nama}
                          </h4>
                          {item.variant && (
                            <span className="text-[11px] text-red-600 font-semibold block">
                              Varian: {item.variant.variantName}
                            </span>
                          )}
                          {item.notes && (
                            <span className="text-[11px] text-gray-400 italic block truncate">
                              Catatan: {item.notes}
                            </span>
                          )}
                          <span className="text-xs font-black text-gray-900 mt-0.5 block">
                            {formatRupiah(price)}
                          </span>
                        </div>

                        {/* Stepper & Trash */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(item.cartKey)}
                            className="text-gray-400 hover:text-rose-600 transition p-1"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.cartKey, -1)}
                              className="w-6 h-6 rounded-lg bg-white text-gray-800 flex items-center justify-center font-bold shadow-xs hover:bg-gray-50 active:scale-95"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-gray-900 w-4 text-center">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.cartKey, 1)}
                              className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold shadow-xs hover:bg-red-700 active:scale-95"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Order Summary Card */}
                <div className="p-4 rounded-3xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-bold text-gray-900">{formatRupiah(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Diskon</span>
                    <span className="font-bold text-emerald-600">Rp0</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                    <span className="font-black text-gray-900">Total Sementara</span>
                    <span className="font-black text-red-600 text-base">
                      {formatRupiah(cartSubtotal)}
                    </span>
                  </div>
                </div>

                {/* Checkout CTA */}
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-[0.98] text-white font-bold text-sm sm:text-base shadow-lg shadow-red-600/30 flex items-center justify-between px-5 transition cursor-pointer"
                >
                  <span>Lanjut Checkout</span>
                  <div className="flex items-center gap-1.5 font-black">
                    <span>{formatRupiah(cartSubtotal)}</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: PESANAN SAYA (Section N) ================= */}
        {activeTab === 'orders' && (
          <div className="p-4 space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-black text-gray-900">Pesanan Saya</h2>
              <p className="text-xs text-gray-500">
                Pantau riwayat & status pesanan langsung secara real-time
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(['Semua', 'Diproses', 'Selesai', 'Dibatalkan'] as const).map((tab) => {
                const isActive = orderFilterTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setOrderFilterTab(tab)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Orders List */}
            {myOrders.length === 0 ? (
              <div className="py-20 text-center text-gray-400 space-y-3">
                <Clock className="w-12 h-12 mx-auto text-gray-300 stroke-1" />
                <h3 className="text-base font-bold text-gray-700">Belum Ada Riwayat Pesanan</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Semua pesanan yang Anda buat akan muncul di sini secara real-time.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('menu')}
                  className="px-4 py-2 rounded-2xl bg-red-600 text-white font-bold text-xs shadow-md shadow-red-600/20"
                >
                  Pesan Sekarang
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders
                  .filter((order) => {
                    const st = (order.status || '').toUpperCase();
                    if (orderFilterTab === 'Diproses') {
                      return st === 'MENUNGGU' || st === 'DIPROSES' || st === 'SIAP';
                    }
                    if (orderFilterTab === 'Selesai') {
                      return st === 'SELESAI';
                    }
                    if (orderFilterTab === 'Dibatalkan') {
                      return st === 'DIBATALKAN';
                    }
                    return true;
                  })
                  .map((order) => {
                    const st = (order.status || 'MENUNGGU').toUpperCase();
                    let badgeClass = 'bg-amber-100 text-amber-800';
                    let badgeLabel = '🟡 Menunggu';

                    if (st === 'DIPROSES') {
                      badgeClass = 'bg-blue-100 text-blue-800';
                      badgeLabel = '🔵 Diproses';
                    } else if (st === 'SIAP') {
                      badgeClass = 'bg-orange-100 text-orange-800';
                      badgeLabel = '🟠 Siap Diambil';
                    } else if (st === 'SELESAI') {
                      badgeClass = 'bg-emerald-100 text-emerald-800';
                      badgeLabel = '🟢 Selesai';
                    } else if (st === 'DIBATALKAN') {
                      badgeClass = 'bg-rose-100 text-rose-800';
                      badgeLabel = '🔴 Dibatalkan';
                    }

                    return (
                      <div
                        key={order.id_transaksi}
                        className="p-4 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition space-y-3"
                      >
                        {/* Top row */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-xs text-gray-900 block">
                              {order.id_transaksi}
                            </span>
                            <span className="text-[11px] text-gray-400 block">
                              {order.tanggal} • {order.jam}
                            </span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>

                        {/* Middle info */}
                        <div className="flex items-center justify-between text-xs py-2 border-t border-b border-gray-100">
                          <span className="text-gray-600">
                            {order.items?.length || 0} Item • {order.tipe_pesanan || order.orderType}
                          </span>
                          <span className="font-black text-red-600 text-sm">
                            {formatRupiah(order.total)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTrackedOrder(order);
                              setIsTrackingModalOpen(true);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Lihat Status Real-time
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              // Re-add items to cart
                              if (order.items) {
                                order.items.forEach((it) => {
                                  const prod = products.find((p) => p.id === it.id_produk) || {
                                    id: it.id_produk,
                                    sku: it.id_produk,
                                    nama: it.nama_produk,
                                    kategori: 'Makanan' as any,
                                    harga_modal: 0,
                                    harga_jual: it.harga,
                                    satuan: 'Porsi',
                                    stok: 10,
                                    stok_minimum: 1,
                                    foto: '',
                                    status: 'Aktif' as any,
                                    created_at: '',
                                    updated_at: '',
                                  };
                                  handleAddToCart(prod, undefined, it.qty, it.catatan || '');
                                });
                                setActiveTab('cart');
                                showToast?.('Item pesanan dimasukkan kembali ke keranjang!', 'info');
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Pesan Lagi
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: PROFIL PELANGGAN (Section O) ================= */}
        {activeTab === 'profile' && (
          <div className="p-4 space-y-5 animate-in fade-in duration-200">
            {/* Profile Avatar Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-lg flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black shadow-inner shrink-0 border-2 border-white/40">
                {customerProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black truncate">{customerProfile.name}</h3>
                <span className="text-xs text-white/80 block font-mono">
                  {customerProfile.phone || 'Nomor WhatsApp belum disimpan'}
                </span>
                <span className="text-[11px] text-white/70 block truncate">
                  {customerProfile.email || 'Email belum diatur'}
                </span>
              </div>
            </div>

            {/* Quick Action Menus */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => {
                  setEditName(customerProfile.name);
                  setEditPhone(customerProfile.phone);
                  setEditEmail(customerProfile.email);
                  setEditAddress(customerProfile.savedAddress);
                  setIsEditProfileOpen(true);
                }}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-gray-900">Edit Profil & Data Saya</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-gray-900">Riwayat Pesanan Saya</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => handleChatKasir()}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-gray-900">Chat Kasir via WhatsApp</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              {deferredPrompt && (
                <button
                  type="button"
                  onClick={handleInstallPWA}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer bg-red-50/50"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-red-600" />
                    <div>
                      <span className="font-bold text-red-700 block">Pasang Aplikasi ke Smartphone</span>
                      <span className="text-[11px] text-red-500">Akses tanpa browser dari layar utama</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-400" />
                </button>
              )}
            </div>

            {/* Help & Store Information Accordion */}
            <div className="p-4 rounded-3xl bg-gray-50 border border-gray-100 text-xs space-y-2">
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-gray-500" />
                Informasi Warung Bang Kobra
              </h4>
              <p className="text-gray-500 leading-relaxed">
                Menyajikan aneka makanan, indomie spesial dengan varian rasa lengkap, serta aneka jus buah segar asli 100%. Layanan delivery tersedia khusus area sekitar Pesantren DQM dengan minimal order {formatRupiah(settings.deliveryMinOrder || DELIVERY_MIN_ORDER_AMOUNT)}.
              </p>
              <div className="pt-2 border-t border-gray-200 text-[11px] text-gray-400 flex items-center justify-between">
                <span>Versi Customer App: v2.5.0 PWA</span>
                <span>Warung Bang Kobra</span>
              </div>
            </div>

            {/* Discreet Staff Portal Switcher */}
            {onBackToStaffDashboard && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onBackToStaffDashboard}
                  className="w-full py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <Store className="w-4 h-4 text-amber-400" />
                  Kembali ke Dashboard Toko / Kasir
                </button>
              </div>
            )}

            {onOpenStaffLogin && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onOpenStaffLogin}
                  className="text-xs text-gray-400 hover:text-gray-700 font-bold inline-flex items-center gap-1.5 transition cursor-pointer p-2"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Masuk Portal Staf / Kasir
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= EDIT PROFILE MODAL ================= */}
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900">Edit Data Pelanggan</h3>
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nomor WhatsApp</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('wbk_customer_name', editName.trim());
                    localStorage.setItem('wbk_customer_phone', editPhone.trim());
                    localStorage.setItem('wbk_customer_email', editEmail.trim());
                    setCustomerProfile({
                      name: editName.trim() || 'Pelanggan Bang Kobra',
                      phone: editPhone.trim(),
                      email: editEmail.trim(),
                      savedAddress: editAddress,
                    });
                    setIsEditProfileOpen(false);
                    showToast?.('Profil Anda berhasil diperbarui!', 'success');
                  }}
                  className="py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow-md shadow-red-600/20"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= FLOATING CART BAR (Section G) ================= */}
        {cart.length > 0 && activeTab !== 'cart' && (
          <div className="fixed bottom-20 sm:bottom-22 left-0 right-0 z-40 px-4 max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto pointer-events-none">
            <div className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-xl shadow-red-600/40 flex items-center justify-between pointer-events-auto transition animate-in slide-in-from-bottom duration-300 ring-2 ring-white/30">
              <button
                type="button"
                onClick={() => handleTabChange('cart')}
                className="flex items-center gap-3 text-left cursor-pointer flex-1"
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-sm">
                  <ShoppingBag className="w-4.5 h-4.5" />
                </div>
                <div className="leading-tight">
                  <span className="font-extrabold text-xs block">
                    {cartItemCount} Menu di Keranjang
                  </span>
                  <span className="text-xs text-white/90 font-mono font-bold">
                    {formatRupiah(cartSubtotal)}
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTabChange('cart')}
                  className="text-xs font-bold bg-white/15 hover:bg-white/25 text-white px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                >
                  Keranjang
                </button>
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="flex items-center gap-1 font-black text-xs bg-white text-red-600 hover:bg-red-50 px-3.5 py-1.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                >
                  <span>Checkout</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODERN BOTTOM NAVIGATION (5 Tabs) ================= */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto shadow-lg">
          <div className="grid grid-cols-5 h-16 sm:h-18 px-1">
            {[
              { id: 'home', label: 'Beranda', icon: Home },
              { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
              { id: 'cart', label: 'Keranjang', icon: ShoppingBag, badge: cartItemCount },
              { id: 'orders', label: 'Pesanan', icon: Clock },
              { id: 'profile', label: 'Profil', icon: User },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id as TabType)}
                  className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
                    isActive ? 'text-red-600 font-black' : 'text-gray-400 hover:text-gray-600 font-medium'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                  {isActive && (
                    <span className="w-5 h-0.5 bg-red-600 rounded-full absolute bottom-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ================= DETAIL PRODUCT MODAL ================= */}
        <CustomerProductDetailModal
          product={selectedProduct}
          variants={variants}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onAddToCart={handleAddToCart}
          onDirectOrder={(prod, v, q, n) => {
            handleAddToCart(prod, v, q, n);
            setIsDetailModalOpen(false);
            setIsCheckoutModalOpen(true);
          }}
        />

        {/* ================= CHECKOUT MODAL ================= */}
        <CustomerCheckoutModal
          cart={cart}
          settings={settings}
          initialServiceType={currentServiceType}
          isOpen={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          onOrderSuccess={(newOrder) => {
            setCart([]); // Clear cart upon successful order
            setMyOrders((prev) => [newOrder, ...prev]);
            setTrackedOrder(newOrder);
            if (onOrderCreated) {
              try {
                onOrderCreated(newOrder);
              } catch (cbErr) {
                console.warn('onOrderCreated handler notice:', cbErr);
              }
            }
          }}
          onTrackOrder={(order) => {
            setTrackedOrder(order);
            setIsTrackingModalOpen(true);
          }}
          showToast={showToast}
        />

        {/* ================= ORDER TRACKING MODAL ================= */}
        {trackedOrder && (
          <CustomerOrderTrackingModal
            order={trackedOrder}
            settings={settings}
            isOpen={isTrackingModalOpen}
            onClose={() => setIsTrackingModalOpen(false)}
            onUpdateOrder={(updated) => {
              setTrackedOrder(updated);
              setMyOrders((prev) =>
                prev.map((o) => (o.id_transaksi === updated.id_transaksi ? updated : o))
              );
              showToast?.(`Update status: ${updated.status}`, 'info');
            }}
          />
        )}
      </div>
    </div>
  );
};
