import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, ensureFirebaseAuth } from './firebase';
import {
  GoogleChatSpace,
  GoogleChatNotificationConfig,
  GoogleChatNotificationType,
  GoogleChatTemplate,
  GoogleChatLog,
  GoogleChatSettings,
  SendGoogleChatPayload,
} from '../types/googleChat';
import { Transaction, Product, Expense, StoreSettings } from '../types';
import { StorageService } from './storage';
import { formatRupiah } from '../utils/formatters';

export const DEFAULT_NOTIFICATION_TYPES: GoogleChatNotificationType[] = [
  'ORDER_NEW',
  'ORDER_WA',
  'ORDER_DELIVERY',
  'ORDER_TAKEAWAY',
  'ORDER_PO',
  'PAYMENT_SUCCESS',
  'ORDER_CANCELLED',
  'ORDER_COMPLETED',
  'STOCK_LOW',
  'STOCK_OUT',
  'EXPENSE_NEW',
  'DAILY_SUMMARY',
  'SYSTEM_ERROR',
  'SECURITY_ALERT',
];

export const NOTIFICATION_TYPE_LABELS: Record<GoogleChatNotificationType, { title: string; desc: string; icon: string; category: 'orders' | 'inventory' | 'finance' | 'system' }> = {
  ORDER_NEW: {
    title: 'Pesanan Online Baru',
    desc: 'Notifikasi saat pelanggan mengirim pesanan mandiri lewat QR/Web',
    icon: '🔔',
    category: 'orders',
  },
  ORDER_WA: {
    title: 'Pesanan WhatsApp Baru',
    desc: 'Notifikasi saat pesanan via tombol WhatsApp diterima',
    icon: '💬',
    category: 'orders',
  },
  ORDER_DELIVERY: {
    title: 'Pesanan Delivery Baru',
    desc: 'Notifikasi khusus pesanan delivery antar Pesantren DQM',
    icon: '🚚',
    category: 'orders',
  },
  ORDER_TAKEAWAY: {
    title: 'Pesanan Takeaway Baru',
    desc: 'Notifikasi pesanan bungkus untuk segera dipersiapkan',
    icon: '🛍️',
    category: 'orders',
  },
  ORDER_PO: {
    title: 'Pesanan PO / Acara Baru',
    desc: 'Notifikasi pre-order acara, tasyakuran & katering',
    icon: '🎉',
    category: 'orders',
  },
  PAYMENT_SUCCESS: {
    title: 'Pembayaran Berhasil',
    desc: 'Notifikasi kasir menerima pelunasan QRIS, Transfer atau Tunai',
    icon: '💰',
    category: 'finance',
  },
  ORDER_CANCELLED: {
    title: 'Pesanan Dibatalkan',
    desc: 'Pemberitahuan bila ada pesanan yang ditolak atau dibatalkan',
    icon: '❌',
    category: 'orders',
  },
  ORDER_COMPLETED: {
    title: 'Pesanan Selesai',
    desc: 'Konfirmasi bahwa pesanan telah diterima pelanggan',
    icon: '✅',
    category: 'orders',
  },
  STOCK_LOW: {
    title: 'Stok Menipis',
    desc: 'Peringatan ketika stok menu berada di bawah batas minimum',
    icon: '⚠️',
    category: 'inventory',
  },
  STOCK_OUT: {
    title: 'Produk Habis',
    desc: 'Pemberitahuan darurat saat stok bahan/menu tersisa 0',
    icon: '🚨',
    category: 'inventory',
  },
  EXPENSE_NEW: {
    title: 'Pengeluaran Baru',
    desc: 'Pencatatan belanja operasional dan bahan baku warung',
    icon: '💸',
    category: 'finance',
  },
  DAILY_SUMMARY: {
    title: 'Ringkasan Penjualan Harian',
    desc: 'Laporan otomatis omzet, laba estimasi & transaksi tiap malam',
    icon: '📊',
    category: 'finance',
  },
  SYSTEM_ERROR: {
    title: 'Error Sistem Penting',
    desc: 'Pemberitahuan kendala teknis atau kegagalan sinkronisasi',
    icon: '🛠️',
    category: 'system',
  },
  SECURITY_ALERT: {
    title: 'Login & Security Alert',
    desc: 'Pemberitahuan login kasir baru atau aktivitas akun sensitif',
    icon: '🔒',
    category: 'system',
  },
};

