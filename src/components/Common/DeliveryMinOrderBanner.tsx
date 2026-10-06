import React from 'react';
import { AlertCircle, CheckCircle2, Bike, PlusCircle } from 'lucide-react';
import {
  DELIVERY_MIN_ORDER_AMOUNT,
  formatRupiah,
  getDeliveryMinOrderValidation,
} from '../../utils/formatters';

interface DeliveryMinOrderBannerProps {
  subtotal: number;
  minAmount?: number;
  areaName?: string;
  variant?: 'page' | 'cart-bar' | 'checkout';
  onAddMoreItems?: () => void;
  deliveryFee?: number;
}

export const DeliveryMinOrderBanner: React.FC<DeliveryMinOrderBannerProps> = ({
  subtotal,
  minAmount: customMinAmount,
  areaName = 'DQM',
  variant = 'page',
  onAddMoreItems,
  deliveryFee = 0,
}) => {
  const {
    isMet,
    minAmount,
    currentAmount,
    remainingAmount,
    progressPercent,
  } = getDeliveryMinOrderValidation(subtotal, customMinAmount);

  // Compact Floating Cart Bar Variant
  if (variant === 'cart-bar') {
    return (
      <div
        className={`w-full rounded-2xl px-4 py-2.5 border backdrop-blur-xl transition-all duration-200 ${
          isMet
            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-lg shadow-black/40'
            : 'bg-stone-900/95 border-amber-500/40 text-stone-100 shadow-lg shadow-black/40'
        }`}
      >
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {isMet ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="font-semibold truncate">
              {isMet
                ? 'Minimal belanja Delivery terpenuhi'
                : `Tambah ${formatRupiah(remainingAmount)} lagi untuk Delivery DQM`}
            </span>
          </div>
          <span
            className={`font-mono font-bold text-[11px] shrink-0 tabular-nums ${
              isMet ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {formatRupiah(currentAmount)} / {formatRupiah(minAmount)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 w-full h-1.5 rounded-full bg-stone-950/80 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isMet ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // Full Page / Checkout Banner Variant
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl p-4 border transition-all duration-200 ${
        isMet
          ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-100'
          : 'bg-stone-950/90 border-amber-500/30 text-stone-100'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
              isMet
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            {isMet ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Bike className="w-4 h-4" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs sm:text-sm font-bold ${
                  isMet ? 'text-emerald-300' : 'text-stone-100'
                }`}
              >
                {isMet
                  ? 'Syarat Minimal Belanja Delivery DQM Terpenuhi'
                  : `Minimal Belanja Delivery DQM ${formatRupiah(DELIVERY_MIN_ORDER_AMOUNT)}`}
              </span>
            </div>

            <p className="text-xs leading-relaxed text-stone-300">
              {isMet ? (
                <>
                  Total pesanan{' '}
                  <strong className="font-mono font-semibold text-emerald-300 tabular-nums">
                    {formatRupiah(currentAmount)}
                  </strong>{' '}
                  siap diantar ke area Pesantren DQM.{' '}
                  {deliveryFee > 0
                    ? `Biaya pengantaran: ${formatRupiah(deliveryFee)}.`
                    : 'Gratis biaya pengantaran area Pesantren DQM.'}
                </>
              ) : currentAmount > 0 ? (
                <>
                  Keranjang saat ini{' '}
                  <strong className="font-mono font-semibold text-stone-100 tabular-nums">
                    {formatRupiah(currentAmount)}
                  </strong>
                  . Tambah{' '}
                  <strong className="font-mono font-bold text-amber-400 tabular-nums">
                    {formatRupiah(remainingAmount)}
                  </strong>{' '}
                  lagi untuk mengaktifkan pengantaran ke Pesantren DQM.
                </>
              ) : (
                <>
                  Pengantaran ke Asrama / Gedung Pesantren DQM berlaku dengan minimal pesanan{' '}
                  <strong className="font-mono font-semibold text-amber-400 tabular-nums">
                    {formatRupiah(minAmount)}
                  </strong>
                  .
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right Metric / CTA */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-white/[0.07] shrink-0">
          <div className="text-left sm:text-right">
            <span className="text-[11px] text-stone-400 block">
              Progres Minimal Order
            </span>
            <span
              className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${
                isMet ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {formatRupiah(currentAmount)} / {formatRupiah(minAmount)}
            </span>
          </div>

          {!isMet && onAddMoreItems && (
            <button
              type="button"
              onClick={onAddMoreItems}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambah Menu</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 space-y-1.5">
        <div className="w-full h-1.5 rounded-full bg-stone-900 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isMet
                ? 'bg-emerald-400'
                : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-stone-400">
          <span>Area Layanan: Pesantren Darul Quran Mulia (DQM)</span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              isMet ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {isMet ? '100% Terpenuhi' : `${progressPercent}%`}
          </span>
        </div>
      </div>
    </div>
  );
};
