import {
  Product,
  ProductVariant,
  Transaction,
  Customer,
  Expense,
  StockMutation,
  StoreSettings,
  SyncState,
  CategoryItem,
  WarungUser,
  DeliveryProof,
} from '../types';
import {
  resolveOrderType,
  normalizeOrderStatus,
  normalizeDeliveryStatus,
} from '../utils/formatters';
import {
  INITIAL_PRODUCTS,
  INITIAL_PRODUCT_VARIANTS,
  INDOMIE_PARENT_PRODUCT,
  VARIANT_PARENT_PRODUCTS,
  INDOMIE_INITIAL_VARIANTS,
  INITIAL_SETTINGS,
  INITIAL_CUSTOMERS,
  INITIAL_EXPENSES,
  INITIAL_TRANSACTIONS,
  INITIAL_STOCK_MUTATIONS,
  INITIAL_CATEGORIES,
  INITIAL_USERS,
} from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'wkb_pos_products',
  PRODUCTS_SEEDED_V2: 'wkb_pos_products_seeded_33_v3',
  INDOMIE_PRODUCT_SEEDED: 'wkb_pos_indomie_product_seeded_v1',
  PRODUCTS_ADMIN_CLEARED: 'wkb_pos_products_admin_cleared_v2',
  PRODUCT_VARIANTS: 'wkb_pos_product_variants',
  PRODUCT_VARIANTS_SEEDED: 'wkb_pos_product_variants_seeded_v1',
  INDOMIE_VARIANTS_SEEDED: 'wkb_pos_indomie_variants_seeded_v1',
  CATEGORIES: 'wkb_pos_categories',
  USERS: 'wkb_pos_users',
  AUTH_USER: 'wkb_pos_auth_user',
  TRANSACTIONS: 'wkb_pos_transactions',
  CUSTOMERS: 'wkb_pos_customers',
  EXPENSES: 'wkb_pos_expenses',
  STOCK_MUTATIONS: 'wkb_pos_stock_mutations',
  SETTINGS: 'wkb_pos_settings',
  SYNC_STATE: 'wkb_pos_sync_state',
  OFFLINE_QUEUE: 'wkb_pos_offline_queue',
  DELIVERY_PROOFS: 'wkb_pos_delivery_proofs',
  DELETED_PRODUCT_IDS: 'wkb_pos_deleted_product_ids_v1',
  DELETED_VARIANT_IDS: 'wkb_pos_deleted_variant_ids_v1',
};

export function normalizeProductVariant(raw: any, fallbackId?: string): ProductVariant {
  const variantId = String(raw?.variantId || raw?.id || fallbackId || `VAR-${Date.now()}`).trim();
  const productId = String(raw?.productId || raw?.id_produk || '').trim();
  const productName = String(raw?.productName || raw?.nama_produk || '').trim();
  const variantName = String(raw?.variantName || raw?.nama_varian || 'Original').trim();
  const sku = String(raw?.sku || variantId).trim();
  const priceNum = Number(raw?.price ?? raw?.harga_jual ?? 5000);
  const costNum = Number(raw?.costPrice ?? raw?.harga_modal ?? 3000);
  const stockNum = Number(raw?.stock ?? raw?.stok ?? 0);
  const minStockNum = Number(raw?.minStock ?? raw?.stok_minimum ?? 5);
  const unit = String(raw?.unit || raw?.satuan || 'Cup').trim();
  const imageUrl = String(raw?.imageUrl || raw?.foto || '');
  const isActive =
    raw?.isActive !== undefined
      ? Boolean(raw.isActive)
      : raw?.status === 'Nonaktif'
      ? false
      : true;
  const createdAt = String(raw?.createdAt || raw?.created_at || new Date().toISOString());
  const updatedAt = String(raw?.updatedAt || raw?.updated_at || createdAt);

  return {
    variantId,
    productId,
    productName,
    variantName,
    sku,
    price: Number.isNaN(priceNum) ? 0 : priceNum,
    costPrice: Number.isNaN(costNum) ? 0 : costNum,
    stock: Number.isNaN(stockNum) ? 0 : stockNum,
    minStock: Number.isNaN(minStockNum) ? 5 : minStockNum,
    unit,
    imageUrl,
    isActive,
    createdAt,
    updatedAt,
  };
}

export function normalizeProduct(raw: any, fallbackId?: string): Product {
  const id = String(raw?.id || fallbackId || raw?.sku || `PROD-${Date.now()}`).trim();
  const sku = String(raw?.sku || id).trim();
  const nama = String(raw?.nama || raw?.name || 'Menu').trim();
  const rawKat = String(raw?.kategori || raw?.categoryId || raw?.category || 'Makanan').trim();
  const validCategories = ['Makanan', 'Minuman', 'Snack', 'Tambahan', 'Lainnya'];
  const kategori = (validCategories.includes(rawKat) ? rawKat : 'Makanan') as Product['kategori'];
  const modalNum = Number(raw?.harga_modal ?? raw?.costPrice ?? 0);
  const harga_modal = Number.isNaN(modalNum) ? 0 : modalNum;
  const jualNum = Number(raw?.harga_jual ?? raw?.price ?? 0);
  const harga_jual = Number.isNaN(jualNum) ? 0 : jualNum;
  const satuan = String(raw?.satuan || raw?.unit || 'Porsi').trim();
  const stokNum = Number(raw?.stok ?? raw?.stock ?? 0);
  const stok = Number.isNaN(stokNum) ? 0 : stokNum;
  const stokMinNum = Number(raw?.stok_minimum ?? raw?.minimumStock ?? 5);
  const stok_minimum = Number.isNaN(stokMinNum) ? 5 : stokMinNum;
  const foto = String(raw?.foto || raw?.gambar_url || raw?.imageUrl || '');
  const status: Product['status'] =
    raw?.status === 'Nonaktif' || raw?.productStatus === 'INACTIVE' ? 'Nonaktif' : 'Aktif';
  const deskripsi = String(raw?.deskripsi || raw?.description || '');
  const created_at = String(raw?.created_at || new Date().toISOString());
  const updated_at = String(raw?.updated_at || created_at);

  return {
    id,
    sku,
    nama,
    kategori,
    harga_modal,
    harga_jual,
    satuan,
    stok,
    stok_minimum,
    foto,
    gambar_url: foto,
    status,
    deskripsi,
    hasVariants: Boolean(raw?.hasVariants),
    created_at,
    updated_at,
  };
}