export const AVAILABLE_TEMPLATE_VARIABLES: Array<{ key: string; label: string; desc: string }> = [
  { key: '{{orderNumber}}', label: 'No. Pesanan', desc: 'Nomor transaksi (contoh: WBK-20261008-0001)' },
  { key: '{{customerName}}', label: 'Nama Pelanggan', desc: 'Nama pemesan atau pelanggan' },
  { key: '{{phone}}', label: 'No. WhatsApp', desc: 'Nomor telepon / WhatsApp pelanggan' },
  { key: '{{orderType}}', label: 'Jenis Pesanan', desc: 'BUNGKUS / DELIVERY DQM / TAKEAWAY' },
  { key: '{{address}}', label: 'Alamat', desc: 'Alamat antar jika delivery' },
  { key: '{{items}}', label: 'Daftar Menu', desc: 'Rincian menu dan porsi yang dipesan' },
  { key: '{{subtotal}}', label: 'Subtotal', desc: 'Subtotal harga sebelum diskon & ongkir' },
  { key: '{{discount}}', label: 'Diskon', desc: 'Potongan harga / voucher' },
  { key: '{{deliveryFee}}', label: 'Ongkir Delivery', desc: 'Biaya kirim delivery Pesantren DQM' },
  { key: '{{total}}', label: 'Total Bayar', desc: 'Nominal total akhir pembayaran' },
  { key: '{{paymentMethod}}', label: 'Metode Pembayaran', desc: 'QRIS / CASH / TRANSFER / E-WALLET' },
  { key: '{{status}}', label: 'Status Pesanan', desc: 'Status saat ini (MENUNGGU KONFIRMASI / SELESAI)' },
  { key: '{{createdAt}}', label: 'Waktu Dibuat', desc: 'Tanggal dan jam saat order dibuat' },
  { key: '{{poNumber}}', label: 'No. PO Acara', desc: 'Nomor Pre-Order katering acara' },
  { key: '{{eventDate}}', label: 'Tanggal Acara', desc: 'Jadwal hari pelaksanaan acara PO' },
  { key: '{{eventTime}}', label: 'Jam Acara', desc: 'Jadwal jam pelaksanaan acara PO' },
  { key: '{{qty}}', label: 'Jumlah Porsi', desc: 'Kuantitas porsi / boks pesanan' },
  { key: '{{notes}}', label: 'Catatan Khusus', desc: 'Pesan khusus pemesan (misal: pedas sedang)' },
  { key: '{{productName}}', label: 'Nama Produk', desc: 'Nama item menu atau stok bahan' },
  { key: '{{stock}}', label: 'Sisa Stok', desc: 'Jumlah stok tersisa di sistem' },
  { key: '{{minStock}}', label: 'Batas Min Stok', desc: 'Ambang batas peringatan stok' },
  { key: '{{expenseAmount}}', label: 'Nominal Pengeluaran', desc: 'Biaya belanja / operasional' },
  { key: '{{expenseCategory}}', label: 'Kategori Pengeluaran', desc: 'Bahan Baku / Operasional / Gaji' },
  { key: '{{dailySales}}', label: 'Omzet Harian', desc: 'Total omset penjualan toko hari ini' },
  { key: '{{dailyTxCount}}', label: 'Total Transaksi', desc: 'Jumlah order terselesaikan hari ini' },
  { key: '{{dailyCash}}', label: 'Omzet Cash', desc: 'Total pembayaran tunai' },
  { key: '{{dailyQris}}', label: 'Omzet QRIS', desc: 'Total pembayaran QRIS' },
  { key: '{{dailyTransfer}}', label: 'Omzet Transfer', desc: 'Total transfer bank' },
  { key: '{{dailyDeliveryQty}}', label: 'Total Delivery', desc: 'Jumlah pesanan delivery DQM' },
  { key: '{{dailyEstProfit}}', label: 'Estimasi Laba', desc: 'Perkiraan laba bersih hari ini' },
  { key: '{{topProduct}}', label: 'Menu Terlaris', desc: 'Menu paling laku hari ini' },
];

