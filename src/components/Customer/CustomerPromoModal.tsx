import React, { useState } from 'react';
import { X, Sparkles, Copy, Check, Tag, Clock, ArrowRight, ShieldCheck, Flame } from 'lucide-react';
import { formatRupiah } from '../../utils/formatters';

export interface PromoItem {
  id: string;
  title: string;
  code: string;
  discountType: 'percentage' | 'fixed' | 'free_shipping';
  discountValue: number;
  minSpend: number;
  validUntil: string;
  description: string;
  terms: string[];
  badge: string;
  categoryTarget?: string;
  gradient: string;
}

export const PROMO_LIST: PromoItem[] = [
  {
    id: 'promo-1',
    title: 'Diskon 15% Menu Makanan Spesial',
    code: 'KOBRA15',
    discountType: 'percentage',
    discountValue: 15,
    minSpend: 25000,
    validUntil: '31 Des 2026',
    description: 'Nikmati potongan harga 15% untuk semua aneka olahan nasi, ayam, dan Indomie spesial.',
    terms: [
      'Minimal transaksi Rp25.000',
      'Berlaku untuk Dine-in, Takeaway, dan Delivery',
      'Dapat digunakan 1x per pesanan',
    ],
    badge: '🔥 PALING POPULER',
    categoryTarget: 'Makanan',
    gradient: 'from-[#E50914] via-[#A80710] to-[#151515]',
  },
  {
    id: 'promo-2',
    title: 'Gratis Ongkir Delivery Area DQM',
    code: 'FREEONGKIR',
    discountType: 'free_shipping',
    discountValue: 5000,
    minSpend: 20000,
    validUntil: '31 Des 2026',
    description: 'Bebas biaya antar langsung sampai asrama & kantor staf Pesantren DQM.',
    terms: [
      'Minimal transaksi Rp20.000',
      'Khusus pengantaran area Komplek Pesantren DQM',
      'Pengantaran hangat oleh kurir internal warung',
    ],
    badge: '🛵 GRATIS ONGKIR',
    categoryTarget: 'Semua',
    gradient: 'from-amber-600 via-orange-600 to-red-600',
  },
  {
    id: 'promo-3',
    title: 'Diskon Rp5.000 Minuman & Jus Segar',
    code: 'SEGAR5RB',
    discountType: 'fixed',
    discountValue: 5000,
    minSpend: 20000,
    validUntil: '31 Des 2026',
    description: 'Potongan Rp5.000 untuk pembelian aneka jus buah segar asli dan kopi mantap.',
    terms: [
      'Minimal pembelian aneka minuman Rp20.000',
      'Jus 100% buah asli tanpa pemanis buatan',
      'Berlaku setiap hari',
    ],
    badge: '🍹 SEGAR SETIAP HARI',
    categoryTarget: 'Minuman',
    gradient: 'from-emerald-600 via-teal-700 to-stone-900',
  },
  {
    id: 'promo-4',
    title: 'Paket Hemat Santri & Pelajar',
    code: 'PAKETHEMAT',
    discountType: 'fixed',
    discountValue: 7000,
    minSpend: 30000,
    validUntil: '31 Des 2026',
    description: 'Kombinasi makanan + es teh manis / kopi dengan harga spesial bersahabat di kantong.',
    terms: [
      'Minimal pembelian Rp30.000',
      'Hemat hingga Rp7.000 per transaksi',
      'Cocok untuk makan siang & makan malam',
    ],
    badge: '🎓 RAMAH KANTONG',
    categoryTarget: 'Paket',
    gradient: 'from-blue-600 via-indigo-700 to-stone-900',
  },
];

interface CustomerPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPromo?: (promo: PromoItem) => void;
  onNavigateToCategory?: (category: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CustomerPromoModal: React.FC<CustomerPromoModalProps> = ({
  isOpen,
  onClose,
  onApplyPromo,
  onNavigateToCategory,
  showToast,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast?.(`Kode voucher "${code}" berhasil disalin!`, 'success');
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  const handleUsePromo = (promo: PromoItem) => {
    handleCopy(promo.code);
    if (onApplyPromo) {
      onApplyPromo(promo);
    }
    if (promo.categoryTarget && onNavigateToCategory) {
      onNavigateToCategory(promo.categoryTarget);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#E50914]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                Promo Spesial Warung
              </h2>
              <p className="text-xs text-gray-500">
                Gunakan kode voucher untuk harga lebih bersahabat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {PROMO_LIST.map((promo) => {
            const isCopied = copiedCode === promo.code;
            return (
              <div
                key={promo.id}
                className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition bg-white"
              >
                {/* Banner Gradient Card */}
                <div className={`p-4 bg-gradient-to-r ${promo.gradient} text-white space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md">
                      {promo.badge}
                    </span>
                    <span className="text-[11px] font-medium text-white/90 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      s/d {promo.validUntil}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                    {promo.title}
                  </h3>
                  <p className="text-xs text-white/90 font-medium leading-relaxed">
                    {promo.description}
                  </p>
                </div>

                {/* Voucher Code & Action Footer */}
                <div className="p-3.5 sm:p-4 bg-gray-50/70 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Kode:</span>
                    <span className="font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-xl bg-white border border-gray-200 text-gray-900 tracking-wider shadow-2xs">
                      {promo.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(promo.code)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 transition cursor-pointer"
                      title="Salin Kode Voucher"
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUsePromo(promo)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#E50914] hover:bg-[#A80710] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 transition cursor-pointer"
                  >
                    <span>Gunakan Promo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Terms Collapsible / Bullet */}
                <div className="px-4 py-2.5 bg-white border-t border-gray-50 text-[11px] text-gray-500">
                  <span className="font-bold text-gray-700 block mb-1">Syarat & Ketentuan:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {promo.terms.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