export function compareProductBySkuOrder(a: Product, b: Product): number {
  const skuA = String(a?.sku || a?.id || '').trim();
  const skuB = String(b?.sku || b?.id || '').trim();
  const numA = parseInt(skuA.replace(/\D+/g, ''), 10);
  const numB = parseInt(skuB.replace(/\D+/g, ''), 10);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
    return numA - numB;
  }
  return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortProductsBySkuOrder(products: Product[]): Product[] {
  if (!Array.isArray(products)) return [];
  const normalized = products
    .filter((p) => p && typeof p === 'object')
    .map((p, idx) => normalizeProduct(p, `PROD-${String(idx + 1).padStart(3, '0')}`));
  const seenSkus = new Set<string>();
  const deduped: Product[] = [];
  for (const prod of normalized) {
    const key = String(prod.sku || prod.id).trim();
    if (!seenSkus.has(key)) {
      seenSkus.add(key);
      deduped.push(prod);
    }
  }
  return deduped.sort(compareProductBySkuOrder);
}

function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Error reading ${key} from storage:`, error);
    return fallback;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to storage:`, error);
  }
}

export class StorageService {
  // DELETED PRODUCT & VARIANT TRACKING (Prevents cloud/local re-seeding of explicitly deleted items)
  static getDeletedProductIds(): Set<string> {
    const arr = safeGetItem<string[]>(STORAGE_KEYS.DELETED_PRODUCT_IDS, []);
    return new Set(Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : []);
  }

  static addDeletedProductId(id: string, sku?: string): void {
    const set = this.getDeletedProductIds();
    if (id) set.add(String(id).trim());
    if (sku) set.add(String(sku).trim());
    safeSetItem(STORAGE_KEYS.DELETED_PRODUCT_IDS, Array.from(set));
  }

  static removeDeletedProductId(id: string, sku?: string): void {
    const set = this.getDeletedProductIds();
    if (id) set.delete(String(id).trim());
    if (sku) set.delete(String(sku).trim());
    safeSetItem(STORAGE_KEYS.DELETED_PRODUCT_IDS, Array.from(set));
  }

  static getDeletedVariantIds(): Set<string> {
    const arr = safeGetItem<string[]>(STORAGE_KEYS.DELETED_VARIANT_IDS, []);
    return new Set(Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : []);
  }

  static addDeletedVariantId(variantId: string, sku?: string): void {
    const set = this.getDeletedVariantIds();
    if (variantId) set.add(String(variantId).trim());
    if (sku) set.add(String(sku).trim());
    safeSetItem(STORAGE_KEYS.DELETED_VARIANT_IDS, Array.from(set));
  }

  static removeDeletedVariantId(variantId: string, sku?: string): void {
    const set = this.getDeletedVariantIds();
    if (variantId) set.delete(String(variantId).trim());
    if (sku) set.delete(String(sku).trim());
    safeSetItem(STORAGE_KEYS.DELETED_VARIANT_IDS, Array.from(set));
  }

  // PRODUCTS
  static getProducts(): Product[] {
    const deletedIds = this.getDeletedProductIds();
    try {
      if (localStorage.getItem(STORAGE_KEYS.PRODUCTS_ADMIN_CLEARED) === 'true') {
        return safeGetItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
      }
    } catch {
      // ignore storage errors
    }
    const stored = safeGetItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    if (!Array.isArray(stored) || stored.length === 0) {
      if (deletedIds.size > 0) {
        return [];
      }
      return sortProductsBySkuOrder(INITIAL_PRODUCTS);
    }
    const filtered = stored.filter(
      (p) => p && !deletedIds.has(String(p.id).trim()) && !deletedIds.has(String(p.sku || '').trim())
    );
    return sortProductsBySkuOrder(filtered);
  }

