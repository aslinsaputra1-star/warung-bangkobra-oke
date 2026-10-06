import React, { useState, useMemo } from 'react';
import {
  X,
  Store,
  Bike,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Phone,
  User,
  Mail,
  MapPin,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
  ArrowLeft,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react';
import { Product, ProductVariant, StoreSettings, Transaction, OrderType, PaymentMethod } from '../../types';
import {
  formatRupiah,
  sanitizeWhatsAppNumber,
  DELIVERY_MIN_ORDER_AMOUNT,
  DQM_LOCATIONS,
  getEffectiveDeliveryFee,
} from '../../utils/formatters';
import { StorageService } from '../../services/storage';
import { saveOrderToFirebase } from '../../services/firebase';

export interface CustomerCartItem {
  cartKey: string;
  product: Product;
  variant?: ProductVariant;
  qty: number;
  notes: string;
}

interface CustomerCheckoutModalProps {
  cart: CustomerCartItem[];
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (order: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CustomerCheckoutModal: React.FC<CustomerCheckoutModalProps> = ({
  cart,
  settings,
  isOpen,
  onClose,
  onOrderSuccess,
  showToast,
}) => {
  // Step: 'form' | 'confirm' | 'success'
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');

  // Customer info (persist initial defaults)
  const [customerName, setCustomerName] = useState(() => {
    return localStorage.getItem('wbk_customer_name') || '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    return localStorage.getItem('wbk_customer_phone') || '';
  });
  const [customerEmail, setCustomerEmail] = useState(() => {
    return localStorage.getItem('wbk_customer_email') || '';
  });

  // Service Type
  const [serviceType, setServiceType] = useState<'Takeaway' | 'Delivery'>('Takeaway');

  // Delivery details (for DQM area)
  const [deliveryLocation, setDeliveryLocation] = useState(DQM_LOCATIONS[0] || 'Komplek Utama DQM');
  const [deliveryAddressDetail, setDeliveryAddressDetail] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');

  // Created Order state upon success
  const [createdOrder, setCreatedOrder] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, it) => {
      const price = it.variant ? it.variant.price : it.product.harga_jual;
      return sum + price * it.qty;
    }, 0);
  }, [cart]);

  const minDelivery = settings.deliveryMinOrder || DELIVERY_MIN_ORDER_AMOUNT;
  const isDeliveryUnderMin = serviceType === 'Delivery' && subtotal < minDelivery;
  const deliveryFee = serviceType === 'Delivery' ? getEffectiveDeliveryFee(settings, 'DQM') : 0;
  const total = subtotal + deliveryFee;

  if (!isOpen) return null;

  // Validate form before proceeding to confirmation
  const handleProceedToConfirm = () => {
    if (!customerName.trim()) {
      showToast?.('Mohon isi nama lengkap Anda', 'error');
      return;
    }
    if (!customerPhone.trim() || customerPhone.length < 8) {
      showToast?.('Mohon isi nomor WhatsApp yang valid', 'error');
      return;
    }
    if (isDeliveryUnderMin) {
      showToast?.(`Belanja delivery minimal ${formatRupiah(minDelivery)}`, 'error');
      return;
    }

    // Save customer details locally for next visits
    localStorage.setItem('wbk_customer_name', customerName.trim());
    localStorage.setItem('wbk_customer_phone', customerPhone.trim());
    if (customerEmail.trim()) {
      localStorage.setItem('wbk_customer_email', customerEmail.trim());
    }

    setStep('confirm');
  };

  // Submit order to Firebase & local storage
  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const orderId = StorageService.generateInvoiceNumber('WBK');
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];

      const orderType: OrderType = serviceType === 'Delivery' ? 'DELIVERY_DQM' : 'BUNGKUS';

      const fullOrder: Transaction = {
        id_transaksi: orderId,
        tanggal: dateStr,
        jam: timeStr,
        kasir: 'Customer App Online',
        nama_pelanggan: customerName.trim(),
        no_whatsapp: customerPhone.trim(),
        email_pelanggan: customerEmail.trim() || undefined,
        subtotal,
        diskon: 0,
        biaya: deliveryFee,
        total,
        metode_pembayaran: paymentMethod,
        uang_diterima: paymentMethod === 'Cash' ? total : 0,
        kembalian: 0,
        status: 'MENUNGGU',
        orderType,
        tipe_pesanan: serviceType,
        created_at: now.toISOString(),
        items: cart.map((it, idx) => ({
          id_detail: `DET-${orderId}-${idx + 1}`,
          id_transaksi: orderId,
          id_produk: it.product.id,
          nama_produk: it.product.nama,
          productName: it.product.nama,
          variantId: it.variant?.variantId,
          variantName: it.variant?.variantName,
          harga: it.variant ? it.variant.price : it.product.harga_jual,
          qty: it.qty,
          subtotal: (it.variant ? it.variant.price : it.product.harga_jual) * it.qty,
          catatan: it.notes || undefined,
        })),
        ...(serviceType === 'Delivery'
          ? {
              deliveryArea: 'DQM',
              deliveryLocation,
              deliveryDetail: deliveryAddressDetail.trim() || undefined,
              deliveryNote: deliveryNote.trim() || undefined,
              deliveryFee,
              deliveryStatus: 'MENUNGGU',
              deliveryId: `DLV-${orderId}`,
              receiverName: customerName.trim(),
              receiverPhone: customerPhone.trim(),
              alamat_pengantaran: `Pesantren DQM - ${deliveryLocation} ${deliveryAddressDetail ? `(${deliveryAddressDetail})` : ''}`.trim(),
            }
          : {
              deliveryArea: null,
            }),
      };

      // 1. Save to Firestore
      await saveOrderToFirebase(fullOrder);

      // 2. Save locally and update customer & stock records
      StorageService.completeTransaction(fullOrder);

      setCreatedOrder(fullOrder);
      setStep('success');
      onOrderSuccess(fullOrder);
      showToast?.('Pesanan Anda berhasil dikirim ke kasir!', 'success');
    } catch (err: any) {
      console.error('Error submitting customer order:', err);
      showToast?.('Terjadi kesalahan koneksi saat mengirim pesanan. Silakan coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp Kasir click
  const handleOpenWhatsAppKasir = () => {
    const raw = settings.whatsappNumber || '6281234567890';
    const clean = sanitizeWhatsAppNumber(raw);
    const orderNo = createdOrder?.id_transaksi || '';
    const text = encodeURIComponent(
      `Halo WARUNG BANG KOBRA, saya sudah membuat pesanan dengan nomor *${orderNo}* (${customerName}). Mohon diproses ya, terima kasih!`
    );
    window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= STEP 1: FORM CHECKOUT ================= */}
        {step === 'form' && (
          <>
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-gray-900">
                  Checkout Pesanan
                </h2>
                <p className="text-xs text-gray-500">
                  Lengkapi data pemesanan Warung Bang Kobra
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {/* SECTION: DATA PELANGGAN */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-red-600" />
                  <h3 className="text-xs uppercase font-extrabold text-gray-700 tracking-wider">
                    Data Pelanggan
                  </h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nama Lengkap <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Contoh: Ahmad Fauzi"
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-gray-50/50 text-gray-800 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nomor WhatsApp <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-gray-50/50 text-gray-800 transition font-mono"
                    />
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      Kasir akan mengirimkan update pesanan ke nomor ini
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Email (Opsional)
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Contoh: fauzi@gmail.com (opsional)"
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-gray-50/50 text-gray-800 transition"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: METODE LAYANAN */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-4 h-4 text-red-600" />
                  <h3 className="text-xs uppercase font-extrabold text-gray-700 tracking-wider">
                    Metode Layanan
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Takeaway Card */}
                  <button
                    type="button"
                    onClick={() => setServiceType('Takeaway')}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      serviceType === 'Takeaway'
                        ? 'border-red-600 bg-red-50/70 text-red-900 shadow-sm ring-2 ring-red-500'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Store className={`w-6 h-6 ${serviceType === 'Takeaway' ? 'text-red-600' : 'text-gray-400'}`} />
                      {serviceType === 'Takeaway' && (
                        <CheckCircle2 className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="mt-2.5">
                      <span className="text-sm font-black block">📦 TAKEAWAY</span>
                      <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                        Ambil pesanan sendiri di warung
                      </span>
                    </div>
                  </button>

                  {/* Delivery Card */}
                  <button
                    type="button"
                    onClick={() => setServiceType('Delivery')}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      serviceType === 'Delivery'
                        ? 'border-red-600 bg-red-50/70 text-red-900 shadow-sm ring-2 ring-red-500'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Bike className={`w-6 h-6 ${serviceType === 'Delivery' ? 'text-red-600' : 'text-gray-400'}`} />
                      {serviceType === 'Delivery' && (
                        <CheckCircle2 className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="mt-2.5">
                      <span className="text-sm font-black block">🚚 DELIVERY</span>
                      <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                        Pesanan diantar kurir ke DQM
                      </span>
                    </div>
                  </button>
                </div>

                {/* Delivery Information Banner & Validation */}
                {serviceType === 'Delivery' && (
                  <div className="mt-3 space-y-3">
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                      <Bike className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          🚚 Area Pengantaran Khusus Pesantren DQM
                        </span>
                        <span className="text-amber-800 text-[11px] block mt-0.5">
                          Delivery sementara hanya tersedia untuk area sekitar Pesantren DQM dengan minimal belanja {formatRupiah(minDelivery)}.
                        </span>
                      </div>
                    </div>

                    {isDeliveryUnderMin && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">
                            Belanja delivery minimal {formatRupiah(minDelivery)}
                          </span>
                          <span className="text-rose-700 text-[11px] block mt-0.5">
                            Total belanja saat ini: {formatRupiah(subtotal)}. Kurang {formatRupiah(minDelivery - subtotal)} lagi.
                            Silakan tambah menu lain atau pilih Takeaway.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Delivery Form Fields */}
                    <div className="space-y-2.5 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Pilih Lokasi DQM <span className="text-red-600">*</span>
                        </label>
                        <select
                          value={deliveryLocation}
                          onChange={(e) => setDeliveryLocation(e.target.value)}
                          className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white text-gray-800"
                        >
                          {DQM_LOCATIONS.map((loc, i) => (
                            <option key={i} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Detail Gedung / Kamar / Ruangan
                        </label>
                        <input
                          type="text"
                          value={deliveryAddressDetail}
                          onChange={(e) => setDeliveryAddressDetail(e.target.value)}
                          placeholder="Contoh: Gedung B, Kamar 12 / Ruang Staf"
                          className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white text-gray-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Catatan / Patokan Pengantaran
                        </label>
                        <input
                          type="text"
                          value={deliveryNote}
                          onChange={(e) => setDeliveryNote(e.target.value)}
                          placeholder="Contoh: Titip di pos satpam / dekat tangga"
                          className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white text-gray-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: PEMBAYARAN */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-red-600" />
                  <h3 className="text-xs uppercase font-extrabold text-gray-700 tracking-wider">
                    Metode Pembayaran
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'Cash', label: '💵 CASH', desc: 'Bayar Tunai' },
                    { id: 'QRIS', label: '📱 QRIS', desc: 'Scan Semua Bank' },
                    { id: 'Transfer', label: '🏦 TRANSFER', desc: 'Rekening Toko' },
                    { id: 'E-wallet', label: '💳 E-WALLET', desc: 'DANA/OVO/GoPay' },
                  ].map((pay) => (
                    <button
                      key={pay.id}
                      type="button"
                      onClick={() => setPaymentMethod(pay.id as PaymentMethod)}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        paymentMethod === pay.id
                          ? 'border-red-600 bg-red-50/70 text-red-900 font-bold ring-2 ring-red-500 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xs font-black">{pay.label}</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">{pay.desc}</span>
                    </button>
                  ))}
                </div>

                {/* QRIS Display info */}
                {paymentMethod === 'QRIS' && (
                  <div className="mt-3 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-center">
                    <span className="text-xs font-bold text-gray-800 block mb-2">
                      Scan QRIS untuk Membayar
                    </span>
                    <div className="w-44 h-44 mx-auto bg-white p-2 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
                      {settings.qrisImageUrl ? (
                        <img
                          src={settings.qrisImageUrl}
                          alt="QRIS Warung Bang Kobra"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-center p-3 text-gray-400">
                          <QrCode className="w-16 h-16 mx-auto mb-1 text-gray-300" />
                          <span className="text-[10px] font-mono block">QRIS RESMI WARUNG</span>
                          <span className="text-[9px] text-gray-400">NMID: ID102030405060</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 mt-2 block">
                      Dapat di-scan dengan BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay.
                    </span>
                  </div>
                )}

                {/* Transfer Rekening Display info */}
                {paymentMethod === 'Transfer' && (
                  <div className="mt-3 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold">Informasi Rekening Toko:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const acc = settings.bankAccountNumber || '1234567890';
                          navigator.clipboard?.writeText(acc);
                          setCopiedBank(true);
                          setTimeout(() => setCopiedBank(false), 2000);
                        }}
                        className="text-[11px] font-bold text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        {copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedBank ? 'Tersalin' : 'Salin Rekening'}
                      </button>
                    </div>
                    <div className="space-y-0.5 bg-white p-2.5 rounded-xl border border-blue-100">
                      <div className="font-bold text-gray-900">
                        Bank: {settings.bankName || 'BCA'}
                      </div>
                      <div className="font-mono text-sm font-black text-blue-600">
                        {settings.bankAccountNumber || '1234-5678-90'}
                      </div>
                      <div className="text-gray-500 text-[11px]">
                        a.n. {settings.bankAccountHolder || 'WARUNG BANG KOBRA'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Cost Breakdown */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({cart.length} Menu)</span>
                  <span className="font-bold text-gray-900">{formatRupiah(subtotal)}</span>
                </div>
                {serviceType === 'Delivery' && (
                  <div className="flex justify-between text-gray-600">
                    <span>Biaya Delivery DQM</span>
                    <span className="font-bold text-gray-900">
                      {deliveryFee === 0 ? 'GRATIS' : formatRupiah(deliveryFee)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Diskon Promo</span>
                  <span className="font-bold text-emerald-600">Rp0</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                  <span className="font-black text-gray-900">TOTAL BAYAR</span>
                  <span className="font-black text-red-600 text-base">
                    {formatRupiah(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-white shadow-lg">
              <button
                type="button"
                onClick={handleProceedToConfirm}
                disabled={isDeliveryUnderMin}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-[0.98] text-white font-bold text-sm sm:text-base shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Lanjut Konfirmasi Pesanan</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {/* ================= STEP 2: CONFIRMATION MODAL ================= */}
        {step === 'confirm' && (
          <>
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg font-black text-gray-900">
                  Konfirmasi Pesanan
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                Apakah pesanan Anda sudah benar? Silakan periksa ringkasan sebelum dikirim ke kasir.
              </div>

              {/* Pemesan info */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-1.5">
                <div className="font-bold text-gray-900 flex justify-between">
                  <span>Nama Pelanggan:</span>
                  <span>{customerName}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>WhatsApp:</span>
                  <span className="font-mono">{customerPhone}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Layanan:</span>
                  <span className="font-bold text-red-600">
                    {serviceType === 'Delivery' ? '🚚 DELIVERY DQM' : '📦 TAKEAWAY'}
                  </span>
                </div>
                {serviceType === 'Delivery' && (
                  <div className="flex justify-between text-gray-600">
                    <span>Lokasi:</span>
                    <span className="font-medium text-right max-w-[200px]">
                      {deliveryLocation} {deliveryAddressDetail ? `(${deliveryAddressDetail})` : ''}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Pembayaran:</span>
                  <span className="font-bold text-gray-900">{paymentMethod}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <span className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider block mb-2">
                  Item yang Dipesan
                </span>
                <div className="divide-y divide-gray-200/60 text-xs">
                  {cart.map((it, idx) => {
                    const price = it.variant ? it.variant.price : it.product.harga_jual;
                    return (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-900">{it.product.nama}</span>
                          {it.variant && (
                            <span className="text-gray-500 ml-1">({it.variant.variantName})</span>
                          )}
                          <span className="block text-gray-400 text-[11px]">
                            {it.qty} x {formatRupiah(price)}
                          </span>
                        </div>
                        <span className="font-black text-gray-900">
                          {formatRupiah(price * it.qty)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 mt-2 border-t border-gray-200 flex items-center justify-between text-sm">
                  <span className="font-black text-gray-900">TOTAL</span>
                  <span className="font-black text-red-600 text-base">
                    {formatRupiah(total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 bg-white grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-800 font-bold text-xs sm:text-sm transition cursor-pointer"
              >
                ✏️ Edit Pesanan
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? 'Mengirim...' : '✅ Konfirmasi Pesanan'}
              </button>
            </div>
          </>
        )}

        {/* ================= STEP 3: SUCCESS SCREEN ================= */}
        {step === 'success' && createdOrder && (
          <div className="p-6 text-center space-y-5 overflow-y-auto flex-1 flex flex-col justify-center items-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>

            <div>
              <span className="text-2xl font-black text-gray-900 block">
                🎉 Pesanan Berhasil!
              </span>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Pesanan Anda telah diterima oleh sistem Warung Bang Kobra
              </p>
            </div>

            {/* Order Card */}
            <div className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 text-left space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Nomor Pesanan:</span>
                <span className="font-mono font-black text-red-600 text-sm">
                  {createdOrder.id_transaksi}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Status Awal:</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 uppercase">
                  MENUNGGU KONFIRMASI
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Layanan:</span>
                <span className="font-bold text-gray-900">
                  {createdOrder.tipe_pesanan}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-900">Total Pembayaran:</span>
                <span className="font-black text-red-600 text-sm">
                  {formatRupiah(createdOrder.total)}
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="w-full space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleOpenWhatsAppKasir}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                Chat Kasir via WhatsApp
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-800 font-bold text-xs sm:text-sm transition cursor-pointer"
              >
                Kembali ke Menu Utama
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
