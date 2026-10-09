import { Transaction, OrderType, DeliveryStatus, OrderQueueStatus, StoreSettings } from '../types';

export const DQM_LOCATIONS = [
  'Asrama Putra',
  'Asrama Putri',
  'Gedung Sekolah / Kelas',
  'Kantor / Sekretariat DQM',
  'Masjid / Aula DQM',
  'Rumah Ustadz / Pengajar',
  'Pos Keamanan / Gerbang DQM',
  'Kantin / Koperasi DQM',
];

export function resolveOrderType(tx: Partial<Transaction>): OrderType {
  if (tx.orderType === 'PRE_ORDER' || tx.tipe_pesanan === 'PRE_ORDER' || tx.poNumber) {
    return 'PRE_ORDER';
  }
  if (tx.orderType === 'DELIVERY_DQM' || tx.tipe_pesanan === 'DELIVERY_DQM' || tx.tipe_pesanan === 'Delivery') {
    return 'DELIVERY_DQM';
  }
  return 'BUNGKUS';
}

export function normalizeOrderStatus(status?: string): OrderQueueStatus {
  if (!status) return 'MENUNGGU';
  const upper = status.toUpperCase().trim();
  if (upper === 'PENDING' || upper === 'MENUNGGU') return 'MENUNGGU';
  if (upper === 'DIPROSES') return 'DIPROSES';
  if (upper === 'SIAP' || upper === 'SIAP DIAMBIL' || upper === 'SIAP DIANTAR') return 'SIAP';
  if (upper === 'SELESAI') return 'SELESAI';
  if (upper === 'DIBATALKAN') return 'DIBATALKAN';
  return 'MENUNGGU';
}

export const normalizeOrderQueueStatus = normalizeOrderStatus;

export function normalizeDeliveryStatus(
  txOrDeliveryStatus?: Partial<Transaction> | string | null,
  fallbackOrderStatus?: string
): DeliveryStatus {
  let rawDeliveryStatus: string | null | undefined;
  let rawOrderStatus: string | undefined = fallbackOrderStatus;

  if (typeof txOrDeliveryStatus === 'string') {
    rawDeliveryStatus = txOrDeliveryStatus;
  } else if (txOrDeliveryStatus && typeof txOrDeliveryStatus === 'object') {
    rawDeliveryStatus = txOrDeliveryStatus.deliveryStatus;
    rawOrderStatus = txOrDeliveryStatus.status;
  }

  if (rawDeliveryStatus) {
    const ds = rawDeliveryStatus.toUpperCase().trim();
    if (ds === 'MENUNGGU') return 'MENUNGGU';
    if (ds === 'DIANTAR' || ds === 'SEDANG DIANTAR') return 'DIANTAR';
    if (ds === 'SAMPAI' || ds === 'SUDAH SAMPAI' || ds === 'SIAP DIANTAR' || ds === 'SIAP') return 'SAMPAI';
    if (ds === 'DITERIMA' || ds === 'SUDAH DITERIMA' || ds === 'SELESAI') return 'DITERIMA';
    if (ds === 'GAGAL DIANTAR' || ds === 'GAGAL' || ds === 'DIBATALKAN') return 'GAGAL DIANTAR';
    if (ds === 'DIPROSES') return 'MENUNGGU';
  }
  const ordStatus = normalizeOrderStatus(rawOrderStatus);
  if (ordStatus === 'MENUNGGU' || ordStatus === 'DIPROSES') return 'MENUNGGU';
  if (ordStatus === 'SIAP') return 'SAMPAI';
  if (ordStatus === 'SELESAI') return 'DITERIMA';
  if (ordStatus === 'DIBATALKAN') return 'GAGAL DIANTAR';
  return 'MENUNGGU';
}

export function getOrderStatusLabel(
  statusOrTx?: string | Partial<Transaction> | null,
  orderType?: OrderType | string
): string {
  if (statusOrTx && typeof statusOrTx === 'object') {
    const resolvedType = resolveOrderType(statusOrTx);
    if (resolvedType === 'DELIVERY_DQM') {
      const ds = normalizeDeliveryStatus(statusOrTx);
      return getDeliveryStatusLabel(ds);
    }
    const norm = normalizeOrderStatus(statusOrTx.status);
    return norm === 'SIAP' ? 'SIAP DIAMBIL' : norm;
  }
  const norm = normalizeOrderStatus(typeof statusOrTx === 'string' ? statusOrTx : undefined);
  const isDelivery = orderType === 'DELIVERY_DQM' || orderType === 'Delivery';
  if (norm === 'SIAP') {
    return isDelivery ? 'SAMPAI' : 'SIAP DIAMBIL';
  }
  return norm;
}

