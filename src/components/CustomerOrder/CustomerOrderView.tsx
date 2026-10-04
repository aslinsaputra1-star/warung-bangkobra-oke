import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  Bike,
  Store,
  Clock,
  MapPin,
  Phone,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CreditCard,
  Banknote,
  QrCode,
  Flame,
  X,
  MessageCircle,
  Loader2,
  Radio,
  BellRing,
  Layers,
  RefreshCw,
  Check,
  Calendar,
} from 'lucide-react';
import { CustomerPreOrderModal } from '../PreOrder/CustomerPreOrderModal';
import { CustomerPOTrackingModal } from '../PreOrder/CustomerPOTrackingModal';
import {
  Product,
  ProductVariant,
  StoreSettings,
  Transaction,
  OrderType,
  OrderQueueStatus,
  DeliveryStatus,
} from '../../types';
import { VARIANT_PARENT_PRODUCTS } from '../../data/initialData';
import {
  formatRupiah,
  sanitizeWhatsAppNumber,
  buildOnlineQRCodeOrderWhatsAppMessage,
  buildChatKasirWhatsAppMessage,
  openWhatsAppChat,
  getTakeawayQueueNumber,
  DQM_LOCATIONS,
  calculateDeliveryDqmFee,
  normalizeOrderQueueStatus,
  normalizeDeliveryStatus,
  getOrderStatusLabel,
  getDeliveryStatusLabel,
  DELIVERY_MIN_ORDER_AMOUNT,
  getDeliveryMinOrderValidation,
} from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import {
  saveOrderToFirebase,
  db,
} from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { BrandLogo } from '../Common/BrandLogo';
import { DeliveryMinOrderBanner } from '../Common/DeliveryMinOrderBanner';
import { DeliveryProofModal } from '../Orders/DeliveryProofModal';

