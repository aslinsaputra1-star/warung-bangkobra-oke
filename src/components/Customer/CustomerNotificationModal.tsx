import React, { useState } from 'react';
import { X, Bell, CheckCircle2, Clock, Sparkles, Store, Check, Trash2, ArrowRight } from 'lucide-react';
import { Transaction } from '../../types';

export interface CustomerNotification {
  id: string;
  type: 'order' | 'promo' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
  orderId?: string;
}

interface CustomerNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: CustomerNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearNotifications?: () => void;
  onSelectOrder?: (orderId: string) => void;
  onNavigateToPromo?: () => void;
}

export const CustomerNotificationModal: React.FC<CustomerNotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotifications,
  onSelectOrder,
  onNavigateToPromo,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-[#E50914] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                  Pusat Notifikasi
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#E50914] text-white">
                    {unreadCount} Baru
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Pembaruan pesanan, promo, & kabar warung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar & Actions */}
        <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                activeFilter === 'unread'
                  ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-[#E50914] hover:text-[#A80710] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Tandai Semua Dibaca
            </button>
          )}
        </div>

        {/* List of notifications */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 space-y-2">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-300">
                <Bell className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-gray-700">Tidak Ada Notifikasi</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                {activeFilter === 'unread'
                  ? 'Semua notifikasi sudah Anda baca.'
                  : 'Belum ada notifikasi baru saat ini.'}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isOrder = item.type === 'order';
              const isPromo = item.type === 'promo';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!item.read) onMarkAsRead(item.id);
                    if (item.orderId && onSelectOrder) {
                      onSelectOrder(item.orderId);
                      onClose();
                    } else if (isPromo && onNavigateToPromo) {
                      onNavigateToPromo();
                      onClose();
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 relative ${
                    item.read
                      ? 'bg-white border-gray-100 hover:bg-gray-50'
                      : 'bg-red-50/50 border-red-200/70 hover:bg-red-50 shadow-2xs'
                  }`}
                >
                  {/* Icon indicator */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isOrder
                        ? 'bg-blue-100 text-blue-700'
                        : isPromo
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {isOrder ? (
                      <Clock className="w-4 h-4" />
                    ) : isPromo ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <Store className="w-4 h-4" />
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-black text-gray-900 truncate">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {item.time}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      {item.message}
                    </p>

                    {item.orderId && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E50914] mt-1.5 hover:underline">
                        Lihat Status Pesanan <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-[#E50914] absolute top-3.5 right-3" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
