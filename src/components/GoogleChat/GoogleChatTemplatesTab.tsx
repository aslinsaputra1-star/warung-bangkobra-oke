import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Save,
  X,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { GoogleChatTemplate, GoogleChatNotificationType } from '../../types/googleChat';
import {
  AVAILABLE_TEMPLATE_VARIABLES,
  DEFAULT_TEMPLATES,
  interpolateTemplate,
  saveTemplate,
} from '../../services/googleChatService';

interface Props {
  templates: GoogleChatTemplate[];
  onReload: () => void;
}

export const GoogleChatTemplatesTab: React.FC<Props> = ({ templates, onReload }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<GoogleChatTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState<GoogleChatNotificationType>('ORDER_NEW');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  const startEdit = (tpl?: GoogleChatTemplate) => {
    if (tpl) {
      setSelectedTemplate(tpl);
      setEditName(tpl.name);
      setEditContent(tpl.content);
      setEditType(tpl.type);
    } else {
      setSelectedTemplate(null);
      setEditName('Template Kustom Baru');
      setEditContent(`🔔 PEMBERITAHUAN
WARUNG BANG KOBRA

Nomor: {{orderNumber}}
Pelanggan: {{customerName}}
Total: {{total}}
Waktu: {{createdAt}}`);
      setEditType('ORDER_NEW');
    }
    setIsEditing(true);
  };

  const handleCopyVar = (v: string) => {
    navigator.clipboard.writeText(v);
    setCopiedVar(v);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  const insertVariable = (v: string) => {
    setEditContent((prev) => prev + ' ' + v);
  };

  const handleSave = async () => {
    if (!editName.trim() || !editContent.trim()) return;
    setIsSaving(true);
    try {
      const tpl: GoogleChatTemplate = {
        id: selectedTemplate?.id || `tpl_${Date.now()}`,
        name: editName.trim(),
        type: editType,
        content: editContent.trim(),
        isDefault: selectedTemplate?.isDefault ?? false,
        createdAt: selectedTemplate?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: selectedTemplate?.createdBy || 'Owner',
        updatedBy: 'Owner',
      };
      await saveTemplate(tpl);
      setIsEditing(false);
      onReload();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTemplates = templates.filter(
    (t) => filterType === 'ALL' || t.type === filterType
  );

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Template Pesan Google Chat
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kustomisasi format pesan untuk setiap jenis kejadian di Warung Bang Kobra dengan variabel dinamis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startEdit()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Tambah Template Baru
          </button>
        </div>
      </div>

      {/* Filter by Type */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
        <span className="text-slate-500 font-medium">Filter Tipe:</span>
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            filterType === 'ALL'
              ? 'bg-slate-900 text-white font-medium'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Semua ({templates.length})
        </button>
        {['ORDER_NEW', 'ORDER_DELIVERY', 'ORDER_PO', 'STOCK_LOW', 'DAILY_SUMMARY'].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              filterType === t
                ? 'bg-indigo-600 text-white font-medium'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Template Editor Modal / Inline */}
      {isEditing && (
        <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              {selectedTemplate ? 'Edit Template Pesan' : 'Buat Template Baru'}
            </h3>
            <button
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Template
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Peruntukan Tipe
              </label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as GoogleChatNotificationType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
              >
                <option value="ORDER_NEW">Pesanan Online Baru</option>
                <option value="ORDER_WA">Pesanan WhatsApp</option>
                <option value="ORDER_DELIVERY">Pesanan Delivery</option>
                <option value="ORDER_TAKEAWAY">Pesanan Takeaway</option>
                <option value="ORDER_PO">PO / Acara Baru</option>
                <option value="PAYMENT_SUCCESS">Pembayaran Berhasil</option>
                <option value="ORDER_CANCELLED">Pesanan Dibatalkan</option>
                <option value="ORDER_COMPLETED">Pesanan Selesai</option>
                <option value="STOCK_LOW">Stok Menipis</option>
                <option value="STOCK_EMPTY">Produk Habis</option>
                <option value="EXPENSE_NEW">Pengeluaran Baru</option>
                <option value="DAILY_SUMMARY">Ringkasan Harian</option>
                <option value="SYSTEM_ERROR">Error Sistem</option>
                <option value="SECURITY_ALERT">Security Alert</option>
              </select>
            </div>
          </div>

          {/* Quick Insert Variables */}
          <div>
            <span className="text-[11px] font-semibold text-slate-700 block mb-2">
              Klik variabel untuk menyisipkan ke dalam pesan:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
              {AVAILABLE_TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded text-[11px] font-mono border border-slate-200 transition-colors"
                  title={v.desc}
                >
                  <span>{v.key}</span>
                  <span className="text-[9px] text-slate-400">({v.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor & Preview Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Isi Template (Format Teks Google Chat)
              </label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={10}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                placeholder="Tulis format pesan di sini..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Pratinjau Hasil di Google Chat</span>
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-normal">
                  Live Preview Data Contoh
                </span>
              </label>
              <div className="p-3 bg-slate-900 text-emerald-300 rounded-xl font-mono text-xs whitespace-pre-wrap h-[210px] overflow-y-auto border border-slate-800 shadow-inner">
                {interpolateTemplate(editContent, {
                  orderNumber: 'WBK-20261008-0001',
                  customerName: 'Budi Santoso',
                  phone: '081234567890',
                  orderType: 'DELIVERY',
                  address: 'Jl. Merdeka No. 45, Jakarta Selatan',
                  items: '- Mie Goreng x2 — Rp12.000\n- Jus Mangga x1 — Rp10.000',
                  subtotal: 'Rp34.000',
                  discount: 'Rp0',
                  deliveryFee: 'Rp5.000',
                  total: 'Rp39.000',
                  paymentMethod: 'QRIS',
                  status: 'MENUNGGU KONFIRMASI',
                  createdAt: '08/10/2026 14:30 WIB',
                  poNumber: 'PO-20261008-01',
                  eventDate: '12/10/2026',
                  eventTime: '10:00 WIB',
                  qty: '50 Porsi',
                  notes: 'Pedas sedang, tolong antar tepat waktu',
                  productName: 'Ayam Geprek Spesial',
                  stock: '3',
                  minStock: '10',
                  expenseAmount: 'Rp150.000',
                  expenseCategory: 'Bahan Baku',
                  expenseDescription: 'Beli cabai rawit & bawang',
                  dailyTxCount: '48',
                  dailySales: 'Rp1.850.000',
                  dailyCash: 'Rp600.000',
                  dailyTransfer: 'Rp450.000',
                  dailyQris: 'Rp700.000',
                  dailyEwallet: 'Rp100.000',
                  dailyDeliveryQty: '18',
                  dailyTakeawayQty: '30',
                  dailyPoQty: '2',
                  dailyExpense: 'Rp350.000',
                  dailyEstProfit: 'Rp1.500.000',
                  topProduct: 'Ayam Geprek Bang Kobra',
                  errorModule: 'POS Checkout',
                  errorMessage: 'Printer Bluetooth disconnected',
                  alertTitle: 'Login Admin Luar Jam Kerja',
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan Template'}
            </button>
          </div>
        </div>
      )}

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((t) => (
          <div
            key={t.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-colors"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    {t.name}
                    {t.isDefault && (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">
                        Default
                      </span>
                    )}
                  </h4>
                  <span className="text-[11px] text-indigo-600 font-mono block mt-0.5">
                    Tipe: {t.type}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Template"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content Preview */}
              <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100 font-mono text-[11px] text-slate-700 whitespace-pre-wrap max-h-36 overflow-y-auto">
                {t.content}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Diperbarui: {new Date(t.updatedAt).toLocaleDateString('id-ID')}</span>
              <button
                onClick={() => startEdit(t)}
                className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> Pratinjau & Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
