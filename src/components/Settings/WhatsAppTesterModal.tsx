import React, { useState } from 'react';
import { X, Send, MessageCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { StoreSettings } from '../../types';
import { sanitizeWhatsAppNumber } from '../../utils/formatters';

interface WhatsAppTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const WhatsAppTesterModal: React.FC<WhatsAppTesterModalProps> = ({
  isOpen,
  onClose,
  settings,
  showToast,
}) => {
  const [templateType, setTemplateType] = useState<
    'chat_kasir' | 'order_confirm' | 'order_ready' | 'delivery' | 'po' | 'receipt'
  >('order_confirm');
  const [testPhone, setTestPhone] = useState(
    settings.whatsappNumber || '081234567890'
  );
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const mockPayload = {
    nama: 'Ahmad Pelanggan',
    nomor_order: 'WBK-20261005-0042',
    produk: '2x Mi Rendang Kobra, 2x Es Teh Manis',
    total: 'Rp 44.000',
    status: 'SIAP DIAMBIL',
    alamat: 'Asrama Putra DQM Kamar 12',
  };

  const getTemplateText = () => {
    switch (templateType) {
      case 'chat_kasir':
        return settings.waTemplateChatKasir || 'Halo Kasir Bang Kobra, saya mau tanya menu spesial hari ini...';
      case 'order_ready':
        return (
          settings.waTemplateOrderReady ||
          'Halo {{nama}}, pesanan Anda {{nomor_order}} sudah SIAP diambil/diantar!'
        );
      case 'delivery':
        return (
          settings.waTemplateDelivery ||
          'Halo {{nama}}, kurir kami sedang mengantar pesanan {{nomor_order}} ke {{alamat}}.'
        );
      case 'po':
        return (
          settings.waTemplatePO ||
          'Halo {{nama}}, Pre-Order acara nomor {{nomor_order}} telah dikonfirmasi.'
        );
      case 'receipt':
        return (
          settings.waTemplateReceipt ||
          'Terima kasih {{nama}}, berikut struk digital pembelian di Warung Bang Kobra: {{total}}.'
        );
      case 'order_confirm':
      default:
        return (
          settings.waTemplateOrderConfirmation ||
          'Halo {{nama}}, pesanan Anda {{nomor_order}} sudah kami terima dengan total {{total}}.'
        );
    }
  };

  const renderedMessage = getTemplateText()
    .replace(/{{nama}}/g, mockPayload.nama)
    .replace(/{{nomor_order}}/g, mockPayload.nomor_order)
    .replace(/{{produk}}/g, mockPayload.produk)
    .replace(/{{total}}/g, mockPayload.total)
    .replace(/{{status}}/g, mockPayload.status)
    .replace(/{{alamat}}/g, mockPayload.alamat);

  const handleSendTest = () => {
    const cleanPhone = sanitizeWhatsAppNumber(testPhone);
    if (!cleanPhone) {
      showToast('Nomor WhatsApp tujuan belum valid!', 'error');
      return;
    }
    const encoded = encodeURIComponent(renderedMessage);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(waUrl, '_blank');
    showToast('Membuka WhatsApp untuk mengirim pesan uji coba!', 'success');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(renderedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Teks pesan WhatsApp berhasil disalin!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-100 text-sm sm:text-base">
                Uji Coba Pesan WhatsApp (Live Tester)
              </h3>
              <p className="text-[11px] text-stone-400 font-mono">
                Cek hasil format placeholder pesan sebelum dikirim ke pelanggan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Template Selector */}
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1.5">
              Pilih Template Notifikasi
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {(
                [
                  { id: 'order_confirm', label: 'Konfirmasi Order' },
                  { id: 'order_ready', label: 'Pesanan Siap' },
                  { id: 'delivery', label: 'Kurir Delivery' },
                  { id: 'po', label: 'Pre-Order (PO)' },
                  { id: 'receipt', label: 'Struk Digital' },
                  { id: 'chat_kasir', label: 'Chat Kasir' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateType(t.id)}
                  className={`min-h-[40px] px-3 py-2 rounded-xl font-bold transition border text-left cursor-pointer ${
                    templateType === t.id
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Test Destination Phone */}
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1">
              Nomor WhatsApp Uji Coba
            </label>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full min-h-[44px] bg-stone-950 border border-stone-800 focus:border-emerald-500 rounded-xl px-3.5 text-xs sm:text-sm text-stone-100 placeholder-stone-500 font-mono focus:outline-none"
            />
          </div>

          {/* Rendered Preview Bubble */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-300">
                Preview Bubble Chat WhatsApp:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
              </button>
            </div>
            <div className="bg-[#0b141a] p-4 rounded-2xl border border-stone-800 shadow-inner">
              <div className="bg-[#005c4b] text-white p-3 rounded-2xl rounded-tr-none text-xs leading-relaxed max-w-[90%] ml-auto whitespace-pre-wrap font-sans shadow">
                {renderedMessage}
                <div className="text-[9px] text-emerald-200/70 text-right mt-1.5 font-mono">
                  12:45 • Terkirim ✓✓
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Kirim Uji Coba WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