export function getDeliveryStatusLabel(deliveryStatus?: DeliveryStatus | string | null): string {
  if (!deliveryStatus) return 'MENUNGGU';
  const upper = deliveryStatus.toUpperCase().trim();
  if (upper === 'DIANTAR' || upper === 'SEDANG DIANTAR') return 'DIANTAR';
  if (upper === 'SAMPAI' || upper === 'SIAP' || upper === 'SIAP DIANTAR') return 'SAMPAI';
  if (upper === 'DITERIMA' || upper === 'SELESAI') return 'DITERIMA';
  if (upper === 'GAGAL DIANTAR' || upper === 'DIBATALKAN') return 'GAGAL DIANTAR';
  return 'MENUNGGU';
}

export function buildDeliveryProofShareUrl(orderId: string): string {
  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://warungbangkobra.web.app';
  return `${baseUrl}/?proof=${encodeURIComponent(orderId)}`;
}

export function buildDeliveryProofWhatsAppMessage(params: {
  orderNumber: string;
  status?: string;
  receiverName: string;
  deliveredAt: string;
  proofLink?: string;
}): string {
  const link = params.proofLink || buildDeliveryProofShareUrl(params.orderNumber);
  const statusText = params.status || 'DITERIMA';
  return (
    `Assalamu'alaikum,\n` +
    `Pesanan dari WARUNG BANG KOBRA telah diantar ke DQM.\n\n` +
    `No. Pesanan: ${params.orderNumber}\n` +
    `Status: ${statusText}\n` +
    `Penerima: ${params.receiverName}\n` +
    `Waktu: ${params.deliveredAt}\n\n` +
    `Bukti pengantaran:\n` +
    `${link}\n\n` +
    `Terima kasih.`
  );
}

export function isOrderCompleted(status?: string): boolean {
  return normalizeOrderStatus(status) === 'SELESAI';
}

export function isOrderCancelled(status?: string): boolean {
  return normalizeOrderStatus(status) === 'DIBATALKAN';
}

export function getEffectiveDeliveryFee(settings?: Partial<StoreSettings>, orderType?: OrderType | string): number {
  if (orderType !== 'DELIVERY_DQM' && orderType !== 'Delivery') return 0;
  if (!settings || settings.deliveryFeeType === 'FREE') return 0;
  return Number(settings.deliveryFeeAmount || 0);
}

export const calculateDeliveryDqmFee = getEffectiveDeliveryFee;

/**
 * Minimal Belanja Layanan Delivery (Rp20.000)
 */
export const DELIVERY_MIN_ORDER_AMOUNT = 20000;

export interface DeliveryMinOrderValidation {
  isMet: boolean;
  minAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercent: number;
  statusMessage: string;
  warningMessage: string;
}

export function getDeliveryMinOrderValidation(
  subtotal: number,
  customMinAmount?: number
): DeliveryMinOrderValidation {
  const minAmount =
    typeof customMinAmount === 'number' && customMinAmount > 0
      ? customMinAmount
      : DELIVERY_MIN_ORDER_AMOUNT;
  const currentAmount = Math.max(0, Math.round(Number(subtotal) || 0));
  const isMet = currentAmount >= minAmount;
  const remainingAmount = Math.max(0, minAmount - currentAmount);
  const progressPercent = Math.min(100, Math.round((currentAmount / minAmount) * 100));

  const statusMessage = isMet
    ? 'Minimal belanja terpenuhi. Silakan lanjutkan pesanan.'
    : currentAmount > 0
    ? `Belum mencapai minimal belanja Delivery (${formatRupiah(minAmount)}). Kurang ${formatRupiah(remainingAmount)} lagi.`
    : `Minimal belanja layanan Delivery adalah ${formatRupiah(minAmount)}. Silakan pilih menu terlebih dahulu.`;

  const warningMessage = `Minimal belanja untuk layanan Delivery adalah ${formatRupiah(minAmount)}. Total belanja saat ini ${formatRupiah(currentAmount)} (kurang ${formatRupiah(remainingAmount)} lagi).`;

  return {
    isMet,
    minAmount,
    currentAmount,
    remainingAmount,
    progressPercent,
    statusMessage,
    warningMessage,
  };
}

export interface StoreStatusResult {
  isOpen: boolean;
  reason: string;
  isTempClosed?: boolean;
  isOnlineOrderClosed?: boolean;
  isScheduleClosed?: boolean;
  scheduleText?: string;
}

