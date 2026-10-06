import {
  Product,
  ProductVariant,
  Transaction,
  StoreSettings,
  WABotChatMessage,
  OrderType,
} from '../types';
import {
  formatRupiah,
  sanitizeWhatsAppNumber,
  checkStoreStatus,
  DELIVERY_MIN_ORDER_AMOUNT,
} from '../utils/formatters';
import { saveOrderToFirebase, logAuditActivity } from './firebase';

export interface WABotSessionState {
  step:
    | 'IDLE'
    | 'SELECTING_PRODUCT'
    | 'SELECTING_VARIANT'
    | 'SELECTING_QTY'
    | 'ADDING_NOTES'
    | 'SELECTING_SERVICE_TYPE'
    | 'ASKING_DELIVERY_LOCATION'
    | 'ASKING_DELIVERY_DETAIL'
    | 'ASKING_CUSTOMER_NAME'
    | 'ASKING_CUSTOMER_PHONE'
    | 'SELECTING_PAYMENT'
    | 'CONFIRMATION'
    | 'CHECKING_STATUS'
    | 'PO_NAME'
    | 'PO_PHONE'
    | 'PO_DATE'
    | 'PO_TIME'
    | 'PO_LOCATION'
    | 'PO_GUESTS'
    | 'PO_MENU'
    | 'PO_BUDGET'
    | 'PO_CONFIRMATION';
  currentProduct?: Product;
  currentVariant?: ProductVariant;
  tempQty?: number;
  tempNotes?: string;
  cart: Array<{
    product: Product;
    variant?: ProductVariant;
    qty: number;
    notes?: string;
    subtotal: number;
  }>;
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryLocation?: string;
  deliveryDetail?: string;
  deliveryNote?: string;
  paymentMethod: string;
  // PO Temp Fields
  poData?: {
    name: string;
    phone: string;
    date: string;
    time: string;
    location: string;
    guests: number;
    menuDesc: string;
    budget?: number;
  };
}

export const INITIAL_WABOT_SESSION: WABotSessionState = {
  step: 'IDLE',
  cart: [],
  orderType: 'BUNGKUS',
  customerName: '',
  customerPhone: '',
  paymentMethod: 'Cash',
};

export class WABotService {
  /**
   * Menghasilkan pesan pembuka / Menu Utama
   */
  static getWelcomeMessage(settings: StoreSettings): WABotChatMessage {
    const storeStatus = checkStoreStatus(settings);
    const storeName = settings.storeName || 'WARUNG BANG KOBRA';

    let header = `👋 Halo, selamat datang di *${storeName}*.\n\nSaya asisten otomatis resmi yang siap melayani pesanan Anda secara cepat & ramah!`;
    if (!storeStatus.isOpen) {
      header = `👋 Halo, selamat datang di *${storeName}*.\n\n⚠️ *Pemberitahuan:* ${storeStatus.reason}\n(Anda tetap dapat melihat daftar menu & info, pemesanan dapat dilakukan saat jam operasional).`;
    }

    const text = `${header}

Silakan ketik nomor atau pilih tombol di bawah:
1️⃣ *Lihat Menu*
2️⃣ *Pesan Sekarang*
3️⃣ *Cek Status Pesanan*
4️⃣ *Info Delivery*
5️⃣ *Pesanan Acara / PO*
6️⃣ *Hubungi Kasir*`;

    return {
      id: `msg-${Date.now()}`,
      sender: 'bot',
      text,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      quickReplies: [
        { id: 'qr-menu', label: '1️⃣ Lihat Menu', payload: '1' },
        { id: 'qr-order', label: '2️⃣ Pesan Sekarang', payload: '2' },
        { id: 'qr-status', label: '3️⃣ Cek Status Pesanan', payload: '3' },
        { id: 'qr-delivery', label: '4️⃣ Info Delivery', payload: '4' },
        { id: 'qr-po', label: '5️⃣ Pesanan Acara / PO', payload: '5' },
        { id: 'qr-kasir', label: '6️⃣ Hubungi Kasir', payload: '6' },
      ],
    };
  }

