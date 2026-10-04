import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Search,
  Filter,
  Users,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Printer,
  Share2,
  MessageCircle,
  CreditCard,
  DollarSign,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  X,
  FileSpreadsheet,
  Download,
  CalendarDays,
  List,
  BarChart3,
  ChefHat,
  Package,
  Layers,
  Sparkles,
  Info,
  Check,
  Truck,
  ArrowRight,
} from 'lucide-react';
import {
  Transaction,
  StoreSettings,
  Product,
  ProductVariant,
  POStatus,
  POPaymentStatus,
  POPaymentRecord,
  PaymentMethod,
} from '../../types';
import {
  formatRupiah,
  getPOStatusLabel,
  getPOStatusBadge,
  openWhatsAppChat,
  buildPOStatusNotificationWhatsAppMessage,
  normalizePOStatus,
} from '../../utils/formatters';
import {
  saveOrderToFirebase,
  deductStockWithFirestoreTransaction,
  restoreStockWithFirestoreTransaction,
} from '../../services/firebase';
import { StorageService } from '../../services/storage';

interface PreOrderDashboardViewProps {
  transactions: Transaction[];
  products: Product[];
  variants?: ProductVariant[];
  settings: StoreSettings;
  onUpdateTransaction: (updatedTx: Transaction) => void;
  onPrintReceipt: (tx: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenCreatePOModal: () => void;
}

type TabMode = 'list' | 'calendar' | 'reports';
type CalendarSubMode = 'day' | 'week' | 'month';
type DateFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'month' | 'custom';

export const PreOrderDashboardView: React.FC<PreOrderDashboardViewProps> = ({
  transactions,
  products,
  variants = [],
  settings,
  onUpdateTransaction,
  onPrintReceipt,
  showToast,
  onOpenCreatePOModal,
}) => {
  // Navigation & Sub-views
  const [tabMode, setTabMode] = useState<TabMode>('list');
  const [calendarSubMode, setCalendarSubMode] = useState<CalendarSubMode>('month');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'BUNGKUS' | 'DELIVERY_DQM'>('ALL');

  // Modals state
  const [selectedPOForDetail, setSelectedPOForDetail] = useState<Transaction | null>(null);
  const [poForPayment, setPoForPayment] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Edit PO Modal
  const [poForEdit, setPoForEdit] = useState<Transaction | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerEmail, setEditCustomerEmail] = useState('');
  const [editEventType, setEditEventType] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editEventTime, setEditEventTime] = useState('');
  const [editGuestCount, setEditGuestCount] = useState<number | ''>('');
  const [editDeliveryType, setEditDeliveryType] = useState<'BUNGKUS' | 'DELIVERY_DQM'>('BUNGKUS');
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Cancel PO Modal
  const [poForCancel, setPoForCancel] = useState<Transaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);

  // Calendar state
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());

  // 1. ALL PO TRANSACTIONS FILTER
  const allPOTransactions = useMemo(() => {
    return transactions
      .filter((tx) => tx.orderType === 'PRE_ORDER' || Boolean(tx.poNumber))
      .sort((a, b) => {
        // Sort by eventDate ascending (upcoming first)
        const dateA = a.eventDate || a.tanggal || '';
        const dateB = b.eventDate || b.tanggal || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const timeA = a.eventTime || a.jam || '';
        const timeB = b.eventTime || b.jam || '';
        return timeA.localeCompare(timeB);
      });
  }, [transactions]);

  // Quick Today & Tomorrow Date Strings
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // 2. UPCOMING & NEAR SCHEDULE WARNINGS
  const nearSchedulePOs = useMemo(() => {
    return allPOTransactions.filter((tx) => {
      const st = normalizePOStatus(tx.poStatus || tx.status);
      if (st === 'SELESAI' || st === 'DIBATALKAN') return false;
      const targetDate = tx.eventDate || tx.tanggal;
      return targetDate === todayStr || targetDate === tomorrowStr;
    });
  }, [allPOTransactions, todayStr, tomorrowStr]);

  // 3. STOCK DEFICIT CHECK (Kebutuhan Stok untuk PO aktif vs Stok saat ini)
  const stockWarnings = useMemo(() => {
    // Map required qty per product and variant
    const requiredProductQtyMap = new Map<string, { name: string; needed: number; currentStock: number }>();
    const requiredVariantQtyMap = new Map<string, { name: string; needed: number; currentStock: number }>();

    allPOTransactions.forEach((tx) => {
      const st = normalizePOStatus(tx.poStatus || tx.status);
      // Only count active POs where stock hasn't already been deducted
      if (st === 'SELESAI' || st === 'DIBATALKAN' || tx.poStockDeducted) return;

      tx.items.forEach((it) => {
        if (it.variantId) {
          const varObj = variants.find((v) => v.variantId === it.variantId);
          const cur = requiredVariantQtyMap.get(it.variantId) || {
            name: it.nama_produk,
            needed: 0,
            currentStock: varObj ? varObj.stock : 0,
          };
          cur.needed += it.qty;
          requiredVariantQtyMap.set(it.variantId, cur);
        } else {
          const pObj = products.find((p) => p.id === it.id_produk);
          const cur = requiredProductQtyMap.get(it.id_produk) || {
            name: it.nama_produk,
            needed: 0,
            currentStock: pObj ? pObj.stok : 0,
          };
          cur.needed += it.qty;
          requiredProductQtyMap.set(it.id_produk, cur);
        }
      });
    });

    const deficits: Array<{ name: string; needed: number; available: number; deficit: number }> = [];

    requiredProductQtyMap.forEach((val) => {
      if (val.needed > val.currentStock) {
        deficits.push({
          name: val.name,
          needed: val.needed,
          available: val.currentStock,
          deficit: val.needed - val.currentStock,
        });
      }
    });

    requiredVariantQtyMap.forEach((val) => {
      if (val.needed > val.currentStock) {
        deficits.push({
          name: val.name,
          needed: val.needed,
          available: val.currentStock,
          deficit: val.needed - val.currentStock,
        });
      }
    });

    return deficits;
  }, [allPOTransactions, products, variants]);

  // 4. FILTERED PO TRANSACTIONS
  const filteredPOs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();

    return allPOTransactions.filter((tx) => {
      const targetDate = tx.eventDate || tx.tanggal;

      // Status Filter
      if (statusFilter !== 'ALL') {
        const norm = normalizePOStatus(tx.poStatus || tx.status);
        if (norm !== statusFilter) return false;
      }

      // Delivery Filter
      if (deliveryFilter !== 'ALL') {
        const isDeliv = tx.deliveryType === 'DELIVERY_DQM' || tx.orderType === 'DELIVERY_DQM';
        if (deliveryFilter === 'DELIVERY_DQM' && !isDeliv) return false;
        if (deliveryFilter === 'BUNGKUS' && isDeliv) return false;
      }

      // Date Filter
      if (dateFilter === 'today') {
        if (targetDate !== todayStr) return false;
      } else if (dateFilter === 'tomorrow') {
        if (targetDate !== tomorrowStr) return false;
      } else if (dateFilter === 'week') {
        const targetD = new Date(targetDate);
        const diffDays = Math.round((targetD.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < -1 || diffDays > 7) return false;
      } else if (dateFilter === 'month') {
        const targetD = new Date(targetDate);
        if (targetD.getMonth() !== now.getMonth() || targetD.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (dateFilter === 'custom') {
        if (customStartDate && targetDate < customStartDate) return false;
        if (customEndDate && targetDate > customEndDate) return false;
      }

      // Search Query
      if (q) {
        const poNum = (tx.poNumber || tx.id_transaksi).toLowerCase();
        const custName = (tx.nama_pelanggan || '').toLowerCase();
        const custPhone = (tx.no_whatsapp || '').toLowerCase();
        const evType = (tx.eventType || '').toLowerCase();
        const itemsMatch = tx.items.some((it) => it.nama_produk.toLowerCase().includes(q));
        if (
          !poNum.includes(q) &&
          !custName.includes(q) &&
          !custPhone.includes(q) &&
          !evType.includes(q) &&
          !itemsMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    allPOTransactions,
    searchQuery,
    statusFilter,
    deliveryFilter,
    dateFilter,
    todayStr,
    tomorrowStr,
    customStartDate,
    customEndDate,
  ]);

  // 5. STATUS SUMMARY COUNTS
  const countsByStatus = useMemo(() => {
    const map: Record<string, number> = {
      ALL: allPOTransactions.length,
      MENUNGGU_KONFIRMASI: 0,
      DIKONFIRMASI: 0,
      MENUNGGU_DP: 0,
      DP_DITERIMA: 0,
      DIPROSES: 0,
      SIAP_DIAMBIL: 0,
      DALAM_PENGIRIMAN: 0,
      SELESAI: 0,
      DIBATALKAN: 0,
    };

    allPOTransactions.forEach((tx) => {
      const st = normalizePOStatus(tx.poStatus || tx.status);
      if (map[st] !== undefined) {
        map[st]++;
      }
    });

    return map;
  }, [allPOTransactions]);

  // 6. ACTION HANDLERS
  const handleUpdateStatus = async (tx: Transaction, nextStatus: POStatus) => {
    try {
      const shouldDeductStock =
        (nextStatus === 'DIPROSES' || nextStatus === 'SELESAI') && !tx.poStockDeducted;

      let updatedTx: Transaction = {
        ...tx,
        poStatus: nextStatus,
        status: nextStatus === 'SELESAI' ? 'SELESAI' : nextStatus === 'DIBATALKAN' ? 'DIBATALKAN' : 'DIPROSES',
        updated_at: new Date().toISOString(),
      };

      if (shouldDeductStock) {
        await deductStockWithFirestoreTransaction(tx);
        updatedTx.poStockDeducted = true;
      }

      await saveOrderToFirebase(updatedTx);
      StorageService.completeTransaction(updatedTx);
      onUpdateTransaction(updatedTx);

      if (showToast) {
        showToast(
          `Status PO ${tx.poNumber || tx.id_transaksi} diperbarui menjadi: ${getPOStatusLabel(nextStatus)}`,
          'success'
        );
      }
    } catch (err) {
      console.error('Error updating PO status:', err);
      if (showToast) showToast('Gagal memperbarui status PO.', 'error');
    }
  };

  // Open Payment Modal
  const handleOpenPaymentModal = (tx: Transaction) => {
    setPoForPayment(tx);
    const rem = tx.remainingPayment ?? (tx.total - (tx.dpPaid || 0));
    setPaymentAmount(rem > 0 ? rem : '');
    setPaymentMethod('Transfer');
    setPaymentNote('');
    setPaymentProofUrl('');
  };

  // Confirm Payment (DP or Pelunasan)
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForPayment) return;

    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      if (showToast) showToast('Nominal pembayaran harus lebih dari 0!', 'error');
      return;
    }

    setIsProcessingPayment(true);

    try {
      const now = new Date();
      const currentPaid = Number(poForPayment.dpPaid || 0);
      const newPaid = currentPaid + amt;
      const newRemaining = Math.max(0, poForPayment.total - newPaid);

      const isFull = newRemaining <= 0;
      const newPaymentStatus: POPaymentStatus = isFull ? 'LUNAS' : newPaid > 0 ? 'DP' : 'BELUM_BAYAR';

      const paymentRecord: POPaymentRecord = {
        id: `PAY-${Date.now()}`,
        amount: amt,
        type: isFull ? 'PELUNASAN' : 'DP',
        method: paymentMethod,
        date: now.toISOString(),
        note: paymentNote.trim() || undefined,
        verifiedBy: settings.activeCashier || 'Kasir',
        proofUrl: paymentProofUrl || undefined,
      };

      const updatedHistory = [...(poForPayment.paymentHistory || []), paymentRecord];

      // Auto update status if waiting for DP
      let nextPOStatus = poForPayment.poStatus;
      if (poForPayment.poStatus === 'MENUNGGU_DP' || poForPayment.poStatus === 'MENUNGGU_KONFIRMASI') {
        nextPOStatus = 'DP_DITERIMA';
      }

      const updatedTx: Transaction = {
        ...poForPayment,
        dpPaid: newPaid,
        uang_diterima: newPaid,
        remainingPayment: newRemaining,
        paymentStatus: newPaymentStatus,
        paymentHistory: updatedHistory,
        poStatus: nextPOStatus,
        updated_at: now.toISOString(),
      };

      await saveOrderToFirebase(updatedTx);
      StorageService.completeTransaction(updatedTx);
      onUpdateTransaction(updatedTx);

      if (showToast) {
        showToast(
          `Pembayaran ${formatRupiah(amt)} berhasil dicatat! Status: ${newPaymentStatus}`,
          'success'
        );
      }

      setPoForPayment(null);
    } catch (err) {
      console.error('Error saving payment:', err);
      if (showToast) showToast('Gagal mencatat pembayaran PO.', 'error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (tx: Transaction) => {
    setPoForEdit(tx);
    setEditCustomerName(tx.nama_pelanggan);
    setEditCustomerPhone(tx.no_whatsapp);
    setEditCustomerEmail(tx.email_pelanggan || '');
    setEditEventType(tx.eventType || 'Acara');
    setEditEventDate(tx.eventDate || tx.tanggal);
    setEditEventTime(tx.eventTime || tx.jam);
    setEditGuestCount(tx.guestCount || '');
    setEditDeliveryType(tx.deliveryType === 'DELIVERY_DQM' ? 'DELIVERY_DQM' : 'BUNGKUS');
    setEditLocation(tx.eventLocation || tx.deliveryLocation || '');
    setEditNotes(tx.notes || tx.catatan_pesanan || '');
  };

  // Save Edit PO
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForEdit) return;

    setIsSubmittingEdit(true);

    try {
      const isDeliv = editDeliveryType === 'DELIVERY_DQM';
      const updatedTx: Transaction = {
        ...poForEdit,
        nama_pelanggan: editCustomerName.trim(),
        no_whatsapp: editCustomerPhone.trim(),
        email_pelanggan: editCustomerEmail.trim() || undefined,
        eventType: editEventType.trim(),
        eventDate: editEventDate,
        eventTime: editEventTime,
        guestCount: Number(editGuestCount) || undefined,
        deliveryType: editDeliveryType,
        deliveryArea: isDeliv ? 'DQM' : null,
        eventLocation: editLocation.trim(),
        notes: editNotes.trim() || undefined,
        updated_at: new Date().toISOString(),
      };

      await saveOrderToFirebase(updatedTx);
      StorageService.completeTransaction(updatedTx);
      onUpdateTransaction(updatedTx);

      if (showToast) {
        showToast(`Data PO ${poForEdit.poNumber || poForEdit.id_transaksi} berhasil diperbarui!`, 'success');
      }

      setPoForEdit(null);
    } catch (err) {
      console.error('Error updating PO:', err);
      if (showToast) showToast('Gagal menyimpan perubahan PO.', 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Cancel PO Execution
  const handleConfirmCancelPO = async () => {
    if (!poForCancel) return;

    setIsProcessingCancel(true);

    try {
      // If stock was already deducted, restore it
      if (poForCancel.poStockDeducted) {
        await restoreStockWithFirestoreTransaction(poForCancel);
      }

      const updatedTx: Transaction = {
        ...poForCancel,
        poStatus: 'DIBATALKAN',
        status: 'DIBATALKAN',
        notes: `${poForCancel.notes || ''} [Alasan Batal: ${cancelReason.trim() || 'Dibatalkan oleh kasir'}]`.trim(),
        poStockDeducted: false,
        updated_at: new Date().toISOString(),
      };

      await saveOrderToFirebase(updatedTx);
      StorageService.completeTransaction(updatedTx);
      onUpdateTransaction(updatedTx);

      if (showToast) {
        showToast(`PO ${poForCancel.poNumber || poForCancel.id_transaksi} telah dibatalkan.`, 'info');
      }

      setPoForCancel(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error cancelling PO:', err);
      if (showToast) showToast('Gagal membatalkan PO.', 'error');
    } finally {
      setIsProcessingCancel(false);
    }
  };

  // WhatsApp Contact Action
  const handleOpenWhatsAppCustomer = (tx: Transaction) => {
    const msg = buildPOStatusNotificationWhatsAppMessage({
      storeName: settings.storeName,
      poNumber: tx.poNumber || tx.id_transaksi,
      customerName: tx.nama_pelanggan,
      newStatus: tx.poStatus || tx.status,
      eventDate: tx.eventDate || tx.tanggal,
      eventTime: tx.eventTime || tx.jam,
      total: tx.total,
      dpPaid: tx.dpPaid || 0,
      remainingPayment: tx.remainingPayment ?? (tx.total - (tx.dpPaid || 0)),
    });
    openWhatsAppChat(tx.no_whatsapp, msg);
  };

  // Export PO Reports
  const handleExportCSV = () => {
    const headers = [
      'No. PO',
      'Tanggal Acara',
      'Jam Siap',
      'Nama Pemesan',
      'No WhatsApp',
      'Jenis Acara',
      'Porsi/Tamu',
      'Layanan',
      'Status PO',
      'Total Nilai',
      'DP Diterima',
      'Sisa Tagihan',
      'Status Bayar',
    ];

    const rows = filteredPOs.map((tx) => [
      `"${tx.poNumber || tx.id_transaksi}"`,
      `"${tx.eventDate || tx.tanggal}"`,
      `"${tx.eventTime || tx.jam}"`,
      `"${tx.nama_pelanggan}"`,
      `"${tx.no_whatsapp}"`,
      `"${tx.eventType || 'Acara'}"`,
      tx.guestCount || 0,
      `"${tx.deliveryType === 'DELIVERY_DQM' ? 'Delivery DQM' : 'Bungkus'}"`,
      `"${getPOStatusLabel(tx.poStatus || tx.status)}"`,
      tx.total,
      tx.dpPaid || 0,
      tx.remainingPayment ?? (tx.total - (tx.dpPaid || 0)),
      `"${tx.paymentStatus || 'BELUM_BAYAR'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_PO_WarungBangKobra_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showToast) showToast('Laporan PO berhasil diekspor ke format CSV!', 'success');
  };

  // Financial Stats
  const stats = useMemo(() => {
    let totalOmzet = 0;
    let totalDP = 0;
    let totalSisa = 0;
    let countActive = 0;
    let countDone = 0;
    let countCanceled = 0;

    allPOTransactions.forEach((tx) => {
      const st = normalizePOStatus(tx.poStatus || tx.status);
      if (st === 'DIBATALKAN') {
        countCanceled++;
        return;
      }
      totalOmzet += tx.total;
      totalDP += tx.dpPaid || 0;
      totalSisa += tx.remainingPayment ?? (tx.total - (tx.dpPaid || 0));

      if (st === 'SELESAI') {
        countDone++;
      } else {
        countActive++;
      }
    });

    return {
      totalOmzet,
      totalDP,
      totalSisa,
      countActive,
      countDone,
      countCanceled,
      totalOrders: allPOTransactions.length,
    };
  }, [allPOTransactions]);

  // Calendar Days calculation
  const calendarDays = useMemo(() => {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNum: number; dateStr: string; isCurrentMonth: boolean; pos: Transaction[] }> = [];

    // Prev month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({ dayNum: dNum, dateStr: dStr, isCurrentMonth: false, pos: [] });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const matched = allPOTransactions.filter((tx) => (tx.eventDate || tx.tanggal) === dStr);
      days.push({ dayNum: i, dateStr: dStr, isCurrentMonth: true, pos: matched });
    }

    return days;
  }, [calendarCurrentDate, allPOTransactions]);

  return (
    <div className="space-y-5 pb-16">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 border border-stone-800 rounded-3xl p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-red-900/40">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  Pre-Order (PO) Acara
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-black">
                  PESANAN BESAR
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Kelola pesanan katering pengajian, rapat, hajatan, ulang tahun, dan santri DQM
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-create-po-cashier"
              onClick={onOpenCreatePOModal}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Buat Pre-Order Baru</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="py-2.5 px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-stone-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-stone-800/80">
          <button
            type="button"
            onClick={() => setTabMode('list')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              tabMode === 'list'
                ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
                : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Daftar Pesanan ({allPOTransactions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTabMode('calendar')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              tabMode === 'calendar'
                ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
                : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Kalender Jadwal</span>
          </button>

          <button
            type="button"
            onClick={() => setTabMode('reports')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              tabMode === 'reports'
                ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
                : 'bg-stone-900/80 text-stone-400 hover:text-white hover:bg-stone-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Laporan & Statistik</span>
          </button>
        </div>
      </div>

      {/* TOP NOTICES: SCHEDULE & STOCK WARNINGS */}
      {(nearSchedulePOs.length > 0 || stockWarnings.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Near Schedule Alert */}
          {nearSchedulePOs.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-amber-300 text-xs uppercase tracking-wider">
                  ⚠️ {nearSchedulePOs.length} Pre-Order Siap Hari Ini / Besok!
                </h4>
                <p className="text-[11px] text-amber-200/80">
                  Segera siapkan bahan baku dan koordinasikan dengan tim dapur untuk jadwal terdekat:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {nearSchedulePOs.slice(0, 3).map((po) => (
                    <span
                      key={po.id_transaksi}
                      className="px-2 py-0.5 rounded-lg bg-stone-900/90 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-300"
                    >
                      {po.poNumber || po.id_transaksi} • {po.nama_pelanggan} ({po.eventTime} WIB)
                    </span>
                  ))}
                  {nearSchedulePOs.length > 3 && (
                    <span className="text-[10px] text-amber-400 self-center">
                      +{nearSchedulePOs.length - 3} lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stock Deficit Warning */}
          {stockWarnings.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-rose-300 text-xs uppercase tracking-wider">
                  🚨 Peringatan Kebutuhan Stok Kurang ({stockWarnings.length} Menu)
                </h4>
                <p className="text-[11px] text-rose-200/80">
                  Total kebutuhan Pre-Order aktif melebihi stok yang tersedia di warung:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {stockWarnings.slice(0, 3).map((stk, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-lg bg-stone-900/90 border border-rose-500/30 text-[10px] font-bold text-rose-300"
                    >
                      {stk.name} (Kurang {stk.deficit})
                    </span>
                  ))}
                  {stockWarnings.length > 3 && (
                    <span className="text-[10px] text-rose-400 self-center">
                      +{stockWarnings.length - 3} lainnya
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 1: LIST / CARDS */}
      {tabMode === 'list' && (
        <div className="space-y-4">
          {/* Status Pills Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'ALL', label: 'Semua Status' },
              { id: 'MENUNGGU_KONFIRMASI', label: 'Menunggu Konfirmasi' },
              { id: 'MENUNGGU_DP', label: 'Menunggu DP' },
              { id: 'DP_DITERIMA', label: 'DP Diterima' },
              { id: 'DIPROSES', label: 'Sedang Dimasak' },
              { id: 'SIAP_DIAMBIL', label: 'Siap Diambil' },
              { id: 'DALAM_PENGIRIMAN', label: 'Pengiriman DQM' },
              { id: 'SELESAI', label: 'Selesai' },
              { id: 'DIBATALKAN', label: 'Dibatalkan' },
            ].map((st) => {
              const active = statusFilter === st.id;
              const count = countsByStatus[st.id] ?? 0;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition cursor-pointer border ${
                    active
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  <span>{st.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      active ? 'bg-black/30 text-white' : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Date Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-stone-900/60 border border-stone-800 rounded-2xl">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari No. PO, Nama Pemesan, WhatsApp..."
                className="w-full pl-10 pr-4 py-2 bg-stone-950 border border-stone-700 rounded-xl text-white placeholder-stone-500 text-xs focus:outline-none focus:border-red-500 transition"
              />
            </div>

            {/* Date Preset Selector */}
            <div className="sm:col-span-3">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white text-xs focus:outline-none focus:border-red-500 transition cursor-pointer"
              >
                <option value="all">🗓️ Semua Tanggal</option>
                <option value="today">⚡ Hari Ini</option>
                <option value="tomorrow">⏰ Besok</option>
                <option value="week">📅 7 Hari Ke Depan</option>
                <option value="month">📆 Bulan Ini</option>
                <option value="custom">🔍 Rentang Tanggal</option>
              </select>
            </div>

            {/* Delivery Type Selector */}
            <div className="sm:col-span-3">
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value as any)}
                className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white text-xs focus:outline-none focus:border-red-500 transition cursor-pointer"
              >
                <option value="ALL">🛵 Semua Layanan</option>
                <option value="BUNGKUS">🥡 Bungkus (Takeaway)</option>
                <option value="DELIVERY_DQM">🛵 Delivery Khusus DQM</option>
              </select>
            </div>

            {/* Custom Date Range Picker */}
            {dateFilter === 'custom' && (
              <div className="sm:col-span-12 flex flex-wrap items-center gap-2 pt-2 border-t border-stone-800">
                <span className="text-xs text-stone-400">Dari:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="py-1 px-2.5 bg-stone-950 border border-stone-700 rounded-lg text-white text-xs"
                />
                <span className="text-xs text-stone-400">Sampai:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="py-1 px-2.5 bg-stone-950 border border-stone-700 rounded-lg text-white text-xs"
                />
              </div>
            )}
          </div>

          {/* ORDERS LIST */}
          {filteredPOs.length === 0 ? (
            <div className="py-16 text-center bg-stone-950 border border-stone-800/80 rounded-3xl space-y-3">
              <div className="w-16 h-16 rounded-full bg-stone-900 flex items-center justify-center mx-auto text-stone-600">
                <CalendarIcon className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-stone-300 text-sm">Tidak Ada Pre-Order yang Cocok</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Ubah kata kunci pencarian atau filter status untuk menemukan data pesanan lain.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredPOs.map((po) => {
                const normStatus = normalizePOStatus(po.poStatus || po.status);
                const badge = getPOStatusBadge(normStatus);
                const isDelivery = po.deliveryType === 'DELIVERY_DQM';
                const rem = po.remainingPayment ?? (po.total - (po.dpPaid || 0));
                const isPaidFull = rem <= 0;

                return (
                  <div
                    key={po.id_transaksi}
                    className="p-5 bg-stone-900/90 border border-stone-800 hover:border-stone-700 rounded-3xl shadow-xl space-y-4 transition flex flex-col justify-between"
                  >
                    {/* Header Card */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-amber-400">
                              {po.poNumber || po.id_transaksi}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-stone-800 text-[10px] font-bold text-stone-300">
                              {po.eventType || 'Acara'}
                            </span>
                          </div>
                          <h3 className="font-black text-white text-base mt-1">
                            {po.nama_pelanggan}
                          </h3>
                          <p className="text-xs text-stone-400 font-mono">
                            WA: {po.no_whatsapp}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 ${badge.bg} ${badge.text} ${badge.border}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>{getPOStatusLabel(normStatus)}</span>
                        </div>
                      </div>

                      {/* Event Details Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-stone-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Jadwal Siap
                          </span>
                          <p className="font-bold text-white">
                            {po.eventDate || po.tanggal}
                          </p>
                          <p className="text-amber-400 text-[11px] font-semibold">
                            ⏰ {po.eventTime || po.jam} WIB
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-stone-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-teal-400" />
                            Layanan
                          </span>
                          <p className="font-bold text-white">
                            {isDelivery ? '🛵 Delivery DQM' : '🥡 Ambil di Warung'}
                          </p>
                          <p className="text-stone-400 text-[10px] truncate">
                            {po.eventLocation || (isDelivery ? 'Pesantren DQM' : 'Warung Bang Kobra')}
                          </p>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="p-3 rounded-xl bg-stone-950/50 border border-stone-800/60 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-stone-400">
                          <span>Daftar Menu ({po.items.reduce((s, it) => s + it.qty, 0)} Porsi)</span>
                          {po.guestCount && (
                            <span className="text-amber-400 font-normal">±{po.guestCount} Tamu</span>
                          )}
                        </div>
                        <div className="divide-y divide-stone-800/40 text-xs">
                          {po.items.map((it, idx) => (
                            <div key={idx} className="py-1 flex items-center justify-between text-stone-300">
                              <span className="truncate pr-2">
                                • {it.nama_produk} x{it.qty}
                              </span>
                              <span className="font-mono text-stone-400 text-[11px]">
                                {formatRupiah(it.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {po.notes && (
                          <p className="text-[11px] text-amber-400/90 italic pt-1 border-t border-stone-800/40">
                            Catatan: "{po.notes}"
                          </p>
                        )}
                      </div>

                      {/* Financial Breakdown */}
                      <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5 text-xs">
                        <div className="flex justify-between font-black text-sm text-white">
                          <span>TOTAL PO:</span>
                          <span className="text-amber-400 font-mono">{formatRupiah(po.total)}</span>
                        </div>
                        <div className="flex justify-between text-stone-400 text-[11px]">
                          <span>Kewajiban DP:</span>
                          <span>{formatRupiah(po.dpRequired || 0)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-400 font-bold text-[11px]">
                          <span>DP Terverifikasi:</span>
                          <span>{formatRupiah(po.dpPaid || 0)}</span>
                        </div>
                        <div className="flex justify-between text-amber-300 font-black text-xs pt-1 border-t border-stone-800">
                          <span>Sisa Pembayaran:</span>
                          <span className={isPaidFull ? 'text-emerald-400' : 'text-amber-400'}>
                            {isPaidFull ? 'LUNAS (Rp 0)' : formatRupiah(rem)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="space-y-2 pt-3 border-t border-stone-800">
                      {/* Workflow Primary Actions */}
                      <div className="flex flex-wrap gap-1.5">
                        {normStatus === 'MENUNGGU_KONFIRMASI' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(po, 'DIKONFIRMASI')}
                            className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Terima & Konfirmasi</span>
                          </button>
                        )}

                        {(normStatus === 'MENUNGGU_KONFIRMASI' || normStatus === 'DIKONFIRMASI' || normStatus === 'MENUNGGU_DP') && (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(po)}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Verifikasi DP</span>
                          </button>
                        )}

                        {normStatus === 'DP_DITERIMA' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(po, 'DIPROSES')}
                            className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>Mulai Masak / Proses</span>
                          </button>
                        )}

                        {normStatus === 'DIPROSES' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(po, isDelivery ? 'DALAM_PENGIRIMAN' : 'SIAP_DIAMBIL')}
                            className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            {isDelivery ? <Truck className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                            <span>{isDelivery ? 'Mulai Antar DQM' : 'Siap Diambil'}</span>
                          </button>
                        )}

                        {(normStatus === 'SIAP_DIAMBIL' || normStatus === 'DALAM_PENGIRIMAN') && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!isPaidFull) {
                                handleOpenPaymentModal(po);
                              } else {
                                handleUpdateStatus(po, 'SELESAI');
                              }
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isPaidFull ? 'Selesaikan PO' : 'Pelunasan & Selesai'}</span>
                          </button>
                        )}
                      </div>

                      {/* Secondary Auxiliary Controls */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppCustomer(po)}
                          className="py-1.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-emerald-400 font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Hubungi Pelanggan via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WA</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onPrintReceipt(po)}
                          className="py-1.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Cetak Struk Pre-Order"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Struk</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(po)}
                          className="py-1.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Edit Informasi PO"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {normStatus !== 'SELESAI' && normStatus !== 'DIBATALKAN' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPoForCancel(po);
                              setCancelReason('');
                            }}
                            className="py-1.5 px-2 rounded-xl bg-stone-800 hover:bg-rose-950/60 text-rose-400 font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Tolak / Batalkan PO"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Batal</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: INTERACTIVE CALENDAR */}
      {tabMode === 'calendar' && (
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-2xl space-y-5">
          {/* Calendar Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-white">
                {calendarCurrentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(calendarCurrentDate);
                  d.setMonth(d.getMonth() - 1);
                  setCalendarCurrentDate(d);
                }}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarCurrentDate(new Date())}
                className="py-1.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(calendarCurrentDate);
                  d.setMonth(d.getMonth() + 1);
                  setCalendarCurrentDate(d);
                }}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="border border-stone-800 rounded-2xl overflow-hidden">
            {/* Days of Week */}
            <div className="grid grid-cols-7 bg-stone-950 text-center py-2.5 text-xs font-bold text-stone-400 border-b border-stone-800">
              <span>Min</span>
              <span>Sen</span>
              <span>Sel</span>
              <span>Rab</span>
              <span>Kam</span>
              <span>Jum</span>
              <span>Sab</span>
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 divide-x divide-y divide-stone-800/80 bg-stone-900/60">
              {calendarDays.map((cd, idx) => {
                const isToday = cd.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    className={`min-h-[110px] p-2 flex flex-col justify-between transition ${
                      !cd.isCurrentMonth
                        ? 'opacity-30 bg-stone-950/40'
                        : isToday
                        ? 'bg-red-950/20'
                        : 'hover:bg-stone-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isToday ? 'bg-red-600 text-white font-black' : 'text-stone-300'
                        }`}
                      >
                        {cd.dayNum}
                      </span>
                      {cd.pos.length > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400">
                          {cd.pos.length} PO
                        </span>
                      )}
                    </div>

                    {/* PO Events on that day */}
                    <div className="space-y-1 mt-1 overflow-y-auto max-h-[85px]">
                      {cd.pos.map((p) => {
                        const norm = normalizePOStatus(p.poStatus || p.status);
                        const b = getPOStatusBadge(norm);
                        return (
                          <div
                            key={p.id_transaksi}
                            onClick={() => setSelectedPOForDetail(p)}
                            className={`p-1.5 rounded-lg border text-[10px] cursor-pointer truncate ${b.bg} ${b.border} ${b.text}`}
                            title={`${p.nama_pelanggan} - ${p.eventType} (${p.eventTime} WIB)`}
                          >
                            <span className="font-black">{p.eventTime}</span> {p.nama_pelanggan}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: REPORTS & STATS */}
      {tabMode === 'reports' && (
        <div className="space-y-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl space-y-1">
              <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">
                Total Omzet PO
              </span>
              <p className="text-xl font-black text-amber-400 font-mono">
                {formatRupiah(stats.totalOmzet)}
              </p>
              <p className="text-[10px] text-stone-500">Dari seluruh pesanan PO aktif</p>
            </div>

            <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl space-y-1">
              <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">
                DP Terverifikasi
              </span>
              <p className="text-xl font-black text-emerald-400 font-mono">
                {formatRupiah(stats.totalDP)}
              </p>
              <p className="text-[10px] text-stone-500">Uang muka yang sudah masuk kas</p>
            </div>

            <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl space-y-1">
              <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">
                Sisa Tagihan PO
              </span>
              <p className="text-xl font-black text-sky-400 font-mono">
                {formatRupiah(stats.totalSisa)}
              </p>
              <p className="text-[10px] text-stone-500">Sisa yang harus dilunasi</p>
            </div>

            <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl space-y-1">
              <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">
                Status Pesanan
              </span>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold">
                  {stats.countActive} Aktif
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                  {stats.countDone} Selesai
                </span>
              </div>
              <p className="text-[10px] text-rose-400 pt-0.5">{stats.countCanceled} Dibatalkan</p>
            </div>
          </div>

          {/* Breakdown by Event Types */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Rekapitulasi Kategori Acara
            </h3>
            <div className="divide-y divide-stone-800/80">
              {Object.entries(
                allPOTransactions.reduce((acc, tx) => {
                  const ev = tx.eventType || 'Lainnya';
                  acc[ev] = (acc[ev] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([evType, count]) => (
                <div key={evType} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-300">{evType}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-white">{count} Acara</span>
                    <span className="text-stone-500 text-[11px]">
                      ({Math.round((count / (allPOTransactions.length || 1)) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: PAYMENT / DP CONFIRMATION --- */}
      {poForPayment && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    Konfirmasi Pembayaran PO
                  </h3>
                  <p className="text-xs text-stone-400 font-mono">
                    {poForPayment.poNumber || poForPayment.id_transaksi} • {poForPayment.nama_pelanggan}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPoForPayment(null)}
                className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-5 space-y-4 text-xs">
              {/* Summary details */}
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="flex justify-between text-stone-300">
                  <span>Total Nilai PO:</span>
                  <span className="font-bold text-white font-mono">{formatRupiah(poForPayment.total)}</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span>Kewajiban DP:</span>
                  <span className="font-mono">{formatRupiah(poForPayment.dpRequired || 0)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Sudah Dibayar:</span>
                  <span className="font-mono">{formatRupiah(poForPayment.dpPaid || 0)}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-black text-sm pt-1.5 border-t border-stone-800">
                  <span>Sisa Pembayaran:</span>
                  <span className="font-mono">
                    {formatRupiah(poForPayment.remainingPayment ?? (poForPayment.total - (poForPayment.dpPaid || 0)))}
                  </span>
                </div>
              </div>

              {/* Uploaded proof if customer uploaded one */}
              {poForPayment.dpProofUrl && (
                <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                  <span className="font-bold text-stone-300 text-[11px] block">
                    Bukti Transfer yang Diunggah Pelanggan:
                  </span>
                  <img
                    src={poForPayment.dpProofUrl}
                    alt="Bukti Transfer"
                    className="max-h-48 w-auto rounded-xl border border-stone-700 object-contain mx-auto"
                  />
                </div>
              )}

              {/* Input payment amount */}
              <div className="space-y-1.5">
                <label className="block font-bold text-stone-300 uppercase tracking-wider text-[11px]">
                  Nominal yang Diterima (Rp) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={poForPayment.total}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                  required
                  placeholder="Masukkan jumlah pembayaran..."
                  className="w-full py-2.5 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="block font-bold text-stone-300 uppercase tracking-wider text-[11px]">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Cash', 'Transfer', 'QRIS', 'E-wallet'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 px-2 rounded-xl text-center font-bold text-xs border transition cursor-pointer ${
                        paymentMethod === m
                          ? 'bg-amber-600 border-amber-500 text-white'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="block font-bold text-stone-300 uppercase tracking-wider text-[11px]">
                  Catatan / Keterangan Kasir (Opsional)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Contoh: DP 50% via BCA a/n Budi..."
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white text-xs"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPoForPayment(null)}
                  className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                >
                  {isProcessingPayment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Simpan & Verifikasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT PRE-ORDER --- */}
      {poForEdit && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-stone-800 flex items-center justify-between bg-stone-950">
              <h3 className="font-black text-white text-base">
                Edit Pre-Order: {poForEdit.poNumber || poForEdit.id_transaksi}
              </h3>
              <button
                type="button"
                onClick={() => setPoForEdit(null)}
                className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block font-bold text-stone-300 mb-1">Nama Pemesan *</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  required
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-300 mb-1">Nomor WhatsApp *</label>
                <input
                  type="tel"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  required
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-300 mb-1">Tanggal Acara *</label>
                  <input
                    type="date"
                    value={editEventDate}
                    onChange={(e) => setEditEventDate(e.target.value)}
                    required
                    className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-300 mb-1">Jam Siap *</label>
                  <input
                    type="time"
                    value={editEventTime}
                    onChange={(e) => setEditEventTime(e.target.value)}
                    required
                    className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-300 mb-1">Jenis Acara</label>
                <input
                  type="text"
                  value={editEventType}
                  onChange={(e) => setEditEventType(e.target.value)}
                  placeholder="Pengajian, Rapat, Ulang Tahun..."
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-300 mb-1">Layanan Pengambilan</label>
                <select
                  value={editDeliveryType}
                  onChange={(e) => setEditDeliveryType(e.target.value as any)}
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white cursor-pointer"
                >
                  <option value="BUNGKUS">🥡 Bungkus (Ambil di Warung)</option>
                  <option value="DELIVERY_DQM">🛵 Delivery Khusus Area Pesantren DQM</option>
                </select>
              </div>

              {editDeliveryType === 'DELIVERY_DQM' && (
                <div>
                  <label className="block font-bold text-stone-300 mb-1">Lokasi di Pesantren DQM</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Gedung / Asrama / Ruang..."
                    className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-stone-300 mb-1">Catatan Khusus</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPoForEdit(null)}
                  className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="py-2.5 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-2 cursor-pointer"
                >
                  {isSubmittingEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CANCEL PO --- */}
      {poForCancel && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">Batalkan Pre-Order?</h3>
                <p className="text-xs text-stone-400 font-mono">
                  {poForCancel.poNumber || poForCancel.id_transaksi}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-300">
              Apakah Anda yakin ingin membatalkan pesanan Pre-Order atas nama{' '}
              <strong>{poForCancel.nama_pelanggan}</strong>?{' '}
              {poForCancel.poStockDeducted && (
                <span className="text-amber-400 block mt-1">
                  * Stok bahan yang sebelumnya sudah dipotong akan secara otomatis dikembalikan ke inventaris warung.
                </span>
              )}
            </p>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                Alasan Pembatalan (Opsional):
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Pelanggan membatalkan acara..."
                className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-xl text-white text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPoForCancel(null)}
                className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelPO}
                disabled={isProcessingCancel}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessingCancel ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Ya, Batalkan PO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