interface CustomerOrderViewProps {
  products: Product[];
  variants?: ProductVariant[];
  settings: StoreSettings;
  initialOrderType?: 'Takeaway' | 'Delivery' | 'BUNGKUS' | 'DELIVERY_DQM';
  onBackToApp?: () => void;
  onOrderCreated?: (transaction: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export interface CartEntry {
  cartKey: string;
  product: Product;
  variant?: ProductVariant;
  qty: number;
  notes: string;
}

export const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({
  products,
  variants,
  settings,
  initialOrderType = 'BUNGKUS',
  onBackToApp,
  onOrderCreated,
  showToast,
}) => {
  // Mode: BUNGKUS or DELIVERY_DQM
  const [orderType, setOrderType] = useState<OrderType>(() => {
    if (initialOrderType === 'Delivery' || initialOrderType === 'DELIVERY_DQM') {
      return 'DELIVERY_DQM';
    }
    return 'BUNGKUS';
  });

  // Customer Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupTime, setPickupTime] = useState('Sekitar 15-20 menit lagi');
  const [selectedAreaOption, setSelectedAreaOption] = useState<'DQM' | 'OUTSIDE'>('DQM');
  const [deliveryLocation, setDeliveryLocation] = useState<string>(DQM_LOCATIONS[0]);
  const [deliveryDetail, setDeliveryDetail] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'QRIS'>('Cash');

  // Search and Category Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [isQrisZoomOpen, setIsQrisZoomOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Variant Selector Modal States
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [variantSearchQuery, setVariantSearchQuery] = useState('');
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);

  // Cart State: cartKey -> CartEntry
  const [cart, setCart] = useState<Record<string, CartEntry>>({});

  // UI States
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isPOTrackingOpen, setIsPOTrackingOpen] = useState(false);
  const [allTransactionsForTracking, setAllTransactionsForTracking] = useState<Transaction[]>(() =>
    StorageService.getTransactions()
  );
  const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveStatus, setLiveStatus] = useState<OrderQueueStatus>('MENUNGGU');
  const [liveDeliveryStatus, setLiveDeliveryStatus] = useState<DeliveryStatus>('MENUNGGU');
  const [isViewingCustomerProof, setIsViewingCustomerProof] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    total: number;
    whatsappMessage: string;
    createdOrder: Transaction;
  } | null>(null);

  // Real-time listener for customer order status from Firebase Firestore
  useEffect(() => {
    if (!completedOrder?.orderId) return;

    try {
      const orderRef = doc(db, 'orders', completedOrder.orderId);
      const unsubscribe = onSnapshot(
        orderRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<Transaction>;
            if (data?.status) {
              setLiveStatus(normalizeOrderQueueStatus(data.status));
            }
            if (data?.deliveryStatus) {
              setLiveDeliveryStatus(normalizeDeliveryStatus(data.deliveryStatus, data.status));
            }
            setCompletedOrder((prev) =>
              prev
                ? {
                    ...prev,
                    createdOrder: {
                      ...prev.createdOrder,
                      ...data,
                    },
                  }
                : null
            );
          }
        },
        (err) => {
          console.warn('Realtime order status listener notice:', err?.message);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn('Realtime order listener error:', err);
    }
  }, [completedOrder?.orderId]);

  // Resolved Product Variants (from props or fallback to StorageService)
  const resolvedVariants = useMemo(() => {
    const list =
      Array.isArray(variants) && variants.length > 0
        ? variants
        : StorageService.getProductVariants();
    return list.filter((v) => v && v.isActive !== false);
  }, [variants]);

  // Only active products (ensuring non-deleted variant parent products are always present)
  const activeProducts = useMemo(() => {
    const deletedProdIds = StorageService.getDeletedProductIds();
    const baseList = [...products];
    VARIANT_PARENT_PRODUCTS.forEach((vp) => {
      if (deletedProdIds.has(vp.id) || deletedProdIds.has(vp.sku)) return;
      const exists = baseList.some(
        (p) => p.id === vp.id || p.sku === vp.sku || p.nama.toUpperCase() === vp.nama.toUpperCase()
      );
      if (!exists) {
        baseList.push(vp);
      }
    });
    return baseList.filter((p) => p && p.status === 'Aktif');
  }, [products]);

  // Map active variants by product.id
  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    activeProducts.forEach((prod) => {
      const matched = resolvedVariants.filter(
        (v) =>
          v.productId === prod.id ||
          (v.productName && v.productName.toUpperCase() === prod.nama.toUpperCase())
      );
      if (matched.length > 0) {
        map.set(prod.id, matched);
      }
    });
    return map;
  }, [activeProducts, resolvedVariants]);

  const formatVariantDisplayName = (productName: string, variantName: string): string => {
    const pName = String(productName || '').trim();
    const vName = String(variantName || '').trim();
    if (!vName) return pName;
    if (vName.toLowerCase().startsWith(pName.toLowerCase())) {
      return vName;
    }
    return `${pName} - ${vName}`;
  };

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set(activeProducts.map((p) => p.kategori));
    return ['Semua', ...Array.from(cats)];
  }, [activeProducts]);

  // Filtered products (also matches variant flavor names!)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return activeProducts.filter((product) => {
      const matchCat =
        selectedCategory === 'Semua' || product.kategori === selectedCategory;
      if (!q) return matchCat;
      const prodVars = variantsByProduct.get(product.id) || [];
      const matchVariant = prodVars.some(
        (v) =>
          (v.variantName || '').toLowerCase().includes(q) ||
          (v.sku || '').toLowerCase().includes(q)
      );
      const matchQuery =
        product.nama.toLowerCase().includes(q) ||
        (product.deskripsi && product.deskripsi.toLowerCase().includes(q)) ||
        matchVariant;
      return matchCat && matchQuery;
    });
  }, [activeProducts, variantsByProduct, selectedCategory, searchQuery]);

  // Cart calculations
  const cartItems: CartEntry[] = useMemo(() => Object.values(cart), [cart]);
  const totalCartCount: number = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const cartSubtotal: number = cartItems.reduce((sum, item) => {
    const unitPrice = item.variant ? item.variant.price : item.product.harga_jual;
    return sum + item.qty * unitPrice;
  }, 0);

  // Delivery fee configured by Owner in Settings -> Delivery DQM
  const deliveryFee: number = calculateDeliveryDqmFee(settings, orderType);
  const grandTotal: number = cartSubtotal + deliveryFee;

  const getCartKey = (productId: string, variantId?: string) =>
    variantId ? `${productId}__${variantId}` : productId;

  // Add / Remove from Cart
  const handleAddToCart = (product: Product, specificVariant?: ProductVariant) => {
    const prodVars = variantsByProduct.get(product.id) || [];
    if (prodVars.length > 0 && !specificVariant) {
      setEditingCartKey(null);
      setVariantSearchQuery('');
      setVariantModalProduct(product);
      return;
    }

    if (specificVariant) {
      if (specificVariant.stock <= 0) {
        if (showToast) {
          showToast(`Stok varian ${specificVariant.variantName} habis!`, 'error');
        }
        return;
      }

      if (editingCartKey) {
        const newKey = getCartKey(product.id, specificVariant.variantId);
        setCart((prev) => {
          const oldEntry = prev[editingCartKey];
          if (!oldEntry) return prev;
          const next = { ...prev };
          delete next[editingCartKey];
          const existingTarget = next[newKey];
          const combinedQty = Math.min(
            specificVariant.stock,
            oldEntry.qty + (existingTarget ? existingTarget.qty : 0)
          );
          next[newKey] = {
            cartKey: newKey,
            product,
            variant: specificVariant,
            qty: combinedQty,
            notes: oldEntry.notes || existingTarget?.notes || '',
          };
          return next;
        });
        setEditingCartKey(null);
        setVariantModalProduct(null);
        if (showToast) {
          showToast(
            `Varian diubah ke ${formatVariantDisplayName(product.nama, specificVariant.variantName)}`,
            'success'
          );
        }
        return;
      }

      const key = getCartKey(product.id, specificVariant.variantId);
      setCart((prev) => {
        const current = prev[key];
        const currentQty = current ? current.qty : 0;
        if (currentQty + 1 > specificVariant.stock) {
          if (showToast) {
            showToast(
              `Stok maksimal ${formatVariantDisplayName(product.nama, specificVariant.variantName)} tersisa ${specificVariant.stock}`,
              'error'
            );
          }
          return prev;
        }
        return {
          ...prev,
          [key]: {
            cartKey: key,
            product,
            variant: specificVariant,
            qty: currentQty + 1,
            notes: current ? current.notes : '',
          },
        };
      });
      if (showToast) {
        showToast(
          `${formatVariantDisplayName(product.nama, specificVariant.variantName)} ditambahkan!`,
          'success'
        );
      }
      return;
    }

    if (product.stok <= 0) return;
    const key = getCartKey(product.id);
    setCart((prev) => {
      const current = prev[key];
      const newQty = (current ? current.qty : 0) + 1;
      return {
        ...prev,
        [key]: {
          cartKey: key,
          product,
          qty: newQty,
          notes: current ? current.notes : '',
        },
      };
    });
  };

  const handleUpdateQty = (cartKey: string, delta: number) => {
    setCart((prev) => {
      const current = prev[cartKey];
      if (!current) return prev;
      const maxStock = current.variant ? current.variant.stock : current.product.stok;
      const newQty = current.qty + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[cartKey];
        return copy;
      }
      if (delta > 0 && newQty > maxStock) {
        if (showToast) {
          showToast(`Stok maksimal tersisa ${maxStock}`, 'error');
        }
        return prev;
      }
      return {
        ...prev,
        [cartKey]: {
          ...current,
          qty: newQty,
        },
      };
    });
  };

  const handleSaveItemNote = (cartKey: string) => {
    setCart((prev) => {
      if (!prev[cartKey]) return prev;
      return {
        ...prev,
        [cartKey]: {
          ...prev[cartKey],
          notes: tempNoteText,
        },
      };
    });
    setActiveNoteItemId(null);
    setTempNoteText('');
  };

  // Submit Order via Firebase & WhatsApp & Store in POS Local Database
  const handleSubmitOrder = async () => {
    if (cartItems.length === 0) {
      if (showToast) showToast('Keranjang masih kosong, pilih menu terlebih dahulu!', 'error');
      return;
    }

    if (!customerName.trim()) {
      if (showToast) showToast('Silakan isi Nama Pemesan terlebih dahulu!', 'error');
      setIsCartOpen(true);
      return;
    }

    if (!customerPhone.trim()) {
      if (showToast) showToast('Silakan isi Nomor WhatsApp Anda!', 'error');
      setIsCartOpen(true);
      return;
    }

    if (orderType === 'DELIVERY_DQM') {
      const minOrderCheck = getDeliveryMinOrderValidation(cartSubtotal);
      if (!minOrderCheck.isMet) {
        if (showToast) {
          showToast(minOrderCheck.warningMessage, 'error');
        }
        return;
      }
      if (selectedAreaOption !== 'DQM') {
        if (showToast) showToast('Delivery hanya tersedia untuk area Pesantren DQM.', 'error');
        setIsCartOpen(true);
        return;
      }
      if (!deliveryLocation.trim() || !deliveryDetail.trim()) {
        if (showToast) {
          showToast('Silakan lengkapi Lokasi DQM dan Detail Lokasi (Kamar/Asrama)!', 'error');
        }
        setIsCartOpen(true);
        return;
      }
    }

    setIsSubmitting(true);

    const isDelivery = orderType === 'DELIVERY_DQM';
    const orderId = StorageService.generateInvoiceNumber('WBK');

    const now = new Date();
    const tanggal = now.toISOString().split('T')[0];
    const jam = now.toTimeString().split(' ')[0];

    // Format items for message & transaction (supporting product variants)
    const itemsFormatted = cartItems.map((item, idx) => {
      const unitPrice = item.variant ? item.variant.price : item.product.harga_jual;
      const unitCost = item.variant ? item.variant.costPrice : item.product.harga_modal;
      const displayName = item.variant
        ? formatVariantDisplayName(item.product.nama, item.variant.variantName)
        : item.product.nama;
      return {
        id_detail: `DET-${orderId}-${idx + 1}`,
        id_transaksi: orderId,
        id_produk: item.product.id,
        nama_produk: displayName,
        productName: item.product.nama,
        variantId: item.variant?.variantId,
        variantName: item.variant?.variantName,
        harga_modal: unitCost,
        harga: unitPrice,
        qty: item.qty,
        subtotal: item.qty * unitPrice,
        catatan: item.notes || undefined,
      };
    });

    const combinedNote = isDelivery
      ? deliveryNote.trim() || generalNotes.trim()
      : generalNotes.trim();

    // Build Transaction object to store into Warung POS (Section 9 Database Order specification)
    const newTx: Transaction = {
      id_transaksi: orderId,
      tanggal,
      jam,
      kasir: 'QR Menu Warung Bang Kobra',
      nama_pelanggan: customerName.trim(),
      no_whatsapp: sanitizeWhatsAppNumber(customerPhone.trim()),
      subtotal: cartSubtotal,
      diskon: 0,
      biaya: isDelivery ? deliveryFee : 0,
      total: grandTotal,
      metode_pembayaran: paymentMethod,
      uang_diterima: 0,
      kembalian: 0,
      status: 'MENUNGGU',
      items: itemsFormatted,
      created_at: now.toISOString(),
      orderType: orderType,
      tipe_pesanan: orderType,
      deliveryArea: isDelivery ? 'DQM' : null,
      deliveryLocation: isDelivery ? deliveryLocation.trim() : null,
      deliveryDetail: isDelivery ? deliveryDetail.trim() : null,
      deliveryNote: isDelivery ? combinedNote : null,
      deliveryFee: isDelivery ? deliveryFee : 0,
      deliveryStatus: isDelivery ? 'MENUNGGU' : null,
      alamat_pengantaran: isDelivery
        ? `Pesantren DQM - ${deliveryLocation.trim()} (${deliveryDetail.trim()})`
        : undefined,
      catatan_pesanan: combinedNote || undefined,
    };

    // 1. Send Order to Firebase Firestore (CHECKOUT -> FIREBASE -> ANTRIAN KASIR)
    const fbResult = await saveOrderToFirebase(newTx);
    if (fbResult.success) {
      console.log('Pesanan berhasil tersimpan di Firebase Firestore:', orderId);
    } else {
      console.warn('Gagal menyimpan ke Firebase Firestore:', fbResult.error);
    }

    // 2. Save into Local POS Database & trigger callback
    try {
      StorageService.completeTransaction(newTx);
      if (onOrderCreated) {
        onOrderCreated(newTx);
      }
    } catch (err) {
      console.error('Failed to auto-save transaction locally:', err);
    }

    // Build WhatsApp message
    const paymentLabel =
      paymentMethod === 'Cash'
        ? isDelivery
          ? 'Bayar Tunai saat Diantar (COD DQM)'
          : 'Bayar Tunai di Kasir saat Ambil'
        : paymentMethod === 'Transfer'
        ? 'Transfer Bank'
        : 'QRIS Warung';

    const waMessage = buildOnlineQRCodeOrderWhatsAppMessage({
      orderId,
      storeName: settings.storeName || 'Warung Bang Kobra',
      orderType,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      pickupTime: !isDelivery ? pickupTime : undefined,
      deliveryArea: isDelivery ? 'DQM' : null,
      deliveryLocation: isDelivery ? deliveryLocation.trim() : null,
      deliveryDetail: isDelivery ? deliveryDetail.trim() : null,
      deliveryFee: isDelivery ? deliveryFee : 0,
      paymentMethod: paymentLabel,
      notes: combinedNote,
      items: cartItems.map((item) => ({
        name: item.variant
          ? formatVariantDisplayName(item.product.nama, item.variant.variantName)
          : item.product.nama,
        qty: item.qty,
        price: item.variant ? item.variant.price : item.product.harga_jual,
        notes: item.notes,
      })),
      subtotal: cartSubtotal,
      total: grandTotal,
    });

    setLiveStatus('MENUNGGU');
    setLiveDeliveryStatus('MENUNGGU');
    setCompletedOrder({
      orderId,
      total: grandTotal,
      whatsappMessage: waMessage,
      createdOrder: newTx,
    });

    setIsSubmitting(false);
    setIsCartOpen(false);

    if (showToast) {
      showToast('Pesanan berhasil terkirim ke ANTRIAN KASIR Warung Bang Kobra!', 'success');
    }
  };

  // Reset order state for another purchase
  const handleResetOrder = () => {
    setCart({});
    setCompletedOrder(null);
    setGeneralNotes('');
  };

  // Direct WhatsApp Chat with Kasir WARUNG BANG KOBRA
  const handleChatKasir = () => {
    const waNumber = settings.whatsappNumber || '';
    if (!waNumber) {
      if (showToast) {
        showToast('Nomor WhatsApp kasir belum diatur di Pengaturan.', 'error');
      }
      return;
    }

    const cartItemList = cartItems.map((ci) => ({
      name: ci.variant
        ? formatVariantDisplayName(ci.product.nama, ci.variant.variantName)
        : ci.product.nama,
      qty: ci.qty,
      price: ci.variant ? ci.variant.price : ci.product.harga_jual,
      notes: ci.notes,
    }));

    const message = buildChatKasirWhatsAppMessage({
      storeName: settings.storeName || 'WARUNG BANG KOBRA',
      order: completedOrder ? completedOrder.createdOrder : null,
      cartItems: cartItemList.length > 0 ? cartItemList : undefined,
      customerName: customerName.trim() || undefined,
      orderType,
    });

    openWhatsAppChat(waNumber, message);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans antialiased selection:bg-orange-500 selection:text-stone-950">
      {/* Sleek Sticky Glassmorphic Top Bar */}
      <header className="sticky top-0 z-30 h-16 bg-stone-950/85 backdrop-blur-xl border-b border-stone-800/80">
        <div className="max-w-4xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo
              src={settings.logoUrl}
              alt={settings.storeName}
              size="md"
              rounded="rounded-xl"
              className="shadow-lg shadow-orange-950/30 ring-1 ring-stone-800 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-sm sm:text-base text-white tracking-tight truncate">
                  {settings.storeName || 'Warung Bang Kobra'}
                </h1>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-md shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Buka
                </span>
              </div>
              <p className="text-[11px] text-stone-400 truncate mt-0.5">
                {settings.tagline || 'Pesan Mandiri Cepat Tanpa Antre'}
              </p>
            </div>
          </div>

          {/* Right Action Buttons: PO + Chat Kasir & Cart Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btn-preorder-header"
              onClick={() => setIsPOModalOpen(true)}
              className="h-10 px-3 rounded-xl font-extrabold text-xs flex items-center gap-1.5 bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/50 hover:to-amber-600/50 border border-red-500/40 text-amber-300 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Formulir Pemesanan Pre-Order Acara & Porsi Besar"
            >
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">Pre-Order Acara</span>
              <span className="md:hidden">PO</span>
            </button>

            <button
              type="button"
              id="btn-chat-kasir-header"
              onClick={handleChatKasir}
              className="h-10 px-3 sm:px-3.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Chat Kasir WARUNG BANG KOBRA via WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Chat Kasir</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className={`relative h-10 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                totalCartCount > 0
                  ? 'bg-orange-500 hover:bg-orange-400 text-stone-950 shadow-lg shadow-orange-950/50'
                  : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Keranjang</span>
              {totalCartCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-stone-950 text-orange-400 font-mono font-extrabold text-[11px] tabular-nums">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Order Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-5 space-y-5 pb-32">
        {/* Storefront Editorial Hero & Service Switcher */}
        <div className="relative overflow-hidden bg-stone-900/90 border border-stone-800/90 rounded-3xl p-5 sm:p-6 shadow-2xl">
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-amber-500/5 blur-3xl" />

          <div className="relative z-10 space-y-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-widest text-orange-400 uppercase bg-orange-500/10 px-2.5 py-1 rounded-md border border-orange-500/20">
                  Self-Order Digital Menu
                </span>
                <span className="text-[11px] text-stone-400 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Langsung masuk ke layar Kasir</span>
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Pesan Menu Favorit Tanpa Antre
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-2xl">
                Pilih layanan <strong className="text-stone-200">Bungkus (Takeaway)</strong> atau{' '}
                <strong className="text-stone-200">Delivery Area Pesantren DQM</strong>, lalu tentukan menu pilihan Anda.
              </p>
            </div>

            {/* Service Switcher: BUNGKUS vs DELIVERY DQM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1.5 bg-stone-950/90 rounded-2xl border border-stone-800/90">
              <button
                type="button"
                id="btn-select-takeaway"
                onClick={() => setOrderType('BUNGKUS')}
                className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                  orderType === 'BUNGKUS'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 shadow-lg shadow-orange-950/40'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    orderType === 'BUNGKUS'
                      ? 'bg-stone-950/15 text-stone-950'
                      : 'bg-stone-900 text-orange-400 border border-stone-800'
                  }`}
                >
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs sm:text-sm tracking-tight">
                      BUNGKUS (TAKEAWAY)
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                        orderType === 'BUNGKUS'
                          ? 'bg-stone-950/20 text-stone-950'
                          : 'bg-stone-900 text-stone-400'
                      }`}
                    >
                      Tanpa Min. Order
                    </span>
                  </div>
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      orderType === 'BUNGKUS' ? 'text-stone-900 font-medium' : 'text-stone-500'
                    }`}
                  >
                    Ambil langsung di kasir warung
                  </p>
                </div>
              </button>

              <button
                type="button"
                id="btn-select-delivery"
                onClick={() => setOrderType('DELIVERY_DQM')}
                className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                  orderType === 'DELIVERY_DQM'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 shadow-lg shadow-emerald-950/40'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    orderType === 'DELIVERY_DQM'
                      ? 'bg-stone-950/15 text-stone-950'
                      : 'bg-stone-900 text-emerald-400 border border-stone-800'
                  }`}
                >
                  <Bike className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs sm:text-sm tracking-tight">
                      DELIVERY DQM
                    </span>
                    <span
                      className={`text-[10px] font-mono font-black uppercase px-1.5 py-0.5 rounded ${
                        orderType === 'DELIVERY_DQM'
                          ? 'bg-stone-950/20 text-stone-950'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      Min. {formatRupiah(DELIVERY_MIN_ORDER_AMOUNT)}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      orderType === 'DELIVERY_DQM' ? 'text-stone-900 font-medium' : 'text-stone-500'
                    }`}
                  >
                    Diantar ke Asrama / Gedung DQM
                  </p>
                </div>
              </button>
            </div>

            {/* Quick Notice Info & Delivery Minimum Order Status */}
            {orderType === 'BUNGKUS' ? (
              <div className="flex items-center justify-between gap-3 text-xs text-stone-300 bg-stone-950/70 px-3.5 py-2.5 rounded-xl border border-stone-800/80">
                <span className="flex items-center gap-2 min-w-0">
                  <Store className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="truncate">
                    Ambil pesanan di{' '}
                    <strong className="text-stone-100">
                      {settings.address || settings.storeAddress || 'Warung Bang Kobra'}
                    </strong>
                  </span>
                </span>
                <span className="text-[11px] font-bold text-orange-400 shrink-0">Siap 10-15 Menit</span>
              </div>
            ) : (
              <DeliveryMinOrderBanner
                subtotal={cartSubtotal}
                variant="page"
                deliveryFee={deliveryFee}
              />
            )}

            {/* Pre-Order Acara Banner */}
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-red-950/60 via-stone-900 to-amber-950/60 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-2 flex-wrap">
                    <span>Pesanan Acara / Katering Porsi Besar?</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-600/30 text-amber-300 border border-red-500/40">
                      Pre-Order (PO)
                    </span>
                  </h4>
                  <p className="text-[11px] text-stone-400 truncate mt-0.5">
                    Pesan H-1 untuk pengajian, rapat kantor, santri DQM, ulang tahun & katering.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPOModalOpen(true)}
                  className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs transition shadow-md cursor-pointer whitespace-nowrap"
                >
                  Formulir PO
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAllTransactionsForTracking(StorageService.getTransactions());
                    setIsPOTrackingOpen(true);
                  }}
                  className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition border border-stone-700 cursor-pointer whitespace-nowrap"
                >
                  Lacak PO
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Store Announcement if configured */}
        {(settings.onlineMenuBannerText || settings.onlineMenuAnnouncement) && (
          <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center gap-2.5 text-xs text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold">{settings.onlineMenuBannerText || settings.onlineMenuAnnouncement}</span>
          </div>
        )}

        {/* Sticky Search, Layout Toggle & Categories */}
        <div className="sticky top-16 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2.5 bg-stone-950/90 backdrop-blur-xl border-b sm:border-b-0 border-stone-800/70 space-y-2.5">
          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="text"
                placeholder="Cari menu favorit, minuman, atau cemilan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-stone-900/90 border border-stone-800 rounded-xl pl-10 pr-9 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Layout Mode Switcher */}
            <div className="flex items-center p-1 bg-stone-900 border border-stone-800 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  layoutMode === 'grid'
                    ? 'bg-stone-800 text-orange-400 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  layoutMode === 'list'
                    ? 'bg-stone-800 text-orange-400 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Ringkas
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl whitespace-nowrap font-bold text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500 text-stone-950 shadow-md shadow-orange-950/30'
                      : 'bg-stone-900/90 text-stone-400 hover:text-stone-200 border border-stone-800/90'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Catalog Grid / List */}
        {filteredProducts.length === 0 ? (
          <div className="bg-stone-900/50 border border-stone-800/80 rounded-3xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-800/80 border border-stone-700/60 flex items-center justify-center mx-auto text-stone-400">
              <Search className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-stone-200 text-sm">Menu tidak ditemukan</h3>
              <p className="text-xs text-stone-500">
                Coba kata kunci lain atau tampilkan semua kategori menu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Semua');
              }}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold text-orange-400 transition cursor-pointer"
            >
              Reset Pencarian
            </button>
          </div>
        ) : (
          <div
            className={
              layoutMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5'
                : 'space-y-2.5'
            }
          >
            {filteredProducts.map((product) => {
              const prodVars = variantsByProduct.get(product.id) || [];
              const hasVars = prodVars.length > 0;
              const effectiveStock = hasVars
                ? prodVars.reduce((sum, v) => sum + Math.max(0, Number(v.stock || 0)), 0)
                : product.stok;
              const minPrice = hasVars
                ? Math.min(...prodVars.map((v) => Number(v.price || product.harga_jual)))
                : product.harga_jual;
              const maxPrice = hasVars
                ? Math.max(...prodVars.map((v) => Number(v.price || product.harga_jual)))
                : product.harga_jual;

              const inCart = !hasVars ? cart[product.id] : undefined;
              const productVariantCartCount = hasVars
                ? cartItems
                    .filter((ci) => ci.product.id === product.id)
                    .reduce((s, ci) => s + ci.qty, 0)
                : 0;
              const totalProductQty = hasVars ? productVariantCartCount : inCart?.qty || 0;
              const isOutOfStock = effectiveStock <= 0;
              const hasValidPhoto = Boolean(product.foto && !failedImages[product.id]);

              const q = searchQuery.toLowerCase().trim();
              const sortedPreviewVars = hasVars
                ? [...prodVars].sort((a, b) => {
                    if (!q) return 0;
                    const aMatch = a.variantName.toLowerCase().includes(q) ? -1 : 0;
                    const bMatch = b.variantName.toLowerCase().includes(q) ? -1 : 0;
                    return aMatch - bMatch;
                  })
                : [];

              return (
                <div
                  key={product.id}
                  className={`group bg-stone-900/90 border rounded-2xl p-3.5 flex gap-3.5 transition-all duration-200 menu-card-hover ${
                    totalProductQty > 0
                      ? 'border-orange-500/50 bg-stone-900 shadow-lg shadow-orange-950/15'
                      : 'border-stone-800/90 hover:border-stone-700'
                  }`}
                >
                  {/* Product Visual */}
                  <div
                    onClick={() => {
                      if (hasVars) {
                        setEditingCartKey(null);
                        setVariantSearchQuery('');
                        setVariantModalProduct(product);
                      }
                    }}
                    className={`${
                      layoutMode === 'list' ? 'w-20 h-20' : 'w-24 h-24 sm:w-28 sm:h-28'
                    } rounded-xl overflow-hidden bg-stone-950 shrink-0 relative border border-stone-800/90 ${
                      hasVars ? 'cursor-pointer' : ''
                    }`}
                  >
                    {hasValidPhoto ? (
                      <img
                        src={product.foto}
                        alt={product.nama}
                        loading="lazy"
                        className={`w-full h-full object-cover transition-transform duration-500 ${
                          isOutOfStock ? 'grayscale opacity-50' : 'group-hover:scale-105'
                        }`}
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                        }
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 flex flex-col items-center justify-center p-2 text-center select-none">
                        <svg
                          viewBox="0 0 64 64"
                          className="w-9 h-9 text-orange-500/40 mb-1"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        >
                          <path
                            d="M12 36h40c0 11-9 18-20 18S12 47 12 36Z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M8 36h48M22 26c0-3 2-5 2-8M32 24c0-3 2-5 2-8M42 26c0-3 2-5 2-8"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500 line-clamp-1">
                          {product.kategori}
                        </span>
                      </div>
                    )}

                    {hasVars && (
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-stone-950/90 backdrop-blur-md text-amber-400 border border-amber-500/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center justify-center gap-1">
                        <Layers className="w-2.5 h-2.5 shrink-0" />
                        <span>{prodVars.length} Rasa</span>
                      </div>
                    )}

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-stone-950/75 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider bg-rose-950/90 px-2 py-0.5 rounded-md border border-rose-800">
                          Habis
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Info (Clean 3-Data-Point Hierarchy) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          {product.kategori}
                        </span>
                        {totalProductQty > 0 && (
                          <span className="text-[10px] font-mono font-extrabold bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-md tabular-nums">
                            {totalProductQty}x di keranjang
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm sm:text-base text-white leading-snug line-clamp-2 mt-0.5">
                        {product.nama}
                      </h3>

                      {product.deskripsi && layoutMode === 'grid' && (
                        <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">
                          {product.deskripsi}
                        </p>
                      )}

                      {/* Variant Quick Chips */}
                      {hasVars && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {sortedPreviewVars.slice(0, 3).map((v) => {
                            const vKey = getCartKey(product.id, v.variantId);
                            const vInCart = cart[vKey];
                            const vOut = v.stock <= 0;
                            return (
                              <button
                                key={v.variantId}
                                type="button"
                                disabled={vOut}
                                onClick={() => handleAddToCart(product, v)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition flex items-center gap-1 cursor-pointer ${
                                  vOut
                                    ? 'bg-stone-950/40 border-stone-800/50 text-stone-600 line-through cursor-not-allowed'
                                    : vInCart
                                    ? 'bg-orange-500 text-stone-950 border-orange-400 font-extrabold'
                                    : 'bg-stone-950 hover:bg-stone-800 border-stone-800 text-stone-300 hover:border-orange-500/40'
                                }`}
                              >
                                <span className="truncate max-w-[90px]">{v.variantName}</span>
                                {vInCart ? (
                                  <span className="font-mono text-[9px] font-black">
                                    {vInCart.qty}x
                                  </span>
                                ) : (
                                  <Plus className="w-2.5 h-2.5 opacity-70 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                          {prodVars.length > 3 && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCartKey(null);
                                setVariantSearchQuery('');
                                setVariantModalProduct(product);
                              }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-950 border border-stone-800 text-orange-400 hover:border-orange-500/40 cursor-pointer"
                            >
                              +{prodVars.length - 3} rasa
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Price & Action Row */}
                    <div className="flex items-end justify-between gap-2 mt-3 pt-2 border-t border-stone-800/60">
                      <div>
                        {hasVars && minPrice !== maxPrice ? (
                          <>
                            <span className="text-[10px] text-stone-500 font-semibold block leading-none mb-0.5">
                              Harga Varian
                            </span>
                            <span className="font-mono font-extrabold text-amber-400 text-sm sm:text-base tabular-nums">
                              {formatRupiah(minPrice)} - {formatRupiah(maxPrice)}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono font-extrabold text-amber-400 text-sm sm:text-base tabular-nums">
                            {formatRupiah(minPrice)}
                          </span>
                        )}
                      </div>

                      {isOutOfStock ? (
                        <span className="text-[11px] text-stone-500 font-bold px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800">
                          Stok Habis
                        </span>
                      ) : hasVars ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCartKey(null);
                            setVariantSearchQuery('');
                            setVariantModalProduct(product);
                          }}
                          className="h-9 px-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>
                            {productVariantCartCount > 0
                              ? `Varian (${productVariantCartCount})`
                              : 'Pilih Rasa'}
                          </span>
                        </button>
                      ) : inCart ? (
                        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-orange-500/40">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(product.id, -1)}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center transition cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-extrabold text-xs text-orange-400 w-6 text-center tabular-nums">
                            {inCart.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(product.id, 1)}
                            className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold flex items-center justify-center transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(product)}
                          className="h-9 px-3.5 rounded-xl bg-stone-800 hover:bg-orange-500 text-orange-400 hover:text-stone-950 border border-stone-700 hover:border-orange-400 font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      )}
                    </div>

                    {/* Item Note Trigger */}
                    {inCart && (
                      <div className="mt-2 pt-1.5 border-t border-stone-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-stone-400 truncate max-w-[160px]">
                          {inCart.notes ? `Catatan: "${inCart.notes}"` : 'Tambah catatan khusus?'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveNoteItemId(product.id);
                            setTempNoteText(inCart.notes || '');
                          }}
                          className="text-orange-400 hover:text-orange-300 font-bold cursor-pointer"
                        >
                          {inCart.notes ? 'Edit' : '+ Catatan'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Variant Selector Modal (Pilih Varian Rasa) */}
      {variantModalProduct && (() => {
        const modalVars = variantsByProduct.get(variantModalProduct.id) || [];
        const qVar = variantSearchQuery.toLowerCase().trim();
        const filteredModalVars = modalVars.filter(
          (v) =>
            !qVar ||
            v.variantName.toLowerCase().includes(qVar) ||
            (v.sku || '').toLowerCase().includes(qVar)
        );
        const totalSelectedForProduct = cartItems
          .filter((ci) => ci.product.id === variantModalProduct.id)
          .reduce((s, ci) => s + ci.qty, 0);

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
            onClick={() => {
              setVariantModalProduct(null);
              setEditingCartKey(null);
            }}
          >
            <div
              className="bg-stone-900 border-t sm:border border-stone-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {variantModalProduct.foto ? (
                    <img
                      src={variantModalProduct.foto}
                      alt={variantModalProduct.nama}
                      className="w-11 h-11 rounded-xl object-cover border border-stone-800 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {editingCartKey ? 'Ganti Varian Rasa' : 'Pilih Varian Rasa'}
                      </span>
                      <span className="text-[11px] text-stone-400 font-bold">
                        {modalVars.length} Varian
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-stone-100 truncate mt-0.5">
                      {variantModalProduct.nama}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVariantModalProduct(null);
                    setEditingCartKey(null);
                  }}
                  className="w-8 h-8 rounded-full bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalVars.length > 4 && (
                <div className="px-4 pt-3 pb-1 bg-stone-900 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={variantSearchQuery}
                      onChange={(e) => setVariantSearchQuery(e.target.value)}
                      placeholder={`Cari varian rasa ${variantModalProduct.nama}...`}
                      className="w-full pl-10 pr-8 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                    />
                    {variantSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setVariantSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 overflow-y-auto flex-1 space-y-2">
                {filteredModalVars.length === 0 ? (
                  <div className="text-center py-8 text-xs text-stone-400">
                    Tidak ada varian rasa yang cocok.
                  </div>
                ) : (
                  filteredModalVars.map((variant) => {
                    const vKey = getCartKey(variantModalProduct.id, variant.variantId);
                    const inCartEntry = cart[vKey];
                    const isOut = variant.stock <= 0;

                    return (
                      <div
                        key={variant.variantId}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isOut
                            ? 'bg-stone-950/40 border-stone-800/50 opacity-60'
                            : inCartEntry
                            ? 'bg-amber-500/10 border-amber-500/50'
                            : 'bg-stone-950 border-stone-800 hover:border-amber-500/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-stone-100">
                              {variant.variantName}
                            </span>
                            {inCartEntry && (
                              <span className="text-[10px] font-black bg-amber-500 text-stone-950 px-1.5 py-0.5 rounded">
                                {inCartEntry.qty}x
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span className="font-black text-amber-400">
                              {formatRupiah(variant.price)}
                            </span>
                            <span className="text-stone-600">•</span>
                            <span className={isOut ? 'text-rose-400 font-bold' : 'text-stone-400'}>
                              {isOut ? 'Stok Habis' : `Stok: ${variant.stock}`}
                            </span>
                          </div>
                        </div>

                        {isOut ? (
                          <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl shrink-0">
                            Habis
                          </span>
                        ) : editingCartKey ? (
                          <button
                            type="button"
                            onClick={() => handleAddToCart(variantModalProduct, variant)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Pilih Rasa Ini</span>
                          </button>
                        ) : inCartEntry ? (
                          <div className="flex items-center gap-1.5 bg-stone-900 border border-amber-500/40 p-1 rounded-xl shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(vKey, -1)}
                              className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-black text-amber-400 min-w-[20px] text-center">
                              {inCartEntry.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(vKey, 1)}
                              className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddToCart(variantModalProduct, variant)}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs flex items-center gap-1 shadow-sm cursor-pointer active:scale-95 transition shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-stone-300">
                  {totalSelectedForProduct > 0 ? (
                    <span>
                      <strong className="text-amber-400 font-black">{totalSelectedForProduct} porsi</strong>{' '}
                      {variantModalProduct.nama} dipilih
                    </span>
                  ) : (
                    <span className="text-stone-400">Pilih satu atau beberapa varian rasa</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVariantModalProduct(null);
                    setEditingCartKey(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Chat Kasir Widget */}
      {!isCartOpen && !completedOrder && (
        <button
          type="button"
          id="btn-chat-kasir-fab"
          onClick={handleChatKasir}
          className={`fixed right-4 sm:right-6 z-30 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs shadow-xl shadow-emerald-950/60 border border-emerald-300/40 transition-all duration-200 active:scale-95 cursor-pointer ${
            totalCartCount > 0 ? 'bottom-24' : 'bottom-6'
          }`}
          title="Chat Kasir WARUNG BANG KOBRA via WhatsApp"
        >
          <MessageCircle className="w-4 h-4 fill-stone-950" />
          <span>Chat Kasir</span>
        </button>
      )}

      {/* Floating Bottom Cart Bar */}
      {totalCartCount > 0 && !isCartOpen && !completedOrder && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto space-y-2 animate-slide-up-bounce">
          {orderType === 'DELIVERY_DQM' && (
            <DeliveryMinOrderBanner
              subtotal={cartSubtotal}
              variant="cart-bar"
              deliveryFee={deliveryFee}
            />
          )}
          <button
            type="button"
            id="btn-open-cart"
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-stone-900/95 hover:bg-stone-900 text-white p-2.5 pr-4 rounded-2xl shadow-2xl shadow-black/80 border border-orange-500/50 backdrop-blur-xl flex items-center justify-between transition-all duration-200 active:scale-[0.98] cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-stone-950 flex items-center justify-center font-mono font-extrabold text-sm shadow-md shadow-orange-950/40 tabular-nums">
                {totalCartCount}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold tracking-tight text-white">
                    Lanjut ke Checkout
                  </span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                    {orderType === 'BUNGKUS' ? 'Bungkus' : 'Delivery DQM'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 font-medium mt-0.5">
                  {totalCartCount} item dipilih • Ketuk untuk kirim pesanan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="block text-[10px] text-stone-400 font-medium leading-none">
                  Total
                </span>
                <span className="font-mono text-sm sm:text-base font-extrabold text-amber-400 tabular-nums">
                  {formatRupiah(grandTotal)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-orange-500 text-stone-950 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Cart & Checkout Modal / Bottom Sheet */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setIsCartOpen(false)}
        >
          <div
            className="bg-stone-900 border-t sm:border border-stone-800 w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-6 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-stone-950 border-b border-stone-800/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold">
                  {orderType === 'BUNGKUS' ? (
                    <ShoppingBag className="w-5 h-5" />
                  ) : (
                    <Bike className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-white tracking-tight">
                    Checkout Pesanan Online
                  </h3>
                  <p className="text-xs text-stone-400">
                    {settings.storeName || 'Warung Bang Kobra'} •{' '}
                    <strong className="text-orange-400">
                      {orderType === 'BUNGKUS' ? 'Bungkus (Takeaway)' : 'Delivery Area DQM'}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-800/90 text-stone-400 hover:text-white flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Step 1: PILIH JENIS PESANAN */}
              <div className="bg-stone-950/90 p-4 rounded-2xl border border-stone-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-mono text-[10px]">
                      1
                    </span>
                    Metode Layanan
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOrderType('BUNGKUS')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                      orderType === 'BUNGKUS'
                        ? 'bg-orange-500/15 border-orange-500 text-white'
                        : 'bg-stone-900/70 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <ShoppingBag
                      className={`w-4 h-4 shrink-0 ${
                        orderType === 'BUNGKUS' ? 'text-orange-400' : 'text-stone-500'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-extrabold">BUNGKUS</div>
                      <div className="text-[10px] text-stone-400">Ambil di Kasir</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('DELIVERY_DQM')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                      orderType === 'DELIVERY_DQM'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white'
                        : 'bg-stone-900/70 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Bike
                      className={`w-4 h-4 shrink-0 ${
                        orderType === 'DELIVERY_DQM' ? 'text-emerald-400' : 'text-stone-500'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-extrabold">DELIVERY DQM</div>
                      <div className="text-[10px] text-stone-400">Khusus Area DQM</div>
                    </div>
                  </button>
                </div>

                {orderType === 'BUNGKUS' ? (
                  <div className="px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-[11px] text-stone-300 flex items-center gap-2">
                    <Store className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>Pesanan disiapkan untuk diambil langsung (Tanpa minimal belanja).</span>
                  </div>
                ) : (
                  <DeliveryMinOrderBanner
                    subtotal={cartSubtotal}
                    variant="checkout"
                    deliveryFee={deliveryFee}
                    onAddMoreItems={() => setIsCartOpen(false)}
                  />
                )}
              </div>

              {/* Step 2: Customer Info Form */}
              <div className="bg-stone-950/90 p-4 rounded-2xl border border-stone-800/90 space-y-3.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-mono text-[10px]">
                    2
                  </span>
                  Data Pemesan &amp; Pengantaran
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-stone-300 block mb-1.5 font-semibold">
                      Nama Pemesan <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Ahmad"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full h-10 bg-stone-900 border border-stone-800 rounded-xl px-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-orange-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-stone-300 block mb-1.5 font-semibold">
                      Nomor WhatsApp <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="Contoh: 0812xxxxxxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full h-10 bg-stone-900 border border-stone-800 rounded-xl px-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-orange-500 transition"
                    />
                  </div>
                </div>

                {orderType === 'BUNGKUS' ? (
                  <div>
                    <label className="text-[11px] text-stone-300 block mb-1.5 font-semibold">
                      Perkiraan Waktu Ambil (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Sekitar 15-20 menit lagi"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full h-10 bg-stone-900 border border-stone-800 rounded-xl px-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-orange-500 transition"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-[11px] text-stone-300 block mb-1.5 font-semibold">
                        Titik Lokasi DQM (Asrama / Gedung) <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={deliveryLocation}
                        onChange={(e) => setDeliveryLocation(e.target.value)}
                        className="w-full h-10 bg-stone-900 border border-stone-800 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-orange-500 transition"
                      >
                        {DQM_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-stone-300 block mb-1.5 font-semibold">
                          Detail Kamar / Lantai <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Kamar 12 / Blok B Lt. 2"
                          value={deliveryDetail}
                          onChange={(e) => setDeliveryDetail(e.target.value)}
                          className="w-full h-10 bg-stone-900 border border-stone-800 rounded-xl px-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-orange-500 transition"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-stone-300 block mb-1.5 font-semibold">
                          Patokan / Catatan Kurir
                        </label>
                        <input
                          type="text"
                          placeholder="Titip di pos satpam / lobi"
                          value={deliveryNote}
                          onChange={(e) => setDeliveryNote(e.target.value)}
                          className="w-full h-10 bg-stone-900 border border-stone-800 rounded-xl px-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-orange-500 transition"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Items List in Cart */}
              <div className="bg-stone-950/90 p-4 rounded-2xl border border-stone-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-mono text-[10px]">
                      3
                    </span>
                    Ringkasan Menu ({totalCartCount} item)
                  </span>
                </div>

                <div className="divide-y divide-stone-800/80">
                  {cartItems.map((item) => {
                    const unitPrice = item.variant ? item.variant.price : item.product.harga_jual;
                    const displayTitle = item.variant
                      ? formatVariantDisplayName(item.product.nama, item.variant.variantName)
                      : item.product.nama;
                    return (
                      <div key={item.cartKey} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-xs sm:text-sm text-white truncate">
                                {displayTitle}
                              </p>
                              {item.variant && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCartOpen(false);
                                    setEditingCartKey(item.cartKey);
                                    setVariantSearchQuery('');
                                    setVariantModalProduct(item.product);
                                  }}
                                  className="text-[10px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  <span>Ubah Rasa</span>
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-stone-400 font-mono tabular-nums mt-0.5">
                              {formatRupiah(unitPrice)} × {item.qty} ={' '}
                              <strong className="text-amber-400">
                                {formatRupiah(item.qty * unitPrice)}
                              </strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.cartKey, -1)}
                              className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono font-extrabold text-xs text-white w-6 text-center tabular-nums">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.cartKey, 1)}
                              className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-amber-300/90 italic bg-stone-900/90 px-2.5 py-1 rounded-lg border border-stone-800">
                            Catatan: &ldquo;{item.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* General Order Notes */}
                <div className="pt-2 border-t border-stone-800/80">
                  <input
                    type="text"
                    placeholder="Tambahkan catatan dapur (cth: minta sendok plastik, sambal pisah)..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    className="w-full h-9 bg-stone-900 border border-stone-800 rounded-xl px-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-orange-500 transition"
                  />
                </div>
              </div>

              {/* Step 4: Payment Method Selector */}
              <div className="bg-stone-950/90 p-4 rounded-2xl border border-stone-800/90 space-y-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-mono text-[10px]">
                    4
                  </span>
                  Metode Pembayaran
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      paymentMethod === 'Cash'
                        ? 'bg-orange-500/15 border-orange-500 text-orange-400'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tunai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      paymentMethod === 'QRIS'
                        ? 'bg-orange-500/15 border-orange-500 text-orange-400'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Scan QRIS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Transfer')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      paymentMethod === 'Transfer'
                        ? 'bg-orange-500/15 border-orange-500 text-orange-400'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Transfer</span>
                  </button>
                </div>

                {paymentMethod === 'Transfer' && (
                  <div className="p-3 bg-stone-900 rounded-xl border border-stone-800 flex items-center justify-between gap-2 text-xs text-stone-300">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">
                        Rekening Tujuan
                      </span>
                      <strong className="font-mono text-amber-400">
                        BCA 123-456-7890 (Warung Bang Kobra)
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('1234567890');
                        if (showToast) showToast('Nomor rekening disalin!', 'info');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-[11px] font-bold text-stone-200 shrink-0 cursor-pointer"
                    >
                      Salin
                    </button>
                  </div>
                )}

                {paymentMethod === 'QRIS' && (
                  <div className="p-3.5 bg-stone-900 rounded-2xl border border-amber-500/30 text-xs text-stone-300">
                    {settings.qrisImageUrl || settings.qrisUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-3.5">
                        <button
                          type="button"
                          onClick={() => setIsQrisZoomOpen(true)}
                          className="group relative p-2 bg-white rounded-xl shrink-0 shadow-md cursor-pointer overflow-hidden"
                          title="Klik untuk memperbesar QRIS"
                        >
                          <img
                            src={settings.qrisImageUrl || settings.qrisUrl}
                            alt="QRIS Warung Bang Kobra"
                            className="w-28 h-28 object-contain"
                          />
                          <span className="absolute inset-x-1 bottom-1 bg-stone-950/85 text-white text-[9px] font-bold py-0.5 rounded text-center opacity-0 group-hover:opacity-100 transition">
                            Perbesar
                          </span>
                        </button>
                        <div className="space-y-1.5 text-center sm:text-left flex-1">
                          <div className="flex items-center justify-center sm:justify-start gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-extrabold text-[10px] uppercase">
                              QRIS Resmi
                            </span>
                            <span className="font-extrabold text-xs text-white">
                              {settings.qrisMerchantName || settings.storeName || 'WARUNG BANG KOBRA'}
                            </span>
                          </div>
                          {settings.qrisNmid && (
                            <div className="text-[10px] font-mono text-stone-400">
                              NMID: {settings.qrisNmid}
                            </div>
                          )}
                          <p className="text-[11px] text-stone-400 leading-relaxed">
                            {settings.qrisInstruction ||
                              'Scan kode QRIS menggunakan GoPay, OVO, DANA, ShopeePay, atau Mobile Banking.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsQrisZoomOpen(true)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-400 hover:text-orange-300 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Lihat QRIS Layar Penuh</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-stone-400">
                        Kode QRIS akan dikirimkan otomatis oleh kasir warung melalui WhatsApp.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Receipt Price Breakdown */}
              <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800/90 space-y-2 text-xs">
                <div className="flex justify-between text-stone-400">
                  <span>Subtotal Menu ({totalCartCount} item)</span>
                  <span className="font-mono font-bold text-stone-200 tabular-nums">
                    {formatRupiah(cartSubtotal)}
                  </span>
                </div>
                {orderType === 'DELIVERY_DQM' && (
                  <div className="flex justify-between text-stone-400">
                    <span>Ongkos Kirim Area DQM</span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
                      {deliveryFee > 0 ? formatRupiah(deliveryFee) : 'GRATIS'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-baseline text-white font-extrabold text-sm pt-2.5 border-t border-stone-800">
                  <span>Total Pembayaran</span>
                  <span className="text-base sm:text-lg text-amber-400 font-mono tabular-nums">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-stone-950 border-t border-stone-800/90 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="h-12 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs font-bold transition cursor-pointer shrink-0"
              >
                + Tambah Menu
              </button>

              <button
                type="button"
                id="btn-submit-order-whatsapp"
                disabled={
                  isSubmitting ||
                  (orderType === 'DELIVERY_DQM' && selectedAreaOption === 'OUTSIDE') ||
                  (orderType === 'DELIVERY_DQM' && cartSubtotal < DELIVERY_MIN_ORDER_AMOUNT)
                }
                onClick={handleSubmitOrder}
                className={`flex-1 h-12 flex items-center justify-center gap-2 px-5 rounded-xl font-extrabold text-xs sm:text-sm shadow-lg transition active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  orderType === 'DELIVERY_DQM' && cartSubtotal < DELIVERY_MIN_ORDER_AMOUNT
                    ? 'bg-red-950/80 border border-red-500/40 text-red-200'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-stone-950 shadow-orange-950/50'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim ke Kasir...</span>
                  </>
                ) : orderType === 'DELIVERY_DQM' && cartSubtotal < DELIVERY_MIN_ORDER_AMOUNT ? (
                  <>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Kurang {formatRupiah(DELIVERY_MIN_ORDER_AMOUNT - cartSubtotal)} (Min. Delivery)
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Pesanan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QRIS Fullscreen Zoom Modal */}
      {isQrisZoomOpen && (settings.qrisImageUrl || settings.qrisUrl) && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsQrisZoomOpen(false)}
        >
          <div
            className="bg-stone-900 border border-stone-800 rounded-3xl max-w-sm w-full p-5 text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-400">
                  Pembayaran QRIS Resmi
                </span>
                <h4 className="font-display font-extrabold text-sm text-white">
                  {settings.qrisMerchantName || settings.storeName || 'WARUNG BANG KOBRA'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsQrisZoomOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-inner mx-auto">
              <img
                src={settings.qrisImageUrl || settings.qrisUrl}
                alt="QRIS Fullscreen"
                className="w-full max-h-72 object-contain mx-auto"
              />
            </div>

            <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 flex items-center justify-between text-xs">
              <span className="text-stone-400">Total Bayar</span>
              <span className="font-mono font-extrabold text-sm text-amber-400 tabular-nums">
                {formatRupiah(grandTotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsQrisZoomOpen(false)}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 font-extrabold text-xs cursor-pointer"
            >
              Tutup Pratinjau QRIS
            </button>
          </div>
        </div>
      )}

      {/* Item Note Modal Dialog */}
      {activeNoteItemId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <h4 className="font-bold text-sm text-white">Catatan Khusus Menu</h4>
            <input
              type="text"
              autoFocus
              placeholder="Contoh: Pedas sedang, jangan pakai toge..."
              value={tempNoteText}
              onChange={(e) => setTempNoteText(e.target.value)}
              className="w-full h-10 bg-stone-950 border border-stone-800 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-orange-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveNoteItemId(null)}
                className="px-3.5 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleSaveItemNote(activeNoteItemId)}
                className="px-4 py-2 rounded-xl bg-orange-500 text-stone-950 font-extrabold text-xs cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Queue Ticket Pass Confirmation Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-pop-in">
            {/* Top Ticket Banner */}
            <div className="bg-gradient-to-br from-emerald-950/90 via-stone-900 to-stone-900 p-6 text-center border-b border-dashed border-stone-800 relative">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-950/50">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Terkirim ke Antrian Kasir
              </span>

              <h3 className="font-display text-xl font-extrabold text-white mt-2">
                Terima Kasih, {customerName}!
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Pesanan Anda telah masuk otomatis ke sistem Kasir Warung Bang Kobra.
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Digital Queue Number Pass */}
              <div className="p-4 bg-stone-950 border border-orange-500/40 rounded-2xl text-center space-y-1.5 relative overflow-hidden">
                <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase font-extrabold tracking-widest text-orange-400">
                  <BellRing className="w-3.5 h-3.5 text-orange-400" />
                  <span>Nomor Antrian Pesanan</span>
                </div>
                <div className="font-mono text-3xl sm:text-4xl font-extrabold text-white tracking-wider py-0.5 tabular-nums">
                  {getTakeawayQueueNumber(completedOrder.createdOrder)}
                </div>
                <p className="text-[11px] text-stone-400">
                  {orderType === 'BUNGKUS'
                    ? 'Tunjukkan nomor antrian ini saat mengambil pesanan di kasir.'
                    : `Diantar ke Area DQM: ${deliveryLocation} (${deliveryDetail})`}
                </p>
              </div>

              {/* Live Order Progress Tracker */}
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800/90 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-stone-400 font-medium">Status Real-Time</span>
                  <span className="text-orange-400 font-extrabold flex items-center gap-1.5 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/25">
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                    {orderType === 'DELIVERY_DQM'
                      ? getDeliveryStatusLabel(liveDeliveryStatus)
                      : getOrderStatusLabel(liveStatus, orderType)}
                  </span>
                </div>
                <div className="flex justify-between text-stone-400 pt-2 border-t border-stone-800/80">
                  <span>ID Transaksi</span>
                  <span className="font-mono font-bold text-stone-200">
                    {completedOrder.orderId}
                  </span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Layanan</span>
                  <span className="font-bold text-stone-200">
                    {orderType === 'BUNGKUS' ? 'Bungkus (Takeaway)' : 'Delivery Area DQM'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-stone-800/80">
                  <span className="text-stone-300 font-bold">Total Pembayaran</span>
                  <span className="font-mono font-extrabold text-emerald-400 text-sm tabular-nums">
                    {formatRupiah(completedOrder.total)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {orderType === 'DELIVERY_DQM' && (
                  <button
                    type="button"
                    onClick={() => setIsViewingCustomerProof(true)}
                    className="w-full h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-extrabold text-xs transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Lihat Bukti Pengantaran DQM</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    openWhatsAppChat(
                      settings.whatsappNumber || '',
                      completedOrder.whatsappMessage
                    );
                  }}
                  className="w-full h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs shadow-lg shadow-emerald-950/40 transition active:scale-[0.98] cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Konfirmasi via WhatsApp Warung</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetOrder}
                  className="w-full h-10 px-4 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 font-bold text-xs transition cursor-pointer"
                >
                  Buat Pesanan Baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Read-Only Delivery Proof Modal */}
      {completedOrder && isViewingCustomerProof && (
        <DeliveryProofModal
          isOpen={isViewingCustomerProof}
          onClose={() => setIsViewingCustomerProof(false)}
          transaction={completedOrder.createdOrder}
          settings={settings}
          currentUserRole="Customer"
          readOnlyCustomerView={true}
          initialMode="view"
          showToast={showToast}
        />
      )}

      {/* Customer Pre-Order Form Modal */}
      <CustomerPreOrderModal
        isOpen={isPOModalOpen}
        onClose={() => setIsPOModalOpen(false)}
        products={products}
        variants={variants}
        settings={settings}
        onOrderCreated={(newTx) => {
          if (onOrderCreated) onOrderCreated(newTx);
          setAllTransactionsForTracking((prev) => [newTx, ...prev]);
        }}
        showToast={showToast}
        onOpenTracking={(poNum) => {
          setIsPOModalOpen(false);
          setIsPOTrackingOpen(true);
        }}
      />

      {/* Customer Pre-Order Live Tracking Modal */}
      <CustomerPOTrackingModal
        isOpen={isPOTrackingOpen}
        onClose={() => setIsPOTrackingOpen(false)}
        transactions={allTransactionsForTracking}
        settings={settings}
      />
    </div>
  );
};
