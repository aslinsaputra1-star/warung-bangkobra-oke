import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Download, Printer, Copy, Check, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import { StoreSettings } from '../../types';

interface QRCodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const QRCodeGeneratorModal: React.FC<QRCodeGeneratorModalProps> = ({
  isOpen,
  onClose,
  settings,
  showToast,
}) => {
  const [qrType, setQrType] = useState<'menu' | 'standee' | 'promo' | 'toko'>('menu');
  const [qrTitle, setQrTitle] = useState('QR MENU WARUNG BANG KOBRA');
  const [dataUrl, setDataUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://warungbangkobra.id';
    let url = origin;
    let title = 'QR MENU WARUNG BANG KOBRA';

    if (qrType === 'menu') {
      url = `${origin}?mode=public`;
      title = settings.qrMenuTitle || 'QR MENU WARUNG BANG KOBRA';
    } else if (qrType === 'standee') {
      url = `${origin}?order=takeaway`;
      title = settings.qrOrderTitle || 'QR PESAN BUNGKUS KASIR';
    } else if (qrType === 'promo') {
      url = `${origin}?promo=today`;
      title = settings.qrPromoTitle || 'QR PROMO SPESIAL HARI INI';
    } else if (qrType === 'toko') {
      url = settings.storeWebsite || origin;
      title = settings.qrTokoTitle || 'QR PROFIL TOKO & LOKASI';
    }

    setTargetUrl(url);
    setQrTitle(title);

    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0c0a09',
        light: '#ffffff',
      },
    })
      .then((res) => setDataUrl(res))
      .catch((err) => console.error('Failed generating QR code:', err));
  }, [isOpen, qrType, settings]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${qrTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
    a.click();
    showToast('QR Code berhasil diunduh (PNG)!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Tautan URL QR berhasil disalin!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-100 text-sm sm:text-base">
                Generator & Cetak QR Code
              </h3>
              <p className="text-[11px] text-stone-400 font-mono">
                Pilih jenis QR untuk meja kasir atau brosur promosi
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
          {/* QR Type Selector */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(
              [
                { id: 'menu', label: 'QR Menu Online' },
                { id: 'standee', label: 'QR Standee Kasir' },
                { id: 'promo', label: 'QR Promo Diskon' },
                { id: 'toko', label: 'QR Toko / Web' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setQrType(item.id)}
                className={`min-h-[40px] px-3 py-2 rounded-xl font-bold transition border text-left cursor-pointer ${
                  qrType === item.id
                    ? 'bg-red-600/20 text-red-300 border-red-500/50 shadow'
                    : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* QR Printable Card Preview */}
          <div
            ref={printRef}
            className="bg-white text-stone-950 p-6 rounded-2xl shadow-xl text-center space-y-3 border-4 border-stone-200"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-red-600">
                {settings.storeName || 'WARUNG BANG KOBRA'}
              </p>
              <h4 className="font-extrabold text-sm sm:text-base text-stone-900 leading-tight">
                {qrTitle}
              </h4>
            </div>

            <div className="flex justify-center p-2 bg-stone-50 rounded-xl border border-stone-200">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt={qrTitle}
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-stone-400">
                  Memuat QR...
                </div>
              )}
            </div>

            <div className="text-[11px] text-stone-600 space-y-0.5">
              <p className="font-bold">Scan dengan Kamera HP / QR Scanner</p>
              <p className="text-[10px] text-stone-500 truncate max-w-full">
                {targetUrl}
              </p>
            </div>
          </div>

          {/* Target URL Copy */}
          <div className="flex items-center justify-between text-xs bg-stone-950 p-2.5 rounded-xl border border-stone-800">
            <span className="text-stone-400 truncate pr-2 font-mono text-[11px]">
              {targetUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="text-red-400 hover:text-red-300 font-bold shrink-0 flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Salin URL'}</span>
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-800">
          <button
            type="button"
            onClick={handleDownload}
            className="min-h-[44px] px-3.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Download PNG</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-black shadow-lg shadow-red-950/40 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
