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
  openWhatsAppChat,
  buildChatKasirWhatsAppMessage,
  DQM_LOCATIONS,
  getEffectiveDeliveryFee,
  normalizeOrderStatus,
  normalizeDeliveryStatus,
  getOrderStatusLabel,
  getDeliveryStatusLabel,
  getTakeawayQueueNumber,
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
  const [layoutMode, setLayoutMode] = useState<'grid' | 'compact'>('grid');
  const [isQrisZoomOpen, setIsQrisZoomOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

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

  // Pre-Order Modal States
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isPOTrackingOpen, setIsPOTrackingOpen] = useState(false);
  const [allTransactionsForTracking, setAllTransactionsForTracking] = useState<Transaction[]>(() =>
    StorageService.getTransactions()
  );

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
      const minOrderCheck = getDeliveryMinOrderValidation(cartSubtotal);
      if (!minOrderCheck.isMet) {
        if (showToast) {
          showToast(minOrderCheck.warningMessage, 'error');
        }
        return;
      }
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

      // 3. Build Professional WhatsApp Message
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
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col antialiased selection:bg-orange-500 selection:text-stone-950">
      {/* Clean 3-Zone Sticky Glass Top Bar */}
      <header className="sticky top-0 z-30 h-16 bg-stone-950/85 backdrop-blur-xl border-b border-white/[0.07] px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Zone 1: Single Brand Wordmark */}
        <a
          href="#top"
          className="font-display text-base sm:text-lg font-extrabold tracking-tight text-stone-100 hover:text-orange-400 transition-colors truncate"
        >
          {settings.storeName}
        </a>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-stone-400">
          <a href="#layanan" className="hover:text-stone-100 transition-colors whitespace-nowrap">
            Layanan Pesan
          </a>
          <a href="#katalog-menu" className="hover:text-stone-100 transition-colors whitespace-nowrap">
            Katalog Menu
          </a>
          <a href="#keunggulan" className="hover:text-stone-100 transition-colors whitespace-nowrap">
            Standar Dapur
          </a>
          <button
            type="button"
            onClick={() => setIsPOModalOpen(true)}
            className="hover:text-amber-400 transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Pre-Order Acara</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAllTransactionsForTracking(StorageService.getTransactions());
              setIsPOTrackingOpen(true);
            }}
            className="hover:text-sky-400 transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-sky-400" />
            <span>Lacak PO</span>
          </button>
          <button
            type="button"
            onClick={handleChatKasir}
            className="hover:text-emerald-400 transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chat Kasir</span>
          </button>
        </nav>

        {/* Zone 3: Primary Actions (PO + Chat Kasir + Share + Live Cart Trigger) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-preorder-public-header"
            onClick={() => setIsPOModalOpen(true)}
            className="min-h-[38px] px-3 sm:px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/50 hover:to-amber-600/50 border border-red-500/40 text-amber-300 transition-all active:scale-95 cursor-pointer shadow-sm whitespace-nowrap"
            title="Formulir Pemesanan Pre-Order Acara & Porsi Besar"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Pre-Order Acara</span>
            <span className="sm:hidden">PO</span>
          </button>

          <button
            type="button"
            id="btn-chat-kasir-public-header"
            onClick={handleChatKasir}
            className="min-h-[38px] px-3 sm:px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition-all active:scale-95 cursor-pointer shadow-sm whitespace-nowrap"
            title="Chat Kasir WARUNG BANG KOBRA via WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chat Kasir</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-white/[0.08] text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            title="Salin Tautan Menu Online"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
            <span className="hidden sm:inline">{copiedLink ? 'Tersalin' : 'Salin Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCartDrawerOpen(true)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer whitespace-nowrap"
          >
            <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Keranjang</span>
            <span className="font-mono font-extrabold tabular-nums bg-stone-950/15 px-1.5 py-0.5 rounded-md">
              {totalItemCount}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="top" className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8 pb-28">
        {/* Storefront Hero & Integrated Service Mode Switcher */}
        <section className="relative rounded-3xl bg-gradient-to-b from-stone-900/95 via-stone-900/80 to-stone-950 border border-white/[0.08] p-5 sm:p-8 overflow-hidden shadow-2xl">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/[0.07]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <BrandLogo
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  size="2xl"
                  rounded="rounded-2xl"
                  className="shadow-xl border border-white/15"
                />
                <span
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-stone-950"
                  title="Buka Sekarang"
                />
              </div>

              <div className="space-y-2">
                {/* Quiet Unboxed Metadata Kicker */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400 font-medium">
                  <span className="text-emerald-400 font-semibold">Buka Sekarang</span>
                  <span aria-hidden="true">·</span>
                  <span>{settings.onlineMenuHours || '09:00 - 22:00 WIB'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Masuk Otomatis ke Antrian Kasir</span>
                </div>

                <h1
                  className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-stone-50 tracking-tight"
                  style={{ textWrap: 'balance' }}
                >
                  {settings.storeName}
                </h1>

                <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
                  {settings.tagline || 'Spesialis Masakan Nusantara, Mi Rendang & Sambal Kobra Mantap — Dimasak Fresh Saat Pesanan Masuk.'}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-stone-400">
                  <span>{settings.address || settings.storeAddress}</span>
                  <span aria-hidden="true">·</span>
                  <a
                    href={`https://wa.me/${sanitizeWhatsAppNumber(settings.whatsappNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-4 transition-colors"
                  >
                    Chat WhatsApp Resmi
                  </a>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleShareToWhatsApp}
                    className="text-stone-300 hover:text-white font-medium underline underline-offset-4 transition-colors cursor-pointer"
                  >
                    Bagikan Katalog
                  </button>
                </div>
              </div>
            </div>

            {/* Live Order & Service Summary Box */}
            <div className="bg-stone-950/80 border border-white/[0.07] rounded-2xl p-4 sm:px-5 shrink-0 flex flex-row lg:flex-col justify-between gap-4 min-w-[220px]">
              <div>
                <span className="text-[11px] text-stone-400 block">Mode Pesanan Aktif</span>
                <span className="text-xs sm:text-sm font-bold text-stone-100 mt-0.5 block">
                  {orderType === 'BUNGKUS' ? 'Bungkus · Ambil di Warung' : 'Delivery · Area Pesantren DQM'}
                </span>
              </div>
              <div className="text-right lg:text-left lg:pt-2 lg:border-t lg:border-white/[0.06]">
                <span className="text-[11px] text-stone-400 block">Estimasi Total Keranjang</span>
                <span className="text-base sm:text-lg font-mono font-extrabold text-orange-400 tabular-nums">
                  {formatRupiah(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Integrated Service Mode Selector */}
          <div id="layanan" className="relative z-10 pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-stone-100">
                  01. Pilih Metode Layanan Pesanan
                </h2>
                <p className="text-xs text-stone-400">
                  Pilih ambil langsung di warung (tanpa minimal belanja) atau pengantaran ke asrama Pesantren DQM.
                </p>
              </div>
              {settings.onlineMenuBannerText && (
                <p className="text-xs text-amber-300/90 font-medium truncate max-w-md">
                  {settings.onlineMenuBannerText}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrderType('BUNGKUS')}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer ${
                  orderType === 'BUNGKUS'
                    ? 'bg-orange-500/12 border-orange-500/70 text-stone-100 shadow-lg shadow-orange-950/20'
                    : 'bg-stone-950/70 border-white/[0.07] text-stone-400 hover:text-stone-200 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      orderType === 'BUNGKUS'
                        ? 'bg-orange-500 text-stone-950 border-orange-400'
                        : 'bg-stone-900 text-stone-400 border-white/[0.06]'
                    }`}
                  >
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                      Bungkus (Takeaway)
                    </div>
                    <div className="text-xs text-stone-400 truncate mt-0.5">
                      Ambil di Warung · Tanpa Minimal Belanja
                    </div>
                  </div>
                </div>
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                    orderType === 'BUNGKUS'
                      ? 'border-orange-400 bg-orange-500 text-stone-950 font-black'
                      : 'border-stone-700 text-transparent'
                  }`}
                >
                  ✓
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('DELIVERY_DQM')}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer ${
                  orderType === 'DELIVERY_DQM'
                    ? 'bg-emerald-500/12 border-emerald-500/70 text-stone-100 shadow-lg shadow-emerald-950/20'
                    : 'bg-stone-950/70 border-white/[0.07] text-stone-400 hover:text-stone-200 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      orderType === 'DELIVERY_DQM'
                        ? 'bg-emerald-500 text-stone-950 border-emerald-400'
                        : 'bg-stone-900 text-stone-400 border-white/[0.06]'
                    }`}
                  >
                    <Bike className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                      Delivery Pesantren DQM
                    </div>
                    <div className="text-xs text-stone-400 truncate mt-0.5">
                      Khusus Area DQM · Min. Belanja{' '}
                      <span className="font-mono font-semibold text-stone-200 tabular-nums">
                        {formatRupiah(DELIVERY_MIN_ORDER_AMOUNT)}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                    orderType === 'DELIVERY_DQM'
                      ? 'border-emerald-400 bg-emerald-500 text-stone-950 font-black'
                      : 'border-stone-700 text-transparent'
                  }`}
                >
                  ✓
                </span>
              </button>
            </div>

            {orderType === 'DELIVERY_DQM' && (
              <DeliveryMinOrderBanner
                subtotal={cartSubtotal}
                variant="page"
                deliveryFee={deliveryFee}
              />
            )}
          </div>
        </section>

        {/* Search, Segmented Filter Controls & Category Navigation */}
        <section id="katalog-menu" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari menu favorit, varian rasa, atau minuman segar..."
                className="w-full min-h-[46px] pl-11 pr-10 py-2.5 bg-stone-900/90 border border-white/[0.08] rounded-2xl text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Segmented Filter Control + Layout Switcher */}
            <div className="flex items-center justify-between sm:justify-end gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 p-1 bg-stone-900/90 border border-white/[0.07] rounded-2xl shrink-0">
                {(
                  [
                    { id: 'all', label: 'Semua Menu' },
                    { id: 'popular', label: 'Terlaris' },
                    { id: 'spicy', label: 'Pedas Khas' },
                    { id: 'under15k', label: 'Hemat ≤ 15rb' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setQuickFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      quickFilter === tab.id
                        ? 'bg-orange-500 text-stone-950 font-bold shadow-sm'
                        : 'text-stone-400 hover:text-stone-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* View Mode Switcher (Grid vs Compact List) */}
              <div className="hidden sm:flex items-center gap-1 p-1 bg-stone-900/90 border border-white/[0.07] rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => setLayoutMode('grid')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    layoutMode === 'grid'
                      ? 'bg-stone-800 text-stone-100 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('compact')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    layoutMode === 'compact'
                      ? 'bg-stone-800 text-stone-100 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Daftar
                </button>
              </div>
            </div>
          </div>

          {/* Clean Category Tabs with Counts */}
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count =
                  cat === 'Semua'
                    ? activeProducts.length
                    : activeProducts.filter((p) => p.kategori === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-orange-500 text-orange-400 font-bold'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[11px] font-mono text-stone-500 tabular-nums">
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="hidden md:inline text-xs text-stone-400 shrink-0 pb-2 font-mono tabular-nums">
              {filteredProducts.length} menu tersedia
            </span>
          </div>
        </section>

        {/* Product Menu Grid */}
        <section className="space-y-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 px-4 bg-stone-900/40 rounded-3xl border border-white/[0.07] space-y-3">
              <Utensils className="w-10 h-10 text-stone-500 mx-auto" />
              <h3 className="text-base font-bold text-stone-200">Menu Tidak Ditemukan</h3>
              <p className="text-xs text-stone-400 max-w-sm mx-auto leading-relaxed">
                Tidak ada menu yang sesuai dengan kata kunci atau filter aktif. Silakan atur ulang filter untuk melihat seluruh katalog.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Semua');
                  setQuickFilter('all');
                }}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-orange-400 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Reset Filter Pencarian
              </button>
            </div>
          ) : (
            <div
              className={
                layoutMode === 'compact'
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-3.5'
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
              }
            >
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

                const q = searchQuery.toLowerCase().trim();
                const sortedPreviewVars = hasVars
                  ? [...prodVars].sort((a, b) => {
                      if (!q) return 0;
                      const aMatch = a.variantName.toLowerCase().includes(q) ? -1 : 0;
                      const bMatch = b.variantName.toLowerCase().includes(q) ? -1 : 0;
                      return aMatch - bMatch;
                    })
                  : [];

                const hasValidImage = Boolean(product.foto && !failedImages[product.id]);

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
                    style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
                    className={`group bg-stone-900/75 hover:bg-stone-900 border border-white/[0.07] hover:border-orange-500/40 rounded-2xl p-4 flex ${
                      layoutMode === 'compact'
                        ? 'flex-row items-start gap-4'
                        : 'flex-col justify-between'
                    } menu-card-hover cursor-pointer animate-fade-in-up`}
                  >
                    {/* Product Image Container */}
                    <div
                      className={`relative bg-stone-950 rounded-xl overflow-hidden ring-1 ring-white/[0.06] shrink-0 ${
                        layoutMode === 'compact'
                          ? 'w-28 h-28 sm:w-32 sm:h-32'
                          : 'aspect-[4/3] w-full mb-4'
                      }`}
                    >
                      {hasValidImage ? (
                        <img
                          src={product.foto}
                          alt={product.nama}
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                          }
                          className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
                            isOutOfStock ? 'grayscale opacity-50' : 'group-hover:scale-105'
                          }`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-900 via-stone-950 to-orange-950/30 text-stone-500 p-3 text-center">
                          <Utensils className="w-7 h-7 text-orange-500/50 mb-1.5" />
                          <span className="text-[11px] font-medium text-stone-400 line-clamp-1">
                            {product.nama}
                          </span>
                        </div>
                      )}

                      {/* Contrast Scrim */}
                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

                      {/* Single Subtle Corner Tag (Maximum 1 tag per card rule) */}
                      {(hasVars || productVariantCartCount > 0 || (cartEntry && cartEntry.qty > 0)) && !isOutOfStock && (
                        <div className="absolute top-2.5 right-2.5">
                          {productVariantCartCount > 0 || (cartEntry && cartEntry.qty > 0) ? (
                            <span className="bg-orange-500 text-stone-950 text-[11px] font-mono font-extrabold px-2.5 py-0.5 rounded-lg shadow-md tabular-nums">
                              {hasVars ? `${productVariantCartCount} dipilih` : `${cartEntry?.qty}x dipilih`}
                            </span>
                          ) : (
                            <span className="bg-stone-950/85 backdrop-blur-md text-amber-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border border-white/10">
                              {prodVars.length} Varian
                            </span>
                          )}
                        </div>
                      )}

                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-stone-900 border border-white/15 text-stone-300 text-xs font-bold px-3 py-1 rounded-lg">
                            Stok Habis
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Content & Purchase Module */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between w-full">
                      <div className="space-y-1.5">
                        {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
                        <div className="flex items-center gap-1.5 text-xs text-stone-400 font-medium truncate">
                          <span className="text-stone-400">{product.kategori}</span>
                          {isSpicy && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-orange-400">Pedas Khas</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {isOutOfStock ? 'Habis' : `Stok ${effectiveStock}`}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-stone-100 group-hover:text-orange-400 transition-colors line-clamp-1">
                          {product.nama}
                        </h3>

                        <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">
                          {product.deskripsi || 'Olahan bahan segar pilihan dengan racikan bumbu khas Warung Bang Kobra.'}
                        </p>

                        {/* Interactive Variant Flavor Selector on Card */}
                        {hasVars && (
                          <div
                            className="pt-2 space-y-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between text-[11px] text-stone-400">
                              <span>Varian Rasa ({prodVars.length}):</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCartKey(null);
                                  setVariantSearchQuery('');
                                  setVariantModalProduct(product);
                                }}
                                className="text-orange-400 hover:text-orange-300 font-semibold cursor-pointer whitespace-nowrap"
                              >
                                Semua Rasa →
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {sortedPreviewVars.slice(0, 4).map((v) => {
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
                                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                      vOut
                                        ? 'bg-stone-950/40 border-white/[0.04] text-stone-600 line-through cursor-not-allowed'
                                        : vInCart
                                        ? 'bg-orange-500 text-stone-950 border-orange-400 font-bold'
                                        : isQueryMatch
                                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 font-semibold'
                                        : 'bg-stone-950/90 hover:bg-stone-800 border-white/[0.07] text-stone-300 hover:text-white'
                                    }`}
                                  >
                                    <span className="truncate max-w-[110px]">{v.variantName}</span>
                                    {vInCart ? (
                                      <span className="font-mono text-[10px] font-extrabold tabular-nums">
                                        {vInCart.qty}x
                                      </span>
                                    ) : (
                                      <Plus className="w-3 h-3 opacity-70 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                              {prodVars.length > 4 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCartKey(null);
                                    setVariantSearchQuery('');
                                    setVariantModalProduct(product);
                                  }}
                                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 border border-white/[0.07] text-amber-400 transition cursor-pointer whitespace-nowrap"
                                >
                                  +{prodVars.length - 4} lainnya
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Price & Action Footer */}
                      <div className="pt-3.5 mt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                        <div>
                          {hasVars && minPrice !== maxPrice && (
                            <span className="text-[11px] text-stone-400 block">
                              Mulai dari
                            </span>
                          )}
                          <span className="text-[15px] sm:text-base font-mono font-bold text-stone-100 tabular-nums">
                            {formatRupiah(minPrice)}
                          </span>
                        </div>

                        {isOutOfStock ? (
                          <span className="text-xs font-medium text-stone-500 py-1.5 px-3 rounded-xl bg-stone-950 border border-white/[0.05] whitespace-nowrap">
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
                            className="min-h-[38px] px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>
                              {productVariantCartCount > 0
                                ? `Varian (${productVariantCartCount})`
                                : 'Pilih Varian'}
                            </span>
                          </button>
                        ) : cartEntry ? (
                          <div
                            className="flex items-center gap-2 bg-stone-950 border border-orange-500/50 p-1 rounded-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleUpdateQty(product.id, -1, e)}
                              className="w-7 h-7 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-200 flex items-center justify-center transition cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-mono font-bold text-orange-400 min-w-[20px] text-center tabular-nums">
                              {cartEntry.qty}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleUpdateQty(product.id, 1, e)}
                              className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-400 text-stone-950 flex items-center justify-center font-bold transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleAddToCart(product, e)}
                            className="min-h-[38px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-orange-500 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Tambah</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Culinary Craftsmanship & Service Guarantee Section */}
        <section
          id="keunggulan"
          className="rounded-3xl bg-stone-900/60 border border-white/[0.07] p-6 sm:p-8 space-y-6"
        >
          <div className="max-w-xl space-y-1">
            <h2 className="font-display text-lg sm:text-xl font-bold text-stone-100">
              Standar Layanan &amp; Dapur {settings.storeName}
            </h2>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Pemesanan mandiri terhubung langsung ke layar kasir dan dapur warung secara real-time tanpa biaya tambahan aplikasi pihak ketiga.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-white/[0.06]">
            <div className="space-y-1.5">
              <div className="text-xs font-mono font-semibold text-orange-400">
                01. Dimasak Fresh Dadakan
              </div>
              <h3 className="text-sm font-semibold text-stone-100">
                Kualitas Hangat &amp; Higienis
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Setiap porsi disiapkan langsung saat pesanan masuk ke antrian kasir dengan bahan baku segar pilihan.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-mono font-semibold text-emerald-400">
                02. Layanan Bungkus &amp; Delivery DQM
              </div>
              <h3 className="text-sm font-semibold text-stone-100">
                Pengantaran Khusus Area DQM
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Ambil langsung tanpa antre atau diantar ke gedung/asrama Pesantren DQM ({(settings.deliveryFeeType || 'FREE') === 'FREE' ? 'Gratis Ongkir' : `Ongkir ${formatRupiah(Number(settings.deliveryFeeAmount ?? 2000))}`}).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-mono font-semibold text-amber-400">
                03. Pembayaran Fleksibel &amp; Resmi
              </div>
              <h3 className="text-sm font-semibold text-stone-100">
                Tunai COD, QRIS &amp; Transfer
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Mendukung pembayaran tunai saat pesanan diterima, scan QRIS resmi warung, maupun transfer rekening bank.
              </p>
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
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-lg mx-auto space-y-2 animate-slide-up-bounce">
          {orderType === 'DELIVERY_DQM' && (
            <DeliveryMinOrderBanner
              subtotal={cartSubtotal}
              variant="cart-bar"
              deliveryFee={deliveryFee}
            />
          )}
          <div className="bg-stone-900/95 backdrop-blur-xl text-stone-100 p-3.5 sm:p-4 rounded-2xl shadow-2xl shadow-black/80 flex items-center justify-between gap-3 border border-orange-500/40">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center relative shrink-0">
                <ShoppingBag className="w-5 h-5 text-orange-400" />
                <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-stone-950 text-[11px] font-mono font-extrabold w-5 h-5 rounded-full flex items-center justify-center tabular-nums">
                  {totalItemCount}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-stone-400 font-medium block truncate">
                  {orderType === 'BUNGKUS' ? 'Bungkus · Ambil di Warung' : 'Delivery · Area Pesantren DQM'}
                </span>
                <span className="text-base font-mono font-extrabold text-stone-100 tabular-nums">
                  {formatRupiah(grandTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-open-cart-checkout"
              onClick={() => setIsCartDrawerOpen(true)}
              className="group min-h-[42px] px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer whitespace-nowrap"
            >
              <span>Checkout Pesanan</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Cart & Checkout Drawer Modal */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border-t sm:border border-white/[0.08] rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Drawer Header */}
            <div className="px-5 py-4 bg-stone-950/90 border-b border-white/[0.07] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-stone-100 text-base">
                    Ringkasan &amp; Checkout
                  </h3>
                  <p className="text-xs text-stone-400 font-mono tabular-nums">
                    {totalItemCount} porsi dipilih · {formatRupiah(cartSubtotal)}
                  </p>
                </div>
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
            <div className="p-5 space-y-6 overflow-y-auto flex-1">
              {/* 01. Pilih Jenis Pesanan */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-200">
                    01. Metode Layanan Pesanan
                  </span>
                  <span className="text-[11px] text-stone-400">
                    {orderType === 'BUNGKUS' ? 'Tanpa Minimal Order' : `Min. ${formatRupiah(DELIVERY_MIN_ORDER_AMOUNT)}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOrderType('BUNGKUS')}
                    className={`p-3 rounded-xl flex items-center gap-2.5 text-left text-xs font-semibold transition border cursor-pointer ${
                      orderType === 'BUNGKUS'
                        ? 'bg-orange-500/15 text-stone-100 border-orange-500/70'
                        : 'bg-stone-950 border-white/[0.07] text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <ShoppingBag className={`w-4 h-4 shrink-0 ${orderType === 'BUNGKUS' ? 'text-orange-400' : 'text-stone-500'}`} />
                    <div className="min-w-0">
                      <div className="font-bold truncate">Bungkus</div>
                      <div className="text-[11px] text-stone-400 truncate">Ambil di Warung</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('DELIVERY_DQM')}
                    className={`p-3 rounded-xl flex items-center gap-2.5 text-left text-xs font-semibold transition border cursor-pointer ${
                      orderType === 'DELIVERY_DQM'
                        ? 'bg-emerald-500/15 text-stone-100 border-emerald-500/70'
                        : 'bg-stone-950 border-white/[0.07] text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Bike className={`w-4 h-4 shrink-0 ${orderType === 'DELIVERY_DQM' ? 'text-emerald-400' : 'text-stone-500'}`} />
                    <div className="min-w-0">
                      <div className="font-bold truncate">Delivery DQM</div>
                      <div className="text-[11px] text-stone-400 truncate">Area Pesantren DQM</div>
                    </div>
                  </button>
                </div>

                {orderType === 'DELIVERY_DQM' && (
                  <DeliveryMinOrderBanner
                    subtotal={cartSubtotal}
                    variant="checkout"
                    deliveryFee={deliveryFee}
                    onAddMoreItems={() => setIsCartDrawerOpen(false)}
                  />
                )}
              </div>

              {/* 02. Daftar Menu */}
              <div className="space-y-3 pt-4 border-t border-white/[0.07]">
                <span className="text-xs font-semibold text-stone-200 block">
                  02. Daftar Menu Pesanan
                </span>
                <div className="space-y-2.5">
                  {cartItems.map((entry) => {
                    const unitPrice = entry.variant ? entry.variant.price : entry.product.harga_jual;
                    const displayTitle = entry.variant
                      ? formatVariantDisplayName(entry.product.nama, entry.variant.variantName)
                      : entry.product.nama;
                    return (
                      <div
                        key={entry.cartKey}
                        className="p-3.5 bg-stone-950/90 border border-white/[0.07] rounded-2xl space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-semibold text-stone-100 text-xs sm:text-sm truncate">
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
                                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  <span>Ganti Rasa</span>
                                </button>
                              )}
                            </div>
                            <span className="text-xs font-mono text-orange-400 font-semibold tabular-nums mt-0.5 block">
                              {formatRupiah(unitPrice)} × {entry.qty} = {formatRupiah(unitPrice * entry.qty)}
                            </span>
                          </div>

                          {/* Quantity Stepper */}
                          <div className="flex items-center gap-1.5 shrink-0 bg-stone-900 border border-white/[0.07] p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(entry.cartKey, -1)}
                              className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center text-xs cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-mono font-bold text-stone-100 min-w-[20px] text-center tabular-nums">
                              {entry.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(entry.cartKey, 1)}
                              className="w-6 h-6 rounded-lg bg-orange-500 hover:bg-orange-400 text-stone-950 flex items-center justify-center text-xs font-bold cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(entry.cartKey)}
                              className="w-6 h-6 rounded-lg text-stone-400 hover:text-red-400 flex items-center justify-center ml-0.5 cursor-pointer"
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
                          className="w-full text-xs px-3 py-2 bg-stone-900 border border-white/[0.06] rounded-xl text-stone-200 placeholder-stone-500 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 03. Informasi Pemesan */}
              <div className="space-y-3.5 pt-4 border-t border-white/[0.07]">
                <span className="text-xs font-semibold text-stone-200 block">
                  03. Data Pemesan &amp; Pengantaran
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-stone-400 mb-1.5 block">
                      Nama Lengkap <span className="text-orange-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nama Anda"
                      className="w-full text-xs px-3.5 py-2.5 bg-stone-950 border border-white/[0.08] rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-stone-400 mb-1.5 block">
                      Nomor WhatsApp Aktif <span className="text-orange-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full text-xs px-3.5 py-2.5 bg-stone-950 border border-white/[0.08] rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500"
                      required
                    />
                  </div>
                </div>

                {orderType === 'DELIVERY_DQM' && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-xs font-medium text-stone-400 mb-1.5 block">
                        Lokasi Area DQM (Asrama / Blok / Gedung) <span className="text-orange-400">*</span>
                      </label>
                      <select
                        value={deliveryLocation}
                        onChange={(e) => setDeliveryLocation(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 bg-stone-950 border border-white/[0.08] rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
                      >
                        {DQM_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-stone-400 mb-1.5 block">
                        Detail Lokasi (Kamar / Lantai / Patokan) <span className="text-orange-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={deliveryDetail}
                        onChange={(e) => setDeliveryDetail(e.target.value)}
                        placeholder="Contoh: Kamar 12 / Asrama Putra Lantai 2"
                        className="w-full text-xs px-3.5 py-2.5 bg-stone-950 border border-white/[0.08] rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-stone-400 mb-1.5 block">
                        Catatan Pengantaran
                      </label>
                      <input
                        type="text"
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="Contoh: Titip di lobi asrama / antar setelah Maghrib"
                        className="w-full text-xs px-3.5 py-2.5 bg-stone-950 border border-white/[0.08] rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                )}

                {orderType === 'BUNGKUS' && (
                  <div>
                    <label className="text-xs font-medium text-stone-400 mb-1.5 block">
                      Estimasi Waktu Pengambilan
                    </label>
                    <select
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-stone-950 border border-white/[0.08] rounded-xl text-stone-100 focus:outline-none focus:border-orange-500"
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
                  <label className="text-xs font-medium text-stone-400 mb-1.5 block">
                    Catatan Tambahan Untuk Dapur
                  </label>
                  <input
                    type="text"
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Contoh: Minta sendok plastik & sambal dipisah"
                    className="w-full text-xs px-3.5 py-2.5 bg-stone-950 border border-white/[0.08] rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* 04. Metode Pembayaran */}
              <div className="space-y-3 pt-4 border-t border-white/[0.07]">
                <span className="text-xs font-semibold text-stone-200 block">
                  04. Pilih Metode Pembayaran
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs font-semibold border transition cursor-pointer ${
                      paymentMethod === 'Cash'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/70 font-bold'
                        : 'bg-stone-950 border-white/[0.07] text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tunai / COD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs font-semibold border transition cursor-pointer ${
                      paymentMethod === 'QRIS'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/70 font-bold'
                        : 'bg-stone-950 border-white/[0.07] text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QRIS Resmi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Transfer')}
                    className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs font-semibold border transition cursor-pointer ${
                      paymentMethod === 'Transfer'
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/70 font-bold'
                        : 'bg-stone-950 border-white/[0.07] text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Transfer Bank</span>
                  </button>
                </div>

                {/* Bank Transfer Info Box */}
                {paymentMethod === 'Transfer' && (
                  <div className="p-3.5 bg-stone-950 border border-white/[0.08] rounded-2xl space-y-1.5 text-xs text-stone-300">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sky-400">Rekening Resmi Warung</span>
                      <button
                        type="button"
                        onClick={handleCopyBank}
                        className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        {copiedBank ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedBank ? 'Tersalin' : 'Salin Rekening'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-stone-100 font-bold">
                      {settings.onlineMenuBankInfo || 'BCA 8830192831 a.n Warung Bang Kobra'}
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Kirim bukti transfer melalui WhatsApp setelah pesanan dibuat.
                    </p>
                  </div>
                )}

                {/* QRIS Info Box with Zoom Option */}
                {paymentMethod === 'QRIS' && (settings.qrisImageUrl || settings.qrisUrl) && (
                  <div className="p-3.5 bg-stone-950 border border-amber-500/30 rounded-2xl flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => setIsQrisZoomOpen(true)}
                      className="relative group shrink-0 cursor-pointer"
                      title="Klik untuk memperbesar QRIS"
                    >
                      <img
                        src={settings.qrisImageUrl || settings.qrisUrl}
                        alt="QRIS Warung"
                        className="w-20 h-20 rounded-xl bg-white p-1.5 object-contain shadow-sm"
                      />
                      <span className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition">
                        Perbesar
                      </span>
                    </button>
                    <div className="text-xs space-y-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-amber-400 truncate">
                          {settings.qrisMerchantName || settings.storeName || 'QRIS Resmi Warung'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsQrisZoomOpen(true)}
                          className="text-[11px] font-semibold text-orange-400 hover:underline shrink-0 cursor-pointer"
                        >
                          Perbesar QR
                        </button>
                      </div>
                      {settings.qrisNmid && (
                        <span className="text-[11px] font-mono text-stone-400 block tabular-nums">
                          NMID: {settings.qrisNmid}
                        </span>
                      )}
                      <p className="text-[11px] text-stone-300 leading-relaxed">
                        {settings.qrisInstruction ||
                          'Scan melalui GoPay, OVO, Dana, ShopeePay, atau Mobile Banking.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Price Calculation Summary */}
              <div className="p-4 bg-stone-950 border border-white/[0.08] rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-stone-400">
                  <span>Subtotal Menu ({totalItemCount} porsi)</span>
                  <span className="font-semibold font-mono text-stone-200 tabular-nums">
                    {formatRupiah(cartSubtotal)}
                  </span>
                </div>

                {orderType === 'DELIVERY_DQM' && (
                  <>
                    <div className="flex items-center justify-between text-stone-400">
                      <span>Syarat Minimal Delivery</span>
                      <span
                        className={`font-semibold font-mono tabular-nums ${
                          cartSubtotal >= DELIVERY_MIN_ORDER_AMOUNT
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {formatRupiah(DELIVERY_MIN_ORDER_AMOUNT)}{' '}
                        {cartSubtotal >= DELIVERY_MIN_ORDER_AMOUNT
                          ? '(Terpenuhi)'
                          : `(Kurang ${formatRupiah(DELIVERY_MIN_ORDER_AMOUNT - cartSubtotal)})`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-stone-400">
                      <span>Biaya Pengantaran DQM</span>
                      <span className="font-semibold font-mono text-emerald-400 tabular-nums">
                        {deliveryFee > 0 ? formatRupiah(deliveryFee) : 'GRATIS'}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.07] font-bold text-sm text-stone-100">
                  <span>Total Pembayaran</span>
                  <span className="text-orange-400 text-base font-mono font-extrabold tabular-nums">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-white/[0.07] bg-stone-950/95 flex flex-col gap-2.5 shrink-0">
              <button
                type="button"
                id="btn-submit-order-wa"
                onClick={handleSubmitOrder}
                disabled={
                  isSubmitting ||
                  (orderType === 'DELIVERY_DQM' && selectedAreaOption === 'OUTSIDE') ||
                  (orderType === 'DELIVERY_DQM' && cartSubtotal < DELIVERY_MIN_ORDER_AMOUNT)
                }
                className={`w-full min-h-[48px] py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  orderType === 'DELIVERY_DQM' && cartSubtotal < DELIVERY_MIN_ORDER_AMOUNT
                    ? 'bg-stone-800 border border-amber-500/40 text-amber-300'
                    : 'bg-orange-500 hover:bg-orange-400 text-stone-950 active:scale-[0.99]'
                }`}
              >
                {isSubmitting ? (
                  <span>Mengirim Pesanan ke Antrian Kasir...</span>
                ) : orderType === 'DELIVERY_DQM' && cartSubtotal < DELIVERY_MIN_ORDER_AMOUNT ? (
                  <>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Tambah {formatRupiah(DELIVERY_MIN_ORDER_AMOUNT - cartSubtotal)} Lagi untuk Delivery DQM
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      Buat Pesanan Sekarang · {formatRupiah(grandTotal)}
                    </span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-stone-400">
                Pesanan langsung tercatat otomatis di layar Antrian Kasir {settings.storeName}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QRIS Fullscreen Zoom Modal */}
      {isQrisZoomOpen && (settings.qrisImageUrl || settings.qrisUrl) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setIsQrisZoomOpen(false)}
        >
          <div
            className="bg-stone-900 border border-white/10 rounded-3xl max-w-sm w-full p-5 text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h4 className="font-display font-bold text-sm text-stone-100">
                  {settings.qrisMerchantName || settings.storeName}
                </h4>
                {settings.qrisNmid && (
                  <p className="text-[11px] font-mono text-stone-400 tabular-nums">
                    NMID: {settings.qrisNmid}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsQrisZoomOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl mx-auto">
              <img
                src={settings.qrisImageUrl || settings.qrisUrl}
                alt="QRIS"
                className="w-full max-h-72 object-contain mx-auto"
              />
            </div>

            <div className="text-xs text-stone-300 space-y-1">
              <div className="font-mono font-bold text-base text-orange-400 tabular-nums">
                Nominal: {formatRupiah(grandTotal)}
              </div>
              <p className="text-[11px] text-stone-400">
                Scan kode QRIS di atas menggunakan aplikasi e-Wallet atau Mobile Banking Anda.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed Order Confirmation & Real-time Digital Queue Ticket Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-md p-6 text-center space-y-5 shadow-2xl animate-pop-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-emerald-400">
                Pesanan Tercatat di Antrian Kasir
              </div>
              <h3 className="font-display text-xl font-bold text-stone-100">
                Tiket Antrian Digital Anda
              </h3>
              <p className="text-xs text-stone-400 font-mono tabular-nums">
                ID Transaksi: {completedOrder.orderId}
              </p>
            </div>

            {/* Digital Queue Pass Number Box */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-white/[0.08] space-y-3">
              <div>
                <span className="text-[11px] text-stone-400 block">Nomor Antrian Kasir</span>
                <span className="font-mono text-3xl font-extrabold text-orange-400 tracking-tight tabular-nums block mt-0.5">
                  #{getTakeawayQueueNumber(completedOrder.createdOrder)}
                </span>
              </div>

              {/* 4-Step Live Progress Bar */}
              <div className="pt-3 border-t border-white/[0.06] space-y-2 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-400">Status Real-time:</span>
                  <span className="font-semibold text-emerald-400">
                    {orderType === 'DELIVERY_DQM'
                      ? getDeliveryStatusLabel(liveDeliveryStatus)
                      : getOrderStatusLabel(liveStatus, orderType)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {(['MENUNGGU', 'DIPROSES', 'SIAP', 'SELESAI'] as const).map((step, idx) => {
                    const orderStages = ['MENUNGGU', 'DIPROSES', 'SIAP', 'SELESAI'];
                    const activeIdx = Math.max(0, orderStages.indexOf(liveStatus));
                    const isCompleted = idx <= activeIdx;
                    return (
                      <div key={step} className="space-y-1 text-center">
                        <div
                          className={`h-1.5 rounded-full transition-colors ${
                            isCompleted ? 'bg-emerald-400' : 'bg-stone-800'
                          }`}
                        />
                        <span
                          className={`text-[10px] block truncate ${
                            isCompleted ? 'text-stone-200 font-semibold' : 'text-stone-500'
                          }`}
                        >
                          {idx === 0
                            ? 'Antri'
                            : idx === 1
                            ? 'Dimasak'
                            : idx === 2
                            ? orderType === 'DELIVERY_DQM'
                              ? 'Diantar'
                              : 'Siap'
                            : 'Selesai'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Details Summary */}
              <div className="pt-3 border-t border-white/[0.06] text-xs text-stone-300 space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span className="text-stone-400">Layanan:</span>
                  <span className="font-semibold text-stone-100">
                    {orderType === 'BUNGKUS' ? 'Bungkus (Ambil di Warung)' : 'Delivery Pesantren DQM'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Total Pembayaran:</span>
                  <span className="font-mono font-bold text-orange-400 tabular-nums">
                    {formatRupiah(completedOrder.total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Metode Bayar:</span>
                  <span className="font-semibold text-stone-200">
                    {completedOrder.createdOrder.metode_pembayaran}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {orderType === 'DELIVERY_DQM' && (
                <button
                  type="button"
                  onClick={() => setIsViewingCustomerProof(true)}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 border border-white/10 text-stone-100 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ReceiptText className="w-4 h-4 text-orange-400" />
                  <span>Lihat Bukti Pengantaran DQM</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenWhatsAppConfirmation}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Konfirmasi Pesanan via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletedOrder(null)}
                className="w-full min-h-[40px] py-2 px-4 rounded-xl bg-stone-950 hover:bg-stone-800 border border-white/[0.07] text-stone-300 font-semibold text-xs transition cursor-pointer"
              >
                <span>Selesai &amp; Kembali ke Menu</span>
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

      {/* Floating Chat Kasir Widget */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40">
        <button
          type="button"
          id="btn-chat-kasir-public-floating"
          onClick={handleChatKasir}
          className="h-12 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-2xl shadow-emerald-950/80 border-2 border-emerald-300/40 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          title="Chat Kasir WARUNG BANG KOBRA via WhatsApp"
        >
          <div className="w-6 h-6 rounded-full bg-stone-950/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-stone-950" />
          </div>
          <span>Chat Kasir</span>
          <span className="w-2 h-2 rounded-full bg-stone-950 animate-pulse" />
        </button>
      </div>

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

      {/* Quiet Editorial Footer */}
      <footer className="mt-auto border-t border-white/[0.07] bg-stone-950 py-8 px-4 text-center text-xs text-stone-400">
        <div className="max-w-xl mx-auto space-y-1.5">
          <p className="font-display font-bold text-stone-200">
            {settings.storeName}
          </p>
          <p className="text-xs text-stone-400">
            {settings.address || settings.storeAddress} · Layanan Pesan Online Resmi Bungkus &amp; Delivery DQM
          </p>
        </div>
      </footer>
    </div>
  );
};
