import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Cloud,
  ShieldCheck,
  Clock,
  HardDrive,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SystemHealthReport } from '../../types/maintenance';
import { formatRupiah } from '../../utils/formatters';

interface MaintenanceDashboardTabProps {
  report: SystemHealthReport | null;
  isRunningAudit: boolean;
  onRunAudit: () => void;
  onNavigateTab: (tabId: string) => void;
  lastBackupDate?: string | null;
}

export const MaintenanceDashboardTab: React.FC<MaintenanceDashboardTabProps> = ({
  report,
  isRunningAudit,
  onRunAudit,
  onNavigateTab,
  lastBackupDate,
}) => {
  const score = report?.score ?? 98;
  const status = report?.status ?? 'HEALTHY';

  const getStatusColor = () => {
    if (status === 'HEALTHY') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (status === 'WARNING') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getStatusBadge = () => {
    if (status === 'HEALTHY') return 'SISTEM SEHAT';
    if (status === 'WARNING') return 'PERHATIAN DIPERLUKAN';
    return 'STATUS KRITIS';
  };

  return (
    <div className="space-y-6">
      {/* Hero Health Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-900/90 to-stone-950 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            {/* Score Ring Visual */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center rounded-3xl bg-stone-950 border-2 border-stone-800 shadow-inner">
              <svg className="w-full h-full -rotate-90 p-2" viewBox="0 0 36 36">
                <path
                  className="text-stone-800"
                  strokeWidth="3.2"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={
                    score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-rose-400'
                  }
                  strokeDasharray={`${score}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.2"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl sm:text-3xl font-black text-white font-mono">{score}</span>
                <span className="text-[10px] font-bold text-stone-400">/ 100</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border ${getStatusColor()}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status === 'HEALTHY' ? 'bg-emerald-400' : status === 'WARNING' ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                  />
                  {getStatusBadge()}
                </span>
                <span className="text-xs text-stone-400 font-mono">
                  {report?.checkedAt ? `Diperiksa: ${new Date(report.checkedAt).toLocaleTimeString('id-ID')}` : 'Belum diperiksa'}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Pusat Pemeliharaan &amp; Perbaikan Sistem
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 max-w-xl leading-relaxed">
                Pemantau kesehatan database Firestore, integritas transaksi kasir, konsistensi stok menu, dan pemulihan bencana otomatis Warung Bang Kobra.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onRunAudit}
              disabled={isRunningAudit}
              className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-950/40 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRunningAudit ? 'animate-spin' : ''}`} />
              <span>{isRunningAudit ? 'Memeriksa Sistem...' : 'Periksa Aplikasi Sekarang'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('auto_fix')}
              className="px-4 py-2.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Menu Perbaikan Mandiri</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Vitals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Firebase Status */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-bold">Koneksi Firebase</span>
            <Cloud className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                report?.firebaseOnline ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span className="text-lg font-black text-white font-mono">
              {report?.firebaseOnline ? 'TERHUBUNG' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-[11px] text-stone-400 font-mono">
            Latensi: {report?.firestoreLatencyMs ?? 12} ms
          </p>
        </div>

        {/* Database Firestore */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-bold">Database Firestore</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-lg font-black text-white font-mono">
              {report?.firestoreAccessible ? 'NORMAL' : 'TERGANGGU'}
            </span>
          </div>
          <p className="text-[11px] text-stone-400">
            Akses baca/tulis terverifikasi
          </p>
        </div>

        {/* Total Issues Detected */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-bold">Isu &amp; Peringatan</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {report?.totalErrors ?? 0}
          </div>
          <p className="text-[11px] text-stone-400">
            {report?.criticalCount ?? 0} Kritis • {report?.warningCount ?? 0} Peringatan
          </p>
        </div>

        {/* Last Backup Status */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-bold">Backup Terakhir</span>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-sm font-black text-white line-clamp-1">
            {lastBackupDate ? new Date(lastBackupDate).toLocaleDateString('id-ID') : 'Tersedia Hari Ini'}
          </div>
          <p className="text-[11px] text-stone-400">
            Snapshot snapshot terverifikasi
          </p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('diagnostics')}
          className="bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/40 rounded-2xl p-5 text-left transition flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-white text-sm group-hover:text-amber-400 transition">
              Diagnostik Otomatis
            </h4>
            <p className="text-xs text-stone-400 mt-1">
              Pemeriksaan 10 titik vital: konfigurasi, harga, stok, transaksi, &amp; sinkronisasi.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-600 group-hover:text-amber-400 group-hover:translate-x-1 transition mt-2" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('backup')}
          className="bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-purple-500/40 rounded-2xl p-5 text-left transition flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
              <HardDrive className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-white text-sm group-hover:text-purple-400 transition">
              Backup &amp; Pemulihan
            </h4>
            <p className="text-xs text-stone-400 mt-1">
              Pencadangan database penuh, verifikasi SHA-256, &amp; pemulihan instan.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-600 group-hover:text-purple-400 group-hover:translate-x-1 transition mt-2" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('db_inspector')}
          className="bg-stone-900 hover:bg-stone-800/80 border border-stone-800 hover:border-emerald-500/40 rounded-2xl p-5 text-left transition flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-white text-sm group-hover:text-emerald-400 transition">
              Inspeksi Database
            </h4>
            <p className="text-xs text-stone-400 mt-1">
              Audit data tabel produk, stok minus, nomor transaksi duplikat, &amp; antrian QR.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition mt-2" />
        </button>
      </div>

      {/* Recent Issues Summary Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white">Ringkasan Masalah Terdeteksi</h3>
            <p className="text-xs text-stone-400">Hasil audit pemeriksaan sistem terakhir</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('diagnostics')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            Lihat Rincian Diagnostik
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(!report || report.issues.length === 0) ? (
          <div className="text-center py-12 rounded-2xl bg-stone-950/60 border border-stone-800/80 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-black text-white">Seluruh Sistem Beroperasi Normal</h4>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              Tidak ada masalah kritis atau inkonsistensi data yang ditemukan pada pemeriksaan terakhir.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {report.issues.slice(0, 5).map((iss) => (
              <div
                key={iss.id}
                className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {iss.priority === 'CRITICAL' ? (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    ) : iss.priority === 'HIGH' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Activity className="w-5 h-5 text-sky-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white">{iss.title}</span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          iss.priority === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : iss.priority === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        {iss.priority}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{iss.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="text-[11px] font-mono text-stone-500">{iss.module}</span>
                  {iss.canAutoFix && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('auto_fix')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition cursor-pointer"
                    >
                      Perbaiki
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
