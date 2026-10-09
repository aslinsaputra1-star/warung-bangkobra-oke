import React, { useState } from 'react';
import {
  MessageSquare,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  RefreshCw,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { GoogleChatSpace, GoogleChatLog } from '../../types/googleChat';
import { Transaction, Expense } from '../../types';
import { GoogleChatService } from '../../services/googleChatService';

interface GoogleChatDashboardTabProps {
  connectionStatus: 'CONNECTED' | 'DISCONNECTED';
  spaces: GoogleChatSpace[];
  logs: GoogleChatLog[];
  transactions: Transaction[];
  expenses: Expense[];
  onNavigateTab: (tabId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefresh: () => void;
}

export const GoogleChatDashboardTab: React.FC<GoogleChatDashboardTabProps> = ({
  connectionStatus,
  spaces,
  logs,
  transactions,
  expenses,
  onNavigateTab,
  showToast,
  onRefresh,
}) => {
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const sentCount = logs.filter((l) => l.status === 'SENT').length;
  const failedCount = logs.filter((l) => l.status === 'FAILED').length;
  const pendingCount = logs.filter((l) => l.status === 'PENDING').length;
  const recentLogs = logs.slice(0, 5);

  const handleSendDailySummaryNow = async () => {
    setIsSendingSummary(true);
    try {
      const res = await GoogleChatService.dispatchDailySummary(transactions, expenses);
      if (res.success) {
        showToast('Ringkasan harian berhasil dikirim ke Google Chat!', 'success');
      } else {
        showToast(res.message || 'Gagal mengirim ringkasan harian', 'error');
      }
    } catch {
      showToast('Koneksi bermasalah', 'error');
    } finally {
      setIsSendingSummary(false);
    }
  };

  const handleQuickTest = async () => {
    setIsTesting(true);
    try {
      const res = await GoogleChatService.testConnection();
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch {
      showToast('Koneksi bermasalah', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div
        className={`rounded-3xl p-6 border transition-all ${
          connectionStatus === 'CONNECTED'
            ? 'bg-gradient-to-r from-emerald-950/40 via-stone-900 to-teal-950/30 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
            : 'bg-gradient-to-r from-amber-950/40 via-stone-900 to-rose-950/30 border-amber-500/30 shadow-lg shadow-amber-950/20'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}
            >
              <MessageSquare className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border ${
                    connectionStatus === 'CONNECTED'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {connectionStatus === 'CONNECTED' ? 'TERHUBUNG' : 'TIDAK TERHUBUNG'}
                </span>
                <span className="text-xs text-stone-400 font-mono">
                  {spaces.length} Ruang/Space Dikonfigurasi
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-1">
                Integrasi Otomatis Google Chat Warung Bang Kobra
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Pemberitahuan real-time untuk pesanan baru, delivery DQM, pre-order acara, peringatan stok, dan ringkasan harian.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleQuickTest}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Activity className={`w-4 h-4 text-amber-400 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Menguji...' : 'Test Koneksi'}</span>
            </button>
            <button
              type="button"
              onClick={handleSendDailySummaryNow}
              disabled={isSendingSummary}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 transition active:scale-95 shadow-md shadow-amber-950/40 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSendingSummary ? 'Mengirim...' : 'Kirim Laporan Harian'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-xs font-semibold">Total Terkirim</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{sentCount}</div>
          <p className="text-[11px] text-stone-500 mt-1">Notifikasi sukses terkirim</p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-xs font-semibold">Gagal / Error</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">{failedCount}</div>
          <p className="text-[11px] text-stone-500 mt-1">Dapat dikirim ulang (Retry)</p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-xs font-semibold">Ruang / Space</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{spaces.length}</div>
          <p className="text-[11px] text-stone-500 mt-1">Tujuan ruang chat aktif</p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-400 mb-1">
            <span className="text-xs font-semibold">Pending / Antrian</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">{pendingCount}</div>
          <p className="text-[11px] text-stone-500 mt-1">Idempotent queue</p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('connection')}
          className="bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/40 rounded-2xl p-5 text-left transition flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-white text-sm group-hover:text-amber-400 transition">
              Koneksi Google Chat
            </h4>
            <p className="text-xs text-stone-400 mt-1">
              Atur Webhook URL secara aman dan uji konektivitas chat.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-600 group-hover:text-amber-400 group-hover:translate-x-1 transition mt-2" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('notifications')}
          className="bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/40 rounded-2xl p-5 text-left transition flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-white text-sm group-hover:text-emerald-400 transition">
              Notifikasi Otomatis
            </h4>
            <p className="text-xs text-stone-400 mt-1">
              Aktifkan toggle 14 jenis event pesanan, stok, dan laporan.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition mt-2" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('templates')}
          className="bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/40 rounded-2xl p-5 text-left transition flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-white text-sm group-hover:text-purple-400 transition">
              Template Pesan
            </h4>
            <p className="text-xs text-stone-400 mt-1">
              Kustomisasi format teks variabel dengan preview real-time.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-600 group-hover:text-purple-400 group-hover:translate-x-1 transition mt-2" />
        </button>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-white text-base">Aktivitas Notifikasi Terakhir</h3>
            <p className="text-xs text-stone-400">5 riwayat pengiriman notifikasi terakhir</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              Lihat Semua
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-10 text-stone-500 text-xs">
            Belum ada riwayat pengiriman notifikasi Google Chat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 font-semibold">
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Jenis</th>
                  <th className="py-2.5 px-3">Referensi</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono text-stone-300">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-800/30 transition">
                    <td className="py-3 px-3 text-stone-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                    </td>
                    <td className="py-3 px-3 font-sans font-bold text-white">
                      {log.notificationType}
                    </td>
                    <td className="py-3 px-3 text-amber-400">{log.referenceId || '-'}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                          log.status === 'SENT'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {log.status === 'FAILED' && (
                        <button
                          type="button"
                          onClick={() => GoogleChatService.retryLog(log)}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 font-sans font-bold text-[11px] border border-amber-500/30 transition"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
