export type GoogleChatConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export type GoogleChatSubTab =
  | 'dashboard'
  | 'connection'
  | 'spaces'
  | 'notifications'
  | 'templates'
  | 'logs'
  | 'settings';

export type GoogleChatNotificationType =
  | 'ORDER_NEW'
  | 'ORDER_WA'
  | 'ORDER_DELIVERY'
  | 'ORDER_TAKEAWAY'
  | 'ORDER_PO'
  | 'PAYMENT_SUCCESS'
  | 'ORDER_CANCELLED'
  | 'ORDER_COMPLETED'
  | 'STOCK_LOW'
  | 'STOCK_OUT'
  | 'EXPENSE_NEW'
  | 'DAILY_SUMMARY'
  | 'SYSTEM_ERROR'
  | 'SECURITY_ALERT';

export interface GoogleChatSpace {
  id: string;
  name: string;
  spaceId: string;
  webhookUrl: string; // Server masks this when sent to client e.g. "https://chat.googleapis.com/...****"
  isDefault: boolean;
  status: GoogleChatConnectionStatus;
  description?: string;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface GoogleChatNotificationConfig {
  type: GoogleChatNotificationType;
  enabled: boolean;
  spaceId: string;
  templateId?: string;
  title: string;
  description: string;
  category: 'orders' | 'inventory' | 'finance' | 'system';
}

export interface GoogleChatTemplate {
  id: string;
  name: string;
  type: GoogleChatNotificationType;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type GoogleChatLogStatus = 'SENT' | 'FAILED' | 'PENDING';

export interface GoogleChatLog {
  id: string;
  eventId: string; // Idempotency key e.g. "WBK-20261008-0001_ORDER_NEW"
  timestamp: string;
  notificationType: GoogleChatNotificationType;
  referenceId?: string; // Order Number / PO Number / Product ID
  orderNumber?: string;
  spaceId: string;
  spaceName?: string;
  status: GoogleChatLogStatus;
  messageText: string;
  contentSnippet?: string;
  response?: string;
  error?: string;
  errorMessage?: string;
  retryCount: number;
  lastAttempt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface GoogleChatSettings {
  id?: string;
  connectionStatus?: GoogleChatConnectionStatus;
  defaultSpaceId?: string;
  dailySummaryEnabled?: boolean;
  dailySummaryTime?: string; // e.g. "22:00"
  lastDailySummarySentDate?: string;
  lowStockThreshold?: number;
  minDeliveryAmount?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  notifications?: Record<string, GoogleChatNotificationConfig>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface SendGoogleChatPayload {
  eventId: string;
  notificationType: GoogleChatNotificationType;
  spaceId?: string;
  referenceId?: string;
  title?: string;
  templateVariables?: Record<string, string | number>;
  customText?: string;
  actionUrl?: string;
}
