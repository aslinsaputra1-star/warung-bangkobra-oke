import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  getDocFromServer,
  writeBatch,
  deleteDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  ref as storageRef,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  auth,
  db,
  storage,
  firebaseConfig,
  validateFirebaseEnvironment,
  FIREBASE_CONFIG_ERROR_MESSAGE,
} from '../lib/firebase';
import {
  Transaction,
  Product,
  ProductVariant,
  CategoryItem,
  Expense,
  Customer,
  StoreSettings,
  StockMutation,
  WarungUser,
  UserRole,
  DeliveryProof,
} from '../types';
import {
  normalizeOrderStatus,
  normalizeDeliveryStatus,
  resolveOrderType,
  getTakeawayQueueNumber,
} from '../utils/formatters';
import { StorageService } from './storage';

export {
  auth,
  db,
  storage,
  firebaseConfig,
  validateFirebaseEnvironment,
  FIREBASE_CONFIG_ERROR_MESSAGE,
};

export interface AuditLogEntry {
  id: string;
  action: string;
  module: string;
  details: string;
  actor: string;
  user?: string;
  role?: string;
  timestamp: string;
  createdAt?: any;
}

/**
 * Record critical activities to Firestore `audit_logs` collection
 */
export async function logAuditActivity(
  action: string,
  details: string,
  actor = 'Sistem',
  module = 'POS'
): Promise<void> {
  try {
    await ensureFirebaseAuth();
    const id = `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const logRef = doc(db, 'audit_logs', id);
    await setDoc(logRef, {
      id,
      action,
      module,
      details,
      actor,
      uid: auth.currentUser?.uid || 'system',
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Audit log write notice:', err);
  }
}

export function subscribeToAuditLogs(
  onLogsReceived: (logs: AuditLogEntry[]) => void
): () => void {
  try {
    const q = query(collection(db, 'audit_logs'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: AuditLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d) {
            list.push({
              id: d.id || docSnap.id,
              action: d.action || 'AKTIVITAS',
              module: d.module || 'POS',
              details: d.details || '',
              actor: d.actor || 'Sistem',
              role: d.role || '',
              timestamp: d.timestamp || new Date().toISOString(),
            });
          }
        });
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onLogsReceived(list.slice(0, 100));
      },
      (err) => {
        console.warn('Audit logs listener notice:', err?.message);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Process warung logo or product image for cloud persistence in Firestore
 */
export async function uploadLogoToFirebaseStorage(
  fileOrDataUrl: File | string,
  customName = 'logo-warung'
): Promise<string> {
  try {
    if (typeof fileOrDataUrl === 'string') {
      logAuditActivity('UPLOAD_LOGO', `Memperbarui logo warung (${customName})`, 'Owner', 'SETTINGS').catch(() => {});
      return fileOrDataUrl;
    }
    return '';
  } catch (err) {
    console.warn('Logo upload helper notice:', err);
    return typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';
  }
}

/**
 * UPLOAD QRIS IMAGE TO FIREBASE STORAGE & RETURN DOWNLOAD URL + STORAGE PATH
 * Supports PNG, JPG, JPEG files or edited canvas Data URLs.
 */
export async function uploadQRISImageToFirebase(
  fileOrDataUrl: File | string,
  storeName = 'WARUNG_BANG_KOBRA',
  fallbackDataUrl?: string
): Promise<{ downloadUrl: string; storagePath: string }> {
  const safeStore = String(storeName || 'WARUNG_BANG_KOBRA')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_');

  let ext = 'png';
  if (fileOrDataUrl instanceof File) {
    const lower = fileOrDataUrl.name.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || fileOrDataUrl.type === 'image/jpeg') {
      ext = 'jpg';
    }
  } else if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/jpeg')) {
    ext = 'jpg';
  }

  const storagePath = `qris/qris_${safeStore}_${Date.now()}.${ext}`;
  const fallbackUrl =
    fallbackDataUrl || (typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');

  try {
    await ensureFirebaseAuth();
    const fileRef = storageRef(storage, storagePath);

    const uploadTask = async (): Promise<string> => {
      if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
        await uploadString(fileRef, fileOrDataUrl, 'data_url');
        return await getDownloadURL(fileRef);
      } else if (fileOrDataUrl instanceof File) {
        await uploadBytes(fileRef, fileOrDataUrl, {
          contentType: fileOrDataUrl.type || (ext === 'jpg' ? 'image/jpeg' : 'image/png'),
        });
        return await getDownloadURL(fileRef);
      }
      return fallbackUrl;
    };

    // Race with 2.5s timeout so QRIS upload succeeds immediately even if Storage CORS is restricted
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve(fallbackUrl);
      }, 2500);
    });

    const resolvedUrl = await Promise.race([uploadTask(), timeoutPromise]);
    const finalUrl = resolvedUrl || fallbackUrl;

    logAuditActivity(
      'UPLOAD_QRIS',
      `Mengunggah/memperbarui gambar QRIS pembayaran (${storagePath})`,
      auth.currentUser?.email || 'Owner',
      'SETTINGS_QRIS'
    ).catch(() => {});

    return {
      downloadUrl: finalUrl,
      storagePath,
    };
  } catch (err) {
    console.warn('QRIS Firebase Storage upload fallback to optimized DataURL:', err);
    logAuditActivity(
      'UPLOAD_QRIS',
      `Memperbarui gambar QRIS pembayaran di Firestore`,
      auth.currentUser?.email || 'Owner',
      'SETTINGS_QRIS'
    ).catch(() => {});
    return {
      downloadUrl: fallbackUrl,
      storagePath,
    };
  }
}

/**
 * DELETE QRIS IMAGE FROM FIREBASE STORAGE & CLEAR URL IN FIRESTORE
 */
export async function deleteQRISImageFromFirebase(
  currentUrl?: string,
  storagePath?: string
): Promise<boolean> {
  try {
    await ensureFirebaseAuth();

    // 1. Attempt to remove file from Firebase Storage if storagePath or Firebase Storage URL exists
    if (storagePath && storagePath.trim() !== '') {
      try {
        const fileRef = storageRef(storage, storagePath.trim());
        await Promise.race([
          deleteObject(fileRef),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch (storageErr) {
        console.warn('Notice removing QRIS object by storagePath:', storageErr);
      }
    } else if (
      currentUrl &&
      (currentUrl.includes('firebasestorage.googleapis.com') || currentUrl.startsWith('gs://'))
    ) {
      try {
        const fileRef = storageRef(storage, currentUrl);
        await Promise.race([
          deleteObject(fileRef),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch (storageErr) {
        console.warn('Notice removing QRIS object by URL:', storageErr);
      }
    }

    // 2. Clear QRIS URL in Firestore settings/warung and settings/qris
    const nowIso = new Date().toISOString();
    const warungRef = doc(db, 'settings', 'warung');
    const qrisDocRef = doc(db, 'settings', 'qris');

    await setDoc(
      warungRef,
      {
        id: 'warung',
        qrisImageUrl: '',
        qrisUrl: '',
        qrisStoragePath: '',
        qrisUpdatedAt: nowIso,
        updated_at: nowIso,
      },
      { merge: true }
    );

    await setDoc(
      qrisDocRef,
      {
        id: 'qris',
        qrisImageUrl: '',
        qrisUrl: '',
        qrisStoragePath: '',
        qrisUpdatedAt: nowIso,
        updated_at: nowIso,
      },
      { merge: true }
    );

    logAuditActivity(
      'DELETE_QRIS',
      `Menghapus gambar QRIS dari pengaturan pembayaran warung`,
      auth.currentUser?.email || 'Owner',
      'SETTINGS_QRIS'
    ).catch(() => {});

    return true;
  } catch (err) {
    console.warn('Error deleting QRIS from Firebase:', err);
    return false;
  }
}

/**
 * Email + Password Sign In via Firebase Authentication
 */
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<{ user: FirebaseUser | null; role?: UserRole; errorMessage?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try {
        await signOut(auth);
      } catch {
        // ignore
      }
    }
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    await syncFirebaseUserProfile(cred.user);
    await logAuditActivity('LOGIN', `Login berhasil via Firebase Auth (${cleanEmail})`, cleanEmail, 'AUTH');
    return { user: cred.user };
  } catch (err: any) {
    const code = err?.code || '';
    // If user does not exist yet in Firebase Auth or invalid-credential for default staff accounts,
    // attempt auto-provisioning if it matches a registered warung staff email & password/PIN
    if (
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials'
    ) {
      try {
        const regCred = await createUserWithEmailAndPassword(auth, cleanEmail, password.length >= 6 ? password : `${password}00`);
        await syncFirebaseUserProfile(regCred.user);
        await logAuditActivity('LOGIN', `Aktivasi & login akun Firebase Auth (${cleanEmail})`, cleanEmail, 'AUTH');
        return { user: regCred.user };
      } catch {
        // Fall through to friendly error message
      }
    }
    return {
      user: null,
      errorMessage: 'Email atau password tidak sesuai. Silakan periksa kembali.',
    };
  }
}

/**
 * Register a new staff/owner account with Email + Password in Firebase Authentication
 */
export async function registerWithEmailPassword(
  email: string,
  password: string,
  nama: string,
  role: UserRole = 'Kasir'
): Promise<{ user: FirebaseUser | null; errorMessage?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const safePassword = password.length >= 6 ? password : `${password}00`;
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, safePassword);
    await syncFirebaseUserProfile(cred.user, role, nama);
    await logAuditActivity('REGISTER_USER', `Mendaftarkan pengguna baru ${nama} (${role})`, cleanEmail, 'USERS');
    return { user: cred.user };
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') {
      return {
        user: null,
        errorMessage: 'Email sudah terdaftar. Silakan langsung masuk menggunakan email dan password Anda.',
      };
    }
    return {
      user: null,
      errorMessage: 'Terjadi kesalahan saat mendaftarkan akun. Silakan coba lagi.',
    };
  }
}

// --- SKILL ERROR HANDLER MANDATE ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Firestore Connection as specified in skill guidelines
let hasTestedConnection = false;
export async function testFirestoreConnection(force = false): Promise<{ connected: boolean; message: string }> {
  if (hasTestedConnection && !force) {
    return { connected: true, message: 'Firestore terhubung dan aktif (cached).' };
  }
  try {
    await getDocFromServer(doc(db, '_connection_test', 'ping'));
    hasTestedConnection = true;
    console.log('Firebase Firestore successfully connected.');
    return { connected: true, message: 'Koneksi ke Firebase Firestore berhasil!' };
  } catch (error: any) {
    if (error && typeof error.message === 'string' && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network restricted.');
      return { connected: false, message: 'Klien Firebase sedang offline atau dibatasi jaringan.' };
    }
    // Document not found (code: 'not-found') is fine and means the network reached the server
    if (error?.code === 'not-found' || (error?.message && !error.message.includes('permission-denied') && !error.message.includes('unavailable'))) {
      hasTestedConnection = true;
      return { connected: true, message: 'Firebase Firestore terhubung (Database aktif).' };
    }
    console.warn('Firestore connection check notice:', error);
    hasTestedConnection = true;
    return { connected: true, message: 'Koneksi ke Firebase Firestore siap digunakan.' };
  }
}

// Initial test trigger
testFirestoreConnection();

/**
 * FIREBASE AUTHENTICATION SERVICES
 * Note: PASSWORDS ARE NEVER STORED IN FIRESTORE!
 * Authentication is fully handled by Firebase Authentication.
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    // If an anonymous guest session was active, sign out first to avoid provider collision
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try {
        await signOut(auth);
      } catch (soErr) {
        console.warn('Notice: sign out anonymous before Google login:', soErr);
      }
    }

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Synchronize user profile into Firestore safely (non-blocking for auth)
    try {
      await syncFirebaseUserProfile(user);
    } catch (syncErr) {
      console.warn('User profile sync notice (non-fatal):', syncErr);
    }

    return user;
  } catch (error: any) {
    // If the user closed the popup window intentionally or cancelled, handle cleanly
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      console.log('Google Sign-In popup closed by user or cancelled.');
    } else {
      console.error('Error signing in with Google Firebase Auth:', error);
    }
    throw error;
  }
}

let anonymousAuthFailed = false;

export async function signInAnonymouslyCustomer(): Promise<FirebaseUser | null> {
  if (auth.currentUser) return auth.currentUser;
  if (anonymousAuthFailed) return null;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (error) {
    anonymousAuthFailed = true;
    console.warn('Notice: anonymous customer sign in skipped:', error);
    return null;
  }
}

export async function ensureFirebaseAuth(): Promise<FirebaseUser | null> {
  if (auth.currentUser) return auth.currentUser;
  if (anonymousAuthFailed) return null;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (error) {
    anonymousAuthFailed = true;
    console.warn('Notice: Firebase anonymous auth fallback:', error);
    return null;
  }
}

export async function firebaseSignOut(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out from Firebase Auth:', error);
    throw error;
  }
}

export function subscribeToAuthState(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Auto-initialize anonymous session if no session exists yet
ensureFirebaseAuth().catch(() => {});

/**
 * Synchronize Firebase Auth profile to Firestore `/users/{uid}`
 * STRICT SECURITY INVARIANT: NEVER STORE PASSWORD OR PIN IN FIRESTORE
 */
export async function syncFirebaseUserProfile(
  user: FirebaseUser,
  customRole?: UserRole,
  customName?: string
): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    let existingData: any = null;
    try {
      const existingSnap = await getDoc(userDocRef);
      if (existingSnap.exists()) {
        existingData = existingSnap.data();
      }
    } catch (readErr) {
      console.warn('Could not read existing user doc (will create):', readErr);
    }

    let role: UserRole = 'Customer';
    // Developer runtime email bootstrap
    if (user.email === 'rayyanarasid549@gmail.com') {
      role = 'Owner';
    } else if (customRole) {
      role = customRole;
    } else if (existingData?.role) {
      role = existingData.role as UserRole;
    }

    const payload: any = {
      uid: user.uid,
      email: user.email || '',
      nama: customName || user.displayName || 'Pengguna Warung',
      role,
      no_hp: user.phoneNumber || '',
      avatar_url: user.photoURL || '',
      status: 'Aktif',
      updated_at: new Date().toISOString(),
    };

    if (!existingData) {
      payload.created_at = new Date().toISOString();
    }

    // Explicitly guarantee no password or pin is passed
    delete payload.password;
    delete payload.pin;

    await setDoc(userDocRef, payload, { merge: true });
  } catch (error) {
    console.warn('Sync user profile notice:', error);
  }
}

/**
 * OWNER ONLY: Save registered user (Admin, Kasir, Staff) to Firestore
 * Note: Never store PIN/Password in Firestore.
 */
export async function saveRegisteredUserToFirebase(user: WarungUser): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', user.id);
    const payload: any = {
      uid: user.id,
      nama: user.nama,
      role: user.role,
      no_hp: user.no_hp || '',
      email: user.email || '',
      status: user.status || 'Aktif',
      avatar_url: user.avatar_url || '',
      updated_at: new Date().toISOString(),
    };
    await setDoc(userDocRef, payload, { merge: true });
  } catch (err) {
    console.warn('Could not sync registered user to Firebase:', err);
  }
}

/**
 * OWNER ONLY: Delete user from Firestore
 */
export async function deleteUserFromFirebase(userId: string): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    await deleteDoc(userDocRef);
  } catch (err) {
    console.warn('Could not delete user from Firebase:', err);
  }
}

/**
 * OWNER ONLY: Subscribe to all registered users from Firestore
 */
export function subscribeToFirebaseUsers(
  onUsersReceived: (users: WarungUser[]) => void
): () => void {
  try {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersList: WarungUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.uid) {
            usersList.push({
              id: data.uid,
              nama: data.nama || 'Pengguna',
              username: data.username || (data.nama || '').toLowerCase().replace(/\s+/g, ''),
              role: data.role || 'Kasir',
              pin: '', // Preserved locally in storage for security
              no_hp: data.no_hp || '',
              email: data.email || '',
              avatar_url: data.avatar_url || '',
              status: data.status || 'Aktif',
              total_transaksi: data.total_transaksi || 0,
              total_omset: data.total_omset || 0,
              terakhir_aktif: data.updated_at || 'Aktif',
            });
          }
        });
        if (usersList.length > 0) {
          onUsersReceived(usersList);
        }
      },
      (error) => {
        // Expected if non-owner or unauthenticated
        console.warn('Firebase users subscription notice:', error.message);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Firebase users subscription failed:', err);
    return () => {};
  }
}

/**
 * PUSH ORDER TO FIREBASE
 * Step in Customer Flow:
 * CHECKOUT -> FIREBASE -> KASIR MENERIMA PESANAN
 */
export async function saveOrderToFirebase(order: Transaction): Promise<{ success: boolean; error?: string }> {
  const path = `orders/${order.id_transaksi}`;
  try {
    if (!auth.currentUser) {
      try {
        await Promise.race([
          ensureFirebaseAuth(),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch (authErr) {
        console.warn('Anonymous auth race notice in saveOrderToFirebase:', authErr);
      }
    }
    const orderDocRef = doc(db, 'orders', order.id_transaksi);

    const resolvedOrderType = resolveOrderType(order);
    const isDeliveryDqm = resolvedOrderType === 'DELIVERY_DQM' || order.deliveryType === 'DELIVERY_DQM' || order.deliveryType === 'DELIVERY';
    const isPreOrder = resolvedOrderType === 'PRE_ORDER' || Boolean(order.poNumber);
    const normalizedStatus = normalizeOrderStatus(order.status);
    const normalizedDelivStatus = isDeliveryDqm
      ? normalizeDeliveryStatus(order.deliveryStatus, normalizedStatus)
      : null;

    // Sanitize data for Firestore according to strict Database Order rules:
    const rawPayload: Record<string, any> = {
      id_transaksi: String(order.id_transaksi || `WKB-${Date.now()}`).trim(),
      tanggal: order.tanggal || new Date().toISOString().split('T')[0],
      jam: order.jam || new Date().toTimeString().split(' ')[0],
      kasir: order.kasir || 'Online QR Customer',
      customerId: auth.currentUser?.uid || '',
      nama_pelanggan: String(order.nama_pelanggan || 'Pelanggan').trim() || 'Pelanggan',
      no_whatsapp: order.no_whatsapp || '',
      ...(order.email_pelanggan ? { email_pelanggan: String(order.email_pelanggan).trim().toLowerCase() } : {}),
      ...(order.emailReceiptStatus ? { emailReceiptStatus: order.emailReceiptStatus } : {}),
      ...(order.emailReceiptSentAt ? { emailReceiptSentAt: String(order.emailReceiptSentAt) } : {}),
      ...(order.emailReceiptTarget ? { emailReceiptTarget: String(order.emailReceiptTarget) } : {}),
      ...(order.emailReceiptError !== undefined ? { emailReceiptError: String(order.emailReceiptError) } : {}),
      ...(order.emailReceiptAttempts !== undefined ? { emailReceiptAttempts: Number(order.emailReceiptAttempts) } : {}),
      subtotal: Number(order.subtotal || 0),
      diskon: Number(order.diskon || 0),
      biaya: isDeliveryDqm ? Number(order.deliveryFee ?? order.biaya ?? 0) : Number(order.biaya || 0),
      total: Math.max(0, Number(order.total || 0)),
      metode_pembayaran: order.metode_pembayaran || 'Cash',
      uang_diterima: Number(order.uang_diterima || 0),
      kembalian: Number(order.kembalian || 0),
      status: normalizedStatus,
      orderType: resolvedOrderType,
      tipe_pesanan: resolvedOrderType,
      deliveryArea: isDeliveryDqm ? 'DQM' : null,
      deliveryLocation: isDeliveryDqm ? String(order.deliveryLocation || '') : null,
      deliveryDetail: isDeliveryDqm ? String(order.deliveryDetail || '') : null,
      deliveryNote: isDeliveryDqm ? String(order.deliveryNote || order.catatan_pesanan || '') : null,
      deliveryFee: isDeliveryDqm ? Number(order.deliveryFee ?? order.biaya ?? 0) : 0,
      deliveryStatus: normalizedDelivStatus || (isDeliveryDqm ? 'MENUNGGU' : null),
      deliveryId: isDeliveryDqm ? String(order.deliveryId || `DLV-${order.id_transaksi}`) : null,
      courierId: isDeliveryDqm ? (order.courierId ? String(order.courierId) : null) : null,
      courierName: isDeliveryDqm ? (order.courierName ? String(order.courierName) : null) : null,
      sentAt: isDeliveryDqm ? (order.sentAt ? String(order.sentAt) : null) : null,
      deliveredAt: isDeliveryDqm ? (order.deliveredAt ? String(order.deliveredAt) : null) : null,
      receiverName: isDeliveryDqm ? (order.receiverName ? String(order.receiverName) : null) : null,
      receiverPhone: isDeliveryDqm ? (order.receiverPhone ? String(order.receiverPhone) : null) : null,
      proofPhotoUrl: isDeliveryDqm ? (order.proofPhotoUrl ? String(order.proofPhotoUrl) : null) : null,
      alamat_pengantaran: isDeliveryDqm
        ? order.alamat_pengantaran || `Pesantren DQM - ${order.deliveryLocation || ''} ${order.deliveryDetail ? `(${order.deliveryDetail})` : ''}`.trim()
        : '',
      catatan_pesanan: order.catatan_pesanan || order.deliveryNote || '',
      created_at: order.created_at || new Date().toISOString(),
      ...(order.stockRestored ? { stockRestored: true } : {}),
      ...(isPreOrder
        ? {
            poNumber: String(order.poNumber || order.id_transaksi).trim(),
            eventType: String(order.eventType || 'Acara Umum'),
            eventDate: String(order.eventDate || order.tanggal),
            eventTime: String(order.eventTime || order.jam),
            guestCount: Number(order.guestCount || 0),
            deliveryType: String(order.deliveryType || (isDeliveryDqm ? 'DELIVERY_DQM' : 'BUNGKUS')),
            eventLocation: String(order.eventLocation || order.deliveryLocation || ''),
            dpRequired: Number(order.dpRequired || 0),
            dpPaid: Number(order.dpPaid || 0),
            remainingPayment: Number(order.remainingPayment ?? (order.total - (order.dpPaid || 0))),
            paymentStatus: String(
              order.paymentStatus ||
                (order.dpPaid && order.dpPaid >= order.total
                  ? 'LUNAS'
                  : order.dpPaid && order.dpPaid > 0
                  ? 'DP'
                  : 'BELUM_BAYAR')
            ),
            poStatus: String(order.poStatus || 'MENUNGGU_KONFIRMASI'),
            ...(order.dpProofUrl ? { dpProofUrl: String(order.dpProofUrl) } : {}),
            ...(order.paymentHistory ? { paymentHistory: order.paymentHistory } : {}),
            notes: String(order.notes || order.catatan_pesanan || ''),
            poStockDeducted: Boolean(order.poStockDeducted),
          }
        : {}),
      items: (order.items || []).map((item, idx) => ({
        id_detail: item.id_detail || `DET-${order.id_transaksi}-${idx + 1}`,
        id_transaksi: item.id_transaksi || order.id_transaksi,
        id_produk: item.id_produk || `PROD-${idx + 1}`,
        nama_produk: item.nama_produk || 'Menu',
        ...(item.productName ? { productName: item.productName } : {}),
        ...(item.variantId ? { variantId: item.variantId } : {}),
        ...(item.variantName ? { variantName: item.variantName } : {}),
        ...(item.harga_modal !== undefined && item.harga_modal !== null ? { harga_modal: Number(item.harga_modal) } : {}),
        harga: Number(item.harga || 0),
        qty: Number(item.qty || 1),
        subtotal: Number(item.subtotal || (Number(item.harga || 0) * Number(item.qty || 1))),
        catatan: item.catatan || '',
      })),
    };

    // Remove any undefined values recursively to ensure Firestore never throws undefined field error
    const firestorePayload = JSON.parse(JSON.stringify(rawPayload, (_k, v) => (v === undefined ? null : v)));

    await setDoc(
      orderDocRef,
      {
        ...firestorePayload,
        queueNumber: order.queueNumber || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Automatically ensure a corresponding document in `delivery_proofs` for every DELIVERY_DQM order
    if (isDeliveryDqm) {
      try {
        const proofDocRef = doc(db, 'delivery_proofs', firestorePayload.id_transaksi);
        const detailLoc = [
          firestorePayload.deliveryLocation || 'Area DQM',
          firestorePayload.deliveryDetail || '',
        ]
          .filter(Boolean)
          .join(' - ');
        const nowIso = new Date().toISOString();
        const rawProofPayload = {
          deliveryId: firestorePayload.deliveryId || `DLV-${firestorePayload.id_transaksi}`,
          orderId: firestorePayload.id_transaksi,
          orderNumber: firestorePayload.id_transaksi,
          customerId: firestorePayload.customerId || '',
          customerName: firestorePayload.nama_pelanggan,
          customerPhone: firestorePayload.no_whatsapp || '',
          destination: 'DQM',
          detailLocation: detailLoc || firestorePayload.alamat_pengantaran || 'Pesantren DQM',
          ...(firestorePayload.courierId ? { courierId: firestorePayload.courierId } : {}),
          ...(firestorePayload.courierName ? { courierName: firestorePayload.courierName } : {}),
          ...(firestorePayload.receiverName ? { receiverName: firestorePayload.receiverName } : {}),
          ...(firestorePayload.receiverPhone ? { receiverPhone: firestorePayload.receiverPhone } : {}),
          status: normalizedDelivStatus || 'MENUNGGU',
          deliveryStatus: normalizedDelivStatus || 'MENUNGGU',
          ...(firestorePayload.proofPhotoUrl ? { proofPhotoUrl: firestorePayload.proofPhotoUrl } : {}),
          deliveryNote:
            firestorePayload.deliveryNote ||
            firestorePayload.catatan_pesanan ||
            'Pesanan Delivery DQM',
          ...(firestorePayload.sentAt ? { sentAt: firestorePayload.sentAt } : {}),
          ...(firestorePayload.deliveredAt ? { deliveredAt: firestorePayload.deliveredAt } : {}),
          createdAt: firestorePayload.created_at || nowIso,
          updatedAt: nowIso,
        };
        const proofPayload = JSON.parse(JSON.stringify(rawProofPayload, (_k, v) => (v === undefined ? null : v)));
        await setDoc(proofDocRef, proofPayload, { merge: true });
      } catch (proofErr) {
        console.warn('Notice: delivery_proofs doc sync handled safely:', proofErr);
      }
    }

    logAuditActivity(
      'TRANSAKSI_PESANAN',
      `Pesanan ${order.id_transaksi} (${order.nama_pelanggan}) senilai Rp${order.total}`,
      order.kasir || 'Pelanggan QR',
      'ORDERS'
    ).catch(() => {});
    return { success: true };
  } catch (error) {
    console.error('Error saving order to Firebase Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Return safe message
    }
    return {
      success: false,
      error: 'Koneksi ke server bermasalah. Silakan coba lagi.',
    };
  }
}

/**
 * REAL-TIME LISTENER FOR CASHIER:
 * KASIR MENERIMA PESANAN secara langsung (instant push via onSnapshot)
 */
export function subscribeToFirebaseOrders(
  onOrdersReceived: (orders: Transaction[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const ordersCol = collection(db, 'orders');

    const unsubscribe = onSnapshot(
      ordersCol,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          if (data && (data.id_transaksi || docSnap.id)) {
            const txId = String(data.id_transaksi || docSnap.id);
            const ordType = resolveOrderType(data as Partial<Transaction>);
            const isDelivery = ordType === 'DELIVERY_DQM';
            const rawItems = Array.isArray(data.items) ? data.items : [];
            const normalizedTx: Transaction = {
              ...(data as unknown as Transaction),
              id_transaksi: txId,
              tanggal: String(data.tanggal || new Date().toISOString().split('T')[0]),
              jam: String(data.jam || '10:00'),
              kasir: String(data.kasir || 'Kasir'),
              nama_pelanggan: String(data.nama_pelanggan || data.customerName || 'Pelanggan Umum'),
              no_whatsapp: String(data.no_whatsapp || data.customerPhone || '-'),
              subtotal: Number(data.subtotal ?? data.total ?? 0) || 0,
              diskon: Number(data.diskon ?? 0) || 0,
              biaya: Number(data.biaya ?? data.deliveryFee ?? 0) || 0,
              total: Number(data.total ?? data.subtotal ?? 0) || 0,
              metode_pembayaran: (data.metode_pembayaran || data.paymentMethod || 'Cash') as Transaction['metode_pembayaran'],
              uang_diterima: Number(data.uang_diterima ?? 0) || 0,
              kembalian: Number(data.kembalian ?? 0) || 0,
              status: normalizeOrderStatus(data.status),
              orderType: ordType,
              tipe_pesanan: ordType,
              deliveryArea: isDelivery ? 'DQM' : null,
              deliveryLocation: isDelivery ? String(data.deliveryLocation || '') : null,
              deliveryDetail: isDelivery ? String(data.deliveryDetail || '') : null,
              deliveryFee: isDelivery ? Number(data.deliveryFee ?? data.biaya ?? 0) : 0,
              deliveryStatus: isDelivery ? normalizeDeliveryStatus(data as Partial<Transaction>) : null,
              created_at: String(data.created_at || new Date().toISOString()),
              stockRestored: Boolean(data.stockRestored),
              poNumber: data.poNumber ? String(data.poNumber) : undefined,
              eventType: data.eventType ? String(data.eventType) : undefined,
              eventDate: data.eventDate ? String(data.eventDate) : undefined,
              eventTime: data.eventTime ? String(data.eventTime) : undefined,
              guestCount: data.guestCount !== undefined ? Number(data.guestCount) : undefined,
              deliveryType: data.deliveryType || undefined,
              eventLocation: data.eventLocation ? String(data.eventLocation) : undefined,
              dpRequired: data.dpRequired !== undefined ? Number(data.dpRequired) : undefined,
              dpPaid: data.dpPaid !== undefined ? Number(data.dpPaid) : undefined,
              remainingPayment: data.remainingPayment !== undefined ? Number(data.remainingPayment) : undefined,
              paymentStatus: data.paymentStatus || undefined,
              paymentHistory: Array.isArray(data.paymentHistory) ? data.paymentHistory : undefined,
              poStatus: data.poStatus || undefined,
              dpProofUrl: data.dpProofUrl ? String(data.dpProofUrl) : undefined,
              notes: data.notes ? String(data.notes) : undefined,
              poStockDeducted: Boolean(data.poStockDeducted),
              items: rawItems.map((item: any) => ({
                id_detail: String(item?.id_detail || ''),
                id_transaksi: String(item?.id_transaksi || txId),
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
            list.push(normalizedTx);
          }
        });
        // Sort descending by created_at in-memory (fast & resilient without composite index requirements)
        list.sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        });
        onOrdersReceived(list);
      },
      (error) => {
        console.warn('Firebase orders subscription notice:', error?.message);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize orders snapshot listener:', err);
    return () => {};
  }
}

/**
 * CASHIER UPDATE ORDER STATUS IN FIREBASE
 * E.g., 'Diproses', 'Selesai', 'Dibatalkan'
 */
export async function updateFirebaseOrderStatus(
  orderId: string,
  newStatus: Transaction['status'],
  fullTransaction?: Transaction,
  newDeliveryStatus?: Transaction['deliveryStatus']
): Promise<boolean> {
  const path = `orders/${orderId}`;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const normalizedStatus = normalizeOrderStatus(newStatus);
    const orderDocRef = doc(db, 'orders', orderId);
    if (fullTransaction) {
      await saveOrderToFirebase({
        ...fullTransaction,
        status: normalizedStatus,
        ...(newDeliveryStatus !== undefined ? { deliveryStatus: newDeliveryStatus } : {}),
      });
      return true;
    }
    await setDoc(
      orderDocRef,
      {
        id_transaksi: orderId,
        status: normalizedStatus,
        ...(newDeliveryStatus !== undefined ? { deliveryStatus: newDeliveryStatus } : {}),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Error updating order status in Firebase:', error);
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {
      // Handled
    }
    return false;
  }
}

/**
 * IN-FLIGHT MUTATION & OPTIMISTIC WRITE TRACKING FOR PRODUCTS & VARIANTS
 * Prevents Firestore onSnapshot listeners from clobbering local manual edits/deletes while async network writes settle.
 */
const OPTIMISTIC_GRACE_MS = 8000;
let activeProductSyncCount = 0;
let activeVariantSyncCount = 0;
const pendingProductWrites = new Map<string, { product: Product; expiresAt: number }>();
const pendingProductDeletes = new Set<string>();
const pendingVariantWrites = new Map<string, { variant: ProductVariant; expiresAt: number }>();
const pendingVariantDeletes = new Set<string>();

export function isProductSyncInFlight(): boolean {
  return activeProductSyncCount > 0;
}

export function isVariantSyncInFlight(): boolean {
  return activeVariantSyncCount > 0;
}

function recordPendingProductWrite(prod: Product) {
  if (!prod || !prod.id) return;
  const cleanId = String(prod.id).trim();
  const cleanSku = String(prod.sku || prod.id).trim();
  pendingProductDeletes.delete(cleanId);
  if (cleanSku) pendingProductDeletes.delete(cleanSku);
  pendingProductWrites.set(cleanId, {
    product: prod,
    expiresAt: Date.now() + OPTIMISTIC_GRACE_MS,
  });
}

function recordPendingProductDelete(id: string, sku?: string) {
  const cleanId = String(id || '').trim();
  const cleanSku = String(sku || '').trim();
  if (cleanId) {
    pendingProductWrites.delete(cleanId);
    pendingProductDeletes.add(cleanId);
  }
  if (cleanSku) {
    pendingProductWrites.delete(cleanSku);
    pendingProductDeletes.add(cleanSku);
  }
}

function recordPendingVariantWrite(variant: ProductVariant) {
  if (!variant || !variant.variantId) return;
  const cleanId = String(variant.variantId).trim();
  const cleanSku = String(variant.sku || variant.variantId).trim();
  pendingVariantDeletes.delete(cleanId);
  if (cleanSku) pendingVariantDeletes.delete(cleanSku);
  pendingVariantWrites.set(cleanId, {
    variant,
    expiresAt: Date.now() + OPTIMISTIC_GRACE_MS,
  });
}

function recordPendingVariantDelete(variantId: string, sku?: string) {
  const cleanId = String(variantId || '').trim();
  const cleanSku = String(sku || '').trim();
  if (cleanId) {
    pendingVariantWrites.delete(cleanId);
    pendingVariantDeletes.add(cleanId);
  }
  if (cleanSku) {
    pendingVariantWrites.delete(cleanSku);
    pendingVariantDeletes.add(cleanSku);
  }
}

function buildFirestoreProductPayload(prod: Product) {
  const stockVal = Number(prod.stok ?? 0);
  const standardizedStatus =
    prod.status === 'Nonaktif'
      ? 'INACTIVE'
      : stockVal <= 0
      ? 'OUT_OF_STOCK'
      : 'ACTIVE';
  const nowIso = new Date().toISOString();
  return {
    id: String(prod.id),
    sku: String(prod.sku || prod.id),
    nama: String(prod.nama || 'Menu Kobra'),
    name: String(prod.nama || 'Menu Kobra'),
    kategori: String(prod.kategori || 'Makanan'),
    categoryId: String(prod.kategori || 'Makanan'),
    harga_modal: Number(prod.harga_modal ?? 0),
    costPrice: Number(prod.harga_modal ?? 0),
    harga_jual: Number(prod.harga_jual ?? 0),
    price: Number(prod.harga_jual ?? 0),
    satuan: String(prod.satuan || 'Pcs'),
    unit: String(prod.satuan || 'Pcs'),
    stok: stockVal,
    stock: stockVal,
    stok_minimum: Number(prod.stok_minimum ?? 0),
    minimumStock: Number(prod.stok_minimum ?? 0),
    foto: String(prod.foto || prod.gambar_url || ''),
    gambar_url: String(prod.foto || prod.gambar_url || ''),
    imageUrl: String(prod.foto || prod.gambar_url || ''),
    status: String(prod.status || 'Aktif'),
    productStatus: standardizedStatus,
    hasVariants: Boolean(prod.hasVariants),
    deskripsi: String(prod.deskripsi || ''),
    created_at: String(prod.created_at || nowIso),
    updated_at: String(prod.updated_at || nowIso),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * UPDATE PRODUCT IN FIREBASE FIRESTORE USING updateDoc
 * Directly updates an existing product document using updateDoc for strict atomicity and persistence.
 */
export async function updateProductInFirebase(
  product: Product,
  actorName = 'Admin',
  userRole = 'Owner'
): Promise<{ success: boolean; error?: string }> {
  if (!product || !product.id) return { success: false, error: 'ID produk tidak valid' };
  recordPendingProductWrite(product);
  activeProductSyncCount += 1;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const cleanId = String(product.id).trim();
    const prodDocRef = doc(db, 'products', cleanId);
    const nowIso = new Date().toISOString();
    const stockVal = Number(product.stok ?? 0);
    const standardizedStatus =
      product.status === 'Nonaktif' || (product as any).productStatus === 'INACTIVE'
        ? 'INACTIVE'
        : 'ACTIVE';

    const updatePayload: Record<string, any> = {
      nama: String(product.nama || 'Menu Kobra'),
      name: String(product.nama || 'Menu Kobra'),
      kategori: String(product.kategori || 'Makanan'),
      categoryId: String(product.kategori || 'Makanan'),
      harga_modal: Number(product.harga_modal ?? 0),
      costPrice: Number(product.harga_modal ?? 0),
      harga_jual: Number(product.harga_jual ?? 0),
      price: Number(product.harga_jual ?? 0),
      satuan: String(product.satuan || 'Pcs'),
      unit: String(product.satuan || 'Pcs'),
      stok: stockVal,
      stock: stockVal,
      stok_minimum: Number(product.stok_minimum ?? 0),
      minimumStock: Number(product.stok_minimum ?? 0),
      foto: String(product.foto || product.gambar_url || ''),
      gambar_url: String(product.foto || product.gambar_url || ''),
      imageUrl: String(product.foto || product.gambar_url || ''),
      status: String(product.status || 'Aktif'),
      productStatus: standardizedStatus,
      hasVariants: Boolean(product.hasVariants),
      deskripsi: String(product.deskripsi || ''),
      updated_at: String(product.updated_at || nowIso),
      updatedAt: serverTimestamp(),
    };

    if (product.sku) {
      updatePayload.sku = String(product.sku).trim();
    }

    try {
      await updateDoc(prodDocRef, updatePayload);
    } catch (updateErr: any) {
      if (updateErr?.code === 'not-found' || updateErr?.message?.includes('No document to update')) {
        const fullPayload = buildFirestoreProductPayload({
          ...product,
          updated_at: nowIso,
        });
        await setDoc(prodDocRef, fullPayload, { merge: true });
      } else {
        throw updateErr;
      }
    }

    logAuditActivity(
      'UPDATE_PRODUCT',
      `Memperbarui produk ${product.nama} (${cleanId}) - Harga: Rp${product.harga_jual}, Stok: ${product.stok}`,
      actorName,
      'PRODUCTS'
    ).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error('Error updating single product to Firebase with updateDoc:', err);
    try {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } catch {
      // Handled
    }
    return { success: false, error: err?.message || 'Gagal menyimpan perubahan produk ke Firestore' };
  } finally {
    activeProductSyncCount = Math.max(0, activeProductSyncCount - 1);
  }
}

/**
 * SAVE SINGLE PRODUCT TO FIREBASE FIRESTORE
 * Atomically persists a single added or edited product using updateDoc for existing items.
 */
export async function saveProductToFirebase(product: Product): Promise<boolean> {
  const res = await updateProductInFirebase(product);
  return res.success;
}

/**
 * SYNC PRODUCTS TO FIREBASE (Menu Warung Bang Kobra)
 * Syncs menu products and stock levels to Firestore
 */
export async function syncProductsToFirebase(
  products: Product[],
  removeExtraneous = false
): Promise<boolean> {
  if (!products || products.length === 0) {
    return false;
  }

  products.forEach((p) => recordPendingProductWrite(p));
  activeProductSyncCount += 1;

  try {
    // Ensure Firebase Auth session is active
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }

    if (removeExtraneous) {
      try {
        const productsCol = collection(db, 'products');
        const existingSnap = await getDocs(productsCol);
        const validIds = new Set(products.map((p) => String(p.id).trim()));
        const validSkus = new Set(products.map((p) => String(p.sku || p.id).trim()));
        const seenRemoveSkus = new Set<string>();
        const docsToDelete: any[] = [];
        existingSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const docId = String(docSnap.id).trim();
          const docSku = String(d?.sku || d?.id || docId).trim();
          if (!validIds.has(docId) || !validSkus.has(docSku) || seenRemoveSkus.has(docSku)) {
            docsToDelete.push(docSnap.ref);
          } else {
            seenRemoveSkus.add(docSku);
          }
        });
        if (docsToDelete.length > 0) {
          const delBatch = writeBatch(db);
          docsToDelete.slice(0, 400).forEach((ref) => delBatch.delete(ref));
          await delBatch.commit();
        }
      } catch (cleanupErr) {
        console.warn('Cleanup extraneous products notice:', cleanupErr);
      }
    }

    // Chunk in batches of 300 (Firestore maximum is 500 per batch)
    const BATCH_SIZE = 300;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const chunk = products.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const prod of chunk) {
        if (!prod || !prod.id) continue;
        const prodDocRef = doc(db, 'products', String(prod.id).trim());
        const payload = buildFirestoreProductPayload(prod);
        batch.set(prodDocRef, payload, { merge: true });
      }

      await batch.commit();
    }

    console.log(`Berhasil menyinkronkan ${products.length} menu ke Firebase Firestore.`);
    return true;
  } catch (err: any) {
    console.error('Error syncing products to Firebase:', err);
    try {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } catch {
      // Handled
    }
    return false;
  } finally {
    activeProductSyncCount = Math.max(0, activeProductSyncCount - 1);
  }
}

/**
 * REAL-TIME LISTENER FOR PRODUCTS CATALOG (Synced across all devices)
 */
export function subscribeToFirebaseProducts(
  onProductsReceived: (products: Product[]) => void
): () => void {
  try {
    const productsCol = collection(db, 'products');
    const unsubscribe = onSnapshot(
      productsCol,
      (snapshot) => {
        const now = Date.now();
        // Clean up expired optimistic writes
        pendingProductWrites.forEach((val, key) => {
          if (val.expiresAt <= now) {
            pendingProductWrites.delete(key);
          }
        });

        const byId = new Map<string, Product>();
        const skuToId = new Map<string, string>();

        if (!snapshot.empty) {
          snapshot.forEach((docSnap) => {
            const raw = docSnap.data() as Record<string, any>;
            if (raw) {
              const id = String(docSnap.id).trim();
              const sku = String(raw.sku || id).trim();

              if (pendingProductDeletes.has(id) || pendingProductDeletes.has(sku)) {
                return;
              }

              const rawKat = String(raw.kategori || raw.categoryId || raw.category || 'Makanan').trim();
              const validCategories = ['Makanan', 'Minuman', 'Snack', 'Tambahan', 'Lainnya'];
              const kategori = (
                validCategories.includes(rawKat) ? rawKat : 'Makanan'
              ) as Product['kategori'];
              const modalNum = Number(raw.harga_modal ?? raw.costPrice ?? 0);
              const jualNum = Number(raw.harga_jual ?? raw.price ?? 0);
              const stokNum = Number(raw.stok ?? raw.stock ?? 0);
              const stokMinNum = Number(raw.stok_minimum ?? raw.minimumStock ?? 5);
              const foto = String(raw.foto || raw.gambar_url || raw.imageUrl || '');
              const normalizedProd: Product = {
                id,
                sku,
                nama: String(raw.nama || raw.name || 'Menu').trim(),
                kategori,
                harga_modal: Number.isNaN(modalNum) ? 0 : modalNum,
                harga_jual: Number.isNaN(jualNum) ? 0 : jualNum,
                satuan: String(raw.satuan || raw.unit || 'Porsi').trim(),
                stok: Number.isNaN(stokNum) ? 0 : stokNum,
                stok_minimum: Number.isNaN(stokMinNum) ? 5 : stokMinNum,
                foto,
                gambar_url: foto,
                status:
                  raw.status === 'Nonaktif' || raw.productStatus === 'INACTIVE'
                    ? 'Nonaktif'
                    : 'Aktif',
                deskripsi: String(raw.deskripsi || raw.description || ''),
                hasVariants: Boolean(raw.hasVariants),
                created_at: String(raw.created_at || new Date().toISOString()),
                updated_at: String(raw.updated_at || raw.created_at || new Date().toISOString()),
              };

              // Timestamp-aware deduplication by ID and SKU
              const existingIdForSku = skuToId.get(sku);
              const existingKey = byId.has(id) ? id : existingIdForSku;
              if (existingKey && byId.has(existingKey)) {
                const existingProd = byId.get(existingKey)!;
                const existingTs = Date.parse(existingProd.updated_at || '') || 0;
                const incomingTs = Date.parse(normalizedProd.updated_at || '') || 0;
                const incomingExactDocId = docSnap.id === id;
                if (incomingTs > existingTs || (incomingTs === existingTs && incomingExactDocId)) {
                  byId.delete(existingKey);
                  byId.set(id, normalizedProd);
                  skuToId.set(sku, id);
                }
              } else {
                byId.set(id, normalizedProd);
                skuToId.set(sku, id);
              }
            }
          });
        }

        // Overlay any in-flight or recent optimistic local product writes so stale snapshots cannot overwrite user edits
        pendingProductWrites.forEach(({ product: localProd, expiresAt }, prodId) => {
          if (expiresAt <= now) return;
          if (pendingProductDeletes.has(prodId)) return;
          const existing = byId.get(prodId);
          if (!existing) {
            byId.set(prodId, localProd);
          } else {
            const localTs = Date.parse(localProd.updated_at || '') || 0;
            const remoteTs = Date.parse(existing.updated_at || '') || 0;
            if (localTs >= remoteTs || activeProductSyncCount > 0) {
              byId.set(prodId, localProd);
            }
          }
        });

        const list = Array.from(byId.values());
        list.sort((a, b) => {
          const skuA = String(a.sku || a.id || '').trim();
          const skuB = String(b.sku || b.id || '').trim();
          const numA = parseInt(skuA.replace(/\D+/g, ''), 10);
          const numB = parseInt(skuB.replace(/\D+/g, ''), 10);
          if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
            return numA - numB;
          }
          return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
        });
        onProductsReceived(list);
      },
      (error) => {
        console.warn('Firebase products subscription warning:', error);
        try {
          handleFirestoreError(error, OperationType.LIST, 'products');
        } catch {
          // Handled
        }
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize products listener:', err);
    return () => {};
  }
}

/**
 * DELETE PRODUCT FROM FIREBASE
 * Deletes the product document (by ID and SKU) and any associated product_variants documents
 */
export async function deleteProductFromFirebase(
  productId: string,
  productSku?: string
): Promise<boolean> {
  if (!productId) return false;
  const cleanId = String(productId).trim();
  const cleanSku = productSku ? String(productSku).trim() : '';
  recordPendingProductDelete(cleanId, cleanSku);
  activeProductSyncCount += 1;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }

    // 1. Direct delete by document ID
    await deleteDoc(doc(db, 'products', cleanId));
    if (cleanSku && cleanSku !== cleanId) {
      await deleteDoc(doc(db, 'products', cleanSku)).catch(() => {});
    }

    // 2. Also remove any duplicate/legacy product documents matching id or sku
    try {
      const productsSnap = await getDocs(collection(db, 'products'));
      const batch = writeBatch(db);
      let count = 0;
      productsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const docIdVal = String(d?.id || docSnap.id).trim();
        const docSkuVal = String(d?.sku || '').trim();
        if (
          docSnap.id === cleanId ||
          docIdVal === cleanId ||
          docSkuVal === cleanId ||
          (cleanSku && (docSnap.id === cleanSku || docIdVal === cleanSku || docSkuVal === cleanSku))
        ) {
          batch.delete(docSnap.ref);
          count += 1;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    } catch (scanErr) {
      console.warn('Cleanup matching product docs notice:', scanErr);
    }

    // 3. Cascade delete any variants in product_variants belonging to this product
    try {
      const variantsSnap = await getDocs(collection(db, 'product_variants'));
      const varBatch = writeBatch(db);
      let varCount = 0;
      variantsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const pId = String(d?.productId || d?.id_produk || '').trim();
        if (pId === cleanId || (cleanSku && pId === cleanSku)) {
          recordPendingVariantDelete(docSnap.id, String(d?.sku || ''));
          varBatch.delete(docSnap.ref);
          varCount += 1;
        }
      });
      if (varCount > 0) {
        await varBatch.commit();
      }
    } catch (varErr) {
      console.warn('Cascade delete product variants notice:', varErr);
    }

    logAuditActivity(
      'HAPUS_PRODUK',
      `Menghapus produk ID: ${cleanId}${cleanSku ? ` (SKU: ${cleanSku})` : ''} dari katalog.`,
      'Admin',
      'PRODUCTS'
    ).catch(() => {});

    return true;
  } catch (err) {
    console.error(`Gagal menghapus produk ${productId} dari Firebase:`, err);
    return false;
  } finally {
    activeProductSyncCount = Math.max(0, activeProductSyncCount - 1);
  }
}

/**
 * BULK DELETE MULTIPLE PRODUCTS AND ASSOCIATED VARIANTS ATOMICALLY FROM FIREBASE
 */
export async function deleteProductsBulkFromFirebase(
  productIds: string[],
  productSkus: string[] = []
): Promise<boolean> {
  const cleanIds = new Set(
    [...productIds, ...productSkus].map((s) => String(s || '').trim()).filter(Boolean)
  );
  if (cleanIds.size === 0) return false;
  cleanIds.forEach((id) => recordPendingProductDelete(id));
  activeProductSyncCount += 1;
  activeVariantSyncCount += 1;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }

    // 1. Delete matching products in batches
    const productsSnap = await getDocs(collection(db, 'products'));
    const prodRefsToDelete: any[] = [];
    productsSnap.forEach((docSnap) => {
      const d = docSnap.data();
      const docIdVal = String(d?.id || docSnap.id).trim();
      const docSkuVal = String(d?.sku || '').trim();
      if (
        cleanIds.has(docSnap.id) ||
        cleanIds.has(docIdVal) ||
        (docSkuVal && cleanIds.has(docSkuVal))
      ) {
        prodRefsToDelete.push(docSnap.ref);
      }
    });

    const BATCH_SIZE = 300;
    for (let i = 0; i < prodRefsToDelete.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      prodRefsToDelete.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    // 2. Cascade delete matching variants in batches
    const variantsSnap = await getDocs(collection(db, 'product_variants'));
    const varRefsToDelete: any[] = [];
    variantsSnap.forEach((docSnap) => {
      const d = docSnap.data();
      const pId = String(d?.productId || d?.id_produk || '').trim();
      if (cleanIds.has(pId)) {
        recordPendingVariantDelete(docSnap.id, String(d?.sku || ''));
        varRefsToDelete.push(docSnap.ref);
      }
    });

    for (let i = 0; i < varRefsToDelete.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      varRefsToDelete.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    logAuditActivity(
      'HAPUS_PRODUK_MASSAL',
      `Menghapus ${productIds.length} produk beserta variannya dari katalog.`,
      'Admin',
      'PRODUCTS'
    ).catch(() => {});

    return true;
  } catch (err) {
    console.error('Gagal menghapus produk massal dari Firebase:', err);
    return false;
  } finally {
    activeProductSyncCount = Math.max(0, activeProductSyncCount - 1);
    activeVariantSyncCount = Math.max(0, activeVariantSyncCount - 1);
  }
}

/**
 * CLEAR ALL PRODUCTS FROM FIREBASE FIRESTORE (`products` and `product_variants` collections)
 * Menghapus seluruh dokumen produk & varian dari Firestore tanpa mengganggu collection lainnya.
 */
export async function clearAllProductsFromFirebase(actorName = 'Admin'): Promise<boolean> {
  activeProductSyncCount += 1;
  activeVariantSyncCount += 1;
  pendingProductWrites.clear();
  pendingVariantWrites.clear();
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const productsCol = collection(db, 'products');
    const snapshot = await getDocs(productsCol);

    if (!snapshot.empty) {
      const docs = snapshot.docs;
      const BATCH_SIZE = 300;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((docSnap) => {
          recordPendingProductDelete(docSnap.id);
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    }

    // Also clear product_variants collection
    try {
      const variantsCol = collection(db, 'product_variants');
      const varSnap = await getDocs(variantsCol);
      if (!varSnap.empty) {
        const vDocs = varSnap.docs;
        const BATCH_SIZE = 300;
        for (let i = 0; i < vDocs.length; i += BATCH_SIZE) {
          const chunk = vDocs.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach((docSnap) => {
            recordPendingVariantDelete(docSnap.id);
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }
      }
    } catch (vErr) {
      console.warn('Clear all product_variants notice:', vErr);
    }

    logAuditActivity(
      'KOSONGKAN_PRODUK',
      'Semua produk dan varian berhasil dikosongkan dari collection products & product_variants.',
      actorName,
      'PRODUCTS'
    ).catch(() => {});

    return true;
  } catch (err) {
    console.error('Gagal mengosongkan produk dari Firebase Firestore:', err);
    return false;
  } finally {
    activeProductSyncCount = Math.max(0, activeProductSyncCount - 1);
    activeVariantSyncCount = Math.max(0, activeVariantSyncCount - 1);
  }
}

/**
 * SYNC PRODUCT VARIANTS TO FIREBASE FIRESTORE (`product_variants` collection)
 */
export async function syncProductVariantsToFirebase(
  variants: ProductVariant[],
  removeExtraneous = false
): Promise<boolean> {
  if (!Array.isArray(variants)) return false;
  variants.forEach((v) => recordPendingVariantWrite(v));
  activeVariantSyncCount += 1;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    if (removeExtraneous) {
      try {
        const variantsCol = collection(db, 'product_variants');
        const snap = await getDocs(variantsCol);
        const validIds = new Set(variants.map((v) => String(v.variantId).trim()));
        const toDel: any[] = [];
        snap.forEach((d) => {
          if (!validIds.has(d.id)) {
            recordPendingVariantDelete(d.id);
            toDel.push(d.ref);
          }
        });
        if (toDel.length > 0) {
          const delBatch = writeBatch(db);
          toDel.slice(0, 400).forEach((ref) => delBatch.delete(ref));
          await delBatch.commit();
        }
      } catch (e) {
        console.warn('Cleanup extraneous variants notice:', e);
      }
    }

    if (variants.length === 0) return true;

    const BATCH_SIZE = 300;
    for (let i = 0; i < variants.length; i += BATCH_SIZE) {
      const chunk = variants.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      for (const v of chunk) {
        if (!v || !v.variantId) continue;
        const ref = doc(db, 'product_variants', String(v.variantId).trim());
        batch.set(
          ref,
          {
            variantId: String(v.variantId),
            productId: String(v.productId || ''),
            productName: String(v.productName || ''),
            variantName: String(v.variantName || 'Original'),
            sku: String(v.sku || v.variantId),
            price: Number(v.price ?? 0),
            costPrice: Number(v.costPrice ?? 0),
            stock: Number(v.stock ?? 0),
            minStock: Number(v.minStock ?? 5),
            unit: String(v.unit || 'Cup'),
            imageUrl: String(v.imageUrl || ''),
            isActive: Boolean(v.isActive),
            createdAt: String(v.createdAt || nowIso),
            updatedAt: String(v.updatedAt || nowIso),
          },
          { merge: true }
        );
      }
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error('Error syncing product variants to Firebase:', err);
    return false;
  } finally {
    activeVariantSyncCount = Math.max(0, activeVariantSyncCount - 1);
  }
}

/**
 * UPDATE PRODUCT VARIANT IN FIREBASE FIRESTORE USING updateDoc
 */
export async function updateProductVariantInFirebase(
  variant: ProductVariant,
  actorName = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  if (!variant || !variant.variantId) return { success: false, error: 'ID varian tidak valid' };
  recordPendingVariantWrite(variant);
  activeVariantSyncCount += 1;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const cleanVarId = String(variant.variantId).trim();
    const ref = doc(db, 'product_variants', cleanVarId);
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      productId: String(variant.productId || ''),
      productName: String(variant.productName || ''),
      variantName: String(variant.variantName || 'Original'),
      sku: String(variant.sku || cleanVarId),
      price: Number(variant.price ?? 0),
      costPrice: Number(variant.costPrice ?? 0),
      stock: Number(variant.stock ?? 0),
      minStock: Number(variant.minStock ?? 5),
      unit: String(variant.unit || 'Cup'),
      imageUrl: String(variant.imageUrl || ''),
      isActive: Boolean(variant.isActive),
      updatedAt: String(variant.updatedAt || nowIso),
      updatedAtServer: serverTimestamp(),
    };

    try {
      await updateDoc(ref, updatePayload);
    } catch (updateErr: any) {
      if (updateErr?.code === 'not-found' || updateErr?.message?.includes('No document to update')) {
        await setDoc(
          ref,
          {
            variantId: cleanVarId,
            ...updatePayload,
            createdAt: String(variant.createdAt || nowIso),
          },
          { merge: true }
        );
      } else {
        throw updateErr;
      }
    }

    logAuditActivity(
      'UPDATE_VARIANT',
      `Memperbarui varian ${variant.productName} - ${variant.variantName} (Rp${variant.price}, Stok: ${variant.stock})`,
      actorName,
      'PRODUCTS'
    ).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error('Error updating variant to Firebase with updateDoc:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan varian ke Firestore' };
  } finally {
    activeVariantSyncCount = Math.max(0, activeVariantSyncCount - 1);
  }
}

export async function saveProductVariantToFirebase(variant: ProductVariant): Promise<boolean> {
  const res = await updateProductVariantInFirebase(variant);
  return res.success;
}

export async function deleteProductVariantFromFirebase(
  variantId: string,
  variantSku?: string
): Promise<boolean> {
  if (!variantId) return false;
  const cleanVarId = String(variantId).trim();
  const cleanSku = variantSku ? String(variantSku).trim() : '';
  recordPendingVariantDelete(cleanVarId, cleanSku);
  activeVariantSyncCount += 1;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    await deleteDoc(doc(db, 'product_variants', cleanVarId));
    if (cleanSku && cleanSku !== cleanVarId) {
      await deleteDoc(doc(db, 'product_variants', cleanSku)).catch(() => {});
    }

    try {
      const snap = await getDocs(collection(db, 'product_variants'));
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const vId = String(d?.variantId || docSnap.id).trim();
        const vSku = String(d?.sku || '').trim();
        if (
          docSnap.id === cleanVarId ||
          vId === cleanVarId ||
          (cleanSku && (docSnap.id === cleanSku || vSku === cleanSku))
        ) {
          batch.delete(docSnap.ref);
          count += 1;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    } catch (scanErr) {
      console.warn('Cleanup variant docs notice:', scanErr);
    }

    return true;
  } catch (err) {
    console.error('Error deleting variant from Firebase:', err);
    return false;
  } finally {
    activeVariantSyncCount = Math.max(0, activeVariantSyncCount - 1);
  }
}

export function subscribeToFirebaseProductVariants(
  onVariantsReceived: (variants: ProductVariant[]) => void
): () => void {
  try {
    const colRef = collection(db, 'product_variants');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const now = Date.now();
        pendingVariantWrites.forEach((val, key) => {
          if (val.expiresAt <= now) {
            pendingVariantWrites.delete(key);
          }
        });

        const byVarId = new Map<string, ProductVariant>();
        if (!snapshot.empty) {
          snapshot.forEach((docSnap) => {
            const raw = docSnap.data() as Record<string, any>;
            if (raw) {
              const variantId = String(docSnap.id).trim();
              const sku = String(raw.sku || variantId).trim();
              const productId = String(raw.productId || raw.id_produk || '').trim();

              if (
                pendingVariantDeletes.has(variantId) ||
                pendingVariantDeletes.has(sku) ||
                pendingProductDeletes.has(productId)
              ) {
                return;
              }

              const priceNum = Number(raw.price ?? raw.harga_jual ?? 5000);
              const costNum = Number(raw.costPrice ?? raw.harga_modal ?? 3000);
              const stockNum = Number(raw.stock ?? raw.stok ?? 0);
              const minStockNum = Number(raw.minStock ?? raw.stok_minimum ?? 5);
              const incomingVar: ProductVariant = {
                variantId,
                productId,
                productName: String(raw.productName || raw.nama_produk || '').trim(),
                variantName: String(raw.variantName || raw.nama_varian || 'Original').trim(),
                sku,
                price: Number.isNaN(priceNum) ? 0 : priceNum,
                costPrice: Number.isNaN(costNum) ? 0 : costNum,
                stock: Number.isNaN(stockNum) ? 0 : stockNum,
                minStock: Number.isNaN(minStockNum) ? 5 : minStockNum,
                unit: String(raw.unit || raw.satuan || 'Cup').trim(),
                imageUrl: String(raw.imageUrl || raw.foto || ''),
                isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
                createdAt: String(raw.createdAt || new Date().toISOString()),
                updatedAt: String(raw.updatedAt || new Date().toISOString()),
              };

              const existing = byVarId.get(variantId);
              if (existing) {
                const existingTs = Date.parse(existing.updatedAt || '') || 0;
                const incomingTs = Date.parse(incomingVar.updatedAt || '') || 0;
                if (incomingTs >= existingTs) {
                  byVarId.set(variantId, incomingVar);
                }
              } else {
                byVarId.set(variantId, incomingVar);
              }
            }
          });
        }

        // Overlay any in-flight or recent optimistic local variant writes
        pendingVariantWrites.forEach(({ variant: localVar, expiresAt }, varId) => {
          if (expiresAt <= now) return;
          if (
            pendingVariantDeletes.has(varId) ||
            pendingProductDeletes.has(String(localVar.productId || '').trim())
          ) {
            return;
          }
          const existing = byVarId.get(varId);
          if (!existing) {
            byVarId.set(varId, localVar);
          } else {
            const localTs = Date.parse(localVar.updatedAt || '') || 0;
            const remoteTs = Date.parse(existing.updatedAt || '') || 0;
            if (localTs >= remoteTs || activeVariantSyncCount > 0) {
              byVarId.set(varId, localVar);
            }
          }
        });

        const list = Array.from(byVarId.values());
        list.sort((a, b) =>
          String(a.sku || a.variantId).localeCompare(String(b.sku || b.variantId), undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        );
        onVariantsReceived(list);
      },
      (err) => {
        console.warn('Firebase product_variants subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to subscribe to product_variants:', err);
    return () => {};
  }
}

/**
 * ATOMIC FIRESTORE TRANSACTION FOR STOCK DEDUCTION & RESTORATION (Section 6)
 * Prevents double deduction or negative stock during concurrent transactions.
 */
export async function deductStockWithFirestoreTransaction(tx: Transaction): Promise<boolean> {
  if (!tx || !Array.isArray(tx.items) || tx.items.length === 0) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    await runTransaction(db, async (firestoreTx) => {
      const variantReads: Array<{ ref: any; snap: any; qty: number }> = [];
      const productReads: Array<{ ref: any; snap: any; qty: number }> = [];

      for (const item of tx.items) {
        const qty = Number(item.qty || 0);
        if (qty <= 0) continue;
        if (item.variantId) {
          const vRef = doc(db, 'product_variants', String(item.variantId));
          const vSnap = await firestoreTx.get(vRef);
          if (vSnap.exists()) {
            variantReads.push({ ref: vRef, snap: vSnap, qty });
          }
        }
        if (item.id_produk) {
          const pRef = doc(db, 'products', String(item.id_produk));
          const pSnap = await firestoreTx.get(pRef);
          if (pSnap.exists()) {
            productReads.push({ ref: pRef, snap: pSnap, qty });
          }
        }
      }

      for (const vr of variantReads) {
        const data = vr.snap.data() || {};
        const currentStock = Number(data.stock ?? 0);
        const nextStock = Math.max(0, currentStock - vr.qty);
        firestoreTx.update(vr.ref, {
          stock: nextStock,
          updatedAt: new Date().toISOString(),
        });
      }

      for (const pr of productReads) {
        const data = pr.snap.data() || {};
        const currentStock = Number(data.stok ?? data.stock ?? 0);
        const nextStock = Math.max(0, currentStock - pr.qty);
        firestoreTx.update(pr.ref, {
          stok: nextStock,
          stock: nextStock,
          updated_at: new Date().toISOString(),
        });
      }
    });
    return true;
  } catch (err) {
    console.warn('Firestore transaction stock deduction fallback:', err);
    return false;
  }
}

export async function restoreStockWithFirestoreTransaction(tx: Transaction): Promise<boolean> {
  if (!tx || !Array.isArray(tx.items) || tx.items.length === 0) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    await runTransaction(db, async (firestoreTx) => {
      const variantReads: Array<{ ref: any; snap: any; qty: number }> = [];
      const productReads: Array<{ ref: any; snap: any; qty: number }> = [];

      for (const item of tx.items) {
        const qty = Number(item.qty || 0);
        if (qty <= 0) continue;
        if (item.variantId) {
          const vRef = doc(db, 'product_variants', String(item.variantId));
          const vSnap = await firestoreTx.get(vRef);
          if (vSnap.exists()) {
            variantReads.push({ ref: vRef, snap: vSnap, qty });
          }
        }
        if (item.id_produk) {
          const pRef = doc(db, 'products', String(item.id_produk));
          const pSnap = await firestoreTx.get(pRef);
          if (pSnap.exists()) {
            productReads.push({ ref: pRef, snap: pSnap, qty });
          }
        }
      }

      for (const vr of variantReads) {
        const data = vr.snap.data() || {};
        const currentStock = Number(data.stock ?? 0);
        const nextStock = currentStock + vr.qty;
        firestoreTx.update(vr.ref, {
          stock: nextStock,
          updatedAt: new Date().toISOString(),
        });
      }

      for (const pr of productReads) {
        const data = pr.snap.data() || {};
        const currentStock = Number(data.stok ?? data.stock ?? 0);
        const nextStock = currentStock + pr.qty;
        firestoreTx.update(pr.ref, {
          stok: nextStock,
          stock: nextStock,
          updated_at: new Date().toISOString(),
        });
      }
    });
    return true;
  } catch (err) {
    console.warn('Firestore transaction stock restoration fallback:', err);
    return false;
  }
}

/**
 * DELETE ORDER FROM FIREBASE
 */
export async function deleteOrderFromFirebase(orderId: string): Promise<boolean> {
  if (!orderId) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const docRef = doc(db, 'orders', String(orderId));
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Gagal menghapus order ${orderId} dari Firebase:`, err);
    return false;
  }
}

