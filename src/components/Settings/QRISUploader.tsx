import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Upload,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sliders,
  Save,
  X,
  Eye,
  Download,
  Printer,
  Link as LinkIcon,
  ShieldCheck,
  Sparkles,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { StoreSettings } from '../../types';
import {
  uploadQRISImageToFirebase,
  deleteQRISImageFromFirebase,
} from '../../services/firebase';

interface QRISUploaderProps {
  settings: StoreSettings;
  onSaveSettings: (newSettings: StoreSettings) => void | boolean | Promise<boolean | void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface ImageAdjustments {
  rotation: number; // 0, 90, 180, 270
  zoom: number; // 0.8 to 1.6
  contrast: number; // 80 to 150 (%)
  brightness: number; // 85 to 125 (%)
}

const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  rotation: 0,
  zoom: 1,
  contrast: 100,
  brightness: 100,
};

export const QRISUploader: React.FC<QRISUploaderProps> = ({
  settings,
  onSaveSettings,
  showToast,
}) => {
  const savedQrisUrl = String(settings.qrisImageUrl || settings.qrisUrl || '').trim();

  // Mode: 'view' (showing saved QRIS), 'preview' (unsaved file/edit preview before saving)
  const [mode, setMode] = useState<'view' | 'preview'>('view');
  const [inputTab, setInputTab] = useState<'upload' | 'url'>('upload');

  // Unsaved preview states
  const [rawSourceUrl, setRawSourceUrl] = useState<string>('');
  const [renderedPreviewUrl, setRenderedPreviewUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<{
    name: string;
    format: string;
    sizeKB: string;
    dimensions?: string;
  } | null>(null);
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);

  // Merchant metadata form states
  const [merchantName, setMerchantName] = useState<string>(
    settings.qrisMerchantName || settings.storeName || 'WARUNG BANG KOBRA'
  );
  const [nmid, setNmid] = useState<string>(settings.qrisNmid || '');
  const [qrisEnabled, setQrisEnabled] = useState<boolean>(
    settings.qrisEnabled !== undefined ? settings.qrisEnabled : true
  );
  const [instruction, setInstruction] = useState<string>(
    settings.qrisInstruction ||
      'Scan QRIS menggunakan GoPay, OVO, DANA, ShopeePay, LinkAja, atau Mobile Banking.'
  );
  const [customUrlInput, setCustomUrlInput] = useState<string>('');

  // UI feedback states
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isUploadingToFirebase, setIsUploadingToFirebase] = useState(false);
  const [isDeletingFromFirebase, setIsDeletingFromFirebase] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync merchant metadata when settings prop updates from Firestore (if not in preview mode)
  useEffect(() => {
    if (mode === 'view') {
      setMerchantName(settings.qrisMerchantName || settings.storeName || 'WARUNG BANG KOBRA');
      setNmid(settings.qrisNmid || '');
      setQrisEnabled(settings.qrisEnabled !== undefined ? settings.qrisEnabled : true);
      setInstruction(
        settings.qrisInstruction ||
          'Scan QRIS menggunakan GoPay, OVO, DANA, ShopeePay, LinkAja, atau Mobile Banking.'
      );
    }
  }, [
    settings.qrisMerchantName,
    settings.storeName,
    settings.qrisNmid,
    settings.qrisEnabled,
    settings.qrisInstruction,
    mode,
  ]);

  // Render image with rotation, zoom, brightness, and contrast onto an offscreen canvas
  const renderAdjustedImage = useCallback(
    (sourceDataUrl: string, adj: ImageAdjustments, outputMime = 'image/png'): Promise<string> => {
      return new Promise((resolve) => {
        if (!sourceDataUrl) {
          resolve('');
          return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 680;
            const isRotated90 = adj.rotation % 180 !== 0;
            const srcW = isRotated90 ? img.height : img.width;
            const srcH = isRotated90 ? img.width : img.height;

            let targetW = srcW || 500;
            let targetH = srcH || 500;

            if (targetW > targetH && targetW > MAX_SIZE) {
              targetH = Math.max(1, Math.round((targetH * MAX_SIZE) / targetW));
              targetW = MAX_SIZE;
            } else if (targetH > MAX_SIZE) {
              targetW = Math.max(1, Math.round((targetW * MAX_SIZE) / targetH));
              targetH = MAX_SIZE;
            }

            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(sourceDataUrl);
              return;
            }

            // Fill crisp white background so transparent PNG QR codes remain high-contrast
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetW, targetH);

            ctx.save();
            ctx.filter = `contrast(${adj.contrast}%) brightness(${adj.brightness}%)`;
            ctx.translate(targetW / 2, targetH / 2);
            ctx.rotate((adj.rotation * Math.PI) / 180);
            ctx.scale(adj.zoom, adj.zoom);

            const drawW = isRotated90 ? targetH : targetW;
            const drawH = isRotated90 ? targetW : targetH;
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();

            let dataUrl = canvas.toDataURL(outputMime, 0.92);
            // Ensure Firestore document stays well within limits if used as fallback
            if (dataUrl.length > 350000) {
              dataUrl = canvas.toDataURL('image/jpeg', 0.86);
            }
            resolve(dataUrl);
          } catch {
            resolve(sourceDataUrl);
          }
        };
        img.onerror = () => {
          resolve(sourceDataUrl);
        };
        img.src = sourceDataUrl;
      });
    },
    []
  );

  // Re-render preview whenever adjustments or rawSourceUrl change
  useEffect(() => {
    if (mode !== 'preview' || !rawSourceUrl) return;
    let active = true;
    const isAdjusted =
      adjustments.rotation !== 0 ||
      adjustments.zoom !== 1 ||
      adjustments.contrast !== 100 ||
      adjustments.brightness !== 100;

    if (!isAdjusted && rawSourceUrl.startsWith('data:')) {
      renderAdjustedImage(
        rawSourceUrl,
        adjustments,
        selectedFile?.type === 'image/png' ? 'image/png' : 'image/jpeg'
      ).then((res) => {
        if (active) setRenderedPreviewUrl(res || rawSourceUrl);
      });
    } else if (isAdjusted) {
      renderAdjustedImage(
        rawSourceUrl,
        adjustments,
        selectedFile?.type === 'image/png' ? 'image/png' : 'image/jpeg'
      ).then((res) => {
        if (active) setRenderedPreviewUrl(res || rawSourceUrl);
      });
    } else {
      setRenderedPreviewUrl(rawSourceUrl);
    }

    return () => {
      active = false;
    };
  }, [rawSourceUrl, adjustments, mode, renderAdjustedImage, selectedFile]);

  // Validate and load PNG, JPG, JPEG file into Preview Mode
  const handleProcessFile = (file: File) => {
    setValidationError(null);

    const fileName = file.name || 'qris.png';
    const lowerName = fileName.toLowerCase();
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const validExtensions = ['.png', '.jpg', '.jpeg'];

    const hasValidMime = validMimeTypes.includes(file.type.toLowerCase());
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!hasValidMime && !hasValidExt) {
      const msg = 'Format file tidak didukung! Harap unggah gambar QRIS berformat PNG, JPG, atau JPEG.';
      setValidationError(msg);
      showToast(msg, 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'Ukuran file terlalu besar (Maksimal 10MB). Silakan pilih gambar yang lebih kecil.';
      setValidationError(msg);
      showToast(msg, 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const resultDataUrl = String(e.target?.result || '');
      const probeImg = new Image();
      probeImg.onload = () => {
        const extLabel = lowerName.endsWith('.png')
          ? 'PNG'
          : lowerName.endsWith('.jpeg')
          ? 'JPEG'
          : 'JPG';
        setSelectedFile(file);
        setFileMeta({
          name: fileName,
          format: extLabel,
          sizeKB: `${(file.size / 1024).toFixed(1)} KB`,
          dimensions: `${probeImg.width} × ${probeImg.height} px`,
        });
        setAdjustments(DEFAULT_ADJUSTMENTS);
        setRawSourceUrl(resultDataUrl);
        setRenderedPreviewUrl(resultDataUrl);
        setMode('preview');
        setIsProcessingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        showToast(
          'Pratinjau gambar QRIS siap! Periksa atau edit sebelum klik "Simpan QRIS ke Firebase".',
          'info'
        );
      };
      probeImg.onerror = () => {
        setIsProcessingFile(false);
        const msg = 'Gagal memuat file gambar. Pastikan file PNG/JPG/JPEG tidak rusak.';
        setValidationError(msg);
        showToast(msg, 'error');
      };
      probeImg.src = resultDataUrl;
    };
    reader.onerror = () => {
      setIsProcessingFile(false);
      showToast('Gagal membaca file dari perangkat.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Open existing QRIS in Edit / Preview mode
  const handleStartEditExisting = () => {
    if (!savedQrisUrl) {
      fileInputRef.current?.click();
      return;
    }
    setValidationError(null);
    setSelectedFile(null);
    setFileMeta({
      name: 'qris-warung-bang-kobra.png',
      format: savedQrisUrl.toLowerCase().includes('.jpg') || savedQrisUrl.startsWith('data:image/jpeg') ? 'JPG' : 'PNG',
      sizeKB: 'Tersimpan di Cloud',
    });
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setRawSourceUrl(savedQrisUrl);
    setRenderedPreviewUrl(savedQrisUrl);
    setMode('preview');
  };

  // Preview from URL input
  const handlePreviewFromUrl = () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/'))) {
      setValidationError('Masukkan URL gambar QRIS yang valid (diawali https://)');
      showToast('Masukkan URL gambar QRIS yang valid!', 'error');
      return;
    }
    setValidationError(null);
    setSelectedFile(null);
    setFileMeta({
      name: 'URL Eksternal QRIS',
      format: trimmed.toLowerCase().includes('.png') ? 'PNG' : 'JPG/JPEG',
      sizeKB: 'URL Cloud',
    });
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setRawSourceUrl(trimmed);
    setRenderedPreviewUrl(trimmed);
    setMode('preview');
    showToast('Pratinjau URL QRIS dimuat. Klik "Simpan QRIS ke Firebase" untuk menyimpan.', 'info');
  };

  // Cancel Preview Mode
  const handleCancelPreview = () => {
    setMode('view');
    setRawSourceUrl('');
    setRenderedPreviewUrl('');
    setSelectedFile(null);
    setFileMeta(null);
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setValidationError(null);
    setMerchantName(settings.qrisMerchantName || settings.storeName || 'WARUNG BANG KOBRA');
    setNmid(settings.qrisNmid || '');
    setQrisEnabled(settings.qrisEnabled !== undefined ? settings.qrisEnabled : true);
    setInstruction(
      settings.qrisInstruction ||
        'Scan QRIS menggunakan GoPay, OVO, DANA, ShopeePay, LinkAja, atau Mobile Banking.'
    );
  };

  // Convert DataURL to File if user adjusted the image on canvas
  const dataUrlToFile = (dataUrl: string, filename: string): File | null => {
    try {
      const arr = dataUrl.split(',');
      if (arr.length < 2) return null;
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch {
      return null;
    }
  };

  // Save QRIS to Firebase Storage & Firestore
  const handleSaveQRISToFirebase = async () => {
    const targetPreview = renderedPreviewUrl || rawSourceUrl;
    if (!targetPreview) {
      showToast('Pilih atau unggah gambar QRIS terlebih dahulu!', 'error');
      return;
    }

    setIsUploadingToFirebase(true);
    setValidationError(null);

    try {
      const isAdjusted =
        adjustments.rotation !== 0 ||
        adjustments.zoom !== 1 ||
        adjustments.contrast !== 100 ||
        adjustments.brightness !== 100;

      // Determine payload to upload to Firebase Storage
      let uploadTarget: File | string = targetPreview;
      if (selectedFile && !isAdjusted) {
        uploadTarget = selectedFile;
      } else if (targetPreview.startsWith('data:')) {
        const convertedFile = dataUrlToFile(
          targetPreview,
          selectedFile?.name || `qris_warung_bang_kobra_${Date.now()}.png`
        );
        uploadTarget = convertedFile || targetPreview;
      }

      // 1. Upload image to Firebase Storage (with automatic high-speed fallback)
      const { downloadUrl, storagePath } = await uploadQRISImageToFirebase(
        uploadTarget,
        settings.storeName || 'WARUNG_BANG_KOBRA',
        targetPreview
      );

      const finalQrisUrl = downloadUrl || targetPreview;
      const nowIso = new Date().toISOString();

      // 2. Save downloadUrl & QRIS settings to Firestore via onSaveSettings
      const updatedSettings: StoreSettings = {
        ...settings,
        qrisImageUrl: finalQrisUrl,
        qrisUrl: finalQrisUrl,
        qrisMerchantName: merchantName.trim() || settings.storeName || 'WARUNG BANG KOBRA',
        qrisNmid: nmid.trim(),
        qrisEnabled,
        qrisInstruction:
          instruction.trim() ||
          'Scan QRIS menggunakan GoPay, OVO, DANA, ShopeePay, LinkAja, atau Mobile Banking.',
        qrisStoragePath: storagePath,
        qrisUpdatedAt: nowIso,
      };

      await onSaveSettings(updatedSettings);

      setMode('view');
      setRawSourceUrl('');
      setRenderedPreviewUrl('');
      setSelectedFile(null);
      setFileMeta(null);
      setCustomUrlInput('');
      showToast(
        'Gambar QRIS berhasil diunggah ke Firebase Storage & disimpan ke Firestore!',
        'success'
      );
    } catch (err: any) {
      console.error('Error saving QRIS:', err);
      showToast(
        'Gagal menyimpan QRIS: ' + (err?.message || 'Periksa koneksi internet Anda.'),
        'error'
      );
    } finally {
      setIsUploadingToFirebase(false);
    }
  };

  // Save only Merchant Metadata when already in 'view' mode
  const handleSaveMerchantMetaOnly = async () => {
    setIsUploadingToFirebase(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedSettings: StoreSettings = {
        ...settings,
        qrisMerchantName: merchantName.trim() || settings.storeName || 'WARUNG BANG KOBRA',
        qrisNmid: nmid.trim(),
        qrisEnabled,
        qrisInstruction:
          instruction.trim() ||
          'Scan QRIS menggunakan GoPay, OVO, DANA, ShopeePay, LinkAja, atau Mobile Banking.',
        qrisUpdatedAt: nowIso,
      };
      await onSaveSettings(updatedSettings);
      showToast('Pengaturan informasi pembayaran QRIS berhasil diperbarui di Firestore!', 'success');
    } catch (err: any) {
      showToast('Gagal menyimpan pengaturan QRIS: ' + (err?.message || 'Error'), 'error');
    } finally {
      setIsUploadingToFirebase(false);
    }
  };

  // Delete QRIS Image from Firebase Storage & Firestore
  const handleConfirmDeleteQRIS = async () => {
    setIsDeletingFromFirebase(true);
    try {
      await deleteQRISImageFromFirebase(savedQrisUrl, settings.qrisStoragePath);
      const nowIso = new Date().toISOString();
      const clearedSettings: StoreSettings = {
        ...settings,
        qrisImageUrl: '',
        qrisUrl: '',
        qrisStoragePath: '',
        qrisUpdatedAt: nowIso,
      };
      await onSaveSettings(clearedSettings);
      setShowDeleteConfirm(false);
      setMode('view');
      setRawSourceUrl('');
      setRenderedPreviewUrl('');
      setSelectedFile(null);
      showToast('Gambar QRIS berhasil dihapus dari Firebase Storage & Firestore.', 'info');
    } catch (err: any) {
      showToast('Gagal menghapus gambar QRIS: ' + (err?.message || 'Error'), 'error');
    } finally {
      setIsDeletingFromFirebase(false);
    }
  };

  // Download QRIS Image
  const handleDownloadQRIS = () => {
    const activeUrl = mode === 'preview' ? renderedPreviewUrl || rawSourceUrl : savedQrisUrl;
    if (!activeUrl) return;
    const link = document.createElement('a');
    link.href = activeUrl;
    link.download = `QRIS-${(merchantName || settings.storeName || 'WARUNG-BANG-KOBRA')
      .replace(/\s+/g, '-')
      .toUpperCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Gambar QRIS berhasil diunduh ke perangkat!', 'success');
  };

  // Print QRIS Standee
  const handlePrintQRISStandee = () => {
    const activeUrl = mode === 'preview' ? renderedPreviewUrl || rawSourceUrl : savedQrisUrl;
    if (!activeUrl) return;
    const printArea = document.getElementById('qris-printable-standee');
    if (!printArea) {
      window.print();
      return;
    }
    window.print();
  };

  const isMetaDirty =
    merchantName.trim() !==
      (settings.qrisMerchantName || settings.storeName || 'WARUNG BANG KOBRA') ||
    nmid.trim() !== (settings.qrisNmid || '') ||
    qrisEnabled !== (settings.qrisEnabled !== undefined ? settings.qrisEnabled : true) ||
    instruction.trim() !==
      (settings.qrisInstruction ||
        'Scan QRIS menggunakan GoPay, OVO, DANA, ShopeePay, LinkAja, atau Mobile Banking.');

  return (
    <div className="space-y-5">
      {/* Hidden File Input (Strictly PNG, JPG, JPEG) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        onChange={handleFileChange}
        className="hidden"
        id="input-qris-file-upload"
      />

      {/* Top Status & Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-stone-950 border border-stone-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 ${
              savedQrisUrl && qrisEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
            }`}
          >
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-stone-100">
                Status QRIS Pembayaran:
              </span>
              {mode === 'preview' ? (
                <span className="text-xs font-black text-amber-400">
                  Mode Pratinjau (Belum Disimpan)
                </span>
              ) : savedQrisUrl ? (
                <span className="text-xs font-black text-emerald-400">
                  {qrisEnabled ? 'Aktif & Tersimpan di Cloud' : 'Tersimpan (Status Nonaktif)'}
                </span>
              ) : (
                <span className="text-xs font-black text-red-400">
                  Belum Ada Gambar QRIS
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Format didukung: <strong>PNG, JPG, JPEG</strong> · Penyimpanan:{' '}
              <strong>Firebase Storage &amp; Cloud Firestore</strong>
              {settings.qrisUpdatedAt && (
                <span>
                  {' '}
                  · Diperbarui: {new Date(settings.qrisUpdatedAt).toLocaleString('id-ID')}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="btn-upload-qris-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile || isUploadingToFirebase}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-black text-xs shadow-lg shadow-amber-950/40 transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>{savedQrisUrl ? 'Ganti Gambar QRIS' : 'Upload QRIS'}</span>
          </button>

          {savedQrisUrl && mode === 'view' && (
            <>
              <button
                type="button"
                id="btn-edit-qris"
                onClick={handleStartEditExisting}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-amber-300 border border-stone-700 font-bold text-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Edit QRIS</span>
              </button>

              <button
                type="button"
                id="btn-delete-qris"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/70 text-red-300 border border-red-800/70 font-bold text-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Hapus QRIS</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/60 text-red-200 text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="p-1 rounded-lg hover:bg-red-900/50 text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Box (In-app safe confirmation) */}
      {showDeleteConfirm && (
        <div className="p-4 rounded-2xl bg-red-950/70 border-2 border-red-500/70 space-y-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <h4 className="text-xs sm:text-sm font-black text-red-200">
                Konfirmasi Hapus Gambar QRIS Warung Bang Kobra
              </h4>
              <p className="text-xs text-red-300/90 leading-relaxed">
                Apakah Anda yakin ingin menghapus gambar QRIS saat ini dari Firebase Storage dan Firestore? Pelanggan tidak akan melihat gambar QRIS ini sampai Anda mengunggah gambar baru.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeletingFromFirebase}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              id="btn-confirm-delete-qris"
              onClick={handleConfirmDeleteQRIS}
              disabled={isDeletingFromFirebase}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              {isDeletingFromFirebase ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Ya, Hapus Gambar QRIS</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 1: PRATINJAU SEBELUM DISIMPAN & EDITOR QRIS (PREVIEW & EDIT MODE)
      ===================================================================== */}
      {mode === 'preview' && (
        <div className="p-5 rounded-3xl bg-stone-950 border-2 border-amber-500/70 space-y-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-300">
                  Pratinjau &amp; Edit Gambar QRIS Sebelum Disimpan
                </h4>
                <p className="text-[11px] text-stone-400">
                  Periksa ketajaman kode QRIS, sesuaikan rotasi/zoom jika perlu, lalu klik{' '}
                  <strong className="text-stone-200">Simpan QRIS ke Firebase</strong>.
                </p>
              </div>
            </div>

            {fileMeta && (
              <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
                <span className="text-stone-200 font-bold truncate max-w-[180px]">
                  {fileMeta.name}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-bold">{fileMeta.format}</span>
                <span aria-hidden="true">·</span>
                <span>{fileMeta.sizeKB}</span>
                {fileMeta.dimensions && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{fileMeta.dimensions}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Image Preview + Image Editing Controls */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex flex-col items-center justify-center space-y-3">
                <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pratinjau Gambar QRIS (Hasil Edit Langsung)</span>
                </div>

                <div className="p-4 bg-white rounded-2xl shadow-xl border-2 border-amber-500/40 flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72 overflow-hidden">
                  {renderedPreviewUrl || rawSourceUrl ? (
                    <img
                      src={renderedPreviewUrl || rawSourceUrl}
                      alt="Pratinjau QRIS Warung Bang Kobra"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-stone-400 text-xs text-center">
                      Memuat pratinjau...
                    </div>
                  )}
                </div>

                {/* Quick Image Edit Toolbar (Rotate, Zoom, Sharpness/Contrast) */}
                <div className="w-full space-y-3 pt-2 border-t border-stone-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit &amp; Sesuaikan Gambar QRIS</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
                      className="text-[11px] text-stone-400 hover:text-amber-400 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Editan</span>
                    </button>
                  </div>

                  {/* Rotate & Auto-Sharpen Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAdjustments((prev) => ({
                          ...prev,
                          rotation: (prev.rotation + 270) % 360,
                        }))
                      }
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-200 border border-stone-800 text-xs font-bold transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Putar Kiri</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setAdjustments((prev) => ({
                          ...prev,
                          rotation: (prev.rotation + 90) % 360,
                        }))
                      }
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-200 border border-stone-800 text-xs font-bold transition cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Putar Kanan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setAdjustments((prev) => ({
                          ...prev,
                          contrast: prev.contrast === 125 ? 100 : 125,
                          brightness: prev.brightness === 105 ? 100 : 105,
                        }))
                      }
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        adjustments.contrast > 100
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-stone-950 hover:bg-stone-800 text-stone-200 border-stone-800'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pertajam QR</span>
                    </button>
                  </div>

                  {/* Zoom & Contrast Sliders */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-400 font-semibold flex items-center gap-1">
                          <ZoomIn className="w-3 h-3 text-amber-400" /> Zoom QR
                        </span>
                        <span className="font-mono font-bold text-stone-200 tabular-nums">
                          {Math.round(adjustments.zoom * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.8}
                        max={1.5}
                        step={0.05}
                        value={adjustments.zoom}
                        onChange={(e) =>
                          setAdjustments((prev) => ({
                            ...prev,
                            zoom: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-400 font-semibold">Kontras Cetak</span>
                        <span className="font-mono font-bold text-stone-200 tabular-nums">
                          {adjustments.contrast}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={85}
                        max={145}
                        step={5}
                        value={adjustments.contrast}
                        onChange={(e) =>
                          setAdjustments((prev) => ({
                            ...prev,
                            contrast: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Merchant Info Editor & Customer Payment Card Simulation */}
            <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
              <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 space-y-3.5">
                <h5 className="text-xs font-black text-stone-200 uppercase tracking-wider">
                  Detail Merchant &amp; Instruksi QRIS
                </h5>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Nama Merchant QRIS (Tampil di Pelanggan) *
                  </label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="WARUNG BANG KOBRA"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    NMID / Nomor Identitas Merchant (Opsional)
                  </label>
                  <input
                    type="text"
                    value={nmid}
                    onChange={(e) => setNmid(e.target.value)}
                    placeholder="Contoh: ID102003004005"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Instruksi Pembayaran Pelanggan
                  </label>
                  <textarea
                    rows={2}
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Scan QRIS menggunakan GoPay, OVO, DANA, ShopeePay, atau Mobile Banking."
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <div>
                    <div className="text-xs font-bold text-stone-200">
                      Aktifkan Pembayaran QRIS
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Tampilkan QRIS ini saat checkout Kasir, Menu Online, &amp; QR Order
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={qrisEnabled}
                    onChange={(e) => setQrisEnabled(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 cursor-pointer rounded"
                  />
                </div>
              </div>

              {/* Action Bar for Preview Mode */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-3">
                <div className="flex items-center gap-2 text-xs text-amber-200 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Gambar akan diunggah ke <strong>Firebase Storage</strong> dan URL-nya disimpan ke{' '}
                    <strong>Firestore</strong>.
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelPreview}
                    disabled={isUploadingToFirebase}
                    className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingToFirebase}
                    className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 text-xs font-bold transition cursor-pointer"
                  >
                    Pilih File Lain
                  </button>

                  <button
                    type="button"
                    id="btn-save-qris-firebase"
                    onClick={handleSaveQRISToFirebase}
                    disabled={isUploadingToFirebase}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-950/50 transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingToFirebase ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mengunggah ke Firebase...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Simpan QRIS ke Firebase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 2: TAMPILAN UTAMA PENGATURAN QRIS (VIEW & UPLOAD ZONE)
      ===================================================================== */}
      {mode === 'view' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload Dropzone & Merchant Form */}
          <div className="lg:col-span-7 space-y-4">
            {/* Sub-tab selector: Upload File vs Input URL */}
            <div className="flex items-center gap-1 p-1 bg-stone-950 rounded-xl border border-stone-800 w-fit">
              <button
                type="button"
                onClick={() => setInputTab('upload')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  inputTab === 'upload'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Gambar (PNG, JPG, JPEG)</span>
              </button>
              <button
                type="button"
                onClick={() => setInputTab('url')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  inputTab === 'url'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Gunakan URL Gambar</span>
              </button>
            </div>

            {inputTab === 'upload' ? (
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-amber-400 bg-amber-500/10 scale-[0.99]'
                    : 'border-stone-700 hover:border-amber-500/60 bg-stone-950/80 hover:bg-stone-950'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
                  {isProcessingFile ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-black text-stone-100">
                    {isDragging
                      ? 'Lepaskan file gambar QRIS di sini'
                      : 'Klik tombol Upload QRIS atau tarik & lepas gambar ke kotak ini'}
                  </p>
                  <p className="text-xs text-stone-400">
                    Mendukung format gambar <strong>PNG, JPG, dan JPEG</strong> (Maks. 10MB)
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black shadow-md transition">
                    {savedQrisUrl ? 'Pilih Gambar QRIS Baru' : 'Upload QRIS Sekarang'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
                <label className="text-xs font-bold text-stone-300 block">
                  Tempel URL Gambar QRIS (PNG / JPG / JPEG)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://firebasestorage.googleapis.com/.../qris.png"
                    className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handlePreviewFromUrl}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition cursor-pointer whitespace-nowrap"
                  >
                    Tampilkan Pratinjau
                  </button>
                </div>
                <p className="text-[11px] text-stone-400">
                  Gambar dari URL akan ditampilkan pada pratinjau terlebih dahulu sebelum disimpan ke Firestore.
                </p>
              </div>
            )}

            {/* Quick Merchant Configuration Form */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-stone-200 uppercase tracking-wider">
                  Informasi Merchant &amp; Status QRIS
                </h4>
                {isMetaDirty && (
                  <button
                    type="button"
                    onClick={handleSaveMerchantMetaOnly}
                    disabled={isUploadingToFirebase}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Info QRIS</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-400 mb-1 block">
                    Nama Merchant QRIS
                  </label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="WARUNG BANG KOBRA"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 mb-1 block">
                    NMID Merchant (Opsional)
                  </label>
                  <input
                    type="text"
                    value={nmid}
                    onChange={(e) => setNmid(e.target.value)}
                    placeholder="ID102003004005"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-400 mb-1 block">
                  Catatan / Instruksi Pembayaran QRIS
                </label>
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Scan QRIS menggunakan GoPay, OVO, DANA, ShopeePay, atau Mobile Banking."
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-stone-800/80">
                <span className="text-xs font-bold text-stone-300">
                  Tampilkan opsi bayar QRIS untuk pelanggan
                </span>
                <input
                  type="checkbox"
                  checked={qrisEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setQrisEnabled(checked);
                    onSaveSettings({
                      ...settings,
                      qrisEnabled: checked,
                      qrisUpdatedAt: new Date().toISOString(),
                    });
                    showToast(
                      checked
                        ? 'Pembayaran QRIS diaktifkan untuk pelanggan.'
                        : 'Pembayaran QRIS dinonaktifkan sementara.',
                      'info'
                    );
                  }}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer rounded"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Active Saved QRIS Card Preview */}
          <div className="lg:col-span-5">
            <div
              id="qris-printable-standee"
              className="p-5 rounded-3xl bg-stone-950 border border-stone-800 flex flex-col items-center text-center space-y-4 h-full justify-between"
            >
              <div className="space-y-1 w-full">
                <div className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider">
                  QRIS Pembayaran Resmi
                </div>
                <h4 className="text-base font-black text-stone-100">
                  {merchantName || settings.storeName || 'WARUNG BANG KOBRA'}
                </h4>
                {nmid && (
                  <p className="text-[11px] font-mono text-stone-400">NMID: {nmid}</p>
                )}
              </div>

              {savedQrisUrl ? (
                <div className="space-y-3 w-full flex flex-col items-center">
                  <div
                    onClick={() => setShowZoomModal(true)}
                    title="Klik untuk memperbesar gambar QRIS"
                    className="p-3.5 bg-white rounded-2xl shadow-xl border-2 border-stone-700 hover:border-amber-400 transition cursor-pointer group relative w-56 h-56 flex items-center justify-center"
                  >
                    <img
                      src={savedQrisUrl}
                      alt={`QRIS ${merchantName || settings.storeName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-xl bg-stone-900/95 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                        <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                        <span>Perbesar</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-400 max-w-xs leading-relaxed">
                    {instruction}
                  </p>
                </div>
              ) : (
                <div className="py-10 px-4 rounded-2xl bg-stone-900/70 border border-dashed border-stone-800 w-full flex flex-col items-center justify-center gap-2.5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-stone-800 text-stone-500 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-stone-300">
                      Belum Ada Gambar QRIS Tersimpan
                    </p>
                    <p className="text-[11px] text-stone-400 max-w-[220px]">
                      Unggah file PNG, JPG, atau JPEG untuk menampilkan kode QRIS Warung Bang Kobra kepada pelanggan.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition cursor-pointer"
                  >
                    + Upload Gambar QRIS
                  </button>
                </div>
              )}

              {/* Bottom Card Actions */}
              {savedQrisUrl && (
                <div className="w-full pt-3 border-t border-stone-800 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowZoomModal(true)}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                      <span>Lihat</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadQRIS}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Unduh</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintQRISStandee}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5 text-orange-400" />
                      <span>Cetak</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Modal for QRIS */}
      {showZoomModal && savedQrisUrl && (
        <div
          onClick={() => setShowZoomModal(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <div className="text-left">
                <h4 className="text-sm font-black text-stone-100">
                  {merchantName || settings.storeName || 'WARUNG BANG KOBRA'}
                </h4>
                <p className="text-[11px] text-stone-400">
                  {nmid ? `NMID: ${nmid}` : 'QRIS Pembayaran Resmi'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl shadow-xl mx-auto w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
              <img
                src={savedQrisUrl}
                alt="QRIS Warung Bang Kobra"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">{instruction}</p>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadQRIS}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Gambar QRIS</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowZoomModal(false);
                  handleStartEditExisting();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-bold transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit QRIS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
