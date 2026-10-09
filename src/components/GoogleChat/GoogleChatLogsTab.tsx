import React, { useState } from 'react';
import {
  History,
  RotateCcw,
  Trash2,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  Search,
  X,
  Send,
} from 'lucide-react';
import { GoogleChatLog, GoogleChatNotificationType } from '../../types/googleChat';
import { retrySendNotification, clearLogs } from '../../services/googleChatService';

interface Props {
  logs: GoogleChatLog[];
  onReload: () => void;
}

export const GoogleChatLogsTab: React.FC<Props> = ({ logs, onReload }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'FAILED' | 'PENDING'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<GoogleChatLog | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Filtered logs
  const filteredLogs = logs.filter((l) => {
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && l.notificationType !== typeFilter) return false;
    if (dateFilter && !l.createdAt.startsWith(dateFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchOrder = l.orderNumber?.toLowerCase().includes(q);
      const matchSpace = l.spaceName?.toLowerCase().includes(q);
      const matchSnippet = l.contentSnippet?.toLowerCase().includes(q);
      const matchType = l.notificationType?.toLowerCase().includes(q);
      if (!matchOrder && !matchSpace && !matchSnippet && !matchType) return false;
    }
    return true;
  });

  const handleRetry = async (log: GoogleChatLog) => {
    setRetryingId(log.id);
    try {
      const res = await retrySendNotification(log);
      if (res.success) {
        alert('Notifikasi berhasil dikirim ulang ke Google Chat!');
        onReload();
      } else {
        alert('Gagal mengirim ulang: ' + (res.message || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Error retry: ' + err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus seluruh riwayat pesan Google Chat?')) {
      return;
    }
    setIsClearing(true);
    try {
      await clearLogs();
      onReload();
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Waktu', 'Tipe', 'Nomor Pesanan', 'Space', 'Status', 'Isi', 'Error'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.createdAt,
      l.notificationType,
      l.orderNumber || '-',
      l.spaceName || '-',
      l.status,
      `"${(l.contentSnippet || '').replace(/"/g, '""')}"`,
      `"${(l.errorMessage || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `google_chat_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Riwayat Pesan Google Chat
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Log lengkap pengiriman notifikasi otomatis dari POS & sistem Warung Bang Kobra ke Google Chat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReload}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Ekspor CSV
          </button>
          <button
            onClick={handleClearLogs}
            disabled={isClearing || logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 hover:bg-red-50 rounded-xl text-xs font-semibold text-red-600 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Hapus Log
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari no pesanan, space, isi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
            >
              <option value="ALL">Semua Status ({logs.length})</option>
              <option value="SENT">Terkirim Saja</option>
              <option value="FAILED">Gagal Saja</option>
              <option value="PENDING">Pending Saja</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
            >
              <option value="ALL">Semua Tipe Kejadian</option>
              <option value="ORDER_NEW">Pesanan Online Baru</option>
              <option value="ORDER_WA">Pesanan WhatsApp</option>
              <option value="ORDER_DELIVERY">Pesanan Delivery</option>
              <option value="ORDER_TAKEAWAY">Pesanan Takeaway</option>
              <option value="ORDER_PO">PO / Acara</option>
              <option value="PAYMENT_SUCCESS">Pembayaran Sukses</option>
              <option value="STOCK_LOW">Stok Menipis</option>
              <option value="STOCK_EMPTY">Produk Habis</option>
              <option value="EXPENSE_NEW">Pengeluaran Baru</option>
              <option value="DAILY_SUMMARY">Ringkasan Harian</option>
              <option value="TEST_MESSAGE">Pesan Tes</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                <th className="py-3 px-4">Waktu & Tanggal</th>
                <th className="py-3 px-4">Jenis Notifikasi</th>
                <th className="py-3 px-4">No. Pesanan</th>
                <th className="py-3 px-4">Tujuan Space</th>
                <th className="py-3 px-4">Ringkasan Pesan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Belum ada riwayat pesan Google Chat yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const d = new Date(log.createdAt);
                  const dateStr = d.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const timeStr = d.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{dateStr}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{timeStr}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                          {log.notificationType}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700">
                        {log.orderNumber || '-'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{log.spaceName || 'Default'}</span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                        {log.contentSnippet || '-'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.status === 'SENT' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Terkirim
                          </span>
                        ) : log.status === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            <XCircle className="w-3 h-3" /> Gagal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Lihat Detail Pesan"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {log.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(log)}
                              disabled={retryingId === log.id}
                              className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                              title="Kirim Ulang (Retry)"
                            >
                              <RotateCcw className={`w-4 h-4 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                Detail Log Notifikasi #{selectedLog.id}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">WAKTU</span>
                <span className="font-semibold text-slate-700">
                  {new Date(selectedLog.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">STATUS</span>
                <span className="font-semibold text-slate-700">{selectedLog.status}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">TIPE</span>
                <span className="font-semibold text-slate-700">{selectedLog.notificationType}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">SPACE TUJUAN</span>
                <span className="font-semibold text-slate-700">{selectedLog.spaceName}</span>
              </div>
              {selectedLog.orderNumber && (
                <div>
                  <span className="text-slate-400 block text-[10px]">NOMOR PESANAN</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {selectedLog.orderNumber}
                  </span>
                </div>
              )}
            </div>

            {selectedLog.errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <span className="font-bold block mb-1">Pesan Kesalahan:</span>
                <p className="font-mono">{selectedLog.errorMessage}</p>
              </div>
            )}

            <div>
              <span className="text-slate-500 font-semibold block text-xs mb-1">
                Isi Lengkap Pesan:
              </span>
              <div className="p-3 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl whitespace-pre-wrap max-h-56 overflow-y-auto border border-slate-800">
                {selectedLog.contentSnippet}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {selectedLog.status === 'FAILED' ? (
                <button
                  onClick={() => handleRetry(selectedLog)}
                  disabled={retryingId === selectedLog.id}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Kirim Ulang Sekarang
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