  /**
   * Menampilkan katalog menu dari database
   */
  static getMenuCatalogMessage(
    products: Product[],
    variants: ProductVariant[],
    categoryFilter?: string
  ): WABotChatMessage {
    const activeProducts = products.filter((p) => p.status !== 'Nonaktif');

    // Grouping per category
    const categories = ['Makanan', 'Minuman', 'Snack', 'Tambahan'];
    const filteredCats = categoryFilter ? [categoryFilter] : categories;

    let output = `🍽️ *DAFTAR MENU RESMI WARUNG BANG KOBRA*\n\n`;

    filteredCats.forEach((cat) => {
      const catProducts = activeProducts.filter((p) => p.kategori === cat);
      if (catProducts.length === 0) return;

      output += `📌 *${cat.toUpperCase()}*\n`;
      catProducts.forEach((p, idx) => {
        const isOutOfStock = p.stok <= 0;
        const statusBadge = isOutOfStock ? '❌ HABIS' : '✅ Tersedia';
        const prodVars = variants.filter((v) => v.productId === p.id && v.isActive);

        output += `${idx + 1}. *${p.nama}* — ${formatRupiah(p.harga_jual)} [${statusBadge}]\n`;
        if (p.deskripsi) {
          output += `   _${p.deskripsi}_\n`;
        }
        if (prodVars.length > 0) {
          const varNames = prodVars.map((v) => v.variantName).join(', ');
          output += `   ↳ Varian: ${varNames}\n`;
        }
      });
      output += `\n`;
    });

    output += `Ketik *2* atau klik *Pesan Sekarang* untuk mulai memilih hidangan favorit Anda!`;

    return {
      id: `msg-${Date.now()}`,
      sender: 'bot',
      text: output,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      quickReplies: [
        { id: 'qr-order', label: '🛒 Pesan Sekarang', payload: '2' },
        { id: 'qr-makanan', label: '🍛 Makanan Saja', payload: 'filter_Makanan' },
        { id: 'qr-minuman', label: '🥤 Minuman Saja', payload: 'filter_Minuman' },
        { id: 'qr-home', label: '🏠 Menu Utama', payload: 'menu' },
      ],
    };
  }

  /**
   * Menampilkan informasi Delivery DQM
   */
  static getDeliveryInfoMessage(settings: StoreSettings): WABotChatMessage {
    const minDelivery = settings.deliveryMinOrder || DELIVERY_MIN_ORDER_AMOUNT;
    const areaName = settings.deliveryAreaName || 'Sekitar Pesantren DQM';
    const hours = settings.deliveryHours || '09:00 - 21:00 WIB';

    const text = `🛵 *INFORMASI LAYANAN DELIVERY WARUNG BANG KOBRA*

📍 *Area Layanan:* ${areaName}
💰 *Minimal Belanja:* ${formatRupiah(minDelivery)}
⏰ *Jam Pengantaran:* ${hours}
🏷️ *Biaya Pengantaran:* ${(settings.deliveryFeeType || 'FREE') === 'FREE' ? 'GRATIS ONGKIR' : formatRupiah(settings.deliveryFeeAmount || 2000)}

*Tujuan Gedung yang Didukung:*
• Asrama Putra DQM
• Asrama Putri DQM
• Gedung Sekolah / Kelas
• Kantor / Sekretariat
• Masjid / Aula DQM
• Rumah Ustadz / Pengajar
• Pos Keamanan / Gerbang DQM

_Pesanan diantar langsung oleh kurir internal kami dengan aman & higienis._`;

    return {
      id: `msg-${Date.now()}`,
      sender: 'bot',
      text,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      quickReplies: [
        { id: 'qr-order-deliv', label: '🛵 Pesan Delivery Sekarang', payload: 'pesan_delivery' },
        { id: 'qr-home', label: '🏠 Menu Utama', payload: 'menu' },
      ],
    };
  }

