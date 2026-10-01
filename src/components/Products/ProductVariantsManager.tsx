import React, { useState, useMemo, useRef } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  X,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Power,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Product, ProductVariant, ProductCategory, UserRole } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  downloadProductVariantsExcelTemplate,
  exportProductsAndVariantsToExcel,
  parseProductVariantsPreviewFromExcel,
  VariantImportPreviewResult,
} from '../../utils/excelHelper';
import { compressAndUploadProductImage, logAuditActivity } from '../../services/firebase';

interface ProductVariantsManagerProps {
  products: Product[];
  variants: ProductVariant[];
  userRole?: UserRole;
  selectedProductIdFilter?: string | null;
  onClearProductFilter?: () => void;
  onAddProduct: (p: Product) => void;
  onUpdateProduct: (p: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddVariant: (v: ProductVariant) => void;
  onUpdateVariant: (v: ProductVariant) => void;
  onDeleteVariant: (variantId: string) => void;
  onBulkSaveProductsAndVariants: (newProducts: Product[], newVariants: ProductVariant[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProductVariantsManager: React.FC<ProductVariantsManagerProps> = ({
  products,
  variants,
  userRole = 'Owner',
  selectedProductIdFilter,
  onClearProductFilter,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddVariant,
  onUpdateVariant,
  onDeleteVariant,
  onBulkSaveProductsAndVariants,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  // Add/Edit Variant Modal
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm, setVariantForm] = useState<{
    productId: string;
    variantName: string;
    sku: string;
    costPrice: number;
    price: number;
    stock: number;
    minStock: number;
    unit: string;
    imageUrl: string;
    isActive: boolean;
  }>({
    productId: '',
    variantName: '',
    sku: '',
    costPrice: 3000,
    price: 5000,
    stock: 20,
    minStock: 5,
    unit: 'Cup',
    imageUrl: '',
    isActive: true,
  });

  // Add/Edit Main Product with Variants Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingMainProduct, setEditingMainProduct] = useState<Product | null>(null);
  const [mainProductForm, setMainProductForm] = useState<{
    nama: string;
    sku: string;
    kategori: ProductCategory;
    harga_modal: number;
    harga_jual: number;
    satuan: string;
    stok_minimum: number;
    foto: string;
    deskripsi: string;
    initialFlavorsText: string;
  }>({
    nama: '',
    sku: '',
    kategori: 'Minuman',
    harga_modal: 3000,
    harga_jual: 5000,
    satuan: 'Cup',
    stok_minimum: 5,
    foto: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80',
    deskripsi: '',
    initialFlavorsText: '',
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Inline quick-edit state for variant price/stock
  const [inlineEdits, setInlineEdits] = useState<
    Record<string, { price?: number; costPrice?: number; stock?: number; minStock?: number }>
  >({});

  // Excel Import Preview & Report Modal
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<VariantImportPreviewResult | null>(null);
  const [importReport, setImportReport] = useState<{
    successCount: number;
    failedCount: number;
    updatedProductsCount: number;
    details: string[];
  } | null>(null);

  // Delete Confirmation Modals (Main Product & Single Variant)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [variantToDelete, setVariantToDelete] = useState<ProductVariant | null>(null);

  const canManageCatalog = [
    'Owner',
    'OWNER',
    'owner',
    'Admin',
    'ADMIN',
    'admin',
    'Staff',
    'STAFF',
    'staff',
    'Kasir',
    'KASIR',
    'kasir',
  ].includes(String(userRole || 'Owner'));
  const canSeeCostPrice = [
    'Owner',
    'OWNER',
    'owner',
    'Admin',
    'ADMIN',
    'admin',
  ].includes(String(userRole || 'Owner'));

  const categories: string[] = ['Semua', 'Minuman', 'Makanan', 'Snack', 'Tambahan', 'Lainnya'];

  // Group variants by productId
  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    variants.forEach((v) => {
      const list = map.get(v.productId) || [];
      list.push(v);
      map.set(v.productId, list);
    });
    return map;
  }, [variants]);

  // Filter products that have variants (or match selectedProductIdFilter, or match search)
  const displayedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const prodVars = variantsByProduct.get(p.id) || [];
      const hasVars = Boolean(p.hasVariants) || prodVars.length > 0;

      if (selectedProductIdFilter) {
        return p.id === selectedProductIdFilter;
      }
      if (!hasVars && !q) {
        return false;
      }
      if (categoryFilter !== 'Semua' && p.kategori !== categoryFilter) {
        return false;
      }
      if (!q) return true;

      const matchProduct =
        (p.nama || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
      const matchVariant = prodVars.some(
        (v) =>
          (v.variantName || '').toLowerCase().includes(q) ||
          (v.sku || '').toLowerCase().includes(q)
      );
      return matchProduct || matchVariant;
    });
  }, [products, variantsByProduct, searchQuery, categoryFilter, selectedProductIdFilter]);

  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => ({
      ...prev,
      [productId]: prev[productId] === undefined ? false : !prev[productId],
    }));
  };

  // Open Add Variant Modal for a specific Product
  const openAddVariantModal = (product: Product) => {
    const existingVars = variantsByProduct.get(product.id) || [];
    const nextNum = String(existingVars.length + 1).padStart(2, '0');
    const cleanPrefix = (product.sku || product.id).replace(/[^A-Za-z0-9-]/g, '');
    setEditingVariant(null);
    setVariantForm({
      productId: product.id,
      variantName: '',
      sku: `${cleanPrefix}-V${nextNum}`,
      costPrice: product.harga_modal || 3000,
      price: product.harga_jual || 5000,
      stock: 20,
      minStock: 5,
      unit: product.satuan || 'Cup',
      imageUrl: product.foto || '',
      isActive: true,
    });
    setIsVariantModalOpen(true);
  };

  const openEditVariantModal = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setVariantForm({
      productId: variant.productId,
      variantName: variant.variantName,
      sku: variant.sku,
      costPrice: variant.costPrice,
      price: variant.price,
      stock: variant.stock,
      minStock: variant.minStock,
      unit: variant.unit || 'Cup',
      imageUrl: variant.imageUrl || '',
      isActive: variant.isActive,
    });
    setIsVariantModalOpen(true);
  };

  const handleSaveVariantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCatalog) {
      showToast('Hanya Owner/Admin yang dapat mengubah data varian.', 'error');
      return;
    }
    if (!variantForm.productId || !variantForm.variantName.trim()) {
      showToast('Pilih produk utama dan masukkan nama varian rasa.', 'error');
      return;
    }
    const parentProd = products.find((p) => p.id === variantForm.productId);
    const nowIso = new Date().toISOString();

    if (editingVariant) {
      const updated: ProductVariant = {
        ...editingVariant,
        productId: variantForm.productId,
        productName: parentProd?.nama || editingVariant.productName || '',
        variantName: variantForm.variantName.trim(),
        sku: variantForm.sku.trim() || editingVariant.sku,
        costPrice: Math.max(0, Number(variantForm.costPrice || 0)),
        price: Math.max(0, Number(variantForm.price || 0)),
        stock: Math.max(0, Number(variantForm.stock || 0)),
        minStock: Math.max(0, Number(variantForm.minStock || 0)),
        unit: variantForm.unit.trim() || 'Cup',
        imageUrl: variantForm.imageUrl.trim() || parentProd?.foto || '',
        isActive: variantForm.isActive,
        updatedAt: nowIso,
      };
      onUpdateVariant(updated);
      logAuditActivity(
        'EDIT_VARIAN',
        `Memperbarui varian ${updated.productName} - ${updated.variantName} (Rp${updated.price}, Stok: ${updated.stock})`,
        userRole,
        'PRODUCTS'
      ).catch(() => {});
      showToast(`Varian "${updated.variantName}" berhasil diperbarui!`, 'success');
    } else {
      const newVar: ProductVariant = {
        variantId: `VAR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        productId: variantForm.productId,
        productName: parentProd?.nama || '',
        variantName: variantForm.variantName.trim(),
        sku: variantForm.sku.trim() || `SKU-VAR-${Date.now().toString().slice(-4)}`,
        costPrice: Math.max(0, Number(variantForm.costPrice || 0)),
        price: Math.max(0, Number(variantForm.price || 0)),
        stock: Math.max(0, Number(variantForm.stock || 0)),
        minStock: Math.max(0, Number(variantForm.minStock || 0)),
        unit: variantForm.unit.trim() || 'Cup',
        imageUrl: variantForm.imageUrl.trim() || parentProd?.foto || '',
        isActive: variantForm.isActive,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      onAddVariant(newVar);
      logAuditActivity(
        'TAMBAH_VARIAN',
        `Menambahkan varian baru ${newVar.productName} - ${newVar.variantName}`,
        userRole,
        'PRODUCTS'
      ).catch(() => {});
      showToast(`Varian rasa "${newVar.variantName}" berhasil ditambahkan!`, 'success');
    }
    setIsVariantModalOpen(false);
  };

  // Duplicate Product + All Variants (Section 2: Duplikasi produk beserta semua variannya)
  const handleDuplicateProductWithVariants = (product: Product) => {
    if (!canManageCatalog) {
      showToast('Hanya Owner/Admin yang dapat menduplikasi produk.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const suffix = Math.floor(100 + Math.random() * 900);
    const newProdId = `SKU-DUP-${suffix}`;
    const sourceVariants = variantsByProduct.get(product.id) || [];

    const clonedProduct: Product = {
      ...product,
      id: newProdId,
      sku: newProdId,
      nama: `${product.nama} (Salinan)`,
      hasVariants: sourceVariants.length > 0,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const clonedVariants: ProductVariant[] = sourceVariants.map((sv, idx) => {
      const seq = String(idx + 1).padStart(2, '0');
      return {
        ...sv,
        variantId: `VAR-DUP-${suffix}-${seq}`,
        productId: newProdId,
        productName: clonedProduct.nama,
        sku: `${newProdId}-V${seq}`,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const nextProducts = [...products, clonedProduct];
    const nextVariants = [...variants, ...clonedVariants];
    onBulkSaveProductsAndVariants(nextProducts, nextVariants);
    logAuditActivity(
      'DUPLIKASI_PRODUK_VARIAN',
      `Menduplikasi produk ${product.nama} beserta ${clonedVariants.length} varian rasa`,
      userRole,
      'PRODUCTS'
    ).catch(() => {});
    showToast(
      `Produk "${clonedProduct.nama}" beserta ${clonedVariants.length} varian berhasil diduplikasi!`,
      'success'
    );
  };

  // Save inline edit for a single variant
  const saveInlineVariantEdit = (variant: ProductVariant) => {
    const edit = inlineEdits[variant.variantId];
    if (!edit) return;
    const updated: ProductVariant = {
      ...variant,
      price: edit.price !== undefined ? Math.max(0, Number(edit.price)) : variant.price,
      costPrice:
        edit.costPrice !== undefined ? Math.max(0, Number(edit.costPrice)) : variant.costPrice,
      stock: edit.stock !== undefined ? Math.max(0, Number(edit.stock)) : variant.stock,
      minStock:
        edit.minStock !== undefined ? Math.max(0, Number(edit.minStock)) : variant.minStock,
      updatedAt: new Date().toISOString(),
    };
    onUpdateVariant(updated);
    setInlineEdits((prev) => {
      const copy = { ...prev };
      delete copy[variant.variantId];
      return copy;
    });
    showToast(
      `Harga & stok varian "${variant.variantName}" disimpan (${formatRupiah(updated.price)} • Stok: ${updated.stock})`,
      'success'
    );
  };

  // Toggle Variant Active / Inactive
  const handleToggleVariantActive = (variant: ProductVariant) => {
    if (!canManageCatalog) {
      showToast('Hanya Owner/Admin yang dapat mengubah status varian.', 'error');
      return;
    }
    const updated: ProductVariant = {
      ...variant,
      isActive: !variant.isActive,
      updatedAt: new Date().toISOString(),
    };
    onUpdateVariant(updated);
    showToast(
      `Varian "${variant.variantName}" ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
      'info'
    );
  };

  // Open Main Product Modal (Create or Edit main product with variants)
  const openCreateMainProductModal = () => {
    const nextNum = String(products.length + 1).padStart(4, '0');
    setEditingMainProduct(null);
    setMainProductForm({
      nama: '',
      sku: `SKU-${nextNum}`,
      kategori: 'Minuman',
      harga_modal: 3000,
      harga_jual: 5000,
      satuan: 'Cup',
      stok_minimum: 5,
      foto: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80',
      deskripsi: '',
      initialFlavorsText: '',
    });
    setIsProductModalOpen(true);
  };

  const openEditMainProductModal = (product: Product) => {
    setEditingMainProduct(product);
    setMainProductForm({
      nama: product.nama,
      sku: product.sku,
      kategori: product.kategori,
      harga_modal: product.harga_modal,
      harga_jual: product.harga_jual,
      satuan: product.satuan || 'Cup',
      stok_minimum: product.stok_minimum || 5,
      foto: product.foto || '',
      deskripsi: product.deskripsi || '',
      initialFlavorsText: '',
    });
    setIsProductModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const url = await compressAndUploadProductImage(
        file,
        mainProductForm.sku || `PROD-${Date.now()}`
      );
      setMainProductForm((prev) => ({ ...prev, foto: url }));
      showToast('Gambar produk berhasil diunggah!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengunggah gambar', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveMainProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCatalog) {
      showToast('Hanya Owner/Admin yang dapat mengelola produk.', 'error');
      return;
    }
    if (!mainProductForm.nama.trim()) {
      showToast('Nama produk utama wajib diisi.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();

    if (editingMainProduct) {
      const updatedProd: Product = {
        ...editingMainProduct,
        nama: mainProductForm.nama.trim(),
        sku: mainProductForm.sku.trim() || editingMainProduct.sku,
        kategori: mainProductForm.kategori,
        harga_modal: Math.max(0, Number(mainProductForm.harga_modal || 0)),
        harga_jual: Math.max(0, Number(mainProductForm.harga_jual || 0)),
        satuan: mainProductForm.satuan.trim() || 'Cup',
        stok_minimum: Math.max(0, Number(mainProductForm.stok_minimum || 5)),
        foto: mainProductForm.foto.trim(),
        gambar_url: mainProductForm.foto.trim(),
        deskripsi: mainProductForm.deskripsi.trim(),
        hasVariants: true,
        updated_at: nowIso,
      };
      onUpdateProduct(updatedProd);
      showToast(`Produk utama "${updatedProd.nama}" berhasil diperbarui!`, 'success');
      setIsProductModalOpen(false);
      return;
    }

    const prodId = mainProductForm.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`;
    const flavorNames = mainProductForm.initialFlavorsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const createdVariants: ProductVariant[] = flavorNames.map((flv, idx) => {
      const seq = String(idx + 1).padStart(2, '0');
      return {
        variantId: `VAR-${prodId.replace(/[^A-Za-z0-9]/g, '')}-${seq}-${Date.now().toString().slice(-3)}`,
        productId: prodId,
        productName: mainProductForm.nama.trim(),
        variantName: flv,
        sku: `${prodId}-V${seq}`,
        costPrice: Math.max(0, Number(mainProductForm.harga_modal || 3000)),
        price: Math.max(0, Number(mainProductForm.harga_jual || 5000)),
        stock: 20,
        minStock: Math.max(0, Number(mainProductForm.stok_minimum || 5)),
        unit: mainProductForm.satuan.trim() || 'Cup',
        imageUrl: mainProductForm.foto.trim(),
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const totalInitialStock = createdVariants.length > 0 ? createdVariants.length * 20 : 20;

    const newProduct: Product = {
      id: prodId,
      sku: prodId,
      nama: mainProductForm.nama.trim(),
      kategori: mainProductForm.kategori,
      harga_modal: Math.max(0, Number(mainProductForm.harga_modal || 3000)),
      harga_jual: Math.max(0, Number(mainProductForm.harga_jual || 5000)),
      satuan: mainProductForm.satuan.trim() || 'Cup',
      stok: totalInitialStock,
      stok_minimum: Math.max(0, Number(mainProductForm.stok_minimum || 5)),
      foto:
        mainProductForm.foto.trim() ||
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80',
      gambar_url:
        mainProductForm.foto.trim() ||
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80',
      status: 'Aktif',
      deskripsi: mainProductForm.deskripsi.trim(),
      hasVariants: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    onBulkSaveProductsAndVariants(
      [...products, newProduct],
      [...variants, ...createdVariants]
    );
    showToast(
      `Produk "${newProduct.nama}" beserta ${createdVariants.length} varian rasa berhasil dibuat!`,
      'success'
    );
    setIsProductModalOpen(false);
  };

  // Excel File Selected -> Parse Preview (Section 9)
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const preview = await parseProductVariantsPreviewFromExcel(file, products, variants);
      setImportPreview(preview);
      setImportReport(null);
    } catch (err: any) {
      showToast(err?.message || 'Gagal membaca file Excel', 'error');
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  // Confirm Import from Preview Modal
  const handleConfirmExcelImport = () => {
    if (!importPreview) return;
    const nowIso = new Date().toISOString();
    const nextProducts = [...products];
    const nextVariants = [...variants];
    let successCount = 0;
    let failedCount = 0;
    const touchedProductIds = new Set<string>();
    const details: string[] = [];

    importPreview.rows.forEach((row) => {
      if (!row.isValid) {
        failedCount += 1;
        details.push(
          `Baris ${row.rowNum} (${row.productName || '?'} - ${row.variantName || '?'}): GAGAL - ${row.errorReason}`
        );
        return;
      }

      // Find or create main product by name
      let parent = nextProducts.find(
        (p) => p.nama.toLowerCase() === row.productName.toLowerCase()
      );
      if (!parent) {
        const newProdId = `SKU-${String(nextProducts.length + 1).padStart(4, '0')}`;
        const defaultUnit = row.category === 'Makanan' ? 'Porsi' : 'Cup';
        const defaultPhoto =
          row.category === 'Makanan'
            ? 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80';
        parent = {
          id: newProdId,
          sku: newProdId,
          nama: row.productName,
          kategori: row.category,
          harga_modal: row.costPrice,
          harga_jual: row.price,
          satuan: defaultUnit,
          stok: row.stock,
          stok_minimum: row.minStock,
          foto: defaultPhoto,
          gambar_url: defaultPhoto,
          status: 'Aktif',
          hasVariants: true,
          deskripsi: `Menu varian ${row.productName}`,
          created_at: nowIso,
          updated_at: nowIso,
        };
        nextProducts.push(parent);
      } else {
        parent.hasVariants = true;
      }

      touchedProductIds.add(parent.id);

      // Upsert variant
      const existingVarIdx = nextVariants.findIndex(
        (v) =>
          v.productId === parent!.id &&
          v.variantName.toLowerCase() === row.variantName.toLowerCase()
      );

      if (existingVarIdx >= 0) {
        nextVariants[existingVarIdx] = {
          ...nextVariants[existingVarIdx],
          sku: row.sku || nextVariants[existingVarIdx].sku,
          costPrice: row.costPrice,
          price: row.price,
          stock: row.stock,
          minStock: row.minStock,
          isActive: row.status === 'Aktif',
          updatedAt: nowIso,
        };
        details.push(
          `Baris ${row.rowNum}: BERHASIL memperbarui varian ${parent.nama} - ${row.variantName}`
        );
      } else {
        const newVarId = `VAR-${parent.id.replace(/[^A-Za-z0-9]/g, '')}-${nextVariants.length + 1}`;
        nextVariants.push({
          variantId: newVarId,
          productId: parent.id,
          productName: parent.nama,
          variantName: row.variantName,
          sku: row.sku || newVarId,
          costPrice: row.costPrice,
          price: row.price,
          stock: row.stock,
          minStock: row.minStock,
          unit: parent.satuan || 'Cup',
          imageUrl: parent.foto || '',
          isActive: row.status === 'Aktif',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        details.push(
          `Baris ${row.rowNum}: BERHASIL menambahkan varian ${parent.nama} - ${row.variantName}`
        );
      }
      successCount += 1;
    });

    // Recalculate parent product stock sums
    const syncedProducts = nextProducts.map((p) => {
      const pVars = nextVariants.filter((v) => v.productId === p.id);
      if (pVars.length === 0) return p;
      const totalStock = pVars
        .filter((v) => v.isActive)
        .reduce((s, v) => s + Math.max(0, Number(v.stock || 0)), 0);
      return {
        ...p,
        hasVariants: true,
        stok: totalStock,
        updated_at: nowIso,
      };
    });

    onBulkSaveProductsAndVariants(syncedProducts, nextVariants);
    setImportPreview(null);
    setImportReport({
      successCount,
      failedCount,
      updatedProductsCount: touchedProductIds.size,
      details,
    });
    showToast(
      `Import selesai: ${successCount} varian berhasil, ${failedCount} gagal.`,
      successCount > 0 ? 'success' : 'error'
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar for Product Variants */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-500" />
              <span>Manajemen Produk Varian Rasa</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Kelola produk minuman/makanan dengan banyak pilihan rasa, harga, stok, dan SKU masing-masing.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={downloadProductVariantsExcelTemplate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-bold transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              <span>Template Excel Varian</span>
            </button>

            {canManageCatalog && (
              <button
                type="button"
                onClick={() => excelInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Import Excel Varian</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => exportProductsAndVariantsToExcel(products, variants)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span>Export Excel Varian</span>
            </button>

            {canManageCatalog && (
              <button
                type="button"
                onClick={openCreateMainProductModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-xs font-black shadow-lg shadow-red-950/50 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Produk Varian Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-stone-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk atau varian rasa (contoh: Nutrisari, Pop Ice, Taro, Cappuccino)..."
              className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-10 pr-4 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-orange-600 text-white'
                    : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {selectedProductIdFilter && (
          <div className="flex items-center justify-between bg-orange-950/30 border border-orange-500/40 rounded-xl px-3.5 py-2 text-xs text-orange-200">
            <span>
              Menampilkan varian khusus untuk produk terpilih:{' '}
              <strong className="text-white">
                {products.find((p) => p.id === selectedProductIdFilter)?.nama}
              </strong>
            </span>
            {onClearProductFilter && (
              <button
                type="button"
                onClick={onClearProductFilter}
                className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold cursor-pointer"
              >
                Tampilkan Semua Produk Varian
              </button>
            )}
          </div>
        )}
      </div>

      {/* List of Main Products & Their Variants Table */}
      {displayedProducts.length === 0 ? (
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-10 text-center space-y-3">
          <Layers className="w-10 h-10 text-stone-600 mx-auto" />
          <div className="text-sm font-bold text-stone-200">
            Tidak ada produk varian yang cocok dengan pencarian
          </div>
          <p className="text-xs text-stone-400 max-w-md mx-auto">
            Gunakan tombol &ldquo;+ Produk Varian Baru&rdquo; di atas untuk membuat produk utama beserta daftar varian rasanya.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedProducts.map((product) => {
            const prodVariants = variantsByProduct.get(product.id) || [];
            const isExpanded = expandedProductIds[product.id] ?? true;
            const totalVariantStock = prodVariants.reduce(
              (sum, v) => sum + (v.isActive ? Number(v.stock || 0) : 0),
              0
            );
            const lowStockVariantsCount = prodVariants.filter(
              (v) => v.isActive && v.stock <= v.minStock
            ).length;

            // Filter variants inside product if search query matches specific flavor
            const q = searchQuery.trim().toLowerCase();
            const productMatchesDirectly =
              !q ||
              product.nama.toLowerCase().includes(q) ||
              product.sku.toLowerCase().includes(q);
            const visibleVariants = productMatchesDirectly
              ? prodVariants
              : prodVariants.filter(
                  (v) =>
                    v.variantName.toLowerCase().includes(q) ||
                    v.sku.toLowerCase().includes(q)
                );

            return (
              <div
                key={product.id}
                className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl"
              >
                {/* Product Header Bar */}
                <div className="p-4 sm:p-5 bg-stone-950/70 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={product.foto}
                      alt={product.nama}
                      className="w-14 h-14 rounded-2xl object-cover border border-stone-800 bg-stone-900 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          {product.sku}
                        </span>
                        <span className="text-stone-600">·</span>
                        <span className="text-xs text-orange-400 font-semibold">
                          {product.kategori}
                        </span>
                        <span className="text-stone-600">·</span>
                        <span className="text-xs text-stone-300 font-semibold">
                          {prodVariants.length} Varian Rasa
                        </span>
                        {lowStockVariantsCount > 0 && (
                          <>
                            <span className="text-stone-600">·</span>
                            <span className="text-xs text-rose-400 font-bold">
                              {lowStockVariantsCount} Varian Stok Menipis/Habis
                            </span>
                          </>
                        )}
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-white mt-0.5">
                        Produk: {product.nama.toUpperCase()}
                      </h4>
                      <p className="text-xs text-stone-400">
                        Total Stok Aktif:{' '}
                        <strong className="text-stone-200 font-mono">
                          {totalVariantStock} {product.satuan || 'Cup'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* Product-level Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {canManageCatalog && (
                      <>
                        <button
                          type="button"
                          onClick={() => openAddVariantModal(product)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition shadow cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Tambah Varian Rasa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateProductWithVariants(product)}
                          title="Duplikasi produk beserta semua variannya"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-bold border border-stone-700 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Duplikat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditMainProductModal(product)}
                          title="Edit Produk Utama"
                          className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setProductToDelete(product)}
                          title="Hapus Produk Utama & Variannya"
                          className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold border border-rose-800/50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(product.id)}
                      className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition cursor-pointer"
                      title={isExpanded ? 'Sembunyikan daftar varian' : 'Tampilkan daftar varian'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Variants Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    {visibleVariants.length === 0 ? (
                      <div className="p-6 text-center text-xs text-stone-400 space-y-2">
                        <p>Belum ada varian rasa untuk produk {product.nama}.</p>
                        {canManageCatalog && (
                          <button
                            type="button"
                            onClick={() => openAddVariantModal(product)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white font-bold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Varian Rasa Pertama</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-950/40 border-b border-stone-800 text-[11px] font-bold text-stone-400">
                          <tr>
                            <th className="py-3 px-4">Varian Rasa</th>
                            <th className="py-3 px-3">SKU Varian</th>
                            {canSeeCostPrice && (
                              <th className="py-3 px-3">Harga Modal (Rp)</th>
                            )}
                            <th className="py-3 px-3">Harga Jual (Rp)</th>
                            <th className="py-3 px-3">Stok</th>
                            <th className="py-3 px-3">Stok Min</th>
                            <th className="py-3 px-3">Status</th>
                            {canManageCatalog && (
                              <th className="py-3 px-4 text-right">Aksi</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800/60">
                          {visibleVariants.map((v) => {
                            const pending = inlineEdits[v.variantId];
                            const hasPending = Boolean(pending);
                            const displayPrice = pending?.price ?? v.price;
                            const displayCost = pending?.costPrice ?? v.costPrice;
                            const displayStock = pending?.stock ?? v.stock;
                            const displayMin = pending?.minStock ?? v.minStock;
                            const isOut = v.stock <= 0;
                            const isLow = v.stock > 0 && v.stock <= v.minStock;

                            return (
                              <tr
                                key={v.variantId}
                                className={`hover:bg-stone-800/30 transition ${
                                  !v.isActive ? 'opacity-50' : ''
                                }`}
                              >
                                {/* Varian Rasa */}
                                <td className="py-2.5 px-4 font-bold text-stone-100">
                                  <div className="flex items-center gap-2">
                                    <span>{v.variantName}</span>
                                    {isOut && (
                                      <span className="text-[10px] font-black text-red-400">
                                        · HABIS
                                      </span>
                                    )}
                                    {isLow && (
                                      <span className="text-[10px] font-bold text-orange-400">
                                        · MENIPIS
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* SKU */}
                                <td className="py-2.5 px-3 font-mono text-stone-400">
                                  {v.sku}
                                </td>

                                {/* Harga Modal */}
                                {canSeeCostPrice && (
                                  <td className="py-2.5 px-3 font-mono">
                                    {canManageCatalog ? (
                                      <input
                                        type="number"
                                        min={0}
                                        value={displayCost}
                                        onChange={(e) =>
                                          setInlineEdits((prev) => ({
                                            ...prev,
                                            [v.variantId]: {
                                              ...prev[v.variantId],
                                              costPrice: Number(e.target.value),
                                            },
                                          }))
                                        }
                                        className="w-24 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-lg px-2 py-1 text-xs text-stone-200 font-mono"
                                      />
                                    ) : (
                                      formatRupiah(v.costPrice)
                                    )}
                                  </td>
                                )}

                                {/* Harga Jual */}
                                <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                                  {canManageCatalog ? (
                                    <input
                                      type="number"
                                      min={0}
                                      value={displayPrice}
                                      onChange={(e) =>
                                        setInlineEdits((prev) => ({
                                          ...prev,
                                          [v.variantId]: {
                                            ...prev[v.variantId],
                                            price: Number(e.target.value),
                                          },
                                        }))
                                      }
                                      className="w-24 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-lg px-2 py-1 text-xs text-amber-400 font-bold font-mono"
                                    />
                                  ) : (
                                    formatRupiah(v.price)
                                  )}
                                </td>

                                {/* Stok */}
                                <td className="py-2.5 px-3 font-mono">
                                  {canManageCatalog ? (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min={0}
                                        value={displayStock}
                                        onChange={(e) =>
                                          setInlineEdits((prev) => ({
                                            ...prev,
                                            [v.variantId]: {
                                              ...prev[v.variantId],
                                              stock: Number(e.target.value),
                                            },
                                          }))
                                        }
                                        className={`w-20 bg-stone-950 border rounded-lg px-2 py-1 text-xs font-bold font-mono ${
                                          isOut
                                            ? 'border-red-500/60 text-red-400'
                                            : isLow
                                            ? 'border-orange-500/60 text-orange-400'
                                            : 'border-stone-800 text-stone-100'
                                        }`}
                                      />
                                      <span className="text-[11px] text-stone-400">
                                        {v.unit || 'Cup'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span>
                                      {v.stock} {v.unit || 'Cup'}
                                    </span>
                                  )}
                                </td>

                                {/* Stok Min */}
                                <td className="py-2.5 px-3 font-mono text-stone-400">
                                  {canManageCatalog ? (
                                    <input
                                      type="number"
                                      min={0}
                                      value={displayMin}
                                      onChange={(e) =>
                                        setInlineEdits((prev) => ({
                                          ...prev,
                                          [v.variantId]: {
                                            ...prev[v.variantId],
                                            minStock: Number(e.target.value),
                                          },
                                        }))
                                      }
                                      className="w-16 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-lg px-2 py-1 text-xs text-stone-300 font-mono"
                                    />
                                  ) : (
                                    v.minStock
                                  )}
                                </td>

                                {/* Status Aktif / Nonaktif */}
                                <td className="py-2.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVariantActive(v)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                      v.isActive
                                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/40'
                                        : 'bg-stone-800 text-stone-400 border border-stone-700'
                                    }`}
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>{v.isActive ? 'Aktif' : 'Nonaktif'}</span>
                                  </button>
                                </td>

                                {/* Aksi */}
                                {canManageCatalog && (
                                  <td className="py-2.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {hasPending && (
                                        <button
                                          type="button"
                                          onClick={() => saveInlineVariantEdit(v)}
                                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow cursor-pointer"
                                          title="Simpan perubahan harga/stok"
                                        >
                                          <Check className="w-3 h-3" />
                                          <span>Simpan</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => openEditVariantModal(v)}
                                        className="px-2 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                        title="Edit detail varian"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        <span className="hidden xl:inline">Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setVariantToDelete(v)}
                                        className="px-2 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-800/50 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                        title="Hapus varian rasa"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Hapus</span>
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT VARIANT RASA */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-black text-base text-white">
                {editingVariant ? 'Edit Varian Rasa' : 'Tambah Varian Rasa Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVariantSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-stone-300 block mb-1">Produk Utama</label>
                <select
                  value={variantForm.productId}
                  onChange={(e) =>
                    setVariantForm((prev) => ({ ...prev, productId: e.target.value }))
                  }
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-stone-100 focus:outline-none focus:border-orange-500"
                  required
                >
                  <option value="">-- Pilih Produk Utama --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Nama Varian Rasa *</label>
                  <input
                    type="text"
                    required
                    value={variantForm.variantName}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, variantName: e.target.value }))
                    }
                    placeholder="Contoh: Jeruk Peras / Taro"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Kode SKU Varian</label>
                  <input
                    type="text"
                    required
                    value={variantForm.sku}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="SKU-NUT-01"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-amber-400 font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Harga Modal (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={variantForm.costPrice}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        costPrice: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={variantForm.price}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        price: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-amber-400 font-bold font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Stok Saat Ini</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={variantForm.stock}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        stock: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Stok Minimum</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={variantForm.minStock}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        minStock: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Satuan</label>
                  <input
                    type="text"
                    value={variantForm.unit}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, unit: e.target.value }))
                    }
                    placeholder="Cup / Gelas"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={variantForm.isActive}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="rounded accent-orange-500"
                  />
                  <span className="font-bold text-stone-200">Varian Aktif (Tampil di Kasir POS)</span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-800">
                <div>
                  {editingVariant && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsVariantModalOpen(false);
                        setVariantToDelete(editingVariant);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-600 border border-rose-800/60 text-rose-300 hover:text-white font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Varian</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVariantModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-black shadow-lg cursor-pointer"
                  >
                    Simpan Varian
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT MAIN PRODUCT WITH VARIANTS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-black text-base text-white">
                {editingMainProduct
                  ? `Edit Produk Utama: ${editingMainProduct.nama}`
                  : 'Tambah Produk Utama & Varian Rasa'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMainProductSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Nama Produk Utama *</label>
                  <input
                    type="text"
                    required
                    value={mainProductForm.nama}
                    onChange={(e) =>
                      setMainProductForm((prev) => ({ ...prev, nama: e.target.value }))
                    }
                    placeholder="Contoh: Nutrisari / Pop Ice / Milo"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Kode SKU Produk</label>
                  <input
                    type="text"
                    required
                    value={mainProductForm.sku}
                    onChange={(e) =>
                      setMainProductForm((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-amber-400 font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Kategori</label>
                  <select
                    value={mainProductForm.kategori}
                    onChange={(e) =>
                      setMainProductForm((prev) => ({
                        ...prev,
                        kategori: e.target.value as ProductCategory,
                      }))
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100"
                  >
                    <option value="Minuman">Minuman</option>
                    <option value="Makanan">Makanan</option>
                    <option value="Snack">Snack</option>
                    <option value="Tambahan">Tambahan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Harga Modal Default</label>
                  <input
                    type="number"
                    min={0}
                    value={mainProductForm.harga_modal}
                    onChange={(e) =>
                      setMainProductForm((prev) => ({
                        ...prev,
                        harga_modal: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Harga Jual Default</label>
                  <input
                    type="number"
                    min={0}
                    value={mainProductForm.harga_jual}
                    onChange={(e) =>
                      setMainProductForm((prev) => ({
                        ...prev,
                        harga_jual: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-amber-400 font-bold font-mono"
                  />
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="font-bold text-stone-300 block mb-1">Gambar Produk</label>
                <div className="flex items-center gap-3">
                  <img
                    src={mainProductForm.foto}
                    alt="Preview"
                    className="w-14 h-14 rounded-2xl object-cover bg-stone-950 border border-stone-800 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={mainProductForm.foto}
                      onChange={(e) =>
                        setMainProductForm((prev) => ({ ...prev, foto: e.target.value }))
                      }
                      placeholder="URL Gambar atau unggah foto..."
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-stone-200"
                    />
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isUploadingPhoto ? 'Mengunggah...' : 'Upload Gambar dari HP/Laptop'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {!editingMainProduct && (
                <div>
                  <label className="font-bold text-stone-300 block mb-1">
                    Daftar Varian Rasa Awal (Pisahkan dengan koma atau baris baru)
                  </label>
                  <textarea
                    rows={3}
                    value={mainProductForm.initialFlavorsText}
                    onChange={(e) =>
                      setMainProductForm((prev) => ({
                        ...prev,
                        initialFlavorsText: e.target.value,
                      }))
                    }
                    placeholder="Contoh: Cokelat, Strawberry, Melon, Mangga, Taro, Cappuccino"
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-100 focus:outline-none focus:border-orange-500"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">
                    Setiap rasa otomatis dibuatkan varian dengan Harga Jual {formatRupiah(mainProductForm.harga_jual)} dan Stok 20 {mainProductForm.satuan}.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-800">
                <div>
                  {editingMainProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProductModalOpen(false);
                        setProductToDelete(editingMainProduct);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-600 border border-rose-800/60 text-rose-300 hover:text-white font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Produk</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-black shadow-lg cursor-pointer"
                  >
                    Simpan Produk
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PRODUK UTAMA & VARIAN */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-rose-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">
                  Hapus Produk Utama & Varian?
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-medium">
                  Produk <strong className="text-amber-400">&ldquo;{productToDelete.nama}&rdquo;</strong>{' '}
                  beserta{' '}
                  <strong>{(variantsByProduct.get(productToDelete.id) || []).length} varian rasa</strong>{' '}
                  di dalamnya akan dihapus dari katalog.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = productToDelete;
                  setProductToDelete(null);
                  if (selectedProductIdFilter === target.id && onClearProductFilter) {
                    onClearProductFilter();
                  }
                  onDeleteProduct(target.id);
                  showToast(
                    `Produk utama "${target.nama}" beserta variannya berhasil dihapus.`,
                    'success'
                  );
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs shadow-lg shadow-rose-950/50 transition active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Produk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS VARIAN RASA */}
      {variantToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border-2 border-rose-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">
                  Hapus Varian Rasa?
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-medium">
                  Anda yakin ingin menghapus varian rasa{' '}
                  <strong className="text-amber-400">&ldquo;{variantToDelete.variantName}&rdquo;</strong>{' '}
                  (<span className="font-mono">{variantToDelete.sku}</span>)?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setVariantToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = variantToDelete;
                  setVariantToDelete(null);
                  onDeleteVariant(target.variantId);
                  showToast(`Varian rasa "${target.variantName}" berhasil dihapus.`, 'success');
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs shadow-lg shadow-rose-950/50 transition active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Varian</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EXCEL IMPORT PREVIEW BEFORE IMPORT (Section 9) */}
      {importPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-4xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <h3 className="font-black text-base sm:text-lg text-white">
                  Pratinjau Import Excel Produk & Varian Rasa
                </h3>
                <p className="text-xs text-stone-400">
                  Periksa hasil validasi harga, stok, dan deteksi duplikat sebelum menyimpan ke database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800">
                <div className="text-stone-400">Produk Dikelompokkan</div>
                <div className="text-lg font-black text-white font-mono">
                  {importPreview.uniqueProductNames.length} Produk
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-stone-950 border border-emerald-800/50">
                <div className="text-emerald-400">Varian Valid</div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {importPreview.validCount} Baris
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-stone-950 border border-amber-800/50">
                <div className="text-amber-400">Terdeteksi Duplikat</div>
                <div className="text-lg font-black text-amber-400 font-mono">
                  {importPreview.duplicateCount} Baris
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-stone-950 border border-rose-800/50">
                <div className="text-rose-400">Tidak Valid / Gagal</div>
                <div className="text-lg font-black text-rose-400 font-mono">
                  {importPreview.invalidCount} Baris
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-y-auto border border-stone-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-950 border-b border-stone-800 text-[11px] font-bold text-stone-400 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Baris</th>
                    <th className="py-2.5 px-3">Nama Produk</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Nama Varian</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Modal</th>
                    <th className="py-2.5 px-3">Harga Jual</th>
                    <th className="py-2.5 px-3">Stok</th>
                    <th className="py-2.5 px-3">Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60">
                  {importPreview.rows.map((r) => (
                    <tr key={r.rowNum} className={r.isValid ? '' : 'bg-rose-950/20'}>
                      <td className="py-2 px-3 font-mono text-stone-400">#{r.rowNum}</td>
                      <td className="py-2 px-3 font-bold text-stone-100">{r.productName || '-'}</td>
                      <td className="py-2 px-3 text-stone-300">{r.category}</td>
                      <td className="py-2 px-3 font-bold text-amber-300">{r.variantName || '-'}</td>
                      <td className="py-2 px-3 font-mono text-stone-400">{r.sku}</td>
                      <td className="py-2 px-3 font-mono">{formatRupiah(r.costPrice)}</td>
                      <td className="py-2 px-3 font-mono font-bold text-amber-400">
                        {formatRupiah(r.price)}
                      </td>
                      <td className="py-2 px-3 font-mono">{r.stock}</td>
                      <td className="py-2 px-3">
                        {r.isValid ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{r.errorReason || 'Siap Import'}</span>
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{r.errorReason}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importPreview.validCount === 0}
                onClick={handleConfirmExcelImport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-lg disabled:opacity-40 cursor-pointer"
              >
                Proses Import ({importPreview.validCount} Varian Valid)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: LAPORAN HASIL IMPORT (BERHASIL & GAGAL) */}
      {importReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h3 className="font-black text-base text-white">Laporan Hasil Import Excel</h3>
              <button
                type="button"
                onClick={() => setImportReport(null)}
                className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs text-center">
              <div className="p-3 rounded-2xl bg-stone-950 border border-emerald-800/50">
                <div className="text-stone-400">Berhasil</div>
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {importReport.successCount}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-stone-950 border border-rose-800/50">
                <div className="text-stone-400">Gagal</div>
                <div className="text-lg font-black text-rose-400 font-mono">
                  {importReport.failedCount}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800">
                <div className="text-stone-400">Produk Terkait</div>
                <div className="text-lg font-black text-amber-400 font-mono">
                  {importReport.updatedProductsCount}
                </div>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto bg-stone-950 border border-stone-800 rounded-2xl p-3 space-y-1.5 text-[11px] font-mono text-stone-300">
              {importReport.details.map((d, i) => (
                <div
                  key={i}
                  className={d.includes('GAGAL') ? 'text-rose-400' : 'text-emerald-300'}
                >
                  • {d}
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setImportReport(null)}
                className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-black cursor-pointer"
              >
                Tutup Laporan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
