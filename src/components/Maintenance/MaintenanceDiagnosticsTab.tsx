import React, { useState } from 'react';
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Database,
  Cloud,
  FileSpreadsheet,
  QrCode,
  Layers,
  Wrench,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import {
  SystemHealthReport,
  MaintenanceIssue,
  IssuePriority,
  IssueCategory,
} from '../../types/maintenance';

interface MaintenanceDiagnosticsTabProps {
  report: SystemHealthReport | null;
  isRunningAudit: boolean;
  onRunAudit: () => void;
  onTriggerAutoFix: (actionId: string, issue: MaintenanceIssue) => void;
}

const CATEGORY_LABELS: Record<IssueCategory, { label: string; icon: React.ElementType; color: string }> = {
  CONNECTION: { label: 'Koneksi & Jaringan', icon: Cloud, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  PERMISSION: { label: 'Hak Akses & Izin', icon: ShieldAlert, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  CONFIG: { label: 'Konfigurasi Sistem', icon: Wrench, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  DATA_INTEGRITY: { label: 'Integritas Data', icon: Database, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  SYSTEM: { label: 'Runtime & PWA', icon: Activity, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
};

export const MaintenanceDiagnosticsTab: React.FC<MaintenanceDiagnosticsTabProps> = ({
  report,
  isRunningAudit,
  onRunAudit,
  onTriggerAutoFix,
}) => {
  const [selectedPriority, setSelectedPriority] = useState<'ALL' | IssuePriority>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | IssueCategory>('ALL');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  const issues = report?.issues || [];

  const filteredIssues = issues.filter((iss) => {
    if (selectedPriority !== 'ALL' && iss.priority !== selectedPriority) return false;
    if (selectedCategory !== 'ALL' && iss.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Action Header Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-black text-white">Diagnostik Mendalam Sistem</h3>
          </div>
          <p className="text-xs text-stone-400 max-w-xl">
            Audit komprehensif 10 titik vital: Koneksi Firebase, RBAC akun, katalog harga, konsistensi stok, keabsahan nomor faktur transaksi, antrian QR &amp; pengaturan warung.
          </p>
        </div>

        <button
          type="button"
          onClick={onRunAudit}
          disabled={isRunningAudit}
          className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-950/40 transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isRunningAudit ? 'animate-spin' : ''}`} />
          <span>{isRunningAudit ? 'Memeriksa Seluruh Sistem...' : 'Periksa Aplikasi Sekarang'}</span>
        </button>
      </div>

      {/* 10 Audit Checkpoints Visual Grid */}
      <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-5 space-y-3">
        <span className="text-xs font-extrabold text-stone-300 uppercase tracking-wider block">
          10 Titik Pemeriksaan Otomatis Terintegrasi:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-[11px] font-bold">
          {[
            { label: '1. Koneksi Firebase', ok: report?.firebaseOnline },
            { label: '2. Latensi Firestore', ok: report?.firestoreAccessible },
            { label: '3. Login & Hak Akses', ok: report?.authValid },
            { label: '4. Produk & Harga', ok: !issues.some((i) => i.id === 'iss-prod-invalid-price') },
            { label: '5. Kategori Menu', ok: !issues.some((i) => i.id === 'iss-prod-missing-category') },
            { label: '6. Konsistensi Stok', ok: !issues.some((i) => i.id === 'iss-prod-negative-stock') },
            { label: '7. Faktur Transaksi', ok: !issues.some((i) => i.id === 'iss-duplicate-transactions') },
            { label: '8. Kalkulasi Total', ok: !issues.some((i) => i.id === 'iss-calculation-drift') },
            { label: '9. Sinkronisasi QR', ok: !issues.some((i) => i.id === 'iss-offline-queue') },
            { label: '10. Profil Toko', ok: !issues.some((i) => i.id.startsWith('iss-setting')) },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                item.ok
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-300'
              }`}
            >
              {item.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-4 rounded-2xl">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs font-bold">
          <Filter className="w-4 h-4 text-stone-500 shrink-0" />
          <span className="text-stone-400 mr-1">Prioritas:</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPriority(p)}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedPriority === p
                  ? 'bg-amber-500 text-stone-950 font-black'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              }`}
            >
              {p === 'ALL' ? 'Semua' : p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs font-bold">
          <span className="text-stone-400 mr-1">Kategori:</span>
          {(['ALL', 'CONNECTION', 'PERMISSION', 'CONFIG', 'DATA_INTEGRITY'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-stone-200 text-stone-950 font-black'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-400'
              }`}
            >
              {cat === 'ALL' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Issues Diagnostic Feed */}
      <div className="space-y-4">
        {filteredIssues.length === 0 ? (
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="text-base font-black text-white">Tidak Ada Masalah yang Ditemukan</h4>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              Semua pemeriksaan memenuhi standar integritas data dan keamanan aplikasi.
            </p>
          </div>
        ) : (
          filteredIssues.map((iss) => {
            const isExpanded = expandedIssueId === iss.id;
            const CatMeta = CATEGORY_LABELS[iss.category] || CATEGORY_LABELS.SYSTEM;
            const CatIcon = CatMeta.icon;

            return (
              <div
                key={iss.id}
                className={`bg-stone-900 border rounded-3xl transition-all overflow-hidden ${
                  iss.priority === 'CRITICAL'
                    ? 'border-rose-500/40 shadow-lg shadow-rose-950/20'
                    : iss.priority === 'HIGH'
                    ? 'border-amber-500/40'
                    : 'border-stone-800'
                }`}
              >
                {/* Header Row */}
                <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {iss.priority === 'CRITICAL' ? (
                        <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                          <XCircle className="w-5 h-5" />
                        </div>
                      ) : iss.priority === 'HIGH' ? (
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                          <Activity className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            iss.priority === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : iss.priority === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-stone-800 text-stone-300 border-stone-700'
                          }`}
                        >
                          {iss.priority}
                        </span>

                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${CatMeta.color}`}>
                          <CatIcon className="w-3 h-3" />
                          {CatMeta.label}
                        </span>

                        <span className="text-[10px] font-mono text-stone-500">
                          Modul: {iss.module}
                        </span>
                      </div>

                      <h4 className="text-base font-extrabold text-white">{iss.title}</h4>
                      <p className="text-xs text-stone-400 leading-relaxed">{iss.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {iss.canAutoFix && iss.autoFixActionId && (
                      <button
                        type="button"
                        onClick={() => onTriggerAutoFix(iss.autoFixActionId!, iss)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition active:scale-95 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Perbaiki Masalah</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedIssueId(isExpanded ? null : iss.id)}
                      className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                      title="Lihat Rekomendasi & Rincian"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Diagnosis: Penyebab & Panduan Rekomendasi */}
                {isExpanded && (
                  <div className="bg-stone-950 border-t border-stone-800 p-5 sm:p-6 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4 space-y-1.5">
                        <span className="font-extrabold text-amber-400 block uppercase tracking-wider text-[11px]">
                          Penyebab Masalah:
                        </span>
                        <p className="text-stone-300 leading-relaxed">{iss.cause}</p>
                      </div>

                      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-4 space-y-1.5">
                        <span className="font-extrabold text-emerald-400 block uppercase tracking-wider text-[11px]">
                          Rekomendasi Penyelesaian:
                        </span>
                        <p className="text-stone-300 leading-relaxed">{iss.recommendation}</p>
                      </div>
                    </div>

                    {iss.affectedDetails && iss.affectedDetails.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="font-extrabold text-stone-400 text-[11px]">
                          Item Terdampak ({iss.affectedDetails.length}):
                        </span>
                        <div className="bg-stone-900 p-3 rounded-xl max-h-36 overflow-y-auto font-mono text-[11px] text-stone-300 divide-y divide-stone-800">
                          {iss.affectedDetails.map((det, dIdx) => (
                            <div key={dIdx} className="py-1">{det}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
