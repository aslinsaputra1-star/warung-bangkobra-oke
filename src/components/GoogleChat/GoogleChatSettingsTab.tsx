import React, { useState } from 'react';
import {
  Settings,
  Save,
  Clock,
  Send,
  AlertTriangle,
  Shield,
  VolumeX,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { GoogleChatSettings } from '../../types/googleChat';
import {
  saveGoogleChatSettings,
  triggerDailySummaryNotification,
} from '../../services/googleChatService';

interface Props {
  settings: GoogleChatSettings;
  onReload: () => void;
}

export const GoogleChatSettingsTab: React.FC<Props> = ({ settings, onReload }) => {
  const [form, setForm] = useState<GoogleChatSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [isTriggeringDaily, setIsTriggeringDaily] = useState(false);
  const [dailyStatusMessage, setDailyStatusMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveGoogleChatSettings(form);
      alert('Pengaturan Google Chat berhasil disimpan!');
      onReload();
    } catch (err: any) {
      alert('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerDailyNow = async () => {
    if (!window.confirm('Kirim ringkasan laporan penjualan hari ini ke Google Chat sekarang?')) {
      return;
    }
    setIsTriggeringDaily(true);
    setDailyStatusMessage(null);
    try {
      const res = await triggerDailySummaryNotification();
      if (res.success) {
        setDailyStatusMessage('Berhasil mengirim ringkasan harian ke Google Chat!');
      } else {
        setDailyStatusMessage('Gagal mengirim ringkasan: ' + (res.message || 'Terjadi kesalahan'));
      }
      onReload();
    } catch (err: any) {
      setDailyStatusMessage('Error: ' + err.message);
    } finally {
      setIsTriggeringDaily(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Pengaturan Sistem Google Chat
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi jadwal pengiriman ringkasan harian, batas stok minimum, dan toleransi sistem.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Ringkasan Harian Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              Jadwal & Pengiriman Ringkasan Harian
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Waktu Kirim Ringkasan Harian Otomatis
              </label>
              <input
                type="time"
                value={form.dailySummaryTime || '22:00'}
                onChange={(e) => setForm({ ...form, dailySummaryTime: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Contoh: 22:00 WIB (dikirim setiap malam saat toko tutup)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kirim Manual Sekarang
              </label>
              <button
                type="button"
                onClick={handleTriggerDailyNow}
                disabled={isTriggeringDaily}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                {isTriggeringDaily ? 'Mengirim Ringkasan...' : 'Kirim Ringkasan Penjualan Hari Ini'}
              </button>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Menghitung omzet, cash, qris, transfer, delivery, dan laba hari ini lalu mengirim ke Space.
              </span>
            </div>
          </div>

          {dailyStatusMessage && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{dailyStatusMessage}</span>
            </div>
          )}
        </div>

        {/* Batas Minimum & Toleransi Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">
              Parameter Stok & Delivery Warung Bang Kobra
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Minimum Stok Menipis (Default)
              </label>
              <input
                type="number"
                min="1"
                value={form.lowStockThreshold || 5}
                onChange={(e) =>
                  setForm({ ...form, lowStockThreshold: parseInt(e.target.value) || 5 })
                }
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Jika stok produk mencapai nilai ini atau lebih rendah, notifikasi peringatan akan dikirim.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Minimal Pesanan Delivery (Rp)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.minDeliveryAmount || 20000}
                onChange={(e) =>
                  setForm({ ...form, minDeliveryAmount: parseInt(e.target.value) || 20000 })
                }
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Standar minimal order delivery santri / pelanggan Warung Bang Kobra (Default Rp20.000).
              </span>
            </div>
          </div>
        </div>

        {/* Mode Senyap (Quiet Mode) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <VolumeX className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Mode Senyap (Do Not Disturb)</h3>
                <p className="text-[11px] text-slate-400">
                  Tahan pengiriman notifikasi non-kritis pada jam malam/istirahat.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.quietHoursEnabled || false}
                onChange={(e) => setForm({ ...form, quietHoursEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {form.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mulai Senyap (WIB)
                </label>
                <input
                  type="time"
                  value={form.quietHoursStart || '23:00'}
                  onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Berakhir Senyap (WIB)
                </label>
                <input
                  type="time"
                  value={form.quietHoursEnd || '07:00'}
                  onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Security & Access Notice */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start gap-3">
          <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 block">
              Keamanan Konfigurasi Google Chat Terlindungi
            </span>
            <p>
              Webhook URL & token Google Chat disimpan secara aman di sisi server (Vault Server). Kredensial tidak pernah dikirim ke browser atau tersimpan di LocalStorage. Hanya akun bertingkat Owner dan Admin yang memiliki otorisasi untuk mengubah konfigurasi ini.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Menyimpan Pengaturan...' : 'Simpan Seluruh Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  );
};