export const DEFAULT_TEMPLATES: GoogleChatTemplate[] = [
  {
    id: 'tmpl-order-new',
    name: 'Pesanan Baru Standar',
    type: 'ORDER_NEW',
    content: `🔔 PESANAN BARU\nWARUNG BANG KOBRA\n\nNomor Pesanan:\n{{orderNumber}}\n\nNama Pelanggan:\n{{customerName}}\n\nNo. WhatsApp:\n{{phone}}\n\nJenis Pesanan:\n{{orderType}}\n\nAlamat:\n{{address}}\n\nDaftar Pesanan:\n{{items}}\n\nTotal:\n{{total}}\n\nMetode Pembayaran:\n{{paymentMethod}}\n\nStatus:\n{{status}}\n\nWaktu:\n{{createdAt}}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Sistem',
    updatedBy: 'Sistem',
  },
  {
    id: 'tmpl-order-delivery',
    name: 'Delivery Pesantren DQM',
    type: 'ORDER_DELIVERY',
    content: `🚚 DELIVERY BARU\nWARUNG BANG KOBRA\n\nNomor:\n{{orderNumber}}\n\nPelanggan:\n{{customerName}}\n\nWhatsApp:\n{{phone}}\n\nAlamat:\n{{address}}\n\nTotal:\n{{total}}\n\nMinimal delivery:\nRp20.000\n\nStatus:\n{{status}}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Sistem',
    updatedBy: 'Sistem',
  },
  {
    id: 'tmpl-order-po',
    name: 'PO / Pesanan Acara',
    type: 'ORDER_PO',
    content: `🎉 PO / PESANAN ACARA BARU\nWARUNG BANG KOBRA\n\nNomor PO:\n{{poNumber}}\n\nNama Pemesan:\n{{customerName}}\n\nTanggal Acara:\n{{eventDate}}\n\nWaktu:\n{{createdAt}}\n\nJumlah Pesanan:\n{{items}}\n\nTotal:\n{{total}}\n\nCatatan:\n{{notes}}\n\nStatus:\n{{status}}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Sistem',
    updatedBy: 'Sistem',
  },
  {
    id: 'tmpl-stock-low',
    name: 'Peringatan Stok Menipis',
    type: 'STOCK_LOW',
    content: `⚠️ STOK MENIPIS\nWARUNG BANG KOBRA\n\nProduk:\n{{productName}}\n\nStok:\n{{stock}}\n\nMinimum:\n{{minStock}}\n\nStatus:\nSEGERA RESTOCK`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Sistem',
    updatedBy: 'Sistem',
  },
  {
    id: 'tmpl-stock-out',
    name: 'Produk Habis Darurat',
    type: 'STOCK_OUT',
    content: `🚨 PRODUK HABIS\nWARUNG BANG KOBRA\n\nProduk:\n{{productName}}\n\nStok:\n0\n\nStatus:\nOUT OF STOCK`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Sistem',
    updatedBy: 'Sistem',
  },
  {
    id: 'tmpl-daily-summary',
    name: 'Laporan Penjualan Harian',
    type: 'DAILY_SUMMARY',
    content: `📊 LAPORAN HARIAN\nWARUNG BANG KOBRA\n\nTanggal:\n{{date}}\n\nTotal Transaksi:\n{{totalTransactions}}\n\nTotal Penjualan:\n{{totalSales}}\n\nCash:\n{{cashSales}}\n\nTransfer:\n{{transferSales}}\n\nQRIS:\n{{qrisSales}}\n\nE-Wallet:\n{{ewalletSales}}\n\nDelivery:\n{{deliveryCount}}\n\nTakeaway:\n{{takeawayCount}}\n\nPO:\n{{poCount}}\n\nPengeluaran:\n{{totalExpense}}\n\nEstimasi Laba:\n{{estimatedProfit}}\n\nProduk Terlaris:\n{{topProduct}}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Sistem',
    updatedBy: 'Sistem',
  },
];