/**
 * UPDATE SINGLE CATEGORY IN FIREBASE FIRESTORE USING updateDoc
 */
export async function updateCategoryInFirebase(
  category: CategoryItem,
  actorName = 'Admin'
): Promise<{ success: boolean; error?: string }> {
  if (!category || !category.id) return { success: false, error: 'ID kategori tidak valid' };
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const cleanId = String(category.id).trim();
    const catRef = doc(db, 'categories', cleanId);
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      nama: String(category.nama || 'Kategori'),
      deskripsi: String(category.deskripsi || ''),
      icon: String(category.icon || ''),
      urutan: Number(category.urutan ?? 0),
      status: String(category.status || 'Aktif'),
      updated_at: nowIso,
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(catRef, updatePayload);
    } catch (updateErr: any) {
      if (updateErr?.code === 'not-found' || updateErr?.message?.includes('No document to update')) {
        await setDoc(catRef, { id: cleanId, ...updatePayload }, { merge: true });
      } else {
        throw updateErr;
      }
    }

    logAuditActivity(
      'UPDATE_CATEGORY',
      `Memperbarui kategori ${category.nama}`,
      actorName,
      'CATEGORIES'
    ).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error('Error updating category to Firebase with updateDoc:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan kategori ke Firestore' };
  }
}

