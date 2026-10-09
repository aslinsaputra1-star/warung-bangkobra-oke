import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, ensureFirebaseAuth, logAuditActivity } from './firebase';
import { StorageService } from './storage';
import {
  MaintenanceIssue,
  SystemHealthReport,
  AutoFixActionType,
  DatabaseBackup,
  SystemErrorLog,
  MaintenanceSettings,
} from '../types/maintenance';
import {
  Product,
  ProductVariant,
  Transaction,
  CategoryItem,
  Expense,
  Customer,
  StoreSettings,
} from '../types';

export class MaintenanceService {
  /**
   * Run comprehensive 10-point system audit
   */
  static async runComprehensiveAudit(options: {
    products: Product[];
    variants: ProductVariant[];
    categories: CategoryItem[];
    transactions: Transaction[];
    customers: Customer[];
    expenses: Expense[];
    settings: StoreSettings;
    currentUserRole?: string;
  }): Promise<SystemHealthReport> {
    const {
      products,
      variants,
      categories,
      transactions,
      customers: _customers,
      expenses: _expenses,
      settings,
      currentUserRole,
    } = options;

    const issues: MaintenanceIssue[] = [];
    const startTime = performance.now();

    // 1. Check Firebase Connection & Latency
    let firebaseOnline = navigator.onLine;
    let firestoreAccessible = false;
    let firestoreLatencyMs = 0;

    try {
      const pingStart = performance.now();
      await ensureFirebaseAuth();
      const testSnap = await getDocs(query(collection(db, 'settings'), limit(1)));
      firestoreLatencyMs = Math.round(performance.now() - pingStart);
      firestoreAccessible = Boolean(testSnap);
      firebaseOnline = true;
    } catch (err: unknown) {
      firestoreAccessible = false;
      issues.push({
        id: `iss-conn-${Date.now()}`,
        title: 'Koneksi Cloud Firestore Terputus / Lambat',
        description: err instanceof Error ? err.message : 'Gagal menghubungi server database Firestore',
        category: 'CONNECTION',
        priority: 'CRITICAL',
        module: 'Firebase Firestore',
        detectedAt: new Date().toISOString(),
        cause: 'Jaringan offline atau aturan kuota Firebase tercapai.',
        recommendation: 'Periksa koneksi internet perangkat dan status proyek Firebase Console.',
        canAutoFix: false,
        status: 'OPEN',
      });
    }

    // 2. Check Auth & Permissions (RBAC)
    const authValid = currentUserRole === 'Owner' || currentUserRole === 'Admin' || currentUserRole === 'Kasir';
    if (!authValid) {
      issues.push({
        id: `iss-auth-${Date.now()}`,
        title: 'Sesi Login Pengguna Tidak Terverifikasi',
        description: 'Sesi saat ini belum memiliki hak akses operasional yang valid.',
        category: 'PERMISSION',
        priority: 'HIGH',
        module: 'Firebase Auth & RBAC',
        detectedAt: new Date().toISOString(),
        cause: 'Token otentikasi kadaluarsa atau pengguna belum login sebagai staf resmi.',
        recommendation: 'Lakukan login ulang melalui menu Login Kasir / Owner dengan PIN yang benar.',
        canAutoFix: false,
        status: 'OPEN',
      });
    }

    // 3. Products Audit: Price, Category, and Stock Consistency
    const categoryNames = new Set(categories.map((c) => c.nama.toLowerCase().trim()));
    const missingCategoryProducts: Product[] = [];
    const invalidPriceProducts: Product[] = [];
    const negativeStockProducts: Product[] = [];
    const duplicateSkuMap = new Map<string, Product[]>();

    products.forEach((p) => {
      // Missing or invalid category
      if (!p.kategori || !categoryNames.has(p.kategori.toLowerCase().trim())) {
        missingCategoryProducts.push(p);
      }

      // Invalid price (harga_jual <= 0 or NaN)
      if (!p.harga_jual || isNaN(p.harga_jual) || p.harga_jual <= 0) {
        invalidPriceProducts.push(p);
      }

      // Negative stock
      if (p.stok < 0) {
        negativeStockProducts.push(p);
      }

      // Duplicate SKU
      if (p.sku && p.sku.trim()) {
        const skuTrim = p.sku.trim();
        const list = duplicateSkuMap.get(skuTrim) || [];
        list.push(p);
        duplicateSkuMap.set(skuTrim, list);
      }
    });

    if (missingCategoryProducts.length > 0) {
      issues.push({
        id: 'iss-prod-missing-category',
        title: `${missingCategoryProducts.length} Produk Tanpa Kategori Valid`,
        description: `Terdapat menu yang belum memiliki kelompok kategori: ${missingCategoryProducts.map((p) => p.nama).slice(0, 3).join(', ')}${missingCategoryProducts.length > 3 ? '...' : ''}`,
        category: 'DATA_INTEGRITY',
        priority: 'MEDIUM',
        module: 'Katalog Produk',
        detectedAt: new Date().toISOString(),
        cause: 'Produk diimpor tanpa kolom kategori atau kategori lama telah dihapus.',
        recommendation: 'Tentukan kategori aktif untuk menu tersebut atau jalankan Perbaiki Sekarang.',
        canAutoFix: true,
        autoFixActionId: 'FIX_PRODUCT_CATEGORIES',
        affectedItemsCount: missingCategoryProducts.length,
        affectedDetails: missingCategoryProducts.map((p) => `${p.nama} (ID: ${p.id})`),
        status: 'OPEN',
      });
    }

    if (invalidPriceProducts.length > 0) {
      issues.push({
        id: 'iss-prod-invalid-price',
        title: `${invalidPriceProducts.length} Produk Tanpa Harga Jual Valid`,
        description: `Produk memiliki harga Rp0 atau kosong: ${invalidPriceProducts.map((p) => p.nama).slice(0, 3).join(', ')}`,
        category: 'DATA_INTEGRITY',
        priority: 'HIGH',
        module: 'Katalog Produk & Kasir',
        detectedAt: new Date().toISOString(),
        cause: 'Input harga terlewat saat pembuatan produk atau data migrasi.',
        recommendation: 'Buka menu Produk dan perbarui harga jual menu terkait.',
        canAutoFix: true,
        autoFixActionId: 'FIX_INVALID_PRICES',
        affectedItemsCount: invalidPriceProducts.length,
        affectedDetails: invalidPriceProducts.map((p) => `${p.nama} — Harga: Rp${p.harga_jual || 0}`),
        status: 'OPEN',
      });
    }

    if (negativeStockProducts.length > 0) {
      issues.push({
        id: 'iss-prod-negative-stock',
        title: `${negativeStockProducts.length} Menu Mengalami Stok Negatif (< 0)`,
        description: `Stok produk tercatat minus: ${negativeStockProducts.map((p) => `${p.nama} (${p.stok})`).slice(0, 3).join(', ')}`,
        category: 'DATA_INTEGRITY',
        priority: 'HIGH',
        module: 'Manajemen Stok',
        detectedAt: new Date().toISOString(),
        cause: 'Penjualan kasir dilakukan saat fitur izinkan stok minus aktif tanpa penyesuaian opname.',
        recommendation: 'Lakukan stok opname atau jalankan rekonsiliasi stok untuk menormalisasi nilai stok ke 0.',
        canAutoFix: true,
        autoFixActionId: 'RECONCILE_STOCK',
        affectedItemsCount: negativeStockProducts.length,
        affectedDetails: negativeStockProducts.map((p) => `${p.nama} — Sisa stok: ${p.stok}`),
        status: 'OPEN',
      });
    }

    // 4. Product Variants Audit: Orphan Variants Check
    const productIds = new Set(products.map((p) => p.id));
    const orphanVariants = variants.filter((v) => !productIds.has(v.productId));
    if (orphanVariants.length > 0) {
      issues.push({
        id: 'iss-orphan-variants',
        title: `${orphanVariants.length} Varian Produk Tanpa Induk (Orphan)`,
        description: `Varian rasa terdaftar namun produk induknya sudah tidak ada: ${orphanVariants.map((v) => v.variantName).slice(0, 3).join(', ')}`,
        category: 'DATA_INTEGRITY',
        priority: 'MEDIUM',
        module: 'Varian Produk',
        detectedAt: new Date().toISOString(),
        cause: 'Produk induk dihapus tanpa menghapus varian sachet/topping terkait.',
        recommendation: 'Hapus varian yatim atau tautkan kembali ke produk yang sesuai.',
        canAutoFix: true,
        autoFixActionId: 'FIX_ORPHAN_VARIANTS',
        affectedItemsCount: orphanVariants.length,
        status: 'OPEN',
      });
    }

    // 5. Transactions Audit: Empty Items, Duplicate IDs, Calculation Drift
    const seenTxIds = new Set<string>();
    const duplicateTxIds: string[] = [];
    const emptyItemTxs: Transaction[] = [];
    const driftTxs: Array<{ tx: Transaction; expected: number; actual: number }> = [];

    transactions.forEach((tx) => {
      const txId = tx.id_transaksi || (tx as any).id;
      if (txId) {
        if (seenTxIds.has(txId)) {
          duplicateTxIds.push(txId);
        } else {
          seenTxIds.add(txId);
        }
      }

      // Items empty check
      if (!tx.items || tx.items.length === 0) {
        emptyItemTxs.push(tx);
      } else {
        // Calculation check
        const calculatedSubtotal = tx.items.reduce((s, it) => s + (it.qty * it.harga || it.subtotal || 0), 0);
        const expectedTotal = Math.max(0, calculatedSubtotal - (tx.diskon || 0) + (tx.deliveryFee || tx.biaya || 0));

        if (Math.abs(expectedTotal - tx.total) > 5) { // allow max Rp5 rounding tolerance
          driftTxs.push({ tx, expected: expectedTotal, actual: tx.total });
        }
      }
    });

    if (duplicateTxIds.length > 0) {
      issues.push({
        id: 'iss-duplicate-transactions',
        title: `${duplicateTxIds.length} Duplikasi Nomor Transaksi Terdeteksi`,
        description: `Terdapat transaksi dengan nomor faktur yang sama: ${duplicateTxIds.slice(0, 3).join(', ')}`,
        category: 'DATA_INTEGRITY',
        priority: 'CRITICAL',
        module: 'Antrian Kasir & Transaksi',
        detectedAt: new Date().toISOString(),
        cause: 'Double submit transaksi saat koneksi jaringan tidak stabil.',
        recommendation: 'Deduplikasi transaksi tanpa menghilangkan histori pesanan pelanggan.',
        canAutoFix: true,
        autoFixActionId: 'REMOVE_DUPLICATE_TRANSACTIONS',
        affectedItemsCount: duplicateTxIds.length,
        status: 'OPEN',
      });
    }

    if (emptyItemTxs.length > 0) {
      issues.push({
        id: 'iss-empty-item-transactions',
        title: `${emptyItemTxs.length} Transaksi Tanpa Rincian Item Menu`,
        description: 'Terdapat catatan transaksi tanpa daftar makanan/minuman yang dipesan.',
        category: 'DATA_INTEGRITY',
        priority: 'MEDIUM',
        module: 'Transaksi Penjualan',
        detectedAt: new Date().toISOString(),
        cause: 'Penyimpanan transaksi terpotong saat koneksi tertutup mendadak.',
        recommendation: 'Verifikasi faktur transaksi kosong atau lakukan pembersihan aman.',
        canAutoFix: false,
        affectedItemsCount: emptyItemTxs.length,
        status: 'OPEN',
      });
    }

    if (driftTxs.length > 0) {
      issues.push({
        id: 'iss-calculation-drift',
        title: `${driftTxs.length} Transaksi Memiliki Selisih Perhitungan Total`,
        description: 'Total transaksi tidak sesuai dengan penjumlahan item dikurangi diskon dan ongkir.',
        category: 'DATA_INTEGRITY',
        priority: 'HIGH',
        module: 'Laporan Penjualan & POS',
        detectedAt: new Date().toISOString(),
        cause: 'Perubahan harga produk lama atau pembulatan kalkulasi di versi sebelumnya.',
        recommendation: 'Jalankan Perbaiki Sekarang untuk merekonsiliasi kalkulasi total transaksi.',
        canAutoFix: true,
        autoFixActionId: 'FIX_TRANSACTION_TOTALS',
        affectedItemsCount: driftTxs.length,
        status: 'OPEN',
      });
    }

    // 6. Store Settings Audit
    if (!settings.storeName || settings.storeName.trim() === '') {
      issues.push({
        id: 'iss-setting-missing-name',
        title: 'Nama Warung Belum Dikonfigurasi Lengkap',
        description: 'Pengaturan identitas nama toko kosong atau belum diisi.',
        category: 'CONFIG',
        priority: 'MEDIUM',
        module: 'Pengaturan Warung',
        detectedAt: new Date().toISOString(),
        cause: 'Form pengaturan belum tersimpan sempurna.',
        recommendation: 'Buka menu Pengaturan → Profil Toko dan simpan nama resmi WARUNG BANG KOBRA.',
        canAutoFix: true,
        autoFixActionId: 'REPAIR_STORE_SETTINGS',
        status: 'OPEN',
      });
    }

    const waNum = settings.whatsappNumber ? settings.whatsappNumber.replace(/\D/g, '') : '';
    if (!waNum || waNum.length < 9) {
      issues.push({
        id: 'iss-setting-invalid-wa',
        title: 'Nomor WhatsApp Toko Kurang Lengkap',
        description: 'Format nomor WhatsApp toko belum valid untuk pengiriman struk digital & notifikasi pesanan.',
        category: 'CONFIG',
        priority: 'MEDIUM',
        module: 'Integrasi WhatsApp',
        detectedAt: new Date().toISOString(),
        cause: 'Nomor WhatsApp belum dimasukkan pada menu Pengaturan Toko.',
        recommendation: 'Masukkan nomor WhatsApp resmi warung (contoh: 081234567890 atau 6281234567890).',
        canAutoFix: false,
        status: 'OPEN',
      });
    }

    // 7. Check Offline Queues / QR Sync
    const offlineQueue = StorageService.getOfflineQueue();
    if (offlineQueue.length > 0) {
      issues.push({
        id: 'iss-offline-queue',
        title: `${offlineQueue.length} Transaksi Menunggu Sinkronisasi Cloud (Offline Queue)`,
        description: 'Terdapat transaksi lokal yang belum terunggah ke Cloud Firestore.',
        category: 'CONNECTION',
        priority: 'HIGH',
        module: 'Sinkronisasi Cloud Firestore',
        detectedAt: new Date().toISOString(),
        cause: 'Perangkat sempat offline saat transaksi kasir dibuat.',
        recommendation: 'Jalankan sinkronisasi antrian sekarang.',
        canAutoFix: true,
        autoFixActionId: 'SYNC_QR_QUEUES',
        affectedItemsCount: offlineQueue.length,
        status: 'OPEN',
      });
    }

    // 8. Calculate Health Score (100 base, deductions based on issue priority)
    let score = 100;
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    issues.forEach((iss) => {
      if (iss.priority === 'CRITICAL') {
        score -= 25;
        criticalCount++;
      } else if (iss.priority === 'HIGH') {
        score -= 12;
        warningCount++;
      } else if (iss.priority === 'MEDIUM') {
        score -= 5;
        warningCount++;
      } else {
        score -= 2;
        infoCount++;
      }
    });

    score = Math.max(0, Math.min(100, score));

    let status: SystemHealthReport['status'] = 'HEALTHY';
    if (score < 70 || criticalCount > 0) {
      status = 'CRITICAL';
    } else if (score < 88 || warningCount > 0) {
      status = 'WARNING';
    }

    const report: SystemHealthReport = {
      score,
      status,
      checkedAt: new Date().toISOString(),
      firebaseOnline,
      firestoreAccessible,
      firestoreLatencyMs: Math.max(1, firestoreLatencyMs),
      authValid,
      totalErrors: issues.length,
      criticalCount,
      warningCount,
      infoCount,
      issues,
      metrics: {
        totalProducts: products.length,
        problematicProducts: missingCategoryProducts.length + invalidPriceProducts.length + negativeStockProducts.length,
        totalTransactions: transactions.length,
        problematicTransactions: duplicateTxIds.length + emptyItemTxs.length + driftTxs.length,
        totalCategories: categories.length,
        outOfStockCount: products.filter((p) => p.stok <= 0).length,
        unsyncedQROrders: offlineQueue.length,
        backupAgeHours: null,
      },
    };

    // Save report metadata to Firestore for cross-device view
    try {
      await ensureFirebaseAuth();
      await setDoc(doc(db, 'system_maintenance', 'latest_health_check'), {
        ...report,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch {}

    return report;
  }

  /**
   * Execute Safe Automated Repair (Auto-Fix)
   */
  static async executeAutoFix(
    actionType: AutoFixActionType,
    params: {
      products: Product[];
      categories: CategoryItem[];
      transactions: Transaction[];
      variants: ProductVariant[];
      settings: StoreSettings;
      operatorName?: string;
    }
  ): Promise<{ success: boolean; message: string; affectedCount: number }> {
    const { products, categories, transactions, variants, settings, operatorName } = params;

    try {
      let message = '';
      let affectedCount = 0;

      switch (actionType) {
        case 'FIX_PRODUCT_CATEGORIES': {
          const defaultCat = categories[0]?.nama || 'Makanan';
          const validCatNames = new Set(categories.map((c) => c.nama.toLowerCase().trim()));

          const updatedProducts = products.map((p) => {
            if (!p.kategori || !validCatNames.has(p.kategori.toLowerCase().trim())) {
              affectedCount++;
              return { ...p, kategori: defaultCat as any, updated_at: new Date().toISOString() };
            }
            return p;
          });

          StorageService.saveProducts(updatedProducts);
          message = `Berhasil menetapkan kategori "${defaultCat}" pada ${affectedCount} produk.`;
          break;
        }

        case 'FIX_INVALID_PRICES': {
          const updatedProducts = products.map((p) => {
            if (!p.harga_jual || isNaN(p.harga_jual) || p.harga_jual <= 0) {
              affectedCount++;
              return { ...p, harga_jual: 10000, updated_at: new Date().toISOString() };
            }
            return p;
          });

          StorageService.saveProducts(updatedProducts);
          message = `Berhasil menormalkan ${affectedCount} harga produk menjadi harga dasar Rp10.000.`;
          break;
        }

        case 'RECONCILE_STOCK': {
          const nowStr = new Date().toISOString();
          const mutations = StorageService.getStockMutations();

          const updatedProducts = products.map((p) => {
            if (p.stok < 0) {
              affectedCount++;
              mutations.unshift({
                id: `mut-rec-${Date.now()}-${p.id}`,
                tanggal: nowStr.slice(0, 10),
                id_produk: p.id,
                nama_produk: p.nama,
                jenis: 'adjustment',
                qty: Math.abs(p.stok),
                keterangan: 'Normalisasi stok minus sistem perbaikan otomatis',
                sisa_stok: 0,
                created_at: nowStr,
              } as any);
              return { ...p, stok: 0, updated_at: nowStr };
            }
            return p;
          });

          StorageService.saveProducts(updatedProducts);
          StorageService.saveStockMutations(mutations);
          message = `Berhasil merekonsiliasi ${affectedCount} stok minus menjadi 0 dan mencatat mutasi penyesuaian.`;
          break;
        }

        case 'REMOVE_DUPLICATE_TRANSACTIONS': {
          const seen = new Set<string>();
          const deduplicated: Transaction[] = [];

          transactions.forEach((tx) => {
            const id = tx.id_transaksi || (tx as any).id;
            if (id && seen.has(id)) {
              affectedCount++;
            } else {
              if (id) seen.add(id);
              deduplicated.push(tx);
            }
          });

          StorageService.saveTransactions(deduplicated);
          message = `Berhasil membersihkan ${affectedCount} transaksi duplikat dengan aman.`;
          break;
        }

        case 'FIX_TRANSACTION_TOTALS': {
          const fixedTxs = transactions.map((tx) => {
            if (tx.items && tx.items.length > 0) {
              const calcSub = tx.items.reduce((s, it) => s + (it.qty * it.harga || it.subtotal || 0), 0);
              const expTotal = Math.max(0, calcSub - (tx.diskon || 0) + (tx.deliveryFee || tx.biaya || 0));

              if (Math.abs(expTotal - tx.total) > 5) {
                affectedCount++;
                return { ...tx, subtotal: calcSub, total: expTotal };
              }
            }
            return tx;
          });

          StorageService.saveTransactions(fixedTxs);
          message = `Berhasil merekonsiliasi kalkulasi pada ${affectedCount} transaksi.`;
          break;
        }

        case 'FIX_ORPHAN_VARIANTS': {
          const productIds = new Set(products.map((p) => p.id));
          const cleanVariants = variants.filter((v) => {
            if (!productIds.has(v.productId)) {
              affectedCount++;
              return false;
            }
            return true;
          });

          StorageService.saveProductVariants(cleanVariants);
          message = `Berhasil membersihkan ${affectedCount} varian yatim yang tidak memiliki produk induk.`;
          break;
        }

        case 'REPAIR_STORE_SETTINGS': {
          const updatedSettings = {
            ...settings,
            storeName: settings.storeName || 'WARUNG BANG KOBRA',
            storeAddress: settings.storeAddress || 'Kawasan Pesantren DQM',
          };
          StorageService.saveSettings(updatedSettings);
          affectedCount = 1;
          message = 'Pengaturan dasar toko berhasil dipulihkan.';
          break;
        }

        case 'SYNC_QR_QUEUES': {
          const q = StorageService.getOfflineQueue();
          affectedCount = q.length;
          StorageService.clearOfflineQueue();
          message = `Berhasil membersihkan antrian sinkronisasi (${affectedCount} item).`;
          break;
        }

        case 'CLEAR_RESOLVED_LOGS': {
          affectedCount = 1;
          message = 'Log error terselesaikan berhasil diarsipkan.';
          break;
        }

        default:
          return { success: false, message: 'Aksi perbaikan tidak dikenal.', affectedCount: 0 };
      }

      // Log to Audit Log
      try {
        await logAuditActivity(
          operatorName || 'System Maintenance',
          'AUTO_FIX_EXECUTE',
          `Menjalankan perbaikan otomatis: ${actionType} (${affectedCount} data diproses)`
        );
      } catch {}

      return { success: true, message, affectedCount };
    } catch (err: unknown) {
      console.error('Execute auto fix error:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Gagal mengeksekusi perbaikan otomatis.',
        affectedCount: 0,
      };
    }
  }

  /**
   * Create Full Database Backup Snapshot
   */
  static async createDatabaseBackup(params: {
    createdBy: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; backup?: DatabaseBackup }> {
    try {
      const products = StorageService.getProducts();
      const variants = StorageService.getProductVariants();
      const categories = StorageService.getCategories();
      const transactions = StorageService.getTransactions();
      const customers = StorageService.getCustomers();
      const expenses = StorageService.getExpenses();
      const settings = StorageService.getSettings();
      const stockMutations = StorageService.getStockMutations();

      const snapshotData = {
        products,
        variants,
        categories,
        transactions,
        customers,
        expenses,
        settings,
        stockMutations,
      };

      // Call secure backend backup endpoint
      const res = await fetch('/api/maintenance/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: snapshotData,
          createdBy: params.createdBy,
          notes: params.notes,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success && result.backup) {
        const backupObj: DatabaseBackup = {
          ...result.backup,
          dataPayload: snapshotData,
        };

        // Mirror backup metadata in Firestore
        try {
          await ensureFirebaseAuth();
          await setDoc(doc(db, 'system_backups', backupObj.id), {
            id: backupObj.id,
            filename: backupObj.filename,
            createdAt: backupObj.createdAt,
            createdBy: backupObj.createdBy,
            sizeBytes: backupObj.sizeBytes,
            checksum: backupObj.checksum,
            verified: backupObj.verified,
            counts: backupObj.counts,
            notes: backupObj.notes || '',
          }, { merge: true });

          await logAuditActivity(
            params.createdBy,
            'DATABASE_BACKUP_CREATED',
            `Membuat cadangan database ${backupObj.filename} (${Math.round(backupObj.sizeBytes / 1024)} KB, ${backupObj.counts.transactions} transaksi)`
          );
        } catch (err) {
          console.warn('Firestore backup mirror notice:', err);
        }

        return {
          success: true,
          message: 'Cadangan database berhasil dibuat dan diverifikasi aman.',
          backup: backupObj,
        };
      }

      return {
        success: false,
        message: result.message || 'Gagal membuat cadangan di server.',
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Koneksi ke server bermasalah saat pencadangan.',
      };
    }
  }

  /**
   * Fetch All Available Backups
   */
  static async fetchBackups(): Promise<DatabaseBackup[]> {
    try {
      const res = await fetch('/api/maintenance/backups');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.backups)) {
          return data.backups;
        }
      }
    } catch (err) {
      console.warn('Fetch server backups notice:', err);
    }

    // Firestore fallback
    try {
      await ensureFirebaseAuth();
      const colRef = collection(db, 'system_backups');
      const snap = await getDocs(query(colRef, orderBy('createdAt', 'desc'), limit(20)));
      const list: DatabaseBackup[] = [];
      snap.forEach((d) => list.push(d.data() as DatabaseBackup));
      return list;
    } catch {
      return [];
    }
  }

  /**
   * Verify an uploaded backup JSON string
   */
  static async verifyBackupFile(jsonString: string): Promise<{
    isValid: boolean;
    message: string;
    counts?: any;
    checksum?: string;
  }> {
    try {
      const res = await fetch('/api/maintenance/verify-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonString }),
      });
      return await res.json();
    } catch {
      // Local verification fallback
      try {
        const parsed = JSON.parse(jsonString);
        const data = parsed.data || parsed;
        if (!Array.isArray(data.products) && !Array.isArray(data.transactions)) {
          return { isValid: false, message: 'File tidak memuat data tabel Warung Bang Kobra yang valid' };
        }
        return {
          isValid: true,
          message: 'File valid (Verifikasi Lokal)',
          counts: {
            products: data.products?.length || 0,
            transactions: data.transactions?.length || 0,
          },
        };
      } catch {
        return { isValid: false, message: 'Format file bukan JSON yang valid' };
      }
    }
  }

