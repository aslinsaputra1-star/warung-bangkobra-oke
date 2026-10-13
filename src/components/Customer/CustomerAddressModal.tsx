import React, { useState } from 'react';
import { X, MapPin, Check, Plus, Home, Building2, School } from 'lucide-react';
import { DQM_LOCATIONS } from '../../utils/formatters';

interface CustomerAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress: string;
  onSaveAddress: (address: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CustomerAddressModal: React.FC<CustomerAddressModalProps> = ({
  isOpen,
  onClose,
  currentAddress,
  onSaveAddress,
  showToast,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    return currentAddress || DQM_LOCATIONS[0] || 'Komplek Utama DQM';
  });
  const [detailNote, setDetailNote] = useState<string>('');

  if (!isOpen) return null;

  const presets = [
    { name: 'Komplek Utama DQM', desc: 'Gerbang utama & pos satpam Pesantren DQM', icon: School },
    { name: 'Asrama Putra DQM', desc: 'Area asrama santri putra DQM', icon: Building2 },
    { name: 'Asrama Putri DQM', desc: 'Area asrama santri putri DQM', icon: Building2 },
    { name: 'Kantor Staf & Guru DQM', desc: 'Gedung kantor yayasan & pengajar', icon: Home },
    { name: 'Area Sekitar DQM (Jalan Utama)', desc: 'Rumah tinggal / warga sekitar pesantren', icon: MapPin },
  ];

  const handleSave = () => {
    const full = detailNote.trim()
      ? `${selectedPreset} (${detailNote.trim()})`
      : selectedPreset;
    onSaveAddress(full);
    localStorage.setItem('wbk_customer_address', full);
    showToast?.('Alamat pengantaran berhasil diperbarui!', 'success');
    onClose();
  };

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
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                Pilih Lokasi Pengantaran
              </h2>
              <p className="text-xs text-gray-500">
                Layanan antar hangat ke area Pesantren DQM
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

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 block">
              Pilih Titik Lokasi / Asrama:
            </label>
            <div className="space-y-2">
              {presets.map((preset) => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setSelectedPreset(preset.name)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-[#E50914] bg-red-50/70 text-gray-900 ring-1 ring-[#E50914]'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#E50914] text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs sm:text-sm block">
                          {preset.name}
                        </span>
                        <span className="text-[11px] text-gray-500 block">
                          {preset.desc}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#E50914] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Detail Alamat Tambahan (Kamar / Lantai / Patokan):
            </label>
            <input
              type="text"
              value={detailNote}
              onChange={(e) => setDetailNote(e.target.value)}
              placeholder="Contoh: Kamar 204, Lantai 2 / Titip pos satpam"
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#E50914] transition bg-gray-50/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-white grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="py-3 rounded-2xl bg-[#E50914] hover:bg-[#A80710] text-white font-bold text-xs shadow-md shadow-red-600/30 transition cursor-pointer"
          >
            Simpan Alamat
          </button>
        </div>
      </div>
    </div>
  );
};
