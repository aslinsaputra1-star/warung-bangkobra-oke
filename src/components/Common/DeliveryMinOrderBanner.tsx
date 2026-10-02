import React from 'react';
import { AlertCircle, CheckCircle2, Bike, PlusCircle } from 'lucide-react';
import {
  DELIVERY_MIN_ORDER_AMOUNT,
  formatRupiah,
  getDeliveryMinOrderValidation,
} from '../../utils/formatters';

interface DeliveryMinOrderBannerProps {
  subtotal: number;
  variant?: 'page' | 'cart-bar' | 'checkout';
  onAddMoreItems?: () => void;
  deliveryFee?: number;
}

export const DeliveryMinOrderBanner: React.FC<DeliveryMinOrderBannerProps> = ({
  subtotal,
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
  } = getDeliveryMinOrderValidation(subtotal);

  // Compact Floating Cart Bar Variant
  if (variant === 'cart-bar') {
    return (
      <div
        className={`w-full rounded-2xl px-3.5 py-2.5 border transition-all duration-200 ${
          isMet
            ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100 shadow-lg shadow-emerald-950/50'
            : 'bg-red-950/95 border-red-500/70 text-red-100 shadow-lg shadow-red-950/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {isMet ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
            )}
            <span className="font-bold truncate">
              {isMet
                ? 'Minimal belanja terpenuhi. Silakan lanjutkan pesanan.'
                : `Minimal belanja Delivery ${formatRupiah(minAmount)} (Kurang ${formatRupiah(remainingAmount)})`}
            </span>
          </div>
          <span
            className={`font-mono font-extrabold text-[11px] shrink-0 tabular-nums ${
              isMet ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {formatRupiah(currentAmount)} / {formatRupiah(minAmount)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-1.5 w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isMet ? 'bg-emerald-400' : 'bg-red-500'
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
      className={`rounded-2xl p-3.5 sm:p-4 border-2 transition-all duration-200 ${
        isMet
          ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-100'
          : 'bg-red-950/45 border-red-500/70 text-red-100'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isMet
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}
          >
            {isMet ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs sm:text-sm font-extrabold ${
                  isMet ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {isMet
                  ? 'Minimal belanja terpenuhi. Silakan lanjutkan pesanan.'
                  : `Minimal Belanja Delivery ${formatRupiah(DELIVERY_MIN_ORDER_AMOUNT)} Belum Terpenuhi`}
              </span>
            </div>

            <p
              className={`text-[11px] sm:text-xs leading-relaxed ${
                isMet ? 'text-emerald-200/90' : 'text-red-200/90'
              }`}
            >
              {isMet ? (
                <>
                  Total belanja menu Anda{' '}
                  <strong className="font-mono font-bold text-emerald-300 tabular-nums">
                    {formatRupiah(currentAmount)}
                  </strong>{' '}
                  telah memenuhi syarat minimal Delivery{' '}
                  <strong className="font-mono font-bold text-emerald-300 tabular-nums">
                    ({formatRupiah(minAmount)})
                  </strong>
                  .{' '}
                  {deliveryFee > 0
                    ? `Biaya pengantaran: ${formatRupiah(deliveryFee)}.`
                    : 'Gratis biaya pengantaran area Pesantren DQM.'}
                </>
              ) : currentAmount > 0 ? (
                <>
                  Total belanja saat ini{' '}
                  <strong className="font-mono font-bold text-white tabular-nums">
                    {formatRupiah(currentAmount)}
                  </strong>
                  . Tambah{' '}
                  <strong className="font-mono font-extrabold text-red-300 underline tabular-nums">
                    {formatRupiah(remainingAmount)}
                  </strong>{' '}
                  lagi untuk mencapai minimal belanja Delivery{' '}
                  <strong className="font-mono font-bold text-white tabular-nums">
                    {formatRupiah(minAmount)}
                  </strong>
                  .
                </>
              ) : (
                <>
                  Layanan pesan antar (Delivery DQM) memerlukan minimal belanja{' '}
                  <strong className="font-mono font-bold text-white tabular-nums">
                    {formatRupiah(minAmount)}
                  </strong>
                  . Silakan pilih menu favorit Anda terlebih dahulu.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right Metric / CTA */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 shrink-0">
          <div className="text-left sm:text-right">
            <span className="text-[10px] text-stone-300 block">
              Target Minimal Delivery
            </span>
            <span
              className={`font-mono text-xs sm:text-sm font-black tabular-nums ${
                isMet ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {formatRupiah(currentAmount)} / {formatRupiah(minAmount)}
            </span>
          </div>

          {!isMet && onAddMoreItems && (
            <button
              type="button"
              onClick={onAddMoreItems}
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-sm whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tambah Menu</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 space-y-1">
        <div className="w-full h-2 rounded-full bg-stone-950/80 overflow-hidden border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isMet
                ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                : 'bg-gradient-to-r from-red-600 to-rose-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-medium">
          <span className="flex items-center gap-1 text-stone-300">
            <Bike className="w-3 h-3" />
            <span>Syarat Minimal Delivery: {formatRupiah(minAmount)}</span>
          </span>
          <span
            className={`font-mono font-bold tabular-nums ${
              isMet ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isMet ? '100% Terpenuhi ✓' : `${progressPercent}% (Kurang ${formatRupiah(remainingAmount)})`}
          </span>
        </div>
      </div>
    </div>
  );
};
