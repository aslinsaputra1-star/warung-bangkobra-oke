export type ProductCategory = 'Makanan' | 'Minuman' | 'Snack' | 'Tambahan' | 'Lainnya';
export type PaymentMethod = 'Cash' | 'QRIS' | 'Transfer' | 'E-wallet' | 'Lainnya';
export type UserRole =
  | 'Owner'
  | 'Admin'
  | 'Kasir'
  | 'Staff'
  | 'Delivery'
  | 'Customer'
  | 'ADMIN'
  | 'KASIR'
  | 'DELIVERY';
export type ExpenseCategory = 'Pembelian bahan' | 'Listrik' | 'Gas' | 'Operasional' | 'Gaji' | 'Lainnya';

export type OrderType = 'BUNGKUS' | 'DELIVERY_DQM' | 'PRE_ORDER';

export type POStatus =
  | 'MENUNGGU_KONFIRMASI'
  | 'DIKONFIRMASI'
  | 'MENUNGGU_DP'
  | 'DP_DITERIMA'
  | 'DIPROSES'
  | 'SIAP_DIAMBIL'
  | 'DALAM_PENGIRIMAN'
  | 'SELESAI'
  | 'DIBATALKAN';

export type POPaymentStatus = 'BELUM_BAYAR' | 'DP' | 'LUNAS' | 'REFUND';

export interface POPaymentRecord {
  id: string;
  amount: number;
  type: 'DP' | 'PELUNASAN' | 'REFUND';
  method: PaymentMethod | string;
  date: string;
  note?: string;
  verifiedBy?: string;
  proofUrl?: string;
}

export type DeliveryStatus =
  | 'MENUNGGU'
  | 'DIANTAR'
  | 'SAMPAI'
  | 'DITERIMA'
  | 'GAGAL DIANTAR'
  | 'DIPROSES'
  | 'SIAP DIANTAR'
  | 'SELESAI'
  | 'DIBATALKAN';

export interface DeliveryProof {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  destination: 'DQM';
  detailLocation: string;
  courierId?: string;
  courierName: string;
  receiverName: string;
  receiverPhone: string;
  status: DeliveryStatus;
  deliveryStatus: DeliveryStatus;
  proofPhotoUrl: string;
  deliveryNote: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
  receiptSharedAt?: string;
  receiptSharedBy?: string;
  receiptShareMethod?: 'WHATSAPP' | 'PRINT' | 'PDF' | string;
}

export type OrderQueueStatus =
  | 'MENUNGGU'
  | 'DIPROSES'
  | 'SIAP'
  | 'SELESAI'
  | 'DIBATALKAN';

export type EmailReceiptStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface ReceiptEmailAttempt {
  attempt: number;
  status: EmailReceiptStatus;
  timestamp: string;
  email: string;
  note?: string;
}

export interface ReceiptEmailLog {
  id: string;
  id_transaksi: string;
  queueNumber?: string;
  nama_pelanggan: string;
  email_pelanggan: string;
  total: number;
  orderType: OrderType;
  status: EmailReceiptStatus;
  provider?: string;
  attemptCount: number;
  idempotencyKey: string;
  messageId?: string;
  errorMessage?: string;
  sentBy: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  lastAttemptAt: string;
  history: ReceiptEmailAttempt[];
}

export interface ProductVariant {
  variantId: string;
  productId: string;
  productName?: string;
  variantName: string;
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  nama: string;
  kategori: ProductCategory;
  harga_modal: number;
  harga_jual: number;
  satuan: string;
  stok: number;
  stok_minimum: number;
  foto: string;
  gambar_url?: string;
  status: 'Aktif' | 'Nonaktif';
  deskripsi?: string;
  hasVariants?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product: Product;
  variant?: ProductVariant;
  qty: number;
  subtotal: number;
  catatan?: string;
}

