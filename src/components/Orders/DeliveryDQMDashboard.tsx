import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  MapPin,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Navigation,
  MessageCircle,
  Eye,
  User,
  FileText,
  Camera,
  Upload,
  Calendar,
  History,
  ShieldCheck,
  Printer,
  Download,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  Transaction,
  DeliveryStatus,
  DeliveryProof,
  StoreSettings,
  UserRole,
} from '../../types';
import {
  formatRupiah,
  resolveOrderType,
  normalizeDeliveryStatus,
  getDeliveryStatusLabel,
  getTakeawayQueueNumber,
  openWhatsAppChat,
  buildDeliveryProofShareUrl,
  buildDeliveryProofWhatsAppMessage,
  DELIVERY_MIN_ORDER_AMOUNT,
} from '../../utils/formatters';
import { normalizeRole } from '../../utils/rbac';
import {
  subscribeToFirebaseDeliveryProofs,
  saveDeliveryProofToFirebase,
} from '../../services/firebase';
import { StorageService } from '../../services/storage';
import { DeliveryProofModal } from './DeliveryProofModal';

interface DeliveryDQMDashboardProps {
  transactions: Transaction[];
  settings: StoreSettings;
  userRole?: UserRole;
  currentUserName?: string;
  onUpdateDeliveryStatus: (
    txId: string,
    newDeliveryStatus: DeliveryStatus,
    mappedOrderStatus: Transaction['status'],
    updatedTx?: Transaction
  ) => void;
  onViewReceipt?: (tx: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type FilterStatus = 'ALL' | 'MENUNGGU' | 'DIANTAR' | 'SAMPAI' | 'DITERIMA' | 'GAGAL DIANTAR';

export const DeliveryDQMDashboard: React.FC<DeliveryDQMDashboardProps> = ({
  transactions,
  settings,
  userRole = 'Kasir',
  currentUserName = 'Petugas Delivery DQM',
  onUpdateDeliveryStatus,
  onViewReceipt,
  showToast,
}) => {
  const [viewTab, setViewTab] = useState<'active' | 'history'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterCourier, setFilterCourier] = useState<string>('ALL');

  // Real-time Delivery Proofs from Firestore `delivery_proofs`
  const [proofs, setProofs] = useState<DeliveryProof[]>(() =>
    StorageService.getDeliveryProofs()
  );

  // Selected Order for Proof Modal
  const [proofModalState, setProofModalState] = useState<{
    isOpen: boolean;
    tx: Transaction;
    mode: 'form' | 'view';
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeToFirebaseDeliveryProofs((remoteProofs) => {
      if (remoteProofs.length > 0) {
        setProofs(remoteProofs);
        StorageService.saveDeliveryProofs(remoteProofs);
      }
    });
    return () => unsub();
  }, []);

  const canModifyDelivery = [
    'Owner',
    'Admin',
    'Kasir',
    'Staff',
    'Delivery',
    'ADMIN',
    'KASIR',
    'DELIVERY',
  ].includes(String(userRole));

  const isDeliveryStaff = normalizeRole(userRole) === 'Delivery';

  // Map proof by orderId for fast lookup
  const proofByOrderId = useMemo(() => {
    const map = new Map<string, DeliveryProof>();
    proofs.forEach((p) => {
      if (p.orderId) map.set(p.orderId, p);
    });
    return map;
  }, [proofs]);

  // Filter strictly DELIVERY_DQM orders and merge with delivery_proofs data
  const deliveryOrders = useMemo(() => {
    return transactions
      .filter((tx) => resolveOrderType(tx) === 'DELIVERY_DQM')
      .map((tx) => {
        const prf = proofByOrderId.get(tx.id_transaksi);
        if (!prf) return tx;
        return {
          ...tx,
          deliveryId: prf.deliveryId || tx.deliveryId,
          deliveryStatus: normalizeDeliveryStatus(prf.status || prf.deliveryStatus || tx.deliveryStatus),
          courierName: prf.courierName || tx.courierName,
          receiverName: prf.receiverName || tx.receiverName,
          receiverPhone: prf.receiverPhone || tx.receiverPhone,
          proofPhotoUrl: prf.proofPhotoUrl || tx.proofPhotoUrl,
          deliveryNote: prf.deliveryNote || tx.deliveryNote,
          sentAt: prf.sentAt || tx.sentAt,
          deliveredAt: prf.deliveredAt || tx.deliveredAt,
        };
      });
  }, [transactions, proofByOrderId]);

  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 12. DASHBOARD STATISTIK REAL-TIME
  const stats = useMemo(() => {
    let todayTotal = 0;
    let menunggu = 0;
    let diantar = 0;
    let sampai = 0;
    let diterima = 0;
    let gagal = 0;

    deliveryOrders.forEach((tx) => {
      const txDate = tx.tanggal || (tx.created_at ? tx.created_at.slice(0, 10) : '');
      if (txDate === todayDateStr) {
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
      all: deliveryOrders.length,
      todayTotal,
      MENUNGGU: menunggu,
      DIANTAR: diantar,
      SAMPAI: sampai,
      DITERIMA: diterima,
      'GAGAL DIANTAR': gagal,
    };
  }, [deliveryOrders, todayDateStr]);

  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>();
    deliveryOrders.forEach((tx) => {
      if (tx.deliveryLocation && tx.deliveryLocation.trim() !== '') {
        locs.add(tx.deliveryLocation.trim());
      }
    });
    return Array.from(locs);
  }, [deliveryOrders]);

