import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StoreSettings,
  ActiveTab,
  Product,
  ProductVariant,
  Transaction,
  Customer,
  Expense,
  StockMutation,
  SyncState,
  UserRole,
  WarungUser,
  CategoryItem,
} from './types';
import { StorageService } from './services/storage';
import {
  INITIAL_PRODUCTS,
  INITIAL_PRODUCT_VARIANTS,
  INDOMIE_PARENT_PRODUCT,
  INDOMIE_INITIAL_VARIANTS,
} from './data/initialData';
import { GoogleSheetsSyncService } from './services/googleSheetsSync';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { POSView } from './components/POS/POSView';
import { DashboardView } from './components/Dashboard/DashboardView';
import { WhatsAppOrderView } from './components/WhatsApp/WhatsAppOrderView';
import { ProductsView } from './components/Products/ProductsView';
import { StockView } from './components/Stock/StockView';
import { ReportsView } from './components/Reports/ReportsView';
import { ExpensesView } from './components/Expenses/ExpensesView';
import { CustomersView } from './components/Customers/CustomersView';
import { SettingsView } from './components/Settings/SettingsView';
import { LogoEditorModal } from './components/Settings/LogoEditorModal';
import { AIBotView } from './components/AIBot/AIBotView';
import { AIBotDrawer } from './components/AIBot/AIBotDrawer';
import { ReceiptModal } from './components/POS/ReceiptModal';
import { QRCodeOrderManagerView } from './components/QRCodeOrder/QRCodeOrderManagerView';
import { CustomerOrderView } from './components/CustomerOrder/CustomerOrderView';
import { PublicMenuCustomerView } from './components/PublicMenu/PublicMenuCustomerView';
import { PublicMenuManagerView } from './components/PublicMenu/PublicMenuManagerView';
import { CategoriesView } from './components/Categories/CategoriesView';
import { UsersManagementView } from './components/Users/UsersManagementView';
import { OrdersManagementView } from './components/Orders/OrdersManagementView';
import { DeliveryDQMDashboard } from './components/Orders/DeliveryDQMDashboard';
import { DeliveryProofModal } from './components/Orders/DeliveryProofModal';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { LoginModal } from './components/Auth/LoginModal';
import { LoginView } from './components/Auth/LoginView';
import { UserProfileModal } from './components/Auth/UserProfileModal';
import { hasTabAccess, normalizeRole, ROLE_CONFIGS, getTabLabel } from './utils/rbac';
import { CheckCircle2, AlertCircle, Info, X, Bot, Sparkles, Bell, ArrowRight } from 'lucide-react';
import {
  saveOrderToFirebase,
  subscribeToFirebaseOrders,
  updateFirebaseOrderStatus,
  deleteOrderFromFirebase,
  syncProductsToFirebase,
  deleteProductFromFirebase,
  clearAllProductsFromFirebase,
  subscribeToFirebaseProducts,
  syncProductVariantsToFirebase,
  saveProductVariantToFirebase,
  deleteProductVariantFromFirebase,
  subscribeToFirebaseProductVariants,
  deductStockWithFirestoreTransaction,
  restoreStockWithFirestoreTransaction,
  syncCategoriesToFirebase,
  deleteCategoryFromFirebase,
  subscribeToFirebaseCategories,
  saveExpenseToFirebase,
  deleteExpenseFromFirebase,
  subscribeToFirebaseExpenses,
  saveCustomerToFirebase,
  deleteCustomerFromFirebase,
  subscribeToFirebaseCustomers,
  saveSettingsToFirebase,
  subscribeToFirebaseSettings,
  subscribeToFirebaseUsers,
  subscribeToFirebaseStockMutations,
  saveStockMutationToFirebase,
  subscribeToAuthState,
  validateFirebaseEnvironment,
  FIREBASE_CONFIG_ERROR_MESSAGE,
  syncAllDataToFirebase,
  testFirestoreConnection,
  fetchPublicOrderReceiptFromFirebase,
} from './services/firebase';
import { formatRupiah } from './utils/formatters';

