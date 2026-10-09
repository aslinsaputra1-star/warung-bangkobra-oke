import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  X,
  ExternalLink,
  MessageCircle,
  Smartphone,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { StoreSettings } from '../../types';

interface CustomerShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerUrl: string;
  settings: StoreSettings;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CustomerShareModal: React.FC<CustomerShareModalProps> = ({
  isOpen,
  onClose,
  customerUrl,
  settings,
  showToast,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  if (!isOpen) return null;

  const storeName = settings.storeName || 'WARUNG BANG KOBRA';

  const defaultCaption = [
    `🍽️ *MENU ONLINE ${storeName.toUpperCase()}*`,
    ``,
    `Laper tapi mager? Yuk pesan langsung menu favorit tanpa antre!`,
    `Tersedia aneka Makanan, Mie, Minuman Segar & Jus Buah Asli.`,
    ``,
    `🛵 Melayani BUNGKUS & DELIVERY DQM (Khusus Area Pesantren DQM)!`,
    `👉 Klik link di bawah untuk buka menu & pesan:`,
    customerUrl,
    ``,
    `📍 ${storeName} • Halal, Enak & Mantap!`,
  ].join('\n');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(customerUrl);
      setCopiedLink(true);
      showToast?.('Tautan Pelanggan berhasil disalin! Siap ditempel ke WhatsApp Status.', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast?.('Gagal menyalin tautan', 'error');
    }
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(defaultCaption);
      setCopiedCaption(true);
      showToast?.('Teks promo & link status disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedCaption(false), 2500);
    } catch {
      showToast?.('Gagal menyalin teks status', 'error');
    }
  };

  const handleShareToWhatsApp = () => {
    // Copy caption to clipboard first so user can paste anywhere if needed
    navigator.clipboard?.writeText(defaultCaption);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(defaultCaption)}`;
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
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Menu Online ${storeName}`,
          text: `Pesan makanan & minuman online di ${storeName}:`,
          url: customerUrl,
        });
        showToast?.('Menu berhasil dibagikan!', 'success');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleShareToWhatsApp();
        }
      }
    } else {
      handleShareToWhatsApp();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight">Bagikan Menu Online</h3>
              <p className="text-xs text-white/90 font-medium">
                Salin link pelanggan untuk Status WhatsApp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Target URL Card */}
          <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Tautan Menu Pelanggan (Resmi)
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                ✓ Produksi Vercel
              </span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 select-all break-all shadow-inner mb-3">
              {customerUrl}
            </div>

            {/* Action Buttons for URL */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Link Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Link Pelanggan</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyCaption}
                className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                  copiedCaption
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                {copiedCaption ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Teks Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Salin Draf Status</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* WhatsApp Direct Share Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleShareToWhatsApp}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 fill-current" />
              <span>Bagikan ke WhatsApp Status & Chat</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Bagikan via Aplikasi Lain...</span>
              </button>
            )}
          </div>

          {/* Quick Step Guide */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-950 space-y-2">
            <div className="font-black flex items-center gap-1.5 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Cara Pasang di WhatsApp Status:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-amber-900/90 leading-relaxed font-medium">
              <li>Klik tombol <strong>Salin Link Pelanggan</strong> di atas.</li>
              <li>Buka aplikasi WhatsApp di HP Anda.</li>
              <li>Pilih menu <strong>Pembaruan / Status</strong> &gt; tekan ikon <strong>Pensil</strong> (Status Teks).</li>
              <li>Tempel (Paste) link yang sudah disalin, lalu kirim ke Status!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-gray-400" />
            <span>Mengarahkan langsung ke Layout Pelanggan</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-gray-700 hover:text-gray-900 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