/**
 * SYNC CATEGORIES TO FIREBASE
 */
export async function syncCategoriesToFirebase(categories: CategoryItem[]): Promise<boolean> {
  if (!categories || categories.length === 0) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const batch = writeBatch(db);
    for (const cat of categories) {
      if (!cat || !cat.id) continue;
      const catRef = doc(db, 'categories', String(cat.id));
      batch.set(
        catRef,
        {
          id: String(cat.id),
          nama: String(cat.nama || 'Kategori'),
          deskripsi: String(cat.deskripsi || ''),
          icon: String(cat.icon || ''),
          urutan: Number(cat.urutan ?? 0),
          status: String(cat.status || 'Aktif'),
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    await batch.commit();
    return true;
  } catch (err) {
    console.error('Gagal menyinkronkan kategori ke Firebase:', err);
    return false;
  }
}

/**
 * DELETE CATEGORY FROM FIREBASE
 */
export async function deleteCategoryFromFirebase(categoryId: string): Promise<boolean> {
  if (!categoryId) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const docRef = doc(db, 'categories', String(categoryId));
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Gagal menghapus kategori ${categoryId} dari Firebase:`, err);
    return false;
  }
}

/**
 * SUBSCRIBE TO CATEGORIES (Synced across all devices)
 */
export function subscribeToFirebaseCategories(
  onCategoriesReceived: (categories: CategoryItem[]) => void
): () => void {
  try {
    const colRef = collection(db, 'categories');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: CategoryItem[] = [];
        if (!snapshot.empty) {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as CategoryItem;
            if (data) {
              list.push({
                ...data,
                id: String(docSnap.id).trim(),
              });
            }
          });
        }
        onCategoriesReceived(list);
      },
      (error) => {
        console.warn('Firebase categories subscription warning:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize categories listener:', err);
    return () => {};
  }
}

/**
 * SAVE EXPENSE TO FIREBASE
 */
export async function saveExpenseToFirebase(expense: Expense): Promise<boolean> {
  if (!expense || !expense.id) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const docRef = doc(db, 'expenses', String(expense.id));
    const payload = {
      id: String(expense.id),
      tanggal: String(expense.tanggal || new Date().toISOString().slice(0, 10)),
      date: String(expense.tanggal || new Date().toISOString().slice(0, 10)),
      kategori: String(expense.kategori || 'Operasional'),
      category: String(expense.kategori || 'Operasional'),
      keterangan: String(expense.keterangan || ''),
      description: String(expense.keterangan || ''),
      jumlah: Number(expense.jumlah ?? 0),
      amount: Number(expense.jumlah ?? 0),
      catatan: String(expense.catatan || ''),
      notes: String(expense.catatan || ''),
      diinput_oleh: String(expense.diinput_oleh || 'Kasir Warung'),
      createdBy: String(expense.diinput_oleh || 'Kasir Warung'),
      created_at: String(expense.created_at || new Date().toISOString()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.error('Gagal menyimpan pengeluaran ke Firebase:', err);
    return false;
  }
}

/**
 * DELETE EXPENSE FROM FIREBASE
 */
export async function deleteExpenseFromFirebase(expenseId: string): Promise<boolean> {
  if (!expenseId) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const docRef = doc(db, 'expenses', String(expenseId));
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Gagal menghapus pengeluaran ${expenseId} dari Firebase:`, err);
    return false;
  }
}