export interface TransactionDetail {
  id_detail: string;
  id_transaksi: string;
  id_produk: string;
  nama_produk: string;
  productName?: string;
  variantId?: string;
  variantName?: string;
  harga_modal?: number;
  harga: number;
  qty: number;
  subtotal: number;
  catatan?: string;
}

export interface Transaction {
  id_transaksi: string; // e.g. WKB-20260908-001
  tanggal: string; // YYYY-MM-DD
  jam: string; // HH:mm:ss
  kasir: string;
  nama_pelanggan: string;
  no_whatsapp: string;
  email_pelanggan?: string;
  subtotal: number;
  diskon: number;
  biaya: number;
  total: number;
  metode_pembayaran: PaymentMethod;
  uang_diterima: number;
  kembalian: number;
  status:
    | 'Selesai'
    | 'Dibatalkan'
    | 'Pending'
    | 'Diproses'
    | 'Siap'
    | 'MENUNGGU'
    | 'DIPROSES'
    | 'SIAP'
    | 'SELESAI'
    | 'DIBATALKAN';
  items: TransactionDetail[];
  created_at: string;
  orderType?: OrderType;
  deliveryArea?: 'DQM' | null;
  deliveryLocation?: string | null;
  deliveryDetail?: string | null;
  deliveryNote?: string | null;
  deliveryFee?: number;
  deliveryStatus?: DeliveryStatus | null;
  deliveryId?: string;
  courierId?: string;
  courierName?: string;
  sentAt?: string;
  deliveredAt?: string;
  receiverName?: string;
  receiverPhone?: string;
  proofPhotoUrl?: string;
  updated_at?: string;
  queueNumber?: string;
  tipe_pesanan?: 'BUNGKUS' | 'DELIVERY_DQM' | 'Takeaway' | 'Delivery' | 'PRE_ORDER';
  alamat_pengantaran?: string;
  catatan_pesanan?: string;
  receiptSharedAt?: string;
  receiptSharedBy?: string;
  receiptShareMethod?: 'WHATSAPP' | 'PRINT' | 'PDF' | 'EMAIL' | string;
  emailReceiptStatus?: EmailReceiptStatus;
  emailReceiptSentAt?: string;
  emailReceiptTarget?: string;
  emailReceiptError?: string;
  emailReceiptAttempts?: number;
  stockRestored?: boolean;
  // Pre-Order (PO) Specific Fields
  poNumber?: string;
  eventType?: string;
  eventDate?: string; // YYYY-MM-DD
  eventTime?: string; // HH:mm
  guestCount?: number;
  deliveryType?: 'BUNGKUS' | 'DELIVERY_DQM' | 'TAKEAWAY' | 'DELIVERY';
  eventLocation?: string;
  dpRequired?: number;
  dpPaid?: number;
  remainingPayment?: number;
  paymentStatus?: POPaymentStatus;
  paymentHistory?: POPaymentRecord[];
  poStatus?: POStatus;
  dpProofUrl?: string;
  notes?: string;
  poStockDeducted?: boolean;
}

export interface StockMutation {
  id: string;
  tanggal: string;
  id_produk: string;
  variantId?: string;
  variantName?: string;
  nama_produk: string;
  jenis: 'in' | 'out' | 'adjustment';
  qty: number;
  stok_sebelum: number;
  stok_sesudah: number;
  keterangan: string;
}

export interface Customer {
  id: string;
  nama: string;
  no_whatsapp: string;
  whatsapp?: string;
  email?: string;
  alamat?: string;
  catatan?: string;
  total_transaksi: number;
  total_belanja: number;
  last_order?: string;
  created_at?: string;
}

export interface Expense {
  id: string;
  tanggal: string;
  kategori: ExpenseCategory | string;
  keterangan: string;
  jumlah: number;
  catatan?: string;
  diinput_oleh?: string;
  created_at: string;
}

