import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Clock3,
  ChefHat,
  PackageCheck,
  Truck,
  AlertCircle,
  Copy,
  Check,
  MessageCircle,
  CreditCard,
  DollarSign,
  Receipt,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Transaction, StoreSettings, POStatus, POPaymentStatus } from '../../types';
import {
  formatRupiah,
  getPOStatusLabel,
  getPOStatusBadge,
  openWhatsAppChat,
  buildPOStatusNotificationWhatsAppMessage,
} from '../../utils/formatters';

interface CustomerPOTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  settings: StoreSettings;
  initialPONumber?: string;
  onPrintReceipt?: (tx: Transaction) => void;
}

export const CustomerPOTrackingModal: React.FC<CustomerPOTrackingModalProps> = ({
  isOpen,
  onClose,
  transactions,
  settings,
  initialPONumber = '',
  onPrintReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialPONumber);
  const [copied, setCopied] = useState(false);

  // Sync if initialPONumber changes
  React.useEffect(() => {
    if (initialPONumber) {
      setSearchQuery(initialPONumber);
    }
  }, [initialPONumber]);

  // Find all PO transactions
  const poTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => tx.orderType === 'PRE_ORDER' || Boolean(tx.poNumber)
    );
  }, [transactions]);

  // Find matching PO
  const matchedOrder = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return (
      poTransactions.find(
        (tx) =>
          (tx.poNumber && tx.poNumber.toLowerCase() === q) ||
          tx.id_transaksi.toLowerCase() === q ||
          (tx.no_whatsapp && tx.no_whatsapp.replace(/\D/g, '').includes(q.replace(/\D/g, '')) && q.length >= 8)
      ) || null
    );
  }, [poTransactions, searchQuery]);

  if (!isOpen) return null;

  const currentStatus = (matchedOrder?.poStatus || 'MENUNGGU_KONFIRMASI') as POStatus;
  const statusBadge = getPOStatusBadge(currentStatus);
  const statusLabel = getPOStatusLabel(currentStatus);

  // Step progression calculation
  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'upcoming' => {
    if (currentStatus === 'DIBATALKAN') return 'upcoming';

    const statusOrder: POStatus[] = [
      'MENUNGGU_KONFIRMASI',
      'DIKONFIRMASI',
      'MENUNGGU_DP',
      'DP_DITERIMA',
      'DIPROSES',
      'SIAP_DIAMBIL',
      'DALAM_PENGIRIMAN',
      'SELESAI',
    ];

    let currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex === -1) currentIndex = 0;

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const steps = [
    { title: 'Pengajuan Masuk', desc: 'Menunggu ditinjau kasir' },
    { title: 'Dikonfirmasi', desc: 'Jadwal & bahan disetujui' },
    { title: 'DP Diterima', desc: 'Uang muka terverifikasi' },
    { title: 'Sedang Dimasak', desc: 'Dapur memproses pesanan' },
    { title: matchedOrder?.deliveryType === 'DELIVERY_DQM' ? 'Pengiriman' : 'Siap Diambil', desc: matchedOrder?.deliveryType === 'DELIVERY_DQM' ? 'Kurir mengantar ke DQM' : 'Siap di warung' },
    { title: 'Selesai', desc: 'Pesanan telah diterima' },
  ];

  const handleCopyPONumber = () => {
    if (!matchedOrder) return;
    const poNum = matchedOrder.poNumber || matchedOrder.id_transaksi;
    navigator.clipboard.writeText(poNum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChatKasir = () => {
    if (!matchedOrder) return;
    const waKasir = settings.whatsappNumber;
    const poNum = matchedOrder.poNumber || matchedOrder.id_transaksi;
    const msg = `Halo Kasir ${settings.storeName}, saya ingin menanyakan status pesanan Pre-Order saya:\n• No. PO: *${poNum}*\n• Nama: *${matchedOrder.nama_pelanggan}*\n• Acara: *${matchedOrder.eventType || 'Acara'}* (${matchedOrder.eventDate} ${matchedOrder.eventTime})\n\nMohon informasinya ya. Terima kasih! 🙏`;
    openWhatsAppChat(waKasir, msg);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950/80 via-stone-900 to-amber-950/80 p-5 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-white tracking-wide">
                Lacak Status Pre-Order (PO)
              </h2>
              <p className="text-xs text-stone-400">
                Pantau proses persiapan pesanan acara & porsi besar Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-5 border-b border-stone-800/70 bg-stone-950/50">
          <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">
            Masukkan Nomor PO atau Nomor WhatsApp
          </label>
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-stone-500 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Contoh: PO-WBK-20261003-0001 atau 08123456789"
              className="w-full pl-11 pr-24 py-3 bg-stone-900 border border-stone-700 rounded-2xl text-white placeholder-stone-500 font-mono text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 px-2 py-1 text-xs text-stone-400 hover:text-stone-200"
              >
                Hapus
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-5">
          {!matchedOrder ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-stone-800/60 border border-stone-700 flex items-center justify-center mx-auto text-stone-500">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-stone-300 text-base">
                {searchQuery ? 'Pesanan Tidak Ditemukan' : 'Belum Ada Nomor PO yang Dicari'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {searchQuery
                  ? 'Pastikan Nomor PO atau Nomor WhatsApp yang Anda ketikkan sudah benar sesuai tanda terima.'
                  : 'Silakan ketik nomor Pre-Order Anda pada kolom di atas untuk melihat progres pengerjaan dapur.'}
              </p>
            </div>
          ) : (
            <>
              {/* Order Status Hero Card */}
              <div className="p-4 bg-stone-950 border border-stone-800 rounded-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                      Nomor Pre-Order
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-black text-base text-amber-400">
                        {matchedOrder.poNumber || matchedOrder.id_transaksi}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPONumber}
                        className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs transition cursor-pointer"
                        title="Salin Nomor PO"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span>{statusLabel}</span>
                  </div>
                </div>

                {/* Progress Steps Visualizer */}
                <div className="py-2">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {steps.map((st, idx) => {
                      const stepState = getStepStatus(idx);
                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-xl border text-center transition-all ${
                            stepState === 'completed'
                              ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400'
                              : stepState === 'current'
                              ? 'bg-red-950/50 border-red-500 text-red-300 ring-2 ring-red-500/20'
                              : 'bg-stone-900/40 border-stone-800 text-stone-500'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full mx-auto flex items-center justify-center text-xs font-black mb-1 bg-stone-800/80">
                            {stepState === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>
                          <p className="font-bold text-[10px] leading-tight line-clamp-1">
                            {st.title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Event Schedule Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 space-y-1">
                    <span className="text-[10px] text-stone-400 uppercase font-bold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      Jadwal Pesanan Siap
                    </span>
                    <p className="font-bold text-white text-sm">
                      {matchedOrder.eventDate || matchedOrder.tanggal}
                    </p>
                    <p className="text-amber-400 font-medium">
                      Pukul ⏰ {matchedOrder.eventTime || matchedOrder.jam} WIB
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 space-y-1">
                    <span className="text-[10px] text-stone-400 uppercase font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-teal-400" />
                      Metode & Lokasi
                    </span>
                    <p className="font-bold text-white">
                      {matchedOrder.deliveryType === 'DELIVERY_DQM' ? '🛵 Delivery Khusus DQM' : '🥡 Ambil di Warung'}
                    </p>
                    <p className="text-stone-300 text-[11px] truncate">
                      {matchedOrder.eventLocation || matchedOrder.alamat_pengantaran || 'Warung Bang Kobra'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="p-4 bg-stone-950 border border-stone-800 rounded-2xl space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-stone-300">
                  Rincian Menu Pre-Order
                </h4>
                <div className="divide-y divide-stone-800/80">
                  {matchedOrder.items.map((it, idx) => (
                    <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-stone-200">
                          {it.nama_produk}
                        </p>
                        <p className="text-stone-400 text-[11px]">
                          {it.qty} x {formatRupiah(it.harga)}
                        </p>
                        {it.catatan && (
                          <p className="text-[11px] text-amber-400/90 italic mt-0.5">
                            * {it.catatan}
                          </p>
                        )}
                      </div>
                      <span className="font-bold text-stone-200 font-mono">
                        {formatRupiah(it.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="pt-3 border-t border-stone-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-400">
                    <span>Subtotal Menu:</span>
                    <span>{formatRupiah(matchedOrder.subtotal)}</span>
                  </div>
                  {matchedOrder.biaya > 0 && (
                    <div className="flex justify-between text-stone-400">
                      <span>Biaya Pengantaran DQM:</span>
                      <span>{formatRupiah(matchedOrder.biaya)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-stone-800">
                    <span>TOTAL NILAI PO:</span>
                    <span className="text-amber-400">{formatRupiah(matchedOrder.total)}</span>
                  </div>
                  <div className="flex justify-between text-stone-300">
                    <span>Kewajiban Uang Muka (DP):</span>
                    <span>{formatRupiah(matchedOrder.dpRequired || 0)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>DP Terverifikasi:</span>
                    <span>{formatRupiah(matchedOrder.dpPaid || 0)}</span>
                  </div>
                  <div className="flex justify-between text-amber-400 font-black pt-1 border-t border-stone-800/80">
                    <span>Sisa Pembayaran:</span>
                    <span>{formatRupiah(matchedOrder.remainingPayment ?? (matchedOrder.total - (matchedOrder.dpPaid || 0)))}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleChatKasir}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/30 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Hubungi Kasir via WhatsApp</span>
                </button>

                {onPrintReceipt && (
                  <button
                    type="button"
                    onClick={() => onPrintReceipt(matchedOrder)}
                    className="py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Lihat & Cetak Struk PO</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
