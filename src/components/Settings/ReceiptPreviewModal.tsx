import React from 'react';
import { X, Printer, Receipt, QrCode } from 'lucide-react';
import { StoreSettings } from '../../types';
import { formatRupiah } from '../../utils/formatters';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  if (!isOpen) return null;

  const paperSize = settings.receiptPaperSize || '58mm';
  const widthClass =
    paperSize === '58mm'
      ? 'max-w-[320px]'
      : paperSize === '80mm'
      ? 'max-w-[420px]'
      : 'max-w-[580px]';

  const mockItems = [
    { name: 'Mi Rendang Kobra Spesial', qty: 2, price: 18000, subtotal: 36000 },
    { name: 'Es Teh Manis Dingin', qty: 2, price: 4000, subtotal: 8000 },
    { name: 'Dimsum Ayam (Isi 4)', qty: 1, price: 15000, subtotal: 15000 },
  ];
  const subtotal = 59000;
  const deliveryFee = settings.deliveryFeeAmount || 2000;
  const total = subtotal + deliveryFee;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-100 text-sm sm:text-base">
                Preview Struk Pembayaran
              </h3>
              <p className="text-[11px] text-stone-400 font-mono">
                Format: {paperSize.toUpperCase()} (Tampilan Kasir & Pelanggan)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Receipt Simulation */}
        <div className="flex-1 overflow-y-auto py-2 flex justify-center bg-stone-950/80 rounded-2xl p-4 border border-stone-850">
          <div
            className={`w-full ${widthClass} bg-white text-stone-950 font-mono text-[11px] p-4 sm:p-5 rounded-md shadow-2xl space-y-3 leading-relaxed transition-all`}
          >
            {/* Store Header */}
            <div className="text-center space-y-1 pb-2 border-b border-dashed border-stone-400">
              {settings.receiptShowLogo !== false && settings.logoUrl && (
                <div className="flex justify-center mb-1">
                  <img
                    src={settings.receiptLogoUrl || settings.logoUrl}
                    alt="Logo"
                    className="w-12 h-12 object-contain rounded"
                  />
                </div>
              )}
              {settings.receiptShowStoreName !== false && (
                <h4 className="font-black text-sm uppercase tracking-wider">
                  {settings.storeName || 'WARUNG BANG KOBRA'}
                </h4>
              )}
              {settings.receiptShowAddress !== false && (
                <p className="text-[10px] text-stone-700">
                  {settings.address || settings.storeAddress || 'Jl. Raya Kuliner No. 88'}
                </p>
              )}
              {settings.receiptShowWhatsApp !== false && settings.whatsappNumber && (
                <p className="text-[10px] text-stone-700">
                  WA: {settings.whatsappNumber}
                </p>
              )}
              {settings.receiptShowEmail !== false && settings.storeEmail && (
                <p className="text-[10px] text-stone-700">
                  Email: {settings.storeEmail}
                </p>
              )}
            </div>

            {/* Meta Info */}
            <div className="text-[10px] space-y-0.5 border-b border-dashed border-stone-400 pb-2">
              <div className="flex justify-between">
                <span>No. Transaksi</span>
                <span className="font-bold">WBK-20261005-0042</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu</span>
                <span>{new Date().toLocaleDateString('id-ID')} 12:45</span>
              </div>
              {settings.receiptShowCashier !== false && (
                <div className="flex justify-between">
                  <span>Kasir</span>
                  <span>{settings.activeCashier || 'Budi Kasir'}</span>
                </div>
              )}
              {settings.receiptShowCustomer !== false && (
                <div className="flex justify-between">
                  <span>Pelanggan</span>
                  <span>Ahmad (0812****88)</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Layanan</span>
                <span className="font-bold">[BUNGKUS / TAKEAWAY]</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-1.5 border-b border-dashed border-stone-400 pb-2 text-[10px]">
              {mockItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold truncate">{item.name}</div>
                    <div className="text-stone-600">
                      {item.qty} × {formatRupiah(item.price)}
                    </div>
                  </div>
                  <div className="font-bold shrink-0">{formatRupiah(item.subtotal)}</div>
                </div>
              ))}
            </div>

            {/* Calculation Totals */}
            <div className="space-y-1 text-[11px] pt-1 border-b border-dashed border-stone-400 pb-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Biaya Layanan</span>
                <span>{formatRupiah(deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-xs font-black pt-1 border-t border-stone-300">
                <span>TOTAL BAYAR</span>
                <span>{formatRupiah(total)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-stone-600 pt-0.5">
                <span>Metode Pembayaran</span>
                <span className="font-bold uppercase">QRIS / TUNAI</span>
              </div>
            </div>

            {/* Optional QRIS / QR Verification Code */}
            {settings.receiptShowQris !== false && settings.qrisImageUrl && (
              <div className="text-center pt-2 space-y-1 border-b border-dashed border-stone-400 pb-3">
                <p className="text-[9px] font-bold uppercase text-stone-700">
                  Scan QRIS untuk Pembayaran
                </p>
                <div className="flex justify-center">
                  <img
                    src={settings.qrisImageUrl}
                    alt="QRIS Struk"
                    className="w-24 h-24 object-contain border border-stone-300 rounded"
                  />
                </div>
              </div>
            )}

            {/* Footer Notice */}
            <div className="text-center text-[9px] text-stone-600 pt-1 space-y-0.5">
              <p className="font-bold">
                {settings.receiptFooter || 'Terima kasih atas kunjungan Anda 🙏'}
              </p>
              <p className="text-[8px] text-stone-500">
                Simpan struk ini sebagai bukti pembayaran sah.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-black shadow-lg shadow-red-950/40 flex items-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Sampel Struk</span>
          </button>
        </div>
      </div>
    </div>
  );
};