export interface CashRecord {
  id: string;
  tanggal: string;
  jenis: 'Masuk' | 'Keluar';
  keterangan: string;
  nominal: number;
  saldo: number;
}

export interface DayOperatingHour {
  day: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface EWalletAccount {
  id: string;
  provider: 'GoPay' | 'OVO' | 'DANA' | 'ShopeePay' | 'LinkAja' | string;
  accountNumber: string;
  accountName: string;
  qrCodeUrl?: string;
  isActive: boolean;
}

export interface StoreSettings {
  storeName: string;
  ownerName?: string;
  tagline: string;
  storeSlogan?: string;
  address: string;
  storeAddress?: string;
  whatsappNumber: string;
  storeEmail?: string;
  storePhone?: string;
  storeWebsite?: string;
  storeInstagram?: string;
  storeFacebook?: string;
  storeDescription?: string;
  logoUrl: string;
  receiptLogoUrl?: string;
  receiptFooter: string;
  receiptPaperSize?: '58mm' | '80mm' | 'A4';
  currency: string;
  taxPercent: number;
  defaultDiscount: number;
  googleAppsScriptUrl?: string;
  googleSheetsUrl?: string;
  isGoogleSheetsConnected?: boolean;
  lastSyncTime?: string;
  autoSync: boolean;
  stockControl: boolean;
  qrisImageUrl: string;
  qrisUrl?: string;
  qrisMerchantName?: string;
  qrisNmid?: string;
  qrisEnabled?: boolean;
  qrisInstruction?: string;
  qrisStoragePath?: string;
  qrisUpdatedAt?: string;
  activeCashier: string;
  role: UserRole;
  theme: 'dark' | 'light' | 'system';
  // Branding
  themePrimaryColor?: string;
  themeSecondaryColor?: string;
  themeAccentColor?: string;
  themeBgColor?: string;
  themeTextColor?: string;
  themeFont?: 'Inter' | 'Poppins' | 'System';
  themeRadius?: 'small' | 'medium' | 'large';
  themeDensity?: 'compact' | 'comfortable' | 'spacious';
  // Operating Hours
  operatingHours?: DayOperatingHour[];
  is24Hours?: boolean;
  isTempClosed?: boolean;
  tempClosedReason?: string;
  holidayDates?: string[];
  specialHoursNote?: string;
  allowBrowsingWhenClosed?: boolean;
  // POS
  invoicePrefix: string;
  invoiceCounterStart?: number;
  invoiceResetPeriod?: 'DAILY' | 'MONTHLY' | 'NEVER';
  dateFormat?: string;
  timeFormat?: string;
  roundingMethod?: 'NONE' | 'UP_100' | 'UP_500' | 'UP_1000' | 'DOWN_100';
  posAllowDiscount?: boolean;
  posAllowManualPrice?: boolean;
  posAllowPriceEdit?: boolean;
  posRequireCustomer?: boolean;
  posAllowItemNotes?: boolean;
  posConfirmCancel?: boolean;
  posConfirmDeleteItem?: boolean;
  posAutoPrintReceipt?: boolean;
  posShowReceiptModal?: boolean;
  posAutoSendWhatsApp?: boolean;
  posAutoSendEmail?: boolean;
  // Pembayaran
  paymentCashEnabled?: boolean;
  paymentTransferEnabled?: boolean;
  paymentQrisEnabled?: boolean;
  paymentEwalletEnabled?: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  ewallets?: EWalletAccount[];
  // Online Menu / Online Order
  onlineMenuEnabled?: boolean;
  customerAppUrl?: string;
  onlineMenuBannerText?: string;
  onlineMenuHours?: string;
  onlineMenuBankInfo?: string;
  onlineMenuIsOpen?: boolean;
  onlineMenuAnnouncement?: string;
  onlineMenuMinOrder?: number;
  onlineAllowGuest?: boolean;
  onlineRequireLogin?: boolean;
  onlineRequireWa?: boolean;
  onlineRequireEmail?: boolean;
  onlineRequireAddressForDelivery?: boolean;
  onlineAllowNotes?: boolean;
  onlineAutoConfirm?: boolean;
  // Takeaway
  takeawayEnabled?: boolean;
  takeawayServiceName?: string;
  takeawayEstimatedMinutes?: number;
  takeawayQueuePrefix?: string;
  takeawayPickupInstructions?: string;
  // Delivery
  deliveryDqmEnabled?: boolean;
  deliveryAreaName?: string;
  deliveryMinOrder?: number;
  deliveryFeeType?: 'FREE' | 'FIXED';
  deliveryFeeAmount?: number;
  deliveryFreeEnabled?: boolean;
  deliveryFreeMinOrder?: number;
  deliveryHours?: string;
  deliveryEstimatedMinutes?: number;
  deliveryMaxRadiusKm?: number;
  deliveryAreasList?: string[];
  deliveryDqmNote?: string;
  // Pre-Order (PO)
  poEnabled?: boolean;
  poServiceName?: string;
  poMinOrderAmount?: number;
  poMinDaysAhead?: number;
  poRequireDp?: boolean;
  poDpType?: 'PERCENT' | 'FIXED';
  poDpPercent?: number;
  poDpFixedAmount?: number;
  poPaymentDeadlineDays?: number;
  poReminderDaysBefore?: number;
  poTermsAndConditions?: string;
  poBankTransferInfo?: string;
  poBankInfo?: string;
  poTerms?: string;
  poQrisInfo?: string;
  // Produk & Varian
  productOutOfStockBehavior?: 'HIDE' | 'SHOW_DISABLED';
  defaultMinStock?: number;
  defaultUnit?: string;
  productImageMaxSizeBytes?: number;
  productAutoCompressImages?: boolean;
  variantsEnabled?: boolean;
  variantsRequireSelection?: boolean;
  variantsMaxPerProduct?: number;
  // Stok
  allowNegativeStock?: boolean;
  notifyLowStock?: boolean;
  notifyOutOfStock?: boolean;
  adjustmentReasons?: string[];
  // Struk
  receiptShowLogo?: boolean;
  receiptShowStoreName?: boolean;
  receiptShowAddress?: boolean;
  receiptShowWhatsApp?: boolean;
  receiptShowEmail?: boolean;
  receiptShowCashier?: boolean;
  receiptShowCustomer?: boolean;
  receiptShowQris?: boolean;
  receiptShowQrCode?: boolean;
  // Email
  emailSenderName?: string;
  emailSenderAddress?: string;
  emailReceiptEnabled?: boolean;
  emailOrderConfirmationEnabled?: boolean;
  emailOrderReadyEnabled?: boolean;
  emailPoNotificationEnabled?: boolean;
  emailDeliveryNotificationEnabled?: boolean;
  // WhatsApp
  cashierWhatsappNumber?: string;
  waTemplateChatKasir?: string;
  waTemplateOrderConfirmation?: string;
  waTemplateOrderReady?: string;
  waTemplateDelivery?: string;
  waTemplatePO?: string;
  waTemplateReceipt?: string;
  // QR Code
  qrMenuTitle?: string;
  qrOrderTitle?: string;
  qrPromoTitle?: string;
  qrTokoTitle?: string;
  // Notifikasi
  notificationSoundEnabled?: boolean;
  notificationVibrateEnabled?: boolean;
  notificationSoundVolume?: number;
  notifyNewOrder?: boolean;
  notifyPayment?: boolean;
  notifyOrderReady?: boolean;
  notifyDelivery?: boolean;
  notifyPO?: boolean;
  // PWA
  pwaAppName?: string;
  pwaShortName?: string;
  pwaThemeColor?: string;
  pwaBgColor?: string;
  pwaInstallPromptEnabled?: boolean;
  // Pelanggan
  customerAllowGuest?: boolean;
  customerRequireWhatsApp?: boolean;
  customerAllowSelfHistory?: boolean;
  // Menu Ad Promo Banner
  menuAdActive?: boolean;
  menuAdTitle?: string;
  menuAdText?: string;
  menuAdBadge?: string;
  menuAdDiscountPercent?: number;
  menuAdTargetCategory?: string;
  menuAdTargetProductId?: string;
  menuAdButtonText?: string;
  menuAdTheme?: 'fire' | 'amber' | 'emerald' | 'purple';
  menuAdImageUrl?: string;
  // WhatsApp Bot System
  wabotEnabled?: boolean;
  wabotConfig?: WABotConfig;
}

export interface WABotConfig {
  isEnabled: boolean;
  botPhoneNumber: string;
  botName: string;
  greetingMessage: string;
  closedMessage: string;
  orderConfirmationTemplate: string;
  deliveryTemplate: string;
  receiptTemplate: string;
  poTemplate: string;
  cashierWaLink: string;
  minDeliveryAmount: number;
  deliveryAreaName: string;
  autoReplyUnknown: string;
  webhookSecret?: string;
  lastActiveAt?: string;
}

export interface WABotChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  quickReplies?: Array<{ id: string; label: string; payload: string }>;
  imageUrl?: string;
  isOrderSummary?: boolean;
  orderData?: Partial<Transaction>;
  poData?: any;
}

