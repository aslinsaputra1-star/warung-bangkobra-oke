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
  ChevronRight,
  Sparkles,
  AlertCircle,
  CreditCard,
  Banknote,
  QrCode,
  Flame,
  X,
  Share2,
  Copy,
  ExternalLink,
  MessageCircle,
  LogIn,
  Info,
  BadgeCheck,
  Check,
  ArrowLeft,
  Utensils,
  ReceiptText,
  Lock,
  Layers,
  RefreshCw,
} from 'lucide-react';
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
  openWhatsAppChat,
  DQM_LOCATIONS,
  getEffectiveDeliveryFee,
  normalizeOrderStatus,
  normalizeDeliveryStatus,
  getOrderStatusLabel,
  getDeliveryStatusLabel,
  getTakeawayQueueNumber,
} from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { saveOrderToFirebase, db } from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { BrandLogo } from '../Common/BrandLogo';
import { DeliveryProofModal } from '../Orders/DeliveryProofModal';

interface PublicMenuCustomerViewProps {
  products: Product[];
  variants?: ProductVariant[];
  settings: StoreSettings;
  onOpenStaffLogin?: () => void;
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

export const PublicMenuCustomerView: React.FC<PublicMenuCustomerViewProps> = ({
  products,
  variants,
  settings,
  onOpenStaffLogin,
  onOrderCreated,
  showToast,
}) => {
  // Order Type Mode: strictly BUNGKUS or DELIVERY_DQM (No Dine-In / Meja)
  const [orderType, setOrderType] = useState<OrderType>('BUNGKUS');

  // Customer Form Data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupTime, setPickupTime] = useState('Sekitar 15-20 menit lagi');
  const [selectedAreaOption, setSelectedAreaOption] = useState<'DQM' | 'OUTSIDE'>('DQM');
  const [deliveryLocation, setDeliveryLocation] = useState<string>(DQM_LOCATIONS[0]);
  const [deliveryDetail, setDeliveryDetail] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QRIS' | 'Transfer'>('Cash');

  // Search, Filter & View States
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [quickFilter, setQuickFilter] = useState<'all' | 'popular' | 'spicy' | 'under15k'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  // Variant Selector Modal States
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [variantSearchQuery, setVariantSearchQuery] = useState('');
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null);

