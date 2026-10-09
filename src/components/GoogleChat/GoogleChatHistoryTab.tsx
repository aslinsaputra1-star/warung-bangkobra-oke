import React, { useState } from 'react';
import {
  History,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { GoogleChatLog, GoogleChatLogStatus } from '../../types/googleChat';
import { GoogleChatService } from '../../services/googleChatService';

interface GoogleChatHistoryTabProps {
  logs: GoogleChatLog[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GoogleChatHistoryTab: React.FC<GoogleChatHistoryTabProps> = ({
  logs,
  onRefresh,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | GoogleChatLogStatus>('ALL');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const handleRetry = async (log: GoogleChatLog) => {
    setRetryingId(log.id);
    try {
      const res = await GoogleChatService.retryLog(log);
      if (res.success) {
        showToast('Notifikasi berhasil dikirim ulang!', 'success');
        onRefresh();
      } else {
        showToast(res.message || 'Gagal mengirim ulang', 'error');
      }
    } catch {
      showToast('Koneksi bermasalah saat mengirim ulang', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = (log.referenceId || '').toLowerCase().includes(q);
      const matchType = log.notificationType.toLowerCase().includes(q);
      const matchSpace = (log.spaceName || '').toLowerCase().includes(q);
      const matchMsg = (log.messageText || '').toLowerCase().includes(q);
      return matchRef || matchType || matchSpace || matchMsg;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Info & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-black text-white">Riwayat Notifikasi Google Chat</h3>
          </div>
          <p className="text-xs text-stone-400">
            Log audit pengiriman real-time, status keberhasilan, respons webhook, dan tombol kirim ulang (Retry) bebas duplikasi.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Muat Ulang Log</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-900/60 border border-stone-800 p-4 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor pesanan, event, space..."
            className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          {(['ALL', 'SENT', 'FAILED', 'PENDING'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-400'
              }`}
            >
              {st === 'ALL' ? 'Semua' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Logs */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-stone-500 text-xs space-y-2">
            <History className="w-8 h-8 mx-auto text-stone-600 opacity-60" />
            <p>Tidak ada riwayat pesan yang sesuai dengan filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-950/70 border-b border-stone-800 text-stone-400 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Tanggal & Waktu</th>
                  <th className="py-3.5 px-4">Jenis Notifikasi</th>
                  <th className="py-3.5 px-4">Nomor Pesanan</th>
                  <th className="py-3.5 px-4">Tujuan Space</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Keterangan / Error</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80 font-mono text-stone-300">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateObj = new Date(log.timestamp || log.createdAt);

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-stone-800/30 transition">
                        <td className="py-3.5 px-4 whitespace-nowrap text-stone-400">
                          <div>{dateObj.toLocaleDateString('id-ID')}</div>
                          <div className="text-[10px] text-stone-500">{dateObj.toLocaleTimeString('id-ID')}</div>
                        </td>

                        <td className="py-3.5 px-4 font-sans font-extrabold text-white">
                          <span className="px-2 py-0.5 rounded-md bg-stone-800 border border-stone-700/60 text-xs">
                            {log.notificationType}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-bold text-amber-400">
                          {log.referenceId || '-'}
                        </td>

                        <td className="py-3.5 px-4 font-sans text-stone-300 line-clamp-1 max-w-[140px]">
                          {log.spaceName || log.spaceId || 'Default Space'}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {log.status === 'SENT' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3" />
                              SENT
                            </span>
                          ) : log.status === 'FAILED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black">
                              <XCircle className="w-3 h-3" />
                              FAILED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-black">
                              <Clock className="w-3 h-3" />
                              PENDING
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-sans text-xs max-w-xs truncate">
                          {log.status === 'FAILED' ? (
                            <span className="text-rose-400 line-clamp-1" title={log.error}>
                              {log.error || 'Webhook gagal merespons'}
                            </span>
                          ) : (
                            <span className="text-stone-400 line-clamp-1">
                              Berhasil terkirim ke Google Chat
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 font-sans">
                            {log.status === 'FAILED' && (
                              <button
                                type="button"
                                onClick={() => handleRetry(log)}
                                disabled={retryingId === log.id}
                                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold text-xs border border-amber-500/30 flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
                              >
                                <RotateCcw
                                  className={`w-3 h-3 ${retryingId === log.id ? 'animate-spin' : ''}`}
                                />
                                <span>{retryingId === log.id ? 'Retry...' : 'Retry'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="p-1 rounded-lg text-stone-400 hover:text-stone-200 transition"
                              title="Detail"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded View */}
                      {isExpanded && (
                        <tr className="bg-stone-950/90 font-mono text-xs">
                          <td colSpan={7} className="p-4 space-y-2 border-b border-stone-800">
                            <div className="text-stone-400 font-bold">Event ID (Idempotency Key):</div>
                            <div className="text-amber-300 bg-stone-900 p-2 rounded-lg break-all">
                              {log.eventId || log.id}
                            </div>

                            <div className="text-stone-400 font-bold pt-1">Isi Pesan:</div>
                            <pre className="text-stone-200 bg-stone-900 p-3 rounded-lg whitespace-pre-wrap font-sans text-xs leading-relaxed">
                              {log.messageText}
                            </pre>

                            {log.error && (
                              <div className="pt-1">
                                <div className="text-rose-400 font-bold">Error Message:</div>
                                <div className="text-rose-300 bg-rose-950/40 border border-rose-500/30 p-2 rounded-lg">
                                  {log.error}
                                </div>
                              </div>
                            )}

                            {log.response && (
                              <div className="pt-1">
                                <div className="text-stone-400 font-bold">Respons Google Chat:</div>
                                <pre className="text-emerald-400 bg-stone-900 p-2 rounded-lg overflow-x-auto text-[11px]">
                                  {log.response}
                                </pre>
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