  const uniqueCouriers = useMemo(() => {
    const couriers = new Set<string>();
    deliveryOrders.forEach((tx) => {
      if (tx.courierName && tx.courierName.trim() !== '') {
        couriers.add(tx.courierName.trim());
      }
    });
    proofs.forEach((p) => {
      if (p.courierName && p.courierName.trim() !== '') {
        couriers.add(p.courierName.trim());
      }
    });
    return Array.from(couriers);
  }, [deliveryOrders, proofs]);

  const filteredOrders = useMemo(() => {
    return deliveryOrders.filter((tx) => {
      const dStatus = normalizeDeliveryStatus(tx);

      if (filterStatus !== 'ALL' && dStatus !== filterStatus) return false;
      if (filterLocation !== 'ALL' && (tx.deliveryLocation || '') !== filterLocation) {
        return false;
      }
      if (filterDate && tx.tanggal !== filterDate) {
        return false;
      }
      if (
        filterCourier !== 'ALL' &&
        (tx.courierName || '').toLowerCase() !== filterCourier.toLowerCase()
      ) {
        return false;
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchId = tx.id_transaksi.toLowerCase().includes(q);
        const matchName = (tx.nama_pelanggan || '').toLowerCase().includes(q);
        const matchReceiver = (tx.receiverName || '').toLowerCase().includes(q);
        const matchCourier = (tx.courierName || '').toLowerCase().includes(q);
        const matchLoc = (tx.deliveryLocation || '').toLowerCase().includes(q);
        const matchDet = (tx.deliveryDetail || '').toLowerCase().includes(q);
        const matchAddr = (tx.alamat_pengantaran || '').toLowerCase().includes(q);
        return (
          matchId ||
          matchName ||
          matchReceiver ||
          matchCourier ||
          matchLoc ||
          matchDet ||
          matchAddr
        );
      }
      return true;
    });
  }, [
    deliveryOrders,
    filterStatus,
    filterLocation,
    filterDate,
    filterCourier,
    searchQuery,
  ]);