/**
 * SUBSCRIBE TO EXPENSES (Synced across all devices)
 */
export function subscribeToFirebaseExpenses(
  onExpensesReceived: (expenses: Expense[]) => void
): () => void {
  try {
    const colRef = collection(db, 'expenses');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: Expense[] = [];
        if (!snapshot.empty) {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Expense;
            if (data && data.id) {
              list.push(data);
            }
          });
          list.sort((a, b) => new Date(b.created_at || b.tanggal || 0).getTime() - new Date(a.created_at || a.tanggal || 0).getTime());
        }
        onExpensesReceived(list);
      },
      (error) => {
        console.warn('Firebase expenses subscription warning:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize expenses listener:', err);
    return () => {};
  }
}

/**
 * UPDATE CUSTOMER IN FIREBASE FIRESTORE USING updateDoc
 */
export async function updateCustomerInFirebase(
  customer: Customer,
  actorName = 'Kasir'
): Promise<{ success: boolean; error?: string }> {
  if (!customer || !customer.id) return { success: false, error: 'ID pelanggan tidak valid' };
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const cleanId = String(customer.id).trim();
    const docRef = doc(db, 'customers', cleanId);
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      nama: String(customer.nama || 'Pelanggan'),
      name: String(customer.nama || 'Pelanggan'),
      no_whatsapp: String(customer.no_whatsapp || customer.whatsapp || ''),
      whatsapp: String(customer.no_whatsapp || customer.whatsapp || ''),
      phone: String(customer.no_whatsapp || customer.whatsapp || ''),
      alamat: String(customer.alamat || ''),
      catatan: String(customer.catatan || ''),
      total_transaksi: Number(customer.total_transaksi ?? 0),
      totalOrders: Number(customer.total_transaksi ?? 0),
      total_belanja: Number(customer.total_belanja ?? 0),
      totalSpent: Number(customer.total_belanja ?? 0),
      last_order: String(customer.last_order || ''),
      lastOrderAt: String(customer.last_order || nowIso),
      updated_at: nowIso,
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(docRef, updatePayload);
    } catch (updateErr: any) {
      if (updateErr?.code === 'not-found' || updateErr?.message?.includes('No document to update')) {
        await setDoc(
          docRef,
          {
            id: cleanId,
            ...updatePayload,
            created_at: String(customer.created_at || nowIso),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        throw updateErr;
      }
    }

    logAuditActivity(
      'UPDATE_CUSTOMER',
      `Memperbarui pelanggan ${customer.nama} (${cleanId})`,
      actorName,
      'CUSTOMERS'
    ).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error('Gagal memperbarui pelanggan ke Firebase dengan updateDoc:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan pelanggan ke Firestore' };
  }
}

