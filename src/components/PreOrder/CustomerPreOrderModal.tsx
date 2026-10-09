import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  Users,
  MapPin,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Sparkles,
  Layers,
  Search,
  Copy,
  Check,
  ChevronRight,
  ArrowLeft,
  Info,
  DollarSign,
  CreditCard,
  QrCode,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Product,
  ProductVariant,
  StoreSettings,
  Transaction,
  POPaymentStatus,
  POStatus,
} from '../../types';
import {
  formatRupiah,
  sanitizeWhatsAppNumber,
  openWhatsAppChat,
  DQM_LOCATIONS,
  calculateRequiredDP,
  validatePODate,
  buildPreOrderCustomerWhatsAppMessage,
} from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { saveOrderToFirebase } from '../../services/firebase';
import { GoogleChatService } from '../../services/googleChatService';

interface CustomerPreOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  variants?: ProductVariant[];
  settings: StoreSettings;
  onOrderCreated?: (newTx: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenTracking?: (poNumber: string) => void;
}

interface SelectedPOItem {
  product: Product;
  variant?: ProductVariant;
  qty: number;
  price: number;
  notes?: string;
}

const EVENT_TYPES = [
  'Pengajian & Majelis Taklim',
  'Rapat & Pertemuan Kantor',
  'Ulang Tahun & Syukuran',
  'Pernikahan & Hajatan',
  'Acara Santri Pesantren DQM',
  'Arisan & Kumpul Keluarga',
  'Buka Puasa Bersama',
  'Gathering & Komunitas',
  'Lainnya',
];

