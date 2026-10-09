import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Activity,
  Link2,
  Layers,
  Bell,
  FileText,
  History,
  Settings,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { GoogleChatSubTab } from '../../types/googleChat';
import {
  fetchGoogleChatConfig,
  getGoogleChatSpaces,
  getNotificationConfigs,
  getGoogleChatTemplates,
  getGoogleChatLogs,
  getGoogleChatSettings,
  subscribeGoogleChatLogs,
  DEFAULT_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  GoogleChatService,
} from '../../services/googleChatService';
import {
  GoogleChatSpace,
  GoogleChatNotificationConfig,
  GoogleChatNotificationType,
  GoogleChatTemplate,
  GoogleChatLog,
  GoogleChatSettings,
} from '../../types/googleChat';
import { GoogleChatDashboardTab } from './GoogleChatDashboardTab';
import { GoogleChatConnectionTab } from './GoogleChatConnectionTab';
import { GoogleChatSpacesTab } from './GoogleChatSpacesTab';
import { GoogleChatNotificationsTab } from './GoogleChatNotificationsTab';
import { GoogleChatTemplatesTab } from './GoogleChatTemplatesTab';
import { GoogleChatLogsTab } from './GoogleChatLogsTab';
import { GoogleChatSettingsTab } from './GoogleChatSettingsTab';

interface Props {
  initialSubTab?: GoogleChatSubTab;
  currentUser?: any;
  settings?: any;
  transactions?: any[];
  products?: any[];
  expenses?: any[];
  onBackToDashboard?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const GoogleChatView: React.FC<Props> = ({
  initialSubTab = 'dashboard',
  currentUser,
  settings: appSettings,
  transactions = [],
  products = [],
  expenses = [],
  onBackToDashboard,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<GoogleChatSubTab>(initialSubTab);
  const [spaces, setSpaces] = useState<GoogleChatSpace[]>([]);
  const [notifications, setNotifications] = useState<GoogleChatNotificationConfig[]>([]);
  const [templates, setTemplates] = useState<GoogleChatTemplate[]>([]);
  const [logs, setLogs] = useState<GoogleChatLog[]>([]);
  const [settings, setSettings] = useState<GoogleChatSettings>({
    dailySummaryTime: '22:00',
    lowStockThreshold: 5,
    minDeliveryAmount: 20000,
    quietHoursEnabled: false,
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load all Google Chat data
  const loadData = useCallback(async () => {
    try {
      const [cfg, sps, notifs, tpls, lgs, stgs] = await Promise.all([
        fetchGoogleChatConfig(),
        getGoogleChatSpaces(),
        getNotificationConfigs(),
        getGoogleChatTemplates(),
        getGoogleChatLogs(),
        getGoogleChatSettings(),
      ]);

      // Merge spaces from server config if any
      const combinedSpaces = [...sps];
      if (cfg?.spaces && cfg.spaces.length > 0) {
        cfg.spaces.forEach((srvSpace: any) => {
          if (!combinedSpaces.some((s) => s.id === srvSpace.id)) {
            combinedSpaces.push(srvSpace);
          }
        });
      }

      setSpaces(combinedSpaces);
      setNotifications(notifs);
      setTemplates(tpls);
      setLogs(lgs);
      setSettings(stgs);
    } catch (err) {
      console.error('Failed to load Google Chat data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to realtime logs
    const unsubscribe = subscribeGoogleChatLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const configsMap: Record<GoogleChatNotificationType, GoogleChatNotificationConfig> = useMemo(() => {
    const map: any = {};
    DEFAULT_NOTIFICATION_TYPES.forEach((type) => {
      const existing = notifications.find((n) => n.type === type);
      const meta = NOTIFICATION_TYPE_LABELS[type] || { title: type, desc: '', category: 'system' };
      map[type] = existing || {
        type,
        enabled: true,
        spaceId: 'default',
        title: meta.title,
        description: meta.desc,
        category: meta.category,
      };
    });
    return map;
  }, [notifications]);

  const handleSaveConfigs = async (newConfigs: Record<GoogleChatNotificationType, GoogleChatNotificationConfig>) => {
    for (const cfg of Object.values(newConfigs)) {
      await GoogleChatService.saveNotificationConfig(cfg);
    }
    showToast?.('Konfigurasi notifikasi berhasil disimpan!', 'success');
    loadData();
  };

  const navItems: { id: GoogleChatSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'connection', label: 'Koneksi', icon: Link2 },
    { id: 'spaces', label: 'Ruang / Space', icon: Layers },
    { id: 'notifications', label: 'Notifikasi Otomatis', icon: Bell },
    { id: 'templates', label: 'Template Pesan', icon: FileText },
    { id: 'logs', label: 'Riwayat Pesan', icon: History },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  const isConnected = spaces.some((s) => s.status === 'CONNECTED');
  const defaultSpaceId = spaces.find((s) => s.isDefault)?.id || spaces[0]?.id || 'default';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-emerald-300 border border-white/10">
              <span className="text-base">📱</span>
              <span>Sistem Komunikasi Internal Otomatis</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Google Chat Warung Bang Kobra
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
              Integrasi cerdas pengiriman pesanan online, pesanan takeaway, pesanan santri delivery DQM, peringatan stok menipis, dan ringkasan omzet otomatis ke Google Chat Space.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold border backdrop-blur-md shadow-xs ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
              }`}
            >
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>TERHUBUNG ({spaces.filter((s) => s.status === 'CONNECTED').length} Space Aktif)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-300" />
                  <span>BELUM TERHUBUNG</span>
                </>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-semibold transition-colors border border-white/10 backdrop-blur-md disabled:opacity-50"
              title="Perbarui data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Submenu Navigation Tabs */}
        <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-md font-bold'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-white/70'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="transition-all duration-200">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
            <RefreshCw className="w-8 h-8 mx-auto text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              Memuat konfigurasi Google Chat Warung Bang Kobra...
            </p>
          </div>
        ) : (
          <>
            {activeSubTab === 'dashboard' && (
              <GoogleChatDashboardTab
                connectionStatus={isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                spaces={spaces}
                logs={logs}
                transactions={transactions}
                expenses={expenses}
                onNavigateTab={(tab) => setActiveSubTab(tab as GoogleChatSubTab)}
                showToast={showToast || ((m) => alert(m))}
                onRefresh={handleRefresh}
              />
            )}

            {activeSubTab === 'connection' && (
              <GoogleChatConnectionTab
                connectionStatus={isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                spaces={spaces}
                defaultSpaceId={defaultSpaceId}
                onRefresh={handleRefresh}
                showToast={showToast || ((m) => alert(m))}
              />
            )}

            {activeSubTab === 'spaces' && (
              <GoogleChatSpacesTab
                spaces={spaces}
                defaultSpaceId={defaultSpaceId}
                onRefresh={handleRefresh}
                showToast={showToast || ((m) => alert(m))}
              />
            )}

            {activeSubTab === 'notifications' && (
              <GoogleChatNotificationsTab
                spaces={spaces}
                templates={templates}
                configs={configsMap}
                onSaveConfigs={handleSaveConfigs}
                showToast={showToast || ((m) => alert(m))}
              />
            )}

            {activeSubTab === 'templates' && (
              <GoogleChatTemplatesTab templates={templates} onReload={loadData} />
            )}

            {activeSubTab === 'logs' && (
              <GoogleChatLogsTab logs={logs} onReload={loadData} />
            )}

            {activeSubTab === 'settings' && (
              <GoogleChatSettingsTab settings={settings} onReload={loadData} />
            )}
          </>
        )}
      </div>
    </div>
  );
};