export interface SyncState {
  lastSync: string | null;
  isOnline: boolean;
  isSyncing: boolean;
  syncedCount: number;
  error: string | null;
}

export type ActiveTab =
  | 'dashboard'
  | 'pos'
  | 'orders'
  | 'preorders'
  | 'delivery_dqm'
  | 'whatsapp_order'
  | 'wabot'
  | 'whatsapp_status'
  | 'products'
  | 'categories'
  | 'stock'
  | 'customers'
  | 'expenses'
  | 'reports'
  | 'users'
  | 'qrcode_order'
  | 'public_menu'
  | 'menu_ads'
  | 'login'
  | 'settings'
  | 'maintenance'
  | 'ai_bot';

export * from './maintenance';

export interface CategoryItem {
  id: string;
  nama: string;
  deskripsi?: string;
  icon?: string;
  urutan?: number;
  status: 'Aktif' | 'Nonaktif';
}

export interface WarungUser {
  id: string;
  nama: string;
  username: string;
  email?: string;
  role: UserRole;
  pin: string;
  no_hp?: string;
  avatar_url?: string;
  status: 'Aktif' | 'Nonaktif';
  total_transaksi?: number;
  total_omset?: number;
  terakhir_aktif?: string;
  created_at?: string;
}

export type AuthUser = WarungUser;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type WhatsAppStatusTemplateType =
  | 'PROMO_HARI_INI'
  | 'PROMO_MINUMAN'
  | 'PROMO_MIE'
  | 'PROMO_MAKANAN'
  | 'PAKET_HEMAT'
  | 'PROMO_DELIVERY'
  | 'PROMO_WEEKEND'
  | 'FLASH_SALE'
  | 'FAVORIT_PELANGGAN'
  | 'MENU_BARU';

export interface WhatsAppStatusItem {
  statusId: string;
  title: string;
  templateType: WhatsAppStatusTemplateType;
  imageUrl?: string;
  videoUrl?: string;
  productIds?: string[];
  productName?: string;
  productCategory?: string;
  tagline?: string;
  text?: string;
  price?: number;
  promoPrice?: number;
  ctaText?: string;
  customerAppUrl?: string;
  isDeliveryPromo?: boolean;
  deliveryMinOrder?: number;
  badgeText?: string;
  themeStyle?: 'red-glow' | 'sunset-orange' | 'dark-fire' | 'fresh-white' | 'gold-premium';
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WhatsAppStatusTemplate extends WhatsAppStatusItem {
  isPreset?: boolean;
}