export class GoogleChatService {
  /**
   * Fetch config from server proxy (keeps secrets safe)
   */
  static async fetchServerConfig(): Promise<{
    success: boolean;
    connectionStatus: 'CONNECTED' | 'DISCONNECTED';
    spaces: GoogleChatSpace[];
    defaultSpaceId: string;
    dailySummaryEnabled: boolean;
    dailySummaryTime: string;
  }> {
    try {
      const res = await fetch('/api/google-chat/config');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Fetch google chat config error:', e);
    }
    return {
      success: false,
      connectionStatus: 'DISCONNECTED',
      spaces: [],
      defaultSpaceId: '',
      dailySummaryEnabled: true,
      dailySummaryTime: '21:00',
    };
  }

  /**
   * Save / update a space on server
   */
  static async saveSpace(space: Partial<GoogleChatSpace>): Promise<{ success: boolean; message: string; space?: GoogleChatSpace }> {
    try {
      const res = await fetch('/api/google-chat/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(space),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Also sync metadata to Firestore for multi-device sync
        try {
          await ensureFirebaseAuth();
          const cleanDoc = { ...data.space };
          delete cleanDoc.webhookUrl; // NEVER store raw secret in Firestore
          await setDoc(doc(db, 'google_chat_spaces', data.space.id), {
            ...cleanDoc,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (err) {
          console.warn('Firestore space mirror notice:', err);
        }
      }
      return data;
    } catch (e: unknown) {
      return { success: false, message: e instanceof Error ? e.message : 'Koneksi ke server bermasalah' };
    }
  }

  /**
   * Delete a space
   */
  static async deleteSpace(spaceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`/api/google-chat/spaces/${spaceId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        try {
          await ensureFirebaseAuth();
          await deleteDoc(doc(db, 'google_chat_spaces', spaceId));
        } catch {}
      }
      return data;
    } catch (e: unknown) {
      return { success: false, message: e instanceof Error ? e.message : 'Gagal menghapus ruang' };
    }
  }

  /**
   * Test connection
   */
  static async testConnection(spaceId?: string, webhookUrl?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/google-chat/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, webhookUrl }),
      });
      return await res.json();
    } catch (e: unknown) {
      return { success: false, message: e instanceof Error ? e.message : 'Koneksi ke server bermasalah' };
    }
  }

  /**
   * Disconnect connection
   */
  static async disconnect(spaceId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/google-chat/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId }),
      });
      return await res.json();
    } catch (e: unknown) {
      return { success: false, message: e instanceof Error ? e.message : 'Gagal memutuskan koneksi' };
    }
  }

  /**
   * Send notification via backend proxy with idempotency
   */
  static async sendNotification(payload: SendGoogleChatPayload): Promise<{
    success: boolean;
    status: 'SENT' | 'FAILED' | 'PENDING';
    message: string;
    eventId: string;
    duplicated?: boolean;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/google-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      // Record to Firestore google_chat_logs for audit
      try {
        await ensureFirebaseAuth();
        const logId = payload.eventId || `log-${Date.now()}`;
        const logData: GoogleChatLog = {
          id: logId,
          eventId: payload.eventId,
          timestamp: new Date().toISOString(),
          notificationType: payload.notificationType,
          referenceId: payload.referenceId,
          spaceId: payload.spaceId || result.spaceId || 'default',
          spaceName: result.spaceName || 'Google Chat Warung Bang Kobra',
          status: result.status === 'SENT' ? 'SENT' : 'FAILED',
          messageText: payload.customText || payload.title || payload.notificationType,
          response: result.response ? JSON.stringify(result.response) : undefined,
          error: result.error,
          retryCount: 0,
          lastAttempt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'POS System',
          updatedBy: 'POS System',
        };
        await setDoc(doc(db, 'google_chat_logs', logId), logData, { merge: true });
      } catch (err) {
        console.warn('Logging to Firestore notice:', err);
      }

      return result;
    } catch (e: unknown) {
      console.warn('Send notification error:', e);
      return {
        success: false,
        status: 'FAILED',
        eventId: payload.eventId,
        message: 'Pesanan berhasil dibuat, tetapi notifikasi Google Chat sedang menunggu pengiriman.',
        error: e instanceof Error ? e.message : 'Jaringan offline',
      };
    }
  }

  /**
   * Retry failed log
   */
  static async retryLog(log: GoogleChatLog): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`/api/google-chat/retry/${log.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceId: log.spaceId,
          messageText: log.messageText,
          title: `🔄 RETRY NOTIFIKASI: ${log.notificationType}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        try {
          await ensureFirebaseAuth();
          await setDoc(
            doc(db, 'google_chat_logs', log.id),
            {
              status: 'SENT',
              retryCount: (log.retryCount || 0) + 1,
              lastAttempt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              error: null,
            },
            { merge: true }
          );
        } catch {}
      }
      return data;
    } catch (e: unknown) {
      return { success: false, message: e instanceof Error ? e.message : 'Gagal mengirim ulang' };
    }
  }

  /**
   * Helper: Dispatch automated order events
   */
  static async dispatchOrderNotifications(tx: Transaction, _settings?: StoreSettings) {
    if (!tx) return;

    const txId = tx.id_transaksi || (tx as any).id || `WBK-${Date.now()}`;
    const itemsSummary = tx.items
      ? tx.items.map((i) => `- ${i.nama_produk} x${i.qty} — ${formatRupiah(i.subtotal)}`).join('\n')
      : '-';

    const baseVariables: Record<string, string | number> = {
      orderNumber: txId,
      customerName: tx.nama_pelanggan || 'Pelanggan',
      phone: tx.no_whatsapp || (tx as any).no_hp || '-',
      orderType: tx.tipe_pesanan || tx.orderType || 'TAKEAWAY',
      address: tx.alamat_pengantaran || tx.deliveryLocation || tx.catatan_pesanan || tx.notes || '-',
      items: itemsSummary,
      subtotal: formatRupiah(tx.subtotal || tx.total),
      discount: formatRupiah(tx.diskon || 0),
      deliveryFee: formatRupiah(tx.deliveryFee || tx.biaya || 0),
      total: formatRupiah(tx.total),
      paymentMethod: tx.metode_pembayaran || 'CASH',
      status: tx.status || 'MENUNGGU KONFIRMASI',
      createdAt: tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : new Date().toLocaleString('id-ID'),
      notes: tx.catatan_pesanan || tx.notes || '-',
    };

    // 1. Send Main Order Notification (Idempotent: orderId + '_ORDER_NEW')
    await this.sendNotification({
      eventId: `${txId}_ORDER_NEW`,
      notificationType: 'ORDER_NEW',
      referenceId: txId,
      templateVariables: baseVariables,
      actionUrl: window.location.origin,
    });

    // 2. Specific Delivery Notification if delivery
    const isDelivery =
      tx.tipe_pesanan === 'DELIVERY_DQM' ||
      tx.tipe_pesanan === 'Delivery' ||
      tx.orderType === 'DELIVERY_DQM' ||
      txId.startsWith('DQM-');

    if (isDelivery) {
      await this.sendNotification({
        eventId: `${txId}_ORDER_DELIVERY`,
        notificationType: 'ORDER_DELIVERY',
        referenceId: txId,
        templateVariables: {
          ...baseVariables,
          orderType: 'DELIVERY PESANTREN DQM',
        },
        actionUrl: window.location.origin,
      });
    }

    // 3. Specific Pre-Order Notification if PO
    const isPO =
      tx.tipe_pesanan === 'PRE_ORDER' ||
      Boolean(tx.poNumber) ||
      txId.startsWith('PO-');

    if (isPO) {
      await this.sendNotification({
        eventId: `${txId}_ORDER_PO`,
        notificationType: 'ORDER_PO',
        referenceId: txId,
        templateVariables: {
          ...baseVariables,
          poNumber: tx.poNumber || txId,
          eventDate: tx.eventDate || tx.tanggal || tx.created_at || '-',
        },
        actionUrl: window.location.origin,
      });
    }
  }

  /**
   * Helper: Dispatch low stock / out of stock notification
   */
  static async dispatchStockNotification(product: Product, stock: number) {
    if (!product) return;
    const minStock = product.stok_minimum || 5;

    if (stock <= 0) {
      await this.sendNotification({
        eventId: `${product.id}_STOCK_OUT_${new Date().toISOString().slice(0, 10)}`,
        notificationType: 'STOCK_OUT',
        referenceId: product.id,
        templateVariables: {
          productName: product.nama,
          stock: 0,
          minStock,
        },
      });
    } else if (stock <= minStock) {
      await this.sendNotification({
        eventId: `${product.id}_STOCK_LOW_${new Date().toISOString().slice(0, 10)}`,
        notificationType: 'STOCK_LOW',
        referenceId: product.id,
        templateVariables: {
          productName: product.nama,
          stock,
          minStock,
        },
      });
    }
  }

  /**
   * Helper: Dispatch Expense Notification
   */
  static async dispatchExpenseNotification(expense: Expense, userName?: string) {
    if (!expense) return;
    await this.sendNotification({
      eventId: `${expense.id}_EXPENSE_NEW`,
      notificationType: 'EXPENSE_NEW',
      referenceId: expense.id,
      templateVariables: {
        category: expense.kategori || 'Operasional Warung',
        description: expense.keterangan || '-',
        amount: formatRupiah(expense.jumlah),
        user: userName || 'Kasir',
        createdAt: expense.tanggal || new Date().toLocaleString('id-ID'),
      },
    });
  }

  /**
   * Helper: Dispatch Daily Summary
   */
  static async dispatchDailySummary(
    transactions: Transaction[],
    expenses: Expense[],
    dateStr: string = new Date().toISOString().slice(0, 10)
  ) {
    const dayTxs = transactions.filter((t) => t.tanggal === dateStr || (t.created_at && t.created_at.startsWith(dateStr)));
    const totalTransactions = dayTxs.length;
    const totalSales = dayTxs.reduce((s, t) => s + (t.total || 0), 0);

    const cashSales = dayTxs.filter((t) => String(t.metode_pembayaran || '').toUpperCase().includes('CASH') || String(t.metode_pembayaran || '').toUpperCase().includes('TUNAI')).reduce((s, t) => s + (t.total || 0), 0);
    const transferSales = dayTxs.filter((t) => String(t.metode_pembayaran || '').toUpperCase().includes('TRANSFER')).reduce((s, t) => s + (t.total || 0), 0);
    const qrisSales = dayTxs.filter((t) => String(t.metode_pembayaran || '').toUpperCase().includes('QRIS')).reduce((s, t) => s + (t.total || 0), 0);
    const ewalletSales = dayTxs.filter((t) => String(t.metode_pembayaran || '').toUpperCase().includes('WALLET')).reduce((s, t) => s + (t.total || 0), 0);

    const deliveryCount = dayTxs.filter((t) => t.tipe_pesanan === 'DELIVERY_DQM' || t.tipe_pesanan === 'Delivery' || t.orderType === 'DELIVERY_DQM').length;
    const takeawayCount = dayTxs.filter((t) => t.tipe_pesanan === 'BUNGKUS' || t.tipe_pesanan === 'Takeaway' || t.orderType === 'BUNGKUS').length;
    const poCount = dayTxs.filter((t) => t.tipe_pesanan === 'PRE_ORDER' || Boolean(t.poNumber)).length;

    const dayExpenses = expenses.filter((e) => e.tanggal === dateStr);
    const totalExpense = dayExpenses.reduce((s, e) => s + (e.jumlah || 0), 0);
    const estimatedProfit = totalSales - totalExpense;

    // Top selling
    const counts: Record<string, number> = {};
    dayTxs.forEach((t) => {
      t.items?.forEach((i) => {
        counts[i.nama_produk] = (counts[i.nama_produk] || 0) + i.qty;
      });
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topProduct = sorted[0] ? `${sorted[0][0]} (${sorted[0][1]} terjual)` : '-';

    return await this.sendNotification({
      eventId: `DAILY_SUMMARY_${dateStr}`,
      notificationType: 'DAILY_SUMMARY',
      referenceId: dateStr,
      templateVariables: {
        date: dateStr,
        totalTransactions,
        totalSales: formatRupiah(totalSales),
        cashSales: formatRupiah(cashSales),
        transferSales: formatRupiah(transferSales),
        qrisSales: formatRupiah(qrisSales),
        ewalletSales: formatRupiah(ewalletSales),
        deliveryCount,
        takeawayCount,
        poCount,
        totalExpense: formatRupiah(totalExpense),
        estimatedProfit: formatRupiah(estimatedProfit),
        topProduct,
      },
    });
  }

  /**
   * Listen to logs in realtime from Firestore
   */
  static subscribeToLogs(callback: (logs: GoogleChatLog[]) => void): () => void {
    try {
      const colRef = collection(db, 'google_chat_logs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));
      return onSnapshot(
        q,
        (snap) => {
          const list: GoogleChatLog[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as GoogleChatLog);
          });
          callback(list);
        },
        (err) => {
          console.warn('Realtime logs snapshot error:', err);
        }
      );
    } catch {
      return () => {};
    }
  }

  /**
   * Listen to templates in Firestore
   */
  static subscribeToTemplates(callback: (templates: GoogleChatTemplate[]) => void): () => void {
    try {
      const colRef = collection(db, 'google_chat_templates');
      return onSnapshot(
        colRef,
        (snap) => {
          const list: GoogleChatTemplate[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as GoogleChatTemplate);
          });
          if (list.length === 0) {
            callback(DEFAULT_TEMPLATES);
          } else {
            callback(list);
          }
        },
        () => {
          callback(DEFAULT_TEMPLATES);
        }
      );
    } catch {
      callback(DEFAULT_TEMPLATES);
      return () => {};
    }
  }

  static async fetchConfig() {
    return this.fetchServerConfig();
  }

  static async testSpace(spaceId?: string, webhookUrl?: string) {
    return this.testConnection(spaceId, webhookUrl);
  }

  static async disconnectSpace(spaceId?: string) {
    return this.disconnect(spaceId);
  }

  static async getSpaces(): Promise<GoogleChatSpace[]> {
    try {
      const cfg = await this.fetchServerConfig();
      if (cfg?.spaces && cfg.spaces.length > 0) {
        return cfg.spaces;
      }
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'google_chat_spaces'));
      const list: GoogleChatSpace[] = [];
      snap.forEach((d) => list.push(d.data() as GoogleChatSpace));
      return list;
    } catch {
      return [];
    }
  }

  static async getNotificationConfigs(): Promise<GoogleChatNotificationConfig[]> {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'google_chat_notifications'));
      if (snap.empty) {
        return DEFAULT_NOTIFICATION_TYPES.map((type) => {
          const meta = NOTIFICATION_TYPE_LABELS[type] || {
            title: type,
            desc: '',
            category: 'system',
          };
          return {
            type,
            enabled: true,
            spaceId: 'default',
            title: meta.title,
            description: meta.desc,
            category: meta.category,
          };
        });
      }
      const list: GoogleChatNotificationConfig[] = [];
      snap.forEach((d) => list.push(d.data() as GoogleChatNotificationConfig));
      return list;
    } catch {
      return DEFAULT_NOTIFICATION_TYPES.map((type) => {
        const meta = NOTIFICATION_TYPE_LABELS[type] || {
          title: type,
          desc: '',
          category: 'system',
        };
        return {
          type,
          enabled: true,
          spaceId: 'default',
          title: meta.title,
          description: meta.desc,
          category: meta.category,
        };
      });
    }
  }

  static async saveNotificationConfig(cfg: GoogleChatNotificationConfig) {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'google_chat_notifications', cfg.type), cfg, { merge: true });
    return { success: true };
  }

  static async getTemplates(): Promise<GoogleChatTemplate[]> {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'google_chat_templates'));
      if (snap.empty) {
        return DEFAULT_TEMPLATES;
      }
      const list: GoogleChatTemplate[] = [];
      snap.forEach((d) => list.push(d.data() as GoogleChatTemplate));
      return list;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  }

  static async saveTemplate(tpl: GoogleChatTemplate) {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'google_chat_templates', tpl.id), tpl, { merge: true });
    return { success: true };
  }

  static async getLogs(): Promise<GoogleChatLog[]> {
    try {
      await ensureFirebaseAuth();
      const q = query(collection(db, 'google_chat_logs'), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      const list: GoogleChatLog[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          ...data,
          orderNumber: data.orderNumber || data.referenceId,
          contentSnippet: data.contentSnippet || data.messageText,
          errorMessage: data.errorMessage || data.error,
        });
      });
      return list;
    } catch {
      return [];
    }
  }

  static async clearLogs() {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'google_chat_logs'));
      const deletes = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletes);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  static async getSettings(): Promise<GoogleChatSettings> {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'google_chat_settings'));
      if (!snap.empty) {
        return snap.docs[0].data() as GoogleChatSettings;
      }
    } catch {}
    return {
      dailySummaryEnabled: true,
      dailySummaryTime: '22:00',
      lowStockThreshold: 5,
      minDeliveryAmount: 20000,
      quietHoursEnabled: false,
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00',
    };
  }

  static async saveSettings(settings: GoogleChatSettings) {
    await ensureFirebaseAuth();
    await setDoc(doc(db, 'google_chat_settings', 'default'), settings, { merge: true });
    return { success: true };
  }

  static interpolate(template: string, variables: Record<string, string | number>): string {
    let result = template;
    for (const [key, val] of Object.entries(variables)) {
      const rawVal = val !== undefined && val !== null ? String(val) : '';
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), rawVal);
    }
    return result;
  }
}

// Convenient export functions for direct imports in components
export const fetchGoogleChatConfig = () => GoogleChatService.fetchConfig();
export const saveGoogleChatSpace = (space: GoogleChatSpace, rawWebhook?: string) =>
  GoogleChatService.saveSpace(rawWebhook ? { ...space, webhookUrl: rawWebhook } : space);
export const deleteGoogleChatSpace = (spaceId: string) => GoogleChatService.deleteSpace(spaceId);
export const testGoogleChatSpace = (spaceId: string, webhookUrl?: string) =>
  GoogleChatService.testSpace(spaceId, webhookUrl);
export const disconnectGoogleChatSpace = (spaceId: string) =>
  GoogleChatService.disconnectSpace(spaceId);

export const getGoogleChatSpaces = () => GoogleChatService.getSpaces();
export const getNotificationConfigs = () => GoogleChatService.getNotificationConfigs();
export const saveNotificationConfig = (config: GoogleChatNotificationConfig) =>
  GoogleChatService.saveNotificationConfig(config);

export const getGoogleChatTemplates = () => GoogleChatService.getTemplates();
export const saveTemplate = (template: GoogleChatTemplate) =>
  GoogleChatService.saveTemplate(template);

export const getGoogleChatLogs = () => GoogleChatService.getLogs();
export const retrySendNotification = (log: GoogleChatLog) => GoogleChatService.retryLog(log);
export const clearLogs = () => GoogleChatService.clearLogs();
export const subscribeGoogleChatLogs = (callback: (logs: GoogleChatLog[]) => void) =>
  GoogleChatService.subscribeToLogs(callback);

export const getGoogleChatSettings = () => GoogleChatService.getSettings();
export const saveGoogleChatSettings = (settings: GoogleChatSettings) =>
  GoogleChatService.saveSettings(settings);

export const triggerDailySummaryNotification = async (
  transactions?: Transaction[],
  expenses?: Expense[],
  dateStr?: string
) => {
  const txs = transactions || StorageService.getTransactions();
  const exps = expenses || StorageService.getExpenses();
  return await GoogleChatService.dispatchDailySummary(txs, exps, dateStr);
};

export const interpolateTemplate = (
  template: string,
  variables: Record<string, string | number>
) => GoogleChatService.interpolate(template, variables);