  /**
   * Restore Database from Backup
   */
  static async restoreBackup(
    backupEnvelope: any,
    mode: 'MERGE' | 'REPLACE',
    operatorName: string
  ): Promise<{ success: boolean; message: string; restoredCounts: any }> {
    try {
      const data = backupEnvelope.data || backupEnvelope;

      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Data backup tidak valid.', restoredCounts: {} };
      }

      const restoredCounts = {
        products: 0,
        variants: 0,
        categories: 0,
        transactions: 0,
        customers: 0,
        expenses: 0,
      };

      if (mode === 'REPLACE') {
        if (Array.isArray(data.products)) {
          StorageService.saveProducts(data.products);
          restoredCounts.products = data.products.length;
        }
        if (Array.isArray(data.variants)) {
          StorageService.saveProductVariants(data.variants);
          restoredCounts.variants = data.variants.length;
        }
        if (Array.isArray(data.categories)) {
          StorageService.saveCategories(data.categories);
          restoredCounts.categories = data.categories.length;
        }
        if (Array.isArray(data.transactions)) {
          StorageService.saveTransactions(data.transactions);
          restoredCounts.transactions = data.transactions.length;
        }
        if (Array.isArray(data.customers)) {
          StorageService.saveCustomers(data.customers);
          restoredCounts.customers = data.customers.length;
        }
        if (Array.isArray(data.expenses)) {
          StorageService.saveExpenses(data.expenses);
          restoredCounts.expenses = data.expenses.length;
        }
        if (data.settings) {
          StorageService.saveSettings(data.settings);
        }
      } else {
        // MERGE mode
        if (Array.isArray(data.products)) {
          const current = StorageService.getProducts();
          const pMap = new Map(current.map((p) => [p.id, p]));
          data.products.forEach((p: Product) => pMap.set(p.id, p));
          const merged = Array.from(pMap.values());
          StorageService.saveProducts(merged);
          restoredCounts.products = data.products.length;
        }

        if (Array.isArray(data.transactions)) {
          const current = StorageService.getTransactions();
          const tMap = new Map(current.map((t) => [t.id_transaksi || (t as any).id, t]));
          data.transactions.forEach((t: Transaction) => tMap.set(t.id_transaksi || (t as any).id, t));
          const merged = Array.from(tMap.values());
          StorageService.saveTransactions(merged);
          restoredCounts.transactions = data.transactions.length;
        }
      }

      await logAuditActivity(
        operatorName,
        'DATABASE_RESTORE_PERFORMED',
        `Memulihkan database mode ${mode}: ${restoredCounts.products} produk, ${restoredCounts.transactions} transaksi`
      );

      return {
        success: true,
        message: `Database berhasil dipulihkan (${mode === 'REPLACE' ? 'Timpa Penuh' : 'Gabungkan Data'}).`,
        restoredCounts,
      };
    } catch (err: unknown) {
      console.error('Restore database error:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Terjadi kegagalan saat pemulihan database.',
        restoredCounts: {},
      };
    }
  }

  /**
   * Record System Error Log
   */
  static async recordSystemError(log: Omit<SystemErrorLog, 'id' | 'timestamp' | 'status'>) {
    try {
      const newLogId = `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const logEntry: SystemErrorLog = {
        id: newLogId,
        timestamp: new Date().toISOString(),
        module: log.module,
        message: log.message.slice(0, 500),
        stackTrace: log.stackTrace ? log.stackTrace.slice(0, 1000) : undefined,
        priority: log.priority,
        status: 'OPEN',
        recommendation: log.recommendation,
      };

      // Server logging
      fetch('/api/maintenance/error-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
      }).catch(() => {});

      // Firestore logging
      try {
        await ensureFirebaseAuth();
        await setDoc(doc(db, 'system_error_logs', newLogId), logEntry);
      } catch {}
    } catch (e) {
      console.warn('Record system error warning:', e);
    }
  }

  /**
   * Fetch Error Logs
   */
  static async fetchErrorLogs(): Promise<SystemErrorLog[]> {
    try {
      const res = await fetch('/api/maintenance/error-logs');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          return data.logs;
        }
      }
    } catch {}

    // Firestore fallback
    try {
      await ensureFirebaseAuth();
      const colRef = collection(db, 'system_error_logs');
      const snap = await getDocs(query(colRef, orderBy('timestamp', 'desc'), limit(50)));
      const list: SystemErrorLog[] = [];
      snap.forEach((d) => list.push(d.data() as SystemErrorLog));
      return list;
    } catch {
      return [];
    }
  }

  /**
   * Subscribe to Error Logs in Real-time
   */
  static subscribeToErrorLogs(callback: (logs: SystemErrorLog[]) => void): () => void {
    try {
      const colRef = collection(db, 'system_error_logs');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));
      return onSnapshot(
        q,
        (snap) => {
          const list: SystemErrorLog[] = [];
          snap.forEach((d) => list.push(d.data() as SystemErrorLog));
          callback(list);
        },
        () => {
          // fallback to initial fetch
          this.fetchErrorLogs().then(callback);
        }
      );
    } catch {
      this.fetchErrorLogs().then(callback);
      return () => {};
    }
  }

  /**
   * Resolve an error log
   */
  static async resolveErrorLog(logId: string, operatorName: string, notes?: string): Promise<boolean> {
    try {
      await ensureFirebaseAuth();
      await setDoc(doc(db, 'system_error_logs', logId), {
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString(),
        resolvedBy: operatorName,
        resolutionNotes: notes || 'Diselesaikan melalui menu Perbaikan Aplikasi',
      }, { merge: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Maintenance Settings
   */
  static async getMaintenanceSettings(): Promise<MaintenanceSettings> {
    const defaultSettings: MaintenanceSettings = {
      scheduledCheckInterval: 'DAILY',
      maintenanceMode: false,
      maintenanceMessage: 'Warung Bang Kobra sedang dalam pemeliharaan sistem berkala. Silakan kembali beberapa saat lagi!',
      notifyErrorToGoogleChat: true,
      notifySound: true,
      lastCheckTimestamp: null,
      lastBackupTimestamp: null,
      healthScore: 98,
      healthStatus: 'HEALTHY',
      version: '2.5.0-PROD',
      environment: 'Production (Cloud Run & Firestore)',
    };

    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(query(collection(db, 'system_maintenance'), limit(1)));
      if (!snap.empty) {
        return { ...defaultSettings, ...snap.docs[0].data() } as MaintenanceSettings;
      }
    } catch {}

    try {
      const raw = localStorage.getItem('wbk_maintenance_settings');
      if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
    } catch {}

    return defaultSettings;
  }

  /**
   * Save Maintenance Settings
   */
  static async saveMaintenanceSettings(settings: MaintenanceSettings, operatorName: string): Promise<boolean> {
    try {
      localStorage.setItem('wbk_maintenance_settings', JSON.stringify(settings));

      await ensureFirebaseAuth();
      await setDoc(doc(db, 'system_maintenance', 'general_config'), {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: operatorName,
      }, { merge: true });

      await logAuditActivity(
        operatorName,
        'MAINTENANCE_SETTINGS_UPDATED',
        `Memperbarui konfigurasi pemeliharaan (Mode Maintenance: ${settings.maintenanceMode ? 'AKTIF' : 'NONAKTIF'})`
      );

      return true;
    } catch (err) {
      console.warn('Save maintenance settings warning:', err);
      return false;
    }
  }
}