export function checkStoreStatus(settings?: Partial<StoreSettings> | null): StoreStatusResult {
  if (!settings) {
    return { isOpen: true, reason: 'Toko buka', scheduleText: 'Buka Normal' };
  }

  if (settings.isTempClosed) {
    return {
      isOpen: false,
      isTempClosed: true,
      reason: settings.tempClosedReason || 'Toko sedang tutup sementara oleh pengelola.',
      scheduleText: 'Tutup Sementara',
    };
  }

  if (settings.onlineMenuIsOpen === false) {
    return {
      isOpen: false,
      isOnlineOrderClosed: true,
      reason: settings.onlineMenuAnnouncement || 'Pesanan online sedang ditutup.',
      scheduleText: 'Order Online Ditutup',
    };
  }

  if (settings.is24Hours) {
    return {
      isOpen: true,
      reason: 'Toko buka 24 jam nonstop',
      scheduleText: 'Buka 24 Jam',
    };
  }

  if (Array.isArray(settings.operatingHours) && settings.operatingHours.length > 0) {
    const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
    const todayName = daysMap[new Date().getDay()];
    const todaySchedule = settings.operatingHours.find((h) => h.day === todayName);

    if (todaySchedule) {
      if (!todaySchedule.isOpen) {
        return {
          isOpen: false,
          isScheduleClosed: true,
          reason: `Toko tutup pada hari ${todayName}.`,
          scheduleText: `Libur ${todayName}`,
        };
      }

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = (todaySchedule.openTime || '09:00').split(':').map(Number);
      const [closeH, closeM] = (todaySchedule.closeTime || '22:00').split(':').map(Number);
      const openMinutes = (openH || 0) * 60 + (openM || 0);
      const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

      if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
        return {
          isOpen: false,
          isScheduleClosed: true,
          reason: `Toko sedang tutup. Jam operasional hari ini: ${todaySchedule.openTime} - ${todaySchedule.closeTime} WIB.`,
          scheduleText: `${todaySchedule.openTime} - ${todaySchedule.closeTime} WIB`,
        };
      }

      return {
        isOpen: true,
        reason: `Toko buka hingga ${todaySchedule.closeTime} WIB`,
        scheduleText: `${todaySchedule.openTime} - ${todaySchedule.closeTime} WIB`,
      };
    }
  }

  return {
    isOpen: true,
    reason: 'Toko buka normal',
    scheduleText: settings.onlineMenuHours || '09:00 - 22:00 WIB',
  };
}

export function formatDeliveryLocationSummary(tx: Partial<Transaction>): string {
  const type = resolveOrderType(tx);
  if (type === 'BUNGKUS') {
    return 'Ambil di Warung (BUNGKUS)';
  }
  const parts: string[] = ['Pesantren DQM'];
  if (tx.deliveryLocation) parts.push(tx.deliveryLocation);
  if (tx.deliveryDetail) parts.push(`(${tx.deliveryDetail})`);
  if (parts.length === 1 && tx.alamat_pengantaran) {
    return tx.alamat_pengantaran;
  }
  return parts.join(' • ');
}

