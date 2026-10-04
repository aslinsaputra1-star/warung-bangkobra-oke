import React, { useState } from 'react';
import {
  Printer,
  Share2,
  Download,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { Transaction, StoreSettings } from '../../types';
import { BrandLogo } from '../Common/BrandLogo';
import {
  formatRupiah,
  buildCashierReceiptWhatsAppMessage,
  openWhatsAppChat,
  getTakeawayQueueNumber,
  resolveOrderType,
  buildDigitalReceiptUrl,
  getPOStatusLabel,
} from '../../utils/formatters';

interface ReceiptModalProps {
  transaction: Transaction | null;
  settings: StoreSettings;
  onClose: () => void;
  onNewTransaction: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  settings,
  onNewTransaction,
}) => {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const text = buildCashierReceiptWhatsAppMessage(transaction, settings.storeName);
    const targetPhone = transaction.no_whatsapp && transaction.no_whatsapp !== '-' ? transaction.no_whatsapp : '';
    openWhatsAppChat(targetPhone, text);
  };

  return (
    <div
      id="modal-receipt-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Notification */}
        <div className="bg-emerald-950/60 border-b border-emerald-800/40 p-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-lg text-white">Transaksi Berhasil!</h3>
          <p className="text-xs text-emerald-300 font-mono mt-0.5">{transaction.id_transaksi}</p>
        </div>

        {/* Printable Thermal Receipt Card */}
        <div className="p-5 max-h-[55vh] overflow-y-auto">
          <div
            id="receipt-print-area"
            className="bg-stone-950 border border-stone-800 rounded-2xl p-5 font-mono text-xs text-stone-200 shadow-inner"
          >
            {/* Store Info */}
            <div className="text-center pb-3 border-b border-dashed border-stone-700">
              <div className="mb-2 flex justify-center">
                <BrandLogo
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  size="md"
                  rounded="rounded-lg"
                  grayscale={true}
                  className="w-12 h-12"
                />
              </div>
              <div className="font-extrabold text-sm tracking-wider text-amber-400">
                {settings.storeName.toUpperCase()}
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">{settings.address || settings.storeAddress}</div>
              <div className="text-[11px] text-stone-400">WA: {settings.whatsappNumber}</div>
            </div>

            {/* Transaction Meta */}
            <div className="py-2.5 border-b border-dashed border-stone-700 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-stone-400">No Transaksi:</span>
                <span className="font-bold text-stone-100">{transaction.poNumber || transaction.id_transaksi}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Jenis Pesanan:</span>
                <span className="font-black text-amber-400">
                  {transaction.orderType === 'PRE_ORDER' || Boolean(transaction.poNumber)
                    ? '[PRE-ORDER ACARA]'
                    : resolveOrderType(transaction) === 'DELIVERY_DQM'
                    ? '[DELIVERY DQM]'
                    : '[BUNGKUS]'}
                </span>
              </div>
              {transaction.orderType === 'PRE_ORDER' || Boolean(transaction.poNumber) ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Jadwal Siap:</span>
                    <span className="font-bold text-amber-300">
                      {transaction.eventDate || transaction.tanggal} {transaction.eventTime || transaction.jam} WIB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Acara:</span>
                    <span className="text-stone-200">
                      {transaction.eventType || 'Acara'} {transaction.guestCount ? `(±${transaction.guestCount} Tamu)` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Layanan:</span>
                    <span className="text-stone-200">
                      {transaction.deliveryType === 'DELIVERY_DQM' ? 'Delivery DQM' : 'Ambil di Warung'}
                    </span>
                  </div>
                  {transaction.deliveryType === 'DELIVERY_DQM' && transaction.eventLocation && (
                    <div className="pt-0.5 text-[10px] text-teal-300">
                      Lokasi: {transaction.eventLocation}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-stone-400">Tanggal:</span>
                  <span>{transaction.tanggal} {transaction.jam}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-400">Kasir:</span>
                <span>{transaction.kasir}</span>
              </div>
              {transaction.nama_pelanggan && (
                <div className="flex justify-between">
                  <span className="text-stone-400">Pemesan:</span>
                  <span>{transaction.nama_pelanggan} ({transaction.no_whatsapp})</span>
                </div>
              )}
              {resolveOrderType(transaction) === 'DELIVERY_DQM' && !transaction.poNumber && (
                <div className="pt-1 text-[10px] text-teal-300">
                  Lokasi: Pesantren DQM • {transaction.deliveryLocation || ''}{' '}
                  {transaction.deliveryDetail ? `(${transaction.deliveryDetail})` : ''}
                </div>
              )}
            </div>

            {/* Queue / PO Highlight on Receipt */}
            <div className="py-2.5 my-1.5 px-3 bg-stone-900 border border-amber-500/40 rounded-xl text-center space-y-0.5">
              <span className="text-[10px] text-amber-400 uppercase tracking-widest font-sans font-bold block">
                {transaction.orderType === 'PRE_ORDER' || Boolean(transaction.poNumber)
                  ? 'STATUS PRE-ORDER (PO)'
                  : `NOMOR ANTRIAN ${resolveOrderType(transaction) === 'DELIVERY_DQM' ? 'DELIVERY DQM' : 'BUNGKUS'}`}
              </span>
              <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-wider">
                {transaction.orderType === 'PRE_ORDER' || Boolean(transaction.poNumber)
                  ? getPOStatusLabel(transaction.poStatus || transaction.status)
                  : getTakeawayQueueNumber(transaction)}
              </span>
              <span className="text-[9px] text-stone-400 font-sans block">
                {transaction.orderType === 'PRE_ORDER' || Boolean(transaction.poNumber)
                  ? `Nomor PO: ${transaction.poNumber || transaction.id_transaksi}`
                  : resolveOrderType(transaction) === 'DELIVERY_DQM'
                  ? 'Pesanan diantar khusus area Pesantren DQM'
                  : 'Pesanan akan disiapkan untuk diambil'}
              </span>
            </div>

            {/* Items List */}
            <div className="py-3 border-b border-dashed border-stone-700 space-y-2">
              <div className="text-stone-400 font-bold uppercase text-[10px] tracking-wider mb-1">
                Pesanan:
              </div>
              {transaction.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-stone-100 pr-2">
                      {item.nama_produk}
                    </span>
                    <span className="font-bold text-stone-100 shrink-0">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-stone-400">
                    <span>{item.qty} x {formatRupiah(item.harga)}</span>
                  </div>
                  {item.catatan && (
                    <div className="text-[10px] text-amber-400 italic">
                      * {item.catatan}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-stone-700">
              <div className="flex justify-between text-stone-300">
                <span>Subtotal:</span>
                <span>{formatRupiah(transaction.subtotal)}</span>
              </div>
              {transaction.diskon > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Diskon:</span>
                  <span>-{formatRupiah(transaction.diskon)}</span>
                </div>
              )}
              {transaction.biaya > 0 && (
                <div className="flex justify-between text-stone-300">
                  <span>Biaya Tambahan:</span>
                  <span>+{formatRupiah(transaction.biaya)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-amber-400 pt-1 border-t border-stone-800">
                <span>TOTAL:</span>
                <span>{formatRupiah(transaction.total)}</span>
              </div>
              {Boolean(transaction.orderType === 'PRE_ORDER' || transaction.poNumber) && (
                <>
                  <div className="flex justify-between text-stone-300 pt-1 border-t border-stone-800/80">
                    <span>Kewajiban DP:</span>
                    <span>{formatRupiah(transaction.dpRequired || 0)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>DP Diterima:</span>
                    <span>{formatRupiah(transaction.dpPaid || 0)}</span>
                  </div>
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Sisa Pembayaran:</span>
                    <span>
                      {(transaction.remainingPayment ?? (transaction.total - (transaction.dpPaid || 0))) <= 0
                        ? 'LUNAS (Rp 0)'
                        : formatRupiah(transaction.remainingPayment ?? (transaction.total - (transaction.dpPaid || 0)))}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Payment & Change */}
            <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-stone-700">
              <div className="flex justify-between text-stone-300">
                <span>Metode:</span>
                <span className="font-bold uppercase text-amber-400">
                  {transaction.metode_pembayaran}
                </span>
              </div>
              {Boolean(transaction.orderType === 'PRE_ORDER' || transaction.poNumber) && (
                <div className="flex justify-between text-stone-300">
                  <span>Status Bayar:</span>
                  <span className="font-bold text-amber-400">
                    {transaction.paymentStatus || 'BELUM_BAYAR'}
                  </span>
                </div>
              )}
              {transaction.metode_pembayaran === 'Cash' && (
                <>
                  <div className="flex justify-between text-stone-300">
                    <span>Bayar:</span>
                    <span>{formatRupiah(transaction.uang_diterima)}</span>
                  </div>
                  <div className="flex justify-between text-stone-100 font-bold">
                    <span>Kembali:</span>
                    <span className="text-emerald-400">{formatRupiah(transaction.kembalian)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-3 text-[10px] text-stone-400 space-y-0.5">
              <p className="font-semibold text-stone-300">{settings.receiptFooter}</p>
              <p className="text-stone-400">Simpan struk ini sebagai bukti pembayaran yang sah.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-stone-950/60 border-t border-stone-800 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-whatsapp-receipt"
              onClick={handleSendWhatsApp}
              className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-lg shadow-emerald-900/30 active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>KIRIM WA</span>
            </button>

            <button
              id="btn-print-receipt"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs transition shadow-lg shadow-amber-900/30 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>CETAK STRUK</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => {
                const url = buildDigitalReceiptUrl(transaction.id_transaksi);
                navigator.clipboard.writeText(`${buildCashierReceiptWhatsAppMessage(transaction, settings.storeName)}\n\nStruk Digital:\n${url}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-xs border transition cursor-pointer ${
                copied
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Teks & Link'}</span>
            </button>
            <button
              id="btn-receipt-new-tx"
              onClick={onNewTransaction}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-white font-bold text-xs transition cursor-pointer"
            >
              <span>+ Transaksi Baru</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
