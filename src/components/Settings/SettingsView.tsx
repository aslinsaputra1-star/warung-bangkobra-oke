import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Store,
  Palette,
  Clock,
  ShoppingCart,
  CreditCard,
  Globe,
  ShoppingBag,
  Truck,
  Calendar,
  Package,
  Layers,
  Database,
  Receipt,
  Mail,
  MessageCircle,
  QrCode,
  Bell,
  Smartphone,
  Users,
  Shield,
  Lock,
  History,
  FileSpreadsheet,
  RotateCcw,
  Save,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Upload,
  Download,
  Eye,
  Plus,
  Trash2,
  Volume2,
  ExternalLink,
  ChevronRight,
  Menu,
  ChevronDown,
  X,
  Sparkles,
  Flame,
  Check,
  RefreshCw,
  ArrowLeft,
  Copy,
  Info,
} from 'lucide-react';
import { StoreSettings, Product, DayOperatingHour, EWalletAccount } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { LogoUploader } from './LogoUploader';
import { QRISUploader } from './QRISUploader';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { WhatsAppTesterModal } from './WhatsAppTesterModal';
import { QRCodeGeneratorModal } from './QRCodeGeneratorModal';
import {
  SettingSectionCard,
  SettingRow,
  SettingToggle,
  SettingInput,
  SettingSelect,
} from './SettingUIComponents';
import {
  testFirestoreConnection,
  firebaseConfig,
  subscribeToAuditLogs,
  AuditLogEntry,
  logAuditActivity,
} from '../../services/firebase';
import {
  exportProductsToExcel,
  exportTransactionsToExcel,
  exportCustomersToExcel,
} from '../../utils/excelHelper';
import { INITIAL_SETTINGS } from '../../data/initialData';
import { StorageService } from '../../services/storage';
import { PWAInstallButton } from '../PWAInstallButton';

interface SettingsViewProps {
  settings: StoreSettings;
  products?: Product[];
  onSaveSettings: (newSettings: StoreSettings) => void | boolean | Promise<boolean | void>;
  onSyncNow: () => void;
  isSyncing: boolean;
  onResetData: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export type SettingsTabId =
  | 'profile'
  | 'branding'
  | 'operating_hours'
  | 'pos'
  | 'payment'
  | 'online_order'
  | 'takeaway'
  | 'delivery'
  | 'po'
  | 'products'
  | 'variants'
  | 'stock'
  | 'receipt'
  | 'email'
  | 'whatsapp'
  | 'qrcode'
  | 'notification'
  | 'pwa'
  | 'customer'
  | 'users'
  | 'security'
  | 'audit'
  | 'backup'
  | 'about';

interface NavCategory {
  id: SettingsTabId;
  label: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
  keywords: string[];
}

const SETTINGS_CATEGORIES: NavCategory[] = [
  { id: 'profile', label: 'Profil Toko', icon: Store, description: 'Nama, logo, alamat, kontak & slogan warung', keywords: ['profil', 'nama', 'logo', 'alamat', 'slogan', 'toko', 'warung', 'instagram', 'facebook'] },
  { id: 'branding', label: 'Branding & Tema', icon: Palette, description: 'Warna tema, font, rounded radius & density', keywords: ['branding', 'tema', 'warna', 'color', 'dark', 'light', 'font', 'inter', 'poppins', 'radius'] },
  { id: 'operating_hours', label: 'Jam Operasional', icon: Clock, description: 'Jadwal buka-tutup Senin–Minggu, libur & 24 jam', keywords: ['jam', 'buka', 'tutup', 'operasional', 'senin', 'minggu', 'libur', '24 jam', 'jadwal'] },
  { id: 'pos', label: 'Pengaturan POS', icon: ShoppingCart, description: 'Format nomor struk, kasir, diskon & cetak', keywords: ['pos', 'kasir', 'invoice', 'nomor', 'prefix', 'wbk', 'diskon', 'pembulatan', 'cetak'] },
  { id: 'payment', label: 'Pembayaran & QRIS', icon: CreditCard, description: 'Tunai, Transfer Bank, QRIS dinamis & E-Wallet', keywords: ['pembayaran', 'qris', 'transfer', 'bank', 'bca', 'dana', 'gopay', 'ovo', 'shopeepay', 'tunai'] },
  { id: 'online_order', label: 'Online Order', icon: Globe, description: 'Katalog web, guest checkout & jam order online', keywords: ['online', 'order', 'pesan online', 'web', 'tamu', 'guest', 'wa', 'pengumuman'] },
  { id: 'takeaway', label: 'Bungkus / Takeaway', icon: ShoppingBag, description: 'Pengambilan di warung, estimasi & antrian', keywords: ['takeaway', 'bungkus', 'ambil', 'antrian', 'estimasi', 'kasir'] },
  { id: 'delivery', label: 'Delivery DQM', icon: Truck, badge: 'Rp20rb', description: 'Area Pesantren DQM, min order Rp20.000 & ongkir', keywords: ['delivery', 'antar', 'kurir', 'dqm', 'pesantren', 'ongkir', 'minimal', '20000', 'gratis'] },
  { id: 'po', label: 'Pesanan Acara / PO', icon: Calendar, badge: 'PO', description: 'Pre-order katering, DP wajib, kalender acara', keywords: ['po', 'preorder', 'pre-order', 'acara', 'katering', 'dp', 'down payment', 'jadwal'] },
  { id: 'products', label: 'Pengaturan Produk', icon: Package, description: 'Perilaku stok habis, satuan default, foto menu', keywords: ['produk', 'menu', 'habis', 'satuan', 'porsi', 'gambar', 'foto', 'kompresi'] },
  { id: 'variants', label: 'Varian Produk', icon: Layers, description: 'Varian rasa sachet minuman, Indomie & add-on', keywords: ['varian', 'rasa', 'pop ice', 'nutrisari', 'hilo', 'indomie', 'sachet', 'topping'] },
  { id: 'stock', label: 'Kontrol Stok', icon: Database, description: 'Stok minus, batas minimum & notifikasi habis', keywords: ['stok', 'inventory', 'minimum', 'minus', 'opname', 'adjustment', 'notifikasi'] },
  { id: 'receipt', label: 'Struk & Printer', icon: Receipt, badge: 'Preview', description: 'Ukuran 58mm/80mm, logo struk & preview cetak', keywords: ['struk', 'printer', '58mm', '80mm', 'a4', 'cetak', 'footer', 'preview'] },
  { id: 'email', label: 'Email Notifikasi', icon: Mail, description: 'Struk digital via email & pengirim toko', keywords: ['email', 'surat', 'inbox', 'notifikasi email', 'sender'] },
  { id: 'whatsapp', label: 'WhatsApp Notifikasi', icon: MessageCircle, badge: 'Tester', description: 'Template pesan WA, chat kasir & live tester', keywords: ['whatsapp', 'wa', 'chat', 'template', 'pesan', 'tester', 'kasir'] },
  { id: 'qrcode', label: 'QR Code Generator', icon: QrCode, description: 'QR Menu Meja, QR Order Standee & cetak', keywords: ['qr', 'qrcode', 'barcode', 'menu', 'standee', 'cetak', 'download'] },
  { id: 'notification', label: 'Notifikasi & Suara', icon: Bell, description: 'Lonceng pesanan baru, getar & slider volume', keywords: ['notifikasi', 'suara', 'chime', 'bell', 'audio', 'volume', 'getar', 'pesanan baru'] },
  { id: 'pwa', label: 'PWA Mobile App', icon: Smartphone, description: 'Aplikasi Android tanpa instal playstore', keywords: ['pwa', 'aplikasi', 'mobile', 'install', 'apk', 'offline', 'homescreen'] },
  { id: 'customer', label: 'Portal Pelanggan', icon: Users, description: 'Guest order, verifikasi WA & riwayat pesanan', keywords: ['pelanggan', 'customer', 'guest', 'member', 'riwayat', 'pesanan'] },
  { id: 'users', label: 'Pengguna & RBAC', icon: Users, description: 'Hak akses Owner, Admin, Kasir, Staff & Delivery', keywords: ['pengguna', 'user', 'role', 'rbac', 'owner', 'admin', 'kasir', 'staff', 'delivery'] },
  { id: 'security', label: 'Keamanan & Sesi', icon: Shield, description: 'Firebase Auth, session timeout & security rules', keywords: ['keamanan', 'security', 'auth', 'password', 'rules', 'sesi', 'login'] },
  { id: 'audit', label: 'Audit Log Cloud', icon: History, description: 'Riwayat riil perubahan setting, produk & transaksi', keywords: ['audit', 'log', 'riwayat', 'history', 'aktivitas', 'siapa', 'kapan'] },
  { id: 'backup', label: 'Data & Backup', icon: FileSpreadsheet, description: 'Ekspor Excel (.xlsx), CSV & reset database', keywords: ['backup', 'data', 'export', 'ekspor', 'excel', 'xlsx', 'csv', 'reset', 'danger'] },
  { id: 'about', label: 'Tentang Aplikasi', icon: Sparkles, badge: 'v2.5', description: 'Informasi sistem POS, lisensi & status Firebase Firestore', keywords: ['tentang', 'about', 'versi', 'sistem', 'bantuan', 'info', 'lisensi', 'developer', 'firebase'] },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  products = [],
  onSaveSettings,
  onSyncNow,
  isSyncing,
  onResetData,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');
  const [mobileView, setMobileView] = useState<'menu' | 'detail'>('menu');
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState<
    'ALL' | 'STORE' | 'POS' | 'ORDER' | 'STOCK' | 'COMMS' | 'SYSTEM'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [isWaTesterOpen, setIsWaTesterOpen] = useState(false);
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isDangerResetDbOpen, setIsDangerResetDbOpen] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState<StoreSettings>(() => ({
    ...INITIAL_SETTINGS,
    ...settings,
    address: settings.address || settings.storeAddress || INITIAL_SETTINGS.address,
    storeAddress: settings.address || settings.storeAddress || INITIAL_SETTINGS.storeAddress,
  }));