// Audio notification chime for incoming customer orders
function playOrderChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880.0, now + 0.14); // A5
    osc2.frequency.setValueAtTime(587.33, now);
    osc2.frequency.setValueAtTime(880.0, now + 0.14);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.8);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [isLogoEditorOpen, setIsLogoEditorOpen] = useState(false);

  // Customer Self-Order Mode (from QR Code camera scan)
  const [isCustomerMode, setIsCustomerMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      // If URL explicitly requests public menu, do not trigger QR standee customer mode
      if (search.includes('menu=') || search.includes('mode=public') || search.includes('order=menu')) {
        return false;
      }
      return (
        search.includes('order=') ||
        search.includes('mode=order') ||
        search.includes('scan=')
      );
    }
    return false;
  });

  // Public Online Web Menu Mode (from social media link / public menu URL)
  const [isPublicMenuMode, setIsPublicMenuMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      return (
        search.includes('menu=public') ||
        search.includes('menu=online') ||
        search.includes('mode=public') ||
        search.includes('order=menu')
      );
    }
    return false;
  });

  const [customerOrderType, setCustomerOrderType] = useState<'Takeaway' | 'Delivery'>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('order=delivery') || search.includes('scan=delivery')) {
        return 'Delivery';
      }
    }
    return 'Takeaway';
  });

  // Core Data States
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [productVariants, setProductVariants] = useState<ProductVariant[]>(() =>
    StorageService.getProductVariants()
  );
  const [categories, setCategories] = useState<CategoryItem[]>(() => StorageService.getCategories());
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    StorageService.getTransactions()
  );
  const [customers, setCustomers] = useState<Customer[]>(() => StorageService.getCustomers());
  const [expenses, setExpenses] = useState<Expense[]>(() => StorageService.getExpenses());
  const [mutations, setMutations] = useState<StockMutation[]>(() =>
    StorageService.getStockMutations()
  );
  const [settings, setSettings] = useState<StoreSettings>(() => StorageService.getSettings());

  // User Authentication State & RBAC
  const [currentUser, setCurrentUser] = useState<WarungUser | null>(() => {
    const saved = StorageService.getAuthUser();
    // 1. If existing authenticated staff session exists, restore it
    if (
      saved &&
      ['Owner', 'Admin', 'Kasir', 'Staff', 'Delivery', 'ADMIN', 'KASIR', 'DELIVERY'].includes(
        saved.role
      )
    ) {
      return saved;
    }
    // 2. If the user explicitly navigated to public customer menu via URL, allow customer view
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (
        search.includes('menu=') ||
        search.includes('mode=public') ||
        search.includes('order=') ||
        search.includes('scan=')
      ) {
        return null;
      }
    }
    // 3. Default to the primary Owner account (Rayyan) for the Warung Bang Kobra POS system
    const users = StorageService.getUsers();
    const owner =
      users.find((u) => u.email?.toLowerCase() === 'rayyanarasid549@gmail.com') ||
      users.find((u) => u.role === 'Owner') ||
      users[0];
    if (owner) {
      StorageService.setAuthUser(owner);
      return owner;
    }
    return null;
  });
  const [isStaffLoginMode, setIsStaffLoginMode] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Sync & Connection State
  const [syncState, setSyncState] = useState<SyncState>(() => StorageService.getSyncState());
  const [isSyncing, setIsSyncing] = useState(false);

  // Global Receipt Modal (e.g. from Dashboard / Reports)
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  // Shared Digital Receipt / Delivery Proof Link Viewer (/receipt/:id, /delivery-proof/:id, ?receipt=..., ?proof=...)
  const [sharedReceiptRoute, setSharedReceiptRoute] = useState<{
    orderId: string;
    mode: 'receipt' | 'delivery-proof';
  } | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const receiptMatch = path.match(/^\/receipt\/([^/]+)/i);
      if (receiptMatch && receiptMatch[1]) {
        return { orderId: decodeURIComponent(receiptMatch[1].trim()), mode: 'receipt' };
      }
      const deliveryProofMatch = path.match(/^\/delivery-proof\/([^/]+)/i);
      if (deliveryProofMatch && deliveryProofMatch[1]) {
        return {
          orderId: decodeURIComponent(deliveryProofMatch[1].trim()),
          mode: 'delivery-proof',
        };
      }
      const params = new URLSearchParams(window.location.search);
      const receiptParam = params.get('receipt');
      if (receiptParam && receiptParam.trim() !== '') {
        return { orderId: receiptParam.trim(), mode: 'receipt' };
      }
      const proofParam = params.get('proof');
      if (proofParam && proofParam.trim() !== '') {
        return { orderId: proofParam.trim(), mode: 'delivery-proof' };
      }
    }
    return null;
  });
  const [fetchedPublicReceiptTx, setFetchedPublicReceiptTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!sharedReceiptRoute?.orderId) return;
    let active = true;
    fetchPublicOrderReceiptFromFirebase(sharedReceiptRoute.orderId).then((tx) => {
      if (active && tx) {
        setFetchedPublicReceiptTx(tx);
      }
    });
    return () => {
      active = false;
    };
  }, [sharedReceiptRoute]);

  // Incoming QR Order Alert Banner for Cashier
  const [newOrderAlert, setNewOrderAlert] = useState<Transaction | null>(null);

  // Global Toast Alert
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((current) => (current?.message === message ? null : current));
      }, 4000);
    },
    []
  );

  const isInitialOrdersLoad = useRef(true);

  // Real-time Cloud Database Synchronization across all devices (Firebase Firestore)
  useEffect(() => {
    // Seed the 33 official Warung Bang Kobra products (SKU-001..SKU-0028 + 5 Variant Parent Products) & 43 initial variants into local state & Firebase Firestore
    const FIREBASE_PRODUCTS_SEEDED_KEY = 'wkb_firebase_products_seeded_33_v3';
    const FIREBASE_VARIANTS_SEEDED_KEY = 'wkb_firebase_variants_seeded_v1';
    let isSeedingProducts = false;
    let isSeedingVariants = false;
    try {
      if (localStorage.getItem(FIREBASE_PRODUCTS_SEEDED_KEY) !== 'true') {
        isSeedingProducts = true;
        localStorage.setItem(FIREBASE_PRODUCTS_SEEDED_KEY, 'true');
        localStorage.removeItem('wkb_pos_products_admin_cleared_v2');
        StorageService.saveProducts(INITIAL_PRODUCTS);
        setProducts(INITIAL_PRODUCTS);
        syncProductsToFirebase(INITIAL_PRODUCTS, true)
          .catch(() => {})
          .finally(() => {
            isSeedingProducts = false;
          });
      }
      if (localStorage.getItem(FIREBASE_VARIANTS_SEEDED_KEY) !== 'true') {
        isSeedingVariants = true;
        localStorage.setItem(FIREBASE_VARIANTS_SEEDED_KEY, 'true');
        StorageService.saveProductVariants(INITIAL_PRODUCT_VARIANTS);
        setProductVariants(INITIAL_PRODUCT_VARIANTS);
        syncProductVariantsToFirebase(INITIAL_PRODUCT_VARIANTS, true)
          .catch(() => {})
          .finally(() => {
            isSeedingVariants = false;
          });
      }
    } catch {
      isSeedingProducts = false;
      isSeedingVariants = false;
    }

    // 1. Subscribe to Products Catalog in real-time (preserve SKU order and respect explicit admin empty action)
    const unsubscribeProducts = subscribeToFirebaseProducts((remoteProducts) => {
      if (isSeedingProducts) return;
      const deletedProdIds = StorageService.getDeletedProductIds();
      let list = (Array.isArray(remoteProducts) ? remoteProducts : []).filter(
        (p) =>
          p &&
          !deletedProdIds.has(String(p.id).trim()) &&
          !deletedProdIds.has(String(p.sku || '').trim())
      );
      const isAdminCleared =
        typeof window !== 'undefined' &&
        localStorage.getItem('wkb_pos_products_admin_cleared_v2') === 'true';

      if (list.length === 0 && !isAdminCleared && deletedProdIds.size === 0) {
        const localSeeded = StorageService.getProducts();
        if (localSeeded.length > 0) {
          setProducts(localSeeded);
          syncProductsToFirebase(localSeeded, true).catch(() => {});
          return;
        }
      }

      if (!isAdminCleared) {
        try {
          if (localStorage.getItem('wkb_firebase_indomie_prod_v1') !== 'true') {
            localStorage.setItem('wkb_firebase_indomie_prod_v1', 'true');
            const hasIndomie = list.some(
              (p) => p.id === INDOMIE_PARENT_PRODUCT.id || p.nama.toUpperCase() === 'INDOMIE'
            );
            if (!hasIndomie && !deletedProdIds.has(INDOMIE_PARENT_PRODUCT.id)) {
              list = [...list, INDOMIE_PARENT_PRODUCT];
              syncProductsToFirebase([INDOMIE_PARENT_PRODUCT], false).catch(() => {});
            }
          }
        } catch {}
      }

      setProducts(list);
      StorageService.saveProducts(list);
    });

    // 1b. Subscribe to Product Variants (`product_variants` collection) in real-time
    const unsubscribeVariants = subscribeToFirebaseProductVariants((remoteVariants) => {
      if (isSeedingVariants) return;
      const deletedVarIds = StorageService.getDeletedVariantIds();
      const deletedProdIds = StorageService.getDeletedProductIds();
      let list = (Array.isArray(remoteVariants) ? remoteVariants : []).filter(
        (v) =>
          v &&
          !deletedVarIds.has(String(v.variantId).trim()) &&
          !deletedVarIds.has(String(v.sku || '').trim()) &&
          !deletedProdIds.has(String(v.productId || '').trim())
      );
      const isAdminCleared =
        typeof window !== 'undefined' &&
        localStorage.getItem('wkb_pos_products_admin_cleared_v2') === 'true';

      if (list.length === 0 && !isAdminCleared && deletedVarIds.size === 0 && deletedProdIds.size === 0) {
        const localVars = StorageService.getProductVariants();
        if (localVars.length > 0) {
          setProductVariants(localVars);
          syncProductVariantsToFirebase(localVars, true).catch(() => {});
          return;
        }
      }

      if (!isAdminCleared) {
        try {
          if (localStorage.getItem('wkb_firebase_indomie_vars_v1') !== 'true') {
            localStorage.setItem('wkb_firebase_indomie_vars_v1', 'true');
            const existingVarIds = new Set(list.map((v) => v.variantId));
            const missingIndomieVars = INDOMIE_INITIAL_VARIANTS.filter(
              (iv) => !existingVarIds.has(iv.variantId) && !deletedVarIds.has(iv.variantId)
            );
            if (missingIndomieVars.length > 0 && !deletedProdIds.has(INDOMIE_PARENT_PRODUCT.id)) {
              list = [...missingIndomieVars, ...list];
              missingIndomieVars.forEach((mv) => {
                saveProductVariantToFirebase(mv).catch(() => {});
              });
            }
          }
        } catch {}
      }

      setProductVariants(list);
      StorageService.saveProductVariants(list);
    });

    // 2. Subscribe to Categories in real-time
    const unsubscribeCategories = subscribeToFirebaseCategories((remoteCategories) => {
      if (remoteCategories && remoteCategories.length > 0) {
        setCategories(remoteCategories);
        StorageService.saveCategories(remoteCategories);
      } else {
        const local = StorageService.getCategories();
        if (local.length > 0) {
          syncCategoriesToFirebase(local).catch(() => {});
        }
      }
    });

    // 3. Subscribe to Orders in real-time
    const unsubscribeOrders = subscribeToFirebaseOrders((incomingOrders) => {
      if (!incomingOrders) return;
      if (incomingOrders.length === 0) {
        const localOrders = StorageService.getTransactions();
        if (localOrders.length > 0) {
          localOrders.forEach((order) => {
            saveOrderToFirebase(order).catch(() => {});
          });
        }
        return;
      }

      setTransactions((prevTxList) => {
        if (!isInitialOrdersLoad.current && prevTxList.length > 0) {
          const existingIds = new Set(prevTxList.map((t) => t.id_transaksi));
          const newOrders = incomingOrders.filter((io) => !existingIds.has(io.id_transaksi));
          if (newOrders.length > 0) {
            playOrderChime();
            const latestOrder = newOrders[0];
            setNewOrderAlert(latestOrder);
            showToast(
              `🔔 PESANAN BARU MASUK KE ANTRIAN KASIR! ${latestOrder.nama_pelanggan} [${latestOrder.orderType === 'DELIVERY_DQM' || latestOrder.tipe_pesanan === 'DELIVERY_DQM' ? 'DELIVERY DQM' : 'BUNGKUS'}] - Total: ${formatRupiah(latestOrder.total)}`,
              'success'
            );
          }
        }
        isInitialOrdersLoad.current = false;
        StorageService.saveTransactions(incomingOrders);
        return incomingOrders;
      });
    });

    // 4. Subscribe to Expenses in real-time
    const unsubscribeExpenses = subscribeToFirebaseExpenses((remoteExpenses) => {
      if (remoteExpenses && remoteExpenses.length > 0) {
        setExpenses(remoteExpenses);
        StorageService.saveExpenses(remoteExpenses);
      } else {
        const local = StorageService.getExpenses();
        if (local.length > 0) {
          local.forEach((exp) => saveExpenseToFirebase(exp).catch(() => {}));
        }
      }
    });

    // 5. Subscribe to Customers in real-time
    const unsubscribeCustomers = subscribeToFirebaseCustomers((remoteCustomers) => {
      if (remoteCustomers && remoteCustomers.length > 0) {
        setCustomers(remoteCustomers);
        StorageService.saveCustomers(remoteCustomers);
      } else {
        const local = StorageService.getCustomers();
        if (local.length > 0) {
          local.forEach((cust) => saveCustomerToFirebase(cust).catch(() => {}));
        }
      }
    });

    // 6. Subscribe to Store Settings in real-time (Ensuring store address syncs identically across devices)
    const unsubscribeSettings = subscribeToFirebaseSettings((remoteSettings) => {
      if (remoteSettings && Object.keys(remoteSettings).length > 0) {
        setSettings((prev) => {
          const hasRemoteAddr = remoteSettings.address !== undefined || remoteSettings.storeAddress !== undefined;
          const remoteAddr = remoteSettings.address !== undefined ? remoteSettings.address : remoteSettings.storeAddress;
          const finalAddr = hasRemoteAddr ? String(remoteAddr || '').trim() : String(prev.address || prev.storeAddress || '').trim();

          const merged: StoreSettings = {
            ...prev,
            ...remoteSettings,
            address: finalAddr,
            storeAddress: finalAddr,
          };

          // Guard against unnecessary state updates if nothing actually changed
          if (
            prev.address === merged.address &&
            prev.storeAddress === merged.storeAddress &&
            prev.storeName === merged.storeName &&
            prev.tagline === merged.tagline &&
            prev.whatsappNumber === merged.whatsappNumber &&
            prev.logoUrl === merged.logoUrl &&
            prev.receiptFooter === merged.receiptFooter &&
            prev.receiptPaperSize === merged.receiptPaperSize &&
            prev.taxPercent === merged.taxPercent &&
            prev.currency === merged.currency &&
            prev.qrisImageUrl === merged.qrisImageUrl &&
            prev.onlineMenuIsOpen === merged.onlineMenuIsOpen &&
            prev.onlineMenuAnnouncement === merged.onlineMenuAnnouncement &&
            prev.onlineMenuMinOrder === merged.onlineMenuMinOrder &&
            prev.activeCashier === merged.activeCashier
          ) {
            return prev;
          }

          StorageService.saveSettings(merged);
          return merged;
        });
      } else {
        const local = StorageService.getSettings();
        if (local) {
          saveSettingsToFirebase(local).catch(() => {});
        }
      }
    });

    // 7. Subscribe to Registered Users in real-time
    const unsubscribeUsers = subscribeToFirebaseUsers((remoteUsers) => {
      if (remoteUsers && remoteUsers.length > 0) {
        const currentUsers = StorageService.getUsers();
        const merged = remoteUsers.map((ru) => {
          const matched = currentUsers.find((cu) => cu.id === ru.id || cu.username === ru.username);
          return {
            ...ru,
            pin: matched?.pin || ru.pin || '1234',
          };
        });
        StorageService.saveUsers(merged);
      }
    });

    // 8. Subscribe to Stock Mutations in real-time
    const unsubscribeMutations = subscribeToFirebaseStockMutations((remoteMutations) => {
      if (remoteMutations && remoteMutations.length > 0) {
        setMutations(remoteMutations);
        StorageService.saveStockMutations(remoteMutations);
      }
    });

    // 9. Subscribe to Auth State
    const unsubAuth = subscribeToAuthState((user) => {
      if (user) {
        console.log('Firebase user session ready:', user.uid);
      }
    });

    // 10. Auto-connect & verify Firebase Firestore status on boot
    testFirestoreConnection().then((res) => {
      if (res.connected) {
        setSyncState((prev) => ({
          ...prev,
          isOnline: true,
          lastSync: prev.lastSync || new Date().toISOString(),
          error: null,
        }));
      }
    });

    return () => {
      unsubscribeProducts();
      unsubscribeVariants();
      unsubscribeCategories();
      unsubscribeOrders();
      unsubscribeExpenses();
      unsubscribeCustomers();
      unsubscribeSettings();
      unsubscribeUsers();
      unsubscribeMutations();
      unsubAuth();
    };
  }, []);

  // Cross-Tab / Window Synchronization (Local Device consistency)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'wkb_pos_settings') {
        const freshSettings = StorageService.getSettings();
        setSettings(freshSettings);
      } else if (e.key === 'wkb_pos_products') {
        setProducts(StorageService.getProducts());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Theme Handling
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Online / Offline Detection
  useEffect(() => {
    const handleOnline = () => {
      setSyncState((prev) => ({ ...prev, isOnline: true }));
      showToast('Koneksi internet kembali aktif! Sistem siap sinkronisasi.', 'success');
    };
    const handleOffline = () => {
      setSyncState((prev) => ({ ...prev, isOnline: false }));
      showToast('Mode offline aktif. Transaksi tersimpan aman di HP/komputer.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Toggle Theme
  const handleToggleTheme = () => {
    const newTheme: 'dark' | 'light' = settings.theme === 'dark' ? 'light' : 'dark';
    const updated: StoreSettings = { ...settings, theme: newTheme };
    setSettings(updated);
    StorageService.saveSettings(updated);
  };

  // Switch Role (Owner / Admin / Kasir / Staff) - Only accessible to authenticated staff
  const handleRoleChange = (role: UserRole) => {
    if (!currentUser || currentUser.role === 'Customer') {
      showToast('Akses dibatasi. Masuk dengan akun staf untuk mengubah peran.', 'error');
      return;
    }

    const updatedSettings = { ...settings, role };
    setSettings(updatedSettings);
    StorageService.saveSettings(updatedSettings);

    const users = StorageService.getUsers();
    const matchedUser = users.find((u) => u.role === role);
    if (matchedUser) {
      setCurrentUser(matchedUser);
      StorageService.setAuthUser(matchedUser);
      showToast(`Beralih ke sesi akun ${matchedUser.nama} (${role})`, 'success');
    } else if (currentUser) {
      const updatedUser: WarungUser = { ...currentUser, role };
      setCurrentUser(updatedUser);
      StorageService.setAuthUser(updatedUser);
      showToast(`Peran akun dialihkan ke ${role}`, 'success');
    }

    // Auto-redirect if current active tab is not accessible by this role
    if (!hasTabAccess(role, activeTab)) {
      const norm = normalizeRole(role);
      const def = ROLE_CONFIGS[norm].defaultTab;
      setActiveTab(def);
    }
  };

  const handleLoginSuccess = (user: WarungUser) => {
    setCurrentUser(user);
    StorageService.setAuthUser(user);
    setIsStaffLoginMode(false);
    setIsLoginModalOpen(false);
    setIsPublicMenuMode(false);
    setIsCustomerMode(false);
    setSettings((prev) => {
      const updated = { ...prev, role: user.role };
      StorageService.saveSettings(updated);
      return updated;
    });
    showToast(`Selamat datang, ${user.nama}! (${user.role})`, 'success');

    // Auto-navigate to allowed tab if restricted
    if (!hasTabAccess(user.role, activeTab)) {
      const norm = normalizeRole(user.role);
      const def = ROLE_CONFIGS[norm].defaultTab;
      setActiveTab(def);
    }
  };

  const handleLogout = () => {
    StorageService.logout();
    setCurrentUser(null);
    setIsStaffLoginMode(false);
    setIsLoginModalOpen(false);
    setIsPublicMenuMode(false);
    setIsCustomerMode(false);
    showToast('Anda telah keluar dari akun staf.', 'info');
  };

  const handleUpdateCurrentUser = (updatedUser: WarungUser) => {
    setCurrentUser(updatedUser);
    StorageService.setAuthUser(updatedUser);
  };

  // Direct Firebase Cloud & Optional Google Sheets Sync Handler
  const handleSync = async () => {
    if (!navigator.onLine) {
      showToast('Tidak ada koneksi internet untuk melakukan sinkronisasi.', 'error');
      return;
    }

    setIsSyncing(true);
    setSyncState((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      const fbRes = await syncAllDataToFirebase({
        settings,
        products,
        categories,
        transactions,
        customers,
        expenses,
        mutations,
      });

      const scriptUrl = settings.googleSheetsUrl || settings.googleAppsScriptUrl;
      if (scriptUrl && scriptUrl.startsWith('http')) {
        await GoogleSheetsSyncService.syncAllData({
          scriptUrl,
          products,
          transactions,
          customers,
          expenses,
          stockMutations: mutations,
          settings,
        });
      }

      const nowIso = new Date().toISOString();
      const nowFormatted = new Date().toLocaleTimeString('id-ID');
      setIsSyncing(false);
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSync: nowIso,
        error: fbRes.success ? null : fbRes.message,
      }));

      if (fbRes.success) {
        const updatedSettings = {
          ...settings,
          lastSyncTime: nowFormatted,
        };
        setSettings(updatedSettings);
        StorageService.saveSettings(updatedSettings);
        showToast('🔥 Berhasil terhubung & menyinkronkan semua data ke Firebase Cloud!', 'success');
      } else {
        showToast(fbRes.message, 'error');
      }
    } catch (err: any) {
      setIsSyncing(false);
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        error: 'Gagal menyinkronkan ke cloud.',
      }));
      showToast('Gagal menyinkronkan ke Firebase Cloud.', 'error');
    }
  };

  // Transaction Completed in POS View
  const handleTransactionCompleted = (newTx: Transaction) => {
    // Save to Firebase Firestore (CHECKOUT -> FIREBASE)
    saveOrderToFirebase(newTx).catch((err) => {
      console.warn('Firebase save warning:', err);
    });

    // Re-read products, variants, and mutations as they were modified by completeTransaction
    const updatedProds = StorageService.getProducts();
    const updatedVars = StorageService.getProductVariants();
    const updatedCusts = StorageService.getCustomers();
    setProducts(updatedProds);
    setProductVariants(updatedVars);
    setMutations(StorageService.getStockMutations());
    setTransactions(StorageService.getTransactions());
    setCustomers(updatedCusts);

    // Atomic Firestore transaction for stock deduction (prevents negative or double deduction on concurrent sales)
    deductStockWithFirestoreTransaction(newTx)
      .then((txOk) => {
        if (!txOk) {
          syncProductsToFirebase(updatedProds).catch(() => {});
          syncProductVariantsToFirebase(updatedVars).catch(() => {});
        }
      })
      .catch(() => {
        syncProductsToFirebase(updatedProds).catch(() => {});
        syncProductVariantsToFirebase(updatedVars).catch(() => {});
      });

    // Sync latest stock mutation to Firebase
    const latestMutations = StorageService.getStockMutations();
    if (latestMutations.length > 0) {
      saveStockMutationToFirebase(latestMutations[0]).catch(() => {});
    }

    // Sync customer update to Firebase if applicable
    if (newTx.nama_pelanggan) {
      const cust = updatedCusts.find((c) => c.nama === newTx.nama_pelanggan);
      if (cust) {
        saveCustomerToFirebase(cust).catch(() => {});
      }
    }

    // Trigger auto-sync if enabled and connected
    const scriptUrl = settings.googleSheetsUrl || settings.googleAppsScriptUrl;
    if (settings.autoSync && scriptUrl && navigator.onLine) {
      handleSync();
    }
  };

  // Transaction Update (Status, details, etc. + Automatic Stock Restoration on Cancel)
  const handleUpdateTransaction = (updatedTx: Transaction) => {
    const isCancelled =
      updatedTx.status === 'DIBATALKAN' || updatedTx.status === 'Dibatalkan';

    let finalTx = { ...updatedTx };
    if (isCancelled && !updatedTx.stockRestored) {
      const restored = StorageService.restoreStockOnCancel(updatedTx);
      finalTx = { ...updatedTx, stockRestored: true };
      setProducts(restored.products);
      setProductVariants(restored.variants);
      setMutations(restored.mutations);
      restoreStockWithFirestoreTransaction(finalTx)
        .then((ok) => {
          if (!ok) {
            syncProductsToFirebase(restored.products).catch(() => {});
            syncProductVariantsToFirebase(restored.variants).catch(() => {});
          }
        })
        .catch(() => {});
      if (restored.mutations.length > 0) {
        saveStockMutationToFirebase(restored.mutations[0]).catch(() => {});
      }
      showToast(
        `Stok produk & varian untuk pesanan ${updatedTx.id_transaksi} telah dikembalikan.`,
        'info'
      );
    }

    const current = StorageService.getTransactions();
    const updated = current.map((t) => (t.id_transaksi === finalTx.id_transaksi ? finalTx : t));
    StorageService.saveTransactions(updated);
    setTransactions(updated);

    // Sync status change to Firebase Firestore (KASIR / DELIVERY UPDATE STATUS -> FIREBASE -> CUSTOMER LIVE)
    updateFirebaseOrderStatus(
      finalTx.id_transaksi,
      finalTx.status,
      finalTx,
      finalTx.deliveryStatus
    ).catch((err) => {
      console.warn('Firebase status update error:', err);
    });
  };

  const handleUpdateDeliveryStatus = (
    txId: string,
    newDeliveryStatus: Transaction['deliveryStatus'],
    mappedOrderStatus: Transaction['status'],
    fullUpdatedTx?: Transaction
  ) => {
    if (fullUpdatedTx) {
      handleUpdateTransaction(fullUpdatedTx);
      return;
    }
    const current = StorageService.getTransactions();
    const target = current.find((t) => t.id_transaksi === txId);
    if (!target) return;
    const updatedTx: Transaction = {
      ...target,
      status: mappedOrderStatus,
      deliveryStatus: newDeliveryStatus,
    };
    handleUpdateTransaction(updatedTx);
  };

  // Product CRUD
  const handleAddProduct = (prod: Product) => {
    const updated = StorageService.addProduct(prod);
    setProducts(updated);
    syncProductsToFirebase(updated).catch(() => {});
  };

  const handleUpdateProduct = (prod: Product) => {
    const updated = StorageService.updateProduct(prod);
    setProducts(updated);
    syncProductsToFirebase(updated).catch(() => {});
  };

  const handleDeleteProduct = (id: string) => {
    const cleanId = String(id || '').trim();
    const targetProd = products.find(
      (p) => String(p.id).trim() === cleanId || String(p.sku || '').trim() === cleanId
    );
    const targetSku = targetProd?.sku ? String(targetProd.sku).trim() : '';
    const varsToRemove = productVariants.filter(
      (v) =>
        String(v.productId).trim() === cleanId ||
        (targetSku && String(v.productId).trim() === targetSku)
    );
    const updated = StorageService.deleteProduct(cleanId);
    const updatedVars = StorageService.getProductVariants();
    setProducts(updated);
    setProductVariants(updatedVars);

    deleteProductFromFirebase(cleanId, targetSku).catch(() => {});
    varsToRemove.forEach((v) => deleteProductVariantFromFirebase(v.variantId, v.sku).catch(() => {}));
  };

  const handleAddVariant = (variant: ProductVariant) => {
    const res = StorageService.addProductVariant(variant);
    setProductVariants(res.variants);
    setProducts(res.products);
    saveProductVariantToFirebase(variant).catch(() => {});
    syncProductsToFirebase(res.products).catch(() => {});
  };

  const handleUpdateVariant = (variant: ProductVariant) => {
    const res = StorageService.updateProductVariant(variant);
    setProductVariants(res.variants);
    setProducts(res.products);
    saveProductVariantToFirebase(variant).catch(() => {});
    syncProductsToFirebase(res.products).catch(() => {});
  };

  const handleDeleteVariant = (variantId: string) => {
    const cleanVarId = String(variantId || '').trim();
    const targetVar = productVariants.find(
      (v) => String(v.variantId).trim() === cleanVarId || String(v.sku || '').trim() === cleanVarId
    );
    const res = StorageService.deleteProductVariant(cleanVarId);
    setProductVariants(res.variants);
    setProducts(res.products);
    deleteProductVariantFromFirebase(cleanVarId, targetVar?.sku).catch(() => {});
    syncProductsToFirebase(res.products).catch(() => {});
  };

  const handleBulkSaveProductsAndVariants = (
    newProducts: Product[],
    newVariants: ProductVariant[]
  ) => {
    StorageService.saveProductVariants(newVariants);
    StorageService.saveProducts(newProducts);
    const normProds = StorageService.getProducts();
    const normVars = StorageService.getProductVariants();
    setProducts(normProds);
    setProductVariants(normVars);
    syncProductsToFirebase(normProds).catch(() => {});
    syncProductVariantsToFirebase(normVars).catch(() => {});
  };

  const handleImportProducts = (prods: Product[]) => {
    StorageService.saveProducts(prods);
    const normalized = StorageService.getProducts();
    setProducts(normalized);
    if (prods.length > 0) {
      syncProductsToFirebase(normalized, true).catch(() => {});
    }
  };

  const handleClearAllProducts = async (): Promise<boolean> => {
    StorageService.clearAllProducts();
    StorageService.saveProductVariants([]);
    setProducts([]);
    setProductVariants([]);
    const ok = await clearAllProductsFromFirebase(currentUser?.nama || 'Admin');
    return ok;
  };

  // Stock Updated
  const handleStockUpdated = (
    prods: Product[],
    muts: StockMutation[],
    vars?: ProductVariant[]
  ) => {
    setProducts(prods);
    setMutations(muts);
    if (vars) {
      setProductVariants(vars);
      syncProductVariantsToFirebase(vars).catch(() => {});
    }
    syncProductsToFirebase(prods).catch(() => {});
    if (muts && muts.length > 0) {
      saveStockMutationToFirebase(muts[0]).catch(() => {});
    }
  };

  // Categories CRUD
  const handleAddCategory = (cat: CategoryItem) => {
    const updated = StorageService.addCategory(cat);
    setCategories(updated);
    syncCategoriesToFirebase(updated).catch(() => {});
  };

  const handleUpdateCategory = (cat: CategoryItem) => {
    const updated = StorageService.updateCategory(cat);
    setCategories(updated);
    syncCategoriesToFirebase(updated).catch(() => {});
  };

  const handleDeleteCategory = (id: string) => {
    const updated = StorageService.deleteCategory(id);
    setCategories(updated);
    deleteCategoryFromFirebase(id).catch(() => {});
  };

  // Expenses CRUD
  const handleAddExpense = (expense: Expense) => {
    const updated = StorageService.addExpense(expense);
    setExpenses(updated);
    saveExpenseToFirebase(expense).catch(() => {});
  };

  const handleDeleteExpense = (id: string) => {
    const updated = StorageService.deleteExpense(id);
    setExpenses(updated);
    deleteExpenseFromFirebase(id).catch(() => {});
  };

  // Customers CRUD
  const handleAddCustomer = (cust: Customer) => {
    const updated = [cust, ...customers];
    StorageService.saveCustomers(updated);
    setCustomers(updated);
    saveCustomerToFirebase(cust).catch(() => {});
  };

  const handleUpdateCustomer = (cust: Customer) => {
    const updated = customers.map((c) => (c.id === cust.id ? cust : c));
    StorageService.saveCustomers(updated);
    setCustomers(updated);
    saveCustomerToFirebase(cust).catch(() => {});
  };

  const handleDeleteCustomer = (id: string) => {
    const updated = customers.filter((c) => c.id !== id);
    StorageService.saveCustomers(updated);
    setCustomers(updated);
    deleteCustomerFromFirebase(id).catch(() => {});
  };

  // Save Settings
  const handleSaveSettings = async (newSettings: StoreSettings): Promise<boolean> => {
    // Treat store address as a core persistent field
    const rawAddr = newSettings.address !== undefined ? newSettings.address : newSettings.storeAddress;
    const addr = String(rawAddr ?? '').trim();
    const normalized: StoreSettings = {
      ...newSettings,
      address: addr,
      storeAddress: addr,
    };

    // 1. Immediately update React state for instant local responsiveness
    setSettings(normalized);

    // 2. Persist to localStorage
    StorageService.saveSettings(normalized);

    // 3. Persist to Firestore across all devices
    try {
      const ok = await saveSettingsToFirebase(normalized);
      if (!ok) {
        console.warn('Firebase saveSettingsToFirebase returned false');
      }
      return ok;
    } catch (err) {
      console.warn('Firebase settings save error:', err);
      return false;
    }
  };

  // Reset to initial demo data
  const handleResetData = () => {
    StorageService.resetToDefault();
    setProducts(StorageService.getProducts());
    setTransactions(StorageService.getTransactions());
    setCustomers(StorageService.getCustomers());
    setExpenses(StorageService.getExpenses());
    setMutations(StorageService.getStockMutations());
    setSettings(StorageService.getSettings());
  };

  // Low Stock Count for Badge
  const lowStockCount = products.filter((p) => p.stok <= p.stok_minimum).length;

  // Check if current user is an authenticated internal staff member (Owner, Admin, Kasir, Staff, Delivery)
  const isStaffAuthenticated =
    currentUser !== null &&
    ['Owner', 'Admin', 'Kasir', 'Staff', 'Delivery', 'ADMIN', 'KASIR', 'DELIVERY'].includes(
      currentUser.role
    );

  // Environment Variable Validation (Section 5)
  const firebaseEnvCheck = validateFirebaseEnvironment();
  if (!firebaseEnvCheck.isValid) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-stone-900 border-2 border-amber-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-lg font-black text-white">Konfigurasi Firebase</h2>
          <p className="text-sm text-stone-300 whitespace-pre-line font-semibold">
            {FIREBASE_CONFIG_ERROR_MESSAGE}
          </p>
        </div>
      </div>
    );
  }

  // 0. Direct Shared Digital Receipt & Delivery Proof Viewer (/receipt/:orderId, /delivery-proof/:orderId, ?proof=WBK-XXXX)
  if (sharedReceiptRoute) {
    const targetId = sharedReceiptRoute.orderId;
    const localTx = transactions.find(
      (t) => t.id_transaksi.toLowerCase() === targetId.toLowerCase()
    );
    const matchedProof =
      StorageService.getDeliveryProofs().find(
        (p) => p.orderId.toLowerCase() === targetId.toLowerCase()
      ) || null;

    const matchedTx: Transaction =
      fetchedPublicReceiptTx ||
      (localTx
        ? {
            ...localTx,
            ...(matchedProof
              ? {
                  deliveryStatus: matchedProof.status,
                  courierName: matchedProof.courierName || localTx.courierName,
                  receiverName: matchedProof.receiverName || localTx.receiverName,
                  receiverPhone: matchedProof.receiverPhone || localTx.receiverPhone,
                  proofPhotoUrl: matchedProof.proofPhotoUrl || localTx.proofPhotoUrl,
                  deliveryNote: matchedProof.deliveryNote || localTx.deliveryNote,
                  deliveredAt: matchedProof.deliveredAt || localTx.deliveredAt,
                }
              : {}),
          }
        : ({
            id_transaksi: targetId,
            tanggal: new Date().toISOString().split('T')[0],
            jam: '10:30:00',
            kasir: 'Warung Bang Kobra',
            nama_pelanggan: matchedProof?.customerName || 'Pelanggan Warung Bang Kobra',
            no_whatsapp: matchedProof?.customerPhone || '',
            subtotal: 0,
            diskon: 0,
            biaya: 0,
            total: 0,
            metode_pembayaran: 'QRIS',
            uang_diterima: 0,
            kembalian: 0,
            status: 'SELESAI',
            orderType:
              sharedReceiptRoute.mode === 'delivery-proof' ? 'DELIVERY_DQM' : 'BUNGKUS',
            tipe_pesanan:
              sharedReceiptRoute.mode === 'delivery-proof' ? 'DELIVERY_DQM' : 'BUNGKUS',
            deliveryArea: sharedReceiptRoute.mode === 'delivery-proof' ? 'DQM' : null,
            deliveryStatus:
              sharedReceiptRoute.mode === 'delivery-proof'
                ? matchedProof?.status || 'DITERIMA'
                : null,
            courierName: matchedProof?.courierName || 'Kurir Warung Bang Kobra',
            receiverName: matchedProof?.receiverName || '',
            proofPhotoUrl: matchedProof?.proofPhotoUrl || '',
            deliveryNote: matchedProof?.deliveryNote || '',
            deliveredAt: matchedProof?.deliveredAt || '',
            items: [],
            created_at: new Date().toISOString(),
          } as Transaction));

    if (sharedReceiptRoute.mode === 'delivery-proof') {
      return (
        <DeliveryProofModal
          isOpen={true}
          transaction={matchedTx}
          existingProof={matchedProof || null}
          settings={settings}
          initialMode="view"
          readOnlyCustomerView={!isStaffAuthenticated}
          onClose={() => {
            setSharedReceiptRoute(null);
            if (typeof window !== 'undefined' && window.history.replaceState) {
              window.history.replaceState({}, document.title, '/');
            }
          }}
          showToast={showToast}
        />
      );
    }

    return (
      <ReceiptModal
        transaction={matchedTx}
        settings={settings}
        onClose={() => {
          setSharedReceiptRoute(null);
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState({}, document.title, '/');
          }
        }}
        onNewTransaction={() => {
          setSharedReceiptRoute(null);
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState({}, document.title, '/');
          }
        }}
      />
    );
  }

  // 1. Direct Customer QR Self-Order Mode (from QR Code camera scan)
  if (isCustomerMode) {
    return (
      <CustomerOrderView
        products={products}
        settings={settings}
        initialOrderType={customerOrderType}
        onOrderCreated={(newTx) => {
          setTransactions((prev) => [newTx, ...prev]);
          setProducts(StorageService.getProducts());
        }}
        showToast={showToast}
      />
    );
  }

  // 2. Unauthenticated / Customer Portal: Layout Pelanggan Terpisah
  if (!isStaffAuthenticated) {
    // If user explicitly requests Staff Login view
    if (isStaffLoginMode || activeTab === 'login') {
      return (
        <div className="min-h-screen bg-stone-950 flex flex-col justify-center">
          <LoginView
            currentUser={currentUser}
            settings={settings}
            onLoginSuccess={(user) => {
              handleLoginSuccess(user);
            }}
            onBackToCustomerMenu={() => {
              setIsStaffLoginMode(false);
              setActiveTab('public_menu');
            }}
            showToast={showToast}
          />
        </div>
      );
    }

    // Default Customer Menu: isolated public catalogue with takeaway/delivery ordering
    return (
      <PublicMenuCustomerView
        products={products}
        settings={settings}
        onOpenStaffLogin={() => setIsStaffLoginMode(true)}
        onOrderCreated={(newTx) => {
          setTransactions((prev) => [newTx, ...prev]);
          setProducts(StorageService.getProducts());
        }}
        showToast={showToast}
      />
    );
  }

  // 3. Authenticated Staff: Previewing Customer Menu
  if (isPublicMenuMode) {
    return (
      <div className="min-h-screen flex flex-col bg-stone-950">
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span className="font-extrabold bg-amber-500 text-stone-950 px-2 py-0.5 rounded text-[10px] uppercase">
              Mode Pratinjau
            </span>
            <span>
              Anda sedang melihat tampilan Menu Pelanggan (sebagai {currentUser.nama} - {currentUser.role})
            </span>
          </div>
          <button
            onClick={() => setIsPublicMenuMode(false)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <span>Kembali ke Panel POS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <PublicMenuCustomerView
          products={products}
          settings={settings}
          onOpenStaffLogin={() => setIsPublicMenuMode(false)}
          onOrderCreated={(newTx) => {
            setTransactions((prev) => [newTx, ...prev]);
            setProducts(StorageService.getProducts());
          }}
          showToast={showToast}
        />
      </div>
    );
  }

  // 4. Authenticated Staff: Internal Management Layout (Owner, Admin, Kasir, Staff)
  const effectiveRole = currentUser.role;
  const isTabAuthorized = hasTabAccess(effectiveRole, activeTab);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col antialiased selection:bg-amber-500 selection:text-black">
      {/* Top Application Header */}
      <Header
        settings={settings}
        syncState={syncState}
        onSync={handleSync}
        onToggleTheme={handleToggleTheme}
        currentUser={currentUser}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onNavigateToLogin={() => setActiveTab('login')}
        onLogout={handleLogout}
        onChangeRole={handleRoleChange}
        onRoleChange={handleRoleChange}
        onOpenAIBot={() => setIsAIDrawerOpen(true)}
        onOpenLogoEditor={() => setIsLogoEditorOpen(true)}
        onOpenCustomerView={() => setIsPublicMenuMode(true)}
      />

      {/* Realtime Order Alert Banner for Cashier (FIREBASE -> KASIR MENERIMA PESANAN) */}
      {newOrderAlert && (
        <div className="bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white px-4 py-2.5 shadow-xl flex items-center justify-between gap-3 shrink-0 z-40 border-b border-orange-400/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-bounce">
              <Bell className="w-4 h-4 text-white" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest bg-white text-stone-950 px-2 py-0.5 rounded-md">
                  Pesanan Baru Masuk dari QR
                </span>
                <span className="font-extrabold text-xs truncate">
                  {newOrderAlert.nama_pelanggan} ({newOrderAlert.tipe_pesanan})
                </span>
              </div>
              <p className="text-[11px] text-white/90 truncate">
                {newOrderAlert.id_transaksi} • {newOrderAlert.items.length} Menu •{' '}
                <span className="font-black text-amber-200">
                  {formatRupiah(newOrderAlert.total)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setActiveTab('orders');
                setNewOrderAlert(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-stone-950 hover:bg-stone-100 rounded-xl font-black text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              <span>Buka Pesanan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              title="Tutup Notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area + Responsive Navigation Shell */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onTabChange={setActiveTab}
          role={effectiveRole}
          lowStockCount={lowStockCount}
          currentUser={currentUser}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenLogoEditor={() => setIsLogoEditorOpen(true)}
          logoUrl={settings.logoUrl}
          storeName={settings.storeName}
        />

        {/* Dynamic Views Viewport */}
        <main className="flex-1 flex flex-col overflow-y-auto min-h-0 bg-stone-950 pb-24 lg:pb-6">
          {!isTabAuthorized ? (
            <ProtectedRoute
              currentUser={currentUser}
              currentTab={activeTab}
              activeTab={activeTab}
              userRole={effectiveRole}
              tabLabel={getTabLabel(activeTab)}
              onOpenLogin={() => setActiveTab('login')}
              onSwitchAccount={() => setActiveTab('login')}
              onOpenProfile={() => setIsProfileModalOpen(true)}
              onNavigate={setActiveTab}
            />
          ) : (
            <>
              {activeTab === 'pos' && (
                <POSView
                  products={products}
                  variants={productVariants}
                  settings={settings}
                  onTransactionCompleted={handleTransactionCompleted}
                  showToast={showToast}
                />
              )}

          {activeTab === 'dashboard' && (
            <DashboardView
              transactions={transactions}
              products={products}
              onNavigate={setActiveTab}
              onSelectTransaction={setReceiptTx}
            />
          )}

          {(activeTab === 'orders' || activeTab === 'whatsapp_order') && (
            <OrdersManagementView
              transactions={transactions}
              products={products}
              settings={settings}
              onUpdateTransaction={handleUpdateTransaction}
              onPrintReceipt={setReceiptTx}
              showToast={showToast}
              onNavigateToQR={() => setActiveTab('qrcode_order')}
              onNavigateToDeliveryDQM={() => setActiveTab('delivery_dqm')}
            />
          )}

          {activeTab === 'delivery_dqm' && (
            <DeliveryDQMDashboard
              transactions={transactions}
              settings={settings}
              userRole={effectiveRole}
              currentUserName={currentUser?.nama || settings.activeCashier || 'Petugas Delivery DQM'}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
              onViewReceipt={setReceiptTx}
              showToast={showToast}
            />
          )}

          {activeTab === 'qrcode_order' && (
            <QRCodeOrderManagerView
              settings={settings}
              onOpenCustomerView={(type) => {
                setCustomerOrderType(type);
                setIsCustomerMode(true);
              }}
              showToast={showToast}
            />
          )}

          {(activeTab === 'public_menu' || activeTab === 'menu_ads') && (
            <PublicMenuManagerView
              products={products}
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onOpenCustomerView={() => {
                setIsPublicMenuMode(true);
              }}
              showToast={showToast}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              variants={productVariants}
              userRole={effectiveRole}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onImportProducts={handleImportProducts}
              onClearAllProducts={handleClearAllProducts}
              onAddVariant={handleAddVariant}
              onUpdateVariant={handleUpdateVariant}
              onDeleteVariant={handleDeleteVariant}
              onBulkSaveProductsAndVariants={handleBulkSaveProductsAndVariants}
              showToast={showToast}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              categories={categories}
              products={products}
              onNavigateToProducts={() => setActiveTab('products')}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              showToast={showToast}
            />
          )}

          {activeTab === 'stock' && (
            <StockView
              products={products}
              variants={productVariants}
              mutations={mutations}
              settings={settings}
              onStockUpdated={handleStockUpdated}
              showToast={showToast}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              transactions={transactions}
              products={products}
              variants={productVariants}
              expenses={expenses}
              onSelectTransaction={setReceiptTx}
              showToast={showToast}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              settings={settings}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              showToast={showToast}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              transactions={transactions}
              settings={settings}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              showToast={showToast}
            />
          )}

          {activeTab === 'users' && (
            <UsersManagementView
              settings={settings}
              onUpdateSettings={handleSaveSettings}
              showToast={showToast}
            />
          )}

          {activeTab === 'ai_bot' && (
            <AIBotView
              products={products}
              transactions={transactions}
              settings={settings}
              onNavigate={setActiveTab}
              showToast={showToast}
            />
          )}

          {activeTab === 'login' && (
            <LoginView
              currentUser={currentUser}
              settings={settings}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
              onNavigate={setActiveTab}
              showToast={showToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              products={products}
              onSaveSettings={handleSaveSettings}
              onSyncNow={handleSync}
              isSyncing={isSyncing}
              onResetData={handleResetData}
              showToast={showToast}
            />
          )}
            </>
          )}
        </main>
      </div>

      {/* Floating KobraBot AI Launcher Button (Quick Access anywhere) */}
      <button
        id="btn-floating-kobra-bot"
        onClick={() => setIsAIDrawerOpen(true)}
        title="Tanya Asisten AI KobraBot"
        className="fixed bottom-18 lg:bottom-6 right-4 sm:right-6 z-40 p-3 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 text-stone-950 font-extrabold shadow-xl shadow-amber-950/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border-2 border-stone-900 group cursor-pointer"
      >
        <Bot className="w-5 h-5 text-stone-950 animate-bounce" />
        <span className="hidden sm:inline text-xs tracking-wide">Tanya KobraBot</span>
        <Sparkles className="w-3.5 h-3.5 text-stone-950" />
      </button>

      {/* AI Bot Quick Slide-over Drawer */}
      <AIBotDrawer
        isOpen={isAIDrawerOpen}
        onClose={() => setIsAIDrawerOpen(false)}
        products={products}
        transactions={transactions}
        settings={settings}
        onNavigateToFull={() => setActiveTab('ai_bot')}
        showToast={showToast}
      />

      {/* Quick Logo Editor Modal */}
      <LogoEditorModal
        isOpen={isLogoEditorOpen}
        onClose={() => setIsLogoEditorOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        showToast={showToast}
      />

      {/* Global Receipt Modal Popup (when clicked from Dashboard or Reports) */}
      {receiptTx && (
        <ReceiptModal
          transaction={receiptTx}
          settings={settings}
          onClose={() => setReceiptTx(null)}
          onNewTransaction={() => {
            setReceiptTx(null);
            setActiveTab('pos');
          }}
        />
      )}

      {/* RBAC Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        settings={settings}
        showToast={showToast}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* RBAC User Profile & Role Permissions Matrix Modal */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          settings={settings}
          showToast={showToast}
          onUpdateUser={handleUpdateCurrentUser}
          onSwitchUser={handleLoginSuccess}
          onLogout={handleLogout}
          onOpenLogin={() => {
            setIsProfileModalOpen(false);
            setActiveTab('login');
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-200">
          <div
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
                : 'bg-stone-900/95 border-amber-500/40 text-stone-100'
            }`}
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'error' && (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'info' && (
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-stone-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
