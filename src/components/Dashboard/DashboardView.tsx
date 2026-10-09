import React, { useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  Package,
  DollarSign,
  AlertTriangle,
  MessageCircle,
  PlusCircle,
  Layers,
  BarChart2,
  Calendar,
  ArrowUpRight,
  ArrowRight,
  QrCode,
  Bike,
  Camera,
  ShoppingBag,
  Clock,
  Sparkles,
  Flame,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { Transaction, Product, ActiveTab, StoreSettings, WarungUser } from '../../types';
import {
  formatRupiah,
  formatDateIndo,
  normalizeOrderStatus,
  normalizeDeliveryStatus,
  resolveOrderType,
  getOrderStatusLabel,
} from '../../utils/formatters';
import { BrandLogo } from '../Common/BrandLogo';

interface DashboardViewProps {
  transactions: Transaction[];
  products: Product[];
  settings?: StoreSettings;
  currentUser?: WarungUser | null;
  onNavigate: (tab: ActiveTab) => void;
  onSelectTransaction: (tx: Transaction) => void;
  onOpenLogoEditor?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  products,
  settings,
  currentUser,
  onNavigate,
  onSelectTransaction,
  onOpenLogoEditor,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Metrics for Today (all non-cancelled orders)
  const todayTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => tx.tanggal === todayStr && normalizeOrderStatus(tx.status) !== 'DIBATALKAN'
    );
  }, [transactions, todayStr]);

  const todaySales = useMemo(() => {
    return todayTransactions.reduce((sum, tx) => sum + Number(tx.total || 0), 0);
  }, [todayTransactions]);

  const todayItemsSold = useMemo(() => {
    return todayTransactions.reduce(
      (sum, tx) => sum + (tx.items || []).reduce((s, i) => s + Number(i.qty || 0), 0),
      0
    );
  }, [todayTransactions]);

  // Pesanan Aktif (Menunggu, Diproses, Siap)
  const activeOrdersCount = useMemo(() => {
    return transactions.filter((tx) => {
      const st = normalizeOrderStatus(tx.status);
      return st === 'MENUNGGU' || st === 'DIPROSES' || st === 'SIAP';
    }).length;
  }, [transactions]);

  // Total Estimated Profit Today: (Selling Price - Capital Price) * Qty
  const todayProfit = useMemo(() => {
    let profit = 0;
    todayTransactions.forEach((tx) => {
      (tx.items || []).forEach((item) => {
        const prod = products.find((p) => p.id === item.id_produk || p.nama === item.nama_produk);
        const modal = prod ? prod.harga_modal : item.harga * 0.5; // fallback 50% modal if unknown
        profit += (item.harga - modal) * item.qty;
      });
    });
    return Math.max(0, profit);
  }, [todayTransactions, products]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stok <= p.stok_minimum);
  }, [products]);

  // Top Selling Products (Overall)
  const topSellingProducts = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; total: number; foto: string }> = {};
    transactions.forEach((tx) => {
      if (normalizeOrderStatus(tx.status) !== 'DIBATALKAN') {
        (tx.items || []).forEach((item) => {
          if (!counts[item.nama_produk]) {
            const prod = products.find(
              (p) => p.id === item.id_produk || p.nama === item.nama_produk
            );
            counts[item.nama_produk] = {
              name: item.nama_produk,
              qty: 0,
              total: 0,
              foto: prod?.foto || '',
            };
          }
          counts[item.nama_produk].qty += item.qty;
          counts[item.nama_produk].total += item.subtotal;
        });
      }
    });
    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [transactions, products]);

  // 7 Days Sales Trend Data for Chart
  const last7DaysData = useMemo(() => {
    const days: Array<{ date: string; label: string; total: number; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayTxs = transactions.filter(
        (tx) => tx.tanggal === dStr && normalizeOrderStatus(tx.status) !== 'DIBATALKAN'
      );
      const total = dayTxs.reduce((s, tx) => s + tx.total, 0);
      days.push({
        date: dStr,
        label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        total,
        count: dayTxs.length,
      });
    }
    return days;
  }, [transactions]);

  const maxSales = Math.max(...last7DaysData.map((d) => d.total), 50000);

  // Recent 5 Transactions
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5);
  }, [transactions]);

  // 12. DASHBOARD STATISTIK DELIVERY DQM (Realtime Firebase)
  const deliveryStats = useMemo(() => {
    const dqmOrders = transactions.filter((tx) => resolveOrderType(tx) === 'DELIVERY_DQM');
    let todayTotal = 0;
    let menunggu = 0;
    let diantar = 0;
    let sampai = 0;
    let diterima = 0;
    let gagal = 0;

    dqmOrders.forEach((tx) => {
      const txDate = tx.tanggal || (tx.created_at ? tx.created_at.slice(0, 10) : '');
      if (txDate === todayStr) {
        todayTotal += 1;
      }
      const st = normalizeDeliveryStatus(tx);
      if (st === 'MENUNGGU') menunggu += 1;
      else if (st === 'DIANTAR') diantar += 1;
      else if (st === 'SAMPAI') sampai += 1;
      else if (st === 'DITERIMA') diterima += 1;
      else if (st === 'GAGAL DIANTAR') gagal += 1;
    });

    return {
      todayTotal,
      menunggu,
      diantar,
      sampai,
      diterima,
      gagal,
    };
  }, [transactions, todayStr]);

  const activeUserGreeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Selamat Datang';
    if (hour >= 4 && hour < 11) timeGreeting = 'Selamat Pagi';
    else if (hour >= 11 && hour < 15) timeGreeting = 'Selamat Siang';
    else if (hour >= 15 && hour < 18) timeGreeting = 'Selamat Sore';
    else timeGreeting = 'Selamat Malam';

    const userName = currentUser?.nama || 'Kasir';
    return `${timeGreeting}, ${userName}!`;
  }, [currentUser]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6">
      {/* 1. Header Hero Card: Logo yang dapat diganti, sapaan pengguna, tanggal & status realtime */}
      <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border border-stone-800 shadow-xl p-4 sm:p-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 right-24 w-60 h-60 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Clickable Logo with quick camera icon to change/upload logo */}
            <div
              onClick={onOpenLogoEditor}
              title={onOpenLogoEditor ? 'Klik untuk mengganti logo warung' : 'Logo Warung Bang Kobra'}
              className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-stone-950 border-2 border-red-600/40 shadow-lg shadow-red-950/60 shrink-0 overflow-hidden flex items-center justify-center group ${
                onOpenLogoEditor ? 'cursor-pointer hover:border-orange-500 hover:scale-105 transition-all' : ''
              }`}
            >
              <BrandLogo
                src={settings?.logoUrl}
                alt={settings?.storeName || 'Warung Bang Kobra'}
                size="custom"
                rounded="rounded-none"
                border={false}
                className="w-full h-full"
                imgClassName="group-hover:scale-110 transition-transform duration-300"
              />
              {onOpenLogoEditor && (
                <div className="absolute inset-0 bg-stone-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-5 h-5 text-orange-400" />
                </div>
              )}
              {onOpenLogoEditor && (
                <div className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-lg bg-orange-500 text-stone-950 flex items-center justify-center">
                  <Camera className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
            </div>

            {/* User Greeting & Date */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30">
                  {currentUser?.role || 'Staff POS'}
                </span>
                <span className="text-xs text-stone-400 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  <span>{formatDateIndo(todayStr)}</span>
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-1 leading-tight">
                {activeUserGreeting}
              </h1>
              <p className="text-xs text-stone-300 mt-0.5">
                Operasional {settings?.storeName || 'Warung Bang Kobra'} aktif &amp; realtime.
              </p>
            </div>
          </div>

          {/* Realtime Live Pulse Badge & Quick Action */}
          <div className="flex items-center gap-2 sm:self-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-950/80 border border-stone-800 text-xs font-semibold text-stone-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px]">Database Cloud Aktif</span>
            </div>

            <button
              onClick={() => onNavigate('pos')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg shadow-red-950/50 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Buka Kasir</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Action Bar (Akses Cepat) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          id="btn-quick-new-tx"
          onClick={() => onNavigate('pos')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg shadow-red-950/50 whitespace-nowrap active:scale-95 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Transaksi Baru</span>
        </button>
        <button
          onClick={() => onNavigate('orders')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900 border border-red-500/40 hover:bg-red-950/40 text-stone-100 hover:text-white font-bold text-xs whitespace-nowrap active:scale-95 transition cursor-pointer"
        >
          <Receipt className="w-4 h-4 text-red-500" />
          <span>Antrian Kasir</span>
          {activeOrdersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white">
              {activeOrdersCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onNavigate('delivery_dqm')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900 border border-orange-500/40 hover:bg-orange-950/40 text-stone-100 hover:text-white font-bold text-xs whitespace-nowrap active:scale-95 transition cursor-pointer"
        >
          <Bike className="w-4 h-4 text-orange-400" />
          <span>DELIVERY DQM</span>
        </button>
        <button
          onClick={() => onNavigate('whatsapp_order')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900 border border-emerald-500/40 hover:bg-emerald-950/40 text-emerald-400 font-bold text-xs whitespace-nowrap active:scale-95 transition cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          <span>+ Pesanan WhatsApp</span>
        </button>
        <button
          onClick={() => onNavigate('preorders')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-200 font-bold text-xs whitespace-nowrap active:scale-95 transition cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-red-500" />
          <span>Pre-Order (PO)</span>
        </button>
        <button
          onClick={() => onNavigate('products')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-200 font-bold text-xs whitespace-nowrap active:scale-95 transition cursor-pointer"
        >
          <Package className="w-4 h-4 text-orange-400" />
          <span>+ Tambah Menu</span>
        </button>
        <button
          onClick={() => onNavigate('stock')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-200 font-bold text-xs whitespace-nowrap active:scale-95 transition cursor-pointer"
        >
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Kelola Stok</span>
        </button>
        <button
          onClick={() => onNavigate('reports')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-200 font-bold text-xs whitespace-nowrap active:scale-95 transition cursor-pointer"
        >
          <BarChart2 className="w-4 h-4 text-amber-400" />
          <span>Laporan</span>
        </button>
      </div>

      {/* 3. Ringkasan KPI Cards Grid (Omzet, Transaksi, Pesanan Aktif, Keuntungan) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Ringkasan Omzet Hari Ini */}
        <div className="p-4 sm:p-5 rounded-[20px] bg-stone-900 border border-stone-800 shadow-xl space-y-2 relative overflow-hidden group hover:border-red-500/40 transition">
          <div className="flex items-center justify-between text-xs font-bold text-stone-400">
            <span>Omzet Hari Ini</span>
            <div className="w-8 h-8 rounded-xl bg-red-600/15 text-red-500 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
            {formatRupiah(todaySales)}
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{todayItemsSold} item terjual hari ini</span>
          </div>
        </div>

        {/* Total Transaksi */}
        <div className="p-4 sm:p-5 rounded-[20px] bg-stone-900 border border-stone-800 shadow-xl space-y-2 relative overflow-hidden group hover:border-orange-500/40 transition">
          <div className="flex items-center justify-between text-xs font-bold text-stone-400">
            <span>Total Transaksi</span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
            {todayTransactions.length} <span className="text-sm font-normal text-stone-400">order</span>
          </div>
          <div className="text-[11px] text-stone-400 font-semibold">
            Status non-dibatalkan
          </div>
        </div>

        {/* Pesanan Aktif / Antrian Kasir */}
        <div
          onClick={() => onNavigate('orders')}
          className="p-4 sm:p-5 rounded-[20px] bg-stone-900 border border-stone-800 hover:border-amber-500/50 shadow-xl space-y-2 relative overflow-hidden cursor-pointer group transition"
        >
          <div className="flex items-center justify-between text-xs font-bold text-stone-400">
            <span>Pesanan Aktif</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
            {activeOrdersCount} <span className="text-sm font-normal text-stone-400">antrian</span>
          </div>
          <div className="text-[11px] text-stone-400 flex items-center justify-between">
            <span>Menunggu &amp; diproses</span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 transition" />
          </div>
        </div>

        {/* Keuntungan Bersih Estimasi */}
        <div className="p-4 sm:p-5 rounded-[20px] bg-stone-900 border border-stone-800 shadow-xl space-y-2 relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-xs font-bold text-stone-400">
            <span>Estimasi Keuntungan</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">
            {formatRupiah(todayProfit)}
          </div>
          <div className="text-[11px] text-stone-400 font-semibold">
            Selisih harga jual &amp; modal
          </div>
        </div>
      </div>

      {/* 12. DASHBOARD REAL-TIME STATISTIK DELIVERY DQM */}
      <div className="bg-gradient-to-r from-red-950/70 via-stone-900 to-stone-900 border-2 border-red-600/40 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white">
                  STATISTIK DELIVERY DQM &amp; BUKTI PENGANTARAN
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-orange-500 text-stone-950 text-[10px] font-black">
                  REALTIME FIREBASE
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Status pengantaran ke area Pesantren DQM diperbarui secara otomatis tanpa refresh halaman.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('delivery_dqm')}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer shrink-0"
          >
            <span>Buka Halaman Delivery &amp; Riwayat DQM</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div
            onClick={() => onNavigate('delivery_dqm')}
            className="p-3.5 rounded-2xl bg-stone-950/90 border border-red-500/40 hover:border-orange-400 cursor-pointer transition"
          >
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-wider">
              HARI INI
            </div>
            <div className="text-2xl font-black text-white font-mono tabular-nums mt-0.5">
              {deliveryStats.todayTotal}
            </div>
            <div className="text-xs font-bold text-stone-300 mt-0.5">Delivery Hari Ini</div>
          </div>

          <div
            onClick={() => onNavigate('delivery_dqm')}
            className="p-3.5 rounded-2xl bg-stone-950/90 border border-amber-500/30 hover:border-amber-400 cursor-pointer transition"
          >
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
              MENUNGGU
            </div>
            <div className="text-2xl font-black text-white font-mono tabular-nums mt-0.5">
              {deliveryStats.menunggu}
            </div>
            <div className="text-xs font-bold text-stone-300 mt-0.5">Menunggu</div>
          </div>

          <div
            onClick={() => onNavigate('delivery_dqm')}
            className="p-3.5 rounded-2xl bg-stone-950/90 border border-orange-500/30 hover:border-orange-400 cursor-pointer transition"
          >
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-wider">
              DIANTAR
            </div>
            <div className="text-2xl font-black text-white font-mono tabular-nums mt-0.5">
              {deliveryStats.diantar}
            </div>
            <div className="text-xs font-bold text-stone-300 mt-0.5">Sedang Diantar</div>
          </div>

          <div
            onClick={() => onNavigate('delivery_dqm')}
            className="p-3.5 rounded-2xl bg-stone-950/90 border border-sky-500/30 hover:border-sky-400 cursor-pointer transition"
          >
            <div className="text-[10px] font-black text-sky-400 uppercase tracking-wider">
              SAMPAI
            </div>
            <div className="text-2xl font-black text-white font-mono tabular-nums mt-0.5">
              {deliveryStats.sampai}
            </div>
            <div className="text-xs font-bold text-stone-300 mt-0.5">Sudah Sampai</div>
          </div>

          <div
            onClick={() => onNavigate('delivery_dqm')}
            className="p-3.5 rounded-2xl bg-stone-950/90 border border-emerald-500/30 hover:border-emerald-400 cursor-pointer transition"
          >
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
              ✓ DITERIMA
            </div>
            <div className="text-2xl font-black text-white font-mono tabular-nums mt-0.5">
              {deliveryStats.diterima}
            </div>
            <div className="text-xs font-bold text-stone-300 mt-0.5">Sudah Diterima</div>
          </div>

          <div
            onClick={() => onNavigate('delivery_dqm')}
            className="p-3.5 rounded-2xl bg-stone-950/90 border border-rose-500/30 hover:border-rose-400 cursor-pointer transition"
          >
            <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider">
              GAGAL
            </div>
            <div className="text-2xl font-black text-white font-mono tabular-nums mt-0.5">
              {deliveryStats.gagal}
            </div>
            <div className="text-xs font-bold text-stone-300 mt-0.5">Gagal Diantar</div>
          </div>
        </div>
      </div>

      {/* QR Code Self-Order Callout */}
      <div className="bg-gradient-to-r from-amber-950/40 via-stone-900 to-orange-950/40 border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-stone-100">
                QR MENU WARUNG BANG KOBRA (BUNGKUS &amp; DELIVERY DQM)
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Tanpa Instal Aplikasi
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Pelanggan cukup scan QR Menu untuk pesan BUNGKUS atau DELIVERY DQM (khusus area Pesantren DQM). Pesanan langsung masuk ke Antrian Kasir!
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-dash-open-qrcode"
          onClick={() => onNavigate('qrcode_order')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-lg shadow-amber-950/40 transition active:scale-95 shrink-0 cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>Buka & Cetak QR Code</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Google Chat Otomatis Callout Card */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-stone-900 to-teal-950/40 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-stone-100">
                GOOGLE CHAT OTOMATIS (PESANAN, DELIVERY & LAPORAN HARIAN)
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Notifikasi Real-time
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Notifikasi pesanan masuk, delivery DQM santri, peringatan stok menipis, dan laporan harian otomatis terkirim langsung ke ruang Google Chat toko.
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-dash-open-gchat"
          onClick={() => onNavigate('google_chat')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs shadow-lg shadow-emerald-950/40 transition active:scale-95 shrink-0 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Buka Google Chat</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Middle Grid: Sales Trend Chart & Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 7 Days Sales Trend Chart */}
        <div className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-stone-100 text-sm sm:text-base">
                Tren Penjualan 7 Hari Terakhir
              </h3>
              <p className="text-xs text-stone-400">Grafik omzet harian Warung Bang Kobra</p>
            </div>
            <div className="text-xs font-bold text-amber-400 font-mono">
              Total 7 Hari: {formatRupiah(last7DaysData.reduce((s, d) => s + d.total, 0))}
            </div>
          </div>

          {/* Clean Interactive SVG Bar Chart */}
          <div className="h-56 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
            {last7DaysData.map((day, idx) => {
              const heightPct = Math.max(8, (day.total / maxSales) * 100);
              const isToday = idx === last7DaysData.length - 1;

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-2 group h-full justify-end"
                >
                  {/* Tooltip value */}
                  <span className="text-[10px] font-mono font-bold text-stone-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {formatRupiah(day.total)}
                  </span>

                  {/* Bar */}
                  <div className="w-full max-w-[40px] bg-stone-800 rounded-xl overflow-hidden h-full flex flex-col justify-end p-0.5">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-lg transition-all duration-500 ${
                        isToday
                          ? 'bg-gradient-to-t from-amber-600 via-orange-500 to-amber-400 shadow-lg shadow-amber-900/30'
                          : 'bg-stone-700 group-hover:bg-amber-600/70'
                      }`}
                    />
                  </div>

                  {/* Day Label */}
                  <span
                    className={`text-[11px] font-bold ${
                      isToday ? 'text-amber-400 font-extrabold' : 'text-stone-400'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Best Sellers */}
        <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-stone-100 text-sm sm:text-base">
              Menu Terlaris
            </h3>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-bold text-amber-500 hover:text-amber-400"
            >
              Lihat Semua
            </button>
          </div>

          <div className="space-y-3">
            {topSellingProducts.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-8">Belum ada data penjualan.</p>
            ) : (
              topSellingProducts.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-950 border border-stone-800/80"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-stone-800 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-stone-200 truncate">{item.name}</h4>
                      <p className="text-[10px] text-stone-400 font-mono">
                        {formatRupiah(item.total)}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg text-xs font-bold font-mono bg-stone-900 text-stone-300 shrink-0">
                    {item.qty} porsi
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Low Stock Alert List & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stok Menipis Details */}
        <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h3 className="font-extrabold text-stone-100 text-sm sm:text-base">
                Peringatan Stok Menipis
              </h3>
            </div>
            <button
              onClick={() => onNavigate('stock')}
              className="text-xs font-bold text-amber-500 hover:text-amber-400"
            >
              Restok
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {lowStockProducts.length === 0 ? (
              <div className="p-6 text-center text-stone-500 text-xs">
                Semua stok produk dalam kondisi aman!
              </div>
            ) : (
              lowStockProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-stone-950 border border-rose-950/60"
                >
                  <div>
                    <div className="font-bold text-xs text-stone-200">{prod.nama}</div>
                    <div className="text-[10px] text-stone-400">
                      Minimal: {prod.stok_minimum} {prod.satuan}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Sisa {prod.stok}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-stone-100 text-sm sm:text-base">
              Transaksi Terkini
            </h3>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-bold text-amber-500 hover:text-amber-400"
            >
              Lihat Laporan
            </button>
          </div>

          <div className="space-y-2.5 overflow-x-auto">
            {recentTransactions.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-6">Belum ada transaksi.</p>
            ) : (
              recentTransactions.map((tx) => (
                <div
                  key={tx.id_transaksi}
                  onClick={() => onSelectTransaction(tx)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-stone-950 border border-stone-800 hover:border-amber-500/50 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-stone-900 text-stone-400 flex items-center justify-center font-mono text-[10px] font-bold group-hover:text-amber-400">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-stone-200">
                          {tx.id_transaksi}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${
                            tx.orderType === 'PRE_ORDER' || Boolean(tx.poNumber)
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : resolveOrderType(tx) === 'DELIVERY_DQM'
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {tx.orderType === 'PRE_ORDER' || Boolean(tx.poNumber)
                            ? '[PRE-ORDER]'
                            : resolveOrderType(tx) === 'DELIVERY_DQM'
                            ? '[DELIVERY DQM]'
                            : '[BUNGKUS]'}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {tx.nama_pelanggan || 'Pelanggan'} • {tx.jam} • {getOrderStatusLabel(tx)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-extrabold text-xs text-amber-400">
                      {formatRupiah(tx.total)}
                    </div>
                    <span className="inline-block text-[10px] font-bold uppercase text-stone-400">
                      {tx.metode_pembayaran}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