  // Sync external props into formData if user hasn't made uncommitted edits
  useEffect(() => {
    if (!isDirty) {
      setFormData((prev) => ({
        ...prev,
        ...settings,
        address: settings.address || settings.storeAddress || prev.address,
        storeAddress: settings.address || settings.storeAddress || prev.storeAddress,
      }));
    }
  }, [settings, isDirty]);

  // Real-time Audit Logs from Firestore
  useEffect(() => {
    const unsub = subscribeToAuditLogs((logs) => {
      setAuditLogs(logs);
    });
    return () => unsub();
  }, []);

  // Filter Categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return SETTINGS_CATEGORIES;
    const q = searchQuery.toLowerCase().trim();
    return SETTINGS_CATEGORIES.filter(
      (cat) =>
        cat.label.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q) ||
        cat.keywords.some((k) => k.includes(q))
    );
  }, [searchQuery]);

  const CATEGORY_GROUPS: Record<string, SettingsTabId[]> = useMemo(
    () => ({
      STORE: ['profile', 'branding', 'operating_hours', 'pwa'],
      POS: ['pos', 'payment', 'receipt'],
      ORDER: ['online_order', 'takeaway', 'delivery', 'po', 'customer'],
      STOCK: ['products', 'variants', 'stock'],
      COMMS: ['email', 'whatsapp', 'qrcode', 'notification'],
      SYSTEM: ['users', 'security', 'audit', 'backup', 'about'],
    }),
    []
  );

  const displayCategories = useMemo(() => {
    if (mobileCategoryFilter === 'ALL') return filteredCategories;
    const allowed = CATEGORY_GROUPS[mobileCategoryFilter] || [];
    return filteredCategories.filter((c) => allowed.includes(c.id));
  }, [filteredCategories, mobileCategoryFilter, CATEGORY_GROUPS]);

  const handleFieldChange = (field: keyof StoreSettings, value: any) => {
    setIsDirty(true);
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'address' || field === 'storeAddress') {
        updated.address = value;
        updated.storeAddress = value;
      }
      if (field === 'tagline' || field === 'storeSlogan') {
        updated.tagline = value;
        updated.storeSlogan = value;
      }
      return updated;
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const res = await onSaveSettings(formData);
      setIsDirty(false);
      showToast('Pengaturan berhasil disimpan ke cloud Firebase!', 'success');
      logAuditActivity(
        'UPDATE_SETTINGS',
        `Menyimpan pengaturan kategori ${activeTab.toUpperCase()}`,
        formData.activeCashier || 'Owner',
        'SETTINGS'
      ).catch(() => {});
    } catch (err: any) {
      showToast('Pengaturan gagal disimpan. Silakan coba lagi.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setFormData({
      ...INITIAL_SETTINGS,
      ...settings,
    });
    setIsDirty(false);
    showToast('Perubahan dibatalkan. Memuat kembali data tersimpan.', 'info');
  };

  const handleResetToDefault = () => {
    setFormData({
      ...INITIAL_SETTINGS,
      storeName: settings.storeName || INITIAL_SETTINGS.storeName,
    });
    setIsDirty(true);
    setIsResetConfirmOpen(false);
    showToast('Pengaturan dikembalikan ke nilai default pabrik (Klik Simpan untuk menerapkan).', 'info');
  };

  // Sound Test for notifications
  const handleTestChime = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        showToast('Web Audio tidak didukung pada browser ini', 'error');
        return;
      }
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const vol = (formData.notificationSoundVolume ?? 80) / 100;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.0, now + 0.12); // A5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3 * vol, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
      showToast('Memutar suara notifikasi pesanan!', 'info');
    } catch (err) {
      console.warn('Audio chime error:', err);
    }
  };

  const currentCategory = SETTINGS_CATEGORIES.find((c) => c.id === activeTab) || SETTINGS_CATEGORIES[0];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-stone-950 text-stone-100 overflow-hidden select-none">
      {/* 1. TOP GLOBAL SETTINGS HEADER */}
      <header className="bg-stone-900 border-b border-stone-800 px-4 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-red-950/60 font-black">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg sm:text-xl text-white tracking-tight">
                PENGATURAN WARUNG
              </h1>
              <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-stone-400 font-medium">
              Kelola profil, branding, POS, jam buka, delivery &amp; pembayaran
            </p>
          </div>
        </div>

        {/* Action Buttons: Simpan, Batalkan, Status */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {isDirty && (
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl animate-pulse flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Ada Perubahan Belum Disimpan
            </span>
          )}

          {isDirty && (
            <button
              type="button"
              onClick={handleDiscard}
              className="min-h-[40px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-bold transition cursor-pointer"
            >
              Batalkan
            </button>
          )}

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className={`min-h-[40px] px-5 rounded-xl font-black text-xs shadow-lg flex items-center gap-2 transition active:scale-95 cursor-pointer ${
              isDirty
                ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-red-950/50'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
            }`}
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </header>

      {/* 2. SEARCH & NAVIGATION BAR */}
      <div className="bg-stone-920 border-b border-stone-800/80 px-4 py-2.5 shrink-0 flex items-center justify-between gap-3">
        {/* Instant Search Settings Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pengaturan (QRIS, Delivery, Struk, Jam, PO, WhatsApp...)"
            className="w-full min-h-[38px] bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl pl-10 pr-8 text-xs text-stone-100 placeholder-stone-500 focus:outline-none transition shadow-inner font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white text-xs p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile View Category Menu Trigger */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="min-h-[38px] px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Menu className="w-4 h-4" />
            <span>Pilih Menu ({currentCategory.label})</span>
          </button>
        </div>

        {/* Desktop Sidebar Toggle */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-stone-400">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="px-2.5 py-1.5 rounded-lg bg-stone-850 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-[11px] font-bold transition cursor-pointer"
          >
            {isSidebarCollapsed ? 'Tampilkan Sidebar' : 'Kecilkan Sidebar'}
          </button>
        </div>
      </div>

      {/* 3. MOBILE CATEGORY DRAWER / SHEET */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border-t-2 border-red-500/60 rounded-t-[28px] max-h-[82vh] overflow-y-auto p-4 space-y-3 shadow-2xl animate-in slide-in-from-bottom"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <h3 className="font-extrabold text-sm text-stone-100">
                Pilih Kategori Pengaturan
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredCategories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(cat.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`min-h-[50px] p-3 rounded-2xl text-left border flex items-center justify-between gap-3 transition cursor-pointer active:scale-98 ${
                      isSelected
                        ? 'bg-red-600/20 border-red-500 text-white font-black'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-850'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-red-600 text-white' : 'bg-stone-900 text-red-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">{cat.label}</div>
                        <div className="text-[10px] text-stone-400 truncate">
                          {cat.description}
                        </div>
                      </div>
                    </div>
                    {cat.badge && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-600/30 text-red-400 shrink-0">
                        {cat.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: SIDEBAR + CONTENT VIEW */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* MOBILE MENU HUB (Shown on mobile when mobileView === 'menu') */}
        <div
          className={`${
            mobileView === 'menu' ? 'block' : 'hidden'
          } lg:hidden flex-1 overflow-y-auto p-4 space-y-4`}
        >
          {/* Quick Group Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'Semua (24)' },
              { id: 'STORE', label: 'Toko & Profil' },
              { id: 'POS', label: 'Kasir & POS' },
              { id: 'ORDER', label: 'Layanan Pesanan' },
              { id: 'STOCK', label: 'Produk & Stok' },
              { id: 'COMMS', label: 'WhatsApp & Notif' },
              { id: 'SYSTEM', label: 'Sistem & Cloud' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setMobileCategoryFilter(chip.id as any)}
                className={`min-h-[34px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  mobileCategoryFilter === chip.id
                    ? 'bg-red-600 text-white shadow-md shadow-red-950/60'
                    : 'bg-stone-900 border border-stone-800 text-stone-300 hover:bg-stone-850'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Category Cards Touch Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {displayCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(cat.id);
                    setMobileView('detail');
                  }}
                  className={`min-h-[58px] p-3.5 rounded-2xl text-left border flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.98] shadow-sm ${
                    isSelected
                      ? 'bg-gradient-to-r from-red-600/20 to-orange-600/10 border-red-500/60 text-white'
                      : 'bg-stone-900/90 border-stone-800 text-stone-200 hover:border-stone-700 hover:bg-stone-850'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                        isSelected
                          ? 'bg-gradient-to-br from-red-600 to-orange-600 text-white'
                          : 'bg-stone-950 text-red-400 border border-stone-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs sm:text-sm text-stone-100 truncate">
                        {cat.label}
                      </div>
                      <div className="text-[11px] text-stone-400 truncate mt-0.5">
                        {cat.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {cat.badge && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30">
                        {cat.badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-stone-500" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick System Status Card at bottom */}
          <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-200">
                  Google Cloud Firestore
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1.5 mt-0.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Realtime Cloud Sync Terhubung
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab('about');
                setMobileView('detail');
              }}
              className="text-xs text-stone-400 hover:text-white font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-800"
            >
              <span>Info</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* DESKTOP SIDEBAR */}
        <aside
          className={`hidden lg:flex flex-col bg-stone-920 border-r border-stone-800 shrink-0 transition-all duration-200 overflow-y-auto ${
            isSidebarCollapsed ? 'w-20' : 'w-72'
          }`}
        >
          <div className="p-3 space-y-1">
            {filteredCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`settings-nav-${cat.id}`}
                  type="button"
                  onClick={() => setActiveTab(cat.id)}
                  title={isSidebarCollapsed ? cat.label : undefined}
                  className={`w-full min-h-[46px] p-2.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-red-600/25 to-orange-600/15 text-white font-extrabold border border-red-500/50 shadow-md'
                      : 'text-stone-300 hover:bg-stone-850 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow'
                          : 'bg-stone-900 text-stone-400 group-hover:text-red-400 border border-stone-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    {!isSidebarCollapsed && (
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate leading-tight">
                          {cat.label}
                        </div>
                        <div className="text-[10px] text-stone-400 truncate leading-tight mt-0.5">
                          {cat.description}
                        </div>
                      </div>
                    )}
                  </div>
                  {!isSidebarCollapsed && cat.badge && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 shrink-0">
                      {cat.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* CONTENT VIEWPORT */}
        <main
          className={`${
            mobileView === 'menu' ? 'hidden lg:block' : 'block'
          } flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto`}
        >
          {/* Mobile Subpage Sticky Top Header */}
          <div className="lg:hidden sticky -top-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 px-4 py-3 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 z-30 flex items-center justify-between gap-2 shadow-lg">
            <button
              type="button"
              onClick={() => setMobileView('menu')}
              className="min-h-[38px] px-3 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-red-400" />
              <span>Menu</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
                <currentCategory.icon className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xs text-white truncate max-w-[120px] sm:max-w-[200px]">
                {currentCategory.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="min-h-[38px] px-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="Pindah ke menu lain"
              >
                <span>Pindah</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className={`min-h-[38px] px-3.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer ${
                  isDirty
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-red-950/60'
                    : 'bg-stone-800 text-stone-300 border border-stone-700'
                }`}
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{isSaving ? 'Menyimpan' : 'Simpan'}</span>
              </button>
            </div>
          </div>

          {/* Breadcrumb Header */}
          <div className="flex items-center justify-between pb-2 border-b border-stone-850">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span>Pengaturan</span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-600" />
              <span className="font-extrabold text-stone-100">
                {currentCategory.label}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="text-stone-400 hover:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Pengaturan</span>
            </button>
          </div>

          {/* ========================================================
              1. PROFIL TOKO
             ======================================================== */}
          {activeTab === 'profile' && (
            <SettingSectionCard
              title="Profil Toko & Informasi Bisnis"
              subtitle="Kelola identitas resmi Warung Bang Kobra yang ditampilkan pada struk, aplikasi pelanggan & web menu"
              icon={Store}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nama Toko *
                  </label>
                  <SettingInput
                    value={formData.storeName || ''}
                    onChange={(e) => handleFieldChange('storeName', e.target.value)}
                    placeholder="WARUNG BANG KOBRA"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nama Pemilik (Owner)
                  </label>
                  <SettingInput
                    value={formData.ownerName || ''}
                    onChange={(e) => handleFieldChange('ownerName', e.target.value)}
                    placeholder="Bang Kobra"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Slogan / Tagline
                  </label>
                  <SettingInput
                    value={formData.tagline || ''}
                    onChange={(e) => handleFieldChange('tagline', e.target.value)}
                    placeholder="Sajian Pedas Mantap, Nikmat Tanpa Lawan"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nomor WhatsApp Resmi Warung *
                  </label>
                  <SettingInput
                    value={formData.whatsappNumber || ''}
                    onChange={(e) => handleFieldChange('whatsappNumber', e.target.value)}
                    placeholder="6281234567890"
                    prefixLabel="WA"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Alamat Lengkap Toko *
                </label>
                <textarea
                  rows={2}
                  value={formData.address || formData.storeAddress || ''}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  placeholder="Jl. Raya Kuliner No. 88, Samping Kampus / Pasar Malam"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl p-3 text-xs sm:text-sm text-stone-100 focus:outline-none transition shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Email Toko
                  </label>
                  <SettingInput
                    type="email"
                    value={formData.storeEmail || ''}
                    onChange={(e) => handleFieldChange('storeEmail', e.target.value)}
                    placeholder="warungbangkobra@gmail.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Instagram Toko
                  </label>
                  <SettingInput
                    value={formData.storeInstagram || ''}
                    onChange={(e) => handleFieldChange('storeInstagram', e.target.value)}
                    placeholder="@warungbangkobra"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Website Resmi
                  </label>
                  <SettingInput
                    value={formData.storeWebsite || ''}
                    onChange={(e) => handleFieldChange('storeWebsite', e.target.value)}
                    placeholder="https://warungbangkobra.id"
                  />
                </div>
              </div>

              {/* Upload Logo Toko Section */}
              <div className="pt-4 border-t border-stone-800">
                <h4 className="font-extrabold text-sm text-stone-200 mb-2">
                  Upload &amp; Ganti Logo Warung
                </h4>
                <LogoUploader
                  currentLogoUrl={formData.logoUrl}
                  storeName={formData.storeName}
                  onLogoChange={(newLogoUrl) => handleFieldChange('logoUrl', newLogoUrl)}
                  showToast={showToast}
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              2. BRANDING
             ======================================================== */}
          {activeTab === 'branding' && (
            <SettingSectionCard
              title="Branding &amp; Skema Tampilan"
              subtitle="Kustomisasi palet warna, tipografi font, sudut rounded, dan kerapatan tampilan"
              icon={Palette}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Tema Utama
                  </label>
                  <SettingSelect
                    value={formData.theme || 'dark'}
                    onChange={(e) => handleFieldChange('theme', e.target.value)}
                    options={[
                      { value: 'dark', label: 'Dark Mode (Elegan Gelap)' },
                      { value: 'light', label: 'Light Mode (Cerah)' },
                      { value: 'system', label: 'Ikuti Sistem Perangkat' },
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Font Utama
                  </label>
                  <SettingSelect
                    value={formData.themeFont || 'Inter'}
                    onChange={(e) => handleFieldChange('themeFont', e.target.value)}
                    options={[
                      { value: 'Inter', label: 'Inter (Rekomendasi POS)' },
                      { value: 'Poppins', label: 'Poppins (Modern Ramah)' },
                      { value: 'System', label: 'System Default' },
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Sudut Rounded Kartu
                  </label>
                  <SettingSelect
                    value={formData.themeRadius || 'medium'}
                    onChange={(e) => handleFieldChange('themeRadius', e.target.value)}
                    options={[
                      { value: 'small', label: 'Small (12px)' },
                      { value: 'medium', label: 'Medium (16-20px)' },
                      { value: 'large', label: 'Large (24-28px)' },
                    ]}
                  />
                </div>
              </div>

              {/* Color Customizer */}
              <div className="pt-3 border-t border-stone-800 space-y-3">
                <h4 className="font-extrabold text-sm text-stone-200">
                  Palet Warna Identitas
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 block mb-1">
                      Primary (Merah)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.themePrimaryColor || '#dc2626'}
                        onChange={(e) => handleFieldChange('themePrimaryColor', e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-stone-300">
                        {formData.themePrimaryColor || '#dc2626'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 block mb-1">
                      Secondary (Oranye)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.themeSecondaryColor || '#f97316'}
                        onChange={(e) => handleFieldChange('themeSecondaryColor', e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-stone-300">
                        {formData.themeSecondaryColor || '#f97316'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 block mb-1">
                      Accent (Emas)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.themeAccentColor || '#eab308'}
                        onChange={(e) => handleFieldChange('themeAccentColor', e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-stone-300">
                        {formData.themeAccentColor || '#eab308'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 block mb-1">
                      Background
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.themeBgColor || '#0c0a09'}
                        onChange={(e) => handleFieldChange('themeBgColor', e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-stone-300">
                        {formData.themeBgColor || '#0c0a09'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 block mb-1">
                      Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.themeTextColor || '#f5f5f4'}
                        onChange={(e) => handleFieldChange('themeTextColor', e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-stone-300">
                        {formData.themeTextColor || '#f5f5f4'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange('themePrimaryColor', '#dc2626');
                      handleFieldChange('themeSecondaryColor', '#f97316');
                      handleFieldChange('themeAccentColor', '#eab308');
                      handleFieldChange('themeBgColor', '#0c0a09');
                      handleFieldChange('themeTextColor', '#f5f5f4');
                      handleFieldChange('themeFont', 'Inter');
                      handleFieldChange('themeRadius', 'medium');
                      showToast('Tema dikembalikan ke palet standar Bang Kobra!', 'info');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition cursor-pointer"
                  >
                    Reset Tema Default Bang Kobra
                  </button>
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              3. JAM OPERASIONAL
             ======================================================== */}
          {activeTab === 'operating_hours' && (
            <SettingSectionCard
              title="Jam Operasional &amp; Jadwal Buka-Tutup"
              subtitle="Atur jam buka setiap hari. Jika toko tutup, checkout online order dinonaktifkan otomatis"
              icon={Clock}
            >
              <SettingToggle
                label="Buka 24 Jam Non-Stop"
                description="Warung beroperasi 24 jam penuh tanpa pembatasan jam operasional"
                checked={Boolean(formData.is24Hours)}
                onChange={(c) => handleFieldChange('is24Hours', c)}
              />

              <SettingToggle
                label="Tutup Sementara (Istirahat / Libur)"
                description="Nonaktifkan penerimaan pesanan online sementara waktu"
                checked={Boolean(formData.isTempClosed)}
                onChange={(c) => handleFieldChange('isTempClosed', c)}
              />

              {formData.isTempClosed && (
                <div>
                  <label className="text-xs font-bold text-amber-400 block mb-1">
                    Pesan Pengumuman Tutup Sementara
                  </label>
                  <SettingInput
                    value={formData.tempClosedReason || ''}
                    onChange={(e) => handleFieldChange('tempClosedReason', e.target.value)}
                    placeholder="Warung sedang istirahat sejenak. Buka kembali pukul 16:00!"
                  />
                </div>
              )}

              <SettingToggle
                label="Tetap Izinkan Pelanggan Melihat Menu Saat Tutup"
                description="Pelanggan tetap dapat melihat daftar menu makanan & harga, namun tidak dapat checkout"
                checked={formData.allowBrowsingWhenClosed !== false}
                onChange={(c) => handleFieldChange('allowBrowsingWhenClosed', c)}
              />

              {/* 7 Days Schedule Table */}
              <div className="pt-3 border-t border-stone-800 space-y-2">
                <h4 className="font-extrabold text-sm text-stone-200 mb-2">
                  Jadwal Harian (Senin – Minggu)
                </h4>
                <div className="space-y-2">
                  {(formData.operatingHours || INITIAL_SETTINGS.operatingHours || []).map((dayItem, idx) => (
                    <div
                      key={dayItem.day}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-stone-950 border border-stone-800 gap-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={dayItem.isOpen}
                          onChange={(e) => {
                            const updated = [...(formData.operatingHours || INITIAL_SETTINGS.operatingHours!)];
                            updated[idx] = { ...dayItem, isOpen: e.target.checked };
                            handleFieldChange('operatingHours', updated);
                          }}
                          className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                        />
                        <span className="font-bold text-xs sm:text-sm text-stone-200 w-24">
                          {dayItem.day}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            dayItem.isOpen
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-stone-800 text-stone-500'
                          }`}
                        >
                          {dayItem.isOpen ? 'BUKA' : 'LIBUR'}
                        </span>
                      </div>

                      {dayItem.isOpen && (
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="time"
                            value={dayItem.openTime}
                            onChange={(e) => {
                              const updated = [...(formData.operatingHours || INITIAL_SETTINGS.operatingHours!)];
                              updated[idx] = { ...dayItem, openTime: e.target.value };
                              handleFieldChange('operatingHours', updated);
                            }}
                            className="bg-stone-900 border border-stone-750 rounded-xl px-2.5 py-1.5 text-stone-100 font-mono"
                          />
                          <span className="text-stone-500">s/d</span>
                          <input
                            type="time"
                            value={dayItem.closeTime}
                            onChange={(e) => {
                              const updated = [...(formData.operatingHours || INITIAL_SETTINGS.operatingHours!)];
                              updated[idx] = { ...dayItem, closeTime: e.target.value };
                              handleFieldChange('operatingHours', updated);
                            }}
                            className="bg-stone-900 border border-stone-750 rounded-xl px-2.5 py-1.5 text-stone-100 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              4. PENGATURAN POS
             ======================================================== */}
          {activeTab === 'pos' && (
            <SettingSectionCard
              title="Pengaturan Kasir &amp; Transaksi (POS)"
              subtitle="Atur penomoran struk, izin kasir, pembulatan, dan alur otomatis pasca pembayaran"
              icon={ShoppingCart}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Prefix Nomor Invoice
                  </label>
                  <SettingInput
                    value={formData.invoicePrefix || 'WBK'}
                    onChange={(e) => handleFieldChange('invoicePrefix', e.target.value.toUpperCase())}
                    placeholder="WBK"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    Contoh: {formData.invoicePrefix || 'WBK'}-20261005-0001
                  </span>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Siklus Reset Nomor Struk
                  </label>
                  <SettingSelect
                    value={formData.invoiceResetPeriod || 'DAILY'}
                    onChange={(e) => handleFieldChange('invoiceResetPeriod', e.target.value)}
                    options={[
                      { value: 'DAILY', label: 'Setiap Hari (Mulai dari 001)' },
                      { value: 'MONTHLY', label: 'Setiap Bulan' },
                      { value: 'NEVER', label: 'Terus Bertambah' },
                    ]}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Mata Uang
                  </label>
                  <SettingInput
                    value={formData.currency || 'Rp'}
                    onChange={(e) => handleFieldChange('currency', e.target.value)}
                    placeholder="Rp"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 space-y-2">
                <h4 className="font-extrabold text-sm text-stone-200">
                  Izin &amp; Validasi Kasir
                </h4>
                <SettingToggle
                  label="Izinkan Diskon Transaksi"
                  description="Kasir dapat memasukkan diskon rupiah atau persen pada keranjang"
                  checked={formData.posAllowDiscount !== false}
                  onChange={(c) => handleFieldChange('posAllowDiscount', c)}
                />
                <SettingToggle
                  label="Izinkan Edit Harga Menu Manual"
                  description="Kasir dapat mengubah harga satuan menu langsung saat transaksi"
                  checked={Boolean(formData.posAllowPriceEdit)}
                  onChange={(c) => handleFieldChange('posAllowPriceEdit', c)}
                />
                <SettingToggle
                  label="Izinkan Catatan Per Item"
                  description="Tampilkan tombol catatan khusus (contoh: pedas, manis, tanpa es)"
                  checked={formData.posAllowItemNotes !== false}
                  onChange={(c) => handleFieldChange('posAllowItemNotes', c)}
                />
                <SettingToggle
                  label="Konfirmasi Sebelum Batalkan Pesanan"
                  description="Minta konfirmasi sebelum membatalkan antrian kasir"
                  checked={formData.posConfirmCancel !== false}
                  onChange={(c) => handleFieldChange('posConfirmCancel', c)}
                />
              </div>

              <div className="pt-3 border-t border-stone-800 space-y-2">
                <h4 className="font-extrabold text-sm text-stone-200">
                  Alur Setelah Pembayaran Selesai
                </h4>
                <SettingToggle
                  label="Tampilkan Pop-up Struk Digital"
                  description="Buka struk pembayaran otomatis segera setelah kasir menekan Bayar"
                  checked={formData.posShowReceiptModal !== false}
                  onChange={(c) => handleFieldChange('posShowReceiptModal', c)}
                />
                <SettingToggle
                  label="Otomatis Buat Pesan WhatsApp Pelanggan"
                  description="Siapkan tautan WhatsApp berisikan rincian pesanan jika nomor WA diisi"
                  checked={formData.posAutoSendWhatsApp !== false}
                  onChange={(c) => handleFieldChange('posAutoSendWhatsApp', c)}
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              5. PEMBAYARAN & QRIS
             ======================================================== */}
          {activeTab === 'payment' && (
            <SettingSectionCard
              title="Metode Pembayaran &amp; QRIS"
              subtitle="Aktifkan Tunai, Transfer Rekening Bank, QRIS Statis/Dinamis, dan E-Wallet"
              icon={CreditCard}
            >
              <div className="space-y-3">
                <SettingToggle
                  label="Pembayaran Tunai (CASH)"
                  description="Menerima uang tunai fisik di kasir dengan kalkulasi kembalian"
                  checked={formData.paymentCashEnabled !== false}
                  onChange={(c) => handleFieldChange('paymentCashEnabled', c)}
                />
                <SettingToggle
                  label="Transfer Bank Langsung"
                  description="Pelanggan mentransfer ke rekening bank resmi warung"
                  checked={formData.paymentTransferEnabled !== false}
                  onChange={(c) => handleFieldChange('paymentTransferEnabled', c)}
                />
                <SettingToggle
                  label="Pembayaran QRIS (BCA, Mandiri, GoPay, OVO, ShopeePay)"
                  description="Tampilkan barcode QRIS pada kasir dan menu mandiri pelanggan"
                  checked={formData.qrisEnabled !== false}
                  onChange={(c) => handleFieldChange('qrisEnabled', c)}
                />
                <SettingToggle
                  label="Dompet Digital (E-Wallet)"
                  description="Menerima DANA, GoPay, OVO, ShopeePay via nomor akun kasir"
                  checked={formData.paymentEwalletEnabled !== false}
                  onChange={(c) => handleFieldChange('paymentEwalletEnabled', c)}
                />
              </div>

              {/* Data Rekening Bank */}
              <div className="pt-4 border-t border-stone-800 space-y-3">
                <h4 className="font-extrabold text-sm text-stone-200">
                  Informasi Rekening Bank
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-300 block mb-1">
                      Nama Bank
                    </label>
                    <SettingInput
                      value={formData.bankName || 'BCA'}
                      onChange={(e) => handleFieldChange('bankName', e.target.value)}
                      placeholder="BCA"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-300 block mb-1">
                      Nomor Rekening
                    </label>
                    <SettingInput
                      value={formData.bankAccountNumber || ''}
                      onChange={(e) => handleFieldChange('bankAccountNumber', e.target.value)}
                      placeholder="8830192831"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-300 block mb-1">
                      Atas Nama (Pemilik Rekening)
                    </label>
                    <SettingInput
                      value={formData.bankAccountHolder || ''}
                      onChange={(e) => handleFieldChange('bankAccountHolder', e.target.value)}
                      placeholder="Warung Bang Kobra"
                    />
                  </div>
                </div>
              </div>

              {/* QRIS Management Section */}
              <div className="pt-4 border-t border-stone-800">
                <h4 className="font-extrabold text-sm text-stone-200 mb-2">
                  Pengaturan Barcode QRIS
                </h4>
                <QRISUploader
                  settings={formData}
                  onSaveSettings={(newSet) => {
                    setFormData(newSet);
                    return onSaveSettings(newSet);
                  }}
                  showToast={showToast}
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              6. ONLINE ORDER
             ======================================================== */}
          {activeTab === 'online_order' && (
            <SettingSectionCard
              title="Online Order &amp; Menu Mandiri"
              subtitle="Konfigurasi halaman pemesanan web yang diakses pelanggan melalui scan QR meja atau tautan"
              icon={Globe}
            >
              <SettingToggle
                label="Buka Penerimaan Pesanan Online"
                description="Izinkan pelanggan mengirim pesanan dari HP mereka ke antrian kasir"
                checked={formData.onlineMenuIsOpen !== false}
                onChange={(c) => handleFieldChange('onlineMenuIsOpen', c)}
              />

              <SettingToggle
                label="Izinkan Pemesanan Tanpa Login (Guest Checkout)"
                description="Pelanggan cukup mengisi Nama & WhatsApp tanpa perlu daftar akun"
                checked={formData.onlineAllowGuest !== false}
                onChange={(c) => handleFieldChange('onlineAllowGuest', c)}
              />

              <div className="pt-2">
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  URL / Domain Halaman Pelanggan (Production Vercel)
                </label>
                <div className="flex gap-2">
                  <SettingInput
                    value={formData.customerAppUrl || 'https://warung-bangkobra-oke.vercel.app/customer'}
                    onChange={(e) => handleFieldChange('customerAppUrl', e.target.value)}
                    placeholder="https://warung-bangkobra-oke.vercel.app/customer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formData.customerAppUrl || 'https://warung-bangkobra-oke.vercel.app/customer');
                      showToast('Tautan pelanggan berhasil disalin!', 'success');
                    }}
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    title="Salin Tautan Pelanggan"
                  >
                    <Copy className="w-4 h-4 text-emerald-400" />
                    <span>Salin</span>
                  </button>
                  <a
                    href={formData.customerAppUrl || 'https://warung-bangkobra-oke.vercel.app/customer'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    title="Uji Buka Halaman Pelanggan"
                  >
                    <ExternalLink className="w-4 h-4 text-sky-400" />
                    <span>Buka</span>
                  </a>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  Alamat resmi yang dibuka pelanggan saat scan QR Meja, Status WhatsApp, atau pesan online.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Batas Minimal Pembelian Online (Rp)
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.onlineMenuMinOrder || 10000}
                    onChange={(e) => handleFieldChange('onlineMenuMinOrder', Number(e.target.value))}
                    prefixLabel="Rp"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Jam Layanan Pesanan Online
                  </label>
                  <SettingInput
                    value={formData.onlineMenuHours || '08:00 - 22:00 WIB'}
                    onChange={(e) => handleFieldChange('onlineMenuHours', e.target.value)}
                    placeholder="08:00 - 22:00 WIB"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Pesan Pengumuman / Banner Menu Online
                </label>
                <textarea
                  rows={2}
                  value={formData.onlineMenuAnnouncement || ''}
                  onChange={(e) => handleFieldChange('onlineMenuAnnouncement', e.target.value)}
                  placeholder="Pengumuman spesial untuk pelanggan web..."
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl p-3 text-xs sm:text-sm text-stone-100 focus:outline-none transition shadow-inner"
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              7. TAKEAWAY (BUNGKUS)
             ======================================================== */}
          {activeTab === 'takeaway' && (
            <SettingSectionCard
              title="Layanan Ambil Sendiri (Bungkus / Takeaway)"
              subtitle="Konfigurasi opsi takeaway pada menu kasir dan online order"
              icon={ShoppingBag}
            >
              <SettingToggle
                label="Aktifkan Layanan Bungkus / Takeaway"
                description="Pelanggan dapat memesan untuk dibungkus dan diambil langsung di kasir"
                checked={formData.takeawayEnabled !== false}
                onChange={(c) => handleFieldChange('takeawayEnabled', c)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nama Label Layanan
                  </label>
                  <SettingInput
                    value={formData.takeawayServiceName || 'Bungkus / Ambil Sendiri'}
                    onChange={(e) => handleFieldChange('takeawayServiceName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Estimasi Persiapan (Menit)
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.takeawayEstimatedMinutes || 15}
                    onChange={(e) => handleFieldChange('takeawayEstimatedMinutes', Number(e.target.value))}
                    suffixLabel="Mnt"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Prefix Nomor Antrian
                  </label>
                  <SettingInput
                    value={formData.takeawayQueuePrefix || 'A'}
                    onChange={(e) => handleFieldChange('takeawayQueuePrefix', e.target.value.toUpperCase())}
                    placeholder="A"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Instruksi Pengambilan untuk Pelanggan
                </label>
                <textarea
                  rows={2}
                  value={
                    formData.takeawayPickupInstructions ||
                    'Silakan ambil pesanan di kasir setelah status berubah menjadi SIAP.'
                  }
                  onChange={(e) => handleFieldChange('takeawayPickupInstructions', e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl p-3 text-xs sm:text-sm text-stone-100 focus:outline-none transition shadow-inner"
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              8. DELIVERY DQM
             ======================================================== */}
          {activeTab === 'delivery' && (
            <SettingSectionCard
              title="Layanan Antar (Delivery DQM)"
              subtitle="Konfigurasi area jangkauan, batas belanja minimal Rp20.000, tarif ongkir dan estimasi pengantaran"
              icon={Truck}
              badge="Min Rp20rb"
            >
              <SettingToggle
                label="Aktifkan Layanan Delivery DQM"
                description="Izinkan pelanggan memilih opsi diantar oleh kurir warung"
                checked={formData.deliveryDqmEnabled !== false}
                onChange={(c) => handleFieldChange('deliveryDqmEnabled', c)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Batas Minimal Belanja Delivery (Wajib &ge; Rp20.000) *
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.deliveryMinOrder || 20000}
                    onChange={(e) => handleFieldChange('deliveryMinOrder', Math.max(0, Number(e.target.value)))}
                    prefixLabel="Rp"
                  />
                  <span className="text-[10px] text-amber-400 mt-1 block">
                    Pelanggan tidak dapat checkout delivery jika total pesanan di bawah nominal ini.
                  </span>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Tarif Biaya Pengantaran (Ongkir)
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.deliveryFeeAmount || 2000}
                    onChange={(e) => handleFieldChange('deliveryFeeAmount', Number(e.target.value))}
                    prefixLabel="Rp"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Area Layanan Utama
                  </label>
                  <SettingInput
                    value={formData.deliveryAreaName || 'Sekitar Pesantren DQM'}
                    onChange={(e) => handleFieldChange('deliveryAreaName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Jam Operasional Delivery
                  </label>
                  <SettingInput
                    value={formData.deliveryHours || '09:00 - 21:00 WIB'}
                    onChange={(e) => handleFieldChange('deliveryHours', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Estimasi Pengantaran (Menit)
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.deliveryEstimatedMinutes || 25}
                    onChange={(e) => handleFieldChange('deliveryEstimatedMinutes', Number(e.target.value))}
                    suffixLabel="Mnt"
                  />
                </div>
              </div>

              <SettingToggle
                label="Aktifkan Gratis Ongkir untuk Pesanan Besar"
                description="Bebaskan ongkir jika total belanja mencapai batas tertentu"
                checked={Boolean(formData.deliveryFreeEnabled)}
                onChange={(c) => handleFieldChange('deliveryFreeEnabled', c)}
              />

              {formData.deliveryFreeEnabled && (
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Minimal Belanja untuk Gratis Ongkir
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.deliveryFreeMinOrder || 50000}
                    onChange={(e) => handleFieldChange('deliveryFreeMinOrder', Number(e.target.value))}
                    prefixLabel="Rp"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Catatan &amp; Instruksi Khusus Delivery
                </label>
                <textarea
                  rows={2}
                  value={formData.deliveryDqmNote || ''}
                  onChange={(e) => handleFieldChange('deliveryDqmNote', e.target.value)}
                  placeholder="Delivery khusus area Pesantren DQM dan sekitarnya..."
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl p-3 text-xs sm:text-sm text-stone-100 focus:outline-none transition shadow-inner"
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              9. PESANAN ACARA / PRE-ORDER (PO)
             ======================================================== */}
          {activeTab === 'po' && (
            <SettingSectionCard
              title="Pesanan Acara / Pre-Order (PO)"
              subtitle="Atur katering hajatan, rapat & acara: DP minimal 50%, batas pelunasan dan aturan pembatalan"
              icon={Calendar}
              badge="PO"
            >
              <SettingToggle
                label="Aktifkan Modul Pre-Order (PO)"
                description="Buka formulir pemesanan khusus acara dengan sistem Down Payment (DP)"
                checked={formData.poEnabled !== false}
                onChange={(c) => handleFieldChange('poEnabled', c)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Minimal Pesanan PO (Rp)
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.poMinOrderAmount || 100000}
                    onChange={(e) => handleFieldChange('poMinOrderAmount', Number(e.target.value))}
                    prefixLabel="Rp"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Minimal Waktu Pemesanan (H-?)
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.poMinDaysAhead || 1}
                    onChange={(e) => handleFieldChange('poMinDaysAhead', Number(e.target.value))}
                    suffixLabel="Hari"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Persentase DP Wajib (%)
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.poDpPercent || 50}
                    onChange={(e) => handleFieldChange('poDpPercent', Number(e.target.value))}
                    suffixLabel="%"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Syarat &amp; Ketentuan Pre-Order Acara
                </label>
                <textarea
                  rows={3}
                  value={formData.poTermsAndConditions || ''}
                  onChange={(e) => handleFieldChange('poTermsAndConditions', e.target.value)}
                  placeholder="Pesanan PO wajib membayar DP minimal 50%..."
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl p-3 text-xs sm:text-sm text-stone-100 focus:outline-none transition shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Info Rekening Pembayaran DP
                </label>
                <SettingInput
                  value={formData.poBankTransferInfo || ''}
                  onChange={(e) => handleFieldChange('poBankTransferInfo', e.target.value)}
                  placeholder="Transfer DP ke Rekening BCA: 8830192831 a.n Warung Bang Kobra"
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              10. PENGATURAN PRODUK
             ======================================================== */}
          {activeTab === 'products' && (
            <SettingSectionCard
              title="Pengaturan Katalog Menu &amp; Gambar"
              subtitle="Kebijakan saat stok habis, kompresi gambar dan standar porsi produk"
              icon={Package}
            >
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Perilaku Tampilan Menu Saat Stok 0 (Habis)
                </label>
                <SettingSelect
                  value={formData.productOutOfStockBehavior || 'SHOW_DISABLED'}
                  onChange={(e) => handleFieldChange('productOutOfStockBehavior', e.target.value)}
                  options={[
                    { value: 'SHOW_DISABLED', label: 'Tetap Tampilkan dengan Badge HABIS (Tidak Dapat Dipesan)' },
                    { value: 'HIDE', label: 'Sembunyikan Menu Sepenuhnya dari Pelanggan' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Batas Minimum Stok Default
                  </label>
                  <SettingInput
                    type="number"
                    value={formData.defaultMinStock || 5}
                    onChange={(e) => handleFieldChange('defaultMinStock', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Satuan Default Menu
                  </label>
                  <SettingInput
                    value={formData.defaultUnit || 'Porsi'}
                    onChange={(e) => handleFieldChange('defaultUnit', e.target.value)}
                    placeholder="Porsi, Cup, Bungkus"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Maksimal Ukuran Gambar Upload
                  </label>
                  <SettingSelect
                    value={formData.productImageMaxSizeBytes || 2097152}
                    onChange={(e) => handleFieldChange('productImageMaxSizeBytes', Number(e.target.value))}
                    options={[
                      { value: 1048576, label: '1 MB (Sangat Cepat)' },
                      { value: 2097152, label: '2 MB (Standar Web)' },
                      { value: 5242880, label: '5 MB (Resolusi Tinggi)' },
                    ]}
                  />
                </div>
              </div>

              <SettingToggle
                label="Kompresi Gambar Otomatis Saat Upload"
                description="Optimalkan foto makanan secara otomatis agar cepat dimuat di HP Android spesifikasi rendah"
                checked={formData.productAutoCompressImages !== false}
                onChange={(c) => handleFieldChange('productAutoCompressImages', c)}
              />
            </SettingSectionCard>
          )}

          {/* ========================================================
              11. VARIAN PRODUK
             ======================================================== */}
          {activeTab === 'variants' && (
            <SettingSectionCard
              title="Varian Rasa Minuman &amp; Makanan"
              subtitle="Kelola varian sachet multi-rasa (Nutrisari, Pop Ice, Hilo, Chocolatos) & Indomie"
              icon={Layers}
            >
              <SettingToggle
                label="Aktifkan Fitur Multi-Varian Rasa"
                description="Produk utama dapat memiliki pilihan rasa dengan stok dan harga tersendiri"
                checked={formData.variantsEnabled !== false}
                onChange={(c) => handleFieldChange('variantsEnabled', c)}
              />

              <SettingToggle
                label="Wajib Pilih Varian Saat Pemesanan"
                description="Pelanggan dan kasir harus memilih varian rasa sebelum menambahkan ke keranjang"
                checked={formData.variantsRequireSelection !== false}
                onChange={(c) => handleFieldChange('variantsRequireSelection', c)}
              />

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Maksimal Varian Rasa per Produk
                </label>
                <SettingInput
                  type="number"
                  value={formData.variantsMaxPerProduct || 15}
                  onChange={(e) => handleFieldChange('variantsMaxPerProduct', Number(e.target.value))}
                />
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <h4 className="text-xs font-bold text-stone-200">
                  Preset Cepat Varian Bang Kobra:
                </h4>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded-lg bg-stone-900 text-stone-300 border border-stone-800">
                    Indomie: Aceh, Rendang, Goreng, Geprek, Soto, Ayam Bawang
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-stone-900 text-stone-300 border border-stone-800">
                    Minuman: Pop Ice, Nutrisari, Hilo, Chocolatos, Good Day
                  </span>
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              12. KONTROL STOK
             ======================================================== */}
          {activeTab === 'stock' && (
            <SettingSectionCard
              title="Kontrol Stok &amp; Manajemen Opname"
              subtitle="Cegah stok minus dan catat seluruh pergerakan barang ke log audit mutasi stok"
              icon={Database}
            >
              <SettingToggle
                label="Kontrol Stok Otomatis Saat Transaksi"
                description="Kurangi stok secara otomatis setiap kali kasir menyelesaikan transaksi pembayaran"
                checked={formData.stockControl !== false}
                onChange={(c) => handleFieldChange('stockControl', c)}
              />

              <SettingToggle
                label="Izinkan Stok Bernilai Minus (Stok Minus = OFF)"
                description="Jika dinonaktifkan, transaksi akan diblokir apabila stok bahan/menu habis (0)"
                checked={Boolean(formData.allowNegativeStock)}
                onChange={(c) => handleFieldChange('allowNegativeStock', c)}
              />

              <SettingToggle
                label="Peringatan Stok Menipis"
                description="Tampilkan badge kuning/merah jika stok berada di bawah batas minimum"
                checked={formData.notifyLowStock !== false}
                onChange={(c) => handleFieldChange('notifyLowStock', c)}
              />

              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-1.5 text-xs">
                <span className="font-bold text-stone-200">Alasan Penyesuaian Stok (Opname):</span>
                <p className="text-[11px] text-stone-400">
                  {(formData.adjustmentReasons || INITIAL_SETTINGS.adjustmentReasons || []).join(' • ')}
                </p>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              13. STRUK & PRINTER
             ======================================================== */}
          {activeTab === 'receipt' && (
            <SettingSectionCard
              title="Kustomisasi Struk &amp; Mesin Cetak"
              subtitle="Pilih ukuran kertas thermal (58mm/80mm), kelola elemen struk dan lihat preview interaktif"
              icon={Receipt}
              headerAction={
                <button
                  type="button"
                  onClick={() => setIsReceiptPreviewOpen(true)}
                  className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-black shadow-lg shadow-red-950/40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview Struk</span>
                </button>
              }
            >
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Ukuran Lebar Kertas Printer
                </label>
                <SettingSelect
                  value={formData.receiptPaperSize || '58mm'}
                  onChange={(e) => handleFieldChange('receiptPaperSize', e.target.value)}
                  options={[
                    { value: '58mm', label: '58mm (Printer Thermal Standar Mini)' },
                    { value: '80mm', label: '80mm (Printer Kasir Lebar / Desktop)' },
                    { value: 'A4', label: 'A4 / Kertas Invoice Standar' },
                  ]}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-stone-800">
                <h4 className="font-extrabold text-sm text-stone-200 mb-2">
                  Elemen Yang Tampil di Struk
                </h4>
                <SettingToggle
                  label="Tampilkan Logo Toko di Header Struk"
                  checked={formData.receiptShowLogo !== false}
                  onChange={(c) => handleFieldChange('receiptShowLogo', c)}
                />
                <SettingToggle
                  label="Tampilkan Alamat & Kontak Toko"
                  checked={formData.receiptShowAddress !== false}
                  onChange={(c) => handleFieldChange('receiptShowAddress', c)}
                />
                <SettingToggle
                  label="Tampilkan Nama Kasir Bertugas"
                  checked={formData.receiptShowCashier !== false}
                  onChange={(c) => handleFieldChange('receiptShowCashier', c)}
                />
                <SettingToggle
                  label="Tampilkan Nama & Kontak Pelanggan"
                  checked={formData.receiptShowCustomer !== false}
                  onChange={(c) => handleFieldChange('receiptShowCustomer', c)}
                />
                <SettingToggle
                  label="Cetak Barcode QRIS di Struk"
                  description="Mencetak kode QRIS pada bagian bawah struk untuk pembayaran digital"
                  checked={formData.receiptShowQris !== false}
                  onChange={(c) => handleFieldChange('receiptShowQris', c)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  Catatan Footer Struk (Penutup)
                </label>
                <textarea
                  rows={2}
                  value={formData.receiptFooter || ''}
                  onChange={(e) => handleFieldChange('receiptFooter', e.target.value)}
                  placeholder="Matur Suwun / Terima kasih sudah membeli di WARUNG BANG KOBRA 🙏"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-red-500 rounded-xl p-3 text-xs sm:text-sm text-stone-100 focus:outline-none transition shadow-inner"
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              14. EMAIL
             ======================================================== */}
          {activeTab === 'email' && (
            <SettingSectionCard
              title="Integrasi Struk &amp; Notifikasi Email"
              subtitle="Kirim struk digital via email (opsional). Pelanggan tanpa email tetap dapat checkout"
              icon={Mail}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nama Pengirim Email
                  </label>
                  <SettingInput
                    value={formData.emailSenderName || 'Warung Bang Kobra'}
                    onChange={(e) => handleFieldChange('emailSenderName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Alamat Email Pengirim
                  </label>
                  <SettingInput
                    type="email"
                    value={formData.emailSenderAddress || 'warungbangkobra@gmail.com'}
                    onChange={(e) => handleFieldChange('emailSenderAddress', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-stone-800">
                <SettingToggle
                  label="Kirim Struk Digital via Email ke Pelanggan"
                  description="Jika pelanggan mengisi email saat checkout, sistem akan otomatis mengirim struk"
                  checked={formData.emailReceiptEnabled !== false}
                  onChange={(c) => handleFieldChange('emailReceiptEnabled', c)}
                />
                <SettingToggle
                  label="Notifikasi Email Saat Pre-Order (PO) Masuk"
                  checked={formData.emailPoNotificationEnabled !== false}
                  onChange={(c) => handleFieldChange('emailPoNotificationEnabled', c)}
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400">
                <span className="font-bold text-amber-400">PENTING: </span>
                Email pelanggan bersifat <span className="font-bold text-white">TIDAK WAJIB</span>. Jika dikosongkan, checkout tetap berhasil tanpa kendala.
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              15. WHATSAPP
             ======================================================== */}
          {activeTab === 'whatsapp' && (
            <SettingSectionCard
              title="Notifikasi &amp; Template Pesan WhatsApp"
              subtitle="Sesuaikan format pesan otomatis untuk konfirmasi order, pesanan siap, delivery & struk"
              icon={MessageCircle}
              headerAction={
                <button
                  type="button"
                  onClick={() => setIsWaTesterOpen(true)}
                  className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Uji Coba WhatsApp</span>
                </button>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nomor WhatsApp Toko
                  </label>
                  <SettingInput
                    value={formData.whatsappNumber || ''}
                    onChange={(e) => handleFieldChange('whatsappNumber', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nomor WhatsApp Kasir Bertugas
                  </label>
                  <SettingInput
                    value={formData.cashierWhatsappNumber || formData.whatsappNumber || ''}
                    onChange={(e) => handleFieldChange('cashierWhatsappNumber', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-stone-800">
                <h4 className="font-extrabold text-sm text-stone-200">
                  Template Teks Pesan Otomatis (Gunakan Placeholder):
                </h4>
                <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 text-[11px] text-stone-400 flex flex-wrap gap-2">
                  <span className="font-bold text-stone-200">Placeholder:</span>
                  <code className="text-amber-400 font-mono">{'{{nama}}'}</code>
                  <code className="text-amber-400 font-mono">{'{{nomor_order}}'}</code>
                  <code className="text-amber-400 font-mono">{'{{produk}}'}</code>
                  <code className="text-amber-400 font-mono">{'{{total}}'}</code>
                  <code className="text-amber-400 font-mono">{'{{status}}'}</code>
                  <code className="text-amber-400 font-mono">{'{{alamat}}'}</code>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Template: Konfirmasi Pesanan Baru
                  </label>
                  <textarea
                    rows={2}
                    value={formData.waTemplateOrderConfirmation || ''}
                    onChange={(e) => handleFieldChange('waTemplateOrderConfirmation', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 rounded-xl p-3 text-xs sm:text-sm text-stone-100 font-sans focus:outline-none transition shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Template: Pesanan Siap Diambil / Diantar
                  </label>
                  <textarea
                    rows={2}
                    value={formData.waTemplateOrderReady || ''}
                    onChange={(e) => handleFieldChange('waTemplateOrderReady', e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 rounded-xl p-3 text-xs sm:text-sm text-stone-100 font-sans focus:outline-none transition shadow-inner"
                  />
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              16. QR CODE
             ======================================================== */}
          {activeTab === 'qrcode' && (
            <SettingSectionCard
              title="Generator &amp; Standee QR Code"
              subtitle="Buat QR Code untuk meja kasir, promosi brosur, tautan menu online & unduh gambar"
              icon={QrCode}
              headerAction={
                <button
                  type="button"
                  onClick={() => setIsQrGeneratorOpen(true)}
                  className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-black shadow-lg shadow-red-950/40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Buka Generator QR</span>
                </button>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Judul QR Menu Meja
                  </label>
                  <SettingInput
                    value={formData.qrMenuTitle || 'QR MENU WARUNG BANG KOBRA'}
                    onChange={(e) => handleFieldChange('qrMenuTitle', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Judul QR Standee Kasir (Bungkus)
                  </label>
                  <SettingInput
                    value={formData.qrOrderTitle || 'QR ORDER STANDEE KASIR'}
                    onChange={(e) => handleFieldChange('qrOrderTitle', e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-stone-200">
                    Cetak Lembar Standee Kasir &amp; Stiker Meja
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Unduh file gambar beresolusi tinggi (PNG) atau cetak langsung ke printer
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrGeneratorOpen(true)}
                  className="min-h-[38px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition cursor-pointer"
                >
                  Kelola QR
                </button>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              17. NOTIFIKASI & SUARA
             ======================================================== */}
          {activeTab === 'notification' && (
            <SettingSectionCard
              title="Notifikasi Real-time &amp; Suara Chime"
              subtitle="Lonceng audio otomatis saat pesanan pelanggan dari QR masuk ke kasir"
              icon={Bell}
              headerAction={
                <button
                  type="button"
                  onClick={handleTestChime}
                  className="min-h-[40px] px-4 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>Uji Suara Lonceng</span>
                </button>
              }
            >
              <SettingToggle
                label="Suara Chime Lonceng Pesanan Baru Masuk"
                description="Bunyikan nada audio web saat pelanggan mengirim pesanan baru ke kasir"
                checked={formData.notificationSoundEnabled !== false}
                onChange={(c) => handleFieldChange('notificationSoundEnabled', c)}
              />

              <SettingToggle
                label="Getar pada Perangkat Mobile Android"
                description="Getarkan HP saat notifikasi pesanan masuk pada perangkat yang mendukung API vibrasi"
                checked={formData.notificationVibrateEnabled !== false}
                onChange={(c) => handleFieldChange('notificationVibrateEnabled', c)}
              />

              {/* Volume Slider */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-200">Volume Suara Lonceng:</span>
                  <span className="font-mono font-black text-amber-400">
                    {formData.notificationSoundVolume ?? 80}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.notificationSoundVolume ?? 80}
                  onChange={(e) => handleFieldChange('notificationSoundVolume', Number(e.target.value))}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-stone-800">
                <h4 className="font-extrabold text-sm text-stone-200">
                  Pemberitahuan Dalam Aplikasi
                </h4>
                <SettingToggle
                  label="Banner Notifikasi Pesanan Baru Masuk"
                  checked={formData.notifyNewOrder !== false}
                  onChange={(c) => handleFieldChange('notifyNewOrder', c)}
                />
                <SettingToggle
                  label="Notifikasi Antrian Pre-Order (PO)"
                  checked={formData.notifyPO !== false}
                  onChange={(c) => handleFieldChange('notifyPO', c)}
                />
                <SettingToggle
                  label="Notifikasi Pengantaran Kurir Delivery DQM"
                  checked={formData.notifyDelivery !== false}
                  onChange={(c) => handleFieldChange('notifyDelivery', c)}
                />
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              18. PWA MOBILE APP
             ======================================================== */}
          {activeTab === 'pwa' && (
            <SettingSectionCard
              title="Progressive Web App (PWA)"
              subtitle="Instal aplikasi WARUNG BANG KOBRA ke layar utama HP Android tanpa download PlayStore"
              icon={Smartphone}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nama Aplikasi (App Name)
                  </label>
                  <SettingInput
                    value={formData.pwaAppName || 'WARUNG BANG KOBRA'}
                    onChange={(e) => handleFieldChange('pwaAppName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-1">
                    Nama Pendek (Short Name)
                  </label>
                  <SettingInput
                    value={formData.pwaShortName || 'WARKOB'}
                    onChange={(e) => handleFieldChange('pwaShortName', e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-stone-200">
                    Instal Aplikasi ke Layar Utama
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Pasang ikon Bang Kobra langsung di HP untuk akses kasir cepat &amp; offline cache
                  </p>
                </div>
                <div className="shrink-0">
                  <PWAInstallButton />
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              19. PELANGGAN
             ======================================================== */}
          {activeTab === 'customer' && (
            <SettingSectionCard
              title="Portal &amp; Data Pelanggan"
              subtitle="Atur autentikasi pelanggan, validasi WhatsApp dan privasi riwayat pesanan"
              icon={Users}
            >
              <SettingToggle
                label="Izinkan Pemesanan Tamu (Guest Checkout)"
                description="Pelanggan dapat langsung memesan tanpa perlu login akun"
                checked={formData.customerAllowGuest !== false}
                onChange={(c) => handleFieldChange('customerAllowGuest', c)}
              />

              <SettingToggle
                label="Wajib Mengisi Nomor WhatsApp Aktif"
                description="Memastikan kasir dapat menghubungi pelanggan dan mengirim bukti struk"
                checked={formData.customerRequireWhatsApp !== false}
                onChange={(c) => handleFieldChange('customerRequireWhatsApp', c)}
              />

              <SettingToggle
                label="Izinkan Pelanggan Melacak Status Pesanan Mandiri"
                description="Pelanggan dapat melihat status antrian (Menunggu, Diproses, Siap) secara realtime"
                checked={formData.customerAllowSelfHistory !== false}
                onChange={(c) => handleFieldChange('customerAllowSelfHistory', c)}
              />
            </SettingSectionCard>
          )}

          {/* ========================================================
              20. PENGGUNA & RBAC
             ======================================================== */}
          {activeTab === 'users' && (
            <SettingSectionCard
              title="Manajemen Pengguna &amp; Matriks Hak Akses (RBAC)"
              subtitle="Kelola staf kasir, kurir delivery, dan batasan akses per peran pengguna"
              icon={Users}
            >
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                  <h4 className="font-extrabold text-xs sm:text-sm text-stone-200">
                    Daftar Peran Pengguna (User Roles):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800">
                      <div className="font-black text-red-400">1. OWNER (Pemilik)</div>
                      <div className="text-[11px] text-stone-400">Akses penuh seluruh fitur, laporan laba rugi, pengaturan sensitif &amp; reset.</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800">
                      <div className="font-black text-amber-400">2. ADMIN</div>
                      <div className="text-[11px] text-stone-400">Kelola katalog produk, stok opname, laporan transaksi &amp; antrian.</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800">
                      <div className="font-black text-emerald-400">3. KASIR</div>
                      <div className="text-[11px] text-stone-400">Operasional transaksi POS, pembayaran, cetak struk &amp; antrian pesanan.</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800">
                      <div className="font-black text-teal-400">4. KURIR DELIVERY</div>
                      <div className="text-[11px] text-stone-400">Akses dashboard pengantaran Pesantren DQM &amp; upload foto bukti antar.</div>
                    </div>
                  </div>
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              21. KEAMANAN
             ======================================================== */}
          {activeTab === 'security' && (
            <SettingSectionCard
              title="Keamanan Cloud &amp; Autentikasi Firebase"
              subtitle="Perlindungan database Firestore dengan aturan akses berlapis (Security Rules)"
              icon={Shield}
            >
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Firestore Security Rules Aktif &amp; Terlindungi</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Database Anda diamankan oleh berkas <code className="text-amber-400 font-mono">firestore.rules</code> yang telah diverifikasi dan diuji terhadap ancaman akses tidak sah.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2 text-xs">
                <div className="font-bold text-stone-200">Informasi Proyek Firebase:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-400 font-mono">
                  <div>Project ID: <span className="text-white">{firebaseConfig.projectId}</span></div>
                  <div>Auth Domain: <span className="text-white">{firebaseConfig.authDomain}</span></div>
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              22. AUDIT LOG CLOUD
             ======================================================== */}
          {activeTab === 'audit' && (
            <SettingSectionCard
              title="Audit Log Aktivitas Cloud (Firestore)"
              subtitle="Catatan riil setiap aksi perubahan harga, stok, pengaturan, dan transaksi"
              icon={History}
            >
              {/* Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Cari aktivitas, nama staf, atau aksi..."
                  className="w-full min-h-[38px] bg-stone-950 border border-stone-800 rounded-xl px-3 text-xs text-stone-100 placeholder-stone-500"
                />
              </div>

              {/* Log List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-500">
                    Belum ada riwayat aktivitas yang tercatat.
                  </div>
                ) : (
                  auditLogs
                    .filter((log) => {
                      if (!auditSearch) return true;
                      const q = auditSearch.toLowerCase();
                      return (
                        (log.action || '').toLowerCase().includes(q) ||
                        (log.actor || '').toLowerCase().includes(q) ||
                        (log.details || '').toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 30)
                    .map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-red-400">
                              [{log.action}]
                            </span>
                            <span className="font-semibold text-stone-200">
                              {log.details}
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-500 mt-0.5">
                            Oleh: <span className="text-stone-300 font-bold">{log.actor || 'Kasir'}</span> • Peran: {log.role || 'Staff'}
                          </div>
                        </div>
                        <div className="text-[10px] text-stone-500 font-mono shrink-0">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-'}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              23. DATA & BACKUP
             ======================================================== */}
          {activeTab === 'backup' && (
            <SettingSectionCard
              title="Ekspor Data &amp; Cadangan (Backup)"
              subtitle="Unduh data produk, transaksi, pelanggan & laporan ke berkas Excel (.xlsx)"
              icon={FileSpreadsheet}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    exportProductsToExcel(products);
                    showToast('Data produk berhasil diekspor ke Excel!', 'success');
                  }}
                  className="min-h-[44px] p-3 rounded-2xl bg-stone-950 border border-stone-800 hover:border-emerald-500/50 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-stone-200">Ekspor Produk (.xlsx)</div>
                    <div className="text-[10px] text-stone-400">{products.length} Menu</div>
                  </div>
                  <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const txs = StorageService.getTransactions();
                    exportTransactionsToExcel(txs);
                    showToast('Data transaksi berhasil diekspor ke Excel!', 'success');
                  }}
                  className="min-h-[44px] p-3 rounded-2xl bg-stone-950 border border-stone-800 hover:border-emerald-500/50 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-stone-200">Ekspor Transaksi (.xlsx)</div>
                    <div className="text-[10px] text-stone-400">Riwayat Penjualan</div>
                  </div>
                  <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const custs = StorageService.getCustomers();
                    exportCustomersToExcel(custs);
                    showToast('Data pelanggan berhasil diekspor ke Excel!', 'success');
                  }}
                  className="min-h-[44px] p-3 rounded-2xl bg-stone-950 border border-stone-800 hover:border-emerald-500/50 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-stone-200">Ekspor Pelanggan (.xlsx)</div>
                    <div className="text-[10px] text-stone-400">Buku Kontak WA</div>
                  </div>
                  <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                </button>
              </div>

              {/* DANGER ZONE (OWNER ONLY) */}
              <div className="pt-4 border-t border-rose-900/40 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-extrabold text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Zona Berbahaya (Khusus Owner)</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-rose-200">
                      Reset Data Transaksi &amp; Kasir ke Default Demo
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Tindakan ini akan mengosongkan data demo lokal dan memuat ulang data awal warung.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDangerResetDbOpen(true)}
                    className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shrink-0 transition active:scale-95 cursor-pointer"
                  >
                    Reset Data Demo
                  </button>
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* ========================================================
              24. TENTANG WARUNG BANG KOBRA
             ======================================================== */}
          {activeTab === 'about' && (
            <SettingSectionCard
              title="Tentang Aplikasi Warung Bang Kobra"
              subtitle="Informasi arsitektur sistem, versi rilis, status konektivitas Firebase Firestore dan hak cipta"
              icon={Sparkles}
            >
              <div className="space-y-6">
                {/* App Identity Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-950 border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 via-orange-600 to-amber-600 p-0.5 shadow-xl shadow-red-950/60 shrink-0">
                      <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center p-2">
                        <img
                          src={formData.logoUrl || '/icon.svg'}
                          alt={formData.storeName}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/icon.svg';
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-lg text-white tracking-tight">
                          {formData.storeName || 'WARUNG BANG KOBRA'}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-black uppercase">
                          v2.5.0 PRO
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {formData.tagline || 'Sistem Point of Sale, Manajemen Pesanan & Katalog Online Terpadu'}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        {formData.address || formData.storeAddress || 'Area Pesantren DQM'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        showToast('Menguji koneksi ke cloud Firestore...', 'info');
                        const res = await testFirestoreConnection();
                        if (res.connected) {
                          showToast('Firestore terhubung realtime!', 'success');
                        } else {
                          showToast(`Koneksi Firestore: ${res.message}`, 'error');
                        }
                      }}
                      className="flex-1 sm:flex-none min-h-[42px] px-4 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-bold flex items-center justify-center gap-2 border border-stone-700 transition cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-emerald-400" />
                      <span>Tes Cloud Firestore</span>
                    </button>
                  </div>
                </div>

                {/* Cloud & Architecture Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-stone-950 border border-stone-850 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-orange-400" />
                      Database Realtime
                    </div>
                    <div className="font-extrabold text-sm text-stone-100">Google Cloud Firestore</div>
                    <div className="text-[11px] text-stone-400 font-mono truncate">
                      {firebaseConfig.projectId || 'ai-studio-remixwarungbangk'}
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Two-Way Realtime Sync
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-950 border border-stone-850 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-red-400" />
                      Keamanan &amp; Autentikasi
                    </div>
                    <div className="font-extrabold text-sm text-stone-100">Firebase Auth &amp; RBAC</div>
                    <div className="text-[11px] text-stone-400">
                      Rules v2 Terverifikasi (Admin, Kasir, Kurir, Dapur)
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      PIN &amp; Session Protected
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-950 border border-stone-850 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                      Platform &amp; Offline
                    </div>
                    <div className="font-extrabold text-sm text-stone-100">Progressive Web App (PWA)</div>
                    <div className="text-[11px] text-stone-400">
                      Service Worker + IndexedDB / Local Cache
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      Offline-First Resilient
                    </div>
                  </div>
                </div>

                {/* Feature Capabilities Checklist */}
                <div className="p-4 rounded-2xl bg-stone-950 border border-stone-850 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-stone-300">
                    Modul Terintegrasi Aktif:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-300">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-900/60 border border-stone-850">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>POS Kasir Cepat &amp; Varian Sachet Minuman</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-900/60 border border-stone-850">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Layanan Bungkus (Takeaway) &amp; Panggilan Antrian Suara</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-900/60 border border-stone-850">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Delivery DQM (Min. Rp20.000) &amp; Kurir Internal</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-900/60 border border-stone-850">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Pesanan Acara / PO Katering dengan Down Payment (DP)</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-900/60 border border-stone-850">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Katalog Web Pelanggan Responsif &amp; Order WhatsApp Otomatis</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-900/60 border border-stone-850">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Audit Log Cloud, Rekap Kas &amp; Ekspor Excel .xlsx</span>
                    </div>
                  </div>
                </div>

                {/* Developer & Legal Footer */}
                <div className="p-4 rounded-2xl bg-stone-900/40 border border-stone-800 text-center space-y-1.5">
                  <p className="text-xs font-bold text-stone-300">
                    WARUNG BANG KOBRA · Sistem POS &amp; Order Operasional v2.5.0
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Dirancang khusus untuk operasional kuliner cepat, delivery santri &amp; acara katering pesantren.
                  </p>
                  <p className="text-[10px] text-stone-600 pt-1">
                    Hak Cipta &copy; {new Date().getFullYear()} Warung Bang Kobra. Seluruh hak cipta dilindungi.
                  </p>
                </div>
              </div>
            </SettingSectionCard>
          )}

          {/* Mobile Sticky Floating Save Bar */}
          {isDirty && (
            <div className="lg:hidden fixed bottom-4 inset-x-4 z-40 bg-stone-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="text-xs font-bold text-amber-300 truncate">
                  Perubahan belum disimpan
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-black text-xs shadow-lg flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {/* 1. Receipt Live Preview Modal */}
      <ReceiptPreviewModal
        isOpen={isReceiptPreviewOpen}
        onClose={() => setIsReceiptPreviewOpen(false)}
        settings={formData}
      />

      {/* 2. WhatsApp Tester Modal */}
      <WhatsAppTesterModal
        isOpen={isWaTesterOpen}
        onClose={() => setIsWaTesterOpen(false)}
        settings={formData}
        showToast={showToast}
      />

      {/* 3. QR Code Generator Modal */}
      <QRCodeGeneratorModal
        isOpen={isQrGeneratorOpen}
        onClose={() => setIsQrGeneratorOpen(false)}
        settings={formData}
        showToast={showToast}
      />

      {/* 4. Reset Settings Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-base text-stone-100">
                Kembalikan Pengaturan ke Default?
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Nilai konfigurasi formulir akan dikembalikan ke pengaturan standar Bang Kobra. Pastikan menekan &quot;Simpan Perubahan&quot; sesudahnya.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-stone-800 text-stone-300 font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="flex-1 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-lg"
              >
                Ya, Reset Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Danger Database Reset Confirmation Modal */}
      {isDangerResetDbOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-stone-900 border-2 border-rose-600 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-base text-rose-300">
                Konfirmasi Reset Data (Owner Only)
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Apakah Anda benar-benar yakin ingin mengatur ulang data demo aplikasi? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDangerResetDbOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-stone-800 text-stone-300 font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetData();
                  setIsDangerResetDbOpen(false);
                  showToast('Data berhasil di-reset ke nilai awal!', 'info');
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-950/60"
              >
                Konfirmasi Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