  const handleChangeStatus = async (tx: Transaction, nextDeliveryStatus: DeliveryStatus) => {
    if (!canModifyDelivery) return;

    let mappedOrderStatus: Transaction['status'] = 'DIPROSES';
    if (nextDeliveryStatus === 'MENUNGGU') mappedOrderStatus = 'MENUNGGU';
    else if (nextDeliveryStatus === 'DIANTAR') mappedOrderStatus = 'DIPROSES';
    else if (nextDeliveryStatus === 'SAMPAI') mappedOrderStatus = 'SIAP';
    else if (nextDeliveryStatus === 'DITERIMA') mappedOrderStatus = 'SELESAI';
    else if (nextDeliveryStatus === 'GAGAL DIANTAR') mappedOrderStatus = 'DIBATALKAN';

    const nowIso = new Date().toISOString();
    const existingProof = proofByOrderId.get(tx.id_transaksi);
    const activeCourier =
      tx.courierName ||
      existingProof?.courierName ||
      currentUserName ||
      settings.activeCashier ||
      'Kurir Warung Bang Kobra';

    const detailLoc = [tx.deliveryLocation || 'Area DQM', tx.deliveryDetail || '']
      .filter(Boolean)
      .join(' - ');

    const updatedProof: DeliveryProof = {
      deliveryId: existingProof?.deliveryId || tx.deliveryId || `DLV-${tx.id_transaksi}`,
      orderId: tx.id_transaksi,
      orderNumber: tx.id_transaksi,
      customerId: existingProof?.customerId || '',
      customerName: tx.nama_pelanggan || 'Pelanggan DQM',
      customerPhone: tx.no_whatsapp || '',
      destination: 'DQM',
      detailLocation: existingProof?.detailLocation || detailLoc || 'Pesantren DQM',
      courierId: existingProof?.courierId || '',
      courierName: activeCourier,
      receiverName:
        existingProof?.receiverName || tx.receiverName || tx.nama_pelanggan || 'Penerima',
      receiverPhone:
        existingProof?.receiverPhone || tx.receiverPhone || tx.no_whatsapp || '',
      status: nextDeliveryStatus,
      deliveryStatus: nextDeliveryStatus,
      proofPhotoUrl: existingProof?.proofPhotoUrl || tx.proofPhotoUrl || '',
      deliveryNote:
        existingProof?.deliveryNote ||
        tx.deliveryNote ||
        tx.catatan_pesanan ||
        'Pesanan telah diterima dengan baik.',
      sentAt:
        nextDeliveryStatus === 'DIANTAR'
          ? nowIso
          : existingProof?.sentAt || tx.sentAt || nowIso,
      deliveredAt:
        nextDeliveryStatus === 'DITERIMA'
          ? nowIso
          : existingProof?.deliveredAt || tx.deliveredAt || '',
      createdAt: existingProof?.createdAt || tx.created_at || nowIso,
      updatedAt: nowIso,
    };

    const updatedTx: Transaction = {
      ...tx,
      status: mappedOrderStatus,
      deliveryStatus: nextDeliveryStatus,
      deliveryId: updatedProof.deliveryId,
      courierName: updatedProof.courierName,
      receiverName: updatedProof.receiverName,
      receiverPhone: updatedProof.receiverPhone,
      proofPhotoUrl: updatedProof.proofPhotoUrl,
      sentAt: updatedProof.sentAt,
      deliveredAt: updatedProof.deliveredAt,
      updated_at: nowIso,
    };

    const newProofs = StorageService.upsertDeliveryProof(updatedProof);
    setProofs(newProofs);
    onUpdateDeliveryStatus(tx.id_transaksi, nextDeliveryStatus, mappedOrderStatus, updatedTx);
    await saveDeliveryProofToFirebase(updatedProof, activeCourier);

    if (showToast) {
      showToast(
        `Status Delivery DQM #${tx.id_transaksi} diperbarui ke ${nextDeliveryStatus}`,
        'success'
      );
    }

    // If SAMPAI or DITERIMA is clicked and no proof photo yet, open Proof Modal so courier can snap photo/receiver name easily
    if (
      (nextDeliveryStatus === 'SAMPAI' || nextDeliveryStatus === 'DITERIMA') &&
      !updatedProof.proofPhotoUrl
    ) {
      setProofModalState({
        isOpen: true,
        tx: updatedTx,
        mode: 'form',
      });
    }
  };