export const CustomerPreOrderModal: React.FC<CustomerPreOrderModalProps> = ({
  isOpen,
  onClose,
  products,
  variants = [],
  settings,
  onOrderCreated,
  showToast,
  onOpenTracking,
}) => {
  // Step navigation: 1 = Form & Menu, 2 = Success Confirmation
  const [step, setStep] = useState<'form' | 'success'>('form');

  // Customer & Event Info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [customEventType, setCustomEventType] = useState('');
  
  // Date calculation: minimum 1 day in advance (H-1)
  const minDateStr = useMemo(() => {
    const minDays = settings.poMinDaysAhead ?? 1;
    const d = new Date();
    d.setDate(d.getDate() + Math.max(1, minDays));
    return d.toISOString().split('T')[0];
  }, [settings.poMinDaysAhead]);

  const [eventDate, setEventDate] = useState(minDateStr);
  const [eventTime, setEventTime] = useState('11:00');
  const [guestCount, setGuestCount] = useState<number | ''>(25);

  // Delivery / Takeaway selection
  const [deliveryType, setDeliveryType] = useState<'BUNGKUS' | 'DELIVERY_DQM'>('BUNGKUS');
  const [deliveryLocation, setDeliveryLocation] = useState(DQM_LOCATIONS[0]);
  const [customLocationDetail, setCustomLocationDetail] = useState('');
  const [notes, setNotes] = useState('');

  // Selected items in PO
  const [selectedItems, setSelectedItems] = useState<SelectedPOItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Variant Modal
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);

  // Payment & DP
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'QRIS' | 'E-wallet'>('Transfer');
  const [dpPaidAmount, setDpPaidAmount] = useState<number | ''>('');
  const [dpProofUrl, setDpProofUrl] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Completed PO State
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedPONumber, setCopiedPONumber] = useState(false);

  // Variants by product ID lookup map
  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    products.forEach((p) => {
      const pId = String(p.id).trim();
      const pSku = String(p.sku || '').trim();
      const pName = String(p.nama || '').trim().toLowerCase();
      const matched = variants.filter(
        (v) =>
          v &&
          v.isActive !== false &&
          (String(v.productId).trim() === pId ||
            (pSku && String(v.productId).trim() === pSku) ||
            (v.productName && String(v.productName).trim().toLowerCase() === pName))
      );
      if (matched.length > 0) {
        map.set(pId, matched);
        if (pSku) map.set(pSku, matched);
      }
    });
    return map;
  }, [products, variants]);

  // Categories list
  const categories = ['Semua', 'Makanan', 'Minuman', 'Snack', 'Tambahan'];

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) => {
      if (p.status !== 'Aktif') return false;
      const matchCat = selectedCategory === 'Semua' || p.kategori === selectedCategory;
      if (!q) return matchCat;
      const matchSearch =
        p.nama.toLowerCase().includes(q) ||
        (p.deskripsi && p.deskripsi.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [products, productSearch, selectedCategory]);

  // Calculations
  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, it) => sum + it.qty * it.price, 0);
  }, [selectedItems]);

  const deliveryFee = useMemo(() => {
    if (deliveryType !== 'DELIVERY_DQM') return 0;
    if (settings.deliveryFeeType === 'FREE') return 0;
    return Number(settings.deliveryFeeAmount ?? 2000);
  }, [deliveryType, settings]);

  const total = subtotal + deliveryFee;

  const requiredDP = useMemo(() => {
    return calculateRequiredDP(total, settings);
  }, [total, settings]);

  const effectiveDpPaid = Number(dpPaidAmount) || requiredDP;
  const remainingPayment = Math.max(0, total - effectiveDpPaid);

  if (!isOpen) return null;

  // Add product / variant to PO
  const handleAddItem = (product: Product, variant?: ProductVariant) => {
    const unitPrice = variant
      ? Number(variant.price) > 0
        ? Number(variant.price)
        : Number(product.harga_jual)
      : Number(product.harga_jual);

    setSelectedItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) =>
          it.product.id === product.id &&
          (variant ? it.variant?.variantId === variant.variantId : !it.variant)
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].qty += 1;
        return next;
      }
      return [
        ...prev,
        {
          product,
          variant,
          qty: 1,
          price: unitPrice,
        },
      ];
    });

    if (showToast) {
      const name = variant ? `${product.nama} (${variant.variantName})` : product.nama;
      showToast(`+1 ${name} ditambahkan ke Pre-Order`, 'success');
    }
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    setSelectedItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      next[index] = { ...item, qty: newQty };
      return next;
    });
  };

  const handleUpdateItemNotes = (index: number, note: string) => {
    setSelectedItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], notes: note };
      }
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Proof Image Upload
  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (showToast) showToast('Ukuran foto bukti maksimal 5MB!', 'error');
      return;
    }

    setIsUploadingProof(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setDpProofUrl(base64);
      setIsUploadingProof(false);
      if (showToast) showToast('Foto bukti transfer DP berhasil diunggah!', 'success');
    };
    reader.onerror = () => {
      setIsUploadingProof(false);
      if (showToast) showToast('Gagal membaca file foto.', 'error');
    };
    reader.readAsDataURL(file);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      if (showToast) showToast('Nama pemesan wajib diisi!', 'error');
      return;
    }
    if (!customerPhone.trim()) {
      if (showToast) showToast('Nomor WhatsApp wajib diisi!', 'error');
      return;
    }

    const dateVal = validatePODate(eventDate, settings.poMinDaysAhead ?? 1);
    if (!dateVal.valid) {
      if (showToast) showToast(dateVal.message || 'Tanggal pesanan tidak valid!', 'error');
      return;
    }

    if (selectedItems.length === 0) {
      if (showToast) showToast('Pilih minimal 1 menu untuk Pre-Order!', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const poNumber = StorageService.generatePONumber('PO-WBK');
      const now = new Date();
      const resolvedEventType = eventType === 'Lainnya' && customEventType.trim() ? customEventType.trim() : eventType;

      const isDelivery = deliveryType === 'DELIVERY_DQM';
      const eventLocation = isDelivery
        ? `Pesantren DQM - ${deliveryLocation} ${customLocationDetail ? `(${customLocationDetail.trim()})` : ''}`.trim()
        : 'Ambil di Warung Bang Kobra';

      const initialStatus: POStatus = 'MENUNGGU_KONFIRMASI';
      const initialPaymentStatus: POPaymentStatus = dpProofUrl || (Number(dpPaidAmount) > 0) ? 'DP' : 'BELUM_BAYAR';

      const itemsFormatted = selectedItems.map((it, idx) => ({
        id_detail: `DET-${poNumber}-${idx + 1}`,
        id_transaksi: poNumber,
        id_produk: it.product.id,
        nama_produk: it.variant ? `${it.product.nama} - ${it.variant.variantName}` : it.product.nama,
        productName: it.product.nama,
        variantId: it.variant?.variantId,
        variantName: it.variant?.variantName,
        harga_modal: it.variant ? it.variant.costPrice : it.product.harga_modal,
        harga: it.price,
        qty: it.qty,
        subtotal: it.qty * it.price,
        catatan: it.notes || '',
      }));

      const newTx: Transaction = {
        id_transaksi: poNumber,
        poNumber,
        tanggal: now.toISOString().split('T')[0],
        jam: now.toTimeString().split(' ')[0],
        kasir: 'Form Pre-Order Online',
        nama_pelanggan: customerName.trim(),
        no_whatsapp: sanitizeWhatsAppNumber(customerPhone.trim()),
        email_pelanggan: customerEmail.trim() || undefined,
        subtotal,
        diskon: 0,
        biaya: deliveryFee,
        total,
        metode_pembayaran: paymentMethod,
        uang_diterima: dpProofUrl ? requiredDP : Number(dpPaidAmount) || 0,
        kembalian: 0,
        status: 'MENUNGGU',
        orderType: 'PRE_ORDER',
        tipe_pesanan: 'PRE_ORDER' as any,
        deliveryArea: isDelivery ? 'DQM' : null,
        deliveryLocation: isDelivery ? deliveryLocation : null,
        deliveryDetail: isDelivery ? customLocationDetail.trim() : null,
        deliveryFee,
        alamat_pengantaran: eventLocation,
        catatan_pesanan: notes.trim() || undefined,
        created_at: now.toISOString(),
        items: itemsFormatted,

        // Specific PO Fields
        eventType: resolvedEventType,
        eventDate,
        eventTime,
        guestCount: Number(guestCount) || undefined,
        deliveryType,
        eventLocation,
        dpRequired: requiredDP,
        dpPaid: dpProofUrl ? requiredDP : Number(dpPaidAmount) || 0,
        remainingPayment,
        paymentStatus: initialPaymentStatus,
        poStatus: initialStatus,
        dpProofUrl: dpProofUrl || undefined,
        notes: notes.trim() || undefined,
        poStockDeducted: false,
        paymentHistory: dpProofUrl
          ? [
              {
                id: `PAY-${Date.now()}`,
                amount: requiredDP,
                type: 'DP',
                method: paymentMethod,
                date: now.toISOString(),
                note: 'Bukti transfer DP diunggah saat pemesanan',
                proofUrl: dpProofUrl,
              },
            ]
          : [],
      };

      // 1. Save to Firebase Firestore
      await saveOrderToFirebase(newTx);

      // 2. Save locally
      StorageService.completeTransaction(newTx);

      // 3. Dispatch Google Chat PO Notification
      GoogleChatService.dispatchOrderNotifications(newTx, settings).catch(() => {});

      if (onOrderCreated) {
        onOrderCreated(newTx);
      }

      setCompletedTx(newTx);
      setStep('success');

      if (showToast) {
        showToast(`Pre-Order ${poNumber} berhasil diajukan!`, 'success');
      }
    } catch (err) {
      console.error('Submit PO error:', err);
      if (showToast) showToast('Gagal mengajukan Pre-Order. Silakan coba lagi!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsAppKasir = () => {
    if (!completedTx) return;
    const waKasir = settings.whatsappNumber;
    if (!waKasir) {
      if (showToast) showToast('Nomor WhatsApp kasir belum dikonfigurasi.', 'error');
      return;
    }

    const msg = buildPreOrderCustomerWhatsAppMessage({
      storeName: settings.storeName,
      poNumber: completedTx.poNumber || completedTx.id_transaksi,
      customerName: completedTx.nama_pelanggan,
      customerPhone: completedTx.no_whatsapp,
      customerEmail: completedTx.email_pelanggan,
      eventType: completedTx.eventType || 'Acara',
      eventDate: completedTx.eventDate || completedTx.tanggal,
      eventTime: completedTx.eventTime || completedTx.jam,
      guestCount: completedTx.guestCount,
      deliveryType: completedTx.deliveryType || 'BUNGKUS',
      eventLocation: completedTx.eventLocation,
      items: completedTx.items.map((it) => ({
        name: it.nama_produk,
        qty: it.qty,
        price: it.harga,
        notes: it.catatan,
      })),
      subtotal: completedTx.subtotal,
      deliveryFee: completedTx.biaya,
      total: completedTx.total,
      dpRequired: completedTx.dpRequired || 0,
      dpPaid: completedTx.dpPaid || 0,
      remainingPayment: completedTx.remainingPayment ?? completedTx.total,
      paymentMethod: completedTx.metode_pembayaran,
      notes: completedTx.notes,
      hasDpProof: Boolean(completedTx.dpProofUrl),
    });

    openWhatsAppChat(waKasir, msg);
  };

  const handleCopyPONumber = () => {
    if (!completedTx) return;
    navigator.clipboard.writeText(completedTx.poNumber || completedTx.id_transaksi);
    setCopiedPONumber(true);
    setTimeout(() => setCopiedPONumber(false), 2000);
    if (showToast) showToast('Nomor PO berhasil disalin!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto">
        {/* Top Header */}
        <div className="px-5 py-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-stone-950 shrink-0 shadow-md">
              <Calendar className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-stone-100 text-base sm:text-lg truncate">
                  Formulir Pre-Order (PO) Acara
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Pesan Jauh Hari
                </span>
              </div>
              <p className="text-xs text-stone-400 truncate">
                {settings.storeName || 'WARUNG BANG KOBRA'} · Pesanan porsi besar, pengajian, rapat & hajatan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Banner Aturan & Ketentuan PO */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-stone-300 space-y-1">
                <span className="font-bold text-amber-300 block">Ketentuan Pemesanan Pre-Order (PO):</span>
                <p className="text-stone-400 leading-relaxed">
                  Pemesanan wajib dilakukan minimal <strong>{settings.poMinDaysAhead ?? 1} hari</strong> sebelum acara. 
                  Ketentuan Uang Muka (DP) sebesar <strong>{settings.poDpType === 'FIXED' ? formatRupiah(settings.poDpFixedAmount ?? 100000) : `${settings.poDpPercent ?? 50}%`}</strong> untuk mengikat jadwal dapur dan bahan baku segar.
                </p>
              </div>
            </div>

            {/* Bagian 1: Data Pemesan & Acara */}
            <div className="bg-stone-950 border border-stone-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
              <h4 className="font-extrabold text-sm text-stone-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-mono">1</span>
                <span>Data Pemesan &amp; Informasi Acara</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Nama Pemesan / Penanggung Jawab *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Ust. Fauzi / Ibu Rina"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Nomor WhatsApp Pemesan *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Email Pemesan (Opsional)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Jenis Acara *
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    {EVENT_TYPES.map((et) => (
                      <option key={et} value={et}>
                        {et}
                      </option>
                    ))}
                  </select>
                </div>

                {eventType === 'Lainnya' && (
                  <div>
                    <label className="text-xs font-bold text-stone-300 mb-1 block">
                      Tuliskan Jenis Acara *
                    </label>
                    <input
                      type="text"
                      required
                      value={customEventType}
                      onChange={(e) => setCustomEventType(e.target.value)}
                      placeholder="Sebutkan nama acara"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Perkiraan Jumlah Tamu / Porsi
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={guestCount}
                      onChange={(e) => setGuestCount(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Contoh: 30"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <span className="absolute right-3 top-2 text-xs text-stone-500 pointer-events-none">
                      Orang
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Tanggal Pesanan Siap *
                  </label>
                  <input
                    type="date"
                    required
                    min={minDateStr}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Minimal H-1 dari hari ini
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Jam Pesanan Siap *
                  </label>
                  <input
                    type="time"
                    required
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Waktu matang / siap disajikan
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-300 mb-1.5 block">
                    Pilihan Pengambilan Pesanan *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('BUNGKUS')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                        deliveryType === 'BUNGKUS'
                          ? 'bg-amber-500/15 border-amber-500 text-stone-100'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <ShoppingBag className={`w-4 h-4 ${deliveryType === 'BUNGKUS' ? 'text-amber-400' : 'text-stone-500'}`} />
                      <div>
                        <div className="text-xs font-bold">Bungkus (Ambil di Warung)</div>
                        <div className="text-[10px] text-stone-500">Gratis biaya pengantaran</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType('DELIVERY_DQM')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                        deliveryType === 'DELIVERY_DQM'
                          ? 'bg-emerald-500/15 border-emerald-500 text-stone-100'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <MapPin className={`w-4 h-4 ${deliveryType === 'DELIVERY_DQM' ? 'text-emerald-400' : 'text-stone-500'}`} />
                      <div>
                        <div className="text-xs font-bold">Delivery Pesantren DQM</div>
                        <div className="text-[10px] text-stone-500">Khusus area Pesantren DQM</div>
                      </div>
                    </button>
                  </div>
                </div>

                {deliveryType === 'DELIVERY_DQM' && (
                  <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-stone-900 border border-emerald-500/30">
                    <div>
                      <label className="text-xs font-bold text-emerald-400 mb-1 block">
                        Area / Blok Pesantren DQM *
                      </label>
                      <select
                        value={deliveryLocation}
                        onChange={(e) => setDeliveryLocation(e.target.value)}
                        className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
                      >
                        {DQM_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-300 mb-1 block">
                        Detail Gedung / Kamar / Ruang Acara
                      </label>
                      <input
                        type="text"
                        value={customLocationDetail}
                        onChange={(e) => setCustomLocationDetail(e.target.value)}
                        placeholder="Contoh: Asrama Putra Lt. 2 / Aula Pertemuan"
                        className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bagian 2: Pilih Menu & Varian Rasa */}
            <div className="bg-stone-950 border border-stone-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="font-extrabold text-sm text-stone-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-mono">2</span>
                  <span>Pilih Menu &amp; Varian Rasa untuk Acara</span>
                </h4>
                <div className="text-xs text-amber-400 font-bold font-mono">
                  {selectedItems.reduce((s, it) => s + it.qty, 0)} Total Porsi Dipilih
                </div>
              </div>

              {/* Filter & Search */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Cari menu masakan, Pop Ice, Nutrisari, Indomie..."
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        Kategori: {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Grid Catalog */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto p-1 border border-stone-900 rounded-xl bg-stone-900/40">
                {filteredProducts.map((p) => {
                  const prodVars = variantsByProduct.get(p.id) || [];
                  const hasVars = prodVars.length > 0;
                  return (
                    <div
                      key={p.id}
                      className="bg-stone-900/90 border border-stone-800 rounded-xl p-2.5 flex flex-col justify-between hover:border-amber-500/50 transition group"
                    >
                      <div className="space-y-1">
                        <div className="text-[10px] text-orange-400 font-bold uppercase truncate">
                          {p.kategori}
                        </div>
                        <div className="text-xs font-bold text-stone-100 line-clamp-1 group-hover:text-amber-400 transition-colors">
                          {p.nama}
                        </div>
                        <div className="text-[11px] font-mono text-amber-300 font-bold">
                          {formatRupiah(p.harga_jual)}
                        </div>
                      </div>

                      <div className="pt-2">
                        {hasVars ? (
                          <button
                            type="button"
                            onClick={() => setVariantModalProduct(p)}
                            className="w-full py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[11px] flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                          >
                            <Layers className="w-3 h-3" />
                            <span>Pilih Rasa ({prodVars.length})</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddItem(p)}
                            className="w-full py-1.5 px-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Tambah</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Menu List Table / Cards */}
              <div className="space-y-2 pt-2 border-t border-stone-800">
                <span className="text-xs font-bold text-stone-300 block">
                  Daftar Menu yang Dipesan ({selectedItems.length} Jenis Menu):
                </span>

                {selectedItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-stone-800 rounded-xl text-stone-500 text-xs">
                    Belum ada menu yang dipilih. Klik tombol "+ Tambah" atau "Pilih Rasa" di atas untuk menambahkan menu acara.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedItems.map((item, idx) => {
                      const itemTitle = item.variant
                        ? `${item.product.nama} (${item.variant.variantName})`
                        : item.product.nama;
                      return (
                        <div
                          key={idx}
                          className="bg-stone-900 border border-stone-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-stone-100 truncate">
                                {itemTitle}
                              </span>
                              <span className="text-[10px] text-stone-400 font-mono">
                                @ {formatRupiah(item.price)}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => handleUpdateItemNotes(idx, e.target.value)}
                              placeholder="Catatan porsi ini (cth: pedas, bungkus terpisah, es batu dipisah)..."
                              className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1 text-[11px] text-stone-300 mt-1 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            {/* Qty Stepper */}
                            <div className="flex items-center gap-1.5 bg-stone-950 rounded-xl p-1 border border-stone-800">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, -1)}
                                className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center font-bold text-xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-mono font-bold text-xs text-stone-100">
                                {item.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, 1)}
                                className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center font-bold text-xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="font-mono font-bold text-xs text-amber-400 w-24 text-right">
                              = {formatRupiah(item.qty * item.price)}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-stone-500 hover:text-rose-400 p-1 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bagian 3: Pembayaran & DP */}
            <div className="bg-stone-950 border border-stone-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
              <h4 className="font-extrabold text-sm text-stone-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-mono">3</span>
                <span>Ketentuan Pembayaran &amp; Uang Muka (DP)</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Summary Box */}
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-2.5">
                  <div className="flex justify-between text-xs text-stone-400">
                    <span>Subtotal Menu:</span>
                    <span className="font-mono font-bold text-stone-200">{formatRupiah(subtotal)}</span>
                  </div>

                  {deliveryType === 'DELIVERY_DQM' && (
                    <div className="flex justify-between text-xs text-stone-400">
                      <span>Biaya Pengantaran DQM:</span>
                      <span className="font-mono font-bold text-stone-200">
                        {deliveryFee > 0 ? formatRupiah(deliveryFee) : 'GRATIS'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-black text-stone-100 pt-2 border-t border-stone-800">
                    <span>Total Keseluruhan:</span>
                    <span className="font-mono text-base text-orange-400">{formatRupiah(total)}</span>
                  </div>

                  <div className="flex justify-between text-xs font-bold text-amber-300 pt-2 border-t border-stone-800">
                    <span>Kewajiban DP ({settings.poDpType === 'FIXED' ? 'Nominal Tetap' : `${settings.poDpPercent ?? 50}%`}):</span>
                    <span className="font-mono text-sm">{formatRupiah(requiredDP)}</span>
                  </div>

                  <div className="flex justify-between text-xs text-stone-400">
                    <span>Sisa Pelunasan:</span>
                    <span className="font-mono font-bold text-emerald-400">{formatRupiah(remainingPayment)}</span>
                  </div>
                </div>

                {/* Payment Selection & Proof */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-stone-300 mb-1.5 block">
                      Metode Pembayaran DP *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Transfer', 'QRIS', 'Cash', 'E-wallet'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`p-2 rounded-xl text-xs font-bold border text-left transition cursor-pointer flex items-center gap-2 ${
                            paymentMethod === m
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                          }`}
                        >
                          {m === 'Transfer' && <CreditCard className="w-3.5 h-3.5" />}
                          {m === 'QRIS' && <QrCode className="w-3.5 h-3.5" />}
                          {m === 'Cash' && <DollarSign className="w-3.5 h-3.5" />}
                          {m === 'E-wallet' && <Sparkles className="w-3.5 h-3.5" />}
                          <span>{m}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'Transfer' && settings.onlineMenuBankInfo && (
                    <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-300">
                      <span className="text-[10px] text-amber-400 font-bold block mb-0.5">Rekening Transfer Resmi:</span>
                      <p className="font-mono text-stone-200">{settings.onlineMenuBankInfo}</p>
                    </div>
                  )}

                  {paymentMethod === 'QRIS' && (settings.qrisImageUrl || settings.qrisUrl) && (
                    <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center gap-3">
                      <img
                        src={settings.qrisImageUrl || settings.qrisUrl}
                        alt="QRIS Warung"
                        className="w-14 h-14 object-contain rounded-lg bg-white p-1"
                      />
                      <div className="text-xs text-stone-300">
                        <span className="text-amber-400 font-bold block">QRIS Warung Bang Kobra</span>
                        <p className="text-[11px] text-stone-400">Scan via GoPay, OVO, Dana, BCA, Mandiri, dll.</p>
                      </div>
                    </div>
                  )}

                  {/* Upload Bukti Pembayaran DP (Opsional) */}
                  <div>
                    <label className="text-xs font-bold text-stone-300 mb-1 flex items-center justify-between">
                      <span>Upload Bukti Transfer DP (Opsional)</span>
                      {dpProofUrl && (
                        <button
                          type="button"
                          onClick={() => setDpProofUrl('')}
                          className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                        >
                          Hapus Bukti
                        </button>
                      )}
                    </label>

                    {dpProofUrl ? (
                      <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-stone-900 p-2 flex items-center gap-3">
                        <img
                          src={dpProofUrl}
                          alt="Bukti Transfer DP"
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                        <div className="text-xs text-emerald-400 font-bold">
                          ✓ Bukti transfer DP terunggah siap diverifikasi kasir
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-stone-700 hover:border-amber-500/60 bg-stone-900/60 text-stone-400 hover:text-stone-200 cursor-pointer transition text-xs font-bold">
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>{isUploadingProof ? 'Membaca gambar...' : 'Klik untuk Unggah Struk / Bukti Transfer'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProofUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bagian 4: Catatan Khusus */}
            <div className="bg-stone-950 border border-stone-800/80 rounded-2xl p-4 sm:p-5 space-y-2">
              <label className="text-xs font-bold text-stone-300 block">
                Catatan Khusus untuk Dapur &amp; Kasir (Opsional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Sambal dipisah semua, makanan dibungkus per box, minta disiapkan 30 menit sebelum jam acara..."
                className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Submit Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-stone-800">
              <div className="text-xs text-stone-400">
                Total Tagihan:{' '}
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {formatRupiah(total)}
                </span>{' '}
                · DP: <span className="font-bold text-stone-200">{formatRupiah(requiredDP)}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || selectedItems.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-stone-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Mengajukan Pre-Order...</span>
                  ) : (
                    <>
                      <span>Ajukan Pre-Order Sekarang</span>
                      <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Step 2: Success Confirmation & Ticket PO */
          <div className="p-6 sm:p-8 space-y-6 text-center overflow-y-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Pemesanan Pre-Order Berhasil Dibuat
              </span>
              <h3 className="font-extrabold text-xl sm:text-2xl text-stone-100">
                Tiket Pre-Order (PO) Anda
              </h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
                Pesanan telah masuk ke sistem kasir WARUNG BANG KOBRA. Silakan hubungi kasir via WhatsApp untuk verifikasi jadwal &amp; pembayaran DP.
              </p>
            </div>

            {/* PO Card Ticket */}
            <div className="bg-stone-950 border border-amber-500/40 rounded-3xl p-5 sm:p-6 text-left max-w-xl mx-auto space-y-4 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div>
                  <span className="text-[10px] text-stone-400 block uppercase tracking-wider">Nomor Pre-Order (PO)</span>
                  <span className="font-mono text-lg sm:text-xl font-black text-amber-400">
                    {completedTx?.poNumber || completedTx?.id_transaksi}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPONumber}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-bold text-stone-300 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedPONumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                  <span>{copiedPONumber ? 'Tersalin' : 'Salin No. PO'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 block">Pemesan:</span>
                  <span className="font-bold text-stone-200">{completedTx?.nama_pelanggan}</span>
                </div>
                <div>
                  <span className="text-stone-400 block">Jenis Acara:</span>
                  <span className="font-bold text-stone-200">{completedTx?.eventType}</span>
                </div>
                <div>
                  <span className="text-stone-400 block">Jadwal Pesanan Siap:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {completedTx?.eventDate} pukul {completedTx?.eventTime} WIB
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block">Layanan:</span>
                  <span className="font-bold text-stone-200">
                    {completedTx?.deliveryType === 'DELIVERY_DQM' ? 'Delivery Pesantren DQM' : 'Bungkus di Warung'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-stone-400 block">Status Pembayaran:</span>
                  <span className="font-bold text-amber-300">
                    {completedTx?.paymentStatus === 'DP' ? 'Uang Muka (DP) Tercatat' : 'Menunggu Konfirmasi DP'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 flex justify-between items-center text-sm">
                <span className="text-stone-400 font-bold">Total Nilai PO:</span>
                <span className="font-mono font-black text-amber-400 text-base">
                  {formatRupiah(completedTx?.total || 0)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="max-w-xl mx-auto space-y-2.5">
              <button
                type="button"
                onClick={handleOpenWhatsAppKasir}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition active:scale-95 cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                <span>Kirim Rincian PO ke WhatsApp Kasir</span>
              </button>

              <div className="flex items-center gap-2">
                {onOpenTracking && completedTx && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTracking(completedTx.poNumber || completedTx.id_transaksi);
                    }}
                    className="flex-1 py-3 px-4 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs transition cursor-pointer"
                  >
                    Lacak Status PO Ini
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-2xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 font-bold text-xs transition cursor-pointer"
                >
                  Tutup &amp; Kembali ke Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Modal: Flavor / Variant Picker */}
      {variantModalProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-700 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <h4 className="font-extrabold text-stone-100 text-sm">
                  Pilih Varian Rasa: {variantModalProduct.nama}
                </h4>
                <p className="text-[11px] text-stone-400">
                  Tersedia {(variantsByProduct.get(variantModalProduct.id) || []).length} varian rasa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVariantModalProduct(null)}
                className="w-7 h-7 rounded-lg bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(variantsByProduct.get(variantModalProduct.id) || []).map((v) => {
                const vPrice = Number(v.price) > 0 ? Number(v.price) : Number(variantModalProduct.harga_jual);
                return (
                  <div
                    key={v.variantId}
                    className="p-3 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between gap-3 hover:border-amber-500/50 transition"
                  >
                    <div>
                      <div className="font-bold text-xs text-stone-100">{v.variantName}</div>
                      <div className="text-[11px] font-mono text-amber-400 font-bold">
                        {formatRupiah(vPrice)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleAddItem(variantModalProduct, v);
                        setVariantModalProduct(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 active:scale-95 cursor-pointer shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Pilih</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
