import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  MapPin,
  User,
  Phone,
  FileText,
  Clock,
  Truck,
  Download,
  Printer,
  MessageCircle,
  X,
  RefreshCw,
  ShieldCheck,
  Edit3,
  Eye,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  Transaction,
  DeliveryProof,
  DeliveryStatus,
  StoreSettings,
  UserRole,
} from '../../types';
import {
  normalizeDeliveryStatus,
  getDeliveryStatusLabel,
  buildDeliveryProofShareUrl,
  buildDeliveryProofWhatsAppMessage,
  openWhatsAppChat,
  DQM_LOCATIONS,
} from '../../utils/formatters';
import {
  uploadDeliveryProofPhoto,
  saveDeliveryProofToFirebase,
} from '../../services/firebase';
import { BrandLogo } from '../Common/BrandLogo';

interface DeliveryProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  existingProof?: DeliveryProof | null;
  settings: StoreSettings;
  currentUserRole?: UserRole;
  currentUserName?: string;
  initialMode?: 'form' | 'view';
  readOnlyCustomerView?: boolean;
  onProofSaved?: (proof: DeliveryProof, updatedTx: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const DELIVERY_STATUS_FLOW: Array<{
  value: DeliveryStatus;
  label: string;
  desc: string;
  badgeClass: string;
}> = [
  {
    value: 'MENUNGGU',
    label: 'MENUNGGU',
    desc: 'Menunggu kurir berangkat',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    value: 'DIANTAR',
    label: 'DIANTAR',
    desc: 'Sedang dalam perjalanan ke DQM',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  {
    value: 'SAMPAI',
    label: 'SAMPAI',
    desc: 'Kurir sudah tiba di titik DQM',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    value: 'DITERIMA',
    label: '✓ DITERIMA',
    desc: 'Pesanan telah diterima dengan bukti',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    value: 'GAGAL DIANTAR',
    label: 'GAGAL DIANTAR',
    desc: 'Pengantaran terkendala / gagal',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
];

function formatIndoFullDate(isoOrDate?: string): string {
  try {
    const d = isoOrDate ? new Date(isoOrDate) : new Date();
    if (isNaN(d.getTime())) return isoOrDate || '-';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoOrDate || '-';
  }
}

function formatIndoTimeWIB(isoOrDate?: string): string {
  try {
    const d = isoOrDate ? new Date(isoOrDate) : new Date();
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function formatIndoDateTimeFull(isoOrDate?: string): string {
  const datePart = formatIndoFullDate(isoOrDate);
  const timePart = formatIndoTimeWIB(isoOrDate);
  return timePart ? `${datePart}, ${timePart} WIB` : datePart;
}

export const DeliveryProofModal: React.FC<DeliveryProofModalProps> = ({
  isOpen,
  onClose,
  transaction,
  existingProof,
  settings,
  currentUserRole = 'Kasir',
  currentUserName = 'Petugas Kurir DQM',
  initialMode = 'form',
  readOnlyCustomerView = false,
  onProofSaved,
  showToast,
}) => {
  const canModifyDelivery =
    !readOnlyCustomerView &&
    ['Owner', 'Admin', 'Kasir', 'Staff', 'Delivery', 'ADMIN', 'KASIR', 'DELIVERY'].includes(
      String(currentUserRole)
    );

  const isOwnerOrAdmin = ['Owner', 'Admin', 'ADMIN'].includes(String(currentUserRole));

  const [mode, setMode] = useState<'form' | 'view'>(
    readOnlyCustomerView ? 'view' : initialMode
  );

  const defaultLocation = [
    transaction.deliveryLocation || 'Asrama Putra',
    transaction.deliveryDetail || '',
  ]
    .filter(Boolean)
    .join(' - ');

  const [status, setStatus] = useState<DeliveryStatus>(() =>
    normalizeDeliveryStatus(
      existingProof?.status || transaction.deliveryStatus || 'DITERIMA'
    )
  );
  const [courierName, setCourierName] = useState<string>(
    existingProof?.courierName ||
      transaction.courierName ||
      currentUserName ||
      settings.activeCashier ||
      'Petugas Delivery DQM'
  );
  const [receiverName, setReceiverName] = useState<string>(
    existingProof?.receiverName ||
      transaction.receiverName ||
      transaction.nama_pelanggan ||
      ''
  );
  const [receiverPhone, setReceiverPhone] = useState<string>(
    existingProof?.receiverPhone ||
      transaction.receiverPhone ||
      transaction.no_whatsapp ||
      ''
  );
  const [detailLocation, setDetailLocation] = useState<string>(
    existingProof?.detailLocation ||
      defaultLocation ||
      transaction.alamat_pengantaran ||
      'Pesantren DQM'
  );
  const [deliveryNote, setDeliveryNote] = useState<string>(
    existingProof?.deliveryNote ||
      transaction.deliveryNote ||
      transaction.catatan_pesanan ||
      'Pesanan telah diterima dengan baik.'
  );
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string>(
    existingProof?.proofPhotoUrl || transaction.proofPhotoUrl || ''
  );
  const [sentAt, setSentAt] = useState<string>(
    existingProof?.sentAt || transaction.sentAt || transaction.created_at || new Date().toISOString()
  );
  const [deliveredAt, setDeliveredAt] = useState<string>(
    existingProof?.deliveredAt || transaction.deliveredAt || new Date().toISOString()
  );

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(readOnlyCustomerView ? 'view' : initialMode);
      setStatus(
        normalizeDeliveryStatus(
          existingProof?.status || transaction.deliveryStatus || 'DITERIMA'
        )
      );
      setCourierName(
        existingProof?.courierName ||
          transaction.courierName ||
          currentUserName ||
          settings.activeCashier ||
          'Petugas Delivery DQM'
      );
      setReceiverName(
        existingProof?.receiverName ||
          transaction.receiverName ||
          transaction.nama_pelanggan ||
          ''
      );
      setReceiverPhone(
        existingProof?.receiverPhone ||
          transaction.receiverPhone ||
          transaction.no_whatsapp ||
          ''
      );
      setDetailLocation(
        existingProof?.detailLocation ||
          defaultLocation ||
          transaction.alamat_pengantaran ||
          'Pesantren DQM'
      );
      setDeliveryNote(
        existingProof?.deliveryNote ||
          transaction.deliveryNote ||
          transaction.catatan_pesanan ||
          'Pesanan telah diterima dengan baik.'
      );
      setProofPhotoUrl(
        existingProof?.proofPhotoUrl || transaction.proofPhotoUrl || ''
      );
      setSentAt(
        existingProof?.sentAt ||
          transaction.sentAt ||
          transaction.created_at ||
          new Date().toISOString()
      );
      setDeliveredAt(
        existingProof?.deliveredAt ||
          transaction.deliveredAt ||
          new Date().toISOString()
      );
    }
  }, [isOpen, transaction, existingProof, initialMode, readOnlyCustomerView]);

  if (!isOpen) return null;

  const orderNumber = transaction.id_transaksi;
  const shareProofUrl = buildDeliveryProofShareUrl(orderNumber);

  // Compress photo & upload to Firebase Storage
  const handleProcessPhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      if (showToast) showToast('Pilih file berformat foto/gambar!', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = (e.target?.result as string) || '';
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 720;
          let width = img.width || 640;
          let height = img.height || 480;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.max(1, Math.round((height * MAX_DIM) / width));
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.max(1, Math.round((width * MAX_DIM) / height));
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          let compressedDataUrl = rawDataUrl;

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            if (compressedDataUrl.length > 220000) {
              compressedDataUrl = canvas.toDataURL('image/jpeg', 0.68);
            }
          }

          const uploadedUrl = await uploadDeliveryProofPhoto(
            compressedDataUrl,
            orderNumber
          );
          setProofPhotoUrl(uploadedUrl || compressedDataUrl);
          // Automatically mark status as DITERIMA when proof photo is captured
          if (status === 'MENUNGGU' || status === 'DIANTAR' || status === 'SAMPAI') {
            setStatus('DITERIMA');
            setDeliveredAt(new Date().toISOString());
          }
          setIsUploadingPhoto(false);
          if (showToast) {
            showToast('📸 Foto bukti pengantaran berhasil disimpan!', 'success');
          }
        } catch {
          setProofPhotoUrl(rawDataUrl);
          setIsUploadingPhoto(false);
          if (showToast) {
            showToast('📸 Foto bukti pengantaran siap digunakan!', 'success');
          }
        }
      };
      img.onerror = () => {
        setIsUploadingPhoto(false);
        if (showToast) showToast('Gagal memuat file foto.', 'error');
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      setIsUploadingPhoto(false);
      if (showToast) showToast('Gagal membaca file foto.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProof = async (targetStatus?: DeliveryStatus) => {
    if (!canModifyDelivery) return;
    const finalStatus = targetStatus || status;

    if (!receiverName.trim()) {
      if (showToast) showToast('Nama penerima wajib diisi!', 'error');
      return;
    }

    setIsSaving(true);
    const nowIso = new Date().toISOString();
    const finalSentAt =
      finalStatus === 'DIANTAR' && !sentAt ? nowIso : sentAt || nowIso;
    const finalDeliveredAt =
      finalStatus === 'DITERIMA'
        ? deliveredAt || nowIso
        : deliveredAt || nowIso;

    const proofObj: DeliveryProof = {
      deliveryId: existingProof?.deliveryId || transaction.deliveryId || `DLV-${orderNumber}`,
      orderId: orderNumber,
      orderNumber,
      customerId: existingProof?.customerId || '',
      customerName: transaction.nama_pelanggan || 'Pelanggan DQM',
      customerPhone: transaction.no_whatsapp || receiverPhone.trim(),
      destination: 'DQM',
      detailLocation: detailLocation.trim() || 'Pesantren DQM',
      courierId: existingProof?.courierId || '',
      courierName: courierName.trim() || 'Petugas Delivery DQM',
      receiverName: receiverName.trim() || transaction.nama_pelanggan || 'Penerima',
      receiverPhone: receiverPhone.trim() || transaction.no_whatsapp || '',
      status: finalStatus,
      deliveryStatus: finalStatus,
      proofPhotoUrl: proofPhotoUrl || '',
      deliveryNote: deliveryNote.trim() || 'Pesanan telah diterima dengan baik.',
      sentAt: finalSentAt,
      deliveredAt: finalDeliveredAt,
      createdAt: existingProof?.createdAt || transaction.created_at || nowIso,
      updatedAt: nowIso,
    };

    let mappedOrderStatus: Transaction['status'] = 'DIPROSES';
    if (finalStatus === 'MENUNGGU') mappedOrderStatus = 'MENUNGGU';
    else if (finalStatus === 'DIANTAR') mappedOrderStatus = 'DIPROSES';
    else if (finalStatus === 'SAMPAI') mappedOrderStatus = 'SIAP';
    else if (finalStatus === 'DITERIMA') mappedOrderStatus = 'SELESAI';
    else if (finalStatus === 'GAGAL DIANTAR') mappedOrderStatus = 'DIBATALKAN';

    const updatedTx: Transaction = {
      ...transaction,
      status: mappedOrderStatus,
      deliveryStatus: finalStatus,
      deliveryId: proofObj.deliveryId,
      courierName: proofObj.courierName,
      receiverName: proofObj.receiverName,
      receiverPhone: proofObj.receiverPhone,
      proofPhotoUrl: proofObj.proofPhotoUrl,
      deliveryNote: proofObj.deliveryNote,
      sentAt: proofObj.sentAt,
      deliveredAt: proofObj.deliveredAt,
      updated_at: nowIso,
    };

    await saveDeliveryProofToFirebase(proofObj, courierName.trim());
    setStatus(finalStatus);
    setDeliveredAt(finalDeliveredAt);
    setIsSaving(false);

    if (onProofSaved) {
      onProofSaved(proofObj, updatedTx);
    }
    if (showToast) {
      showToast(
        `✅ Bukti pengantaran #${orderNumber} (${finalStatus}) berhasil disimpan ke Firebase!`,
        'success'
      );
    }
    setMode('view');
  };

  // Generate & download PNG image of the Digital Delivery Proof Receipt
  const handleDownloadDigitalProof = async () => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const width = 640;
      const hasPhoto = Boolean(proofPhotoUrl);
      const height = hasPhoto ? 1080 : 760;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      // Background
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(0, 0, width, height);

      // Border card
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 4;
      ctx.strokeRect(16, 16, width - 32, height - 32);

      // Header Banner
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(20, 20, width - 40, 110);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(settings.storeName.toUpperCase() || 'WARUNG BANG KOBRA', width / 2, 66);

      ctx.fillStyle = '#fed7aa';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('BUKTI PENGANTARAN (DELIVERY DQM)', width / 2, 102);

      let y = 166;
      const drawRow = (label: string, val: string, highlight = false) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#a8a29e';
        ctx.font = '15px monospace';
        ctx.fillText(label, 44, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = highlight ? '#4ade80' : '#f5f5f4';
        ctx.font = highlight ? 'bold 16px monospace' : 'bold 15px monospace';
        ctx.fillText(val.slice(0, 38), width - 44, y);
        y += 32;
      };

      drawRow('No. Pesanan :', orderNumber);
      drawRow('Tujuan      :', 'DQM (Area Pesantren DQM)');
      drawRow('Pemesan     :', transaction.nama_pelanggan || '-');
      drawRow('No. WhatsApp:', receiverPhone || transaction.no_whatsapp || '-');
      drawRow('Lokasi      :', detailLocation || 'Pesantren DQM');

      // Divider
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, y - 10);
      ctx.lineTo(width - 40, y - 10);
      ctx.stroke();
      y += 18;

      const statusText = status === 'DITERIMA' ? '✓ DITERIMA' : getDeliveryStatusLabel(status);
      drawRow('Status      :', statusText, status === 'DITERIMA');
      drawRow('Diantar oleh:', courierName || '-');
      drawRow('Diterima oleh:', receiverName || '-');
      drawRow('Tanggal     :', formatIndoFullDate(deliveredAt));
      drawRow('Jam         :', `${formatIndoTimeWIB(deliveredAt)} WIB`);
      drawRow('Catatan     :', deliveryNote || 'Pesanan diterima dengan baik.');

      if (hasPhoto && proofPhotoUrl) {
        y += 10;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fb923c';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('[ FOTO BUKTI PENGANTARAN ]', width / 2, y);
        y += 16;

        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const boxW = width - 120;
            const boxH = 260;
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(60, y, boxW, boxH);
            const scale = Math.min(boxW / img.width, boxH / img.height);
            const dW = img.width * scale;
            const dH = img.height * scale;
            ctx.drawImage(img, 60 + (boxW - dW) / 2, y + (boxH - dH) / 2, dW, dH);
            y += boxH + 34;
            resolve();
          };
          img.onerror = () => {
            y += 40;
            resolve();
          };
          img.src = proofPhotoUrl;
        });
      } else {
        y += 25;
      }

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a8a29e';
      ctx.font = '14px monospace';
      ctx.fillText('========================================', width / 2, y);
      y += 26;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`Terima kasih • ${settings.storeName || 'WARUNG BANG KOBRA'}`, width / 2, y);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Bukti-Delivery-${orderNumber}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (showToast) {
        showToast('📥 Bukti Delivery Digital berhasil diunduh!', 'success');
      }
    } catch (err) {
      console.warn('Download proof error:', err);
      if (showToast) showToast('Gagal mengunduh gambar bukti.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintProof = () => {
    window.print();
  };

  const handleSendWhatsAppProof = () => {
    const targetPhone = receiverPhone || transaction.no_whatsapp;
    const message = buildDeliveryProofWhatsAppMessage({
      orderNumber,
      status: getDeliveryStatusLabel(status),
      receiverName: receiverName || transaction.nama_pelanggan || 'Penerima',
      deliveredAt: formatIndoDateTimeFull(deliveredAt),
      proofLink: shareProofUrl,
    });

    if (!targetPhone) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(message);
      }
      if (showToast) {
        showToast(
          'Pesan Bukti Delivery disalin! Masukkan nomor WhatsApp penerima untuk mengirim langsung.',
          'info'
        );
      }
      return;
    }

    openWhatsAppChat(targetPhone, message);
  };

  const handleCopyProofLink = () => {
    const message = buildDeliveryProofWhatsAppMessage({
      orderNumber,
      status: getDeliveryStatusLabel(status),
      receiverName: receiverName || transaction.nama_pelanggan || 'Penerima',
      deliveredAt: formatIndoDateTimeFull(deliveredAt),
      proofLink: shareProofUrl,
    });
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      if (showToast) {
        showToast('Format pesan & link Bukti Delivery berhasil disalin!', 'success');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-stone-950 border-2 border-red-600/50 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Top Modal Header (Red/Black/White/Orange Warung Bang Kobra Theme) */}
        <div className="bg-gradient-to-r from-red-900 via-red-800 to-stone-900 px-4 sm:px-6 py-4 border-b border-red-500/30 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo
              src={settings.logoUrl}
              alt={settings.storeName}
              size="md"
              rounded="rounded-2xl"
              className="border border-orange-400/50 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500 text-stone-950">
                  DELIVERY PROOF DQM
                </span>
                <span className="font-mono text-xs font-bold text-orange-200">
                  {orderNumber}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white truncate">
                Bukti Pengantaran Warung Bang Kobra
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canModifyDelivery && (
              <div className="flex items-center bg-stone-950/70 p-1 rounded-xl border border-stone-800">
                <button
                  type="button"
                  onClick={() => setMode('form')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    mode === 'form'
                      ? 'bg-orange-500 text-stone-950'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Input / Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    mode === 'view'
                      ? 'bg-orange-500 text-stone-950'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Bukti Digital</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center border border-stone-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hidden File Inputs for Camera & Gallery */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleProcessPhotoFile(e.target.files[0]);
            }
          }}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleProcessPhotoFile(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {mode === 'form' && canModifyDelivery ? (
            <>
              {/* 1. UBAH STATUS DELIVERY FLOW */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                    1. Status Pengantaran DQM (Ubah Status)
                  </span>
                  <span className="text-[11px] text-stone-400 font-mono">
                    MENUNGGU → DIANTAR → SAMPAI → DITERIMA
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {DELIVERY_STATUS_FLOW.map((item) => {
                    const active = status === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setStatus(item.value);
                          if (item.value === 'DIANTAR') {
                            setSentAt(new Date().toISOString());
                          } else if (item.value === 'DITERIMA') {
                            setDeliveredAt(new Date().toISOString());
                          }
                        }}
                        className={`min-h-[48px] p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          active
                            ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white border-orange-300 shadow-lg'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <span className="text-xs font-black">{item.label}</span>
                        <span
                          className={`text-[10px] leading-tight mt-0.5 ${
                            active ? 'text-white/90' : 'text-stone-400'
                          }`}
                        >
                          {item.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. FOTO BUKTI PENGANTARAN ([AMBIL FOTO] & [UPLOAD FOTO]) */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-orange-400 block">
                      2. Foto Bukti Pengantaran DQM
                    </span>
                    <p className="text-[11px] text-stone-400">
                      Ambil foto langsung menggunakan kamera HP saat pesanan diserahkan di DQM atau pilih dari galeri.
                    </p>
                  </div>
                  {proofPhotoUrl && (
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Foto Bukti Tersimpan</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="min-h-[54px] flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-sm shadow-lg shadow-red-950/50 transition active:scale-95 cursor-pointer"
                  >
                    {isUploadingPhoto ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                    <span>[AMBIL FOTO KAMERA HP]</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="min-h-[54px] flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-stone-950 hover:bg-stone-800 text-orange-400 border-2 border-orange-500/40 font-black text-sm transition active:scale-95 cursor-pointer"
                  >
                    <Upload className="w-5 h-5" />
                    <span>[UPLOAD FOTO GALERI]</span>
                  </button>
                </div>

                {proofPhotoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-stone-950 max-h-72 flex items-center justify-center">
                    <img
                      src={proofPhotoUrl}
                      alt="Foto Bukti Pengantaran DQM"
                      referrerPolicy="no-referrer"
                      className="max-h-68 w-auto object-contain mx-auto"
                    />
                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-orange-300 border border-orange-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Ganti Foto</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => cameraInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-700 hover:border-orange-500/60 rounded-2xl p-6 text-center cursor-pointer bg-stone-950/60 space-y-2 transition"
                  >
                    <Camera className="w-8 h-8 text-orange-400 mx-auto" />
                    <p className="text-xs font-bold text-stone-200">
                      Belum ada foto bukti pengantaran. Ketuk di sini untuk memotret paket/penerima di DQM.
                    </p>
                  </div>
                )}
              </div>

              {/* 3. DATA PENERIMA & PETUGAS KURIR */}
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-orange-400 block">
                  3. Data Penerima &amp; Petugas Pengantaran DQM
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-stone-300 mb-1 block">
                      Nama Penerima di DQM *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="Contoh: Ahmad / Ustadz / Pos Keamanan"
                        className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-300 mb-1 block">
                      Nomor WhatsApp Penerima
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={receiverPhone}
                        onChange={(e) => setReceiverPhone(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-300 mb-1 block">
                      Diantar Oleh (Nama Petugas / Kurir) *
                    </label>
                    <div className="relative">
                      <Truck className="w-4 h-4 text-orange-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                        placeholder="Nama Kurir Warung Bang Kobra"
                        className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-300 mb-1 block">
                      Tujuan &amp; Detail Lokasi DQM
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-red-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        list="dqm-locations-list"
                        value={detailLocation}
                        onChange={(e) => setDetailLocation(e.target.value)}
                        placeholder="Asrama Putra - Kamar 12"
                        className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-orange-500"
                      />
                      <datalist id="dqm-locations-list">
                        {DQM_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-stone-300 mb-1 block">
                      Catatan Pengantaran
                    </label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                      <textarea
                        rows={2}
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="Pesanan telah diterima dengan baik."
                        className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveProof('DITERIMA')}
                  disabled={isSaving}
                  className="flex-1 min-h-[52px] flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl transition active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {isSaving
                      ? 'Menyimpan ke Firebase...'
                      : 'SIMPAN BUKTI & TANDAI ✓ DITERIMA'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveProof(status)}
                  disabled={isSaving}
                  className="min-h-[52px] flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-orange-400 border border-orange-500/40 font-black text-xs transition active:scale-95 cursor-pointer"
                >
                  <span>Simpan Status ({status})</span>
                </button>
              </div>
            </>
          ) : (
            /* HALAMAN DETAIL BUKTI DELIVERY & BUKTI DELIVERY DIGITAL (Sections 5, 6, 7, 8) */
            <div className="space-y-5">
              {/* Digital Receipt Card */}
              <div
                id="printable-delivery-proof"
                className="bg-stone-900 border-2 border-stone-800 rounded-3xl p-5 sm:p-7 max-w-xl mx-auto shadow-2xl font-mono text-xs text-stone-200 space-y-4"
              >
                <div className="text-center border-y-2 border-dashed border-stone-700 py-3 space-y-1">
                  <div className="text-base sm:text-lg font-black text-white tracking-wider">
                    {settings.storeName.toUpperCase() || 'WARUNG BANG KOBRA'}
                  </div>
                  <div className="text-xs font-black text-orange-400 tracking-widest">
                    BUKTI PENGANTARAN • DELIVERY DQM
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-400">No. Pesanan :</span>
                    <span className="font-bold text-white">{orderNumber}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-400">Tujuan      :</span>
                    <span className="font-bold text-orange-400">DQM</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-400">Nama Pemesan:</span>
                    <span className="font-bold text-white">{transaction.nama_pelanggan}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-400">No. WhatsApp:</span>
                    <span className="font-bold text-stone-200">
                      {receiverPhone || transaction.no_whatsapp || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-400">Detail Lokasi:</span>
                    <span className="font-bold text-white text-right">
                      {detailLocation || 'Pesantren DQM'}
                    </span>
                  </div>
                </div>

                <div className="border-y border-dashed border-stone-700 py-3 flex items-center justify-between">
                  <span className="text-stone-400 font-bold">STATUS:</span>
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black border ${
                      status === 'DITERIMA'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : status === 'GAGAL DIANTAR'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    }`}
                  >
                    {status === 'DITERIMA' ? '✓ DITERIMA' : getDeliveryStatusLabel(status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-950 p-3.5 rounded-2xl border border-stone-800">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase block">
                      Diantar oleh:
                    </span>
                    <span className="font-bold text-orange-400 text-xs">
                      {courierName || 'Petugas Delivery DQM'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase block">
                      Diterima oleh:
                    </span>
                    <span className="font-bold text-emerald-400 text-xs">
                      {receiverName || transaction.nama_pelanggan}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase block">
                      Tanggal:
                    </span>
                    <span className="font-bold text-stone-200 text-xs">
                      {formatIndoFullDate(deliveredAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase block">
                      Jam:
                    </span>
                    <span className="font-bold text-stone-200 text-xs">
                      {formatIndoTimeWIB(deliveredAt)} WIB
                    </span>
                  </div>
                </div>

                <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800 space-y-1">
                  <span className="text-[10px] text-stone-400 uppercase block">
                    Catatan:
                  </span>
                  <p className="text-xs text-stone-200 font-semibold">
                    {deliveryNote || 'Pesanan telah diterima dengan baik.'}
                  </p>
                </div>

                {/* FOTO BUKTI */}
                <div className="space-y-2">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block text-center">
                    FOTO BUKTI PENGANTARAN:
                  </span>
                  {proofPhotoUrl ? (
                    <div className="rounded-2xl overflow-hidden border-2 border-stone-800 bg-stone-950 p-2">
                      <img
                        src={proofPhotoUrl}
                        alt={`Bukti Pengantaran ${orderNumber}`}
                        referrerPolicy="no-referrer"
                        className="max-h-72 w-auto mx-auto rounded-xl object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-800 bg-stone-950 p-5 text-center text-stone-400 text-xs">
                      Belum ada foto bukti terlampir pada pesanan ini.
                      {canModifyDelivery && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode('form');
                            setTimeout(() => cameraInputRef.current?.click(), 100);
                          }}
                          className="mt-2 mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-stone-950 font-black text-xs cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Ambil Foto Bukti Sekarang</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-center border-t-2 border-dashed border-stone-700 pt-3 space-y-0.5">
                  <div className="text-xs font-bold text-stone-300">Terima kasih</div>
                  <div className="text-xs font-black text-orange-400">
                    {settings.storeName.toUpperCase() || 'WARUNG BANG KOBRA'}
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar (Section 6 & 8) */}
              <div className="space-y-3 print:hidden">
                {/* Primary WhatsApp Share CTA */}
                <button
                  type="button"
                  onClick={handleSendWhatsAppProof}
                  className="w-full min-h-[54px] flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>KIRIM BUKTI KE WHATSAPP</span>
                </button>

                {/* Secondary Action Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadDigitalProof}
                    disabled={isDownloading}
                    className="min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-orange-400 border border-orange-500/40 text-xs font-black transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isDownloading ? 'Mengunduh...' : 'DOWNLOAD BUKTI'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintProof}
                    className="min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-black transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-orange-400" />
                    <span>CETAK BUKTI</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyProofLink}
                    className="min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-black transition cursor-pointer"
                  >
                    {copiedLink ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-orange-400" />
                    )}
                    <span>{copiedLink ? 'Tersalin!' : 'SALIN PESAN WA'}</span>
                  </button>

                  {canModifyDelivery && (
                    <button
                      type="button"
                      onClick={() => setMode('form')}
                      className="min-h-[46px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-black transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>UBAH / FOTO</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