  // Section 8: Share Proof to WhatsApp with official message template
  const handleSendProofWhatsApp = (tx: Transaction) => {
    const prf = proofByOrderId.get(tx.id_transaksi);
    const dStatus = normalizeDeliveryStatus(prf?.status || tx.deliveryStatus);
    const receiver =
      prf?.receiverName || tx.receiverName || tx.nama_pelanggan || 'Penerima';
    const rawTime = prf?.deliveredAt || tx.deliveredAt || new Date().toISOString();
    let formattedTime = rawTime;
    try {
      const d = new Date(rawTime);
      if (!isNaN(d.getTime())) {
        formattedTime = d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' WIB';
      }
    } catch {
      // fallback
    }

    const proofLink = buildDeliveryProofShareUrl(tx.id_transaksi);
    const message = buildDeliveryProofWhatsAppMessage({
      orderNumber: tx.id_transaksi,
      status: getDeliveryStatusLabel(dStatus),
      receiverName: receiver,
      deliveredAt: formattedTime,
      proofLink,
    });

    const targetPhone = prf?.receiverPhone || tx.receiverPhone || tx.no_whatsapp;
    if (!targetPhone) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(message);
      }
      if (showToast) {
        showToast(
          'Pesan Bukti Pengantaran disalin! Isi nomor WhatsApp penerima untuk mengirim langsung.',
          'info'
        );
      }
      return;
    }

    openWhatsAppChat(targetPhone, message);
  };

  const getStatusBadgeStyle = (dStatus: DeliveryStatus) => {
    switch (dStatus) {
      case 'MENUNGGU':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'DIANTAR':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'SAMPAI':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'DITERIMA':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'GAGAL DIANTAR':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-stone-800 text-stone-300 border-stone-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-5">
      {/* Top Banner Header (Red / Black / White / Orange Warung Bang Kobra Theme) */}
      <div className="bg-gradient-to-r from-red-950/90 via-stone-900 to-stone-900 border-2 border-red-600/40 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-600/25 border border-orange-500/50 flex items-center justify-center text-orange-400 shrink-0 shadow-lg">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                DELIVERY DQM &amp; BUKTI PENGANTARAN
              </h2>
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black bg-orange-500 text-stone-950">
                TUJUAN KHUSUS AREA DQM
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono tabular-nums">
                MINIMAL BELANJA: {formatRupiah(DELIVERY_MIN_ORDER_AMOUNT)}
              </span>
              {isDeliveryStaff && (
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  MODE PETUGAS KURIR
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-stone-300 mt-0.5">
              PESANAN MASUK → DELIVERY DQM → DIANTAR → SAMPAI → FOTO BUKTI &amp; PENERIMA → ✓ DITERIMA → BUKTI DIGITAL WA
            </p>
          </div>
        </div>

        {/* View Switcher: Antrian Operasional vs Riwayat Delivery DQM */}
        <div className="flex items-center gap-2 bg-stone-950 p-1.5 rounded-2xl border border-stone-800 shrink-0">
          <button
            type="button"
            onClick={() => setViewTab('active')}
            className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              viewTab === 'active'
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Operasional Delivery</span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab('history')}
            className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              viewTab === 'history'
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Delivery DQM</span>
          </button>
        </div>
      </div>

      {/* 12. DASHBOARD REAL-TIME STATISTICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setFilterStatus('ALL');
            setFilterDate(filterDate === todayDateStr ? '' : todayDateStr);
          }}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            filterDate === todayDateStr
              ? 'bg-red-600 text-white border-orange-400 shadow-lg'
              : 'bg-stone-900 border-stone-800 hover:border-red-500/40'
          }`}
        >
          <div className="text-[10px] font-black uppercase tracking-wider text-orange-400">
            REALTIME HARI INI
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-white mt-0.5">
            {stats.todayTotal}
          </div>
          <div className="text-xs font-bold text-stone-300 mt-0.5">Delivery Hari Ini</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'MENUNGGU' ? 'ALL' : 'MENUNGGU')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            filterStatus === 'MENUNGGU'
              ? 'bg-amber-500 text-stone-950 border-amber-300 shadow-lg'
              : 'bg-stone-900 border-stone-800 hover:border-amber-500/40'
          }`}
        >
          <div
            className={`text-[10px] font-black uppercase tracking-wider ${
              filterStatus === 'MENUNGGU' ? 'text-stone-950' : 'text-amber-400'
            }`}
          >
            MENUNGGU
          </div>
          <div
            className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${
              filterStatus === 'MENUNGGU' ? 'text-stone-950' : 'text-white'
            }`}
          >
            {stats.MENUNGGU}
          </div>
          <div
            className={`text-xs font-bold mt-0.5 ${
              filterStatus === 'MENUNGGU' ? 'text-stone-950' : 'text-stone-300'
            }`}
          >
            Menunggu
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'DIANTAR' ? 'ALL' : 'DIANTAR')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            filterStatus === 'DIANTAR'
              ? 'bg-orange-500 text-stone-950 border-orange-300 shadow-lg'
              : 'bg-stone-900 border-stone-800 hover:border-orange-500/40'
          }`}
        >
          <div
            className={`text-[10px] font-black uppercase tracking-wider ${
              filterStatus === 'DIANTAR' ? 'text-stone-950' : 'text-orange-400'
            }`}
          >
            DIANTAR
          </div>
          <div
            className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${
              filterStatus === 'DIANTAR' ? 'text-stone-950' : 'text-white'
            }`}
          >
            {stats.DIANTAR}
          </div>
          <div
            className={`text-xs font-bold mt-0.5 ${
              filterStatus === 'DIANTAR' ? 'text-stone-950' : 'text-stone-300'
            }`}
          >
            Sedang Diantar
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'SAMPAI' ? 'ALL' : 'SAMPAI')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            filterStatus === 'SAMPAI'
              ? 'bg-sky-500 text-stone-950 border-sky-300 shadow-lg'
              : 'bg-stone-900 border-stone-800 hover:border-sky-500/40'
          }`}
        >
          <div
            className={`text-[10px] font-black uppercase tracking-wider ${
              filterStatus === 'SAMPAI' ? 'text-stone-950' : 'text-sky-400'
            }`}
          >
            SAMPAI
          </div>
          <div
            className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${
              filterStatus === 'SAMPAI' ? 'text-stone-950' : 'text-white'
            }`}
          >
            {stats.SAMPAI}
          </div>
          <div
            className={`text-xs font-bold mt-0.5 ${
              filterStatus === 'SAMPAI' ? 'text-stone-950' : 'text-stone-300'
            }`}
          >
            Sudah Sampai
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'DITERIMA' ? 'ALL' : 'DITERIMA')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            filterStatus === 'DITERIMA'
              ? 'bg-emerald-500 text-stone-950 border-emerald-300 shadow-lg'
              : 'bg-stone-900 border-stone-800 hover:border-emerald-500/40'
          }`}
        >
          <div
            className={`text-[10px] font-black uppercase tracking-wider ${
              filterStatus === 'DITERIMA' ? 'text-stone-950' : 'text-emerald-400'
            }`}
          >
            ✓ DITERIMA
          </div>
          <div
            className={`text-2xl font-black font-mono tabular-nums mt-0.5 ${
              filterStatus === 'DITERIMA' ? 'text-stone-950' : 'text-white'
            }`}
          >
            {stats.DITERIMA}
          </div>
          <div
            className={`text-xs font-bold mt-0.5 ${
              filterStatus === 'DITERIMA' ? 'text-stone-950' : 'text-stone-300'
            }`}
          >
            Sudah Diterima
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setFilterStatus(filterStatus === 'GAGAL DIANTAR' ? 'ALL' : 'GAGAL DIANTAR')
          }
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            filterStatus === 'GAGAL DIANTAR'
              ? 'bg-rose-600 text-white border-rose-400 shadow-lg'
              : 'bg-stone-900 border-stone-800 hover:border-rose-500/40'
          }`}
        >
          <div
            className={`text-[10px] font-black uppercase tracking-wider ${
              filterStatus === 'GAGAL DIANTAR' ? 'text-white' : 'text-rose-400'
            }`}
          >
            GAGAL
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-white mt-0.5">
            {stats['GAGAL DIANTAR']}
          </div>
          <div
            className={`text-xs font-bold mt-0.5 ${
              filterStatus === 'GAGAL DIANTAR' ? 'text-white' : 'text-stone-300'
            }`}
          >
            Gagal Diantar
          </div>
        </button>
      </div>

      {/* Search & Filter Controls (Supports Order No, Customer, Date, Status, Courier, Location) */}
      <div className="bg-stone-900 border border-stone-800 p-3.5 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. Pesanan (WBK-...), Nama Customer, atau Penerima..."
              className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-200 focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">Semua Status ({stats.all})</option>
              <option value="MENUNGGU">MENUNGGU ({stats.MENUNGGU})</option>
              <option value="DIANTAR">DIANTAR ({stats.DIANTAR})</option>
              <option value="SAMPAI">SAMPAI ({stats.SAMPAI})</option>
              <option value="DITERIMA">✓ DITERIMA ({stats.DITERIMA})</option>
              <option value="GAGAL DIANTAR">GAGAL DIANTAR ({stats['GAGAL DIANTAR']})</option>
            </select>
          </div>

          {/* Filter Tanggal */}
          <div className="relative">
            <Calendar className="w-4 h-4 text-orange-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-stone-200 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Filter Petugas / Kurir & Lokasi */}
          <div className="flex gap-2">
            <select
              value={filterCourier}
              onChange={(e) => setFilterCourier(e.target.value)}
              className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-2.5 text-xs font-bold text-stone-200 focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">Semua Petugas</option>
              {uniqueCouriers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {(filterStatus !== 'ALL' ||
              filterDate !== '' ||
              filterCourier !== 'ALL' ||
              filterLocation !== 'ALL' ||
              searchQuery !== '') && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('ALL');
                  setFilterDate('');
                  setFilterCourier('ALL');
                  setFilterLocation('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold text-orange-400 cursor-pointer shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: RIWAYAT DELIVERY DQM TABLE/LIST (Section 11) */}
      {viewTab === 'history' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <History className="w-5 h-5 text-orange-400" />
                <span>RIWAYAT DELIVERY DQM &amp; ARSIP BUKTI PENGANTARAN</span>
              </h3>
              <p className="text-xs text-stone-400">
                Menampilkan {filteredOrders.length} catatan pengantaran area DQM yang tersimpan di Firebase.
              </p>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-12 text-center space-y-3">
              <History className="w-10 h-10 text-stone-500 mx-auto" />
              <h4 className="text-sm font-black text-stone-200">
                Tidak Ada Riwayat Delivery DQM yang Sesuai Filter
              </h4>
              <p className="text-xs text-stone-400">
                Ubah kata kunci pencarian atau reset filter untuk melihat seluruh riwayat pengantaran.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((tx) => {
                const dStatus = normalizeDeliveryStatus(tx);
                const prf = proofByOrderId.get(tx.id_transaksi);
                const photoUrl = prf?.proofPhotoUrl || tx.proofPhotoUrl || '';
                const courier =
                  prf?.courierName || tx.courierName || 'Petugas Delivery DQM';
                const receiver =
                  prf?.receiverName || tx.receiverName || tx.nama_pelanggan;
                const detailLoc =
                  prf?.detailLocation ||
                  [tx.deliveryLocation, tx.deliveryDetail].filter(Boolean).join(' - ') ||
                  tx.alamat_pengantaran ||
                  'Pesantren DQM';

                return (
                  <div
                    key={tx.id_transaksi}
                    className="bg-stone-900 border-2 border-stone-800 hover:border-orange-500/40 rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg transition"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      {/* Proof Photo Thumbnail */}
                      <div
                        onClick={() =>
                          setProofModalState({
                            isOpen: true,
                            tx,
                            mode: 'view',
                          })
                        }
                        className="w-20 h-20 rounded-2xl bg-stone-950 border border-stone-800 overflow-hidden shrink-0 flex flex-col items-center justify-center cursor-pointer group"
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={tx.id_transaksi}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        ) : (
                          <>
                            <Camera className="w-6 h-6 text-stone-500 group-hover:text-orange-400" />
                            <span className="text-[9px] font-bold text-stone-500 mt-1">
                              Belum Foto
                            </span>
                          </>
                        )}
                      </div>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs sm:text-sm font-black text-white">
                            {tx.id_transaksi}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-red-600/20 text-orange-300 border border-orange-500/30 text-[10px] font-black">
                            TUJUAN: DQM
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black border ${getStatusBadgeStyle(
                              dStatus
                            )}`}
                          >
                            {dStatus === 'DITERIMA' ? '✓ DITERIMA' : dStatus}
                          </span>
                        </div>

                        <div className="text-xs text-stone-200 font-bold">
                          Pemesan: <span className="text-white">{tx.nama_pelanggan}</span> •{' '}
                          Lokasi: <span className="text-orange-400">{detailLoc}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-400">
                          <span>
                            Kurir: <strong className="text-stone-200">{courier}</strong>
                          </span>
                          <span>
                            Penerima: <strong className="text-emerald-400">{receiver}</strong>
                          </span>
                          <span>
                            Waktu:{' '}
                            <strong className="text-stone-300">
                              {tx.tanggal} {tx.jam}
                            </strong>
                          </span>
                          <span>
                            Total:{' '}
                            <strong className="text-orange-400 font-mono">
                              {formatRupiah(tx.total)}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* History Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setProofModalState({
                            isOpen: true,
                            tx,
                            mode: 'view',
                          })
                        }
                        className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 text-white border border-stone-700 text-xs font-black transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-orange-400" />
                        <span>LIHAT BUKTI</span>
                      </button>

                      {canModifyDelivery && (
                        <button
                          type="button"
                          onClick={() =>
                            setProofModalState({
                              isOpen: true,
                              tx,
                              mode: 'form',
                            })
                          }
                          className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-orange-300 border border-orange-500/40 text-xs font-black transition cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>FOTO / STATUS</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSendProofWhatsApp(tx)}
                        className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>BAGIKAN WA</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: OPERASIONAL & ANTRIAN DELIVERY DQM CARDS */
        <>
          {filteredOrders.length === 0 ? (
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-stone-800 text-orange-400 flex items-center justify-center mx-auto">
                <Truck className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-stone-200">
                Belum Ada Pesanan Delivery DQM pada Filter Ini
              </h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto">
                Pesanan dengan jenis <strong>DELIVERY DQM</strong> otomatis masuk secara real-time di halaman ini lengkap dengan fitur Foto Bukti &amp; Bukti Digital WhatsApp.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((tx) => {
                const dStatus = normalizeDeliveryStatus(tx);
                const queueNo = getTakeawayQueueNumber(tx);
                const prf = proofByOrderId.get(tx.id_transaksi);
                const hasProofPhoto = Boolean(prf?.proofPhotoUrl || tx.proofPhotoUrl);
                const receiverName = prf?.receiverName || tx.receiverName || '';
                const courierName = prf?.courierName || tx.courierName || '';

                return (
                  <div
                    key={tx.id_transaksi}
                    className="bg-stone-900 border-2 border-stone-800 hover:border-red-500/50 rounded-3xl p-5 flex flex-col justify-between gap-4 shadow-xl transition-all"
                  >
                    <div className="space-y-3.5">
                      {/* Card Header */}
                      <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-stone-800">
                        <div className="flex items-center gap-2.5">
                          <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white font-black font-mono text-sm">
                            #{queueNo}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-500/20 text-orange-300 border border-orange-500/40">
                                DELIVERY DQM
                              </span>
                              <span className="font-mono text-xs font-bold text-white">
                                {tx.id_transaksi}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>
                                {tx.tanggal} • {tx.jam}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-black border ${getStatusBadgeStyle(
                            dStatus
                          )}`}
                        >
                          {dStatus === 'DITERIMA' ? '✓ DITERIMA' : dStatus}
                        </span>
                      </div>

                      {/* Customer & DQM Destination Box */}
                      <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-white font-black text-sm">
                            <User className="w-4 h-4 text-orange-400 shrink-0" />
                            <span>{tx.nama_pelanggan}</span>
                          </div>
                          {tx.no_whatsapp && (
                            <span className="font-mono text-xs text-emerald-400 font-bold">
                              {tx.no_whatsapp}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-800/80 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase block">
                              Tujuan &amp; Area
                            </span>
                            <span className="font-extrabold text-orange-400">
                              DQM • {tx.deliveryLocation || 'Pesantren DQM'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase block">
                              Detail Lokasi
                            </span>
                            <span className="font-extrabold text-stone-200">
                              {tx.deliveryDetail || tx.alamat_pengantaran || '-'}
                            </span>
                          </div>
                        </div>

                        {(courierName || receiverName) && (
                          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-stone-800/80 text-xs">
                            <div>
                              <span className="text-[10px] text-stone-400 block">
                                Diantar oleh:
                              </span>
                              <span className="font-bold text-stone-200">
                                {courierName || '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-stone-400 block">
                                Diterima oleh:
                              </span>
                              <span className="font-bold text-emerald-400">
                                {receiverName || '-'}
                              </span>
                            </div>
                          </div>
                        )}

                        {(tx.deliveryNote || tx.catatan_pesanan) && (
                          <div className="pt-1.5 border-t border-stone-800/80 text-xs text-orange-300 flex items-start gap-1.5">
                            <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>
                              <strong>Catatan:</strong> {tx.deliveryNote || tx.catatan_pesanan}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Proof Photo Preview Strip (if photo exists) */}
                      {hasProofPhoto && (
                        <div
                          onClick={() =>
                            setProofModalState({
                              isOpen: true,
                              tx,
                              mode: 'view',
                            })
                          }
                          className="p-2.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between gap-3 cursor-pointer hover:bg-emerald-950/50 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={prf?.proofPhotoUrl || tx.proofPhotoUrl}
                              alt="Bukti"
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-xl object-cover border border-emerald-500/40"
                            />
                            <div>
                              <span className="text-xs font-black text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Bukti Pengantaran Tersedia</span>
                              </span>
                              <span className="text-[11px] text-stone-300 block">
                                Diterima oleh: {receiverName || tx.nama_pelanggan}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-black text-orange-400 underline">
                            Lihat Bukti
                          </span>
                        </div>
                      )}

                      {/* Order Items Summary */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-black uppercase text-stone-400">
                          <span>
                            Item Pesanan ({tx.items.reduce((s, i) => s + i.qty, 0)})
                          </span>
                          <span className="text-sm font-mono text-orange-400">
                            {formatRupiah(tx.total)}
                          </span>
                        </div>
                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                          {tx.items.map((item, idx) => (
                            <div
                              key={item.id_detail || idx}
                              className="flex items-center justify-between text-xs py-0.5 text-stone-200"
                            >
                              <span>
                                <strong className="text-orange-400 mr-1">{item.qty}x</strong>
                                {item.nama_produk}
                              </span>
                              <span className="font-mono text-stone-400">
                                {formatRupiah(item.subtotal || item.harga * item.qty)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 3. STATUS DELIVERY & 6. TOMBOL AKSI */}
                    <div className="pt-3 border-t border-stone-800 space-y-2.5">
                      {/* Step-by-Step Status Buttons: MENUNGGU -> DIANTAR -> SAMPAI -> DITERIMA / GAGAL */}
                      {canModifyDelivery && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleChangeStatus(tx, 'MENUNGGU')}
                            className={`min-h-[40px] px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer ${
                              dStatus === 'MENUNGGU'
                                ? 'bg-amber-500 text-stone-950 border-amber-300'
                                : 'bg-stone-950 hover:bg-stone-800 text-amber-300 border-stone-800'
                            }`}
                          >
                            MENUNGGU
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChangeStatus(tx, 'DIANTAR')}
                            className={`min-h-[40px] px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer ${
                              dStatus === 'DIANTAR'
                                ? 'bg-orange-500 text-stone-950 border-orange-300'
                                : 'bg-stone-950 hover:bg-stone-800 text-orange-300 border-stone-800'
                            }`}
                          >
                            DIANTAR
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChangeStatus(tx, 'SAMPAI')}
                            className={`min-h-[40px] px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer ${
                              dStatus === 'SAMPAI'
                                ? 'bg-sky-500 text-stone-950 border-sky-300'
                                : 'bg-stone-950 hover:bg-stone-800 text-sky-300 border-stone-800'
                            }`}
                          >
                            SAMPAI
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChangeStatus(tx, 'DITERIMA')}
                            className={`min-h-[40px] px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer ${
                              dStatus === 'DITERIMA'
                                ? 'bg-emerald-500 text-stone-950 border-emerald-300'
                                : 'bg-stone-950 hover:bg-stone-800 text-emerald-300 border-stone-800'
                            }`}
                          >
                            ✓ DITERIMA
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChangeStatus(tx, 'GAGAL DIANTAR')}
                            className={`min-h-[40px] col-span-2 sm:col-span-1 px-2 py-1.5 rounded-xl text-[10px] font-black border transition cursor-pointer ${
                              dStatus === 'GAGAL DIANTAR'
                                ? 'bg-rose-600 text-white border-rose-400'
                                : 'bg-stone-950 hover:bg-stone-800 text-rose-400 border-stone-800'
                            }`}
                          >
                            GAGAL
                          </button>
                        </div>
                      )}

                      {/* Primary Action Buttons: [AMBIL/UPLOAD FOTO BUKTI], [LIHAT BUKTI], [KIRIM BUKTI KE WHATSAPP] */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {canModifyDelivery && (
                          <button
                            type="button"
                            onClick={() =>
                              setProofModalState({
                                isOpen: true,
                                tx,
                                mode: 'form',
                              })
                            }
                            className="min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            <span>
                              {hasProofPhoto ? 'EDIT FOTO / BUKTI' : 'AMBIL / UPLOAD FOTO'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setProofModalState({
                              isOpen: true,
                              tx,
                              mode: 'view',
                            })
                          }
                          className="min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 text-white border border-stone-700 text-xs font-black transition active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-orange-400" />
                          <span>LIHAT BUKTI DIGITAL</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendProofWhatsApp(tx)}
                          className="min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>KIRIM BUKTI WA</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Delivery Proof Form & Digital Receipt Modal */}
      {proofModalState && (
        <DeliveryProofModal
          isOpen={proofModalState.isOpen}
          onClose={() => setProofModalState(null)}
          transaction={proofModalState.tx}
          existingProof={proofByOrderId.get(proofModalState.tx.id_transaksi) || null}
          settings={settings}
          currentUserRole={userRole}
          currentUserName={currentUserName}
          initialMode={proofModalState.mode}
          onProofSaved={(savedProof, updatedTx) => {
            const newProofs = StorageService.upsertDeliveryProof(savedProof);
            setProofs(newProofs);
            onUpdateDeliveryStatus(
              updatedTx.id_transaksi,
              savedProof.status,
              updatedTx.status,
              updatedTx
            );
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
