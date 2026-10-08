import React, { useEffect, useState } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  Bike,
  Store,
  Phone,
  MessageCircle,
  Copy,
  Check,
  ChevronRight,
  AlertCircle,
  MapPin,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Transaction, StoreSettings, OrderType } from '../../types';
import { formatRupiah, sanitizeWhatsAppNumber } from '../../utils/formatters';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface CustomerOrderTrackingModalProps {
  order: Transaction;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateOrder?: (updated: Transaction) => void;
}

export const CustomerOrderTrackingModal: React.FC<CustomerOrderTrackingModalProps> = ({
  order: initialOrder,
  settings,
  isOpen,
  onClose,
  onUpdateOrder,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Transaction>(initialOrder);
  const [copied, setCopied] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);

  useEffect(() => {
    setCurrentOrder(initialOrder);
  }, [initialOrder]);

  // Real-time Firestore snapshot listener on the order
  useEffect(() => {
    if (!isOpen || !currentOrder?.id_transaksi) return;

    try {
      const orderRef = doc(db, 'orders', currentOrder.id_transaksi);
      setIsLiveListening(true);
      const unsubscribe = onSnapshot(
        orderRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<Transaction>;
            setCurrentOrder((prev) => {
              const updated = { ...prev, ...data } as Transaction;
              if (onUpdateOrder && data.status !== prev.status) {
                onUpdateOrder(updated);
              }
              return updated;
            });
          }
        },
        (error) => {
          console.warn('Live order tracking listener error:', error);
          setIsLiveListening(false);
        }
      );

      return () => {
        unsubscribe();
        setIsLiveListening(false);
      };
    } catch (e) {
      console.warn('Failed to attach Firestore live tracking:', e);
    }
  }, [isOpen, currentOrder?.id_transaksi]);

  if (!isOpen || !currentOrder) return null;

  const isDelivery =
    currentOrder.orderType === 'DELIVERY_DQM' ||
    currentOrder.tipe_pesanan === 'DELIVERY_DQM' ||
    currentOrder.tipe_pesanan === 'Delivery' ||
    Boolean(currentOrder.deliveryArea);

  // Normalize order status to step index (0 to 4)
  const rawStatus = (currentOrder.status || 'MENUNGGU').toUpperCase();
  const delivStatus = (currentOrder.deliveryStatus || '').toUpperCase();

  // Timeline steps definition
  const takeawaySteps = [
    { title: 'Pesanan Diterima', desc: 'Menunggu konfirmasi kasir' },
    { title: 'Sedang Diproses', desc: 'Pesanan masuk antrian dapur' },
    { title: 'Sedang Disiapkan', desc: 'Makanan & minuman diracik' },
    { title: 'Siap Diambil', desc: 'Pesanan siap diambil di kasir' },
    { title: 'Selesai', desc: 'Pesanan telah diambil' },
  ];

  const deliverySteps = [
    { title: 'Pesanan Diterima', desc: 'Menunggu konfirmasi kasir' },
    { title: 'Sedang Diproses', desc: 'Pesanan masuk antrian dapur' },
    { title: 'Sedang Disiapkan', desc: 'Makanan dikemas rapi' },
    { title: 'Sedang Diantar', desc: 'Kurir menuju lokasi DQM' },
    { title: 'Selesai', desc: 'Pesanan telah diterima' },
  ];

  const steps = isDelivery ? deliverySteps : takeawaySteps;

  // Determine active step index
  let activeStep = 0;
  if (rawStatus === 'DIBATALKAN') {
    activeStep = -1;
  } else if (rawStatus === 'SELESAI' || delivStatus === 'SELESAI' || delivStatus === 'DITERIMA' || delivStatus === 'SAMPAI') {
    activeStep = 4;
  } else if (isDelivery) {
    if (delivStatus === 'DIANTAR') {
      activeStep = 3;
    } else if (rawStatus === 'SIAP' || delivStatus === 'SIAP DIANTAR') {
      activeStep = 2;
    } else if (rawStatus === 'DIPROSES' || rawStatus === 'PROSES') {
      activeStep = 1;
    } else {
      activeStep = 0;
    }
  } else {
    // Takeaway
    if (rawStatus === 'SIAP') {
      activeStep = 3;
    } else if (rawStatus === 'DIPROSES' || rawStatus === 'PROSES') {
      activeStep = 1;
    } else {
      activeStep = 0;
    }
  }

  // Copy Order ID
  const handleCopy = () => {
    navigator.clipboard?.writeText(currentOrder.id_transaksi);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // WhatsApp Kasir handler
  const handleChatKasir = () => {
    const rawPhone = settings.whatsappNumber || '6281234567890';
    const cleanPhone = sanitizeWhatsAppNumber(rawPhone);
    const text = encodeURIComponent(
      `Halo WARUNG BANG KOBRA, saya ingin bertanya tentang status pesanan saya: *${currentOrder.id_transaksi}* (${currentOrder.nama_pelanggan}).`
    );
    const url = `https://wa.me/${cleanPhone}?text=${text}`;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-red-600 to-rose-600 text-white relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-bold shadow-inner">
              {isDelivery ? <Bike className="w-6 h-6" /> : <Store className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  {isDelivery ? '🛵 Delivery DQM' : '📦 Takeaway'}
                </span>
                {isLiveListening && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full font-bold animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-950" />
                    Live Sync
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black mt-0.5">Status Pesanan</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Order ID & Badge Card */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wide">
                Nomor Pesanan
              </span>
              <div className="text-base font-black text-gray-900 font-mono flex items-center gap-2 mt-0.5">
                {currentOrder.id_transaksi}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-red-600 transition"
                  title="Salin No. Pesanan"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-gray-400 font-medium block">
                {currentOrder.tanggal} • {currentOrder.jam}
              </span>
              <span className="text-sm font-black text-red-600">
                {formatRupiah(currentOrder.total)}
              </span>
            </div>
          </div>

          {/* Cancelled Banner if cancelled */}
          {activeStep === -1 ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm">Pesanan Dibatalkan</h3>
                <p className="text-xs text-rose-700 mt-1">
                  Pesanan ini telah dibatalkan oleh kasir/pelanggan. Silakan hubungi kasir jika ada pertanyaan.
                </p>
              </div>
            </div>
          ) : (
            /* Modern Timeline Tracking */
            <div className="py-2 px-1">
              <h3 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-4">
                Proses Pesanan Real-time
              </h3>
              <div className="relative pl-7 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-3 before:w-0.5 before:bg-gray-200">
                {steps.map((step, idx) => {
                  const isDone = activeStep > idx;
                  const isCurrent = activeStep === idx;
                  const isPending = activeStep < idx;

                  return (
                    <div key={idx} className="relative">
                      {/* Step Circle Indicator */}
                      <div
                        className={`absolute -left-7 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                          isDone
                            ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                            : isCurrent
                            ? 'bg-red-600 text-white ring-4 ring-red-100 shadow-md shadow-red-500/30 animate-pulse'
                            : 'bg-white text-gray-400 border-2 border-gray-200'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      {/* Step Details */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4
                            className={`text-sm font-bold ${
                              isCurrent
                                ? 'text-red-600 font-extrabold'
                                : isDone
                                ? 'text-gray-900'
                                : 'text-gray-400'
                            }`}
                          >
                            {step.title}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                              Sedang Berjalan
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs mt-0.5 ${
                            isCurrent
                              ? 'text-gray-700 font-medium'
                              : isDone
                              ? 'text-gray-500'
                              : 'text-gray-400'
                          }`}
                        >
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delivery destination card if delivery */}
          {isDelivery && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-950">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold block text-sm text-amber-900">
                    Tujuan Pengantaran DQM
                  </span>
                  <div className="mt-1 font-semibold text-gray-800">
                    {currentOrder.receiverName || currentOrder.nama_pelanggan} ({currentOrder.receiverPhone || currentOrder.no_whatsapp})
                  </div>
                  <div className="text-gray-600 mt-0.5">
                    {currentOrder.deliveryLocation || currentOrder.alamat_pengantaran || 'Area Pesantren DQM'}
                  </div>
                  {currentOrder.deliveryNote && (
                    <div className="mt-1 text-[11px] text-amber-800 italic bg-amber-100/70 p-1.5 rounded-lg">
                      Patokan: {currentOrder.deliveryNote}
                    </div>
                  )}
                  {currentOrder.courierName && (
                    <div className="mt-2 text-xs font-bold text-teal-700">
                      🛵 Kurir Pengantar: {currentOrder.courierName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ordered Items summary */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <h4 className="text-xs uppercase font-extrabold text-gray-500 tracking-wider mb-2.5">
              Daftar Pesanan ({currentOrder.items?.length || 0} Item)
            </h4>
            <div className="divide-y divide-gray-200/60 text-xs">
              {(currentOrder.items || []).map((it, i) => (
                <div key={i} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <span className="font-bold text-gray-900">{it.nama_produk}</span>
                    {it.variantName && (
                      <span className="text-gray-500 ml-1">({it.variantName})</span>
                    )}
                    {it.catatan && (
                      <p className="text-[11px] text-gray-400 italic mt-0.5">
                        Catatan: {it.catatan}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-gray-900">
                      {it.qty}x {formatRupiah(it.harga)}
                    </span>
                    <span className="block text-gray-500 font-semibold">
                      {formatRupiah(it.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 mt-2 border-t border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Metode Pembayaran:</span>
              <span className="font-bold text-gray-900 uppercase">
                {currentOrder.metode_pembayaran}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-white grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleChatKasir}
            className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            Chat Kasir WA
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-3 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-800 font-bold text-xs sm:text-sm flex items-center justify-center transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