  // Cart State: cartKey -> CartEntry
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  // Completed Order State & Live Real-time Listener
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    total: number;
    whatsappMessage: string;
    createdOrder: Transaction;
  } | null>(null);
  const [liveStatus, setLiveStatus] = useState<OrderQueueStatus>('MENUNGGU');
  const [liveDeliveryStatus, setLiveDeliveryStatus] = useState<DeliveryStatus>('MENUNGGU');
  const [isViewingCustomerProof, setIsViewingCustomerProof] = useState(false);

  // Real-time listener for order status in Firebase Firestore
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
              setLiveStatus(normalizeOrderStatus(data.status));
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

  // Active Products List (ensuring non-deleted variant parent products are always present)
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

  // Categories with counts
  const categories = useMemo(() => {
    const set = new Set(activeProducts.map((p) => p.kategori));
    return ['Semua', ...Array.from(set)];
  }, [activeProducts]);

  // Filtered Products (also matches variant flavor names!)
  const filteredProducts = useMemo(() => {
    return activeProducts.filter((p) => {
      const prodVars = variantsByProduct.get(p.id) || [];
      const hasVars = prodVars.length > 0;
      const effectiveStock = hasVars
        ? prodVars.reduce((sum, v) => sum + Math.max(0, Number(v.stock || 0)), 0)
        : p.stok;
      const minPrice = hasVars
        ? Math.min(...prodVars.map((v) => Number(v.price || p.harga_jual)))
        : p.harga_jual;

      // Category match
      const matchCategory = selectedCategory === 'Semua' || p.kategori === selectedCategory;

      // Query match (including variant flavor names & SKUs)
      const q = searchQuery.toLowerCase().trim();
      const matchVariant =
        hasVars &&
        prodVars.some(
          (v) =>
            (v.variantName || '').toLowerCase().includes(q) ||
            (v.sku || '').toLowerCase().includes(q)
        );
      const matchQuery =
        q === '' ||
        p.nama.toLowerCase().includes(q) ||
        (p.deskripsi && p.deskripsi.toLowerCase().includes(q)) ||
        p.kategori.toLowerCase().includes(q) ||
        matchVariant;

      // Quick filter
      let matchQuick = true;
      if (quickFilter === 'popular') {
        matchQuick = effectiveStock > 10;
      } else if (quickFilter === 'spicy') {
        const hasSpicyVar =
          hasVars &&
          prodVars.some(
            (v) =>
              v.variantName.toLowerCase().includes('pedas') ||
              v.variantName.toLowerCase().includes('geprek') ||
              v.variantName.toLowerCase().includes('rendang') ||
              v.variantName.toLowerCase().includes('rica') ||
              v.variantName.toLowerCase().includes('seblak')
          );
        matchQuick =
          p.nama.toLowerCase().includes('pedas') ||
          p.nama.toLowerCase().includes('kobra') ||
          p.nama.toLowerCase().includes('rendang') ||
          (p.deskripsi && p.deskripsi.toLowerCase().includes('pedas')) ||
          hasSpicyVar;
      } else if (quickFilter === 'under15k') {
        matchQuick = minPrice <= 15000;
      }

      return matchCategory && matchQuery && matchQuick;
    });
  }, [activeProducts, variantsByProduct, selectedCategory, searchQuery, quickFilter]);

  // Cart Metrics
  const cartItems: CartEntry[] = useMemo(() => Object.values(cart), [cart]);
  const totalItemCount = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const cartSubtotal = cartItems.reduce((acc, item) => {
    const unitPrice = item.variant ? item.variant.price : item.product.harga_jual;
    return acc + item.qty * unitPrice;
  }, 0);
  const deliveryFee = getEffectiveDeliveryFee(settings, orderType);
  const grandTotal = cartSubtotal + deliveryFee;

  // Cart operations
  const getCartKey = (productId: string, variantId?: string) =>
    variantId ? `${productId}__${variantId}` : productId;

  const handleAddToCart = (product: Product, e?: React.MouseEvent, specificVariant?: ProductVariant) => {
    if (e) e.stopPropagation();
    const prodVars = variantsByProduct.get(product.id) || [];

    // If product has variants and no specific variant was passed, open Variant Selector Modal
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

      // If switching flavor of an existing cart item
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
        const existing = prev[key];
        const currentQty = existing ? existing.qty : 0;
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
            notes: existing ? existing.notes : '',
          },
        };
      });
      if (showToast) {
        showToast(
          `${formatVariantDisplayName(product.nama, specificVariant.variantName)} ditambahkan ke keranjang!`,
          'success'
        );
      }
      return;
    }

    if (product.stok <= 0) return;
    const key = getCartKey(product.id);
    setCart((prev) => {
      const existing = prev[key];
      const newQty = (existing ? existing.qty : 0) + 1;
      return {
        ...prev,
        [key]: {
          cartKey: key,
          product,
          qty: newQty,
          notes: existing ? existing.notes : '',
        },
      };
    });
    if (showToast) {
      showToast(`${product.nama} ditambahkan ke keranjang!`, 'success');
    }
  };

  const handleUpdateQty = (cartKey: string, delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart((prev) => {
      const existing = prev[cartKey];
      if (!existing) return prev;
      const maxStock = existing.variant ? existing.variant.stock : existing.product.stok;
      const newQty = existing.qty + delta;
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
          ...existing,
          qty: newQty,
        },
      };
    });
  };

  const handleUpdateItemNotes = (cartKey: string, notes: string) => {
    setCart((prev) => {
      if (!prev[cartKey]) return prev;
      return {
        ...prev,
        [cartKey]: {
          ...prev[cartKey],
          notes,
        },
      };
    });
  };

  const handleRemoveItem = (cartKey: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[cartKey];
      return copy;
    });
  };

  // Copy Menu Link
  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?menu=public`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      if (showToast) showToast('Tautan Menu Online berhasil disalin!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      if (showToast) showToast('Gagal menyalin tautan', 'error');
    }
  };

  // Share to WhatsApp Status or Contacts
  const handleShareToWhatsApp = () => {
    const url = `${window.location.origin}${window.location.pathname}?menu=public`;
    const text = `🍽️ *Katalog Menu Online ${settings.storeName}*\n\nPesan makanan lezat & minuman segar favorit langsung dari rumah tanpa antre! Klik link berikut:\n👉 ${url}\n\nBuka Setiap Hari • Halal & Mantap!`;
    const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  // Copy Bank Account
  const handleCopyBank = async () => {
    const bankText = settings.onlineMenuBankInfo || 'BCA 8830192831 a.n Warung Bang Kobra';
    try {
      await navigator.clipboard.writeText(bankText);
      setCopiedBank(true);
      if (showToast) showToast('Nomor rekening berhasil disalin!', 'success');
      setTimeout(() => setCopiedBank(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Checkout submission
  const handleSubmitOrder = async () => {
    if (cartItems.length === 0) {
      if (showToast) showToast('Keranjang masih kosong, silakan pilih menu!', 'error');
      return;
    }

    if (!customerName.trim()) {
      if (showToast) showToast('Harap isi Nama Pemesan!', 'error');
      return;
    }

    if (!customerPhone.trim()) {
      if (showToast) showToast('Harap isi Nomor WhatsApp Anda!', 'error');
      return;
    }

    if (orderType === 'DELIVERY_DQM') {
      if (selectedAreaOption !== 'DQM') {
        if (showToast) showToast('Delivery hanya tersedia untuk area Pesantren DQM.', 'error');
        return;
      }
      if (!deliveryLocation.trim() || !deliveryDetail.trim()) {
        if (showToast) showToast('Harap lengkapi Lokasi DQM dan Detail Lokasi (Kamar/Asrama)!', 'error');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const isDelivery = orderType === 'DELIVERY_DQM';
      const orderId = StorageService.generateInvoiceNumber('WBK');
      const now = new Date();
      const tanggal = now.toISOString().split('T')[0];
      const jam = now.toTimeString().split(' ')[0];

      // Format Items for Transaction (supporting product variants)
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

      const newTransaction: Transaction = {
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
        uang_diterima: grandTotal,
        kembalian: 0,
        status: 'MENUNGGU',
        orderType,
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
        items: itemsFormatted,
        created_at: now.toISOString(),
      };

      // 1. Save to local storage for POS & auto deduct stock & record mutation
      StorageService.completeTransaction(newTransaction);

      // 2. Save to Firebase Firestore so cashier receives realtime push notification
      await saveOrderToFirebase(newTransaction).catch((err) => {
        console.warn('Firebase order sync error:', err);
      });

      // 4. Build Professional WhatsApp Message
      const waMessage = buildOnlineQRCodeOrderWhatsAppMessage({
        storeName: settings.storeName,
        orderId,
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryArea: isDelivery ? 'DQM' : null,
        deliveryLocation: isDelivery ? deliveryLocation.trim() : null,
        deliveryDetail: isDelivery ? deliveryDetail.trim() : null,
        pickupTime: !isDelivery ? pickupTime : undefined,
        paymentMethod: paymentMethod === 'QRIS' ? 'QRIS Warung' : paymentMethod === 'Transfer' ? 'Transfer Bank' : 'Tunai / COD',
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
        deliveryFee: isDelivery ? deliveryFee : 0,
        total: grandTotal,
      });

      if (onOrderCreated) {
        onOrderCreated(newTransaction);
      }

      setLiveStatus('MENUNGGU');
      setLiveDeliveryStatus('MENUNGGU');
      setCompletedOrder({
        orderId,
        total: grandTotal,
        whatsappMessage: waMessage,
        createdOrder: newTransaction,
      });

      // Reset cart and drawer
      setCart({});
      setIsCartDrawerOpen(false);

      if (showToast) {
        showToast(`Pesanan ${orderId} berhasil dibuat!`, 'success');
      }
    } catch (error) {
      console.error('Submit order error:', error);
      if (showToast) showToast('Gagal memproses pesanan. Silakan coba lagi!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsAppConfirmation = () => {
    if (!completedOrder) return;
    openWhatsAppChat(settings.whatsappNumber, completedOrder.whatsappMessage);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col antialiased selection:bg-orange-500 selection:text-black">
      {/* Top Floating Announcement Bar */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 text-white text-xs py-2 px-4 shadow-md sticky top-0 z-30 flex items-center justify-between border-b border-orange-500/30">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="shrink-0 bg-white/20 p-1 rounded-full animate-pulse">
            <Flame className="w-3.5 h-3.5 text-amber-200" />
          </span>
          <p className="font-semibold truncate">
            {settings.onlineMenuBannerText ||
              '🔥 Selamat Datang di Menu Online Warung Bang Kobra! Pesan Cepat via WhatsApp.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenStaffLogin && (
            <button
              type="button"
              onClick={onOpenStaffLogin}
              className="flex items-center gap-1.5 bg-stone-950/90 hover:bg-stone-900 text-amber-300 border border-amber-400/50 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer shadow-sm active:scale-95"
              title="Buka Panel Kasir & Pengelolaan Warung Bang Kobra"
            >
              <span>Panel POS Kasir</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer"
            title="Salin Tautan Menu Online"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
            <span>{copiedLink ? 'Tersalin' : 'Salin Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareToWhatsApp}
            className="hidden sm:flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer"
            title="Bagikan ke WhatsApp"
          >
            <Share2 className="w-3 h-3" />
            <span>Bagikan</span>
          </button>
        </div>
      </div>

      {/* Main Hero Header */}
      <header className="relative bg-gradient-to-b from-stone-900 to-stone-950 border-b border-stone-800/80 px-4 pt-6 pb-6 sm:pb-8 overflow-hidden animate-fade-in-up">
        {/* Ambient Warm Backlight */}
        <div className="absolute top-0 left-1/4 w-96 h-48 bg-orange-600/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="absolute top-1/2 right-10 w-72 h-36 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
            {/* Warung Avatar / Logo with Pulsing Glow */}
            <div className="relative shrink-0 transition-transform duration-300 hover:scale-105">
              <BrandLogo
                src={settings.logoUrl}
                alt={settings.storeName}
                size="2xl"
                rounded="rounded-2xl"
                className="shadow-xl shadow-orange-950/40 border-2 border-orange-500/40 animate-pulse-glow"
              />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-stone-950"></span>
              </span>
            </div>

            {/* Warung Identity Info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-stone-100 tracking-tight">
                  {settings.storeName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse-glow-emerald">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  <span>Buka Sekarang</span>
                </span>
              </div>

              <p className="text-xs sm:text-sm text-stone-400 font-medium max-w-xl">
                {settings.tagline || 'Spesialis Masakan Nusantara, Mi Rendang & Sambal Kobra Mantap'}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-[11px] text-stone-400 font-medium">
                <span className="flex items-center gap-1 text-stone-300 hover:text-orange-300 transition-colors">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  <span>{settings.onlineMenuHours || '09:00 - 22:00 WIB'}</span>
                </span>

                <span className="flex items-center gap-1 text-stone-300 hover:text-red-300 transition-colors">
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  <span className="max-w-[220px] truncate">{settings.address || settings.storeAddress}</span>
                </span>

                <a
                  href={`https://wa.me/${sanitizeWhatsAppNumber(settings.whatsappNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline font-bold transition-all hover:scale-105"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat WA Warung</span>
                </a>
              </div>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-row md:flex-col items-center sm:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-2xl p-2 px-3 shadow-inner hover:scale-105 hover:border-orange-500/40 transition-all duration-300 cursor-default">
              <Bike className="w-4 h-4 text-orange-400" />
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-stone-400">Jenis Pesanan</div>
                <div className="text-xs font-black text-stone-200">BUNGKUS &amp; DELIVERY DQM</div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-2xl p-2 px-3 shadow-inner hover:scale-105 hover:border-amber-500/40 transition-all duration-300 cursor-default">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-stone-400">Antrian</div>
                <div className="text-xs font-black text-amber-300">Langsung ke ANTRIAN KASIR</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Search & Category Filter Bar */}
        <section className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari menu favorit (contoh: Mi Rendang, Es Teh, Nasi Goreng)..."
              className="w-full min-h-[48px] pl-12 pr-10 py-3 bg-stone-900/90 border border-stone-800 rounded-2xl text-sm font-medium text-stone-100 placeholder-stone-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setQuickFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all duration-200 shrink-0 cursor-pointer active:scale-95 hover:scale-105 ${
                quickFilter === 'all'
                  ? 'bg-orange-500 text-stone-950 shadow-md shadow-orange-950/40'
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              Semua Menu
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter('popular')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all duration-200 shrink-0 cursor-pointer active:scale-95 hover:scale-105 ${
                quickFilter === 'popular'
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40 animate-pulse-glow'
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>🔥 Terlaris</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter('spicy')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all duration-200 shrink-0 cursor-pointer active:scale-95 hover:scale-105 ${
                quickFilter === 'spicy'
                  ? 'bg-red-500 text-white shadow-md shadow-red-950/40'
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span>🌶️ Pedas Kobra</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter('under15k')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all duration-200 shrink-0 cursor-pointer active:scale-95 hover:scale-105 ${
                quickFilter === 'under15k'
                  ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-950/40'
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <span>⚡ Di Bawah 15rb</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-800/80 no-scrollbar">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`pb-2.5 px-3 text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all duration-200 border-b-2 shrink-0 cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'border-orange-500 text-orange-400 scale-105'
                      : 'border-transparent text-stone-400 hover:text-stone-100 hover:border-stone-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </section>

        {/* Product Menu Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-400 font-bold">
            <span>
              Menampilkan <strong className="text-stone-200">{filteredProducts.length}</strong> menu
              {selectedCategory !== 'Semua' && ` di kategori ${selectedCategory}`}
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-4 bg-stone-900/40 rounded-3xl border border-stone-800/80 space-y-3 animate-fade-in-up">
              <Utensils className="w-12 h-12 text-stone-400 mx-auto opacity-50" />
              <h3 className="text-lg font-bold text-stone-200">Menu Tidak Ditemukan</h3>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                Tidak ada menu yang sesuai dengan pencarian atau filter Anda. Coba kata kunci lain atau pilih kategori Semua.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Semua');
                  setQuickFilter('all');
                }}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-orange-400 rounded-xl text-xs font-bold transition-all hover:scale-105 cursor-pointer"
              >
                Reset Filter Pencarian
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product, index) => {
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

                const cartEntry = !hasVars ? cart[product.id] : undefined;
                const productVariantCartCount = hasVars
                  ? cartItems
                      .filter((ci) => ci.product.id === product.id)
                      .reduce((s, ci) => s + ci.qty, 0)
                  : 0;
                const isOutOfStock = effectiveStock <= 0;
                const isSpicy =
                  product.nama.toLowerCase().includes('pedas') ||
                  product.nama.toLowerCase().includes('kobra') ||
                  product.nama.toLowerCase().includes('rendang');

                // Sort preview variants so search matches appear first
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
                    id={`menu-card-${product.id}`}
                    onClick={() => {
                      if (hasVars) {
                        setEditingCartKey(null);
                        setVariantSearchQuery('');
                        setVariantModalProduct(product);
                      } else {
                        setSelectedProductDetail(product);
                      }
                    }}
                    style={{ animationDelay: `${Math.min(index * 45, 450)}ms` }}
                    className="group bg-stone-900/80 hover:bg-stone-900 border border-stone-800/80 hover:border-orange-500/40 rounded-3xl p-3.5 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-2xl hover:shadow-orange-950/30 hover:-translate-y-1.5 cursor-pointer animate-fade-in-up"
                  >
                    <div>
                      {/* Product Image with Hover Zoom */}
                      <div className="relative aspect-video sm:aspect-[4/3] w-full bg-stone-950 rounded-2xl overflow-hidden mb-3">
                        {product.foto ? (
                          <img
                            src={product.foto}
                            alt={product.nama}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-stone-950 text-stone-400">
                            <Utensils className="w-8 h-8 opacity-40 group-hover:scale-110 transition-transform duration-300" />
                          </div>
                        )}

                        {/* Badges Over Image */}
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex flex-wrap gap-1">
                            <span className="bg-stone-950/80 backdrop-blur-sm text-stone-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-stone-800">
                              {product.kategori}
                            </span>
                            {isSpicy && (
                              <span className="bg-red-600/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm shimmer-effect">
                                Pedas
                              </span>
                            )}
                          </div>
                          {hasVars && (
                            <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              <span>{prodVars.length} Varian</span>
                            </span>
                          )}
                        </div>

                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center">
                            <span className="bg-red-600/90 text-white text-xs font-black px-3 py-1 rounded-xl shadow-lg">
                              Habis Hari Ini
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-extrabold text-stone-100 group-hover:text-orange-400 transition text-sm sm:text-base line-clamp-1">
                            {product.nama}
                          </h4>
                          {productVariantCartCount > 0 && (
                            <span className="shrink-0 bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                              {productVariantCartCount} dipilih
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">
                          {product.deskripsi || 'Olahan bahan segar pilihan racikan resep warung khas.'}
                        </p>

                        {/* Interactive Variant Flavor Chips Preview on Card */}
                        {hasVars && (
                          <div
                            className="pt-1.5 space-y-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between text-[10px] text-amber-400 font-extrabold uppercase tracking-wider">
                              <span>Pilih Varian Rasa ({prodVars.length}):</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCartKey(null);
                                  setVariantSearchQuery('');
                                  setVariantModalProduct(product);
                                }}
                                className="text-orange-400 hover:text-orange-300 underline cursor-pointer"
                              >
                                Lihat Semua
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {sortedPreviewVars.slice(0, 5).map((v) => {
                                const vKey = getCartKey(product.id, v.variantId);
                                const vInCart = cart[vKey];
                                const vOut = v.stock <= 0;
                                const isQueryMatch =
                                  q !== '' && v.variantName.toLowerCase().includes(q);
                                return (
                                  <button
                                    key={v.variantId}
                                    type="button"
                                    disabled={vOut}
                                    onClick={(e) => handleAddToCart(product, e, v)}
                                    title={
                                      vOut
                                        ? `${v.variantName} (Stok Habis)`
                                        : `Tambah ${v.variantName} (${formatRupiah(v.price)})`
                                    }
                                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                      vOut
                                        ? 'bg-stone-950/50 border-stone-800/60 text-stone-600 line-through cursor-not-allowed'
                                        : vInCart
                                        ? 'bg-orange-500 text-stone-950 border-orange-400 font-black shadow-sm'
                                        : isQueryMatch
                                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-extrabold'
                                        : 'bg-stone-950 hover:bg-stone-800 border-stone-800 hover:border-orange-500/50 text-stone-300 hover:text-orange-300'
                                    }`}
                                  >
                                    <span className="truncate max-w-[115px]">{v.variantName}</span>
                                    {vInCart ? (
                                      <span className="bg-stone-950 text-orange-400 px-1 rounded text-[9px] font-black">
                                        {vInCart.qty}x
                                      </span>
                                    ) : (
                                      <Plus className="w-2.5 h-2.5 opacity-75 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                              {prodVars.length > 5 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCartKey(null);
                                    setVariantSearchQuery('');
                                    setVariantModalProduct(product);
                                  }}
                                  className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition cursor-pointer"
                                >
                                  +{prodVars.length - 5} varian lainnya
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price and Cart Controller */}
                    <div className="pt-3 mt-2 border-t border-stone-800/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-bold block">
                          {hasVars && minPrice !== maxPrice ? 'Harga Mulai' : 'Harga'}
                        </span>
                        <span className="text-sm sm:text-base font-black text-orange-400">
                          {formatRupiah(minPrice)}
                        </span>
                      </div>

                      {isOutOfStock ? (
                        <span className="text-[11px] font-bold text-stone-400 py-1.5 px-3 rounded-xl bg-stone-800/50">
                          Stok Habis
                        </span>
                      ) : hasVars ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCartKey(null);
                            setVariantSearchQuery('');
                            setVariantModalProduct(product);
                          }}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-orange-950/50 active:scale-90 hover:scale-105 transition-all cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>
                            {productVariantCartCount > 0
                              ? `Pilih Varian (${productVariantCartCount})`
                              : 'Pilih Varian'}
                          </span>
                        </button>
                      ) : cartEntry ? (
                        <div
                          className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/40 p-1 rounded-2xl animate-pop-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleUpdateQty(product.id, -1, e)}
                            className="w-7 h-7 rounded-xl bg-stone-950 hover:bg-stone-800 text-white flex items-center justify-center active:scale-80 hover:scale-110 transition-transform cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-orange-300 min-w-[18px] text-center animate-pop-in">
                            {cartEntry.qty}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleUpdateQty(product.id, 1, e)}
                            className="w-7 h-7 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 flex items-center justify-center font-bold active:scale-80 hover:scale-110 transition-transform cursor-pointer shadow-sm shadow-orange-500/50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleAddToCart(product, e)}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-2xl bg-orange-500 hover:bg-orange-400 text-stone-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-orange-950/50 active:scale-90 hover:scale-105 hover:shadow-orange-500/30 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Pesan</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Info & Delivery Guarantee Banner */}
        <section className="bg-gradient-to-br from-stone-900 via-stone-900/90 to-stone-950 border border-stone-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-extrabold text-stone-100 text-sm sm:text-base">
                Kenapa Pesan Lewat Menu Online Kami?
              </h4>
              <p className="text-xs text-stone-400">
                Layanan langsung dari dapur warung tanpa perantara aplikasi pihak ketiga.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-stone-950/60 border border-stone-800/60 p-3 rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400">
                <Flame className="w-4 h-4" />
                <span>Masak Fresh</span>
              </div>
              <p className="text-[11px] text-stone-400">Dimasak dadakan saat pesanan masuk, hangat & higienis.</p>
            </div>

            <div className="bg-stone-950/60 border border-stone-800/60 p-3 rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <Bike className="w-4 h-4" />
                <span>DELIVERY DQM</span>
              </div>
              <p className="text-[11px] text-stone-400">
                Delivery khusus area Pesantren DQM ({(settings.deliveryFeeType || 'FREE') === 'FREE' ? 'GRATIS' : formatRupiah(Number(settings.deliveryFeeAmount ?? 2000))}).
              </p>
            </div>

            <div className="bg-stone-950/60 border border-stone-800/60 p-3 rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <QrCode className="w-4 h-4" />
                <span>Pembayaran Mudah</span>
              </div>
              <p className="text-[11px] text-stone-400">Bisa bayar tunai di tempat (COD), QRIS, atau transfer bank.</p>
            </div>
          </div>
        </section>
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
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-stone-950 border-b border-stone-800 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {variantModalProduct.foto ? (
                    <img
                      src={variantModalProduct.foto}
                      alt={variantModalProduct.nama}
                      className="w-12 h-12 rounded-2xl object-cover border border-stone-800 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                      <Layers className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {editingCartKey ? 'Ganti Varian Rasa' : 'Pilih Varian Rasa'}
                      </span>
                      <span className="text-[11px] text-stone-400 font-bold">
                        {modalVars.length} Varian Tersedia
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-stone-100 truncate mt-0.5">
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
                  className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar inside Variant Modal */}
              {modalVars.length > 4 && (
                <div className="px-4 sm:px-5 pt-3 pb-1 bg-stone-900 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={variantSearchQuery}
                      onChange={(e) => setVariantSearchQuery(e.target.value)}
                      placeholder={`Cari varian rasa ${variantModalProduct.nama}...`}
                      className="w-full pl-10 pr-8 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500"
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

              {/* Variants List */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2">
                {filteredModalVars.length === 0 ? (
                  <div className="text-center py-8 text-xs text-stone-400">
                    Tidak ada varian rasa yang cocok dengan pencarian &quot;{variantSearchQuery}&quot;.
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
                            ? 'bg-orange-500/10 border-orange-500/50 shadow-sm'
                            : 'bg-stone-950 border-stone-800 hover:border-orange-500/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-stone-100">
                              {variant.variantName}
                            </span>
                            {inCartEntry && (
                              <span className="text-[10px] font-black bg-orange-500 text-stone-950 px-1.5 py-0.5 rounded-md">
                                {inCartEntry.qty}x di Keranjang
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 mt-1 text-[11px]">
                            <span className="font-black text-orange-400">
                              {formatRupiah(variant.price)}
                            </span>
                            <span className="text-stone-600">•</span>
                            <span
                              className={
                                isOut
                                  ? 'text-red-400 font-bold'
                                  : variant.stock <= 5
                                  ? 'text-amber-400 font-semibold'
                                  : 'text-stone-400'
                              }
                            >
                              {isOut ? 'Stok Habis' : `Stok: ${variant.stock}`}
                            </span>
                          </div>
                        </div>

                        {isOut ? (
                          <span className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-xl shrink-0">
                            Habis
                          </span>
                        ) : editingCartKey ? (
                          <button
                            type="button"
                            onClick={(e) => handleAddToCart(variantModalProduct, e, variant)}
                            className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Pilih Rasa Ini</span>
                          </button>
                        ) : inCartEntry ? (
                          <div className="flex items-center gap-2 bg-stone-900 border border-orange-500/40 p-1 rounded-xl shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleUpdateQty(vKey, -1, e)}
                              className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-black text-orange-400 min-w-[20px] text-center">
                              {inCartEntry.qty}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleUpdateQty(vKey, 1, e)}
                              className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-400 text-stone-950 font-bold flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleAddToCart(variantModalProduct, e, variant)}
                            className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 font-extrabold text-xs flex items-center gap-1 shadow-sm cursor-pointer active:scale-95 transition shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Tambah</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-stone-300">
                  {totalSelectedForProduct > 0 ? (
                    <span>
                      <strong className="text-orange-400 font-black">{totalSelectedForProduct} porsi</strong>{' '}
                      {variantModalProduct.nama} dipilih
                    </span>
                  ) : (
                    <span className="text-stone-400">Klik + Tambah pada varian rasa yang diinginkan</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {totalItemCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setVariantModalProduct(null);
                        setEditingCartKey(null);
                        setIsCartDrawerOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-orange-400 font-extrabold text-xs cursor-pointer"
                    >
                      Lihat Keranjang ({totalItemCount})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setVariantModalProduct(null);
                      setEditingCartKey(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 font-black text-xs cursor-pointer"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Product Detail Modal */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="relative aspect-video w-full bg-stone-950">
              {selectedProductDetail.foto ? (
                <img
                  src={selectedProductDetail.foto}
                  alt={selectedProductDetail.nama}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400">
                  <Utensils className="w-12 h-12 opacity-30" />
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedProductDetail(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                    {selectedProductDetail.kategori}
                  </span>
                  <span className="text-xs text-stone-400">Stok: {selectedProductDetail.stok}</span>
                </div>
                <h3 className="text-lg font-black text-stone-100">{selectedProductDetail.nama}</h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {selectedProductDetail.deskripsi || 'Olahan khas Warung Bang Kobra dengan rempah Nusantara pilihan.'}
                </p>
              </div>

              <div className="p-3 bg-stone-950 rounded-2xl border border-stone-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-stone-400 uppercase font-bold block">Harga Porsi</span>
                  <span className="text-lg font-black text-orange-400">
                    {formatRupiah(selectedProductDetail.harga_jual)}
                  </span>
                </div>

                {selectedProductDetail.stok <= 0 ? (
                  <span className="text-xs font-bold text-red-400 py-1.5 px-3 bg-red-500/10 rounded-xl border border-red-500/20">
                    Stok Habis
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      handleAddToCart(selectedProductDetail);
                      setSelectedProductDetail(null);
                    }}
                    className="min-h-[44px] px-4 py-2 bg-orange-500 hover:bg-orange-400 text-stone-950 text-xs font-black rounded-2xl flex items-center gap-2 shadow-lg shadow-orange-950/40 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambahkan ke Keranjang</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {totalItemCount > 0 && !isCartDrawerOpen && !completedOrder && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto animate-slide-up-bounce">
          <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 text-white p-3.5 sm:p-4 rounded-3xl shadow-2xl shadow-orange-950/80 flex items-center justify-between gap-3 border border-orange-400/40 animate-pulse-glow">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center relative shrink-0">
                <ShoppingBag className="w-6 h-6 text-white" />
                <span className="absolute -top-1 -right-1 bg-stone-950 text-orange-400 text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-orange-500 shadow-md animate-pop-in">
                  {totalItemCount}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-orange-100 uppercase tracking-wider font-extrabold block">
                  Total Pesanan
                </span>
                <span className="text-base font-black text-white">{formatRupiah(cartSubtotal)}</span>
              </div>
            </div>

            <button
              type="button"
              id="btn-open-cart-checkout"
              onClick={() => setIsCartDrawerOpen(true)}
              className="group min-h-[44px] px-4 py-2 rounded-2xl bg-stone-950 hover:bg-stone-900 text-orange-400 hover:text-orange-300 text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 hover:scale-105 transition-all cursor-pointer"
            >
              <span>Lihat Pesanan</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Cart & Checkout Drawer Modal */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border-t sm:border border-stone-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-400" />
                <h3 className="font-extrabold text-stone-100 text-base">Keranjang & Checkout</h3>
                <span className="text-xs bg-orange-500/20 text-orange-400 font-bold px-2 py-0.5 rounded-full">
                  {totalItemCount} item
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body Scrollable */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Section 10: PILIH JENIS PESANAN (Strictly BUNGKUS or DELIVERY DQM) */}
              <div className="space-y-2.5 bg-stone-950 p-3.5 rounded-2xl border border-stone-800">
                <label className="text-xs font-black uppercase tracking-wider text-orange-400 block">
                  PILIH JENIS PESANAN
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOrderType('BUNGKUS')}
                    className={`p-3 rounded-2xl flex items-center gap-2.5 text-left text-xs font-extrabold transition cursor-pointer ${
                      orderType === 'BUNGKUS'
                        ? 'bg-orange-500 text-stone-950 shadow-md shadow-orange-950/40 border border-orange-400'
                        : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span className="text-sm font-black">{orderType === 'BUNGKUS' ? '◉' : '○'}</span>
                    <div>
                      <div className="font-black">BUNGKUS</div>
                      <div className="text-[10px] opacity-80">Ambil di Warung</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('DELIVERY_DQM')}
                    className={`p-3 rounded-2xl flex items-center gap-2.5 text-left text-xs font-extrabold transition cursor-pointer ${
                      orderType === 'DELIVERY_DQM'
                        ? 'bg-teal-500 text-stone-950 shadow-md shadow-teal-950/40 border border-teal-400'
                        : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span className="text-sm font-black">{orderType === 'DELIVERY_DQM' ? '◉' : '○'}</span>
                    <div>
                      <div className="font-black">DELIVERY DQM</div>
                      <div className="text-[10px] opacity-80">Khusus Pesantren DQM</div>
                    </div>
                  </button>
                </div>

                {orderType === 'BUNGKUS' ? (
                  <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-300 font-bold flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 shrink-0" />
                    <span>Pesanan akan disiapkan untuk diambil.</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-300 font-bold flex items-center gap-2">
                    <Bike className="w-4 h-4 shrink-0" />
                    <span>Delivery hanya tersedia di area Pesantren DQM.</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-stone-300 block">Daftar Menu:</span>
                <div className="space-y-2">
                  {cartItems.map((entry) => {
                    const unitPrice = entry.variant ? entry.variant.price : entry.product.harga_jual;
                    const displayTitle = entry.variant
                      ? formatVariantDisplayName(entry.product.nama, entry.variant.variantName)
                      : entry.product.nama;
                    return (
                      <div
                        key={entry.cartKey}
                        className="p-3 bg-stone-950 border border-stone-800/80 rounded-2xl space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="font-extrabold text-stone-100 text-xs sm:text-sm truncate">
                                {displayTitle}
                              </h5>
                              {entry.variant && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCartDrawerOpen(false);
                                    setEditingCartKey(entry.cartKey);
                                    setVariantSearchQuery('');
                                    setVariantModalProduct(entry.product);
                                  }}
                                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  <span>Ganti Rasa</span>
                                </button>
                              )}
                            </div>
                            <span className="text-[11px] text-orange-400 font-bold">
                              {formatRupiah(unitPrice)} x {entry.qty} ={' '}
                              {formatRupiah(unitPrice * entry.qty)}
                            </span>
                          </div>

                          {/* Quantity Stepper */}
                          <div className="flex items-center gap-1.5 shrink-0 bg-stone-900 border border-stone-800 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(entry.cartKey, -1)}
                              className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-black text-stone-100 min-w-[18px] text-center">
                              {entry.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(entry.cartKey, 1)}
                              className="w-6 h-6 rounded-lg bg-orange-500 hover:bg-orange-400 text-stone-950 flex items-center justify-center text-xs font-bold"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(entry.cartKey)}
                              className="w-6 h-6 rounded-lg text-stone-400 hover:text-red-400 flex items-center justify-center ml-1"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Item Notes */}
                        <input
                          type="text"
                          value={entry.notes}
                          onChange={(e) => handleUpdateItemNotes(entry.cartKey, e.target.value)}
                          placeholder="Catatan porsi (contoh: pedas manis, tanpa bawang goreng)..."
                          className="w-full text-[11px] px-3 py-1.5 bg-stone-900 border border-stone-800 rounded-xl text-stone-200 placeholder-stone-400 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer Contact Information Form */}
              <div className="space-y-3 pt-2 border-t border-stone-800">
                <span className="text-xs font-bold text-stone-300 block">Informasi Pemesan:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 mb-1 block">Nama Lengkap *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nama Anda"
                      className="w-full text-xs px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-400 mb-1 block">No. WhatsApp Aktif *</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full text-xs px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
                      required
                    />
                  </div>
                </div>

                {/* Conditional Fields based on Order Type (Strictly locked to DQM) */}
                {orderType === 'DELIVERY_DQM' && (
                  <div className="space-y-3 pt-1">
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-extrabold text-emerald-300 flex items-center justify-between">
                      <span>✅ Tujuan Pengantaran: AREA PESANTREN DQM</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-stone-950 text-[10px] font-black">
                        KHUSUS DQM
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-400 mb-1 block">
                        Lokasi DQM (Asrama / Blok / Gedung) *
                      </label>
                      <select
                        value={deliveryLocation}
                        onChange={(e) => setDeliveryLocation(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
                      >
                        {DQM_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-400 mb-1 block">
                        Detail Lokasi (Kamar / Blok / Lantai) *
                      </label>
                      <input
                        type="text"
                        value={deliveryDetail}
                        onChange={(e) => setDeliveryDetail(e.target.value)}
                        placeholder="Contoh: Kamar 12 / Asrama Putra"
                        className="w-full text-xs px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-400 mb-1 block">
                        Catatan Pesanan / Pengantaran
                      </label>
                      <input
                        type="text"
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="Contoh: Antar setelah Maghrib"
                        className="w-full text-xs px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                )}

                {orderType === 'BUNGKUS' && (
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 mb-1 block">Estimasi Jam Ambil:</label>
                    <select
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
                    >
                      <option value="Sekitar 15-20 menit lagi">Sekitar 15-20 menit lagi</option>
                      <option value="Sekitar 30 menit lagi">Sekitar 30 menit lagi</option>
                      <option value="Sekitar 45 menit lagi">Sekitar 45 menit lagi</option>
                      <option value="Sekitar 1 jam lagi">Sekitar 1 jam lagi</option>
                      <option value="Sudah tiba di warung (siap ambil)">Sudah tiba di warung (siap ambil)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-stone-400 mb-1 block">Catatan Tambahan Untuk Warung:</label>
                  <input
                    type="text"
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Contoh: Minta sendok plastik & sambal ekstra"
                    className="w-full text-xs px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2 pt-2 border-t border-stone-800">
                <span className="text-xs font-bold text-stone-300 block">Metode Pembayaran:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-extrabold transition cursor-pointer ${
                      paymentMethod === 'Cash'
                        ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-950/40 border border-emerald-400'
                        : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tunai / COD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-extrabold transition cursor-pointer ${
                      paymentMethod === 'QRIS'
                        ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/40 border border-amber-400'
                        : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QRIS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Transfer')}
                    className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-extrabold transition cursor-pointer ${
                      paymentMethod === 'Transfer'
                        ? 'bg-sky-500 text-stone-950 shadow-md shadow-sky-950/40 border border-sky-400'
                        : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Transfer</span>
                  </button>
                </div>

                {/* Bank Transfer Info Box */}
                {paymentMethod === 'Transfer' && (
                  <div className="p-3 bg-stone-950 border border-stone-800 rounded-2xl space-y-1.5 text-xs text-stone-300">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-400">Rekening Resmi Warung:</span>
                      <button
                        type="button"
                        onClick={handleCopyBank}
                        className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                      >
                        {copiedBank ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedBank ? 'Tersalin' : 'Salin Rekening'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-stone-100 font-black">
                      {settings.onlineMenuBankInfo || 'BCA 8830192831 a.n Warung Bang Kobra'}
                    </div>
                    <p className="text-[10px] text-stone-400">Kirim bukti transfer ke WhatsApp setelah pesanan dibuat.</p>
                  </div>
                )}

                {/* QRIS Info Box */}
                {paymentMethod === 'QRIS' && settings.qrisImageUrl && (
                  <div className="p-3 bg-stone-950 border border-stone-800 rounded-2xl flex items-center gap-3">
                    <img
                      src={settings.qrisImageUrl}
                      alt="QRIS Warung"
                      className="w-16 h-16 rounded-xl bg-white p-1 object-contain"
                    />
                    <div className="text-xs space-y-1">
                      <span className="font-bold text-amber-400 block">Scan QRIS Resmi</span>
                      <p className="text-[11px] text-stone-400">
                        Bisa menggunakan GoPay, OVO, Dana, ShopeePay, BCA, Mandiri, BRI, dll.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Price Calculation Summary */}
              <div className="p-3.5 bg-stone-950 border border-stone-800 rounded-2xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-stone-400">
                  <span>Subtotal Pesanan:</span>
                  <span className="font-bold text-stone-200">{formatRupiah(cartSubtotal)}</span>
                </div>

                {orderType === 'DELIVERY_DQM' && (
                  <div className="flex items-center justify-between text-stone-400">
                    <span>Biaya Delivery DQM:</span>
                    <span className="font-bold text-emerald-400">
                      {deliveryFee > 0 ? formatRupiah(deliveryFee) : 'GRATIS'}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 font-black text-sm text-stone-100">
                  <span>Total Tagihan:</span>
                  <span className="text-orange-400 text-base">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-stone-800 bg-stone-950/80 flex flex-col gap-2 shrink-0">
              <button
                type="button"
                id="btn-submit-order-wa"
                onClick={handleSubmitOrder}
                disabled={isSubmitting || (orderType === 'DELIVERY_DQM' && selectedAreaOption === 'OUTSIDE')}
                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 active:scale-95 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shimmer-effect"
              >
                {isSubmitting ? (
                  <span>Mengirim ke ANTRIAN KASIR...</span>
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5 animate-bounce" />
                    <span>Kirim Pesanan ({orderType === 'BUNGKUS' ? 'BUNGKUS' : 'DELIVERY DQM'})</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-stone-400">
                Pesanan akan otomatis masuk ke ANTRIAN KASIR Warung Bang Kobra.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed Order Confirmation & Real-time Live Tracking Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md p-6 text-center space-y-5 shadow-2xl animate-pop-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner animate-check-pop animate-pulse-glow-emerald">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-stone-100">Pesanan Masuk ke ANTRIAN KASIR!</h3>
              <p className="text-xs text-stone-400">
                No. Antrian: <strong className="text-amber-400 font-mono text-sm">#{getTakeawayQueueNumber(completedOrder.createdOrder)}</strong> • Transaksi: <strong className="text-orange-400 font-mono text-sm">{completedOrder.orderId}</strong>
              </p>
            </div>

            {/* Live Real-time Status Card */}
            <div className="p-4 bg-stone-950 rounded-2xl border border-stone-800 text-left space-y-2.5 animate-pulse-glow">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Status Live:</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {orderType === 'DELIVERY_DQM'
                    ? getDeliveryStatusLabel(liveDeliveryStatus)
                    : getOrderStatusLabel(liveStatus, orderType)}
                </span>
              </div>

              <div className="text-xs text-stone-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-400">Jenis Pesanan:</span>
                  <span className="font-extrabold text-amber-400">
                    {orderType === 'BUNGKUS' ? '[BUNGKUS]' : '[DELIVERY DQM]'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Total Tagihan:</span>
                  <span className="font-extrabold text-orange-400">{formatRupiah(completedOrder.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Metode Bayar:</span>
                  <span className="font-bold text-stone-200">{completedOrder.createdOrder.metode_pembayaran}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {orderType === 'DELIVERY_DQM' && (
                <button
                  type="button"
                  onClick={() => setIsViewingCustomerProof(true)}
                  className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <ReceiptText className="w-4 h-4" />
                  <span>LIHAT BUKTI PENGANTARAN DQM</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenWhatsAppConfirmation}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Kirim Format Pesanan ke WhatsApp Warung</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletedOrder(null)}
                className="w-full min-h-[42px] py-2 px-4 rounded-2xl bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold text-xs transition cursor-pointer"
              >
                <span>Selesai & Pesan Menu Lain</span>
              </button>
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

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-800/80 bg-stone-900/60 py-6 px-4 text-center text-xs text-stone-400 space-y-3">
        <div className="max-w-md mx-auto space-y-1">
          <p className="font-bold text-stone-300">
            {settings.storeName} • {settings.address || settings.storeAddress}
          </p>
          <p className="text-[11px] text-stone-400">
            Sistem Kasir & Menu Digital Online didukung oleh Warung Bang Kobra POS.
          </p>
        </div>

        {onOpenStaffLogin && (
          <div className="pt-3 border-t border-stone-850">
            <button
              type="button"
              onClick={onOpenStaffLogin}
              className="text-[11px] text-stone-500 hover:text-amber-400 font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg hover:bg-stone-900 border border-transparent hover:border-stone-800"
            >
              <Lock className="w-3.5 h-3.5 text-stone-500" />
              <span>Portal Karyawan & Pemilik Warung (Masuk dengan PIN)</span>
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
