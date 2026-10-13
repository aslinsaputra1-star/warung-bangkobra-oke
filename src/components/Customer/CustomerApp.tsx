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
  Copy,
  ExternalLink,
  MapPin,
  Tag,
  ShieldCheck,
  Heart,
  Grid,
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
  DQM_LOCATIONS,
} from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { subscribeToFirebaseOrders } from '../../services/firebase';
import { CustomerProductDetailModal } from './CustomerProductDetailModal';
import { CustomerCheckoutModal, CustomerCartItem } from './CustomerCheckoutModal';
import { CustomerOrderTrackingModal } from './CustomerOrderTrackingModal';
import { CustomerShareModal } from './CustomerShareModal';
import { CustomerPromoModal, PromoItem, PROMO_LIST } from './CustomerPromoModal';
import { CustomerNotificationModal, CustomerNotification } from './CustomerNotificationModal';
import { CustomerAddressModal } from './CustomerAddressModal';
import { CustomerFAQModal } from './CustomerFAQModal';
import { BrandLogo } from '../Common/BrandLogo';
import {
  parseCustomerSubRoute,
  syncCustomerUrl,
  getCustomerAppUrl,
} from '../../utils/routes';

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
type FeaturedSection = 'terlaris' | 'rekomendasi' | 'promo' | 'terbaru';

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
  // Parse initial route parameters from URL
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

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'name'>('popular');
  const [featuredTab, setFeaturedTab] = useState<FeaturedSection>('terlaris');

  // Cart state persisted to localStorage
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
    } catch (e) {
      console.warn('Failed to save cart to localStorage:', e);
    }
  }, [cart]);

  // Selected product for detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Checkout modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(() => Boolean(initialRouteData.openCheckout));

  // Order Tracking modal & tracked order
  const [trackedOrder, setTrackedOrder] = useState<Transaction | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  // Customer share modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const customerAppUrl = useMemo(() => getCustomerAppUrl(), []);

  // Promo modal
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Notification modal
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wbk_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Address modal
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // FAQ modal
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);
  const [faqModalTab, setFaqModalTab] = useState<'faq' | 'privacy' | 'about'>('faq');

  // Customer orders (live subscribed)
  const [myOrders, setMyOrders] = useState<Transaction[]>(() => {
    try {
      const allTx = StorageService.getTransactions();
      const phone = localStorage.getItem('wbk_customer_phone') || '';
      if (!phone) return allTx.slice(0, 10);
      return allTx.filter((t) => t.no_whatsapp && t.no_whatsapp.includes(phone.slice(-6)));
    } catch {
      return [];
    }
  });

  const [orderFilterTab, setOrderFilterTab] = useState<'Semua' | 'Diproses' | 'Selesai' | 'Dibatalkan'>('Semua');

  // PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Profile states
  const [customerProfile, setCustomerProfile] = useState(() => ({
    name: localStorage.getItem('wbk_customer_name') || 'Pelanggan Bang Kobra',
    phone: localStorage.getItem('wbk_customer_phone') || '',
    email: localStorage.getItem('wbk_customer_email') || '',
    savedAddress: localStorage.getItem('wbk_customer_address') || 'Asrama DQM (Komplek Utama)',
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

  // System Notifications derived from real order status + warung promos
  const notifications: CustomerNotification[] = useMemo(() => {
    const list: CustomerNotification[] = [];

    // Order status notifications
    myOrders.slice(0, 5).forEach((order) => {
      const st = (order.status || 'MENUNGGU').toUpperCase();
      let msg = 'Pesanan Anda telah diterima oleh kasir.';
      if (st === 'DIPROSES') msg = 'Pesanan Anda sedang dipersiapkan di dapur warung.';
      if (st === 'SIAP') msg = 'Pesanan Anda siap diambil / dalam perjalanan kurir!';
      if (st === 'SELESAI') msg = 'Pesanan telah selesai dinikmati. Terima kasih!';
      if (st === 'DIBATALKAN') msg = 'Pesanan Anda telah dibatalkan.';

      list.push({
        id: `notif-order-${order.id_transaksi}`,
        type: 'order',
        title: `Status Pesanan: ${order.id_transaksi}`,
        message: msg,
        time: `${order.jam || 'Hari ini'}`,
        read: readNotificationIds.includes(`notif-order-${order.id_transaksi}`),
        orderId: order.id_transaksi,
      });
    });

    // Promo notification
    list.push({
      id: 'notif-promo-1',
      type: 'promo',
      title: 'Voucher KOBRA15 Aktif!',
      message: 'Gunakan kode voucher KOBRA15 untuk hemat 15% pada menu makanan & Indomie spesial.',
      time: 'Promo Hari Ini',
      read: readNotificationIds.includes('notif-promo-1'),
    });

    // Info warung notification
    list.push({
      id: 'notif-info-dqm',
      type: 'info',
      title: 'Layanan Delivery DQM Beroperasi',
      message: 'Kurir warung siap mengantar hangat pesanan Anda ke asrama & staf Pesantren DQM.',
      time: 'Info Warung',
      read: readNotificationIds.includes('notif-info-dqm'),
    });

    return list;
  }, [myOrders, readNotificationIds]);

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setReadNotificationIds((prev) => {
      const updated = Array.from(new Set([...prev, id]));
      localStorage.setItem('wbk_read_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotificationIds(allIds);
    localStorage.setItem('wbk_read_notifications', JSON.stringify(allIds));
    showToast?.('Semua notifikasi ditandai telah dibaca.', 'info');
  };

  // Check store status
  const storeStatus = useMemo(() => checkStoreStatus(settings), [settings]);

  // Categories definitions (Horizontal Scrollable)
  const categoriesList = [
    { id: 'Semua', label: '🌟 Semua' },
    { id: 'Makanan', label: '🍚 Makanan' },
    { id: 'Minuman', label: '🥤 Minuman' },
    { id: 'Snack', label: '🍟 Snack' },
    { id: 'Sembako', label: '🌾 Sembako' },
    { id: 'Kebutuhan Harian', label: '🧴 Kebutuhan Harian' },
    { id: 'Produk Lainnya', label: '✨ Produk Lainnya' },
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

        if (selectedCategory === 'Makanan') {
          return catLower.includes('makanan') || nameLower.includes('nasi') || nameLower.includes('ayam') || nameLower.includes('mie') || nameLower.includes('indomie');
        }
        if (selectedCategory === 'Minuman') {
          return catLower.includes('minuman') || catLower.includes('jus') || catLower.includes('kopi') || catLower.includes('teh');
        }
        if (selectedCategory === 'Snack') {
          return catLower.includes('snack') || catLower.includes('gorengan') || nameLower.includes('snack') || nameLower.includes('kentang') || nameLower.includes('keripik');
        }
        if (selectedCategory === 'Sembako') {
          return catLower.includes('sembako') || catLower.includes('beras') || catLower.includes('minyak') || catLower.includes('gula') || nameLower.includes('beras') || nameLower.includes('telur');
        }
        if (selectedCategory === 'Kebutuhan Harian') {
          return catLower.includes('kebutuhan') || catLower.includes('sabun') || catLower.includes('pasta') || nameLower.includes('sabun') || nameLower.includes('shampoo');
        }
        if (selectedCategory === 'Produk Lainnya') {
          return !['makanan', 'minuman', 'snack', 'sembako'].some((k) => catLower.includes(k));
        }
        return p.kategori === selectedCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.harga_jual - b.harga_jual;
        if (sortBy === 'price-desc') return b.harga_jual - a.harga_jual;
        if (sortBy === 'name') return a.nama.localeCompare(b.nama);
        return (b.stok > 0 ? 1 : 0) - (a.stok > 0 ? 1 : 0);
      });
  }, [products, searchQuery, selectedCategory, sortBy]);

  // Featured lists
  const bestSellerProducts = useMemo(() => {
    return products.filter((p) => p.status !== 'Nonaktif').slice(0, 6);
  }, [products]);

  const recommendedProducts = useMemo(() => {
    return products
      .filter((p) => p.status !== 'Nonaktif')
      .slice(2, 8);
  }, [products]);

  const promoProducts = useMemo(() => {
    return products
      .filter((p) => p.status !== 'Nonaktif')
      .slice(0, 6)
      .map((p, idx) => ({
        ...p,
        discountPercent: idx % 2 === 0 ? 15 : 10,
        originalPrice: Math.round(p.harga_jual * (idx % 2 === 0 ? 1.15 : 1.10)),
      }));
  }, [products]);

  const newProducts = useMemo(() => {
    return [...products].reverse().filter((p) => p.status !== 'Nonaktif').slice(0, 6);
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
    const availableStock = Math.max(0, variant ? variant.stock : product.stok);
    if (availableStock <= 0) {
      showToast?.('Maaf, produk ini sedang habis.', 'error');
      return;
    }

    const cartKey = `${product.id}_${variant ? variant.variantId : 'def'}_${notes.trim()}`;

    setCart((prev) => {
      const idx = prev.findIndex((item) => item.cartKey === cartKey);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = Math.min(availableStock, next[idx].qty + qty);
        next[idx].qty = newQty;
        return next;
      }
      return [
        ...prev,
        {
          cartKey,
          product,
          variant,
          qty: Math.min(availableStock, qty),
          notes,
        },
      ];
    });

    showToast?.(`+${qty} ${product.nama} masuk ke keranjang!`, 'success');
  };

  // Quick plus button from product cards
  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stok <= 0) {
      showToast?.('Stok produk sedang habis', 'error');
      return;
    }

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
            const availableStock = Math.max(
              0,
              item.variant ? item.variant.stock : item.product.stok
            );
            const nextQty = item.qty + delta;
            if (nextQty > availableStock) {
              showToast?.(`Maksimal pesanan sesuai stok: ${availableStock}`, 'error');
              return item;
            }
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CustomerCartItem[]
    );
  };

  const handleRemoveCartItem = (cartKey: string) => {
    setCart((prev) => prev.filter((it) => it.cartKey !== cartKey));
    showToast?.('Item dihapus dari keranjang', 'info');
  };

  // Chat Kasir WhatsApp handler
  const handleChatKasir = (customMsg?: string) => {
    const rawNumber = settings.whatsappNumber || '6281234567890';
    const cleanNumber = sanitizeWhatsAppNumber(rawNumber);
    const msg = customMsg || 'Halo WARUNG BANG KOBRA, saya ingin bertanya mengenai pesanan.';
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
      title: 'Menu Spesial Hari Ini',
      subtitle: 'Lezat, praktis, dan bersahabat di kantong.',
      bg: 'from-[#E50914] via-[#A80710] to-[#151515]',
      badge: '🔥 MENU SPESIAL HARI INI',
      actionText: 'Lihat Menu',
      img: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'Delivery Cepat Area DQM',
      subtitle: 'Antar hangat ke santri & staf Pesantren DQM.',
      bg: 'from-amber-600 via-orange-600 to-red-600',
      badge: '🛵 MIN. BELANJA RP20.000',
      actionText: 'Pesan Sekarang',
      img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'Spesial Indomie & Kopi Mantap',
      subtitle: 'Rasa Aceh, Rendang, Geprek, Soto & Telur Hangat.',
      bg: 'from-red-700 via-red-600 to-orange-600',
      badge: '🍜 PILIHAN RASA LENGKAP',
      actionText: 'Pilih Rasa',
      img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'Sembako & Kebutuhan Harian',
      subtitle: 'Harga bersahabat, selalu lengkap di hati.',
      bg: 'from-stone-900 via-stone-800 to-[#A80710]',
      badge: '🌾 HEMAT SETIAP HARI',
      actionText: 'Belanja Sekarang',
      img: 'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?w=600&auto=format&fit=crop&q=80',
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
    <div className="min-h-screen bg-[#F5F6F8] text-[#151515] flex flex-col font-sans select-none antialiased">
      {/* Container: Centered on larger displays to preserve mobile-first app feel */}
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto flex-1 flex flex-col bg-white shadow-2xl relative min-h-screen pb-24 sm:pb-28 border-x border-gray-100">
        
        {/* ================= PWA INSTALL PROMPT BANNER ================= */}
        {showInstallBanner && deferredPrompt && (
          <div className="bg-gradient-to-r from-[#E50914] to-[#A80710] text-white px-4 py-2.5 flex items-center justify-between shadow-md text-xs sticky top-0 z-40 animate-in slide-in-from-top duration-300">
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
                className="bg-white text-[#E50914] px-3 py-1 rounded-xl font-bold shadow-sm hover:bg-gray-100 transition cursor-pointer"
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
          <div className="bg-[#FF8A00] text-stone-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{storeStatus.reason || 'Warung sedang tutup sementara.'} Anda tetap dapat melihat menu.</span>
            </div>
          </div>
        )}

        {/* ================= TOP CUSTOMER HEADER (Requirement 2) ================= */}
        <header className="px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center justify-between gap-2.5">
            {/* Left: Brand Logo & Personal Greeting (Identik dengan Logo Toko) */}
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandLogo
                src={settings.logoUrl}
                alt={settings.storeName || 'WARUNG BANG KOBRA'}
                size="md"
                className="rounded-2xl shrink-0 shadow-md shadow-red-600/20"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm sm:text-base font-black text-gray-900 tracking-tight leading-none truncate">
                    {settings.storeName || 'WARUNG BANG KOBRA'}
                  </h1>
                </div>
                {/* Greeting & Location Switcher */}
                <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                  <span className="font-medium text-gray-700 truncate">
                    Halo, {customerProfile.name !== 'Pelanggan Bang Kobra' ? customerProfile.name : 'selamat datang!'}
                  </span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(true)}
                    className="flex items-center gap-0.5 text-[#E50914] font-bold hover:underline cursor-pointer truncate max-w-[140px] sm:max-w-[200px]"
                    title="Ubah Alamat Pengantaran"
                  >
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{customerProfile.savedAddress || 'Pilih Lokasi'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Quick Action Icons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* WhatsApp Bantuan Kasir */}
              <button
                type="button"
                onClick={() => handleChatKasir()}
                title="Bantuan WhatsApp Kasir"
                className="w-9 h-9 rounded-full bg-emerald-50 text-[#16A34A] hover:bg-emerald-100 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
              </button>

              {/* Notification Center Icon */}
              <button
                type="button"
                onClick={() => setIsNotificationModalOpen(true)}
                title="Pusat Notifikasi"
                className="w-9 h-9 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition active:scale-95 cursor-pointer relative shadow-xs"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#E50914] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Cart Icon */}
              <button
                type="button"
                onClick={() => handleTabChange('cart')}
                title="Keranjang Belanja"
                className="w-9 h-9 rounded-full bg-red-50 text-[#E50914] hover:bg-red-100 flex items-center justify-center transition active:scale-95 cursor-pointer relative shadow-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#E50914] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Quick Search Bar inside Sticky Header */}
          <div className="mt-2.5 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari makanan, minuman, sembako..."
              className="w-full pl-10 pr-9 py-2.5 bg-[#F5F6F8] focus:bg-white rounded-2xl text-xs sm:text-sm text-gray-800 border border-gray-200/80 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#E50914] transition shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* ================= TAB 1: HOME (BERANDA) ================= */}
        {activeTab === 'home' && (
          <div className="space-y-5 p-4 animate-in fade-in duration-200">
            {/* Tagline Badge */}
            <div className="text-center py-1 bg-red-50/70 border border-red-100 rounded-2xl">
              <p className="text-[11px] font-bold text-[#A80710] tracking-wide">
                ✨ "Rasa Enak, Harga Bersahabat, Selalu di Hati."
              </p>
            </div>

            {/* 1. Hero Banner Promosi (Requirement 3) */}
            <div className="relative overflow-hidden rounded-3xl shadow-xl">
              <div
                className={`p-5 bg-gradient-to-r ${bannerList[activeBanner].bg} text-white flex items-center justify-between gap-4 min-h-[145px] sm:min-h-[165px] transition-all duration-500`}
              >
                <div className="flex-1 space-y-1.5 z-10">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md inline-block shadow-xs">
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
                    onClick={() => handleTabChange('menu')}
                    className="mt-2 text-xs font-bold bg-white text-gray-900 px-4 py-2 rounded-xl shadow-md hover:bg-gray-100 transition inline-flex items-center gap-1 active:scale-95 cursor-pointer"
                  >
                    {bannerList[activeBanner].actionText}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-28 sm:w-36 h-28 sm:h-36 rounded-2xl overflow-hidden shadow-inner shrink-0 rotate-1 border-2 border-white/20">
                  <img
                    src={bannerList[activeBanner].img}
                    alt="Promo Banner"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Dots Indicator */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
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

            {/* 2. Menu Akses Cepat (3 Kartu Ikon Utama: Semua Menu, Pesanan Saya, Bantuan WA) */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {/* Kartu 1: Semua Menu */}
              <button
                type="button"
                onClick={() => handleTabChange('menu')}
                className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 transition-all active:scale-95 cursor-pointer flex flex-col items-center text-center gap-1.5 group"
              >
                <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#E50914] group-hover:bg-[#E50914] group-hover:text-white transition flex items-center justify-center shadow-2xs">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-gray-800 leading-tight">
                  Semua Menu
                </span>
              </button>

              {/* Kartu 2: Pesanan Saya */}
              <button
                type="button"
                onClick={() => handleTabChange('orders')}
                className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-95 cursor-pointer flex flex-col items-center text-center gap-1.5 group"
              >
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center shadow-2xs">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-gray-800 leading-tight">
                  Pesanan Saya
                </span>
              </button>

              {/* Kartu 3: Bantuan WhatsApp */}
              <button
                type="button"
                onClick={() => handleChatKasir()}
                className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all active:scale-95 cursor-pointer flex flex-col items-center text-center gap-1.5 group"
              >
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#16A34A] group-hover:bg-[#16A34A] group-hover:text-white transition flex items-center justify-center shadow-2xs">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-gray-800 leading-tight">
                  Bantuan WA
                </span>
              </button>
            </div>

            {/* 3. Kategori Produk Horizontal (Requirement 5) */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-black text-gray-900">Kategori Pilihan</h3>
                <button
                  type="button"
                  onClick={() => handleTabChange('menu')}
                  className="text-xs font-bold text-[#E50914] hover:text-[#A80710] flex items-center gap-0.5 cursor-pointer"
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
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        if (activeTab !== 'home') handleTabChange('home');
                      }}
                      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-[#E50914] text-white shadow-md shadow-red-600/30 scale-[1.02]'
                          : 'bg-[#F5F6F8] text-gray-700 hover:bg-gray-200/80 border border-gray-200/60'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Produk Unggulan Section (Requirement 6) */}
            <div>
              {/* Tabs Produk Unggulan: Terlaris / Rekomendasi / Promo / Terbaru */}
              <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                  {[
                    { id: 'terlaris', label: '🔥 Terlaris' },
                    { id: 'rekomendasi', label: '⭐ Rekomendasi' },
                    { id: 'promo', label: '⚡ Promo Hari Ini' },
                    { id: 'terbaru', label: '🆕 Menu Baru' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFeaturedTab(t.id as FeaturedSection)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                        featuredTab === t.id
                          ? 'bg-red-50 text-[#E50914] border border-red-200'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid 2 Kolom (HP) & Responsive Grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {(featuredTab === 'terlaris'
                  ? bestSellerProducts
                  : featuredTab === 'rekomendasi'
                  ? recommendedProducts
                  : featuredTab === 'promo'
                  ? promoProducts
                  : newProducts
                ).map((p: any) => {
                  const isOut = p.stok <= 0;
                  const inCartQty = cart
                    .filter((c) => c.product.id === p.id)
                    .reduce((sum, c) => sum + c.qty, 0);

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

                        {/* Badges on product image */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {p.discountPercent ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#E50914] text-white shadow-xs">
                              DISKON {p.discountPercent}%
                            </span>
                          ) : featuredTab === 'terlaris' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#FF8A00] text-white shadow-xs">
                              ⭐ Terlaris
                            </span>
                          ) : featuredTab === 'rekomendasi' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-600 text-white shadow-xs">
                              Rekomendasi
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-600 text-white shadow-xs">
                              Menu Baru
                            </span>
                          )}
                        </div>

                        {/* Stock status indicator */}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between items-center">
                          {isOut ? (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-black/70 text-rose-300">
                              Habis
                            </span>
                          ) : p.stok <= 5 ? (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/90 text-white">
                              Sisa {p.stok}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-black/40 text-white/90">
                              Tersedia
                            </span>
                          )}
                        </div>

                        {/* Out of stock overlay */}
                        {isOut && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                            <span className="px-3 py-1 rounded-xl bg-[#E50914] text-white text-xs font-black shadow-md">
                              HABIS
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 leading-tight group-hover:text-[#E50914] transition">
                          {p.nama}
                        </h4>
                        <span className="text-[11px] text-gray-400 capitalize block mt-0.5">
                          {p.kategori}
                        </span>
                      </div>

                      {/* Price & Add to Cart Action */}
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          {p.originalPrice && (
                            <span className="text-[10px] text-gray-400 line-through block leading-none">
                              {formatRupiah(p.originalPrice)}
                            </span>
                          )}
                          <span className="text-xs sm:text-sm font-black text-[#E50914]">
                            {formatRupiah(p.harga_jual)}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={isOut}
                          onClick={(e) => handleQuickAdd(p, e)}
                          title={isOut ? 'Stok Habis' : 'Tambah ke Keranjang'}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition active:scale-90 cursor-pointer shadow-sm relative ${
                            isOut
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-[#E50914] text-white hover:bg-[#A80710] shadow-red-600/30'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          {inCartQty > 0 && (
                            <span className="absolute -top-1 -right-1 bg-[#151515] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                              {inCartQty}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Delivery Information Card */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-orange-50 via-amber-50 to-red-50 border border-orange-200/70 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#E50914] shrink-0">
                  <Bike className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-gray-900">
                    Layanan Delivery Area Pesantren DQM
                  </h4>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Minimal belanja {formatRupiah(settings.deliveryMinOrder || DELIVERY_MIN_ORDER_AMOUNT)}, pesanan diantar kurir sampai asrama atau pos tujuan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('Semua');
                  handleTabChange('menu');
                }}
                className="shrink-0 p-2 text-[#E50914] hover:text-[#A80710]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 2: MENU PRODUK (Requirement 5 & 6) ================= */}
        {activeTab === 'menu' && (
          <div className="p-4 space-y-4 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">Daftar Menu</h2>
                <p className="text-xs text-gray-500">
                  Pilihan makanan, minuman, dan sembako segar
                </p>
              </div>
              <span className="text-xs text-gray-600 font-bold bg-gray-100 px-3 py-1 rounded-full">
                {filteredProducts.length} Produk
              </span>
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
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-[#E50914] text-white shadow-sm'
                        : 'bg-[#F5F6F8] text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Sort Options */}
            <div className="flex items-center justify-between text-xs text-gray-500 bg-[#F5F6F8] px-3 py-2 rounded-xl">
              <span>Urutkan Produk:</span>
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
                  className="text-xs text-[#E50914] font-bold hover:underline"
                >
                  Reset Filter Pencarian
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {filteredProducts.map((p) => {
                  const isOut = p.stok <= 0;
                  const inCartQty = cart
                    .filter((c) => c.product.id === p.id)
                    .reduce((sum, c) => sum + c.qty, 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setIsDetailModalOpen(true);
                      }}
                      className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                    >
                      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 relative mb-2">
                        <img
                          src={p.foto || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80'}
                          alt={p.nama}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        {isOut && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="px-3 py-1 rounded-xl bg-[#E50914] text-white text-xs font-black shadow-md">
                              HABIS
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between items-center text-[9px] font-bold">
                          {!isOut && (
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-white backdrop-blur-2xs">
                              Stok {p.stok}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 leading-tight group-hover:text-[#E50914] transition">
                          {p.nama}
                        </h4>
                        <span className="text-[10px] text-gray-400 capitalize block mt-0.5">
                          {p.kategori}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-black text-[#E50914]">
                          {formatRupiah(p.harga_jual)}
                        </span>
                        <button
                          type="button"
                          disabled={isOut}
                          onClick={(e) => handleQuickAdd(p, e)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition active:scale-90 cursor-pointer shadow-sm relative ${
                            isOut
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-[#E50914] text-white hover:bg-[#A80710] shadow-red-600/30'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          {inCartQty > 0 && (
                            <span className="absolute -top-1 -right-1 bg-[#151515] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                              {inCartQty}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: KERANJANG SAYA (Requirement 8) ================= */}
        {activeTab === 'cart' && (
          <div className="p-4 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-lg font-black text-gray-900">Keranjang Belanja</h2>
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
                  onClick={() => handleTabChange('menu')}
                  className="mt-2 px-5 py-2.5 rounded-2xl bg-[#E50914] hover:bg-[#A80710] active:scale-95 text-white font-bold text-xs shadow-md shadow-red-600/20 transition cursor-pointer"
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
                            <span className="text-[11px] text-[#E50914] font-semibold block">
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

                          <div className="flex items-center gap-2 bg-[#F5F6F8] p-1 rounded-xl">
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
                              className="w-6 h-6 rounded-lg bg-[#E50914] text-white flex items-center justify-center font-bold shadow-xs hover:bg-[#A80710] active:scale-95"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Voucher Promo Trigger Strip */}
                <div
                  onClick={() => setIsPromoModalOpen(true)}
                  className="p-3 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/70 flex items-center justify-between cursor-pointer hover:shadow-xs transition"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#E50914]" />
                    <span className="text-xs font-bold text-gray-800">
                      Punya Voucher Diskon Belanja?
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#E50914] flex items-center">
                    Gunakan Voucher <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                {/* Order Summary Card */}
                <div className="p-4 rounded-3xl bg-[#F5F6F8] border border-gray-100 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal Menu</span>
                    <span className="font-bold text-gray-900">{formatRupiah(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Ongkos Kirim</span>
                    <span className="font-bold text-gray-900">
                      {currentServiceType === 'Delivery' ? 'Dihitung saat checkout' : 'Gratis (Takeaway)'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                    <span className="font-black text-gray-900">Total Belanja</span>
                    <span className="font-black text-[#E50914] text-base">
                      {formatRupiah(cartSubtotal)}
                    </span>
                  </div>
                </div>

                {/* Checkout CTA */}
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#E50914] to-[#A80710] hover:from-[#A80710] hover:to-[#151515] active:scale-[0.98] text-white font-bold text-sm sm:text-base shadow-lg shadow-red-600/30 flex items-center justify-between px-5 transition cursor-pointer"
                >
                  <span>Lanjutkan Pesanan</span>
                  <div className="flex items-center gap-1.5 font-black">
                    <span>{formatRupiah(cartSubtotal)}</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: PESANAN SAYA (Requirement 10) ================= */}
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
                        ? 'bg-[#E50914] text-white shadow-xs'
                        : 'bg-[#F5F6F8] text-gray-600 hover:bg-gray-200'
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
                  Semua pesanan yang Anda buat akan muncul di sini secara real-time dari Firebase Firestore.
                </p>
                <button
                  type="button"
                  onClick={() => handleTabChange('menu')}
                  className="px-4 py-2 rounded-2xl bg-[#E50914] text-white font-bold text-xs shadow-md shadow-red-600/20"
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
                    let badgeLabel = '🟡 Menunggu Konfirmasi';

                    if (st === 'DIPROSES') {
                      badgeClass = 'bg-blue-100 text-blue-800';
                      badgeLabel = '🔵 Sedang Diproses';
                    } else if (st === 'SIAP') {
                      badgeClass = 'bg-orange-100 text-orange-800';
                      badgeLabel = '🟠 Siap / Diantar';
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
                          <span className="font-black text-[#E50914] text-sm">
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
                            className="px-3.5 py-2 rounded-xl bg-red-50 text-[#E50914] hover:bg-red-100 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Lacak Status Real-time
                          </button>

                          <button
                            type="button"
                            onClick={() => {
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
                                handleTabChange('cart');
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

        {/* ================= TAB 5: PROFIL / AKUN PELANGGAN (Requirement 12) ================= */}
        {activeTab === 'profile' && (
          <div className="p-4 space-y-5 animate-in fade-in duration-200">
            {/* Profile Avatar Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-[#E50914] via-[#A80710] to-[#151515] text-white shadow-xl flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black shadow-inner shrink-0 border-2 border-white/40">
                {customerProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black truncate">{customerProfile.name}</h3>
                <span className="text-xs text-white/80 block font-mono">
                  {customerProfile.phone || 'Nomor WhatsApp belum disimpan'}
                </span>
                <span className="text-[11px] text-white/70 block truncate">
                  {customerProfile.savedAddress || 'Alamat belum diatur'}
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
                  <User className="w-5 h-5 text-[#E50914]" />
                  <span className="font-bold text-gray-900">Edit Profil & Data Saya</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[#E50914]" />
                  <div>
                    <span className="font-bold text-gray-900 block">Alamat Tersimpan</span>
                    <span className="text-[11px] text-gray-500 block truncate">
                      {customerProfile.savedAddress}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('orders')}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#E50914]" />
                  <span className="font-bold text-gray-900">Riwayat Pesanan Saya</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => setIsNotificationModalOpen(true)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-[#E50914]" />
                  <span className="font-bold text-gray-900">Pusat Notifikasi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadNotifCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#E50914] text-white">
                      {unreadNotifCount} baru
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFaqModalTab('faq');
                  setIsFAQModalOpen(true);
                }}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-gray-600" />
                  <span className="font-bold text-gray-900">Bantuan & FAQ</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setFaqModalTab('privacy');
                  setIsFAQModalOpen(true);
                }}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-gray-600" />
                  <span className="font-bold text-gray-900">Kebijakan Privasi</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setFaqModalTab('about');
                  setIsFAQModalOpen(true);
                }}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <BrandLogo
                    src={settings.logoUrl}
                    alt={settings.storeName || 'WARUNG BANG KOBRA'}
                    size="xs"
                    className="w-5 h-5 rounded-md"
                    border={false}
                  />
                  <span className="font-bold text-gray-900">Tentang Warung Bang Kobra</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => handleChatKasir()}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-[#16A34A]" />
                  <span className="font-bold text-gray-900">Hubungi Kasir via WhatsApp</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              {/* Reset Session */}
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('wbk_customer_cart');
                  setCart([]);
                  showToast?.('Sesi keranjang telah dibersihkan.', 'info');
                }}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition cursor-pointer text-rose-600"
              >
                <div className="flex items-center gap-3">
                  <RotateCcw className="w-5 h-5" />
                  <span className="font-bold">Reset Keranjang & Data Sesi</span>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-300" />
              </button>
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
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#E50914]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nomor WhatsApp</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#E50914] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#E50914]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Alamat Tersimpan</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#E50914]"
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
                    localStorage.setItem('wbk_customer_address', editAddress.trim());
                    setCustomerProfile({
                      name: editName.trim() || 'Pelanggan Bang Kobra',
                      phone: editPhone.trim(),
                      email: editEmail.trim(),
                      savedAddress: editAddress.trim(),
                    });
                    setIsEditProfileOpen(false);
                    showToast?.('Profil Anda berhasil diperbarui!', 'success');
                  }}
                  className="py-2.5 rounded-xl bg-[#E50914] text-white font-bold text-xs shadow-md shadow-red-600/20"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= FLOATING CART BAR ================= */}
        {cart.length > 0 && activeTab !== 'cart' && (
          <div className="fixed bottom-20 sm:bottom-22 left-0 right-0 z-40 px-4 max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto pointer-events-none">
            <div className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#E50914] via-[#A80710] to-[#151515] text-white shadow-xl shadow-red-600/40 flex items-center justify-between pointer-events-auto transition animate-in slide-in-from-bottom duration-300 ring-2 ring-white/30">
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
                  <span className="text-xs text-white/95 font-mono font-bold">
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
                  Lihat
                </button>
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="flex items-center gap-1 font-black text-xs bg-white text-[#E50914] hover:bg-gray-100 px-3.5 py-1.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                >
                  <span>Checkout</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODERN BOTTOM NAVIGATION (Requirement 11) ================= */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto shadow-lg">
          <div className="grid grid-cols-5 h-16 sm:h-18 px-1">
            {[
              { id: 'home', label: 'Beranda', icon: Home },
              { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
              { id: 'cart', label: 'Keranjang', icon: ShoppingBag, badge: cartItemCount },
              { id: 'orders', label: 'Pesanan', icon: Clock },
              { id: 'profile', label: 'Akun', icon: User },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id as TabType)}
                  className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${
                    isActive ? 'text-[#E50914] font-black' : 'text-gray-400 hover:text-gray-600 font-medium'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-[#E50914] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                  {isActive && (
                    <span className="w-5 h-0.5 bg-[#E50914] rounded-full absolute bottom-1.5" />
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
              showToast?.(`Update status pesanan: ${updated.status}`, 'info');
            }}
          />
        )}

        {/* ================= PROMO MODAL ================= */}
        <CustomerPromoModal
          isOpen={isPromoModalOpen}
          onClose={() => setIsPromoModalOpen(false)}
          onApplyPromo={(promo) => {
            showToast?.(`Kode voucher "${promo.code}" berhasil disalin dan siap digunakan!`, 'success');
          }}
          onNavigateToCategory={(cat) => {
            setSelectedCategory(cat);
            handleTabChange('menu');
          }}
          showToast={showToast}
        />

        {/* ================= NOTIFICATION MODAL ================= */}
        <CustomerNotificationModal
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onSelectOrder={(orderId) => {
            const found = myOrders.find((o) => o.id_transaksi === orderId);
            if (found) {
              setTrackedOrder(found);
              setIsTrackingModalOpen(true);
            } else {
              handleTabChange('orders');
            }
          }}
          onNavigateToPromo={() => setIsPromoModalOpen(true)}
        />

        {/* ================= ADDRESS MODAL ================= */}
        <CustomerAddressModal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          currentAddress={customerProfile.savedAddress}
          onSaveAddress={(newAddr) => {
            setCustomerProfile((prev) => ({ ...prev, savedAddress: newAddr }));
          }}
          showToast={showToast}
        />

        {/* ================= FAQ & ABOUT MODAL ================= */}
        <CustomerFAQModal
          isOpen={isFAQModalOpen}
          onClose={() => setIsFAQModalOpen(false)}
          settings={settings}
          initialTab={faqModalTab}
        />

        {/* ================= CUSTOMER SHARE MENU MODAL ================= */}
        <CustomerShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          customerUrl={customerAppUrl}
          settings={settings}
          showToast={showToast}
        />
      </div>
    </div>
  );
};

export default CustomerApp;