export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount || 0);
  return 'Rp' + rounded.toLocaleString('id-ID');
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTimeIndo(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function sanitizeWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Format Pesanan Pelanggan via WhatsApp sesuai Format Permintaan Bagian 5:
 *
 * Halo Warung Bang Kobra 👋
 *
 * Saya ingin pesan:
 *
 * 1. Mi Aceh x2 = Rp20.000
 * 2. Es Teh x2 = Rp10.000
 * 3. Es Kopi Gula Aren x1 = Rp10.000
 *
 * Total: Rp40.000
 *
 * Nama: Budi
 * Jam ambil: 16.30
 * Catatan: Sambal dipisah
 *
 * Terima kasih 🙏
 */
export interface OnlineQRCodeOrderPayload {
  orderId: string;
  storeName: string;
  orderType: OrderType | string;
  customerName: string;
  customerPhone: string;
  pickupTime?: string;
  deliveryArea?: string | null;
  deliveryLocation?: string | null;
  deliveryDetail?: string | null;
  deliveryAddress?: string;
  deliveryLandmark?: string;
  deliveryFee?: number;
  paymentMethod: string;
  notes?: string;
  items: Array<{ name: string; qty: number; price: number; notes?: string }>;
  subtotal: number;
  total: number;
}

export function buildOnlineQRCodeOrderWhatsAppMessage(
  payload: OnlineQRCodeOrderPayload
): string {
  const isDelivery = payload.orderType === 'DELIVERY_DQM' || payload.orderType === 'Delivery';
  const typeLabel = isDelivery ? '[DELIVERY DQM] Pesantren DQM' : '[BUNGKUS] Ambil di Warung';

  let msg = `*PESANAN QR MENU*\n`;
  msg += `*${payload.storeName.toUpperCase()}*\n`;
  msg += `==============================\n`;
  msg += `📋 *No. Transaksi:* ${payload.orderId}\n`;
  msg += `📌 *Jenis Pesanan:* ${typeLabel}\n\n`;

  msg += `👤 *Data Pemesan:*\n`;
  msg += `• Nama: ${payload.customerName}\n`;
  if (payload.customerPhone) {
    msg += `• WhatsApp: ${payload.customerPhone}\n`;
  }

  if (isDelivery) {
    msg += `• Area: Pesantren DQM\n`;
    if (payload.deliveryLocation) {
      msg += `• Lokasi: ${payload.deliveryLocation}\n`;
    }
    if (payload.deliveryDetail) {
      msg += `• Detail Lokasi: ${payload.deliveryDetail}\n`;
    }
    if (!payload.deliveryLocation && payload.deliveryAddress) {
      msg += `• Lokasi: ${payload.deliveryAddress}\n`;
    }
  } else {
    msg += `• Info: Pesanan akan disiapkan untuk diambil (BUNGKUS)\n`;
    if (payload.pickupTime) {
      msg += `• Jam Ambil: ${payload.pickupTime}\n`;
    }
  }

  msg += `\n🛒 *Daftar Pesanan:*\n`;
  payload.items.forEach((item, idx) => {
    const sub = item.qty * item.price;
    msg += `${idx + 1}. *${item.name}* x${item.qty} = ${formatRupiah(sub)}\n`;
    if (item.notes && item.notes.trim() !== '') {
      msg += `   _Catatan: ${item.notes.trim()}_\n`;
    }
  });

  msg += `\n==============================\n`;
  msg += `Subtotal: ${formatRupiah(payload.subtotal)}\n`;
  if (isDelivery) {
    msg += `Biaya Delivery DQM: ${payload.deliveryFee && payload.deliveryFee > 0 ? formatRupiah(payload.deliveryFee) : 'GRATIS'}\n`;
  }
  msg += `*TOTAL BAYAR: ${formatRupiah(payload.total)}*\n`;
  msg += `💳 *Pembayaran:* ${payload.paymentMethod}\n`;

  if (payload.notes && payload.notes.trim() !== '') {
    msg += `\n📝 *Catatan:* ${payload.notes.trim()}\n`;
  }

  msg += `==============================\n`;
  msg += `Halo ${payload.storeName}, mohon konfirmasi dan proses pesanan saya ya. Terima kasih! 🙏`;

  return msg;
}

export function buildCustomerWhatsAppOrderMessage(
  storeName: string,
  customerName: string,
  pickupTime: string,
  notes: string,
  paymentMethod: string,
  items: Array<{ name: string; qty: number; price: number; notes?: string }>,
  total: number
): string {
  let message = `Halo ${storeName} 👋\n\nSaya ingin pesan:\n\n`;

  items.forEach((item, index) => {
    const sub = item.qty * item.price;
    message += `${index + 1}. ${item.name} x${item.qty} = ${formatRupiah(sub)}`;
    if (item.notes && item.notes.trim() !== '') {
      message += ` (${item.notes})`;
    }
    message += `\n`;
  });

  message += `\nTotal: ${formatRupiah(total)}\n\n`;
  message += `Nama: ${customerName || 'Pelanggan'}\n`;
  if (pickupTime && pickupTime.trim() !== '') {
    message += `Jam ambil: ${pickupTime}\n`;
  }
  if (paymentMethod && paymentMethod.trim() !== '') {
    message += `Metode Pembayaran: ${paymentMethod}\n`;
  }
  if (notes && notes.trim() !== '') {
    message += `Catatan: ${notes}\n`;
  }
  message += `\nTerima kasih 🙏`;

  return message;
}

/**
 * Format Pesanan Struk Kasir ke WhatsApp sesuai Format Permintaan Bagian 6:
 *
 * WARUNG BANG KOBRA
 * ====================
 * No: WKB-20260908-001
 *
 * Pesanan:
 * Mi Aceh x2       Rp20.000
 * Es Teh x2        Rp10.000
 * Es Kopi Aren x1  Rp10.000
 *
 * Total: Rp40.000
 * Pembayaran: CASH
 * ====================
 *
 * Terima kasih sudah membeli di
 * WARUNG BANG KOBRA 🙏
 */
export function buildCashierReceiptWhatsAppMessage(
  tx: Transaction,
  storeName = 'WARUNG BANG KOBRA'
): string {
  const orderType = resolveOrderType(tx);
  const isDelivery = orderType === 'DELIVERY_DQM';
  let text = `${storeName.toUpperCase()}\n`;
  text += `====================\n`;
  text += `No: ${tx.id_transaksi}\n`;
  text += `Jenis: [${isDelivery ? 'DELIVERY DQM' : 'BUNGKUS'}]\n`;
  text += `Tanggal: ${tx.tanggal} ${tx.jam}\n`;
  text += `Kasir: ${tx.kasir}\n`;
  text += `Pelanggan: ${tx.nama_pelanggan}\n`;
  if (isDelivery) {
    text += `Lokasi: Pesantren DQM - ${tx.deliveryLocation || ''} ${tx.deliveryDetail ? `(${tx.deliveryDetail})` : ''}\n`;
  }
  text += `\nPesanan:\n`;

  tx.items.forEach((item) => {
    const lineSub = formatRupiah(item.subtotal || item.harga * item.qty);
    const itemLabel = `${item.nama_produk} x${item.qty}`;
    // Simple monospace alignment simulation
    text += `${itemLabel.padEnd(16, ' ')} ${lineSub}\n`;
    if (item.catatan) {
      text += `  *${item.catatan}*\n`;
    }
  });

  text += `\nSubtotal: ${formatRupiah(tx.subtotal)}\n`;
  if (tx.diskon > 0) {
    text += `Diskon: -${formatRupiah(tx.diskon)}\n`;
  }
  if (isDelivery) {
    const delivFee = Number(tx.deliveryFee ?? tx.biaya ?? 0);
    text += `Biaya Delivery DQM: ${delivFee > 0 ? formatRupiah(delivFee) : 'GRATIS'}\n`;
  } else if (tx.biaya > 0) {
    text += `Biaya Tambahan: +${formatRupiah(tx.biaya)}\n`;
  }
  text += `Total: ${formatRupiah(tx.total)}\n`;
  text += `Pembayaran: ${tx.metode_pembayaran.toUpperCase()}\n`;
  if (tx.metode_pembayaran === 'Cash' && tx.uang_diterima) {
    text += `Bayar: ${formatRupiah(tx.uang_diterima)}\n`;
    text += `Kembali: ${formatRupiah(tx.kembalian)}\n`;
  }
  text += `====================\n\n`;
  text += `Terima kasih sudah membeli di\n${storeName.toUpperCase()} 🙏`;

  return text;
}

export function openWhatsAppChat(phoneNumber: string, message: string): void {
  const sanitized = sanitizeWhatsAppNumber(phoneNumber);
  const encodedText = encodeURIComponent(message);
  const url = sanitized
    ? `https://wa.me/${sanitized}?text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 100);
  } catch {
    window.location.href = url;
  }
}

/**
 * Format Pesan Otomatis Chat Kasir WhatsApp Warung Bang Kobra
 * Menyertakan informasi pesanan lengkap jika tersedia.
 */
export function buildChatKasirWhatsAppMessage(params: {
  storeName?: string;
  order?: Partial<Transaction> | null;
  cartItems?: Array<{ name: string; qty: number; price: number; notes?: string }>;
  customerName?: string;
  orderType?: string;
}): string {
  const store = params.storeName || 'WARUNG BANG KOBRA';
  let msg = `Halo Kasir *${store}* 👋\n\n`;

  // Kasus 1: Pelanggan sudah memiliki pesanan / tiket antrian aktif
  if (params.order && params.order.id_transaksi) {
    const queueNo = getTakeawayQueueNumber(params.order as any);
    msg += `Saya ingin menanyakan informasi pesanan saya:\n`;
    msg += `• *No. Antrian:* ${queueNo}\n`;
    msg += `• *No. Transaksi:* ${params.order.id_transaksi}\n`;
    if (params.order.nama_pelanggan) {
      msg += `• *Nama Pemesan:* ${params.order.nama_pelanggan}\n`;
    }
    if (params.order.tipe_pesanan || params.order.orderType) {
      const typeStr =
        (params.order.tipe_pesanan || params.order.orderType) === 'DELIVERY_DQM'
          ? 'Delivery Area DQM'
          : 'Bungkus (Takeaway)';
      msg += `• *Layanan:* ${typeStr}\n`;
    }
    if (params.order.status) {
      msg += `• *Status Pesanan:* ${params.order.status}\n`;
    }
    if (params.order.total) {
      msg += `• *Total Pembayaran:* ${formatRupiah(params.order.total)}\n`;
    }
    if (params.order.items && params.order.items.length > 0) {
      msg += `\n*Daftar Menu:*\n`;
      params.order.items.forEach((item, idx) => {
        msg += `${idx + 1}. *${item.nama_produk}* x${item.qty}\n`;
        if (item.catatan) {
          msg += `   _Catatan: ${item.catatan}_\n`;
        }
      });
    }
    msg += `\nMohon bantuannya ya Kasir. Terima kasih! 🙏`;
    return msg;
  }

  // Kasus 2: Pelanggan sedang memilih menu di keranjang belanja
  if (params.cartItems && params.cartItems.length > 0) {
    msg += `Saya sedang memilih menu di Pesanan Online *${store}*:\n`;
    if (params.customerName && params.customerName.trim()) {
      msg += `• *Nama Pemesan:* ${params.customerName.trim()}\n`;
    }
    msg += `\n*Menu di Keranjang:*\n`;
    let subtotal = 0;
    params.cartItems.forEach((item, idx) => {
      const lineTotal = item.qty * item.price;
      subtotal += lineTotal;
      msg += `${idx + 1}. *${item.name}* x${item.qty} = ${formatRupiah(lineTotal)}\n`;
      if (item.notes && item.notes.trim()) {
        msg += `   _Catatan: ${item.notes.trim()}_\n`;
      }
    });
    msg += `\n*Subtotal:* ${formatRupiah(subtotal)}\n`;
    msg += `\nSaya mau tanya ketersediaan menu / info pesanan ini ke Kasir. Terima kasih! 🙏`;
    return msg;
  }

  // Kasus 3: Pertanyaan umum ke Kasir
  msg += `Saya pelanggan, ingin bertanya mengenai menu dan pesanan di *${store}*. Mohon informasinya ya Kasir. Terima kasih! 🙏`;
  return msg;
}

/**
 * Normalisasi Status Pre-Order (PO)
 */
export function normalizePOStatus(status?: string): import('../types').POStatus {
  if (!status) return 'MENUNGGU_KONFIRMASI';
  const s = status.toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (s === 'MENUNGGU_KONFIRMASI' || s === 'MENUNGGU' || s === 'PENDING') return 'MENUNGGU_KONFIRMASI';
  if (s === 'DIKONFIRMASI' || s === 'CONFIRMED') return 'DIKONFIRMASI';
  if (s === 'MENUNGGU_DP') return 'MENUNGGU_DP';
  if (s === 'DP_DITERIMA') return 'DP_DITERIMA';
  if (s === 'DIPROSES' || s === 'DIMASAK') return 'DIPROSES';
  if (s === 'SIAP_DIAMBIL' || s === 'SIAP') return 'SIAP_DIAMBIL';
  if (s === 'DALAM_PENGIRIMAN' || s === 'DIANTAR') return 'DALAM_PENGIRIMAN';
  if (s === 'SELESAI') return 'SELESAI';
  if (s === 'DIBATALKAN') return 'DIBATALKAN';
  return 'MENUNGGU_KONFIRMASI';
}

/**
 * Label Bahasa Indonesia untuk Status Pre-Order
 */
export function getPOStatusLabel(status?: string): string {
  const norm = normalizePOStatus(status);
  const map: Record<import('../types').POStatus, string> = {
    MENUNGGU_KONFIRMASI: 'Menunggu Konfirmasi',
    DIKONFIRMASI: 'Dikonfirmasi Kasir',
    MENUNGGU_DP: 'Menunggu Pembayaran DP',
    DP_DITERIMA: 'DP Diterima',
    DIPROSES: 'Sedang Dimasak / Diproses',
    SIAP_DIAMBIL: 'Siap Diambil di Warung',
    DALAM_PENGIRIMAN: 'Dalam Pengiriman DQM',
    SELESAI: 'Selesai',
    DIBATALKAN: 'Dibatalkan',
  };
  return map[norm] || 'Menunggu Konfirmasi';
}

/**
 * Badge styling untuk Status PO
 */
export function getPOStatusBadge(status?: string): { bg: string; text: string; border: string } {
  const norm = normalizePOStatus(status);
  switch (norm) {
    case 'MENUNGGU_KONFIRMASI':
      return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' };
    case 'DIKONFIRMASI':
      return { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' };
    case 'MENUNGGU_DP':
      return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' };
    case 'DP_DITERIMA':
      return { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' };
    case 'DIPROSES':
      return { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' };
    case 'SIAP_DIAMBIL':
    case 'DALAM_PENGIRIMAN':
      return { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' };
    case 'SELESAI':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'DIBATALKAN':
      return { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' };
    default:
      return { bg: 'bg-stone-800', text: 'text-stone-300', border: 'border-stone-700' };
  }
}

/**
 * Hitung ketentuan Uang Muka (DP) Pre-Order sesuai pengaturan Owner
 */
export function calculateRequiredDP(total: number, settings?: import('../types').StoreSettings): number {
  if (total <= 0) return 0;
  const dpType = settings?.poDpType || 'PERCENT';
  if (dpType === 'FIXED') {
    const fixed = Math.max(0, Number(settings?.poDpFixedAmount ?? 100000));
    return Math.min(total, fixed);
  }
  const percent = Math.min(100, Math.max(1, Number(settings?.poDpPercent ?? 50)));
  return Math.round((total * percent) / 100);
}

/**
 * Validasi Tanggal Pre-Order (minimal 1 hari sebelum tanggal pesanan siap, tidak boleh di masa lalu)
 */
export function validatePODate(targetDateStr: string, minDaysAhead = 1): { valid: boolean; message?: string } {
  if (!targetDateStr) {
    return { valid: false, message: 'Tanggal pesanan siap wajib diisi!' };
  }
  const parts = targetDateStr.split('-');
  if (parts.length !== 3) {
    return { valid: false, message: 'Format tanggal tidak valid!' };
  }
  const targetYear = parseInt(parts[0], 10);
  const targetMonth = parseInt(parts[1], 10) - 1;
  const targetDay = parseInt(parts[2], 10);

  const targetDateOnly = new Date(targetYear, targetMonth, targetDay);
  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = targetDateOnly.getTime() - todayOnly.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { valid: false, message: 'Tanggal PO tidak boleh di masa lalu!' };
  }
  if (diffDays < minDaysAhead) {
    return {
      valid: false,
      message: `Pemesanan Pre-Order minimal ${minDaysAhead} hari sebelum tanggal pesanan siap (Minimal: ${new Date(
        todayOnly.getTime() + minDaysAhead * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0]})`,
    };
  }
  return { valid: true };
}

/**
 * Format Pesan WhatsApp Formulir Pre-Order (PO) dari Pelanggan ke Kasir
 */
export function buildPreOrderCustomerWhatsAppMessage(params: {
  storeName?: string;
  poNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  guestCount?: number;
  deliveryType: 'BUNGKUS' | 'DELIVERY_DQM' | string;
  eventLocation?: string;
  items: Array<{ name: string; qty: number; price: number; notes?: string }>;
  subtotal: number;
  deliveryFee?: number;
  total: number;
  dpRequired: number;
  dpPaid?: number;
  remainingPayment: number;
  paymentMethod: string;
  notes?: string;
  hasDpProof?: boolean;
}): string {
  const store = params.storeName || 'WARUNG BANG KOBRA';
  const isDelivery = params.deliveryType === 'DELIVERY_DQM' || params.deliveryType === 'DELIVERY';

  let text = `*FORMULIR PRE-ORDER (PO) — ${store.toUpperCase()}*\n`;
  text += `=====================================\n\n`;
  text += `Halo Kasir *${store}*, saya ingin mengajukan pesanan Pre-Order acara dengan rincian berikut:\n\n`;

  text += `📋 *DATA PEMESAN & ACARA:*\n`;
  text += `• *No. PO:* ${params.poNumber}\n`;
  text += `• *Nama Pelanggan:* ${params.customerName}\n`;
  text += `• *No. WhatsApp:* ${params.customerPhone}\n`;
  if (params.customerEmail) {
    text += `• *Email:* ${params.customerEmail}\n`;
  }
  text += `• *Jenis Acara:* ${params.eventType}\n`;
  if (params.guestCount && params.guestCount > 0) {
    text += `• *Perkiraan Tamu / Porsi:* ±${params.guestCount} Orang\n`;
  }
  text += `• *Jadwal Pesanan Siap:* 🗓️ *${params.eventDate}* pukul ⏰ *${params.eventTime} WIB*\n`;
  text += `• *Metode Pengambilan:* ${isDelivery ? '🛵 Delivery Khusus Area Pesantren DQM' : '🥡 Bungkus (Ambil di Warung)'}\n`;
  if (isDelivery && params.eventLocation) {
    text += `• *Alamat / Lokasi DQM:* ${params.eventLocation}\n`;
  }

  text += `\n🍱 *RINCIAN MENU & VARIAN:* \n`;
  params.items.forEach((it, idx) => {
    const lineTotal = it.qty * it.price;
    text += `${idx + 1}. *${it.name}* x${it.qty} = ${formatRupiah(lineTotal)}\n`;
    if (it.notes && it.notes.trim()) {
      text += `   _Catatan: ${it.notes.trim()}_\n`;
    }
  });

  text += `\n💰 *RINGKASAN PEMBAYARAN:*\n`;
  text += `• *Subtotal Menu:* ${formatRupiah(params.subtotal)}\n`;
  if (isDelivery && params.deliveryFee && params.deliveryFee > 0) {
    text += `• *Biaya Pengantaran DQM:* ${formatRupiah(params.deliveryFee)}\n`;
  }
  text += `• *TOTAL KESELURUHAN:* *${formatRupiah(params.total)}*\n`;
  text += `• *Kewajiban DP:* *${formatRupiah(params.dpRequired)}*\n`;
  if (params.dpPaid && params.dpPaid > 0) {
    text += `• *DP Sudah Dibayar:* *${formatRupiah(params.dpPaid)}*\n`;
  }
  text += `• *Sisa Pembayaran:* *${formatRupiah(params.remainingPayment)}*\n`;
  text += `• *Metode Bayar:* ${params.paymentMethod.toUpperCase()}\n`;
  if (params.hasDpProof) {
    text += `• *Bukti Transfer DP:* Terlampir di sistem (foto diunggah)\n`;
  }

  if (params.notes && params.notes.trim()) {
    text += `\n📝 *Catatan Khusus:* \n"${params.notes.trim()}"\n`;
  }

  text += `\n=====================================\n`;
  text += `Mohon konfirmasi pesanan dan verifikasi DP kami ya Kasir. Terima kasih! 🙏`;

  return text;
}

/**
 * Format Pesan WhatsApp Konfirmasi / Update Status PO dari Kasir ke Pelanggan
 */
export function buildPOStatusNotificationWhatsAppMessage(params: {
  storeName?: string;
  poNumber: string;
  customerName: string;
  newStatus: import('../types').POStatus | string;
  eventDate: string;
  eventTime: string;
  total: number;
  dpPaid: number;
  remainingPayment: number;
  noteFromCashier?: string;
}): string {
  const store = params.storeName || 'WARUNG BANG KOBRA';
  const statusLabel = getPOStatusLabel(params.newStatus);

  let msg = `*KONFIRMASI PRE-ORDER (PO) — ${store.toUpperCase()}*\n`;
  msg += `=====================================\n\n`;
  msg += `Halo Kak *${params.customerName}*,\n`;
  msg += `Status pesanan Pre-Order acara Anda telah diperbarui:\n\n`;

  msg += `• *No. PO:* ${params.poNumber}\n`;
  msg += `• *Status Terkini:* 🔔 *${statusLabel.toUpperCase()}*\n`;
  msg += `• *Jadwal Siap:* 🗓️ *${params.eventDate}* jam ⏰ *${params.eventTime} WIB*\n`;
  msg += `• *Total Nilai PO:* ${formatRupiah(params.total)}\n`;
  msg += `• *DP Diterima:* ${formatRupiah(params.dpPaid)}\n`;
  msg += `• *Sisa Tagihan:* *${formatRupiah(params.remainingPayment)}* (${params.remainingPayment <= 0 ? 'LUNAS' : 'Belum Lunas'})\n`;

  if (params.noteFromCashier && params.noteFromCashier.trim()) {
    msg += `\n💬 *Pesan dari Kasir:* \n"${params.noteFromCashier.trim()}"\n`;
  }

  msg += `\nTerima kasih atas kepercayaan Anda memesan di *${store}*! 🙏`;
  return msg;
}

/**
 * Format nomor antrian Kasir/Takeaway (misal: A001, A002, A003)
 */
export function getTakeawayQueueNumber(tx: { id_transaksi: string; queueNumber?: string; created_at?: string }): string {
  if (tx?.queueNumber && /^A\d{3,}$/i.test(tx.queueNumber)) {
    return tx.queueNumber.toUpperCase();
  }
  if (!tx || !tx.id_transaksi) return 'A001';
  const parts = tx.id_transaksi.split('-');
  const lastPart = parts[parts.length - 1];
  const num = parseInt(lastPart, 10);
  if (!isNaN(num) && num > 0) {
    return `A${String(num).padStart(3, '0')}`;
  }
  const digits = tx.id_transaksi.replace(/\D/g, '').slice(-3);
  const parsedDigits = parseInt(digits, 10);
  return `A${String(!isNaN(parsedDigits) && parsedDigits > 0 ? parsedDigits : 1).padStart(3, '0')}`;
}

/**
 * Mainkan nada lonceng antrian yang jernih (Web Audio API)
 */
export function playQueueChimeSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Ding-dong chime sequence
    playTone(659.25, now, 0.4); // E5
    playTone(523.25, now + 0.15, 0.6); // C5
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

/**
 * Panggil nomor antrian menggunakan suara bahasa Indonesia (SpeechSynthesis)
 */
export function callTakeawayQueueVoice(queueNo: string, customerName?: string): void {
  if (typeof window === 'undefined') return;

  playQueueChimeSound();

  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();
    const cleanQueue = queueNo.replace('-', ' ');
    const namePart = customerName && customerName.trim() && customerName !== 'Pelanggan Umum'
      ? `atas nama ${customerName.trim()}, `
      : '';
    const text = `Nomor antrian ${cleanQueue}, ${namePart}pesanan bungkus sudah siap diambil di kasir. Terima kasih.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 0.92;
    utterance.pitch = 1.05;

    // Wait slightly for chime to finish
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 450);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}

