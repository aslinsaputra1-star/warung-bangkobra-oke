import React, { useState, useEffect } from 'react';
import {
  Link2,
  CheckCircle2,
  XCircle,
  Activity,
  Send,
  Unlink,
  ShieldCheck,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { GoogleChatSpace } from '../../types/googleChat';
import { GoogleChatService } from '../../services/googleChatService';

interface GoogleChatConnectionTabProps {
  connectionStatus: 'CONNECTED' | 'DISCONNECTED';
  spaces: GoogleChatSpace[];
  defaultSpaceId: string;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GoogleChatConnectionTab: React.FC<GoogleChatConnectionTabProps> = ({
  connectionStatus,
  spaces,
  defaultSpaceId,
  onRefresh,
  showToast,
}) => {
  const currentSpace = spaces.find((s) => s.id === defaultSpaceId) || spaces[0];

  const [name, setName] = useState(currentSpace?.name || 'Warung Bang Kobra - Utama');
  const [spaceId, setSpaceId] = useState(currentSpace?.spaceId || 'spaces/warung-bang-kobra');
  const [webhookUrl, setWebhookUrl] = useState(currentSpace?.webhookUrl || '');
  const [description, setDescription] = useState(currentSpace?.description || 'Ruang notifikasi operasional kasir & pesanan online');

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSendingCustomTest, setIsSendingCustomTest] = useState(false);
  const [copiedInstruction, setCopiedInstruction] = useState(false);

  useEffect(() => {
    if (currentSpace) {
      setName(currentSpace.name || 'Warung Bang Kobra - Utama');
      setSpaceId(currentSpace.spaceId || 'spaces/warung-bang-kobra');
      setWebhookUrl(currentSpace.webhookUrl || '');
      setDescription(currentSpace.description || '');
    }
  }, [currentSpace]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Nama Ruang / Space wajib diisi', 'error');
      return;
    }

    if (!webhookUrl.trim()) {
      showToast('Webhook URL Google Chat wajib diisi', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await GoogleChatService.saveSpace({
        id: currentSpace?.id,
        name: name.trim(),
        spaceId: spaceId.trim(),
        webhookUrl: webhookUrl.trim(),
        isDefault: true,
        description: description.trim(),
      });

      if (res.success) {
        showToast('Koneksi Google Chat berhasil disimpan!', 'success');
        onRefresh();
      } else {
        showToast(res.message || 'Gagal menyimpan koneksi', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat menyimpan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await GoogleChatService.testConnection(
        currentSpace?.id,
        webhookUrl.includes('••••') ? undefined : webhookUrl
      );
      if (res.success) {
        showToast(res.message, 'success');
        onRefresh();
      } else {
        showToast(res.message, 'error');
      }
    } catch {
      showToast('Koneksi ke server gagal', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Yakin ingin memutuskan koneksi webhook Google Chat ini?')) return;
    setIsDisconnecting(true);
    try {
      const res = await GoogleChatService.disconnect(currentSpace?.id);
      if (res.success) {
        showToast('Koneksi Google Chat telah diputuskan', 'info');
        setWebhookUrl('');
        onRefresh();
      } else {
        showToast(res.message || 'Gagal memutuskan', 'error');
      }
    } catch {
      showToast('Koneksi ke server gagal', 'error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSendCustomTest = async () => {
    setIsSendingCustomTest(true);
    try {
      const res = await GoogleChatService.sendNotification({
        eventId: `test_${Date.now()}`,
        notificationType: 'ORDER_NEW',
        referenceId: 'WBK-TEST-001',
        title: '🔔 TES NOTIFIKASI MANUAL',
        templateVariables: {
          orderNumber: 'WBK-TEST-001',
          customerName: 'Rayyana Rasyid (Tes Pelanggan)',
          phone: '0812-3456-7890',
          orderType: 'DELIVERY PESANTREN DQM',
          address: 'Gedung Asrama Putra DQM Kamar 12',
          items: '- Mie Goreng Spesial x2 — Rp24.000\n- Es Teh Manis Jumbo x2 — Rp10.000',
          total: 'Rp34.000',
          paymentMethod: 'QRIS',
          status: 'MENUNGGU KONFIRMASI',
          createdAt: new Date().toLocaleString('id-ID'),
        },
      });

      if (res.success) {
        showToast('Pesan tes pesanan berhasil dikirim ke Google Chat!', 'success');
      } else {
        showToast(res.message || 'Gagal mengirim pesan tes', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setIsSendingCustomTest(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 rounded-3xl p-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-black text-white">Hubungkan Google Chat</h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border flex items-center gap-1.5 ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}
            >
              {connectionStatus === 'CONNECTED' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  TERHUBUNG
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  TIDAK TERHUBUNG
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-stone-400">
            Hubungkan webhook ruang Google Chat toko untuk menerima notifikasi otomatis dari kasir dan pelanggan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus === 'CONNECTED' && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>{isDisconnecting ? 'Memutuskan...' : 'Putuskan Koneksi'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Security Guarantee Card */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-4 flex items-start gap-3 text-xs text-stone-400">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-extrabold text-stone-200">Keamanan Secret & Token Terjamin:</span>
          <p>
            URL Webhook dan token rahasia Google Chat disimpan eksklusif pada sisi server (server-side secret storage). Secret disamarkan (masked) sehingga tidak pernah terekspos di browser pelanggan maupun inspeksi kode frontend.
          </p>
        </div>
      </div>

      {/* Connection Form */}
      <form onSubmit={handleConnect} className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Nama Ruang / Space <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Warung Bang Kobra - Operasional"
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
              required
            />
            <p className="text-[11px] text-stone-500 mt-1">Nama tampilan ruang untuk identifikasi internal.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Space ID (Opsional)
            </label>
            <input
              type="text"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              placeholder="spaces/AAAA... atau identifier unik"
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm font-mono text-stone-300 focus:outline-none focus:border-amber-500 transition"
            />
            <p className="text-[11px] text-stone-500 mt-1">ID ruang Google Chat untuk routing pesan.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-300 mb-1.5">
            Webhook URL Google Chat <span className="text-amber-400">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://chat.googleapis.com/v1/spaces/XXXX/messages?key=YYYY&token=ZZZZ"
              className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-4 pr-10 py-2.5 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-500 transition"
              required
            />
            <div className="absolute right-3 top-2.5 text-stone-500" title="Token aman">
              <ShieldCheck className="w-5 h-5 text-stone-500" />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            Dapatkan URL ini dari menu <b>Apps & Integrations → Manage Webhooks</b> di Google Chat Space Anda.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-300 mb-1.5">
            Deskripsi / Catatan Tambahan
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ruang monitoring kasir, delivery santri, dan laporan harian"
            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-300 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* Buttons Action Group */}
        <div className="pt-4 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !webhookUrl}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Activity className={`w-4 h-4 text-amber-400 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Menguji...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendCustomTest}
              disabled={isSendingCustomTest || connectionStatus !== 'CONNECTED'}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Send className={`w-4 h-4 ${isSendingCustomTest ? 'animate-pulse' : ''}`} />
              <span>{isSendingCustomTest ? 'Mengirim...' : 'Kirim Pesan Tes'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-950/40 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Link2 className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Hubungkan Google Chat'}</span>
          </button>
        </div>
      </form>

      {/* Guide: Cara Membuat Webhook di Google Chat */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-white font-extrabold text-sm">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>Panduan Singkat: Cara Membuat Webhook di Google Chat</span>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-xs text-stone-400 leading-relaxed pl-1">
          <li>Buka <b>Google Chat</b> melalui browser atau aplikasi Google Workspace.</li>
          <li>Pilih atau buat <b>Space</b> baru (misal: <i>Warung Bang Kobra - Operasional</i>).</li>
          <li>Klik judul Space di bagian atas, lalu pilih <b>Apps & integrations</b> (Aplikasi & integrasi).</li>
          <li>Klik <b>Webhooks</b> → <b>Add webhook</b> (Tambah webhook).</li>
          <li>Beri nama webhook (contoh: <code>Notifikasi Bang Kobra</code>) dan simpan.</li>
          <li>Salin (Copy) URL webhook yang dihasilkan, lalu tempelkan ke kolom <b>Webhook URL Google Chat</b> di atas.</li>
          <li>Klik tombol <b>Hubungkan Google Chat</b> lalu lakukan <b>Test Connection</b>.</li>
        </ol>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText('https://chat.google.com');
              setCopiedInstruction(true);
              setTimeout(() => setCopiedInstruction(false), 2000);
            }}
            className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 transition"
          >
            {copiedInstruction ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedInstruction ? 'Tautan Disalin!' : 'Buka Google Chat (chat.google.com)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
