import React, { useState } from 'react';
import {
  Bell,
  Check,
  Layers,
  FileText,
  Save,
  Filter,
} from 'lucide-react';
import {
  GoogleChatSpace,
  GoogleChatNotificationConfig,
  GoogleChatNotificationType,
  GoogleChatTemplate,
} from '../../types/googleChat';
import {
  DEFAULT_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
} from '../../services/googleChatService';

interface GoogleChatNotificationsTabProps {
  spaces: GoogleChatSpace[];
  templates: GoogleChatTemplate[];
  configs: Record<GoogleChatNotificationType, GoogleChatNotificationConfig>;
  onSaveConfigs: (newConfigs: Record<GoogleChatNotificationType, GoogleChatNotificationConfig>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GoogleChatNotificationsTab: React.FC<GoogleChatNotificationsTabProps> = ({
  spaces,
  templates,
  configs,
  onSaveConfigs,
  showToast,
}) => {
  const [localConfigs, setLocalConfigs] = useState<Record<GoogleChatNotificationType, GoogleChatNotificationConfig>>(() => {
    // Fill defaults if any missing
    const initial: Record<string, GoogleChatNotificationConfig> = { ...configs };
    DEFAULT_NOTIFICATION_TYPES.forEach((type) => {
      if (!initial[type]) {
        const meta = NOTIFICATION_TYPE_LABELS[type];
        initial[type] = {
          type,
          enabled: true,
          spaceId: spaces[0]?.id || 'default',
          title: meta.title,
          description: meta.desc,
          category: meta.category,
        };
      }
    });
    return initial as Record<GoogleChatNotificationType, GoogleChatNotificationConfig>;
  });

  const [activeCategory, setActiveCategory] = useState<'all' | 'orders' | 'inventory' | 'finance' | 'system'>('all');
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (type: GoogleChatNotificationType) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled: !prev[type].enabled,
      },
    }));
  };

  const handleChangeSpace = (type: GoogleChatNotificationType, spaceId: string) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        spaceId,
      },
    }));
  };

  const handleChangeTemplate = (type: GoogleChatNotificationType, templateId: string) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        templateId,
      },
    }));
  };

  const handleSaveAll = () => {
    setIsSaving(true);
    try {
      onSaveConfigs(localConfigs);
      showToast('Konfigurasi notifikasi otomatis berhasil disimpan!', 'success');
    } catch {
      showToast('Gagal menyimpan konfigurasi', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAll = (enabled: boolean) => {
    const updated = { ...localConfigs };
    DEFAULT_NOTIFICATION_TYPES.forEach((type) => {
      if (updated[type]) {
        updated[type] = { ...updated[type], enabled };
      }
    });
    setLocalConfigs(updated);
    showToast(enabled ? 'Semua notifikasi diaktifkan' : 'Semua notifikasi dinonaktifkan', 'info');
  };

  const filteredTypes = DEFAULT_NOTIFICATION_TYPES.filter((type) => {
    if (activeCategory === 'all') return true;
    return NOTIFICATION_TYPE_LABELS[type].category === activeCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Info & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-black text-white">Notifikasi Otomatis ke Google Chat</h3>
          </div>
          <p className="text-xs text-stone-400">
            Pilih event operasional yang akan dikirim otomatis, tentukan Space tujuan, dan pilih template pesan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleToggleAll(true)}
            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs transition cursor-pointer"
          >
            Aktifkan Semua
          </button>
          <button
            type="button"
            onClick={() => handleToggleAll(false)}
            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 font-bold text-xs transition cursor-pointer"
          >
            Nonaktifkan Semua
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 shadow-md shadow-amber-950/40 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Filter className="w-3.5 h-3.5 text-stone-500 shrink-0" />
        {[
          { id: 'all', label: 'Semua Event (14)' },
          { id: 'orders', label: 'Pesanan & Delivery' },
          { id: 'inventory', label: 'Stok & Inventori' },
          { id: 'finance', label: 'Keuangan & Laporan' },
          { id: 'system', label: 'Sistem & Security' },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id as any)}
            className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border border-stone-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTypes.map((type) => {
          const meta = NOTIFICATION_TYPE_LABELS[type];
          const cfg = localConfigs[type] || {
            type,
            enabled: true,
            spaceId: spaces[0]?.id || 'default',
            title: meta.title,
            description: meta.desc,
            category: meta.category,
          };

          return (
            <div
              key={type}
              className={`rounded-2xl p-4 border transition-all ${
                cfg.enabled
                  ? 'bg-stone-900 border-stone-700/80 shadow-sm'
                  : 'bg-stone-900/40 border-stone-800/60 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl select-none">{meta.icon}</span>
                  <div>
                    <h4 className="font-extrabold text-white text-sm">{meta.title}</h4>
                    <p className="text-[11px] text-stone-400 line-clamp-1">{meta.desc}</p>
                  </div>
                </div>

                {/* Toggle ON/OFF */}
                <button
                  type="button"
                  onClick={() => handleToggle(type)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    cfg.enabled ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                  aria-label={`Toggle ${meta.title}`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-stone-950 transition-transform transform ${
                      cfg.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Sub-selectors: Space destination & Template */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-stone-800/80 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-stone-400 flex items-center gap-1 mb-1">
                    <Layers className="w-3 h-3 text-amber-400" />
                    <span>Space Tujuan:</span>
                  </label>
                  <select
                    value={cfg.spaceId || ''}
                    onChange={(e) => handleChangeSpace(type, e.target.value)}
                    disabled={!cfg.enabled}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  >
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                    {spaces.length === 0 && <option value="default">Default Space</option>}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-stone-400 flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3 text-amber-400" />
                    <span>Template Pesan:</span>
                  </label>
                  <select
                    value={cfg.templateId || ''}
                    onChange={(e) => handleChangeTemplate(type, e.target.value)}
                    disabled={!cfg.enabled}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  >
                    <option value="">Template Standar (Bawaan)</option>
                    {templates
                      .filter((t) => t.type === type)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
