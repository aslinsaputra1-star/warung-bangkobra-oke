import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Star,
  Edit2,
  X,
  Save,
} from 'lucide-react';
import { GoogleChatSpace } from '../../types/googleChat';
import { GoogleChatService } from '../../services/googleChatService';

interface GoogleChatSpacesTabProps {
  spaces: GoogleChatSpace[];
  defaultSpaceId: string;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GoogleChatSpacesTab: React.FC<GoogleChatSpacesTabProps> = ({
  spaces,
  defaultSpaceId,
  onRefresh,
  showToast,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Partial<GoogleChatSpace> | null>(null);
  const [name, setName] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingSpaceId, setTestingSpaceId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingSpace(null);
    setName('');
    setSpaceId(`spaces/wbk-${Date.now()}`);
    setWebhookUrl('');
    setDescription('');
    setIsDefault(spaces.length === 0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (space: GoogleChatSpace) => {
    setEditingSpace(space);
    setName(space.name);
    setSpaceId(space.spaceId);
    setWebhookUrl(space.webhookUrl);
    setDescription(space.description || '');
    setIsDefault(space.isDefault || space.id === defaultSpaceId);
    setIsModalOpen(true);
  };

  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama Ruang / Space wajib diisi', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await GoogleChatService.saveSpace({
        id: editingSpace?.id,
        name: name.trim(),
        spaceId: spaceId.trim(),
        webhookUrl: webhookUrl.trim(),
        isDefault,
        description: description.trim(),
      });

      if (res.success) {
        showToast('Ruang Google Chat berhasil disimpan', 'success');
        setIsModalOpen(false);
        onRefresh();
      } else {
        showToast(res.message || 'Gagal menyimpan', 'error');
      }
    } catch {
      showToast('Koneksi ke server bermasalah', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSpace = async (id: string, spaceName: string) => {
    if (!window.confirm(`Hapus ruang Google Chat "${spaceName}"?`)) return;
    try {
      const res = await GoogleChatService.deleteSpace(id);
      if (res.success) {
        showToast('Ruang berhasil dihapus', 'info');
        onRefresh();
      } else {
        showToast(res.message || 'Gagal menghapus', 'error');
      }
    } catch {
      showToast('Gagal menghapus ruang', 'error');
    }
  };

  const handleTestSpecificSpace = async (space: GoogleChatSpace) => {
    setTestingSpaceId(space.id);
    try {
      const res = await GoogleChatService.testConnection(space.id);
      if (res.success) {
        showToast(res.message, 'success');
        onRefresh();
      } else {
        showToast(res.message, 'error');
      }
    } catch {
      showToast('Koneksi bermasalah', 'error');
    } finally {
      setTestingSpaceId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6">
        <div>
          <h3 className="text-lg font-black text-white">Daftar Ruang / Space Google Chat</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Kelola multiple space untuk memisahkan notifikasi operasional, dapur, delivery DQM, dan keuangan.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 transition active:scale-95 shadow-md shadow-amber-950/40 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Ruang Baru</span>
        </button>
      </div>

      {/* Spaces List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {spaces.map((space) => {
          const isDef = space.isDefault || space.id === defaultSpaceId;
          const isConnected = space.status === 'CONNECTED' && Boolean(space.webhookUrl);

          return (
            <div
              key={space.id}
              className={`bg-stone-900 border rounded-3xl p-5 flex flex-col justify-between transition-all ${
                isDef
                  ? 'border-amber-500/40 shadow-lg shadow-amber-950/20'
                  : 'border-stone-800 hover:border-stone-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-stone-800 text-amber-400 flex items-center justify-center font-bold">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm line-clamp-1">{space.name}</h4>
                      <span className="text-[10px] text-stone-400 font-mono">{space.spaceId}</span>
                    </div>
                  </div>

                  {isDef && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black">
                      <Star className="w-3 h-3 fill-amber-300" />
                      DEFAULT
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-400 line-clamp-2 min-h-[32px] mb-3">
                  {space.description || 'Tidak ada deskripsi khusus.'}
                </p>

                <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-2.5 mb-4 text-[11px] font-mono text-stone-400 truncate">
                  <span className="text-stone-500 mr-1">Webhook:</span>
                  {space.webhookUrl ? space.webhookUrl : '<Belum diatur>'}
                </div>

                <div className="flex items-center justify-between text-xs text-stone-400 border-t border-stone-800/80 pt-3">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                    {isConnected ? 'Terhubung' : 'Tidak Terhubung'}
                  </span>
                  {space.lastTestedAt && (
                    <span className="text-[10px] text-stone-500 font-mono">
                      Diuji: {new Date(space.lastTestedAt).toLocaleDateString('id-ID')}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between gap-2 border-t border-stone-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => handleTestSpecificSpace(space)}
                  disabled={testingSpaceId === space.id}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  <Activity
                    className={`w-3.5 h-3.5 text-amber-400 ${
                      testingSpaceId === space.id ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Test</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(space)}
                    className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer"
                    title="Edit Ruang"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSpace(space.id, space.name)}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                    title="Hapus Ruang"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add/Edit Space */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-extrabold text-white text-base">
                {editingSpace ? 'Edit Ruang Google Chat' : 'Tambah Ruang Google Chat'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpace} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Nama Ruang <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Dapur Warung Bang Kobra"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Space ID (Opsional)
                </label>
                <input
                  type="text"
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  placeholder="spaces/XXXXX"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm font-mono text-stone-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  Webhook URL Google Chat <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://chat.googleapis.com/v1/spaces/..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">Deskripsi</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan alur kerja ruang ini"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-default-space"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-stone-950 border-stone-800"
                />
                <label htmlFor="chk-default-space" className="text-xs font-bold text-stone-300 cursor-pointer">
                  Jadikan Ruang Default Utama
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-bold text-xs hover:bg-stone-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 shadow-md shadow-amber-950/40 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Ruang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