  /**
   * Format nomor transaksi unik
   */
  static generateInvoiceId(prefix = 'WBK'): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${y}${m}${d}-${rand}`;
  }

  /**
   * Hitung subtotal dan total keranjang
   */
  static calculateTotals(
    cart: WABotSessionState['cart'],
    orderType: OrderType,
    settings: StoreSettings
  ) {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const deliveryFee =
      orderType === 'DELIVERY_DQM'
        ? (settings.deliveryFeeType || 'FREE') === 'FREE'
          ? 0
          : Number(settings.deliveryFeeAmount || 2000)
        : 0;
    const total = subtotal + deliveryFee;
    return { subtotal, deliveryFee, total };
  }

  /**
   * Ringkasan Pesanan Teks
   */
  static formatOrderSummary(
    session: WABotSessionState,
    settings: StoreSettings,
    tempInvoiceId: string
  ): string {
    const { subtotal, deliveryFee, total } = this.calculateTotals(session.cart, session.orderType, settings);

    let itemsText = '';
    session.cart.forEach((item, idx) => {
      const vText = item.variant ? ` (${item.variant.variantName})` : '';
      const notesText = item.notes ? ` [${item.notes}]` : '';
      itemsText += `${idx + 1}. ${item.product.nama}${vText} x${item.qty} = ${formatRupiah(item.subtotal)}${notesText}\n`;
    });

    const serviceText = session.orderType === 'DELIVERY_DQM' ? '🛵 DELIVERY PESANTREN DQM' : '📦 BUNGKUS / TAKEAWAY';
    const locText =
      session.orderType === 'DELIVERY_DQM'
        ? `\n📍 Lokasi: ${session.deliveryLocation || '-'}\n🏢 Detail/Kamar: ${session.deliveryDetail || '-'}`
        : '';

    return `🧾 *RINGKASAN PESANAN WARUNG BANG KOBRA*
No. Pesanan: *${tempInvoiceId}*
Layanan: *${serviceText}*
Nama Pemesan: *${session.customerName || '-'}*
No. WhatsApp: *${session.customerPhone || '-'}*${locText}
Metode Bayar: *${session.paymentMethod}*

*Daftar Menu:*
${itemsText}
Subtotal: *${formatRupiah(subtotal)}*
Delivery: *${deliveryFee > 0 ? formatRupiah(deliveryFee) : 'GRATIS'}*
*TOTAL PEMBAYARAN:* *${formatRupiah(total)}*`;
  }

  /**
   * Simpan Pesanan ke Firebase Firestore
   */
  static async submitOrderToFirebase(
    session: WABotSessionState,
    settings: StoreSettings,
    invoiceId: string
  ): Promise<{ success: boolean; error?: string; order?: Transaction }> {
    const { subtotal, deliveryFee, total } = this.calculateTotals(session.cart, session.orderType, settings);
    const now = new Date();

    const newOrder: Transaction = {
      id_transaksi: invoiceId,
      tanggal: now.toISOString().split('T')[0],
      jam: now.toTimeString().split(' ')[0],
      kasir: 'WA Bot Otomatis',
      nama_pelanggan: session.customerName || 'Pelanggan WhatsApp',
      no_whatsapp: session.customerPhone || settings.whatsappNumber || '',
      email_pelanggan: session.customerEmail || '',
      subtotal,
      diskon: 0,
      biaya: deliveryFee,
      total,
      metode_pembayaran: (session.paymentMethod as any) || 'Cash',
      uang_diterima: session.paymentMethod === 'Cash' ? total : 0,
      kembalian: 0,
      status: 'MENUNGGU',
      orderType: session.orderType,
      tipe_pesanan: session.orderType,
      created_at: now.toISOString(),
      items: session.cart.map((item, idx) => ({
        id_detail: `DET-${invoiceId}-${idx + 1}`,
        id_transaksi: invoiceId,
        id_produk: item.product.id,
        nama_produk: item.product.nama,
        variantId: item.variant?.variantId,
        variantName: item.variant?.variantName,
        harga: item.variant ? item.variant.price : item.product.harga_jual,
        qty: item.qty,
        subtotal: item.subtotal,
        catatan: item.notes,
      })),
      ...(session.orderType === 'DELIVERY_DQM'
        ? {
            deliveryArea: 'DQM',
            deliveryLocation: session.deliveryLocation,
            deliveryDetail: session.deliveryDetail,
            deliveryNote: session.deliveryNote,
            deliveryFee,
            deliveryStatus: 'MENUNGGU',
            alamat_pengantaran: `Pesantren DQM - ${session.deliveryLocation || ''} (${session.deliveryDetail || ''})`,
          }
        : {
            tipe_pesanan: 'BUNGKUS',
          }),
      catatan_pesanan: session.deliveryNote || '',
    };

    try {
      const res = await saveOrderToFirebase(newOrder);
      if (res.success) {
        logAuditActivity(
          'WABOT_NEW_ORDER',
          `Pesanan baru via WA Bot: ${invoiceId} oleh ${newOrder.nama_pelanggan} (${formatRupiah(total)})`,
          'WA BOT',
          'TRANSACTION'
        ).catch(() => {});
        return { success: true, order: newOrder };
      }
      return { success: false, error: res.error || 'Gagal menyimpan pesanan ke cloud Firestore' };
    } catch (err: any) {
      console.error('WABot submit order error:', err);
      return { success: false, error: err?.message || 'Koneksi database bermasalah' };
    }
  }

  /**
   * Cek Status Pesanan berdasarkan Nomor Pesanan atau Nomor WA
   */
  static checkOrderStatus(
    query: string,
    transactions: Transaction[]
  ): WABotChatMessage {
    const q = query.trim().toUpperCase();

    // Cari by ID atau No WA
    const found = transactions.filter((t) => {
      const idMatch = t.id_transaksi && t.id_transaksi.toUpperCase().includes(q);
      const phoneClean = sanitizeWhatsAppNumber(t.no_whatsapp);
      const qPhoneClean = sanitizeWhatsAppNumber(query);
      const phoneMatch = qPhoneClean.length >= 6 && phoneClean.includes(qPhoneClean);
      return idMatch || phoneMatch;
    });

    if (found.length === 0) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'bot',
        text: `🔍 Pesanan dengan kata kunci *"${query}"* tidak ditemukan di sistem kami.\n\nPastikan nomor pesanan berformat contoh *WBK-20261006-1234* atau masukkan nomor WhatsApp yang Anda gunakan saat memesan.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        quickReplies: [
          { id: 'qr-help-kasir', label: '👨💼 Hubungi Kasir', payload: '6' },
          { id: 'qr-home', label: '🏠 Menu Utama', payload: 'menu' },
        ],
      };
    }

    // Ambil order terakhir
    const latest = found[0];
    const status = (latest.status || 'MENUNGGU').toUpperCase();

    let statusEmoji = '🟡';
    let statusDesc = 'Menunggu Konfirmasi Kasir';

    if (status === 'DIPROSES' || status === 'PENDING') {
      statusEmoji = '🔵';
      statusDesc = 'Sedang Disiapkan di Dapur';
    } else if (status === 'SIAP' || status === 'SIAP DIAMBIL') {
      statusEmoji = '🟠';
      statusDesc = latest.orderType === 'DELIVERY_DQM' ? 'Siap Diantar Kurir' : 'Siap Diambil di Kasir';
    } else if (status === 'SELESAI') {
      statusEmoji = '🟢';
      statusDesc = 'Pesanan Selesai';
    } else if (status === 'DIBATALKAN') {
      statusEmoji = '🔴';
      statusDesc = 'Pesanan Dibatalkan';
    }

    let itemsList = '';
    latest.items?.forEach((i, idx) => {
      itemsList += `• ${i.nama_produk} (${i.qty}x)\n`;
    });

    const isDelivery = latest.orderType === 'DELIVERY_DQM';
    const delivStatus = latest.deliveryStatus ? `\nStatus Kurir: *${latest.deliveryStatus}*` : '';

    const text = `📋 *STATUS PESANAN TERKINI*
No. Pesanan: *${latest.id_transaksi}*
Pemesan: *${latest.nama_pelanggan}*
Layanan: *${isDelivery ? '🛵 Delivery Pesantren DQM' : '📦 Bungkus / Takeaway'}*
Status: ${statusEmoji} *${statusDesc}*${delivStatus}
Total: *${formatRupiah(latest.total)}*
Waktu: ${latest.jam || '-'} WIB

*Daftar Menu:*
${itemsList || '-'}
${status === 'SIAP' && !isDelivery ? '👉 _Silakan menuju kasir untuk mengambil pesanan Anda._' : ''}
${status === 'DIPROSES' ? '⏳ _Mohon ditunggu, pesanan Anda sedang dimasak fresh oleh tim dapur._' : ''}`;

    return {
      id: `msg-${Date.now()}`,
      sender: 'bot',
      text,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      quickReplies: [
        { id: 'qr-refresh-status', label: '🔄 Cek Status Lagi', payload: `status_${latest.id_transaksi}` },
        { id: 'qr-home', label: '🏠 Menu Utama', payload: 'menu' },
        { id: 'qr-kasir', label: '👨💼 Hubungi Kasir', payload: '6' },
      ],
    };
  }

  /**
   * Formulir Pre-Order Acara
   */
  static async submitPOToFirebase(
    poData: NonNullable<WABotSessionState['poData']>,
    settings: StoreSettings
  ): Promise<{ success: boolean; poId: string; error?: string }> {
    const poId = this.generateInvoiceId('PO-WBK');
    const now = new Date();

    const poTransaction: Transaction = {
      id_transaksi: poId,
      poNumber: poId,
      tanggal: poData.date || now.toISOString().split('T')[0],
      jam: poData.time || '10:00',
      kasir: 'WA Bot PO System',
      nama_pelanggan: poData.name,
      no_whatsapp: poData.phone,
      subtotal: poData.budget || 100000,
      diskon: 0,
      biaya: 0,
      total: poData.budget || 100000,
      metode_pembayaran: 'Transfer',
      uang_diterima: 0,
      kembalian: 0,
      status: 'MENUNGGU',
      orderType: 'PRE_ORDER',
      tipe_pesanan: 'PRE_ORDER',
      created_at: now.toISOString(),
      items: [
        {
          id_detail: `DET-${poId}-1`,
          id_transaksi: poId,
          id_produk: 'PO-CUSTOM',
          nama_produk: `Katering Acara: ${poData.menuDesc.slice(0, 40)}`,
          harga: poData.budget || 100000,
          qty: 1,
          subtotal: poData.budget || 100000,
          catatan: `Jumlah Tamu/Porsi: ${poData.guests}. Lokasi: ${poData.location}`,
        },
      ],
      eventType: 'Katering Acara',
      eventDate: poData.date,
      eventTime: poData.time,
      guestCount: poData.guests,
      eventLocation: poData.location,
      dpRequired: Math.round((poData.budget || 100000) * 0.5),
      dpPaid: 0,
      remainingPayment: poData.budget || 100000,
      paymentStatus: 'BELUM_BAYAR',
      poStatus: 'MENUNGGU_KONFIRMASI',
      notes: `Pesanan PO via WA Bot.\nMenu: ${poData.menuDesc}\nLokasi: ${poData.location}`,
    };

    try {
      const res = await saveOrderToFirebase(poTransaction);
      if (res.success) {
        logAuditActivity(
          'WABOT_NEW_PO',
          `Pre-Order Acara baru via WA Bot: ${poId} untuk ${poData.name} pada ${poData.date}`,
          'WA BOT',
          'PRE_ORDER'
        ).catch(() => {});
        return { success: true, poId };
      }
      return { success: false, poId, error: res.error };
    } catch (err: any) {
      return { success: false, poId, error: err.message };
    }
  }
}