  static saveProducts(products: Product[], unmarkDeleted = false): void {
    const list = Array.isArray(products) ? products : [];
    if (unmarkDeleted && list.length > 0) {
      const deletedSet = this.getDeletedProductIds();
      let changed = false;
      list.forEach((p) => {
        if (!p) return;
        const pid = String(p.id || '').trim();
        const psku = String(p.sku || '').trim();
        if (pid && deletedSet.delete(pid)) changed = true;
        if (psku && deletedSet.delete(psku)) changed = true;
      });
      if (changed) {
        safeSetItem(STORAGE_KEYS.DELETED_PRODUCT_IDS, Array.from(deletedSet));
      }
    }
    if (list.length > 0) {
      try {
        localStorage.removeItem(STORAGE_KEYS.PRODUCTS_ADMIN_CLEARED);
      } catch {
        // ignore
      }
      safeSetItem(STORAGE_KEYS.PRODUCTS, sortProductsBySkuOrder(list));
    } else {
      try {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS_ADMIN_CLEARED, 'true');
      } catch {
        // ignore
      }
      safeSetItem(STORAGE_KEYS.PRODUCTS, []);
    }
  }

  static clearAllProducts(): Product[] {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS_SEEDED_V2, 'true');
      localStorage.setItem(STORAGE_KEYS.PRODUCTS_ADMIN_CLEARED, 'true');
    } catch {
      // ignore
    }
    safeSetItem(STORAGE_KEYS.PRODUCTS, []);
    return [];
  }

  static addProduct(product: Product): Product[] {
    const stamped: Product = {
      ...product,
      updated_at: product.updated_at || new Date().toISOString(),
    };
    this.removeDeletedProductId(stamped.id, stamped.sku);
    const products = this.getProducts();
    const existingIndex = products.findIndex(
      (p) => p.id === stamped.id || (stamped.sku && p.sku === stamped.sku)
    );
    let updated: Product[];
    if (existingIndex >= 0) {
      updated = products.map((p, idx) => (idx === existingIndex ? stamped : p));
    } else {
      updated = [...products, stamped];
    }
    const sorted = sortProductsBySkuOrder(updated);
    this.saveProducts(sorted);
    return sorted;
  }

  static updateProduct(product: Product, syncVariants = true): Product[] {
    const stamped: Product = {
      ...product,
      updated_at: new Date().toISOString(),
    };
    this.removeDeletedProductId(stamped.id, stamped.sku);
    const products = this.getProducts();
    const exists = products.some(
      (p) => p.id === stamped.id || (stamped.sku && p.sku === stamped.sku)
    );
    const nextList = exists
      ? products.map((p) =>
          p.id === stamped.id || (stamped.sku && p.sku === stamped.sku) ? stamped : p
        )
      : [...products, stamped];
    const updated = sortProductsBySkuOrder(nextList);
    this.saveProducts(updated);

    if (syncVariants) {
      const cleanId = String(stamped.id || '').trim();
      const cleanSku = String(stamped.sku || '').trim();
      const cleanName = String(stamped.nama || '').trim().toLowerCase();
      const allVariants = this.getProductVariants();
      let varChanged = false;
      const updatedVariants = allVariants.map((v) => {
        const isMatch =
          String(v.productId || '').trim() === cleanId ||
          (cleanSku && String(v.productId || '').trim() === cleanSku) ||
          (v.productName && String(v.productName).trim().toLowerCase() === cleanName);
        if (!isMatch) return v;
        varChanged = true;
        return {
          ...v,
          price: Number(stamped.harga_jual) || v.price,
          costPrice: Number(stamped.harga_modal) || v.costPrice,
          updatedAt: stamped.updated_at,
        };
      });
      if (varChanged) {
        this.saveProductVariants(updatedVariants);
      }
    }

    return updated;
  }

  static syncAllVariantPricesWithProducts(): {
    updatedVariants: ProductVariant[];
    changedCount: number;
  } {
    const products = this.getProducts();
    const variants = this.getProductVariants();
    let changedCount = 0;
    const nowIso = new Date().toISOString();

    const productMap = new Map<string, Product>();
    products.forEach((p) => {
      productMap.set(String(p.id).trim(), p);
      if (p.sku) productMap.set(String(p.sku).trim(), p);
      if (p.nama) productMap.set(String(p.nama).trim().toLowerCase(), p);
    });

    const updatedVariants = variants.map((v) => {
      const parent =
        productMap.get(String(v.productId).trim()) ||
        (v.sku ? productMap.get(String(v.sku).trim()) : undefined) ||
        (v.productName ? productMap.get(String(v.productName).trim().toLowerCase()) : undefined);

      if (parent && (v.price !== parent.harga_jual || v.costPrice !== parent.harga_modal)) {
        changedCount++;
        return {
          ...v,
          price: Number(parent.harga_jual) || v.price,
          costPrice: Number(parent.harga_modal) || v.costPrice,
          updatedAt: nowIso,
        };
      }
      return v;
    });

    if (changedCount > 0) {
      this.saveProductVariants(updatedVariants);
    }

    return { updatedVariants, changedCount };
  }

  static deleteProductsBulk(productIds: string[]): {
    products: Product[];
    variants: ProductVariant[];
    removedProducts: Product[];
    removedVariants: ProductVariant[];
  } {
    const cleanInputIds = new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );
    const products = this.getProducts();
    const allVariants = this.getProductVariants();
    if (cleanInputIds.size === 0) {
      return {
        products,
        variants: allVariants,
        removedProducts: [],
        removedVariants: [],
      };
    }

    const matchedProducts = products.filter(
      (p) =>
        cleanInputIds.has(String(p.id).trim()) ||
        cleanInputIds.has(String(p.sku || '').trim())
    );

    const targetIds = new Set<string>(cleanInputIds);
    matchedProducts.forEach((mp) => {
      if (mp.id) targetIds.add(String(mp.id).trim());
      if (mp.sku) targetIds.add(String(mp.sku).trim());
    });

    targetIds.forEach((tid) => this.addDeletedProductId(tid));
    matchedProducts.forEach((mp) => this.addDeletedProductId(mp.id, mp.sku));

    const updatedProducts = sortProductsBySkuOrder(
      products.filter(
        (p) => !targetIds.has(String(p.id).trim()) && !targetIds.has(String(p.sku || '').trim())
      )
    );
    this.saveProducts(updatedProducts);

    const variantsToRemove = allVariants.filter((v) =>
      targetIds.has(String(v.productId).trim())
    );
    variantsToRemove.forEach((v) => this.addDeletedVariantId(v.variantId, v.sku));
    const remainingVariants = allVariants.filter(
      (v) => !targetIds.has(String(v.productId).trim())
    );
    this.saveProductVariants(remainingVariants);

    return {
      products: updatedProducts,
      variants: remainingVariants,
      removedProducts: matchedProducts,
      removedVariants: variantsToRemove,
    };
  }

  static deleteProduct(productId: string): Product[] {
    const cleanTargetId = String(productId || '').trim();
    const products = this.getProducts();
    const matchedProducts = products.filter(
      (p) => String(p.id).trim() === cleanTargetId || String(p.sku || '').trim() === cleanTargetId
    );
    this.addDeletedProductId(cleanTargetId);
    matchedProducts.forEach((mp) => {
      this.addDeletedProductId(mp.id, mp.sku);
    });

    const targetIds = new Set<string>([cleanTargetId]);
    matchedProducts.forEach((mp) => {
      if (mp.id) targetIds.add(String(mp.id).trim());
      if (mp.sku) targetIds.add(String(mp.sku).trim());
    });

    const updated = sortProductsBySkuOrder(
      products.filter(
        (p) => !targetIds.has(String(p.id).trim()) && !targetIds.has(String(p.sku || '').trim())
      )
    );
    this.saveProducts(updated);

    // Also remove variants belonging to this product
    const allVariants = this.getProductVariants();
    const variantsToRemove = allVariants.filter((v) => targetIds.has(String(v.productId).trim()));
    variantsToRemove.forEach((v) => this.addDeletedVariantId(v.variantId, v.sku));
    const remainingVariants = allVariants.filter((v) => !targetIds.has(String(v.productId).trim()));
    this.saveProductVariants(remainingVariants);
    return updated;
  }

  // PRODUCT VARIANTS
  static getProductVariants(): ProductVariant[] {
    const deletedVarIds = this.getDeletedVariantIds();
    const deletedProdIds = this.getDeletedProductIds();
    try {
      if (localStorage.getItem(STORAGE_KEYS.PRODUCTS_ADMIN_CLEARED) === 'true') {
        return safeGetItem<ProductVariant[]>(STORAGE_KEYS.PRODUCT_VARIANTS, []);
      }
    } catch {
      // ignore
    }
    const stored = safeGetItem<ProductVariant[]>(
      STORAGE_KEYS.PRODUCT_VARIANTS,
      []
    );
    if (!Array.isArray(stored) || stored.length === 0) {
      if (deletedVarIds.size > 0 || deletedProdIds.size > 0) {
        return [];
      }
      return INITIAL_PRODUCT_VARIANTS.map((v, idx) => normalizeProductVariant(v, `VAR-${idx + 1}`));
    }
    return stored
      .filter((v) => v && typeof v === 'object')
      .map((v, idx) => normalizeProductVariant(v, `VAR-${idx + 1}`))
      .filter(
        (v) =>
          !deletedVarIds.has(String(v.variantId || '').trim()) &&
          !deletedVarIds.has(String(v.sku || '').trim()) &&
          !deletedProdIds.has(String(v.productId || '').trim())
      );
  }

  static saveProductVariants(variants: ProductVariant[], unmarkDeleted = false): void {
    const list = Array.isArray(variants)
      ? variants.filter((v) => v && typeof v === 'object').map((v, i) => normalizeProductVariant(v, `VAR-${i + 1}`))
      : [];
    if (unmarkDeleted && list.length > 0) {
      const deletedVarSet = this.getDeletedVariantIds();
      let changed = false;
      list.forEach((v) => {
        const vid = String(v.variantId || '').trim();
        const vsku = String(v.sku || '').trim();
        if (vid && deletedVarSet.delete(vid)) changed = true;
        if (vsku && deletedVarSet.delete(vsku)) changed = true;
      });
      if (changed) {
        safeSetItem(STORAGE_KEYS.DELETED_VARIANT_IDS, Array.from(deletedVarSet));
      }
    }
    safeSetItem(STORAGE_KEYS.PRODUCT_VARIANTS, list);
  }

  static syncParentProductFromVariants(productId: string, currentVariants?: ProductVariant[]): Product[] {
    const variants = currentVariants ?? this.getProductVariants();
    const prodVariants = variants.filter((v) => v.productId === productId);
    const products = this.getProducts();
    const updatedProducts = products.map((p) => {
      if (p.id !== productId) return p;
      if (prodVariants.length === 0) {
        return { ...p, hasVariants: false, updated_at: new Date().toISOString() };
      }
      const activeVars = prodVariants.filter((v) => v.isActive);
      const totalStock = (activeVars.length > 0 ? activeVars : prodVariants).reduce(
        (sum, v) => sum + Math.max(0, Number(v.stock || 0)),
        0
      );
      return {
        ...p,
        hasVariants: true,
        stok: totalStock,
        updated_at: new Date().toISOString(),
      };
    });
    this.saveProducts(updatedProducts);
    return updatedProducts;
  }

  static addProductVariant(variant: ProductVariant): {
    variants: ProductVariant[];
    products: Product[];
  } {
    const norm = normalizeProductVariant(variant);
    this.removeDeletedVariantId(norm.variantId, norm.sku);
    const variants = this.getProductVariants();
    const existingIdx = variants.findIndex(
      (v) =>
        v.variantId === norm.variantId ||
        (v.productId === norm.productId &&
          v.variantName.toLowerCase() === norm.variantName.toLowerCase())
    );
    let updated: ProductVariant[];
    if (existingIdx >= 0) {
      updated = variants.map((v, i) => (i === existingIdx ? norm : v));
    } else {
      updated = [...variants, norm];
    }
    this.saveProductVariants(updated);
    const products = this.syncParentProductFromVariants(norm.productId, updated);
    return { variants: updated, products };
  }

  static updateProductVariant(variant: ProductVariant): {
    variants: ProductVariant[];
    products: Product[];
  } {
    const norm = normalizeProductVariant({
      ...variant,
      updatedAt: new Date().toISOString(),
    });
    this.removeDeletedVariantId(norm.variantId, norm.sku);
    const variants = this.getProductVariants();
    const exists = variants.some((v) => v.variantId === norm.variantId);
    const updated = exists
      ? variants.map((v) => (v.variantId === norm.variantId ? norm : v))
      : [...variants, norm];
    this.saveProductVariants(updated);
    const products = this.syncParentProductFromVariants(norm.productId, updated);
    return { variants: updated, products };
  }

  static deleteProductVariant(variantId: string): {
    variants: ProductVariant[];
    products: Product[];
  } {
    const cleanId = String(variantId || '').trim();
    const variants = this.getProductVariants();
    const target = variants.find((v) => v.variantId === cleanId || v.sku === cleanId);
    this.addDeletedVariantId(cleanId, target?.sku);
    if (target) {
      this.addDeletedVariantId(target.variantId, target.sku);
    }
    const updated = variants.filter((v) => v.variantId !== cleanId && v.sku !== cleanId);
    this.saveProductVariants(updated);
    const products = target
      ? this.syncParentProductFromVariants(target.productId, updated)
      : this.getProducts();
    return { variants: updated, products };
  }

  // CATEGORIES
  static getCategories(): CategoryItem[] {
    return safeGetItem<CategoryItem[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
  }

  static saveCategories(categories: CategoryItem[]): void {
    safeSetItem(STORAGE_KEYS.CATEGORIES, categories);
  }

  static addCategory(category: CategoryItem): CategoryItem[] {
    const categories = this.getCategories();
    const updated = [...categories, category];
    this.saveCategories(updated);
    return updated;
  }

  static updateCategory(category: CategoryItem): CategoryItem[] {
    const categories = this.getCategories();
    const updated = categories.map((c) => (c.id === category.id ? category : c));
    this.saveCategories(updated);
    return updated;
  }

  static deleteCategory(categoryId: string): CategoryItem[] {
    const categories = this.getCategories();
    const updated = categories.filter((c) => c.id !== categoryId);
    this.saveCategories(updated);
    return updated;
  }

  // USERS & AUTH
  static getUsers(): WarungUser[] {
    const users = safeGetItem<WarungUser[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    // If the saved array is missing Rayyan or key initial roles, merge initial users
    const hasRayyan = users.some((u) => u.email === 'rayyanarasid549@gmail.com' || u.id === 'USR-RAYYAN');
    const hasOwner = users.some((u) => u.role === 'Owner' || u.username === 'owner');
    const hasStaff = users.some((u) => u.role === 'Staff');
    const hasDelivery = users.some((u) => u.role === 'Delivery' || u.role === 'DELIVERY');
    const hasCustomer = users.some((u) => u.role === 'Customer');
    if (!hasRayyan || !hasOwner || !hasStaff || !hasDelivery || !hasCustomer) {
      const merged = [...users];
      INITIAL_USERS.forEach((initUser) => {
        if (!merged.some((m) => m.id === initUser.id || (initUser.email && m.email === initUser.email))) {
          merged.unshift(initUser);
        }
      });
      safeSetItem(STORAGE_KEYS.USERS, merged);
      return merged;
    }
    return users;
  }

  static saveUsers(users: WarungUser[]): void {
    safeSetItem(STORAGE_KEYS.USERS, users);
  }

  static getAuthUser(): WarungUser | null {
    return safeGetItem<WarungUser | null>(STORAGE_KEYS.AUTH_USER, null);
  }

  static setAuthUser(user: WarungUser | null): void {
    if (user) {
      safeSetItem(STORAGE_KEYS.AUTH_USER, user);
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      } catch (e) {
        console.error('Error removing auth user:', e);
      }
    }
  }

  static logout(): void {
    this.setAuthUser(null);
  }

  static addUser(user: WarungUser): WarungUser[] {
    const users = this.getUsers();
    const existingIndex = users.findIndex(
      (u) => u.id === user.id || (user.email && u.email?.toLowerCase() === user.email.toLowerCase())
    );
    let updated: WarungUser[];
    if (existingIndex >= 0) {
      updated = users.map((u, i) => (i === existingIndex ? { ...u, ...user } : u));
    } else {
      updated = [user, ...users];
    }
    this.saveUsers(updated);
    return updated;
  }

  static updateUser(user: WarungUser): WarungUser[] {
    const users = this.getUsers();
    const updated = users.map((u) => (u.id === user.id ? user : u));
    this.saveUsers(updated);
    return updated;
  }

  static deleteUser(userId: string): WarungUser[] {
    const users = this.getUsers();
    const updated = users.filter((u) => u.id !== userId);
    this.saveUsers(updated);
    return updated;
  }

  // TRANSACTIONS & INVOICE NUMBER GENERATION
  static getTransactions(): Transaction[] {
    const raw = safeGetItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    if (!Array.isArray(raw)) return INITIAL_TRANSACTIONS;
    return raw
      .filter((tx) => tx && typeof tx === 'object')
      .map((tx) => {
        const ordType = resolveOrderType(tx);
        const isDelivery = ordType === 'DELIVERY_DQM';
        const rawItems = Array.isArray(tx.items) ? tx.items : [];
        return {
          ...tx,
          id_transaksi: String(tx.id_transaksi || `WBK-${Date.now()}`),
          tanggal: String(tx.tanggal || new Date().toISOString().split('T')[0]),
          jam: String(tx.jam || '10:00'),
          kasir: String(tx.kasir || 'Kasir'),
          nama_pelanggan: String(tx.nama_pelanggan || 'Pelanggan Umum'),
          no_whatsapp: String(tx.no_whatsapp || '-'),
          ...(tx.email_pelanggan ? { email_pelanggan: String(tx.email_pelanggan).trim() } : {}),
          ...(tx.emailReceiptStatus ? { emailReceiptStatus: tx.emailReceiptStatus } : {}),
          ...(tx.emailReceiptSentAt ? { emailReceiptSentAt: String(tx.emailReceiptSentAt) } : {}),
          ...(tx.emailReceiptTarget ? { emailReceiptTarget: String(tx.emailReceiptTarget) } : {}),
          ...(tx.emailReceiptError ? { emailReceiptError: String(tx.emailReceiptError) } : {}),
          ...(tx.emailReceiptAttempts !== undefined ? { emailReceiptAttempts: Number(tx.emailReceiptAttempts) } : {}),
          subtotal: Number(tx.subtotal || 0) || 0,
          diskon: Number(tx.diskon || 0) || 0,
          biaya: Number(tx.biaya || 0) || 0,
          total: Number(tx.total || 0) || 0,
          metode_pembayaran: (tx.metode_pembayaran || 'Cash') as Transaction['metode_pembayaran'],
          uang_diterima: Number(tx.uang_diterima || 0) || 0,
          kembalian: Number(tx.kembalian || 0) || 0,
          status: normalizeOrderStatus(tx.status),
          orderType: ordType,
          tipe_pesanan: ordType,
          deliveryArea: isDelivery ? 'DQM' : null,
          deliveryLocation: isDelivery ? (tx.deliveryLocation ?? '') : null,
          deliveryDetail: isDelivery ? (tx.deliveryDetail ?? '') : null,
          deliveryFee: isDelivery ? Number(tx.deliveryFee ?? tx.biaya ?? 0) : 0,
          deliveryStatus: isDelivery ? normalizeDeliveryStatus(tx) : null,
          created_at: String(tx.created_at || new Date().toISOString()),
          poNumber: tx.poNumber ? String(tx.poNumber) : undefined,
          eventType: tx.eventType ? String(tx.eventType) : undefined,
          eventDate: tx.eventDate ? String(tx.eventDate) : undefined,
          eventTime: tx.eventTime ? String(tx.eventTime) : undefined,
          guestCount: tx.guestCount !== undefined ? Number(tx.guestCount) : undefined,
          deliveryType: tx.deliveryType || undefined,
          eventLocation: tx.eventLocation ? String(tx.eventLocation) : undefined,
          dpRequired: tx.dpRequired !== undefined ? Number(tx.dpRequired) : undefined,
          dpPaid: tx.dpPaid !== undefined ? Number(tx.dpPaid) : undefined,
          remainingPayment: tx.remainingPayment !== undefined ? Number(tx.remainingPayment) : undefined,
          paymentStatus: tx.paymentStatus || undefined,
          paymentHistory: Array.isArray(tx.paymentHistory) ? tx.paymentHistory : undefined,
          poStatus: tx.poStatus || undefined,
          dpProofUrl: tx.dpProofUrl ? String(tx.dpProofUrl) : undefined,
          notes: tx.notes ? String(tx.notes) : undefined,
          poStockDeducted: Boolean(tx.poStockDeducted),
          items: rawItems.map((item: any) => ({
            id_detail: String(item?.id_detail || ''),
            id_transaksi: String(item?.id_transaksi || tx.id_transaksi || ''),
            id_produk: String(item?.id_produk || ''),
            nama_produk: String(item?.nama_produk || item?.name || 'Menu'),
            productName: item?.productName ? String(item.productName) : undefined,
            variantId: item?.variantId ? String(item.variantId) : undefined,
            variantName: item?.variantName ? String(item.variantName) : undefined,
            harga_modal: item?.harga_modal !== undefined ? Number(item.harga_modal) : undefined,
            harga: Number(item?.harga ?? item?.price ?? 0) || 0,
            qty: Number(item?.qty ?? 1) || 1,
            subtotal: Number(item?.subtotal ?? (Number(item?.harga ?? 0) * Number(item?.qty ?? 1))) || 0,
            catatan: String(item?.catatan || ''),
          })),
        };
      });
  }

  static saveTransactions(transactions: Transaction[]): void {
    safeSetItem(STORAGE_KEYS.TRANSACTIONS, transactions);
  }

  static generateInvoiceNumber(prefix = 'WBK'): string {
    const cleanPrefix = !prefix || prefix === 'WKB' ? 'WBK' : prefix;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const transactions = this.getTransactions();
    const todayPrefix = `${cleanPrefix}-${dateStr}-`;
    const altPrefix = `WKB-${dateStr}-`;
    
    // Find highest sequence for today
    let maxSeq = 0;
    transactions.forEach((tx) => {
      if (tx.id_transaksi && (tx.id_transaksi.startsWith(todayPrefix) || tx.id_transaksi.startsWith(altPrefix))) {
        const seqPart = tx.id_transaksi.replace(todayPrefix, '').replace(altPrefix, '');
        const num = parseInt(seqPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `${todayPrefix}${nextSeq}`;
  }

  static generatePONumber(prefix = 'PO-WBK'): string {
    const cleanPrefix = prefix || 'PO-WBK';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const transactions = this.getTransactions();
    const todayPrefix = `${cleanPrefix}-${dateStr}-`;

    let maxSeq = 0;
    transactions.forEach((tx) => {
      const idToCheck = tx.poNumber || (tx.id_transaksi && tx.id_transaksi.startsWith(todayPrefix) ? tx.id_transaksi : '');
      if (idToCheck && idToCheck.startsWith(todayPrefix)) {
        const seqPart = idToCheck.replace(todayPrefix, '');
        const num = parseInt(seqPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `${todayPrefix}${nextSeq}`;
  }

  static completeTransaction(transaction: Transaction): {
    transactions: Transaction[];
    products: Product[];
    variants: ProductVariant[];
    customers: Customer[];
  } {
    // 1. Save Transaction
    const transactions = [transaction, ...this.getTransactions()];
    this.saveTransactions(transactions);

    // If this is a PRE_ORDER not yet in DIPROSES or SELESAI status, do not deduct stock yet to prevent premature stock locks
    const isPreOrder = transaction.orderType === 'PRE_ORDER' || Boolean(transaction.poNumber);
    const shouldDeductStock = !isPreOrder || transaction.status === 'DIPROSES' || transaction.status === 'SELESAI' || transaction.poStatus === 'DIPROSES' || transaction.poStatus === 'SELESAI';

    if (!shouldDeductStock) {
      return {
        transactions,
        products: this.getProducts(),
        variants: this.getProductVariants(),
        customers: this.getCustomers(),
      };
    }

    // 2. Reduce Stock (for both Product Variants and Main Products) & Record Mutations
    const products = this.getProducts();
    let variants = this.getProductVariants();
    const mutations = this.getStockMutations();
    const nowStr = `${transaction.tanggal} ${transaction.jam}`;

    // Track total qty deducted per main product
    const qtyByProductId = new Map<string, number>();

    transaction.items.forEach((item) => {
      const qty = Number(item.qty || 0);
      if (qty <= 0) return;

      if (item.variantId) {
        const varIdx = variants.findIndex((v) => v.variantId === item.variantId);
        if (varIdx >= 0) {
          const v = variants[varIdx];
          const oldStock = Number(v.stock || 0);
          const newStock = Math.max(0, oldStock - qty);
          variants[varIdx] = {
            ...v,
            stock: newStock,
            updatedAt: new Date().toISOString(),
          };
          mutations.unshift({
            id: 'STK-' + Math.random().toString(36).substring(2, 9),
            tanggal: nowStr,
            id_produk: v.productId || item.id_produk,
            variantId: v.variantId,
            variantName: v.variantName,
            nama_produk: item.nama_produk || `${v.productName || ''} - ${v.variantName}`,
            jenis: 'out',
            qty,
            stok_sebelum: oldStock,
            stok_sesudah: newStock,
            keterangan: `Penjualan kasir invoice ${transaction.id_transaksi}`,
          });
          const pId = v.productId || item.id_produk;
          qtyByProductId.set(pId, (qtyByProductId.get(pId) || 0) + qty);
          return;
        }
      }

      // Regular product (or fallback if variantId not matched)
      const prod = products.find(
        (p) => p.id === item.id_produk || p.nama === item.nama_produk
      );
      if (prod) {
        qtyByProductId.set(prod.id, (qtyByProductId.get(prod.id) || 0) + qty);
        mutations.unshift({
          id: 'STK-' + Math.random().toString(36).substring(2, 9),
          tanggal: nowStr,
          id_produk: prod.id,
          nama_produk: item.nama_produk || prod.nama,
          jenis: 'out',
          qty,
          stok_sebelum: prod.stok,
          stok_sesudah: Math.max(0, prod.stok - qty),
          keterangan: `Penjualan kasir invoice ${transaction.id_transaksi}`,
        });
      }
    });

    this.saveProductVariants(variants);

    const updatedProducts = products.map((prod) => {
      const prodVars = variants.filter((v) => v.productId === prod.id);
      if (prodVars.length > 0) {
        const activeVars = prodVars.filter((v) => v.isActive);
        const sumStock = (activeVars.length > 0 ? activeVars : prodVars).reduce(
          (s, v) => s + Math.max(0, Number(v.stock || 0)),
          0
        );
        return {
          ...prod,
          hasVariants: true,
          stok: sumStock,
          updated_at: new Date().toISOString(),
        };
      }
      const deducted = qtyByProductId.get(prod.id) || 0;
      if (deducted > 0) {
        return {
          ...prod,
          stok: Math.max(0, prod.stok - deducted),
          updated_at: new Date().toISOString(),
        };
      }
      return prod;
    });

    this.saveProducts(updatedProducts);
    this.saveStockMutations(mutations);

    // 3. Update Customer Record
    const customers = this.getCustomers();
    let updatedCustomers = [...customers];
    if (transaction.nama_pelanggan && transaction.nama_pelanggan.trim() !== '' && transaction.nama_pelanggan !== 'Pelanggan Umum') {
      const existingIdx = customers.findIndex(
        (c) =>
          (transaction.no_whatsapp && transaction.no_whatsapp !== '-' && c.no_whatsapp === transaction.no_whatsapp) ||
          c.nama.toLowerCase() === transaction.nama_pelanggan.toLowerCase()
      );

      if (existingIdx >= 0) {
        const exist = customers[existingIdx];
        updatedCustomers[existingIdx] = {
          ...exist,
          total_transaksi: exist.total_transaksi + 1,
          total_belanja: exist.total_belanja + transaction.total,
          last_order: new Date().toISOString(),
          no_whatsapp: (transaction.no_whatsapp && transaction.no_whatsapp !== '-') ? transaction.no_whatsapp : exist.no_whatsapp,
          ...(transaction.email_pelanggan ? { email: transaction.email_pelanggan } : {}),
        };
      } else {
        updatedCustomers.unshift({
          id: 'CUST-' + Math.random().toString(36).substring(2, 7),
          nama: transaction.nama_pelanggan,
          no_whatsapp: transaction.no_whatsapp || '-',
          ...(transaction.email_pelanggan ? { email: transaction.email_pelanggan } : {}),
          total_transaksi: 1,
          total_belanja: transaction.total,
          last_order: new Date().toISOString(),
        });
      }
      this.saveCustomers(updatedCustomers);
    }

    // 4. Queue for offline sync
    this.addToOfflineQueue({ type: 'transaction', data: transaction });

    return { transactions, products: updatedProducts, variants, customers: updatedCustomers };
  }

  static restoreStockOnCancel(transaction: Transaction): {
    products: Product[];
    variants: ProductVariant[];
    mutations: StockMutation[];
  } {
    const products = this.getProducts();
    const variants = this.getProductVariants();
    const mutations = this.getStockMutations();
    if (transaction.stockRestored) {
      return { products, variants, mutations };
    }
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const restoredByProdId = new Map<string, number>();

    (transaction.items || []).forEach((item) => {
      const qty = Number(item.qty || 0);
      if (qty <= 0) return;

      if (item.variantId) {
        const varIdx = variants.findIndex((v) => v.variantId === item.variantId);
        if (varIdx >= 0) {
          const v = variants[varIdx];
          const oldStock = Number(v.stock || 0);
          const newStock = oldStock + qty;
          variants[varIdx] = {
            ...v,
            stock: newStock,
            updatedAt: new Date().toISOString(),
          };
          mutations.unshift({
            id: 'STK-' + Math.random().toString(36).substring(2, 9),
            tanggal: nowStr,
            id_produk: v.productId || item.id_produk,
            variantId: v.variantId,
            variantName: v.variantName,
            nama_produk: item.nama_produk || `${v.productName || ''} - ${v.variantName}`,
            jenis: 'in',
            qty,
            stok_sebelum: oldStock,
            stok_sesudah: newStock,
            keterangan: `Pengembalian stok pembatalan transaksi ${transaction.id_transaksi}`,
          });
          const pId = v.productId || item.id_produk;
          restoredByProdId.set(pId, (restoredByProdId.get(pId) || 0) + qty);
          return;
        }
      }

      const prod = products.find(
        (p) => p.id === item.id_produk || p.nama === item.nama_produk
      );
      if (prod) {
        restoredByProdId.set(prod.id, (restoredByProdId.get(prod.id) || 0) + qty);
        mutations.unshift({
          id: 'STK-' + Math.random().toString(36).substring(2, 9),
          tanggal: nowStr,
          id_produk: prod.id,
          nama_produk: item.nama_produk || prod.nama,
          jenis: 'in',
          qty,
          stok_sebelum: prod.stok,
          stok_sesudah: prod.stok + qty,
          keterangan: `Pengembalian stok pembatalan transaksi ${transaction.id_transaksi}`,
        });
      }
    });

    this.saveProductVariants(variants);

    const updatedProducts = products.map((prod) => {
      const prodVars = variants.filter((v) => v.productId === prod.id);
      if (prodVars.length > 0) {
        const activeVars = prodVars.filter((v) => v.isActive);
        const sumStock = (activeVars.length > 0 ? activeVars : prodVars).reduce(
          (s, v) => s + Math.max(0, Number(v.stock || 0)),
          0
        );
        return {
          ...prod,
          hasVariants: true,
          stok: sumStock,
          updated_at: new Date().toISOString(),
        };
      }
      const added = restoredByProdId.get(prod.id) || 0;
      if (added > 0) {
        return {
          ...prod,
          stok: prod.stok + added,
          updated_at: new Date().toISOString(),
        };
      }
      return prod;
    });

    this.saveProducts(updatedProducts);
    this.saveStockMutations(mutations);
    return { products: updatedProducts, variants, mutations };
  }

  static recordVariantStockAdjustment(
    variantId: string,
    jenis: 'in' | 'out' | 'adjustment',
    qty: number,
    keterangan: string
  ): {
    products: Product[];
    variants: ProductVariant[];
    mutations: StockMutation[];
  } {
    const variants = this.getProductVariants();
    const mutations = this.getStockMutations();
    const target = variants.find((v) => v.variantId === variantId);
    if (!target) {
      return { products: this.getProducts(), variants, mutations };
    }

    let newStock = target.stock;
    if (jenis === 'in') {
      newStock += qty;
    } else if (jenis === 'out') {
      newStock = Math.max(0, newStock - qty);
    } else if (jenis === 'adjustment') {
      newStock = Math.max(0, qty);
    }

    const updatedVariant: ProductVariant = {
      ...target,
      stock: newStock,
      updatedAt: new Date().toISOString(),
    };

    const newMutation: StockMutation = {
      id: 'STK-' + Math.random().toString(36).substring(2, 9),
      tanggal: new Date().toISOString().replace('T', ' ').substring(0, 19),
      id_produk: target.productId,
      variantId: target.variantId,
      variantName: target.variantName,
      nama_produk: `${target.productName || 'Produk'} - ${target.variantName}`,
      jenis,
      qty: jenis === 'adjustment' ? Math.abs(newStock - target.stock) : qty,
      stok_sebelum: target.stock,
      stok_sesudah: newStock,
      keterangan:
        keterangan ||
        (jenis === 'in'
          ? 'Stok Varian Masuk'
          : jenis === 'out'
          ? 'Stok Varian Keluar'
          : 'Penyesuaian Stok Fisik Varian'),
    };

    const updatedVariants = variants.map((v) =>
      v.variantId === variantId ? updatedVariant : v
    );
    const updatedMutations = [newMutation, ...mutations];

    this.saveProductVariants(updatedVariants);
    this.saveStockMutations(updatedMutations);
    const updatedProducts = this.syncParentProductFromVariants(
      target.productId,
      updatedVariants
    );

    return {
      products: updatedProducts,
      variants: updatedVariants,
      mutations: updatedMutations,
    };
  }

  // STOCK MUTATIONS
  static getStockMutations(): StockMutation[] {
    return safeGetItem<StockMutation[]>(STORAGE_KEYS.STOCK_MUTATIONS, INITIAL_STOCK_MUTATIONS);
  }

  static saveStockMutations(mutations: StockMutation[]): void {
    safeSetItem(STORAGE_KEYS.STOCK_MUTATIONS, mutations);
  }

  // DELIVERY PROOFS DQM
  static getDeliveryProofs(): DeliveryProof[] {
    const raw = safeGetItem<DeliveryProof[]>(STORAGE_KEYS.DELIVERY_PROOFS, []);
    return Array.isArray(raw) ? raw : [];
  }

  static saveDeliveryProofs(proofs: DeliveryProof[]): void {
    safeSetItem(STORAGE_KEYS.DELIVERY_PROOFS, proofs);
  }

  static upsertDeliveryProof(proof: DeliveryProof): DeliveryProof[] {
    const list = this.getDeliveryProofs();
    const idx = list.findIndex((p) => p.orderId === proof.orderId || p.deliveryId === proof.deliveryId);
    let updated: DeliveryProof[];
    if (idx >= 0) {
      updated = list.map((item, i) => (i === idx ? { ...item, ...proof } : item));
    } else {
      updated = [proof, ...list];
    }
    this.saveDeliveryProofs(updated);
    return updated;
  }

  static recordStockAdjustment(
    productId: string,
    jenis: 'in' | 'out' | 'adjustment',
    qty: number,
    keterangan: string
  ): { products: Product[]; mutations: StockMutation[] } {
    const products = this.getProducts();
    const mutations = this.getStockMutations();
    const product = products.find((p) => p.id === productId);

    if (!product) return { products, mutations };

    let newStock = product.stok;
    if (jenis === 'in') {
      newStock += qty;
    } else if (jenis === 'out') {
      newStock = Math.max(0, newStock - qty);
    } else if (jenis === 'adjustment') {
      newStock = Math.max(0, qty); // set direct to new stock
    }

    const updatedProduct = {
      ...product,
      stok: newStock,
      updated_at: new Date().toISOString(),
    };

    const newMutation: StockMutation = {
      id: 'STK-' + Math.random().toString(36).substring(2, 9),
      tanggal: new Date().toISOString().replace('T', ' ').substring(0, 19),
      id_produk: product.id,
      nama_produk: product.nama,
      jenis,
      qty: jenis === 'adjustment' ? Math.abs(newStock - product.stok) : qty,
      stok_sebelum: product.stok,
      stok_sesudah: newStock,
      keterangan: keterangan || (jenis === 'in' ? 'Stok Masuk' : jenis === 'out' ? 'Stok Keluar' : 'Penyesuaian Stok Fisik'),
    };

    const updatedProducts = products.map((p) => (p.id === productId ? updatedProduct : p));
    const updatedMutations = [newMutation, ...mutations];

    this.saveProducts(updatedProducts);
    this.saveStockMutations(updatedMutations);

    return { products: updatedProducts, mutations: updatedMutations };
  }

  // CUSTOMERS
  static getCustomers(): Customer[] {
    return safeGetItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  }

  static saveCustomers(customers: Customer[]): void {
    safeSetItem(STORAGE_KEYS.CUSTOMERS, customers);
  }

  // EXPENSES
  static getExpenses(): Expense[] {
    return safeGetItem<Expense[]>(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
  }

  static saveExpenses(expenses: Expense[]): void {
    safeSetItem(STORAGE_KEYS.EXPENSES, expenses);
  }

  static addExpense(expense: Expense): Expense[] {
    const expenses = [expense, ...this.getExpenses()];
    this.saveExpenses(expenses);
    this.addToOfflineQueue({ type: 'expense', data: expense });
    return expenses;
  }

  static deleteExpense(id: string): Expense[] {
    const expenses = this.getExpenses().filter((e) => e.id !== id);
    this.saveExpenses(expenses);
    return expenses;
  }

  // SETTINGS
  static getSettings(): StoreSettings {
    const settings = safeGetItem<StoreSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    if (!settings.logoUrl || settings.logoUrl.trim() === '') {
      settings.logoUrl = '/icon.svg';
    }
    const addr = String(settings.address || settings.storeAddress || '').trim();
    if (addr) {
      settings.address = addr;
      settings.storeAddress = addr;
    }
    return settings;
  }

  static saveSettings(settings: StoreSettings): void {
    if (!settings.logoUrl || settings.logoUrl.trim() === '') {
      settings.logoUrl = '/icon.svg';
    }
    const addr = String(settings.address || settings.storeAddress || '').trim();
    if (addr) {
      settings.address = addr;
      settings.storeAddress = addr;
    }
    safeSetItem(STORAGE_KEYS.SETTINGS, settings);
  }

  // SYNC STATE & OFFLINE QUEUE
  static getSyncState(): SyncState {
    return safeGetItem<SyncState>(STORAGE_KEYS.SYNC_STATE, {
      lastSync: null,
      isOnline: navigator.onLine,
      isSyncing: false,
      syncedCount: 0,
      error: null,
    });
  }

  static saveSyncState(state: SyncState): void {
    safeSetItem(STORAGE_KEYS.SYNC_STATE, state);
  }

  static getOfflineQueue(): Array<{ type: string; data: any; timestamp: string }> {
    return safeGetItem<Array<{ type: string; data: any; timestamp: string }>>(
      STORAGE_KEYS.OFFLINE_QUEUE,
      []
    );
  }

  static addToOfflineQueue(item: { type: string; data: any }): void {
    const queue = this.getOfflineQueue();
    queue.push({ ...item, timestamp: new Date().toISOString() });
    safeSetItem(STORAGE_KEYS.OFFLINE_QUEUE, queue);
  }

  static clearOfflineQueue(): void {
    safeSetItem(STORAGE_KEYS.OFFLINE_QUEUE, []);
  }

  // BACKUP & RESTORE
  static exportAllData(): string {
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      store: this.getSettings().storeName,
      products: this.getProducts(),
      transactions: this.getTransactions(),
      customers: this.getCustomers(),
      expenses: this.getExpenses(),
      stockMutations: this.getStockMutations(),
      settings: this.getSettings(),
    };
    return JSON.stringify(backup, null, 2);
  }

  static resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS_SEEDED_V2);
    localStorage.removeItem(STORAGE_KEYS.INDOMIE_PRODUCT_SEEDED);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS_ADMIN_CLEARED);
    localStorage.removeItem(STORAGE_KEYS.PRODUCT_VARIANTS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCT_VARIANTS_SEEDED);
    localStorage.removeItem(STORAGE_KEYS.INDOMIE_VARIANTS_SEEDED);
    localStorage.removeItem(STORAGE_KEYS.DELETED_PRODUCT_IDS);
    localStorage.removeItem(STORAGE_KEYS.DELETED_VARIANT_IDS);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.STOCK_MUTATIONS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.SYNC_STATE);
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  }
}
