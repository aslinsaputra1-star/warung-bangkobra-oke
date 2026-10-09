import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Smartphone,
  Plus,
  Share2,
  Sparkles,
  Download,
  Copy,
  Check,
  Trash2,
  Bookmark,
  RotateCcw,
  Bike,
  Image as ImageIcon,
  Tag,
  DollarSign,
  Type,
  Eye,
  ArrowLeft,
  X,
  ExternalLink,
  MessageCircle,
  Clock,
  Layers,
  ChevronRight,
  Flame,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import {
  Product,
  StoreSettings,
  WarungUser,
  WhatsAppStatusItem,
  WhatsAppStatusTemplate,
  WhatsAppStatusTemplateType,
} from '../../types';
import { formatRupiah, sanitizeWhatsAppNumber } from '../../utils/formatters';
import {
  WhatsAppStatusService,
  PRESET_STATUS_TEMPLATES,
} from '../../services/whatsappStatusService';

interface WhatsAppStatusViewProps {
  products: Product[];
  settings: StoreSettings;
  currentUser: WarungUser | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type MainTab = 'latest' | 'templates' | 'history' | 'editor' | 'preview';

export const WhatsAppStatusView: React.FC<WhatsAppStatusViewProps> = ({
  products,
  settings,
  currentUser,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('latest');
  const [templates, setTemplates] = useState<WhatsAppStatusTemplate[]>(PRESET_STATUS_TEMPLATES);
  const [history, setHistory] = useState<WhatsAppStatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Editor State
  const [editingItem, setEditingItem] = useState<WhatsAppStatusItem>(() => {
    const defaultProduct = products[0];
    return {
      statusId: `status-${Date.now()}`,
      title: '🔥 Promo Spesial Hari Ini',
      templateType: 'PROMO_HARI_INI',
      badgeText: '🔥 PROMO HARI INI',
      productName: defaultProduct ? defaultProduct.nama : 'Jus Mangga Segar',
      productCategory: defaultProduct ? defaultProduct.kategori : 'Minuman',
      imageUrl: defaultProduct?.foto || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&auto=format&fit=crop&q=80',
      tagline: 'Enak • Murah • Dekat',
      text: 'Pesan menu favorit hari ini dengan harga lebih hemat! Siap antar atau ambil di warung.',
      price: defaultProduct ? defaultProduct.harga_jual : 10000,
      promoPrice: undefined,
      ctaText: '🛒 PESAN SEKARANG',
      customerAppUrl: WhatsAppStatusService.getCustomerAppUrl(settings),
      isDeliveryPromo: false,
      deliveryMinOrder: 20000,
      themeStyle: 'red-glow',
      createdBy: currentUser?.nama || 'Owner',
      createdAt: new Date().toISOString(),
    };
  });

  // Selected product ID in dropdown
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');

  // Generated Canvas Image Preview State
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isGeneratingCanvas, setIsGeneratingCanvas] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedCustomerLink, setCopiedCustomerLink] = useState(false);

  const customerProdUrl = useMemo(() => {
    return WhatsAppStatusService.getCustomerAppUrl(settings);
  }, [settings]);

  const handleCopyCustomerLink = async () => {
    try {
      await navigator.clipboard.writeText(customerProdUrl);
      setCopiedCustomerLink(true);
      showToast('Tautan Pelanggan berhasil disalin! Siap ditempel ke WhatsApp Status.', 'success');
      setTimeout(() => setCopiedCustomerLink(false), 2500);
    } catch {
      showToast('Gagal menyalin tautan pelanggan', 'error');
    }
  };

  const handleShareMenuOnline = () => {
    const text = `🍽️ *MENU ONLINE WARUNG BANG KOBRA*\n\nPesan makanan lezat & minuman segar favorit langsung dari HP tanpa antre!\n👉 ${customerProdUrl}\n\n🛵 Melayani Bungkus & Delivery Khusus Area Pesantren DQM!`;
    const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    try {
      const a = document.createElement('a');
      a.href = shareUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.href = shareUrl;
    }
  };

