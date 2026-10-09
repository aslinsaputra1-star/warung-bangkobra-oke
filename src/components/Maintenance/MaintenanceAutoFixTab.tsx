import React, { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  HelpCircle,
  X,
  Play,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';
import { AutoFixAction, AutoFixActionType } from '../../types/maintenance';
import { Product, ProductVariant, CategoryItem, Transaction, StoreSettings } from '../../types';

interface MaintenanceAutoFixTabProps {
  products: Product[];
  categories: CategoryItem[];
  transactions: Transaction[];
  variants: ProductVariant[];
  settings: StoreSettings;
  onExecuteAutoFix: (actionType: AutoFixActionType) => Promise<boolean>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const MaintenanceAutoFixTab: React.FC<MaintenanceAutoFixTabProps> = ({
  products,
  categories,
  transactions,
  variants,
  settings: _settings,
  onExecuteAutoFix,
  showToast,
}) => {
  const [activeModalAction, setActiveModalAction] = useState<AutoFixAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Compute live counts for each repairable issue
  const categoryNames = new Set(categories.map((c) => c.nama.toLowerCase().trim()));
  const missingCategoryCount = products.filter(
    (p) => !p.kategori || !categoryNames.has(p.kategori.toLowerCase().trim())
  ).length;

  const invalidPriceCount = products.filter(
    (p) => !p.harga_jual || isNaN(p.harga_jual) || p.harga_jual <= 0
  ).length;

  const negativeStockCount = products.filter((p) => p.stok < 0).length;

  const seenIds = new Set<string>();
  let duplicateTxCount = 0;
  transactions.forEach((tx) => {
    const id = tx.id_transaksi || (tx as any).id;
    if (id) {
      if (seenIds.has(id)) duplicateTxCount++;
      else seenIds.add(id);
    }
  });

  let driftTxCount = 0;
  transactions.forEach((tx) => {
    if (tx.items && tx.items.length > 0) {
      const calcSub = tx.items.reduce((s, it) => s + (it.qty * it.harga || it.subtotal || 0), 0);
      const expTotal = Math.max(0, calcSub - (tx.diskon || 0) + (tx.deliveryFee || tx.biaya || 0));
      if (Math.abs(expTotal - tx.total) > 5) driftTxCount++;
    }
  });

  const productIds = new Set(products.map((p) => p.id));
  const orphanVariantsCount = variants.filter((v) => !productIds.has(v.productId)).length;

  const autoFixCatalog: AutoFixAction[] = [
    {
      id: 'fix-cat',
      type: 'FIX_PRODUCT_CATEGORIES',
      title: 'Tetapkan Kategori Standar Produk',
      description: 'Menetapkan kategori aktif pada menu yang belum memiliki kategori terdaftar.',
      impactDescription: `Akan memperbarui ${missingCategoryCount} produk dengan kategori "${categories[0]?.nama || 'Makanan'}". Tidak mengubah harga atau stok.`,
      requiresConfirmation: true,
      affectedCount: missingCategoryCount,
    },
    {
      id: 'fix-price',
      type: 'FIX_INVALID_PRICES',
      title: 'Normalisasi Harga Produk Rp0 / Kosong',
      description: 'Memperbaiki harga produk yang belum memiliki nilai jual valid.',
      impactDescription: `Akan mengisi harga dasar minimal Rp10.000 pada ${invalidPriceCount} produk yang bernilai Rp0 agar dapat ditransaksikan di kasir.`,
      requiresConfirmation: true,
      affectedCount: invalidPriceCount,
    },
    {
      id: 'fix-stock',
      type: 'RECONCILE_STOCK',
      title: 'Rekonsiliasi Stok Minus (< 0)',
      description: 'Menormalkan sisa stok negatif menjadi 0 dan mencatat mutasi penyesuaian inventori.',
      impactDescription: `Akan mengubah sisa stok ${negativeStockCount} produk yang minus menjadi 0 dan membuat riwayat mutasi stok audit. Tidak menghapus produk.`,
      requiresConfirmation: true,
      affectedCount: negativeStockCount,
    },
    {
      id: 'fix-dup-tx',
      type: 'REMOVE_DUPLICATE_TRANSACTIONS',
      title: 'Deduplikasi Nomor Faktur Transaksi',
      description: 'Membersihkan rekaman transaksi duplikat akibat double submit saat sinyal lemah.',
      impactDescription: `Akan menyisakan 1 faktur sah untuk setiap nomor transaksi dan menghapus ${duplicateTxCount} baris duplikat. Data penjualan asli tetap utuh.`,
      requiresConfirmation: true,
      affectedCount: duplicateTxCount,
    },
    {
      id: 'fix-drift',
      type: 'FIX_TRANSACTION_TOTALS',
      title: 'Rekonsiliasi Kalkulasi Total Transaksi',
      description: 'Menghitung ulang subtotal dan total pembayaran sesuai rincian item, diskon, dan ongkir.',
      impactDescription: `Akan memulihkan kesesuaian nilai total pada ${driftTxCount} transaksi laporan penjualan.`,
      requiresConfirmation: true,
      affectedCount: driftTxCount,
    },
    {
      id: 'fix-orphan',
      type: 'FIX_ORPHAN_VARIANTS',
      title: 'Pembersihan Varian Produk Yatim',
      description: 'Membersihkan varian rasa atau sachet yang produk induknya telah dihapus.',
      impactDescription: `Akan menghapus ${orphanVariantsCount} data varian yatim agar tidak membebani memori kasir.`,
      requiresConfirmation: true,
      affectedCount: orphanVariantsCount,
    },
    {
      id: 'fix-settings',
      type: 'REPAIR_STORE_SETTINGS',
      title: 'Pemulihan Konfigurasi Dasar Toko',
      description: 'Memastikan nama warung dan alamat terisi sesuai standar operasional Warung Bang Kobra.',
      impactDescription: 'Memperbaiki field profil toko yang kosong tanpa menghapus data pembayaran atau QRIS.',
      requiresConfirmation: true,
      affectedCount: 1,
    },
  ];

  const handleConfirmAndExecute = async () => {
    if (!activeModalAction) return;
    setIsProcessing(true);
    try {
      const ok = await onExecuteAutoFix(activeModalAction.type);
      if (ok) {
        showToast(`Perbaikan "${activeModalAction.title}" berhasil diterapkan!`, 'success');
        setActiveModalAction(null);
      }
    } catch {
      showToast('Gagal menjalankan perbaikan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-7 space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-black text-white">Perbaikan Mandiri Sistem (Safe Healing Engine)</h3>
        </div>
        <p className="text-xs text-stone-400 max-w-2xl leading-relaxed">
          Pusat tindakan perbaikan data yang aman, presisi, dan terverifikasi. Seluruh tindakan perbaikan dijamin <b>TIDAK MENGHAPUS</b> riwayat transaksi atau mengosongkan database. Konfirmasi ditampilkan sebelum eksekusi berlangsung.
        </p>

        {/* Security badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Proteksi Data Aktif: Tidak ada operasi destructive tanpa konfirmasi pengguna.</span>
        </div>
      </div>

      {/* Catalog of Safe Auto-Fixes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {autoFixCatalog.map((action) => {
          const hasIssues = action.affectedCount > 0;

          return (
            <div
              key={action.id}
              className={`bg-stone-900 border rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all ${
                hasIssues
                  ? 'border-amber-500/40 shadow-lg shadow-amber-950/20'
                  : 'border-stone-800 opacity-90'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                        hasIssues
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{action.title}</h4>
                      <span className="text-[11px] font-mono text-stone-400">
                        {hasIssues ? (
                          <span className="text-amber-400 font-bold">
                            {action.affectedCount} Data Perlu Dibereskan
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Data Bersih
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed min-h-[36px]">
                  {action.description}
                </p>

                <div className="bg-stone-950/80 border border-stone-800/80 rounded-xl p-3 text-[11px] text-stone-400 space-y-1">
                  <span className="text-stone-300 font-bold block">Dampak Aksi:</span>
                  <p className="text-stone-400">{action.impactDescription}</p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-stone-800 flex items-center justify-between">
                <span className="text-[10px] text-stone-500 font-mono">
                  Mode: Aman (Konfirmasi)
                </span>

                <button
                  type="button"
                  onClick={() => setActiveModalAction(action)}
                  className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer ${
                    hasIssues
                      ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-950/40'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{hasIssues ? 'Perbaiki Sekarang' : 'Jalankan Ulang'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {activeModalAction && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-extrabold text-white text-base">
                  Konfirmasi Tindakan Perbaikan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalAction(null)}
                className="p-1 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-300 space-y-1">
                <span className="font-black text-sm block">{activeModalAction.title}</span>
                <p className="text-stone-300">{activeModalAction.description}</p>
              </div>

              <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-2">
                <div className="text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  Rincian &amp; Dampak Perubahan:
                </div>
                <p className="text-stone-200 leading-relaxed font-sans">
                  {activeModalAction.impactDescription}
                </p>
                <div className="pt-2 text-stone-500 text-[11px] border-t border-stone-800">
                  Data yang diproses: <b>{activeModalAction.affectedCount} item</b>. Tindakan ini akan dicatat dalam Audit Log Cloud.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setActiveModalAction(null)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl bg-stone-800 text-stone-300 font-bold text-xs hover:bg-stone-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAndExecute}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-950/40 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>{isProcessing ? 'Memproses Perbaikan...' : 'Konfirmasi & Perbaiki Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
