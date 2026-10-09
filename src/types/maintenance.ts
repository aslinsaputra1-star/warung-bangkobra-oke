export type SystemHealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'CHECKING';

export type IssuePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IssueCategory =
  | 'CONNECTION'     // Masalah Koneksi Firebase / Jaringan
  | 'PERMISSION'     // Masalah Izin & Hak Akses
  | 'CONFIG'         // Konfigurasi Salah
  | 'DATA_INTEGRITY' // Data Tidak Valid / Inkonsisten
  | 'SYSTEM';        // Runtime & PWA

export interface MaintenanceIssue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  module: string;
  detectedAt: string;
  cause: string;
  recommendation: string;
  canAutoFix: boolean;
  autoFixActionId?: string;
  affectedItemsCount?: number;
  affectedDetails?: string[];
  status: 'OPEN' | 'FIXED' | 'IGNORED';
}

export type AutoFixActionType =
  | 'FIX_PRODUCT_CATEGORIES'
  | 'FIX_INVALID_PRICES'
  | 'REMOVE_DUPLICATE_TRANSACTIONS'
  | 'RECONCILE_STOCK'
  | 'FIX_TRANSACTION_TOTALS'
  | 'FIX_ORPHAN_VARIANTS'
  | 'REPAIR_STORE_SETTINGS'
  | 'SYNC_QR_QUEUES'
  | 'CLEAR_RESOLVED_LOGS';

export interface AutoFixAction {
  id: string;
  type: AutoFixActionType;
  title: string;
  description: string;
  impactDescription: string;
  requiresConfirmation: boolean;
  affectedCount: number;
}

export interface DatabaseBackupCounts {
  products: number;
  variants: number;
  categories: number;
  transactions: number;
  customers: number;
  expenses: number;
  settings: number;
  stockMutations: number;
}

export interface DatabaseBackup {
  id: string;
  filename: string;
  createdAt: string;
  createdBy: string;
  sizeBytes: number;
  checksum: string;
  verified: boolean;
  counts: DatabaseBackupCounts;
  notes?: string;
  dataPayload?: any; // Structured snapshot
}

export interface SystemErrorLog {
  id: string;
  timestamp: string;
  module: string;
  message: string;
  stackTrace?: string;
  priority: IssuePriority;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED';
  recommendation: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface MaintenanceSettings {
  scheduledCheckInterval: 'DAILY' | 'WEEKLY' | 'MANUAL';
  maintenanceMode: boolean;
  maintenanceMessage: string;
  notifySound: boolean;
  lastCheckTimestamp: string | null;
  lastBackupTimestamp: string | null;
  healthScore: number;
  healthStatus: SystemHealthStatus;
  version: string;
  environment: string;
}

export interface SystemHealthReport {
  score: number;
  status: SystemHealthStatus;
  checkedAt: string;
  firebaseOnline: boolean;
  firestoreAccessible: boolean;
  firestoreLatencyMs: number;
  authValid: boolean;
  totalErrors: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issues: MaintenanceIssue[];
  metrics: {
    totalProducts: number;
    problematicProducts: number;
    totalTransactions: number;
    problematicTransactions: number;
    totalCategories: number;
    outOfStockCount: number;
    unsyncedQROrders: number;
    backupAgeHours: number | null;
  };
}