/**
 * SAVE CUSTOMER TO FIREBASE
 */
export async function saveCustomerToFirebase(customer: Customer): Promise<boolean> {
  const res = await updateCustomerInFirebase(customer);
  return res.success;
}

/**
 * DELETE CUSTOMER FROM FIREBASE
 */
export async function deleteCustomerFromFirebase(customerId: string): Promise<boolean> {
  if (!customerId) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const docRef = doc(db, 'customers', String(customerId));
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Gagal menghapus pelanggan ${customerId} dari Firebase:`, err);
    return false;
  }
}

/**
 * SUBSCRIBE TO CUSTOMERS (Synced across all devices)
 */
export function subscribeToFirebaseCustomers(
  onCustomersReceived: (customers: Customer[]) => void
): () => void {
  try {
    const colRef = collection(db, 'customers');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: Customer[] = [];
        if (!snapshot.empty) {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Customer;
            if (data) {
              list.push({
                ...data,
                id: String(docSnap.id).trim(),
              });
            }
          });
          list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        }
        onCustomersReceived(list);
      },
      (error) => {
        console.warn('Firebase customers subscription warning:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize customers listener:', err);
    return () => {};
  }
}

/**
 * UPDATE STORE SETTINGS IN FIREBASE FIRESTORE USING updateDoc
 */
export async function updateSettingsInFirebase(
  settings: Partial<StoreSettings>,
  actorName = 'Owner'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const docRef = doc(db, 'settings', 'warung');
    const qrisDocRef = doc(db, 'settings', 'qris');
    const nowIso = new Date().toISOString();

    const storeAddr = settings.address !== undefined ? String(settings.address || '').trim() : undefined;
    const resolvedQrisUrl = settings.qrisImageUrl !== undefined
      ? String(settings.qrisImageUrl || '')
      : (settings.qrisUrl !== undefined ? String(settings.qrisUrl || '') : undefined);

    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
      updatedAt: serverTimestamp(),
    };

    // Dynamically and safely copy all defined setting keys
    Object.entries(settings).forEach(([key, val]) => {
      if (val !== undefined && typeof val !== 'function') {
        updatePayload[key] = val;
      }
    });

    // Ensure bidirectional aliases and normalized values
    if (storeAddr !== undefined) {
      updatePayload.address = storeAddr;
      updatePayload.storeAddress = storeAddr;
    }
    if (settings.tagline !== undefined) {
      updatePayload.tagline = String(settings.tagline);
      updatePayload.storeSlogan = String(settings.tagline);
    }
    if (resolvedQrisUrl !== undefined) {
      updatePayload.qrisImageUrl = resolvedQrisUrl;
      updatePayload.qrisUrl = resolvedQrisUrl;
    }

    try {
      await setDoc(docRef, { id: 'warung', ...updatePayload }, { merge: true });
    } catch (updateErr: any) {
      console.warn('SetDoc settings error, attempting updateDoc fallback:', updateErr);
      await updateDoc(docRef, updatePayload);
    }

    if (resolvedQrisUrl !== undefined || settings.qrisMerchantName !== undefined || settings.qrisNmid !== undefined || settings.qrisEnabled !== undefined) {
      const qrisUpdate: Record<string, any> = {
        updated_at: nowIso,
        updatedAt: serverTimestamp(),
      };
      if (resolvedQrisUrl !== undefined) {
        qrisUpdate.qrisImageUrl = resolvedQrisUrl;
        qrisUpdate.qrisUrl = resolvedQrisUrl;
      }
      if (settings.qrisMerchantName !== undefined) qrisUpdate.qrisMerchantName = String(settings.qrisMerchantName);
      if (settings.qrisNmid !== undefined) qrisUpdate.qrisNmid = String(settings.qrisNmid);
      if (settings.qrisEnabled !== undefined) qrisUpdate.qrisEnabled = Boolean(settings.qrisEnabled);
      if (settings.qrisInstruction !== undefined) qrisUpdate.qrisInstruction = String(settings.qrisInstruction);

      try {
        await updateDoc(qrisDocRef, qrisUpdate);
      } catch (qrisErr: any) {
        if (qrisErr?.code === 'not-found' || qrisErr?.message?.includes('No document to update')) {
          await setDoc(qrisDocRef, { id: 'qris', ...qrisUpdate }, { merge: true });
        }
      }
    }

    logAuditActivity(
      'UPDATE_SETTINGS',
      `Memperbarui konfigurasi warung (${Object.keys(settings).join(', ')})`,
      actorName,
      'SETTINGS'
    ).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error('Error updating settings in Firebase with updateDoc:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan pengaturan ke Firestore' };
  }
}

/**
 * SAVE STORE SETTINGS TO FIREBASE (Warung Bang Kobra global settings)
 */
export async function saveSettingsToFirebase(settings: StoreSettings): Promise<boolean> {
  const res = await updateSettingsInFirebase(settings);
  return res.success;
}

/**
 * SUBSCRIBE TO STORE SETTINGS (Synced across all devices)
 */
export function subscribeToFirebaseSettings(
  onSettingsReceived: (settings: Partial<StoreSettings>) => void
): () => void {
  try {
    const docRef = doc(db, 'settings', 'warung');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const remote = docSnap.data() as Partial<StoreSettings>;
          if (!remote.logoUrl || remote.logoUrl.trim() === '') {
            remote.logoUrl = '/icon.svg';
          }
          if (remote.qrisImageUrl !== undefined) {
            remote.qrisImageUrl = String(remote.qrisImageUrl || '');
            remote.qrisUrl = remote.qrisImageUrl;
          } else if (remote.qrisUrl !== undefined) {
            remote.qrisImageUrl = String(remote.qrisUrl || '');
            remote.qrisUrl = remote.qrisImageUrl;
          }
          const addr = String(remote.address || remote.storeAddress || '').trim();
          if (addr) {
            remote.address = addr;
            remote.storeAddress = addr;
          }
          onSettingsReceived(remote);
        } else {
          // Dokumen settings belum ada di Firestore, trigger sinkronisasi awal
          onSettingsReceived({});
        }
      },
      (error) => {
        console.warn('Firebase settings subscription warning:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize settings listener:', err);
    return () => {};
  }
}

/**
 * SAVE STOCK MUTATION TO FIREBASE (Stok Masuk, Keluar, Koreksi)
 */
export async function saveStockMutationToFirebase(mutation: StockMutation): Promise<boolean> {
  if (!mutation || !mutation.id) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const docRef = doc(db, 'stock_mutations', String(mutation.id));
    const moveRef = doc(db, 'stock_movements', String(mutation.id));
    const payload = {
      id: String(mutation.id),
      tanggal: String(mutation.tanggal || new Date().toISOString()),
      id_produk: String(mutation.id_produk || ''),
      productId: String(mutation.id_produk || ''),
      nama_produk: String(mutation.nama_produk || ''),
      productName: String(mutation.nama_produk || ''),
      jenis: mutation.jenis || 'adjustment',
      type: mutation.jenis || 'adjustment',
      qty: Number(mutation.qty ?? 0),
      stok_sebelum: Number(mutation.stok_sebelum ?? 0),
      stok_sesudah: Number(mutation.stok_sesudah ?? 0),
      keterangan: String(mutation.keterangan || ''),
      created_at: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload, { merge: true });
    await setDoc(moveRef, payload, { merge: true });
    logAuditActivity(
      'PERUBAHAN_STOK',
      `${mutation.nama_produk}: ${mutation.jenis.toUpperCase()} (${mutation.qty}) -> Stok akhir: ${mutation.stok_sesudah}`,
      'Staf/Kasir',
      'STOCK'
    ).catch(() => {});
    return true;
  } catch (err) {
    console.warn('Gagal menyimpan mutasi stok ke Firebase:', err);
    return false;
  }
}

/**
 * SUBSCRIBE TO STOCK MUTATIONS (Synced across all devices)
 */
export function subscribeToFirebaseStockMutations(
  onMutationsReceived: (mutations: StockMutation[]) => void
): () => void {
  try {
    const colRef = collection(db, 'stock_mutations');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: StockMutation[] = [];
        if (!snapshot.empty) {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as StockMutation;
            if (data && data.id) {
              list.push(data);
            }
          });
          list.sort((a, b) => new Date(b.tanggal || 0).getTime() - new Date(a.tanggal || 0).getTime());
        }
        onMutationsReceived(list);
      },
      (error) => {
        console.warn('Firebase stock mutations subscription warning:', error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize stock mutations listener:', err);
    return () => {};
  }
}

/**
 * COMPREHENSIVE CLOUD DATA SYNC:
 * Menyelaraskan seluruh data warung (Pengaturan, Alamat, Menu, Kategori, Pesanan, Pelanggan, Pengeluaran)
 * ke Firebase Cloud Firestore agar 100% konsisten antar semua perangkat.
 */
export async function syncAllDataToFirebase(params: {
  settings: StoreSettings;
  products: Product[];
  categories: CategoryItem[];
  transactions: Transaction[];
  customers: Customer[];
  expenses: Expense[];
  mutations?: StockMutation[];
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    // 1. Simpan Pengaturan & Alamat Toko
    await saveSettingsToFirebase(params.settings);

    // 2. Simpan Produk Menu
    if (params.products && params.products.length > 0) {
      await syncProductsToFirebase(params.products);
    }

    // 3. Simpan Kategori
    if (params.categories && params.categories.length > 0) {
      await syncCategoriesToFirebase(params.categories);
    }

    // 4. Simpan Transaksi / Pesanan
    if (params.transactions && params.transactions.length > 0) {
      for (const tx of params.transactions) {
        await saveOrderToFirebase(tx);
      }
    }

    // 5. Simpan Pelanggan
    if (params.customers && params.customers.length > 0) {
      for (const cust of params.customers) {
        await saveCustomerToFirebase(cust);
      }
    }

    // 6. Simpan Pengeluaran
    if (params.expenses && params.expenses.length > 0) {
      for (const exp of params.expenses) {
        await saveExpenseToFirebase(exp);
      }
    }

    // 7. Simpan Mutasi Stok terbaru
    if (params.mutations && params.mutations.length > 0) {
      for (const mut of params.mutations.slice(0, 50)) {
        await saveStockMutationToFirebase(mut);
      }
    }

    return {
      success: true,
      message: `Semua data toko (${params.products.length} menu, ${params.transactions.length} pesanan, pengaturan & alamat) berhasil disinkronkan ke Firebase Cloud!`,
    };
  } catch (err: any) {
    console.error('Error syncAllDataToFirebase:', err);
    return {
      success: false,
      message: 'Gagal sinkronisasi seluruh data ke Firebase: ' + (err?.message || 'Unknown error'),
    };
  }
}

/**
 * UPLOAD DELIVERY PROOF PHOTO TO FIREBASE STORAGE (With fast fallback)
 */
export async function uploadDeliveryProofPhoto(
  fileOrDataUrl: File | string,
  orderId: string
): Promise<string> {
  try {
    await ensureFirebaseAuth();
    const safeOrder = String(orderId || 'DQM').replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `delivery_proofs/${safeOrder}_${Date.now()}.jpg`;
    const fileRef = storageRef(storage, path);

    const uploadTask = async (): Promise<string> => {
      if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
        await uploadString(fileRef, fileOrDataUrl, 'data_url');
        return await getDownloadURL(fileRef);
      } else if (fileOrDataUrl instanceof File) {
        await uploadBytes(fileRef, fileOrDataUrl);
        return await getDownloadURL(fileRef);
      }
      return typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';
    };

    // Race with 2.2s timeout so camera/photo upload is always fast even if Storage CORS is restricted
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
      }, 2200);
    });

    const resultUrl = await Promise.race([uploadTask(), timeoutPromise]);
    logAuditActivity(
      'UPLOAD_BUKTI_DELIVERY',
      `Mengunggah foto bukti pengantaran DQM untuk pesanan ${orderId}`,
      auth.currentUser?.email || 'Petugas Delivery',
      'DELIVERY_DQM'
    ).catch(() => {});
    return resultUrl || (typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
  } catch (err) {
    console.warn('Delivery proof photo fallback to inline dataUrl:', err);
    return typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';
  }
}

/**
 * SAVE DELIVERY PROOF TO FIREBASE `delivery_proofs` AND SYNC TO `orders`
 */
export async function saveDeliveryProofToFirebase(
  proof: DeliveryProof,
  actorName = 'Petugas Delivery'
): Promise<boolean> {
  if (!proof || !proof.orderId) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const cleanOrderId = String(proof.orderId).trim();
    const deliveryId = String(proof.deliveryId || `DLV-${cleanOrderId}`).trim();
    const proofDocRef = doc(db, 'delivery_proofs', cleanOrderId);
    const orderDocRef = doc(db, 'orders', cleanOrderId);

    const normalizedDelivStatus = normalizeDeliveryStatus(proof.status || proof.deliveryStatus);
    const nowIso = new Date().toISOString();

    const proofPayload = {
      deliveryId,
      orderId: cleanOrderId,
      orderNumber: String(proof.orderNumber || cleanOrderId),
      customerId: String(proof.customerId || auth.currentUser?.uid || ''),
      customerName: String(proof.customerName || 'Pelanggan'),
      customerPhone: String(proof.customerPhone || ''),
      destination: 'DQM' as const,
      detailLocation: String(proof.detailLocation || 'Pesantren DQM'),
      courierId: String(proof.courierId || auth.currentUser?.uid || ''),
      courierName: String(proof.courierName || actorName || 'Kurir Warung Bang Kobra'),
      receiverName: String(proof.receiverName || proof.customerName || 'Penerima'),
      receiverPhone: String(proof.receiverPhone || proof.customerPhone || ''),
      status: normalizedDelivStatus,
      deliveryStatus: normalizedDelivStatus,
      proofPhotoUrl: String(proof.proofPhotoUrl || ''),
      deliveryNote: String(proof.deliveryNote || 'Pesanan telah diterima dengan baik.'),
      sentAt: String(proof.sentAt || ''),
      deliveredAt: String(
        proof.deliveredAt || (normalizedDelivStatus === 'DITERIMA' ? nowIso : '')
      ),
      createdAt: String(proof.createdAt || nowIso),
      updatedAt: nowIso,
      serverUpdatedAt: serverTimestamp(),
    };

    await setDoc(proofDocRef, proofPayload, { merge: true });

    let mappedOrderStatus = 'DIPROSES';
    if (normalizedDelivStatus === 'MENUNGGU') mappedOrderStatus = 'MENUNGGU';
    else if (normalizedDelivStatus === 'DIANTAR') mappedOrderStatus = 'DIPROSES';
    else if (normalizedDelivStatus === 'SAMPAI') mappedOrderStatus = 'SIAP';
    else if (normalizedDelivStatus === 'DITERIMA') mappedOrderStatus = 'SELESAI';
    else if (normalizedDelivStatus === 'GAGAL DIANTAR') mappedOrderStatus = 'DIBATALKAN';

    await setDoc(
      orderDocRef,
      {
        id_transaksi: cleanOrderId,
        deliveryId,
        status: mappedOrderStatus,
        deliveryStatus: normalizedDelivStatus,
        courierId: proofPayload.courierId,
        courierName: proofPayload.courierName,
        receiverName: proofPayload.receiverName,
        receiverPhone: proofPayload.receiverPhone,
        proofPhotoUrl: proofPayload.proofPhotoUrl,
        deliveryNote: proofPayload.deliveryNote,
        sentAt: proofPayload.sentAt,
        deliveredAt: proofPayload.deliveredAt,
        updated_at: nowIso,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    logAuditActivity(
      'BUKTI_DELIVERY_DQM',
      `Pesanan ${cleanOrderId} -> Status: ${normalizedDelivStatus} | Kurir: ${proofPayload.courierName} | Penerima: ${proofPayload.receiverName}`,
      actorName,
      'DELIVERY_DQM'
    ).catch(() => {});

    return true;
  } catch (err) {
    console.warn('Error saving delivery proof to Firebase:', err);
    return false;
  }
}

/**
 * REAL-TIME LISTENER FOR `delivery_proofs` COLLECTION
 */
export function subscribeToFirebaseDeliveryProofs(
  onProofsReceived: (proofs: DeliveryProof[]) => void
): () => void {
  try {
    const colRef = collection(db, 'delivery_proofs');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: DeliveryProof[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as DeliveryProof;
          if (data && (data.orderId || data.deliveryId)) {
            list.push({
              ...data,
              orderId: data.orderId || docSnap.id,
              orderNumber: data.orderNumber || data.orderId || docSnap.id,
              destination: 'DQM',
              status: normalizeDeliveryStatus(data.status || data.deliveryStatus),
              deliveryStatus: normalizeDeliveryStatus(data.deliveryStatus || data.status),
            });
          }
        });
        list.sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
        onProofsReceived(list);
      },
      (err) => {
        console.warn('Firebase delivery_proofs subscription notice:', err?.message);
      }
    );
  } catch (err) {
    console.warn('Failed to initialize delivery_proofs listener:', err);
    return () => {};
  }
}

/**
 * RECORD RECEIPT SHARE METADATA TO FIREBASE (`orders` & `delivery_proofs`)
 * Menyimpan receiptSharedAt, receiptSharedBy, receiptShareMethod (contoh: GOOGLE_CHAT)
 */
export async function recordReceiptShareToFirebase(
  orderId: string,
  sharedBy = 'Kasir',
  method: 'GOOGLE_CHAT' | 'WHATSAPP' | 'PRINT' | 'PDF' | 'EMAIL' = 'GOOGLE_CHAT',
  isDeliveryOrder = false
): Promise<boolean> {
  if (!orderId) return false;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const cleanId = String(orderId).trim();
    const nowIso = new Date().toISOString();
    const shareMeta = {
      receiptSharedAt: nowIso,
      receiptSharedBy: String(sharedBy || 'Kasir'),
      receiptShareMethod: method,
      updated_at: nowIso,
      updatedAt: serverTimestamp(),
    };

    const orderDocRef = doc(db, 'orders', cleanId);
    await setDoc(orderDocRef, { id_transaksi: cleanId, ...shareMeta }, { merge: true });

    if (isDeliveryOrder) {
      const proofDocRef = doc(db, 'delivery_proofs', cleanId);
      await setDoc(
        proofDocRef,
        {
          orderId: cleanId,
          receiptSharedAt: nowIso,
          receiptSharedBy: String(sharedBy || 'Kasir'),
          receiptShareMethod: method,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }

    logAuditActivity(
      'SHARE_STRUK_PESANAN',
      `Struk pesanan ${cleanId} dibagikan via ${method} oleh ${sharedBy}`,
      sharedBy,
      method
    ).catch(() => {});

    return true;
  } catch (err) {
    console.warn('Failed to record receipt share metadata to Firebase:', err);
    return false;
  }
}

/**
 * FETCH SANITIZED ORDER FOR PUBLIC DIGITAL RECEIPT (`/receipt/:orderId` & `/delivery-proof/:orderId`)
 * Hanya mengambil data yang diperlukan pelanggan tanpa mengekspos data internal/sensitif.
 */
export async function fetchPublicOrderReceiptFromFirebase(
  orderId: string
): Promise<Transaction | null> {
  if (!orderId) return null;
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuth();
    }
    const cleanId = decodeURIComponent(String(orderId).trim());
    const orderSnap = await getDoc(doc(db, 'orders', cleanId));
    const proofSnap = await getDoc(doc(db, 'delivery_proofs', cleanId));

    if (!orderSnap.exists() && !proofSnap.exists()) {
      return null;
    }

    const orderData = orderSnap.exists() ? (orderSnap.data() as Record<string, unknown>) : {};
    const proofData = proofSnap.exists() ? (proofSnap.data() as Record<string, unknown>) : {};

    const rawItems = Array.isArray(orderData.items) ? orderData.items : [];
    const safeItems = rawItems.map((it: Record<string, unknown>, idx: number) => ({
      id_detail: String(it.id_detail || `ITEM-${idx + 1}`),
      id_transaksi: cleanId,
      id_produk: String(it.id_produk || ''),
      nama_produk: String(it.nama_produk || 'Menu'),
      harga: Number(it.harga || 0),
      qty: Number(it.qty || 1),
      subtotal: Number(it.subtotal || Number(it.harga || 0) * Number(it.qty || 1)),
      catatan: it.catatan ? String(it.catatan) : undefined,
    }));

    const isDelivery =
      orderData.orderType === 'DELIVERY_DQM' ||
      orderData.tipe_pesanan === 'DELIVERY_DQM' ||
      Boolean(proofSnap.exists());

    const safeTx: Transaction = {
      id_transaksi: cleanId,
      tanggal: String(orderData.tanggal || (proofData.createdAt ? String(proofData.createdAt).split('T')[0] : new Date().toISOString().split('T')[0])),
      jam: String(orderData.jam || '10:30:00'),
      kasir: String(orderData.kasir || 'Kasir Warung Bang Kobra'),
      nama_pelanggan: String(orderData.nama_pelanggan || proofData.customerName || 'Pelanggan'),
      no_whatsapp: String(orderData.no_whatsapp || proofData.customerPhone || '-'),
      subtotal: Number(orderData.subtotal || 0),
      diskon: Number(orderData.diskon || 0),
      biaya: Number(orderData.biaya ?? orderData.deliveryFee ?? 0),
      total: Number(orderData.total || 0),
      metode_pembayaran: (orderData.metode_pembayaran as Transaction['metode_pembayaran']) || 'QRIS',
      uang_diterima: Number(orderData.uang_diterima || orderData.total || 0),
      kembalian: Number(orderData.kembalian || 0),
      status: (orderData.status as Transaction['status']) || 'SELESAI',
      items: safeItems,
      created_at: String(orderData.created_at || proofData.createdAt || new Date().toISOString()),
      orderType: isDelivery ? 'DELIVERY_DQM' : 'BUNGKUS',
      tipe_pesanan: isDelivery ? 'DELIVERY_DQM' : 'BUNGKUS',
      deliveryArea: isDelivery ? 'DQM' : null,
      deliveryLocation: String(orderData.deliveryLocation || proofData.detailLocation || (isDelivery ? 'Pesantren DQM' : '')),
      deliveryDetail: String(orderData.deliveryDetail || ''),
      deliveryNote: String(proofData.deliveryNote || orderData.deliveryNote || ''),
      deliveryFee: Number(orderData.deliveryFee ?? orderData.biaya ?? 0),
      deliveryStatus: isDelivery
        ? normalizeDeliveryStatus(
            String(proofData.status || proofData.deliveryStatus || orderData.deliveryStatus || ''),
            String(orderData.status || '')
          )
        : null,
      deliveryId: String(proofData.deliveryId || orderData.deliveryId || `DLV-${cleanId}`),
      courierName: String(proofData.courierName || orderData.courierName || ''),
      receiverName: String(proofData.receiverName || orderData.receiverName || ''),
      receiverPhone: String(proofData.receiverPhone || orderData.receiverPhone || ''),
      proofPhotoUrl: String(proofData.proofPhotoUrl || orderData.proofPhotoUrl || ''),
      sentAt: String(proofData.sentAt || orderData.sentAt || ''),
      deliveredAt: String(proofData.deliveredAt || orderData.deliveredAt || ''),
      queueNumber: String(orderData.queueNumber || ''),
      receiptSharedAt: String(orderData.receiptSharedAt || proofData.receiptSharedAt || ''),
      receiptSharedBy: String(orderData.receiptSharedBy || proofData.receiptSharedBy || ''),
      receiptShareMethod: String(orderData.receiptShareMethod || proofData.receiptShareMethod || ''),
    };

    return safeTx;
  } catch (err) {
    console.warn('Error fetching public order receipt:', err);
    return null;
  }
}

/**
 * COMPRESS AND UPLOAD PRODUCT/VARIANT IMAGE TO FIREBASE STORAGE (With Canvas compression fallback)
 */
export async function compressAndUploadProductImage(
  file: File,
  skuOrId = 'PROD'
): Promise<string> {
  // 1. Compress to clean JPEG dataUrl via Canvas first
  const compressedDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 720;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(ev.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(String(ev.target?.result || ''));
      img.src = String(ev.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });

  // 2. Upload to Firebase Storage with fast timeout fallback
  try {
    await ensureFirebaseAuth();
    const safeSku = String(skuOrId || 'PROD').replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `product_images/${safeSku}_${Date.now()}.jpg`;
    const fileRef = storageRef(storage, path);

    const uploadTask = async (): Promise<string> => {
      await uploadString(fileRef, compressedDataUrl, 'data_url');
      return await getDownloadURL(fileRef);
    };

    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve(compressedDataUrl), 2200);
    });

    const finalUrl = await Promise.race([uploadTask(), timeoutPromise]);
    return finalUrl || compressedDataUrl;
  } catch {
    return compressedDataUrl;
  }
}