/**
 * Format pesan WhatsApp konfirmasi pesanan takeaway siap diambil
 */
export function buildTakeawayReadyWhatsAppMessage(
  customerName: string,
  queueNo: string,
  storeName: string
): string {
  const name = customerName && customerName !== 'Pelanggan Umum' ? customerName : 'Kak';
  return (
    `Halo ${name} 👋\n\n` +
    `Kabar gembira! Pesanan Takeaway (Bungkus) Anda dengan *Nomor Antrian: ${queueNo}* di *${storeName}* SUDAH SIAP DIAMBIL di meja kasir. 🥡✨\n\n` +
    `Silakan tunjukkan pesan ini atau sebutkan nomor antrian Anda ke kasir.\n` +
    `Terima kasih dan selamat menikmati hidangan kami! 🙏`
  );
}

/**
 * Buat URL unik Struk Digital (/receipt/WBK-XXXX)
 */
export function buildDigitalReceiptUrl(orderId: string): string {
  if (typeof window === 'undefined') return `/receipt/${orderId}`;
  return `${window.location.origin}/receipt/${encodeURIComponent(orderId)}`;
}

/**
 * Buat URL unik Bukti Delivery DQM (/delivery-proof/WBK-XXXX)
 */
export function buildDigitalDeliveryProofUrl(orderId: string): string {
  if (typeof window === 'undefined') return `/delivery-proof/${orderId}`;
  return `${window.location.origin}/delivery-proof/${encodeURIComponent(orderId)}`;
}

/**
 * Format Jam pendek (misal: 10:30 WIB)
 */
export function formatJamWIB(jamOrIso?: string, fallbackJam?: string): string {
  if (jamOrIso && jamOrIso.includes('T')) {
    const d = new Date(jamOrIso);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm} WIB`;
    }
  }
  const raw = jamOrIso || fallbackJam || '10:30';
  const parts = raw.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')} WIB`;
  }
  return `${raw} WIB`;
}



