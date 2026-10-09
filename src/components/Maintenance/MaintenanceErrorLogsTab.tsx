import React, { useState } from 'react';
import {
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { SystemErrorLog, IssuePriority } from '../../types/maintenance';
import { MaintenanceService } from '../../services/maintenanceService';

interface MaintenanceErrorLogsTabProps {
  logs: SystemErrorLog[];
  operatorName: string;
  onRefreshLogs: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const MaintenanceErrorLogsTab: React.FC<MaintenanceErrorLogsTabProps> = ({
  logs,
  operatorName,
  onRefreshLogs,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | IssuePriority>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (priorityFilter !== 'ALL' && log.priority !== priorityFilter) return false;
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchMod = log.module.toLowerCase().includes(q);
      const matchRec = (log.recommendation || '').toLowerCase().includes(q);
      return matchMsg || matchMod || matchRec;
    }
    return true;
  });

  const handleResolve = async (logId: string) => {
    setResolvingId(logId);
    try {
      const ok = await MaintenanceService.resolveErrorLog(logId, operatorName || 'Admin');
      if (ok) {
        showToast('Status error diperbarui menjadi terselesaikan!', 'success');
        onRefreshLogs();
      } else {
        showToast('Gagal memperbarui status error', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const handleExportLogs = () => {
    try {
      const jsonString = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-logs-wbk-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Laporan error log berhasil diekspor!', 'success');
    } catch {
      showToast('Gagal mengekspor log error', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-black text-white">Log Error &amp; Diagnostik Runtime</h3>
          </div>
          <p className="text-xs text-stone-400">
            Pencatatan riwayat error aplikasi, pesan kegagalan, modul terkait, dan panduan tindak lanjut tanpa memuat data kredensial rahasia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportLogs}
            className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Ekspor JSON</span>
          </button>
          <button
            type="button"
            onClick={onRefreshLogs}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-4 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pesan error, modul, rekomendasi..."
            className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto text-xs font-bold">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-stone-500" />
            <span className="text-stone-400">Prioritas:</span>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  priorityFilter === p ? 'bg-amber-500 text-stone-950 font-black' : 'bg-stone-800 text-stone-400'
                }`}
              >
                {p === 'ALL' ? 'Semua' : p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-l border-stone-800 pl-3">
            <span className="text-stone-400">Status:</span>
            {(['ALL', 'OPEN', 'RESOLVED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  statusFilter === st ? 'bg-stone-200 text-stone-950 font-black' : 'bg-stone-800 text-stone-400'
                }`}
              >
                {st === 'ALL' ? 'Semua' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Logs Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-stone-500 text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
            <p>Tidak ada catatan error sistem yang terdaftar atau sesuai kriteria filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-950/70 border-b border-stone-800 text-stone-400 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Waktu</th>
                  <th className="py-3.5 px-4">Modul</th>
                  <th className="py-3.5 px-4">Prioritas</th>
                  <th className="py-3.5 px-4">Pesan Masalah</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80 font-mono text-stone-300">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateObj = new Date(log.timestamp);

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-stone-800/30 transition">
                        <td className="py-3.5 px-4 whitespace-nowrap text-stone-400">
                          <div>{dateObj.toLocaleDateString('id-ID')}</div>
                          <div className="text-[10px] text-stone-500">{dateObj.toLocaleTimeString('id-ID')}</div>
                        </td>

                        <td className="py-3.5 px-4 font-sans font-extrabold text-white">
                          <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-200 border border-stone-700/60">
                            {log.module}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              log.priority === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : log.priority === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-stone-800 text-stone-400'
                            }`}
                          >
                            {log.priority}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-sans text-xs max-w-md truncate text-stone-200">
                          {log.message}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {log.status === 'RESOLVED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3" />
                              RESOLVED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black">
                              <Clock className="w-3 h-3" />
                              OPEN
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 font-sans">
                            {log.status === 'OPEN' && (
                              <button
                                type="button"
                                onClick={() => handleResolve(log.id)}
                                disabled={resolvingId === log.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs border border-emerald-500/30 transition disabled:opacity-50 cursor-pointer"
                              >
                                {resolvingId === log.id ? 'Menyimpan...' : 'Tandai Selesai'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="p-1 rounded-lg text-stone-400 hover:text-stone-200 transition"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <tr className="bg-stone-950 font-mono text-xs">
                          <td colSpan={6} className="p-4 space-y-3 border-b border-stone-800">
                            <div>
                              <span className="text-stone-400 font-bold block mb-1">Rincian Lengkap Error:</span>
                              <pre className="text-stone-200 bg-stone-900 p-3 rounded-xl font-sans text-xs whitespace-pre-wrap leading-relaxed border border-stone-800">
                                {log.message}
                              </pre>
                            </div>

                            {log.recommendation && (
                              <div>
                                <span className="text-amber-400 font-bold block mb-1">Rekomendasi Penanganan:</span>
                                <div className="text-stone-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl font-sans text-xs">
                                  {log.recommendation}
                                </div>
                              </div>
                            )}

                            {log.stackTrace && (
                              <div>
                                <span className="text-stone-500 font-bold block mb-1">Stack Trace (Sanitized):</span>
                                <pre className="text-stone-400 bg-stone-900 p-2.5 rounded-xl text-[11px] overflow-x-auto max-h-40">
                                  {log.stackTrace}
                                </pre>
                              </div>
                            )}

                            {log.resolvedAt && (
                              <div className="text-emerald-400 font-sans text-[11px] pt-1">
                                Diselesaikan pada: {new Date(log.resolvedAt).toLocaleString('id-ID')} oleh {log.resolvedBy || 'Staf'}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
