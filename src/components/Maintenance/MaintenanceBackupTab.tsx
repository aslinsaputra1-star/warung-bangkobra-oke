import React, { useState } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ShieldCheck,
  Eye,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  X,
  FileCheck,
} from 'lucide-react';
import { DatabaseBackup } from '../../types/maintenance';
import { MaintenanceService } from '../../services/maintenanceService';
import {
  exportProductsToExcel,
  exportTransactionsToExcel,
  exportCustomersToExcel,
} from '../../utils/excelHelper';
import { Product, CategoryItem, Transaction, Customer, StoreSettings } from '../../types';

interface MaintenanceBackupTabProps {
  backups: DatabaseBackup[];
  products: Product[];
  categories: CategoryItem[];
  transactions: Transaction[];
  customers: Customer[];
  settings: StoreSettings;
  operatorName: string;
  onRefreshBackups: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const MaintenanceBackupTab: React.FC<MaintenanceBackupTabProps> = ({
  backups,
  products,
  categories,
  transactions,
  customers,
  settings: _settings,
  operatorName,
  onRefreshBackups,
  showToast,
}) => {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupNotes, setBackupNotes] = useState('');
  const [selectedBackupForPreview, setSelectedBackupForPreview] = useState<DatabaseBackup | null>(null);

  // Restore State
  const [restoreFileString, setRestoreFileString] = useState<string | null>(null);
  const [restoreVerification, setRestoreVerification] = useState<{
    isValid: boolean;
    message: string;
    counts?: any;
    checksum?: string;
  } | null>(null);
  const [isVerifyingFile, setIsVerifyingFile] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'MERGE' | 'REPLACE'>('MERGE');

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await MaintenanceService.createDatabaseBackup({
        createdBy: operatorName || 'Owner',
        notes: backupNotes.trim() || undefined,
      });

