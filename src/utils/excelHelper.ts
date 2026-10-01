import * as XLSX from 'xlsx';
import { Product, ProductVariant, ProductCategory, Transaction, Expense, Customer } from '../types';
import { resolveOrderType, formatDeliveryLocationSummary } from './formatters';

/**
 * Helper to download Blob as file
 */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * 1. EXPORT PRODUK / MENU KE EXCEL (.xlsx)
 */
export function exportProductsToExcel(products: Product[], filename?: string) {
  const data = products.map((p) => ({
    'SKU': p.sku || '',
    'Nama Menu': p.nama,
    'Kategori': p.kategori,
    'Harga Modal (Rp)': p.harga_modal,
    'Harga Jual (Rp)': p.harga_jual,
    'Satuan': p.satuan || 'Porsi',
    'Stok Saat Ini': p.stok,
    'Stok Minimum': p.stok_minimum,
    'Aktif': p.status,
    'Deskripsi': p.deskripsi || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Auto-fit column widths
  worksheet['!cols'] = [
    { wch: 14 }, // SKU
    { wch: 28 }, // Nama Menu
    { wch: 15 }, // Kategori
    { wch: 16 }, // Harga Modal (Rp)
    { wch: 16 }, // Harga Jual (Rp)
    { wch: 14 }, // Satuan
    { wch: 14 }, // Stok Saat Ini
    { wch: 14 }, // Stok Minimum
    { wch: 10 }, // Aktif
    { wch: 45 }, // Deskripsi
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Menu');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  const name = filename || `Menu_WarungBangKobra_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBlob(blob, name);
}

/**
 * 2. EXPORT TEMPLATE EXCEL PRODUK KOSONG UNTUK IMPORT
 */
export function downloadProductExcelTemplate() {
  const templateData = [
    {
      'SKU': 'SKU-001',
      'Nama Menu': 'Jus Mangga',
      'Kategori': 'Minuman',
      'Harga Modal (Rp)': 6000,
      'Harga Jual (Rp)': 10000,
      'Satuan': 'Cup',
      'Stok Saat Ini': 50,
      'Stok Minimum': 5,
      'Aktif': 'Aktif',
      'Deskripsi': 'Jus mangga segar dengan rasa manis dan aroma buah mangga.',
    },
    {
      'SKU': 'SKU-002',
      'Nama Menu': 'Jus Alpukat',
      'Kategori': 'Minuman',
      'Harga Modal (Rp)': 6000,
      'Harga Jual (Rp)': 10000,
      'Satuan': 'Cup',
      'Stok Saat Ini': 50,
      'Stok Minimum': 5,
      'Aktif': 'Aktif',
      'Deskripsi': 'Jus alpukat creamy dan segar untuk teman santai.',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 45 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Menu');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  downloadBlob(blob, 'Template_Import_Menu_WarungBangKobra.xlsx');
}

/**
 * 3. PARSE / IMPORT FILE EXCEL (.xlsx, .xls) MENJADI DAFTAR PRODUK
 */
export async function parseProductsFromExcel(file: File): Promise<{
  products: Product[];
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          return resolve({ products: [], errors: ['File Excel tidak memiliki sheet'] });
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawRows.length === 0) {
          return resolve({ products: [], errors: ['Sheet Excel kosong, tidak ada data ditemukan'] });
        }

        const validCategories: ProductCategory[] = ['Makanan', 'Minuman', 'Snack', 'Tambahan', 'Lainnya'];
        const parsedProducts: Product[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, idx) => {
          const rowNum = idx + 2; // Header is row 1

          // Support Indonesian and standard column variations
          const nama = (row['Nama Menu'] || row['Nama'] || row['nama'] || row['Nama Produk'] || '').toString().trim();
          if (!nama) {
            errors.push(`Baris ${rowNum}: Nama menu kosong, dilewati.`);
            return;
          }

          const rawKategori = (row['Kategori'] || row['kategori'] || 'Lainnya').toString().trim();
          const matchedCategory = validCategories.find(
            (c) => c.toLowerCase() === rawKategori.toLowerCase()
          ) || 'Lainnya';

          const sku = (row['SKU'] || row['sku'] || `SKU-${Date.now().toString().slice(-4)}${idx}`).toString().trim();
          const hargaModal = Number(row['Harga Modal (Rp)'] ?? row['Harga Modal'] ?? row['harga_modal'] ?? 0) || 0;
          const hargaJual = Number(row['Harga Jual (Rp)'] ?? row['Harga Jual'] ?? row['harga_jual'] ?? 0) || 0;
          const satuan = (row['Satuan'] || row['satuan'] || 'Porsi').toString().trim();
          const stok = Number(row['Stok Saat Ini'] ?? row['Stok'] ?? row['stok'] ?? 50) || 0;
          const stokMin = Number(row['Stok Minimum'] ?? row['stok_minimum'] ?? 5) || 5;
          const rawStatus = (row['Aktif'] || row['Status'] || row['status'] || 'Aktif').toString().trim();
          const status = rawStatus.toLowerCase().includes('non') ? 'Nonaktif' : 'Aktif';
          const deskripsi = (row['Deskripsi'] || row['deskripsi'] || '').toString().trim();

          const now = new Date().toISOString();
          parsedProducts.push({
            id: sku || 'PRD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            sku,
            nama,
            kategori: matchedCategory,
            harga_modal: hargaModal,
            harga_jual: hargaJual,
            satuan,
            stok,
            stok_minimum: stokMin,
            foto: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
            status,
            deskripsi,
            created_at: now,
            updated_at: now,
          });
        });

        resolve({ products: parsedProducts, errors });
      } catch (err: any) {
        reject(new Error(err?.message || 'Gagal memproses file Excel'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file dari disk'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * 4. EXPORT LAPORAN PENJUALAN & TRANSAKSI KE EXCEL MULTI-SHEET
 */
export function exportTransactionsToExcel(
  transactions: Transaction[],
  expenses: Expense[] = [],
  filename?: string
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Ringkasan Transaksi
  const txSummaryData = transactions.map((tx, idx) => ({
    'No': idx + 1,
    'No. Invoice': tx.id_transaksi,
    'Tanggal': tx.tanggal,
    'Jam': tx.jam,
    'Kasir': tx.kasir,
    'Nama Pelanggan': tx.nama_pelanggan || '-',
    'No. WhatsApp': tx.no_whatsapp || '-',
    'Jenis Pesanan': resolveOrderType(tx) === 'DELIVERY_DQM' ? 'DELIVERY DQM' : 'BUNGKUS',
    'Lokasi Pengantaran': formatDeliveryLocationSummary(tx),
    'Metode Pembayaran': tx.metode_pembayaran,
    'Subtotal (Rp)': tx.subtotal,
    'Diskon (Rp)': tx.diskon,
    'Biaya Tambahan (Rp)': tx.biaya,
    'Total Akhir (Rp)': tx.total,
    'Uang Diterima (Rp)': tx.uang_diterima,
    'Kembalian (Rp)': tx.kembalian,
    'Status': tx.status,
  }));
  const txSheet = XLSX.utils.json_to_sheet(txSummaryData);
  txSheet['!cols'] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 15 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, txSheet, 'Riwayat Transaksi');

  // Sheet 2: Rincian Menu Terjual (Detail Item)
  const itemDetails: any[] = [];
  transactions.forEach((tx) => {
    (tx.items || []).forEach((item) => {
      itemDetails.push({
        'No. Invoice': tx.id_transaksi,
        'Tanggal': tx.tanggal,
        'Waktu': tx.jam,
        'Nama Menu': item.nama_produk,
        'Harga Satuan (Rp)': item.harga,
        'Jumlah (Qty)': item.qty,
        'Subtotal (Rp)': item.subtotal,
        'Catatan': item.catatan || '-',
      });
    });
  });
  const itemsSheet = XLSX.utils.json_to_sheet(itemDetails);
  itemsSheet['!cols'] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 25 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Rincian Menu Terjual');

  // Sheet 3: Pengeluaran (Bila ada)
  if (expenses.length > 0) {
    const expenseData = expenses.map((ex, idx) => ({
      'No': idx + 1,
      'Tanggal': ex.tanggal,
      'Kategori': ex.kategori,
      'Keterangan': ex.keterangan,
      'Jumlah (Rp)': ex.jumlah,
      'Dicatat Oleh': ex.diinput_oleh || 'Kasir',
      'Catatan': ex.catatan || '-',
    }));
    const expSheet = XLSX.utils.json_to_sheet(expenseData);
    expSheet['!cols'] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 18 },
      { wch: 30 },
      { wch: 16 },
      { wch: 15 },
      { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(workbook, expSheet, 'Pengeluaran');
  }

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  const name = filename || `Laporan_Penjualan_WarungBangKobra_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBlob(blob, name);
}

/**
 * 5. EXPORT DAFTAR PELANGGAN KE EXCEL
 */
export function exportCustomersToExcel(customers: Customer[], filename?: string) {
  const data = customers.map((c, idx) => ({
    'No': idx + 1,
    'Nama Pelanggan': c.nama,
    'No. WhatsApp': c.whatsapp || c.no_whatsapp || '-',
    'Alamat': c.alamat || '-',
    'Total Transaksi (Kunjungan)': c.total_transaksi || 0,
    'Total Belanja (Rp)': c.total_belanja || 0,
    'Kunjungan Terakhir': c.last_order || '-',
    'Catatan Khusus': c.catatan || '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 16 },
    { wch: 30 },
    { wch: 25 },
    { wch: 18 },
    { wch: 18 },
    { wch: 25 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pelanggan');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  const name = filename || `Pelanggan_WarungBangKobra_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBlob(blob, name);
}

/**
 * 6. TEMPLATE & EXPORT/IMPORT EXCEL KHUSUS PRODUK & VARIAN RASA (Bagian 9)
 * Kolom wajib:
 * Nama Produk | Kategori | Nama Varian | SKU | Harga Modal | Harga Jual | Stok | Stok Minimum | Status
 */
export function downloadProductVariantsExcelTemplate() {
  const templateData = [
    {
      'Nama Produk': 'INDOMIE',
      'Kategori': 'Makanan',
      'Nama Varian': 'Indomie Aceh',
      'SKU': 'SKU-IND-01',
      'Harga Modal': 4500,
      'Harga Jual': 6000,
      'Stok': 20,
      'Stok Minimum': 5,
      'Status': 'Aktif',
    },
    {
      'Nama Produk': 'INDOMIE',
      'Kategori': 'Makanan',
      'Nama Varian': 'Indomie Rendang',
      'SKU': 'SKU-IND-02',
      'Harga Modal': 4500,
      'Harga Jual': 6000,
      'Stok': 20,
      'Stok Minimum': 5,
      'Status': 'Aktif',
    },
    {
      'Nama Produk': 'INDOMIE',
      'Kategori': 'Makanan',
      'Nama Varian': 'Indomie Goreng',
      'SKU': 'SKU-IND-03',
      'Harga Modal': 4500,
      'Harga Jual': 6000,
      'Stok': 20,
      'Stok Minimum': 5,
      'Status': 'Aktif',
    },
    {
      'Nama Produk': 'INDOMIE',
      'Kategori': 'Makanan',
      'Nama Varian': 'Indomie Geprek',
      'SKU': 'SKU-IND-04',
      'Harga Modal': 4500,
      'Harga Jual': 6000,
      'Stok': 20,
      'Stok Minimum': 5,
      'Status': 'Aktif',
    },
    {
      'Nama Produk': 'INDOMIE',
      'Kategori': 'Makanan',
      'Nama Varian': 'Indomie Ayam Bawang',
      'SKU': 'SKU-IND-05',
      'Harga Modal': 5000,
      'Harga Jual': 7000,
      'Stok': 20,
      'Stok Minimum': 5,
      'Status': 'Aktif',
    },
    {
      'Nama Produk': 'INDOMIE',
      'Kategori': 'Makanan',
      'Nama Varian': 'Indomie Soto',
      'SKU': 'SKU-IND-06',
      'Harga Modal': 5000,
      'Harga Jual': 7000,
      'Stok': 20,
      'Stok Minimum': 5,
      'Status': 'Aktif',
    },
    {
      'Nama Produk': 'Nutrisari',
      'Kategori': 'Minuman',
      'Nama Varian': 'Jeruk Peras',
      'SKU': 'SKU-NUT-01',
      'Harga Modal': 3000,
      'Harga Jual': 5000,
      'Stok': 20,
      'Stok Minimum': 5,
      'Status': 'Aktif',
    },
    {
      'Nama Produk': 'Pop Ice',
      'Kategori': 'Minuman',
      'Nama Varian': 'Cokelat',
      'SKU': 'SKU-POP-01',
      'Harga Modal': 3000,
      'Harga Jual': 5000,
      'Stok': 25,
      'Stok Minimum': 5,
      'Status': 'Aktif',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 15 },
    { wch: 22 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Produk Varian');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  downloadBlob(blob, 'Template_Produk_Varian_WarungBangKobra.xlsx');
}

export function exportProductsAndVariantsToExcel(
  products: Product[],
  variants: ProductVariant[],
  filename?: string
) {
  const rows: any[] = [];

  products.forEach((p) => {
    const prodVars = variants.filter((v) => v.productId === p.id);
    if (prodVars.length > 0) {
      prodVars.forEach((v) => {
        rows.push({
          'Nama Produk': p.nama,
          'Kategori': p.kategori,
          'Nama Varian': v.variantName,
          'SKU': v.sku || v.variantId,
          'Harga Modal': v.costPrice,
          'Harga Jual': v.price,
          'Stok': v.stock,
          'Stok Minimum': v.minStock,
          'Status': v.isActive ? 'Aktif' : 'Nonaktif',
        });
      });
    } else {
      rows.push({
        'Nama Produk': p.nama,
        'Kategori': p.kategori,
        'Nama Varian': '-',
        'SKU': p.sku || p.id,
        'Harga Modal': p.harga_modal,
        'Harga Jual': p.harga_jual,
        'Stok': p.stok,
        'Stok Minimum': p.stok_minimum,
        'Status': p.status,
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 22 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produk & Varian');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  const name =
    filename || `Katalog_Produk_Varian_WarungBangKobra_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBlob(blob, name);
}

export interface VariantImportPreviewRow {
  rowNum: number;
  productName: string;
  category: ProductCategory;
  variantName: string;
  sku: string;
  costPrice: number;
  price: number;
  stock: number;
  minStock: number;
  status: 'Aktif' | 'Nonaktif';
  isValid: boolean;
  isDuplicate: boolean;
  errorReason?: string;
}

export interface VariantImportPreviewResult {
  rows: VariantImportPreviewRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  uniqueProductNames: string[];
}

export async function parseProductVariantsPreviewFromExcel(
  file: File,
  existingProducts: Product[],
  existingVariants: ProductVariant[]
): Promise<VariantImportPreviewResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          return resolve({
            rows: [],
            validCount: 0,
            invalidCount: 0,
            duplicateCount: 0,
            uniqueProductNames: [],
          });
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const validCategories: ProductCategory[] = [
          'Makanan',
          'Minuman',
          'Snack',
          'Tambahan',
          'Lainnya',
        ];
        const seenKeysInFile = new Set<string>();
        const seenSkusInFile = new Set<string>();
        const existingKeys = new Set(
          existingVariants.map(
            (v) =>
              `${(v.productName || '').toLowerCase()}::${v.variantName.toLowerCase()}`
          )
        );

        const rows: VariantImportPreviewRow[] = [];
        const prodNameSet = new Set<string>();

        rawRows.forEach((raw, idx) => {
          const rowNum = idx + 2;
          const productName = String(
            raw['Nama Produk'] || raw['Nama Menu'] || raw['Produk'] || ''
          ).trim();
          const rawCat = String(raw['Kategori'] || 'Minuman').trim();
          const category =
            validCategories.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ||
            'Minuman';
          const variantName = String(
            raw['Nama Varian'] || raw['Varian Rasa'] || raw['Varian'] || ''
          ).trim();
          const sku = String(
            raw['SKU'] || raw['sku'] || `SKU-VAR-${rowNum}`
          ).trim();
          const costPrice = Number(
            raw['Harga Modal'] ?? raw['Harga Modal (Rp)'] ?? 0
          );
          const price = Number(
            raw['Harga Jual'] ?? raw['Harga Jual (Rp)'] ?? 0
          );
          const stock = Number(raw['Stok'] ?? raw['Stok Saat Ini'] ?? 0);
          const minStock = Number(raw['Stok Minimum'] ?? 5);
          const rawStatus = String(raw['Status'] || raw['Aktif'] || 'Aktif').trim();
          const status: 'Aktif' | 'Nonaktif' = rawStatus
            .toLowerCase()
            .includes('non')
            ? 'Nonaktif'
            : 'Aktif';

          const errors: string[] = [];
          if (!productName) errors.push('Nama Produk wajib diisi');
          if (!variantName || variantName === '-') errors.push('Nama Varian wajib diisi');
          if (Number.isNaN(price) || price <= 0) errors.push('Harga Jual harus > 0');
          if (Number.isNaN(costPrice) || costPrice < 0)
            errors.push('Harga Modal tidak valid');
          if (Number.isNaN(stock) || stock < 0) errors.push('Stok tidak boleh negatif');

          const comboKey = `${productName.toLowerCase()}::${variantName.toLowerCase()}`;
          let isDuplicate = false;
          if (seenKeysInFile.has(comboKey) || (sku && seenSkusInFile.has(sku.toLowerCase()))) {
            isDuplicate = true;
            errors.push('Duplikat baris pada file Excel');
          } else if (existingKeys.has(comboKey)) {
            isDuplicate = true;
          }

          if (productName && variantName) {
            seenKeysInFile.add(comboKey);
            prodNameSet.add(productName);
          }
          if (sku) {
            seenSkusInFile.add(sku.toLowerCase());
          }

          const isValid = errors.filter((er) => !er.includes('Duplikat')).length === 0 && !seenKeysInFile.has(`${comboKey}__dup`);

          rows.push({
            rowNum,
            productName,
            category,
            variantName,
            sku,
            costPrice: Number.isNaN(costPrice) ? 0 : costPrice,
            price: Number.isNaN(price) ? 0 : price,
            stock: Number.isNaN(stock) ? 0 : stock,
            minStock: Number.isNaN(minStock) ? 5 : minStock,
            status,
            isValid: errors.length === 0,
            isDuplicate,
            errorReason: errors.length > 0 ? errors.join(', ') : isDuplicate ? 'Varian sudah ada (akan diperbarui)' : undefined,
          });
        });

        resolve({
          rows,
          validCount: rows.filter((r) => r.isValid).length,
          invalidCount: rows.filter((r) => !r.isValid).length,
          duplicateCount: rows.filter((r) => r.isDuplicate).length,
          uniqueProductNames: Array.from(prodNameSet),
        });
      } catch (err: any) {
        reject(new Error(err?.message || 'Gagal membaca file Excel Produk Varian'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file Excel'));
    reader.readAsArrayBuffer(file);
  });
}

export interface VariantSalesReportRow {
  productName: string;
  variantName: string;
  qtySold: number;
  sellingPrice: number;
  totalOmzet: number;
  totalModal: number;
  profit: number;
  remainingStock: number;
  unit: string;
}

export function exportVariantSalesReportToExcel(
  rows: VariantSalesReportRow[],
  filename?: string
) {
  const data = rows.map((r, i) => ({
    'No': i + 1,
    'Nama Produk': r.productName,
    'Varian Rasa': r.variantName || '-',
    'Jumlah Terjual': r.qtySold,
    'Harga Jual (Rp)': r.sellingPrice,
    'Total Omzet (Rp)': r.totalOmzet,
    'Modal (Rp)': r.totalModal,
    'Keuntungan (Rp)': r.profit,
    'Stok Tersisa': `${r.remainingStock} ${r.unit || 'Cup'}`,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 22 },
    { wch: 15 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 15 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penjualan Varian');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  const name =
    filename || `Laporan_Penjualan_Varian_WarungBangKobra_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBlob(blob, name);
}
