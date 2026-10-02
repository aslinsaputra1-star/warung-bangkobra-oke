import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Download,
  Upload,
  X,
  Check,
  Package,
  ArrowUpDown,
  Filter,
  Flame,
  RefreshCw,
  FileSpreadsheet,
  FileDown,
  Camera,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Product, ProductVariant, ProductCategory, UserRole } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  syncProductsToFirebase,
  syncProductVariantsToFirebase,
  clearAllProductsFromFirebase,
} from '../../services/firebase';
import {
  exportProductsToExcel,
  downloadProductExcelTemplate,
  parseProductsFromExcel,
} from '../../utils/excelHelper';
import { ProductImageUploader } from './ProductImageUploader';
import { ProductImageModal } from './ProductImageModal';
import { ProductVariantsManager } from './ProductVariantsManager';

interface ProductsViewProps {
  products: Product[];
  variants?: ProductVariant[];
  userRole?: UserRole;
  onAddProduct: (prod: Product) => void;
  onUpdateProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onDeleteProductsBulk?: (ids: string[]) => void;
  onImportProducts: (prods: Product[]) => void;
  onClearAllProducts?: () => Promise<boolean> | void;
  onAddVariant?: (v: ProductVariant) => void;
  onUpdateVariant?: (v: ProductVariant) => void;
  onDeleteVariant?: (variantId: string) => void;
  onBulkSaveProductsAndVariants?: (newProducts: Product[], newVariants: ProductVariant[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  variants = [],
  userRole = 'Owner',
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onDeleteProductsBulk,
  onImportProducts,
  onClearAllProducts,
  onAddVariant,
  onUpdateVariant,
  onDeleteVariant,
  onBulkSaveProductsAndVariants,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'variants'>('all');
  const [selectedVariantProductId, setSelectedVariantProductId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<'sku' | 'nama' | 'harga-asc' | 'harga-desc' | 'stok-asc' | 'stok-desc'>('sku');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [quickImageProduct, setQuickImageProduct] = useState<Product | null>(null);
  const [isQuickImageModalOpen, setIsQuickImageModalOpen] = useState(false);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearingProducts, setIsClearingProducts] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  const isAdminUser = [
    'Owner',
    'OWNER',
    'owner',
    'Admin',
    'ADMIN',
    'admin',
    'Staff',
    'STAFF',
    'staff',
  ].includes(String(userRole || 'Owner'));

  const handleConfirmClearAllProducts = async () => {
    if (!isAdminUser) {
      showToast('Hanya pengguna dengan hak akses Admin yang dapat mengosongkan seluruh produk.', 'error');
      return;
    }
    setIsClearingProducts(true);
    try {
      if (onClearAllProducts) {
        await onClearAllProducts();
      } else {
        await clearAllProductsFromFirebase('Admin');
        onImportProducts([]);
      }
      setIsClearConfirmOpen(false);
      showToast('Semua produk berhasil dikosongkan.', 'success');
    } catch (err) {
      console.error('Error clearing products:', err);
      showToast('Gagal mengosongkan produk.', 'error');
    } finally {
      setIsClearingProducts(false);
    }
  };

  const openQuickImageModal = (product: Product) => {
    setQuickImageProduct(product);
    setIsQuickImageModalOpen(true);
  };

  const handleSyncFirebase = async () => {
    if (!products || products.length === 0) {
      showToast('Tidak ada menu untuk disinkronkan ke Firebase.', 'info');
      return;
    }
    setIsSyncingFirebase(true);
    try {
      const [prodOk] = await Promise.all([
        syncProductsToFirebase(products, true),
        syncProductVariantsToFirebase(variants, true),
      ]);
      if (prodOk) {
        showToast(`Katalog ${products.length} menu & ${variants.length} varian berhasil disinkronkan ke Firebase Firestore!`, 'success');
      } else {
        showToast('Gagal menyinkronkan menu ke Firebase Firestore.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal sinkronisasi menu ke Firebase', 'error');
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    sku: '',
    nama: '',
    kategori: 'Makanan',
    harga_modal: 0,
    harga_jual: 0,
    satuan: 'Porsi',
    stok: 20,
    stok_minimum: 5,
    foto: '',
    status: 'Aktif',
    deskripsi: '',
  });

  const categories: Array<ProductCategory> = ['Makanan', 'Minuman', 'Snack', 'Tambahan', 'Lainnya'];

  const filteredAndSortedProducts = useMemo(() => {
    const q = (search || '').toLowerCase();
    const result = products.filter((p) => {
      if (!p) return false;
      const matchCategory = filterCategory === 'Semua' || p.kategori === filterCategory;
      if (!q) return matchCategory;
      const matchSearch =
        (p.nama || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.deskripsi && p.deskripsi.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });

    return result.sort((a, b) => {
      if (sortBy === 'harga-asc') return Number(a.harga_jual ?? 0) - Number(b.harga_jual ?? 0);
      if (sortBy === 'harga-desc') return Number(b.harga_jual ?? 0) - Number(a.harga_jual ?? 0);
      if (sortBy === 'stok-asc') return Number(a.stok ?? 0) - Number(b.stok ?? 0);
      if (sortBy === 'stok-desc') return Number(b.stok ?? 0) - Number(a.stok ?? 0);
      if (sortBy === 'nama') return String(a.nama || '').localeCompare(String(b.nama || ''));
      // Default: preserve exact SKU sequence (SKU-001 .. SKU-0028)
      const skuA = String(a.sku || a.id || '').trim();
      const skuB = String(b.sku || b.id || '').trim();
      const numA = parseInt(skuA.replace(/\D+/g, ''), 10);
      const numB = parseInt(skuB.replace(/\D+/g, ''), 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [products, search, filterCategory, sortBy]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      sku: 'SKU-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      nama: '',
      kategori: 'Makanan',
      harga_modal: 10000,
      harga_jual: 15000,
      satuan: 'Porsi',
      stok: 25,
      stok_minimum: 5,
      foto: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      status: 'Aktif',
      deskripsi: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      ...product,
      foto: product.foto || product.gambar_url || '',
      gambar_url: product.foto || product.gambar_url || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || formData.nama.trim() === '') {
      showToast('Nama produk wajib diisi!', 'error');
      return;
    }

    if (editingProduct) {
      const photo = formData.foto || editingProduct.foto || editingProduct.gambar_url || '';
      const updated: Product = {
        ...editingProduct,
        ...(formData as Product),
        foto: photo,
        gambar_url: photo,
        updated_at: new Date().toISOString(),
      };
      onUpdateProduct(updated);
      showToast(`Produk ${updated.nama} berhasil diperbarui!`, 'success');
    } else {
      const photo =
        formData.foto ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
      const newProd: Product = {
        id: 'PRD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        sku: formData.sku || 'SKU-' + Date.now().toString().slice(-4),
        nama: formData.nama.trim(),
        kategori: formData.kategori as ProductCategory,
        harga_modal: Number(formData.harga_modal) || 0,
        harga_jual: Number(formData.harga_jual) || 0,
        satuan: formData.satuan || 'Porsi',
        stok: Number(formData.stok) || 0,
        stok_minimum: Number(formData.stok_minimum) || 5,
        foto: photo,
        gambar_url: photo,
        status: formData.status as 'Aktif' | 'Nonaktif',
        deskripsi: formData.deskripsi || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onAddProduct(newProd);
      showToast(`Produk ${newProd.nama} berhasil ditambahkan!`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, nama: string) => {
    const target = products.find((p) => p.id === id) || {
      id,
      sku: id,
      nama,
      kategori: 'Makanan',
      harga_modal: 0,
      harga_jual: 0,
      satuan: 'Porsi',
      stok: 0,
      stok_minimum: 5,
      foto: '',
      status: 'Aktif',
    };
    setProductToDelete(target);
  };

  const handleConfirmSingleDelete = () => {
    if (!productToDelete) return;
    const { id, nama } = productToDelete;
    if (selectedVariantProductId === id) {
      setSelectedVariantProductId(null);
    }
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onDeleteProduct(id);
    setProductToDelete(null);
    setIsModalOpen(false);
    setEditingProduct(null);
    showToast(`Produk "${nama}" berhasil dihapus dari katalog.`, 'success');
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const allFilteredIds = filteredAndSortedProducts.map((p) => p.id);
    const allSelected =
      allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedProductIds.has(id));
    if (allSelected) {
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleConfirmBulkDelete = () => {
    if (selectedProductIds.size === 0) return;
    const idsToDelete = Array.from(selectedProductIds);
    if (selectedVariantProductId && selectedProductIds.has(selectedVariantProductId)) {
      setSelectedVariantProductId(null);
    }
    if (onDeleteProductsBulk) {
      onDeleteProductsBulk(idsToDelete);
    } else {
      idsToDelete.forEach((id) => onDeleteProduct(id));
    }
    setSelectedProductIds(new Set());
    setIsBulkDeleteConfirmOpen(false);
    showToast(`${idsToDelete.length} produk terpilih berhasil dihapus.`, 'success');
  };

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportExcel = () => {
    if (products.length === 0) {
      showToast('Tidak ada data menu untuk diekspor.', 'info');
      return;
    }
    exportProductsToExcel(products);
    showToast(`Berhasil mengekspor ${products.length} menu ke file Excel (.xlsx)!`, 'success');
    setIsExportMenuOpen(false);
  };

  const handleDownloadTemplate = () => {
    downloadProductExcelTemplate();
    showToast('Template Excel untuk impor menu berhasil diunduh.', 'success');
    setIsExportMenuOpen(false);
  };

  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingExcel(true);
    try {
      const { products: imported, errors } = await parseProductsFromExcel(file);
      if (imported.length === 0) {
        showToast(errors[0] || 'Tidak ada data produk valid yang ditemukan dalam file Excel.', 'error');
      } else {
        // Merge or replace: add new ones or update existing by SKU or Name
        const updatedList = [...products];
        let addedCount = 0;
        let updatedCount = 0;

        imported.forEach((newP) => {
          const existingIdx = updatedList.findIndex(
            (p) => (p.sku && p.sku === newP.sku) || p.nama.toLowerCase() === newP.nama.toLowerCase()
          );
          if (existingIdx >= 0) {
            updatedList[existingIdx] = {
              ...updatedList[existingIdx],
              ...newP,
              id: updatedList[existingIdx].id,
            };
            updatedCount++;
          } else {
            updatedList.push(newP);
            addedCount++;
          }
        });

        onImportProducts(updatedList);
        showToast(
          `Sukses impor Excel: ${addedCount} menu baru ditambahkan, ${updatedCount} menu diperbarui!`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Gagal membaca file Excel.', 'error');
    } finally {
      setIsImportingExcel(false);
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = '';
      }
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(products, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `produk_warung_bang_kobra_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Data produk berhasil diekspor ke format JSON!', 'success');
    setIsExportMenuOpen(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportProducts(parsed);
          showToast(`Berhasil mengimpor ${parsed.length} produk dari JSON!`, 'success');
        } else {
          showToast('Format file JSON tidak valid (harus array produk).', 'error');
        }
      } catch (err) {
        showToast('Gagal membaca file JSON.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const variantCountByProductId = useMemo(() => {
    const counts = new Map<string, number>();
    variants.forEach((v) => {
      counts.set(v.productId, (counts.get(v.productId) || 0) + 1);
    });
    return counts;
  }, [variants]);

  const totalProductsWithVariants = useMemo(() => {
    return products.filter(
      (p) => Boolean(p.hasVariants) || (variantCountByProductId.get(p.id) || 0) > 0
    ).length;
  }, [products, variantCountByProductId]);

  const openManageVariantsForProduct = (productId: string) => {
    setSelectedVariantProductId(productId);
    setActiveSubTab('variants');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Sub-Navigation Toggle: Semua Produk vs Produk Varian Rasa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900 border border-stone-800 rounded-2xl p-2">
        <div className="flex items-center gap-1.5">
          <button
            id="tab-all-products"
            type="button"
            onClick={() => {
              setSelectedVariantProductId(null);
              setActiveSubTab('all');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Semua Menu Produk ({products.length})</span>
          </button>
          <button
            id="tab-product-variants"
            type="button"
            onClick={() => setActiveSubTab('variants')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'variants'
                ? 'bg-amber-500 text-stone-950 shadow-md'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>
              Produk Varian Rasa ({totalProductsWithVariants} Produk • {variants.length} Rasa)
            </span>
          </button>
        </div>
        <div className="px-2 text-[11px] text-stone-400 hidden md:block">
          Nutrisari, Pop Ice, Hilo, Chocolatos, Good Day &amp; minuman sachet multi-rasa
        </div>
      </div>

      {activeSubTab === 'variants' ? (
        <ProductVariantsManager
          products={products}
          variants={variants}
          userRole={userRole}
          selectedProductIdFilter={selectedVariantProductId}
          onClearProductFilter={() => setSelectedVariantProductId(null)}
          onAddProduct={onAddProduct}
          onUpdateProduct={onUpdateProduct}
          onDeleteProduct={(id) => {
            if (selectedVariantProductId === id) {
              setSelectedVariantProductId(null);
            }
            onDeleteProduct(id);
          }}
          onAddVariant={(v) => onAddVariant && onAddVariant(v)}
          onUpdateVariant={(v) => onUpdateVariant && onUpdateVariant(v)}
          onDeleteVariant={(id) => onDeleteVariant && onDeleteVariant(id)}
          onBulkSaveProductsAndVariants={(newProds, newVars) => {
            if (onBulkSaveProductsAndVariants) {
              onBulkSaveProductsAndVariants(newProds, newVars);
            } else {
              onImportProducts(newProds);
            }
          }}
          showToast={showToast}
        />
      ) : (
        <>
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-500" />
            <span>Manajemen Menu & Produk</span>
          </h2>
          <p className="text-xs sm:text-sm text-stone-400">
            Kelola daftar menu, harga jual, harga modal, dan kontrol stok minimum.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-sync-firebase-products-toolbar"
            onClick={handleSyncFirebase}
            disabled={isSyncingFirebase}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-950/40 border border-orange-800/60 text-orange-400 hover:bg-orange-900/50 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            title="Sinkronkan katalog menu ke Firebase Cloud"
          >
            <Flame className={`w-4 h-4 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncingFirebase ? 'Menyinkronkan...' : 'Sinkron Firebase'}</span>
          </button>

          {/* Import Dropdown / Button Group */}
          <div className="flex items-center gap-1">
            <label
              id="btn-import-excel-products"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/50 text-xs font-bold cursor-pointer transition shadow-sm ${
                isImportingExcel ? 'opacity-50 pointer-events-none' : ''
              }`}
              title="Impor menu dari file Excel (.xlsx / .xls)"
            >
              <FileSpreadsheet className={`w-4 h-4 ${isImportingExcel ? 'animate-spin' : ''}`} />
              <span>{isImportingExcel ? 'Memproses...' : 'Impor Excel'}</span>
              <input
                ref={excelFileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleImportExcelFile}
                className="hidden"
                disabled={isImportingExcel}
              />
            </label>

            <label
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800 text-xs font-medium cursor-pointer transition"
              title="Impor dari JSON (opsi cadangan)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">JSON</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>

          {/* Export Group with Dropdown */}
          <div className="relative">
            <button
              id="btn-export-excel-products"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-bold transition shadow-sm cursor-pointer"
              title="Download seluruh menu ke format Excel (.xlsx)"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Ekspor Excel</span>
            </button>
          </div>

          {/* Download Template Button */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:bg-stone-800 hover:text-amber-400 text-xs font-medium transition cursor-pointer"
            title="Download Template Format Excel untuk isi daftar menu"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden xl:inline text-[11px]">Template Excel</span>
          </button>

          {selectedProductIds.size > 0 && (
            <button
              id="btn-bulk-delete-selected-products"
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-950/40 transition active:scale-95 cursor-pointer"
              title="Hapus produk yang dicentang"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Terpilih ({selectedProductIds.size})</span>
            </button>
          )}

          {isAdminUser && (
            <button
              id="btn-clear-all-products"
              type="button"
              onClick={() => setIsClearConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/50 border border-rose-700/60 text-rose-300 hover:bg-rose-900/60 hover:text-white text-xs font-extrabold transition cursor-pointer"
              title="Kosongkan seluruh data produk (Khusus Admin)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Kosongkan Produk</span>
            </button>
          )}

          <button
            id="btn-add-product"
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg shadow-amber-950/30 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search */}
        <div className="sm:col-span-4 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama produk, SKU, atau deskripsi..."
            className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-3 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Category Filter */}
        <div className="sm:col-span-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
          >
            <option value="Semua">Semua Kategori ({products.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="sm:col-span-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
          >
            <option value="sku">Urutkan: Urutan SKU (SKU-001 — SKU-0028)</option>
            <option value="nama">Urutkan: Nama (A-Z)</option>
            <option value="harga-asc">Harga Terendah</option>
            <option value="harga-desc">Harga Tertinggi</option>
            <option value="stok-asc">Stok Paling Sedikit</option>
            <option value="stok-desc">Stok Paling Banyak</option>
          </select>
        </div>

        {/* View Mode Toggle: Tabel vs Foto/Grid */}
        <div className="sm:col-span-2 flex items-center justify-end bg-stone-900 border border-stone-800 rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'table'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Tampilan Tabel Menu"
          >
            <List className="w-3.5 h-3.5" />
            <span className="text-[11px]">Tabel</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title="Tampilan Kartu Foto Menu (Visual)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="text-[11px]">Foto</span>
          </button>
        </div>
      </div>

      {/* Conditional Rendering: Empty Product Catalog State (Section 3) vs Grid Cards vs Table */}
      {products.length === 0 ? (
        <div className="bg-stone-900 border-2 border-dashed border-stone-800 rounded-3xl p-10 sm:p-16 text-center max-w-xl mx-auto my-4 space-y-4 shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
            <Package className="w-10 h-10" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-black text-stone-100">
              Belum Ada Produk
            </h3>
            <p className="text-xs sm:text-sm text-stone-400 max-w-md mx-auto leading-relaxed">
              Belum ada produk yang tersedia. Silakan tambahkan produk baru.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-amber-950/40 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Produk</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAndSortedProducts.length === 0 ? (
            <div className="col-span-full bg-stone-900 border border-stone-800 rounded-3xl p-12 text-center text-stone-500">
              Tidak ada produk ditemukan.
            </div>
          ) : (
            filteredAndSortedProducts.map((p) => {
              const isLow = p.stok <= p.stok_minimum;
              const photo = p.foto || p.gambar_url || '';
              return (
                <div
                  key={p.id}
                  className="bg-stone-900 border border-stone-800 hover:border-amber-500/50 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transition-all group"
                >
                  <div>
                    {/* Image with Camera edit overlay */}
                    <div className="relative aspect-video w-full bg-stone-950 overflow-hidden">
                      <img
                        src={photo}
                        alt={p.nama}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-transparent to-black/25 pointer-events-none" />

                      {/* Category Badge */}
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-stone-950/85 text-amber-400 border border-stone-800 backdrop-blur-xs">
                        {p.kategori}
                      </span>

                      {/* Stock Badge */}
                      <div className="absolute top-2.5 right-2.5">
                        {isLow ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/90 text-white shadow-md animate-pulse">
                            STOK MENIPIS ({p.stok})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-950/85 text-stone-300 border border-stone-800 backdrop-blur-xs">
                            {p.stok} {p.satuan}
                          </span>
                        )}
                      </div>

                      {/* Quick Edit Image Button */}
                      <button
                        type="button"
                        onClick={() => openQuickImageModal(p)}
                        className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-[11px] shadow-lg transition active:scale-95 cursor-pointer z-10"
                        title="Klik untuk ubah foto menu ini"
                      >
                        <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Ubah Foto</span>
                      </button>
                    </div>

                    {/* Card Info */}
                    <div className="p-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-extrabold text-stone-100 text-sm leading-snug line-clamp-1 group-hover:text-amber-400 transition-colors">
                          {p.nama}
                        </h4>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            p.status === 'Aktif'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-stone-800 text-stone-500'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-400 font-mono">{p.sku}</p>
                      {p.deskripsi && (
                        <p className="text-[11px] text-stone-400 line-clamp-2 leading-relaxed">
                          {p.deskripsi}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom / Actions */}
                  <div className="p-3.5 pt-2 border-t border-stone-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-400 block">Harga Jual</span>
                      <span className="text-sm font-black font-mono text-amber-400">
                        {formatRupiah(p.harga_jual)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openQuickImageModal(p)}
                        className="p-2 rounded-xl bg-stone-800 hover:bg-amber-950/40 text-amber-400 border border-stone-750 hover:border-amber-500/40 transition cursor-pointer"
                        title="Ganti Foto Menu"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Edit Data Menu"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.nama)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800/50 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                        title="Hapus Menu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Products Table */
        <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950/70 border-b border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                <tr>
                  <th className="py-3.5 px-3 w-9 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredAndSortedProducts.length > 0 &&
                        filteredAndSortedProducts.every((p) => selectedProductIds.has(p.id))
                      }
                      onChange={toggleSelectAllFiltered}
                      className="rounded accent-amber-500 cursor-pointer"
                      title="Pilih semua produk"
                    />
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap">SKU</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Nama Menu</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Kategori</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Harga Modal (Rp)</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Harga Jual (Rp)</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Satuan</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Stok Saat Ini</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Stok Minimum</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Aktif</th>
                  <th className="py-3.5 px-3">Deskripsi</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-medium">
                {filteredAndSortedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-stone-500">
                      Tidak ada produk ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedProducts.map((p) => {
                    const isLow = p.stok <= p.stok_minimum;
                    const photo = p.foto || p.gambar_url || '';
                    const isSelected = selectedProductIds.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-stone-800/40 transition ${
                          isSelected ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(p.id)}
                            className="rounded accent-amber-500 cursor-pointer"
                          />
                        </td>
                        {/* 1. SKU */}
                        <td className="py-3 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {p.sku}
                        </td>

                        {/* 2. Nama Menu */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              onClick={() => openQuickImageModal(p)}
                              className="relative w-9 h-9 rounded-xl overflow-hidden bg-stone-950 shrink-0 cursor-pointer group border border-stone-800 hover:border-amber-500/80 transition shadow-sm"
                              title="Klik untuk ubah foto menu ini"
                            >
                              <img
                                src={photo}
                                alt={p.nama}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
                                }}
                              />
                              <div className="absolute inset-0 bg-stone-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                                <Camera className="w-3.5 h-3.5 text-amber-400" />
                              </div>
                            </div>
                            <div>
                              <span className="font-bold text-stone-100 whitespace-nowrap block">
                                {p.nama}
                              </span>
                              {(Boolean(p.hasVariants) ||
                                (variantCountByProductId.get(p.id) || 0) > 0) && (
                                <button
                                  type="button"
                                  onClick={() => openManageVariantsForProduct(p.id)}
                                  className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                                >
                                  <Layers className="w-3 h-3" />
                                  <span>
                                    {variantCountByProductId.get(p.id) || 0} Varian Rasa (Kelola)
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Kategori */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-800 text-stone-300">
                            {p.kategori}
                          </span>
                        </td>

                        {/* 4. Harga Modal (Rp) */}
                        <td className="py-3 px-3 font-mono text-stone-300 whitespace-nowrap">
                          {Number(p.harga_modal).toLocaleString('id-ID')}
                        </td>

                        {/* 5. Harga Jual (Rp) */}
                        <td className="py-3 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {Number(p.harga_jual).toLocaleString('id-ID')}
                        </td>

                        {/* 6. Satuan */}
                        <td className="py-3 px-3 text-stone-300 whitespace-nowrap">
                          {p.satuan}
                        </td>

                        {/* 7. Stok Saat Ini */}
                        <td className="py-3 px-3 font-mono whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={isLow ? 'text-rose-400 font-bold' : 'text-stone-200 font-bold'}>
                              {p.stok}
                            </span>
                            {isLow && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                                MENIPIS
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 8. Stok Minimum */}
                        <td className="py-3 px-3 font-mono text-stone-400 whitespace-nowrap">
                          {p.stok_minimum}
                        </td>

                        {/* 9. Aktif */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.status === 'Aktif'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-stone-800 text-stone-500'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>

                        {/* 10. Deskripsi */}
                        <td className="py-3 px-3 text-stone-400 max-w-xs">
                          <span className="line-clamp-2 leading-relaxed">{p.deskripsi || '-'}</span>
                        </td>

                        {/* Aksi */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openManageVariantsForProduct(p.id)}
                              className="px-2 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-950/50 text-amber-400 border border-stone-700 hover:border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                              title="Kelola Varian Rasa untuk Produk Ini"
                            >
                              <Layers className="w-3 h-3" />
                              <span className="hidden xl:inline">Varian</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openQuickImageModal(p)}
                              className="p-1.5 rounded-lg bg-stone-800 hover:bg-amber-950/40 text-amber-400 hover:text-amber-300 border border-stone-750 hover:border-amber-500/40 transition cursor-pointer"
                              title="Ubah Foto Menu"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="px-2 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                              title="Edit Produk"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id, p.nama)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800/50 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
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
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/40">
              <h3 className="text-base font-extrabold text-stone-100">
                {editingProduct ? 'Edit Menu / Produk' : 'Tambah Menu Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">Nama Menu *</label>
                  <input
                    type="text"
                    required
                    value={formData.nama || ''}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Contoh: Mi Aceh Spesial"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">Kategori</label>
                  <select
                    value={formData.kategori || 'Makanan'}
                    onChange={(e) =>
                      setFormData({ ...formData, kategori: e.target.value as ProductCategory })
                    }
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">SKU / Kode</label>
                  <input
                    type="text"
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">Satuan</label>
                  <input
                    type="text"
                    value={formData.satuan || 'Porsi'}
                    onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                    placeholder="Porsi, Cup, Pcs, Bks"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Harga Jual (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.harga_jual ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, harga_jual: Number(e.target.value) })
                    }
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Harga Modal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.harga_modal ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, harga_modal: Number(e.target.value) })
                    }
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">Jumlah Stok</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stok ?? ''}
                    onChange={(e) => setFormData({ ...formData, stok: Number(e.target.value) })}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-300 mb-1 block">
                    Batas Stok Minimum
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stok_minimum ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, stok_minimum: Number(e.target.value) })
                    }
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-stone-800/80">
                <label className="text-xs font-bold text-stone-200 mb-2 flex items-center justify-between">
                  <span>Foto Menu / Produk</span>
                  <span className="text-[11px] font-normal text-stone-400">
                    Upload foto, pilih preset, atau ketik URL
                  </span>
                </label>
                <ProductImageUploader
                  currentImageUrl={formData.foto || ''}
                  onImageChange={(newUrl) =>
                    setFormData({
                      ...formData,
                      foto: newUrl,
                      gambar_url: newUrl,
                    })
                  }
                  productName={formData.nama || 'Menu Baru'}
                  category={formData.kategori || 'Makanan'}
                  showToast={showToast}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 mb-1 block">
                  Status Keaktifan
                </label>
                <select
                  value={formData.status || 'Aktif'}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as 'Aktif' | 'Nonaktif' })
                  }
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Aktif">Aktif (Tampil di Kasir)</option>
                  <option value="Nonaktif">Nonaktif (Disembunyikan)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 mb-1 block">Deskripsi Menu</label>
                <textarea
                  rows={2}
                  value={formData.deskripsi || ''}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                  placeholder="Penjelasan bahan, rasa, porsi..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-stone-800">
                <div>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setProductToDelete(editingProduct);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-600 border border-rose-800/60 text-rose-300 hover:text-white font-bold text-xs transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Hapus Produk</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-lg shadow-amber-950/40 cursor-pointer"
                  >
                    Simpan Produk
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Product Delete Confirmation Modal (Replaces blocked window.confirm) */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-rose-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-base font-black text-white">
                  Hapus Produk dari Katalog?
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-medium">
                  Anda akan menghapus menu{' '}
                  <strong className="text-amber-400">&ldquo;{productToDelete.nama}&rdquo;</strong>{' '}
                  (<span className="font-mono">{productToDelete.sku}</span>).
                </p>
              </div>
            </div>

            {(variantCountByProductId.get(productToDelete.id) || 0) > 0 && (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-700/50 text-xs text-amber-200">
                Produk ini memiliki{' '}
                <strong>{variantCountByProductId.get(productToDelete.id)} varian rasa</strong> yang
                juga akan ikut dihapus dari katalog kasir.
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-delete-single-product"
                type="button"
                onClick={handleConfirmSingleDelete}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs shadow-lg shadow-rose-950/50 transition active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Produk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Selected Products Delete Confirmation Modal */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-rose-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">
                  Hapus {selectedProductIds.size} Produk Terpilih?
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-medium">
                  Seluruh {selectedProductIds.size} produk yang Anda centang beserta varian rasanya
                  akan dihapus dari katalog kasir dan Firebase Firestore.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs shadow-lg shadow-rose-950/50 transition active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus {selectedProductIds.size} Produk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Image Edit Modal */}
      <ProductImageModal
        isOpen={isQuickImageModalOpen}
        onClose={() => {
          setIsQuickImageModalOpen(false);
          setQuickImageProduct(null);
        }}
        product={quickImageProduct}
        onSaveProduct={onUpdateProduct}
        showToast={showToast}
      />

      {/* Admin Confirmation Modal: Kosongkan Seluruh Produk (Section 5) */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-rose-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">
                  Konfirmasi Kosongkan Produk
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-medium">
                  Apakah Anda yakin ingin menghapus seluruh produk? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 text-[11px] text-stone-400 leading-relaxed">
              Catatan: Data transaksi lama, laporan penjualan, pelanggan, pengguna, dan pengaturan toko <strong className="text-stone-200">tidak akan dihapus</strong>.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                type="button"
                disabled={isClearingProducts}
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isClearingProducts}
                onClick={handleConfirmClearAllProducts}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs shadow-lg shadow-rose-950/50 transition active:scale-95 cursor-pointer"
              >
                {isClearingProducts ? 'Mengosongkan...' : 'Ya, Kosongkan Produk'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