  const isOwnerOrAdmin = useMemo(() => {
    if (!currentUser) return true;
    const role = (currentUser.role || '').toUpperCase();
    return role === 'OWNER' || role === 'ADMIN';
  }, [currentUser]);

  // Load templates & history
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tpls, hist] = await Promise.all([
        WhatsAppStatusService.getTemplates(),
        WhatsAppStatusService.getHistory(),
      ]);
      setTemplates(tpls);
      setHistory(hist);
    } catch (e) {
      console.warn('Failed to load whatsapp status data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Product selection handler
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setEditingItem((prev) => ({
        ...prev,
        productName: prod.nama,
        productCategory: prod.kategori,
        imageUrl: prod.foto || prev.imageUrl,
        price: prod.harga_jual,
        productIds: [prod.id],
      }));
    }
  };

  // Preset Template Selection handler
  const handleSelectTemplate = (template: WhatsAppStatusTemplate) => {
    setEditingItem({
      ...template,
      statusId: `status-${Date.now()}`,
      customerAppUrl: WhatsAppStatusService.getCustomerAppUrl(settings),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.nama || 'Owner',
    });
    setActiveTab('editor');
    showToast(`Template "${template.title}" siap diedit!`, 'info');
  };

  // Custom Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setEditingItem((prev) => ({
          ...prev,
          imageUrl: reader.result as string,
        }));
        showToast('Foto promo berhasil dimuat!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // Render & Open Preview
  const handleOpenPreview = async () => {
    setIsGeneratingCanvas(true);
    setActiveTab('preview');
    try {
      const { blob, dataUrl } = await WhatsAppStatusService.generateStatusCanvasBlob(
        editingItem,
        settings
      );
      setPreviewBlob(blob);
      setPreviewDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate preview image:', err);
      showToast('Gagal memproses gambar status canvas', 'error');
    } finally {
      setIsGeneratingCanvas(false);
    }
  };

  // Share to WhatsApp Handler (Section 8)
  const handleShareToWhatsApp = async () => {
    const caption = [
      `${editingItem.badgeText || '🔥 PROMO WARUNG BANG KOBRA'}`,
      ``,
      `*${editingItem.productName || editingItem.title}*`,
      editingItem.tagline ? `_${editingItem.tagline}_` : '',
      editingItem.promoPrice
        ? `Harga Spesial: *${formatRupiah(editingItem.promoPrice)}* (Coret: ~${formatRupiah(editingItem.price || 0)}~)`
        : editingItem.price
        ? `Harga: *${formatRupiah(editingItem.price)}*`
        : '',
      ``,
      editingItem.text || '',
      ``,
      editingItem.isDeliveryPromo
        ? `🛵 Delivery DQM: Minimal belanja Rp20.000`
        : '',
      `🛒 Pesan online langsung tanpa antri:`,
      `${editingItem.customerAppUrl || WhatsAppStatusService.getCustomerAppUrl(settings)}`,
      ``,
      `📍 *${settings.storeName || 'WARUNG BANG KOBRA'}*`,
    ]
      .filter(Boolean)
      .join('\n');

    // 1. Record to History
    await WhatsAppStatusService.recordHistory(editingItem);
    setHistory((prev) => [editingItem, ...prev]);

    // 2. Try native Web Share API with image file
    if (previewBlob && navigator.canShare && navigator.canShare({ files: [new File([previewBlob], 'status-promo.png', { type: 'image/png' })] })) {
      try {
        const file = new File([previewBlob], 'status-promo.png', { type: 'image/png' });
        await navigator.share({
          title: editingItem.title,
          text: caption,
          files: [file],
        });
        showToast('Berhasil membuka menu bagikan WhatsApp!', 'success');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Web Share failed, fallback to download & WhatsApp:', err);
        } else {
          return;
        }
      }
    }

    // 3. Fallback: Download image and open WhatsApp with caption
    if (previewDataUrl) {
      const a = document.createElement('a');
      a.href = previewDataUrl;
      a.download = `Status-WBK-${Date.now()}.png`;
      a.click();
    }

    // Copy caption to clipboard
    navigator.clipboard?.writeText(caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 3000);

    // Open WhatsApp with text prefilled for status / chat
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`;
    try {
      const a = document.createElement('a');
      a.href = waUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.href = waUrl;
    }
    showToast('Gambar telah diunduh & teks promosi Customer Layout siap dibagikan ke WhatsApp Status!', 'success');
  };

  // Save current design as Template (Section 10)
  const handleSaveAsTemplate = async () => {
    if (!isOwnerOrAdmin) {
      showToast('Hanya Owner dan Admin yang dapat menyimpan template.', 'error');
      return;
    }

    const templateName = prompt('Beri nama template ini:', editingItem.title);
    if (!templateName || !templateName.trim()) return;

    const newTemplate: WhatsAppStatusTemplate = {
      ...editingItem,
      statusId: `tpl-${Date.now()}`,
      title: templateName.trim(),
      isPreset: false,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.nama || 'Owner',
    };

    await WhatsAppStatusService.saveTemplate(newTemplate);
    setTemplates((prev) => [newTemplate, ...prev]);
    showToast(`Template "${templateName}" berhasil disimpan!`, 'success');
  };

  // Delete Template
  const handleDeleteTemplate = async (statusId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Hapus template ini dari daftar?')) return;
    await WhatsAppStatusService.deleteTemplate(statusId);
    setTemplates((prev) => prev.filter((t) => t.statusId !== statusId));
    showToast('Template berhasil dihapus', 'info');
  };

  return (
    <div className="flex-1 bg-stone-900 text-stone-100 flex flex-col min-h-screen">
      {/* 1. TOP HEADER */}
      <header className="bg-stone-950 border-b border-stone-800 px-4 sm:px-6 py-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  📱 Status WhatsApp
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Promo 9:16
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Buat promo menarik untuk dibagikan ke WhatsApp Status dalam 1 menit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingItem({
                  statusId: `status-${Date.now()}`,
                  title: '🔥 Promo Baru Hari Ini',
                  templateType: 'PROMO_HARI_INI',
                  badgeText: '🔥 PROMO HARI INI',
                  productName: products[0]?.nama || 'Menu Favorit',
                  productCategory: products[0]?.kategori || 'Makanan',
                  imageUrl: products[0]?.foto || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&auto=format&fit=crop&q=80',
                  tagline: 'Enak • Murah • Dekat',
                  text: 'Pesan sekarang di Warung Bang Kobra, nikmati kelezatan tiada tara!',
                  price: products[0]?.harga_jual || 10000,
                  ctaText: '🛒 PESAN SEKARANG',
                  customerAppUrl: WhatsAppStatusService.getCustomerAppUrl(settings),
                  isDeliveryPromo: false,
                  deliveryMinOrder: 20000,
                  themeStyle: 'red-glow',
                  createdBy: currentUser?.nama || 'Owner',
                  createdAt: new Date().toISOString(),
                });
                setActiveTab('editor');
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-red-950/60 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Buat Status Baru</span>
            </button>
          </div>
        </div>

        {/* SUB NAVIGATION TABS */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto scrollbar-none border-t border-stone-800/80 pt-3">
          {[
            { id: 'latest', label: '🔥 Status Terbaru' },
            { id: 'templates', label: `🎨 Template Status (${templates.length})` },
            { id: 'history', label: `📜 Riwayat Status (${history.length})` },
            { id: 'editor', label: '✏️ Editor Status' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as MainTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-red-600 text-white shadow-md shadow-red-950'
                  : 'bg-stone-800/80 text-stone-300 hover:bg-stone-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* PROD VERCEL CUSTOMER URL BANNER */}
        <div className="mt-3 bg-stone-900/90 border border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Link Produksi Pelanggan
                </span>
                <span className="text-xs font-mono font-bold text-stone-200 truncate select-all">
                  {customerProdUrl}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Tautan resmi pelanggan untuk dipasang di WhatsApp Status / Bio WA. Mengarah langsung ke Menu Online &amp; Delivery DQM.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={handleCopyCustomerLink}
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
            >
              {copiedCustomerLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCustomerLink ? 'Tersalin!' : 'Salin Link Pelanggan'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareMenuOnline}
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bagikan Menu</span>
            </button>

            <a
              href={customerProdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
              title="Buka Halaman Pelanggan di Tab Baru"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. BODY CONTENT */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {/* ================= TAB 1: STATUS TERBARU ================= */}
        {activeTab === 'latest' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Quick Hero Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-red-950 via-rose-950 to-stone-900 border border-red-800/40 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="space-y-2 text-center md:text-left">
                <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-red-600 text-white inline-block">
                  🚀 Promosi Instan
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Posting Status WhatsApp Tanpa Desain Manual
                </h2>
                <p className="text-xs sm:text-sm text-stone-300 max-w-lg leading-relaxed">
                  Pilih salah satu template siap pakai di bawah, sesuaikan produk menu dan harga, lalu langsung bagikan poster 9:16 beresolusi tinggi ke status WhatsApp Anda.
                </p>
                <div className="pt-2 flex items-center justify-center md:justify-start gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-xs text-white shadow-md transition"
                  >
                    Buka Editor Bebas
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('templates')}
                    className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 font-bold text-xs text-stone-200 transition"
                  >
                    Lihat Semua Template
                  </button>
                </div>
              </div>

              {/* 9:16 Mini Preview Mockup */}
              <div className="w-36 sm:w-44 aspect-[9/16] rounded-2xl bg-gradient-to-b from-red-600 to-amber-700 p-2.5 shadow-2xl border-4 border-stone-800 shrink-0 flex flex-col justify-between text-white text-center">
                <div className="text-[10px] font-black bg-amber-400 text-stone-900 rounded-full py-0.5">
                  PROMO HARI INI
                </div>
                <div className="my-auto">
                  <div className="w-20 h-20 rounded-xl bg-white/20 mx-auto overflow-hidden shadow mb-1">
                    <img
                      src={products[0]?.foto || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=200&auto=format&fit=crop&q=80'}
                      alt="Sample"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-black block leading-tight">
                    {products[0]?.nama || 'Jus Mangga'}
                  </span>
                  <span className="text-xs font-black text-yellow-300">
                    {formatRupiah(products[0]?.harga_jual || 10000)}
                  </span>
                </div>
                <div className="text-[8px] bg-green-500 font-bold py-1 rounded-lg">
                  PESAN SEKARANG
                </div>
              </div>
            </div>

            {/* Quick Template Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Template Populer Siap Pakai
                </h3>
                <span className="text-xs text-stone-400">Pilih untuk langsung edit</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {templates.slice(0, 10).map((tpl) => (
                  <div
                    key={tpl.statusId}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 hover:border-red-600/60 hover:bg-stone-900 transition flex flex-col justify-between group cursor-pointer shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-600/30">
                          {tpl.templateType.replace('PROMO_', '')}
                        </span>
                        {!tpl.isPreset && isOwnerOrAdmin && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTemplate(tpl.statusId, e)}
                            className="text-stone-500 hover:text-rose-400 p-0.5"
                            title="Hapus template kustom"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition line-clamp-1">
                        {tpl.title}
                      </h4>
                      <p className="text-[11px] text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                        {tpl.text}
                      </p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-red-400 font-bold">
                      <span>Gunakan Template</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: TEMPLATES ================= */}
        {activeTab === 'templates' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Daftar Template Status WhatsApp</h3>
                <p className="text-xs text-stone-400">
                  Termasuk 10 template bawaan Warung Bang Kobra dan template yang disimpan oleh Owner
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                + Buat Template Baru
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tpl) => (
                <div
                  key={tpl.statusId}
                  onClick={() => handleSelectTemplate(tpl)}
                  className="p-4 rounded-3xl bg-stone-950 border border-stone-800 hover:border-red-500/50 transition cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {tpl.badgeText || tpl.title}
                      </span>
                      {tpl.isPreset ? (
                        <span className="text-[10px] text-stone-500 font-mono">Bawaan</span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold">⭐ Kustom</span>
                      )}
                    </div>
                    <h4 className="text-sm font-black text-white group-hover:text-red-400 transition">
                      {tpl.title}
                    </h4>
                    <p className="text-xs text-stone-400 line-clamp-2">
                      {tpl.text}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-red-500">Pakai Desain Ini →</span>
                    {!tpl.isPreset && isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTemplate(tpl.statusId, e)}
                        className="text-stone-500 hover:text-rose-400 p-1"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: RIWAYAT STATUS ================= */}
        {activeTab === 'history' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div>
              <h3 className="text-base font-black text-white">Riwayat Status yang Dibuat</h3>
              <p className="text-xs text-stone-400">
                Gunakan kembali promo yang pernah Anda bagikan sebelumnya
              </p>
            </div>

            {history.length === 0 ? (
              <div className="py-20 text-center text-stone-500 space-y-3">
                <Smartphone className="w-12 h-12 mx-auto text-stone-600 stroke-1" />
                <h4 className="text-base font-bold text-stone-300">Belum ada Riwayat Status</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Status promosi yang Anda buat dan bagikan ke WhatsApp akan otomatis tercatat di sini.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs"
                >
                  + Buat Status Pertama
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((h, i) => (
                  <div
                    key={h.statusId || i}
                    className="p-4 rounded-3xl bg-stone-950 border border-stone-800 flex items-center gap-4 hover:border-stone-700 transition"
                  >
                    <div className="w-16 h-24 rounded-2xl bg-stone-900 border border-stone-800 overflow-hidden shrink-0">
                      <img
                        src={h.imageUrl || products[0]?.foto || ''}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{h.productName || h.title}</h4>
                      <span className="text-[11px] text-amber-400 font-bold block mt-0.5">
                        {h.price ? formatRupiah(h.price) : 'Promo'}
                      </span>
                      <span className="text-[10px] text-stone-500 block mt-1">
                        {new Date(h.createdAt).toLocaleDateString('id-ID')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem({
                            ...h,
                            statusId: `status-${Date.now()}`,
                            createdAt: new Date().toISOString(),
                          });
                          setActiveTab('editor');
                        }}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Gunakan Lagi
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: EDITOR STATUS ================= */}
        {activeTab === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
            {/* Left: Form Controls (7 Cols) */}
            <div className="lg:col-span-7 bg-stone-950 p-5 sm:p-6 rounded-3xl border border-stone-800 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div>
                  <h3 className="text-base font-black text-white">Editor Status WhatsApp</h3>
                  <p className="text-xs text-stone-400">Sesuaikan konten promosi 9:16 Anda</p>
                </div>
                {isOwnerOrAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveAsTemplate}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    Simpan Template
                  </button>
                )}
              </div>

              {/* 1. Pilih Produk dari Database (Section 2) */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-red-500" />
                  Pilih Produk dari Database Warung:
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-900 border border-stone-800 text-stone-100 text-xs sm:text-sm focus:outline-none focus:border-red-500"
                >
                  <option value="">-- Pilih Produk Toko --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} • {formatRupiah(p.harga_jual)} ({p.kategori})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Badge & Judul Promo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    Label Badge Atas:
                  </label>
                  <input
                    type="text"
                    value={editingItem.badgeText || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, badgeText: e.target.value })}
                    placeholder="Contoh: 🔥 PROMO HARI INI"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    Nama Menu / Judul Utama:
                  </label>
                  <input
                    type="text"
                    value={editingItem.productName || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, productName: e.target.value })}
                    placeholder="Contoh: Jus Mangga Segar"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* 3. Harga Normal & Harga Promo (Coret) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Harga (Rp):
                  </label>
                  <input
                    type="number"
                    value={editingItem.price || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) || 0 })}
                    placeholder="Contoh: 10000"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    Harga Promo / Diskon (Opsional):
                  </label>
                  <input
                    type="number"
                    value={editingItem.promoPrice || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, promoPrice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Contoh: 8000"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              {/* 4. Tagline & Teks Deskripsi */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    Tagline Promosi:
                  </label>
                  <input
                    type="text"
                    value={editingItem.tagline || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, tagline: e.target.value })}
                    placeholder="Contoh: Enak • Murah • Dekat"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    Teks Penjelas Promo:
                  </label>
                  <textarea
                    rows={2}
                    value={editingItem.text || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                    placeholder="Pesan sekarang, nikmati lebih cepat & lezat!"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>
              </div>

              {/* 5. Upload Custom Foto / URL */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                  Foto Produk / Gambar Promo:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editingItem.imageUrl || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })}
                    placeholder="URL Foto Produk..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-red-500"
                  />
                  <label className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* 6. Pilihan Tema Warna Canvas */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1.5">
                  Tema Desain Visual 9:16:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                  {[
                    { id: 'red-glow', label: '🔥 Merah Kobra' },
                    { id: 'sunset-orange', label: '🌅 Sunset Orange' },
                    { id: 'dark-fire', label: '🖤 Dark Fire' },
                    { id: 'gold-premium', label: '⭐ Gold Premium' },
                    { id: 'fresh-white', label: '✨ Segar Merah' },
                  ].map((th) => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, themeStyle: th.id as any })}
                      className={`p-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                        editingItem.themeStyle === th.id
                          ? 'border-red-500 bg-red-600/30 text-white'
                          : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      {th.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 7. Toggle Delivery Info (Section 5) */}
              <div className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bike className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Tampilkan Informasi Delivery Pesantren DQM
                    </span>
                    <span className="text-[11px] text-stone-400 block">
                      Menampilkan syarat delivery Pesantren DQM & minimal belanja Rp20.000
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(editingItem.isDeliveryPromo)}
                  onChange={(e) => setEditingItem({ ...editingItem, isDeliveryPromo: e.target.checked })}
                  className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                />
              </div>

              {/* CTA Button Text */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Teks Tombol CTA Visual:
                </label>
                <input
                  type="text"
                  value={editingItem.ctaText || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, ctaText: e.target.value })}
                  placeholder="🛒 PESAN SEKARANG"
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-red-500 font-bold"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('latest')}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-red-950/60 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Lihat Preview 9:16 & Bagikan</span>
                </button>
              </div>
            </div>

            {/* Right: Live Interactive Mockup (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-stone-950 rounded-3xl border border-stone-800">
              <span className="text-xs font-bold text-stone-400 mb-3 uppercase tracking-wider">
                📱 Simulasi Layar WhatsApp Status (9:16)
              </span>

              {/* Smartphone Frame 9:16 */}
              <div className="w-full max-w-[280px] aspect-[9/16] rounded-3xl bg-gradient-to-b from-red-800 via-rose-700 to-red-900 p-4 shadow-2xl border-4 border-stone-800 flex flex-col justify-between text-white text-center relative overflow-hidden select-none">
                {/* Header branding */}
                <div>
                  <h4 className="text-xs font-black tracking-tight drop-shadow">
                    {settings.storeName || 'WARUNG BANG KOBRA'}
                  </h4>
                  <span className="text-[9px] text-white/80 tracking-widest uppercase">
                    ENAK • MURAH • DEKAT
                  </span>

                  {/* Badge */}
                  <div className="mt-2 inline-block px-3 py-1 rounded-full text-[10px] font-black bg-amber-400 text-stone-950 shadow">
                    {editingItem.badgeText || '🔥 PROMO HARI INI'}
                  </div>
                </div>

                {/* Product Box */}
                <div className="my-auto py-2">
                  <div className="w-36 h-36 mx-auto rounded-2xl bg-white p-1.5 shadow-lg overflow-hidden border border-white/20">
                    <img
                      src={editingItem.imageUrl || 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80'}
                      alt="Product"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>
                  <h3 className="text-sm font-black mt-2 leading-tight drop-shadow">
                    {editingItem.productName || editingItem.title}
                  </h3>
                  {editingItem.tagline && (
                    <span className="text-[10px] text-yellow-300 font-bold block mt-0.5">
                      {editingItem.tagline}
                    </span>
                  )}

                  {/* Price */}
                  <div className="mt-2 inline-block bg-white text-red-600 px-4 py-1 rounded-full font-black text-sm shadow">
                    {editingItem.promoPrice ? formatRupiah(editingItem.promoPrice) : editingItem.price ? formatRupiah(editingItem.price) : 'Rp10.000'}
                  </div>
                </div>

                {/* Footer Delivery & CTA */}
                <div className="space-y-1.5">
                  {editingItem.isDeliveryPromo && (
                    <div className="bg-stone-950/70 p-1.5 rounded-xl text-[9px] leading-tight text-sky-300">
                      🚚 Area Pesantren DQM • Min. Rp20.000
                    </div>
                  )}
                  <div className="py-2 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 text-white font-black text-xs shadow-lg">
                    {editingItem.ctaText || '🛒 PESAN SEKARANG'}
                  </div>
                  <span className="text-[8px] text-white/70 block">
                    Balas status ini atau klik link di atas
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: PREVIEW & BAGIKAN ================= */}
        {activeTab === 'preview' && (
          <div className="max-w-xl mx-auto space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← Kembali ke Editor</span>
              </button>
              <h3 className="text-sm font-black text-white">Preview Status 9:16</h3>
            </div>

            {/* Canvas Output Display */}
            <div className="bg-stone-950 p-4 rounded-3xl border border-stone-800 shadow-2xl flex flex-col items-center">
              {isGeneratingCanvas ? (
                <div className="py-24 text-center space-y-3">
                  <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <span className="text-xs text-stone-400 font-bold block">
                    Menghasilkan grafik HD 1080x1920...
                  </span>
                </div>
              ) : previewDataUrl ? (
                <div className="w-full max-w-[320px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-2 border-stone-700">
                  <img
                    src={previewDataUrl}
                    alt="WhatsApp Status Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : null}
            </div>

            {/* Share to WhatsApp CTAs (Section 8) */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleShareToWhatsApp}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-[0.98] text-white font-black text-base shadow-xl shadow-emerald-950/70 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Share2 className="w-5 h-5" />
                <span>📱 Bagikan ke WhatsApp Status</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCopyCustomerLink}
                  className="py-3 px-3 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer border border-emerald-500/40"
                >
                  {copiedCustomerLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCustomerLink ? 'Link Tersalin!' : 'Salin Link Pelanggan'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareMenuOnline}
                  className="py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-stone-700"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>Bagikan Menu Online</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (previewDataUrl) {
                      const a = document.createElement('a');
                      a.href = previewDataUrl;
                      a.download = `Status-WBK-${Date.now()}.png`;
                      a.click();
                      showToast('Gambar 1080x1920 HD berhasil diunduh!', 'success');
                    }
                  }}
                  className="py-3 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Unduh Gambar HD
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const text = `🔥 ${editingItem.productName || editingItem.title}\n${editingItem.customerAppUrl || customerProdUrl}`;
                    navigator.clipboard?.writeText(text);
                    setCopiedCaption(true);
                    setTimeout(() => setCopiedCaption(false), 2000);
                    showToast('Teks tautan & caption disalin!', 'info');
                  }}
                  className="py-3 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {copiedCaption ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copiedCaption ? 'Tersalin!' : 'Salin Caption + Link'}
                </button>
              </div>

              {/* Verified Link Destination Notice */}
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Target Link: Layout Pelanggan
                  </span>
                  <a
                    href={customerProdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-300 hover:text-white underline font-mono text-[10px]"
                  >
                    Uji Route →
                  </a>
                </div>
                <div className="bg-stone-900 px-2.5 py-1.5 rounded-lg font-mono text-[10px] text-stone-300 truncate select-all">
                  {customerProdUrl}
                </div>
                <p className="text-[10px] text-stone-500">
                  Pelanggan yang membuka link ini dapat langsung memesan Takeaway / Delivery DQM tanpa instal aplikasi.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