      if (res.success) {
        showToast(res.message, 'success');
        setBackupNotes('');
        onRefreshBackups();
      } else {
        showToast(res.message || 'Gagal membuat backup', 'error');
      }
    } catch {
      showToast('Koneksi gagal saat membuat backup', 'error');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleDownloadBackup = (backup: DatabaseBackup) => {
    try {
      const payload = backup.dataPayload || {
        filename: backup.filename,
        createdAt: backup.createdAt,
        counts: backup.counts,
        checksum: backup.checksum,
      };

      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename || `backup_wbk_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('File cadangan database berhasil diunduh!', 'success');
    } catch {
      showToast('Gagal mengunduh file backup', 'error');
    }
  };

  // Upload and verify file handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVerifyingFile(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setRestoreFileString(content);
      const verifyRes = await MaintenanceService.verifyBackupFile(content);
      setRestoreVerification(verifyRes);
      setIsVerifyingFile(false);
      if (verifyRes.isValid) {
        showToast('File backup berhasil diverifikasi valid!', 'success');
      } else {
        showToast(verifyRes.message || 'File tidak valid', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreFileString) return;

    if (!window.confirm(
      restoreMode === 'REPLACE'
        ? 'PERINGATAN: Mode Timpa Penuh akan mengganti seluruh data produk & transaksi saat ini dengan isi file backup. Lanjutkan?'
        : 'Konfirmasi pemulihan: Data dari backup akan digabungkan (Merge) dengan database saat ini. Lanjutkan?'
    )) {
      return;
    }

    setIsRestoring(true);
    try {
      const parsed = JSON.parse(restoreFileString);
      const res = await MaintenanceService.restoreBackup(parsed, restoreMode, operatorName || 'Owner');

      if (res.success) {
        showToast(res.message, 'success');
        setRestoreFileString(null);
        setRestoreVerification(null);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(res.message || 'Gagal memulihkan database', 'error');
      }
    } catch {
      showToast('Gagal memulihkan data', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-7 space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-black text-white">Pusat Backup &amp; Pemulihan Bencana</h3>
        </div>
        <p className="text-xs text-stone-400 max-w-2xl leading-relaxed">
          Pencadangan database menyeluruh untuk seluruh koleksi Warung Bang Kobra: Produk, Varian, Kategori, Transaksi, Pelanggan, Pengeluaran, dan Pengaturan Toko. Dilengkapi verifikasi integritas cryptographic SHA-256 dan pratinjau sebelum pemulihan.
        </p>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Keamanan Terjamin: Tidak ada service account atau private key yang disimpan pada client.</span>
        </div>
      </div>

      {/* Backup Creation Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-extrabold text-white">Buat Backup Database Baru</h4>
            <p className="text-xs text-stone-400">
              Menghasilkan snapshot lengkap data saat ini ({products.length} Produk, {transactions.length} Transaksi, {customers.length} Pelanggan).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={backupNotes}
              onChange={(e) => setBackupNotes(e.target.value)}
              placeholder="Catatan backup (misal: Sebelum tutup kasir akhir bulan, atau update menu baru)..."
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <HardDrive className={`w-4 h-4 ${isCreatingBackup ? 'animate-spin' : ''}`} />
            <span>{isCreatingBackup ? 'Membuat Cadangan...' : 'Buat Backup Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* Export Section (Excel / CSV) */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
        <div>
          <h4 className="text-base font-extrabold text-white">Ekspor Data Terpisah (Excel .xlsx)</h4>
          <p className="text-xs text-stone-400">Unduh data per modul untuk pembukuan akuntansi dan arsip kasir:</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => exportProductsToExcel(products)}
            className="p-4 rounded-2xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 text-left transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-white group-hover:text-emerald-400 transition block">
                  Produk &amp; Kategori
                </span>
                <span className="text-[11px] text-stone-400 font-mono">{products.length} menu terdaftar</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-stone-600 group-hover:text-emerald-400 transition" />
          </button>

          <button
            type="button"
            onClick={() => exportTransactionsToExcel(transactions)}
            className="p-4 rounded-2xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 text-left transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-white group-hover:text-amber-400 transition block">
                  Transaksi &amp; Rincian
                </span>
                <span className="text-[11px] text-stone-400 font-mono">{transactions.length} pesanan kasir</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-stone-600 group-hover:text-amber-400 transition" />
          </button>

          <button
            type="button"
            onClick={() => exportCustomersToExcel(customers)}
            className="p-4 rounded-2xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 text-left transition flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-white group-hover:text-sky-400 transition block">
                  Data Pelanggan
                </span>
                <span className="text-[11px] text-stone-400 font-mono">{customers.length} kontak pelanggan</span>
              </div>
            </div>
            <Download className="w-4 h-4 text-stone-600 group-hover:text-sky-400 transition" />
          </button>
        </div>
      </div>

      {/* Restore Section with File Validation and Diff Preview */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-5">
        <div>
          <h4 className="text-base font-extrabold text-white">Pemulihan Database dari File Cadangan</h4>
          <p className="text-xs text-stone-400">
            Unggah file cadangan JSON Warung Bang Kobra. Sistem akan memvalidasi integritas sebelum Anda menyetujui pemulihan.
          </p>
        </div>

        <div className="border-2 border-dashed border-stone-800 hover:border-amber-500/40 rounded-2xl p-6 text-center transition space-y-3 bg-stone-950/40">
          <Upload className="w-8 h-8 text-stone-500 mx-auto" />
          <div>
            <label
              htmlFor="upload-backup-file"
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold text-xs inline-block cursor-pointer transition"
            >
              Pilih File Backup JSON
            </label>
            <input
              id="upload-backup-file"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <p className="text-[11px] text-stone-500">Mendukung format file cadangan resmi (.json)</p>
        </div>

        {/* Verification Preview Box */}
        {isVerifyingFile && (
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-400 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>Memvalidasi integritas file &amp; menghitung checksum SHA-256...</span>
          </div>
        )}

        {restoreVerification && (
          <div
            className={`p-5 rounded-2xl border space-y-4 ${
              restoreVerification.isValid
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-rose-500/5 border-rose-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {restoreVerification.isValid ? (
                <FileCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              )}
              <span className="font-extrabold text-sm text-white">
                {restoreVerification.isValid ? 'Pratinjau Data File Cadangan' : 'File Cadangan Tidak Valid'}
              </span>
            </div>

            <p className="text-xs text-stone-300">{restoreVerification.message}</p>

            {restoreVerification.isValid && restoreVerification.counts && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                    <span className="text-stone-400 block text-[10px]">Produk:</span>
                    <span className="text-white font-bold text-sm">{restoreVerification.counts.products}</span>
                  </div>
                  <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                    <span className="text-stone-400 block text-[10px]">Transaksi:</span>
                    <span className="text-white font-bold text-sm">{restoreVerification.counts.transactions}</span>
                  </div>
                  <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                    <span className="text-stone-400 block text-[10px]">Kategori:</span>
                    <span className="text-white font-bold text-sm">{restoreVerification.counts.categories}</span>
                  </div>
                  <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800">
                    <span className="text-stone-400 block text-[10px]">Pelanggan:</span>
                    <span className="text-white font-bold text-sm">{restoreVerification.counts.customers}</span>
                  </div>
                </div>

                {restoreVerification.checksum && (
                  <div className="text-[10px] text-stone-500 font-mono truncate">
                    Checksum SHA-256: {restoreVerification.checksum}
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs font-bold text-stone-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === 'MERGE'}
                        onChange={() => setRestoreMode('MERGE')}
                        className="text-amber-500"
                      />
                      <span>Gabungkan (Merge Data)</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-rose-300">
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === 'REPLACE'}
                        onChange={() => setRestoreMode('REPLACE')}
                        className="text-rose-500"
                      />
                      <span>Timpa Penuh (Replace)</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                    <span>{isRestoring ? 'Memulihkan Data...' : 'Konfirmasi & Pulihkan Sekarang'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Backup History Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-extrabold text-white">Riwayat Cadangan Tersimpan</h4>
            <p className="text-xs text-stone-400">Daftar file snapshot yang diverifikasi di server &amp; cloud</p>
          </div>
          <button
            type="button"
            onClick={onRefreshBackups}
            className="p-2 rounded-xl bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-12 text-stone-500 text-xs">
            Belum ada riwayat backup database yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 font-extrabold uppercase text-[11px]">
                  <th className="py-3 px-3">Nama File</th>
                  <th className="py-3 px-3">Waktu Pembuatan</th>
                  <th className="py-3 px-3">Operator</th>
                  <th className="py-3 px-3">Ukuran</th>
                  <th className="py-3 px-3">Isi Data</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80 font-mono text-stone-300">
                {backups.map((bk) => (
                  <tr key={bk.id} className="hover:bg-stone-800/30 transition">
                    <td className="py-3 px-3 font-sans font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate max-w-[200px]" title={bk.filename}>
                        {bk.filename}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-stone-400">
                      {new Date(bk.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 font-sans text-stone-300">{bk.createdBy || 'Owner'}</td>
                    <td className="py-3 px-3 text-amber-400">
                      {Math.round(bk.sizeBytes / 1024)} KB
                    </td>
                    <td className="py-3 px-3 text-stone-400 font-sans text-[11px]">
                      {bk.counts?.products ?? 0} Prod • {bk.counts?.transactions ?? 0} Trans
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                        <CheckCircle2 className="w-3 h-3" />
                        TERVERIFIKASI
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadBackup(bk)}
                        className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-sans font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-amber-400" />
                        <span>Unduh JSON</span>
                      </button>
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
