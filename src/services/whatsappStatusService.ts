import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, ensureFirebaseAuth } from './firebase';
import {
  WhatsAppStatusItem,
  WhatsAppStatusTemplate,
  WhatsAppStatusTemplateType,
  StoreSettings,
} from '../types';

export const PRESET_STATUS_TEMPLATES: WhatsAppStatusTemplate[] = [
  {
    statusId: 'preset-promo-hari-ini',
    title: '🔥 Promo Spesial Hari Ini',
    templateType: 'PROMO_HARI_INI',
    badgeText: '🔥 PROMO HARI INI',
    tagline: 'Enak • Murah • Dekat',
    text: 'Pesan menu favorit hari ini dengan harga lebih hemat! Siap antar atau ambil di warung.',
    ctaText: '🛒 PESAN SEKARANG',
    themeStyle: 'red-glow',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-promo-minuman',
    title: '🍹 Promo Jus & Minuman Segar',
    templateType: 'PROMO_MINUMAN',
    badgeText: '🍹 ANEKA JUS BUAH ASLI',
    tagline: '100% Buah Segar • Dingin Menyegarkan',
    text: 'Hilangkan dahaga dengan jus mangga, alpukat, jambu, dan jeruk peras asli!',
    ctaText: '🥤 PESAN MINUMAN',
    themeStyle: 'sunset-orange',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-promo-mie',
    title: '🍜 Promo Indomie & Mie Goreng',
    templateType: 'PROMO_MIE',
    badgeText: '🍜 SPESIAL ANEKA MIE',
    tagline: 'Pilihan Rasa Lengkap • Gurih Mantap',
    text: 'Indomie Aceh, Rendang, Geprek, Soto, Goreng komplit dengan telur & sambal spesial!',
    ctaText: '🍜 PESAN MIE SEKARANG',
    themeStyle: 'dark-fire',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-promo-makanan',
    title: '🍗 Promo Makanan & Nasi Ayam',
    templateType: 'PROMO_MAKANAN',
    badgeText: '🍗 MAKAN KENYANG & NIKMAT',
    tagline: 'Nasi Hangat • Ayam Krispi Renyah',
    text: 'Nasi Ayam Krispi, Sambal Bawang pedas nampol, porsi pas bikin kenyang seharian!',
    ctaText: '🍗 PESAN MAKANAN',
    themeStyle: 'red-glow',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-paket-hemat',
    title: '📦 Paket Hemat Kenyang',
    templateType: 'PAKET_HEMAT',
    badgeText: '📦 PAKET COMBO HEMAT',
    tagline: 'Makan + Minum Sekaligus',
    text: 'Paket Nasi Ayam + Es Teh / Jus hemat cuma di Warung Bang Kobra!',
    ctaText: '📦 AMBIL PAKET HEMAT',
    themeStyle: 'gold-premium',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-promo-delivery',
    title: '🚚 Promo Delivery Pesantren DQM',
    templateType: 'PROMO_DELIVERY',
    badgeText: '🚚 DELIVERY AREA DQM',
    tagline: 'Diantar Hangat Sampai Lokasi',
    text: 'Delivery sementara tersedia untuk area sekitar Pesantren DQM. Pesan tanpa ribet keluar!',
    ctaText: '🛵 PESAN DELIVERY DQM',
    isDeliveryPromo: true,
    deliveryMinOrder: 20000,
    themeStyle: 'sunset-orange',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-promo-weekend',
    title: '🎉 Promo Spesial Weekend',
    templateType: 'PROMO_WEEKEND',
    badgeText: '🎉 WEEKEND SANTAI',
    tagline: 'Kumpul Santai Bersama Teman',
    text: 'Habiskan akhir pekan dengan camilan dan minuman favorit Bang Kobra!',
    ctaText: '🎉 PESAN MENU WEEKEND',
    themeStyle: 'red-glow',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-flash-sale',
    title: '💥 Flash Sale Terbatas',
    templateType: 'FLASH_SALE',
    badgeText: '💥 FLASH SALE HARI INI',
    tagline: 'Harga Spesial • Stok Terbatas',
    text: 'Harga heboh cuma hari ini! Buruan sebelum kehabisan stok promonya!',
    ctaText: '⚡ SERBU SEKARANG',
    themeStyle: 'dark-fire',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-favorit-pelanggan',
    title: '⭐ Menu Favorit Pelanggan',
    templateType: 'FAVORIT_PELANGGAN',
    badgeText: '⭐ PALING DISUKAI',
    tagline: 'Rekomendasi Terbaik',
    text: 'Menu terlaris yang sudah dibuktikan kelezatannya oleh para pelanggan setia kami!',
    ctaText: '⭐ COBAIN SEKARANG',
    themeStyle: 'gold-premium',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
  {
    statusId: 'preset-menu-baru',
    title: '🆕 Menu Baru Rilis',
    templateType: 'MENU_BARU',
    badgeText: '🆕 BARU DI BANG KOBRA',
    tagline: 'Menu Baru Wajib Dicoba',
    text: 'Ada menu baru nih di Warung Bang Kobra! Rasa otentik yang bikin pengen nambah lagi.',
    ctaText: '🆕 PESAN MENU BARU',
    themeStyle: 'fresh-white',
    isPreset: true,
    createdBy: 'System',
    createdAt: new Date().toISOString(),
  },
];

const LOCAL_STORAGE_KEY_TEMPLATES = 'wbk_wa_status_templates';
const LOCAL_STORAGE_KEY_HISTORY = 'wbk_wa_status_history';

export class WhatsAppStatusService {
  /**
   * Resolve default customer app URL
   */
  static getCustomerAppUrl(settings?: StoreSettings): string {
    if (settings?.customerAppUrl && settings.customerAppUrl.trim().length > 0) {
      return settings.customerAppUrl.trim();
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?mode=customer`;
    }
    return 'https://warungbangkobra.com/?mode=customer';
  }

  /**
   * Fetch templates: combine presets with Firestore user-saved templates
   */
  static async getTemplates(): Promise<WhatsAppStatusTemplate[]> {
    try {
      await ensureFirebaseAuth();
      const colRef = collection(db, 'whatsapp_status_templates');
      const snap = await getDocs(colRef);
      const customTemplates: WhatsAppStatusTemplate[] = [];

      snap.forEach((docSnap) => {
        customTemplates.push(docSnap.data() as WhatsAppStatusTemplate);
      });

      if (customTemplates.length > 0) {
        // Cache locally
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATES, JSON.stringify(customTemplates));
        } catch {}
        return [...customTemplates, ...PRESET_STATUS_TEMPLATES];
      }
    } catch (e) {
      console.warn('Firestore templates fetch error, using local/presets:', e);
    }

    // LocalStorage fallback
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_TEMPLATES);
      if (raw) {
        const parsed = JSON.parse(raw) as WhatsAppStatusTemplate[];
        return [...parsed, ...PRESET_STATUS_TEMPLATES];
      }
    } catch {}

    return PRESET_STATUS_TEMPLATES;
  }

  /**
   * Save a template to Firestore and localStorage
   */
  static async saveTemplate(template: WhatsAppStatusTemplate): Promise<boolean> {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, 'whatsapp_status_templates', template.statusId);
      await setDoc(docRef, {
        ...template,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to save template to Firestore:', e);
    }

    // Always save to localStorage
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_TEMPLATES);
      const list = raw ? (JSON.parse(raw) as WhatsAppStatusTemplate[]) : [];
      const updated = [template, ...list.filter((t) => t.statusId !== template.statusId)];
      localStorage.setItem(LOCAL_STORAGE_KEY_TEMPLATES, JSON.stringify(updated));
    } catch {}

    return true;
  }

  /**
   * Delete a user-saved template
   */
  static async deleteTemplate(statusId: string): Promise<boolean> {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, 'whatsapp_status_templates', statusId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Failed to delete template from Firestore:', e);
    }

    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_TEMPLATES);
      if (raw) {
        const list = JSON.parse(raw) as WhatsAppStatusTemplate[];
        localStorage.setItem(
          LOCAL_STORAGE_KEY_TEMPLATES,
          JSON.stringify(list.filter((t) => t.statusId !== statusId))
        );
      }
    } catch {}

    return true;
  }

  /**
   * Fetch Status History from Firestore and localStorage
   */
  static async getHistory(): Promise<WhatsAppStatusItem[]> {
    try {
      await ensureFirebaseAuth();
      const colRef = collection(db, 'whatsapp_status_history');
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(30));
      const snap = await getDocs(q);
      const list: WhatsAppStatusItem[] = [];

      snap.forEach((docSnap) => {
        list.push(docSnap.data() as WhatsAppStatusItem);
      });

      if (list.length > 0) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify(list));
        } catch {}
        return list;
      }
    } catch (e) {
      console.warn('Firestore history fetch error, falling back to local:', e);
    }

    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY);
      if (raw) {
        return JSON.parse(raw) as WhatsAppStatusItem[];
      }
    } catch {}

    return [];
  }

  /**
   * Record newly created/shared status to History
   */
  static async recordHistory(item: WhatsAppStatusItem): Promise<boolean> {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, 'whatsapp_status_history', item.statusId);
      await setDoc(docRef, item);
    } catch (e) {
      console.warn('Failed to record history to Firestore:', e);
    }

    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY);
      const list = raw ? (JSON.parse(raw) as WhatsAppStatusItem[]) : [];
      const updated = [item, ...list.filter((h) => h.statusId !== item.statusId)].slice(0, 50);
      localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify(updated));
    } catch {}

    return true;
  }

  /**
   * Generate High-Resolution 1080x1920 (9:16) Graphic Canvas
   */
  static async generateStatusCanvasBlob(
    item: WhatsAppStatusItem,
    settings: StoreSettings
  ): Promise<{ blob: Blob; dataUrl: string }> {
    const width = 1080;
    const height = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context could not be created');

    // 1. Background Theme Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    if (item.themeStyle === 'sunset-orange') {
      bgGradient.addColorStop(0, '#7c1c05');
      bgGradient.addColorStop(0.4, '#ea580c');
      bgGradient.addColorStop(1, '#9a1a06');
    } else if (item.themeStyle === 'dark-fire') {
      bgGradient.addColorStop(0, '#120505');
      bgGradient.addColorStop(0.5, '#450a0a');
      bgGradient.addColorStop(1, '#1c0505');
    } else if (item.themeStyle === 'gold-premium') {
      bgGradient.addColorStop(0, '#421a00');
      bgGradient.addColorStop(0.5, '#b45309');
      bgGradient.addColorStop(1, '#78350f');
    } else if (item.themeStyle === 'fresh-white') {
      bgGradient.addColorStop(0, '#991b1b');
      bgGradient.addColorStop(0.6, '#dc2626');
      bgGradient.addColorStop(1, '#7f1d1d');
    } else {
      // Default: red-glow
      bgGradient.addColorStop(0, '#991b1b');
      bgGradient.addColorStop(0.5, '#dc2626');
      bgGradient.addColorStop(1, '#7f1d1d');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle dark vignette at top and bottom
    const topVignette = ctx.createLinearGradient(0, 0, 0, 400);
    topVignette.addColorStop(0, 'rgba(0,0,0,0.6)');
    topVignette.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topVignette;
    ctx.fillRect(0, 0, width, 400);

    const botVignette = ctx.createLinearGradient(0, height - 500, 0, height);
    botVignette.addColorStop(0, 'rgba(0,0,0,0)');
    botVignette.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = botVignette;
    ctx.fillRect(0, height - 500, width, 500);

    // 2. Header: Logo & Store Name
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(settings.storeName || 'WARUNG BANG KOBRA', width / 2, 120);

    ctx.font = '500 28px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('ENAK • MURAH • DEKAT', width / 2, 165);
    ctx.restore();

    // 3. Badge Ribbon (e.g. 🔥 PROMO HARI INI)
    const badgeText = item.badgeText || '🔥 PROMO HARI INI';
    ctx.save();
    ctx.font = 'bold 36px "Plus Jakarta Sans", Inter, sans-serif';
    const badgeWidth = ctx.measureText(badgeText).width + 80;
    const badgeHeight = 70;
    const badgeX = (width - badgeWidth) / 2;
    const badgeY = 220;

    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 6;
    this.roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 35);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, width / 2, badgeY + 48);
    ctx.restore();

    // 4. Product Image Card (Center 880x880 with rounded corners)
    const cardWidth = 880;
    const cardHeight = 820;
    const cardX = (width - cardWidth) / 2;
    const cardY = 320;

    // Card white frame with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#ffffff';
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 48);
    ctx.fill();
    ctx.restore();

    // Draw Image inside rounded clip
    if (item.imageUrl) {
      try {
        const img = await this.loadImage(item.imageUrl);
        ctx.save();
        this.roundRect(ctx, cardX + 16, cardY + 16, cardWidth - 32, cardHeight - 32, 40);
        ctx.clip();
        // Cover aspect fill
        const hRatio = (cardWidth - 32) / img.width;
        const vRatio = (cardHeight - 32) / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShiftX = (cardWidth - 32 - img.width * ratio) / 2;
        const centerShiftY = (cardHeight - 32 - img.height * ratio) / 2;
        ctx.drawImage(
          img,
          0,
          0,
          img.width,
          img.height,
          cardX + 16 + centerShiftX,
          cardY + 16 + centerShiftY,
          img.width * ratio,
          img.height * ratio
        );
        ctx.restore();
      } catch {
        // Fallback placeholder text if image fails to load
        ctx.save();
        ctx.fillStyle = '#f87171';
        this.roundRect(ctx, cardX + 16, cardY + 16, cardWidth - 32, cardHeight - 32, 40);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WARUNG BANG KOBRA', width / 2, cardY + cardHeight / 2);
        ctx.restore();
      }
    }

    // 5. Product Title & Tagline
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillText(item.productName || item.title, width / 2, 1200);

    if (item.tagline) {
      ctx.font = 'bold 36px "Plus Jakarta Sans", Inter, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(item.tagline, width / 2, 1260);
    }
    ctx.restore();

    // 6. Big Price Badge
    const priceText = item.price ? `Rp${item.price.toLocaleString('id-ID')}` : '';
    const promoText = item.promoPrice ? `Rp${item.promoPrice.toLocaleString('id-ID')}` : '';

    if (priceText || promoText) {
      ctx.save();
      const displayPrice = promoText || priceText;
      ctx.font = '900 80px "JetBrains Mono", Inter, sans-serif';
      const pWidth = ctx.measureText(displayPrice).width + 90;
      const pHeight = 110;
      const pX = (width - pWidth) / 2;
      const pY = 1300;

      // Price pill
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      this.roundRect(ctx, pX, pY, pWidth, pHeight, 55);
      ctx.fill();

      // Price Text
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#dc2626';
      ctx.textAlign = 'center';
      ctx.fillText(displayPrice, width / 2, pY + 80);

      // Strikethrough original price if promoPrice is set
      if (promoText && priceText) {
        ctx.font = 'bold 36px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`Coret: ${priceText}`, width / 2, pY + 160);
      }
      ctx.restore();
    }

    // 7. Delivery Information Box (Section 5)
    if (item.isDeliveryPromo || item.templateType === 'PROMO_DELIVERY') {
      ctx.save();
      const delivW = 860;
      const delivH = 130;
      const delivX = (width - delivW) / 2;
      const delivY = 1460;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      this.roundRect(ctx, delivX, delivY, delivW, delivH, 24);
      ctx.fill();

      ctx.font = 'bold 30px "Plus Jakarta Sans", Inter, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.fillText('🚚 PENGANTARAN KHUSUS AREA PESANTREN DQM', width / 2, delivY + 50);

      ctx.font = '500 26px "Plus Jakarta Sans", Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Minimum Belanja: Rp20.000 • Antar Cepat & Hangat', width / 2, delivY + 95);
      ctx.restore();
    }

    // 8. CTA Button (Section 6)
    ctx.save();
    const ctaY = item.isDeliveryPromo ? 1630 : 1580;
    const ctaW = 760;
    const ctaH = 100;
    const ctaX = (width - ctaW) / 2;

    const ctaGrad = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY);
    ctaGrad.addColorStop(0, '#16a34a');
    ctaGrad.addColorStop(1, '#22c55e');

    ctx.fillStyle = ctaGrad;
    ctx.shadowColor = 'rgba(22, 163, 74, 0.6)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 10;
    this.roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 50);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.ctaText || '🛒 PESAN SEKARANG', width / 2, ctaY + 65);

    // Subtext link
    ctx.font = '600 24px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('Klik Link di Status / Balas Chat WhatsApp Ini', width / 2, ctaY + 150);
    ctx.restore();

    // 9. Export to Blob and DataURL
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create image blob'));
            return;
          }
          const dataUrl = canvas.toDataURL('image/png');
          resolve({ blob, dataUrl });
        },
        'image/png',
        0.95
      );
    });
  }

  /**
   * Helper: Draw rounded rectangle
   */
  private static roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * Helper: Load image safely
   */
  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }
}
