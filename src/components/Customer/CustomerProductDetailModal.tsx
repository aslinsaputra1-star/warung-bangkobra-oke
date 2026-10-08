import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, ShoppingBag, Sparkles, AlertCircle, Zap } from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { formatRupiah } from '../../utils/formatters';

interface CustomerProductDetailModalProps {
  product: Product | null;
  variants?: ProductVariant[];
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, variant: ProductVariant | undefined, qty: number, notes: string) => void;
  onDirectOrder?: (product: Product, variant: ProductVariant | undefined, qty: number, notes: string) => void;
}

export const CustomerProductDetailModal: React.FC<CustomerProductDetailModalProps> = ({
  product,
  variants = [],
  isOpen,
  onClose,
  onAddToCart,
  onDirectOrder,
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  // Find variants related to this product
  const productVariants = useMemo(() => {
    if (!product) return [];
    const directVariants = variants.filter(
      (v) => (v.productId === product.id || v.productId === product.sku) && v.isActive !== false
    );
    if (directVariants.length > 0) return directVariants;

    // Check if Indomie or special flavor product
    const lowerName = product.nama.toLowerCase();
    if (lowerName.includes('indomie') || lowerName.includes('mie')) {
      const indVariants = variants.filter((v) =>
        v.productName?.toLowerCase().includes('indomie') || v.variantName.toLowerCase().includes('indomie')
      );
      if (indVariants.length > 0) return indVariants;
    }

    return [];
  }, [product, variants]);

  // Reset or select default variant on open
  React.useEffect(() => {
    if (product) {
      setQty(1);
      setNotes('');
      if (productVariants.length > 0) {
        setSelectedVariantId(productVariants[0].variantId);
      } else {
        setSelectedVariantId('');
      }
    }
  }, [product, productVariants]);

  if (!isOpen || !product) return null;

  const selectedVariant = productVariants.find((v) => v.variantId === selectedVariantId);
  const currentPrice = selectedVariant ? selectedVariant.price : product.harga_jual;
  const isOutOfStock = (selectedVariant ? selectedVariant.stock : product.stok) <= 0;
  const totalPrice = currentPrice * qty;

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(product, selectedVariant, qty, notes.trim());
    onClose();
  };

  const handleDirectOrder = () => {
    if (isOutOfStock) return;
    if (onDirectOrder) {
      onDirectOrder(product, selectedVariant, qty, notes.trim());
    } else {
      onAddToCart(product, selectedVariant, qty, notes.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Close button */}
        <div className="relative">
          <div className="w-full h-56 sm:h-64 bg-gray-100 overflow-hidden relative">
            <img
              src={product.foto || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&auto=format&fit=crop&q=80'}
              alt={product.nama}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&auto=format&fit=crop&q=80';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

            {/* Top Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition shadow-md cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Badges on image */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-red-600/90 backdrop-blur-md shadow">
                {product.kategori}
              </span>
              {isOutOfStock ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-stone-900 text-rose-400 border border-rose-500/40">
                  ❌ STOK HABIS
                </span>
              ) : (
                <span className="text-xs font-medium text-white/90 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
                  Stok: {selectedVariant ? selectedVariant.stock : product.stok}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Title & Price */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                {product.nama}
              </h2>
              <div className="text-right shrink-0">
                <span className="text-xl sm:text-2xl font-black text-red-600">
                  {formatRupiah(currentPrice)}
                </span>
              </div>
            </div>
            {product.deskripsi && (
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {product.deskripsi}
              </p>
            )}
          </div>

          {/* Variants Selection (if available) */}
          {productVariants.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  Pilih Varian / Rasa:
                </label>
                <span className="text-xs text-red-600 font-semibold">Wajib</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {productVariants.map((v) => {
                  const isSelected = selectedVariantId === v.variantId;
                  const isVarOut = v.stock <= 0;
                  return (
                    <button
                      key={v.variantId}
                      type="button"
                      disabled={isVarOut}
                      onClick={() => setSelectedVariantId(v.variantId)}
                      className={`p-3 rounded-2xl text-left border text-xs sm:text-sm font-medium transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-red-600 bg-red-50/80 text-red-700 font-bold shadow-sm ring-1 ring-red-600'
                          : isVarOut
                          ? 'border-gray-200 bg-gray-100/60 text-gray-400 cursor-not-allowed opacity-60'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="line-clamp-1">{v.variantName}</span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-bold">{formatRupiah(v.price)}</span>
                        {isVarOut && <span className="text-[10px] text-red-500 font-bold">Habis</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Notes for Seller */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-sm font-bold text-gray-800 mb-1.5">
              Catatan untuk Penjual (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: pedas sedang, es sedikit, sambal dipisah, dll."
              rows={2}
              maxLength={200}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-gray-50/50 text-gray-800 resize-none transition"
            />
            <div className="text-right text-[11px] text-gray-400 mt-1">
              {notes.length}/200
            </div>
          </div>

          {/* Quantity Stepper */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-800">Jumlah Pesanan</span>
            <div className="flex items-center gap-3 bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/60">
              <button
                type="button"
                onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                disabled={qty <= 1 || isOutOfStock}
                className="w-8 h-8 rounded-xl bg-white text-gray-800 flex items-center justify-center font-bold shadow-sm hover:bg-gray-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-base font-black text-gray-900 w-6 text-center select-none">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((prev) => prev + 1)}
                disabled={isOutOfStock}
                className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-sm hover:bg-red-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Sticky Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white shadow-lg">
          {isOutOfStock ? (
            <button
              disabled
              className="w-full py-3.5 rounded-2xl bg-gray-200 text-gray-500 font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <AlertCircle className="w-5 h-5 text-gray-400" />
              Stok Produk Sedang Habis
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleAdd}
                className="py-3.5 px-3 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer border border-gray-200"
              >
                <ShoppingBag className="w-4 h-4 text-red-600" />
                <span>+ Keranjang</span>
              </button>
              <button
                type="button"
                onClick={handleDirectOrder}
                className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-between shadow-lg shadow-red-600/30 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 fill-white" />
                  Pesan Sekarang
                </span>
                <span className="text-[11px] sm:text-xs font-black bg-white/20 px-2 py-0.5 rounded-lg">
                  {formatRupiah(totalPrice)}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
