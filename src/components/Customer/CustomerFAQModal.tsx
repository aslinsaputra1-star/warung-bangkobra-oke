import React, { useState } from 'react';
import { X, HelpCircle, Shield, Info, ChevronDown, ChevronUp, Store, Phone, MessageCircle } from 'lucide-react';
import { StoreSettings } from '../../types';
import { formatRupiah, sanitizeWhatsAppNumber } from '../../utils/formatters';
import { BrandLogo } from '../Common/BrandLogo';

interface CustomerFAQModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  initialTab?: 'faq' | 'privacy' | 'about';
}

export const CustomerFAQModal: React.FC<CustomerFAQModalProps> = ({
  isOpen,
  onClose,
  settings,
  initialTab = 'faq',
}) => {
  const [tab, setTab] = useState<'faq' | 'privacy' | 'about'>(initialTab);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  const faqs = [
    {
      q: 'Bagaimana cara memesan makanan & minuman di Warung Bang Kobra?',
      a: 'Anda cukup memilih menu yang diinginkan, pilih varian rasa jika ada, lalu klik "+ Keranjang" atau "Pesan Sekarang". Setelah selesai, masuk ke halaman Keranjang dan klik "Checkout" untuk mengisi nama, nomor WhatsApp, serta metode pembayaran.',
    },
    {
      q: 'Bagaimana layanan delivery ke Pesantren DQM bekerja?',
      a: `Layanan delivery khusus area Pesantren DQM tersedia dengan minimal belanja ${formatRupiah(settings.deliveryMinOrder || 20000)}. Pesanan akan diantar langsung oleh kurir warung dalam keadaan hangat ke asrama, kantor staf, atau titik temu yang Anda pilih.`,
    },
    {
      q: 'Apa saja metode pembayaran yang diterima?',
      a: 'Warung Bang Kobra menerima pembayaran Tunai / Bayar di Tempat (COD), Transfer Bank (BCA, Mandiri, BRI, BSI), QRIS resmi kasir, dan dompet digital (GoPay, OVO, Dana, ShopeePay).',
    },
    {
      q: 'Berapa lama estimasi pesanan disiapkan?',
      a: 'Untuk pesanan Takeaway (bungkus) estimasi penyiapan adalah 10-15 menit. Untuk layanan Delivery DQM estimasi pengantaran 15-25 menit tergantung antrian dapur.',
    },
    {
      q: 'Bagaimana cara menghubungi kasir jika ada pertanyaan atau perubahan pesanan?',
      a: 'Anda dapat langsung menekan tombol WhatsApp yang tersedia di aplikasi untuk tersambung ke nomor resmi kasir Warung Bang Kobra.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-[#E50914] flex items-center justify-center shrink-0">
              {tab === 'faq' ? (
                <HelpCircle className="w-5 h-5" />
              ) : tab === 'privacy' ? (
                <Shield className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                {tab === 'faq'
                  ? 'Bantuan & Pertanyaan (FAQ)'
                  : tab === 'privacy'
                  ? 'Kebijakan Privasi'
                  : 'Tentang Aplikasi'}
              </h2>
              <p className="text-xs text-gray-500">
                Informasi resmi WARUNG BANG KOBRA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 px-4 bg-gray-50/70 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('faq')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer ${
              tab === 'faq'
                ? 'border-[#E50914] text-[#E50914]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Bantuan & FAQ
          </button>
          <button
            type="button"
            onClick={() => setTab('about')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer ${
              tab === 'about'
                ? 'border-[#E50914] text-[#E50914]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Tentang Warung
          </button>
          <button
            type="button"
            onClick={() => setTab('privacy')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer ${
              tab === 'privacy'
                ? 'border-[#E50914] text-[#E50914]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Kebijakan Privasi
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {tab === 'faq' && (
            <div className="space-y-2.5">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full p-3.5 text-left flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-gray-900 hover:bg-gray-50 transition cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#E50914] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="p-3.5 pt-0 text-xs text-gray-600 leading-relaxed border-t border-gray-50">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'about' && (
            <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
              <div className="p-4 rounded-3xl bg-gradient-to-r from-red-600 to-[#151515] text-white flex items-center gap-3.5">
                <BrandLogo
                  src={settings.logoUrl}
                  alt={settings.storeName || 'WARUNG BANG KOBRA'}
                  size="lg"
                  className="rounded-2xl border-white/20 shrink-0 shadow-md"
                />
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] uppercase font-black tracking-widest text-orange-400 block">
                    BRAND PROFILE
                  </span>
                  <h3 className="text-base sm:text-lg font-black truncate">{settings.storeName || 'WARUNG BANG KOBRA'}</h3>
                  <p className="text-xs text-white/90 italic font-medium">
                    "Rasa Enak, Harga Bersahabat, Selalu di Hati."
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900">Tentang Kami</h4>
                <p className="text-gray-600">
                  WARUNG BANG KOBRA adalah penyedia makanan lezat, olahan Indomie spesial dengan aneka varian rasa nusantara, jus buah segar asli 100%, kopi nikmat, sembako, dan aneka snack favorit santri, wali santri, pengajar, serta masyarakat luas di sekitar Pesantren DQM.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Layanan:</span>
                  <span className="font-bold text-gray-900">Dine-In, Takeaway & Delivery DQM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">WhatsApp Kasir:</span>
                  <span className="font-bold font-mono text-gray-900">
                    {settings.whatsappNumber || '0812-3456-7890'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Versi Aplikasi:</span>
                  <span className="font-bold text-gray-900">v1.0 Ultra Premium</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <h4 className="font-bold text-gray-900 text-sm">Privasi & Keamanan Data Pelanggan</h4>
              <p>
                WARUNG BANG KOBRA menghargai privasi setiap pelanggan. Informasi yang Anda masukkan (seperti nama, nomor WhatsApp, dan alamat pengantaran) hanya digunakan untuk keperluan pemrosesan pesanan, konfirmasi pengiriman, dan layanan pelanggan.
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Data transaksi tersimpan dengan aman di database terenkripsi Firebase Firestore.</li>
                <li>Nomor WhatsApp Anda hanya digunakan oleh kasir/kurir untuk konfirmasi pesanan dan resi pengantaran.</li>
                <li>Kami tidak pernah membagikan atau menjual data pribadi Anda kepada pihak ketiga.</li>
              </ul>
              <p className="pt-2 text-gray-400 text-[11px]">
                Terakhir diperbarui: Oktober 2026 • Warung Bang Kobra
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
