import { Router } from "express";
import fs from "fs";
import path from "path";

export interface VaultSpace {
  id: string;
  name: string;
  spaceId: string;
  webhookUrl: string; // Real full URL stored securely on server
  isDefault: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  description?: string;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface VaultData {
  spaces: VaultSpace[];
  defaultSpaceId: string;
  dailySummaryTime: string;
  dailySummaryEnabled: boolean;
  lastDailySummaryDate?: string;
}

const VAULT_DIR = path.join(process.cwd(), "data");
const VAULT_FILE = path.join(VAULT_DIR, "google_chat_vault.json");
const IDEMPOTENCY_FILE = path.join(VAULT_DIR, "google_chat_idempotency.json");

// Ensure data directory exists
if (!fs.existsSync(VAULT_DIR)) {
  try {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  } catch (err) {
    console.warn("Failed to create vault directory:", err);
  }
}

// In-memory cache of processed event IDs for anti-duplication
const processedEventIds = new Set<string>();

// Load processed events from disk
try {
  if (fs.existsSync(IDEMPOTENCY_FILE)) {
    const raw = fs.readFileSync(IDEMPOTENCY_FILE, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach((id) => processedEventIds.add(id));
    }
  }
} catch (e) {
  console.warn("Failed to read idempotency file:", e);
}

function persistEventId(eventId: string) {
  if (!eventId) return;
  processedEventIds.add(eventId);
  try {
    const list = Array.from(processedEventIds).slice(-1000); // keep last 1000 events
    fs.writeFileSync(IDEMPOTENCY_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to persist eventId:", err);
  }
}

function readVault(): VaultData {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const content = fs.readFileSync(VAULT_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("Error reading vault file:", err);
  }

  // Fallback seed with environment variable if provided
  const envWebhook = process.env.GOOGLE_CHAT_WEBHOOK_URL || "";
  const initialSpaces: VaultSpace[] = [];

  if (envWebhook) {
    initialSpaces.push({
      id: "space-default",
      name: "Warung Bang Kobra - Utama",
      spaceId: "spaces/default",
      webhookUrl: envWebhook,
      isDefault: true,
      status: "CONNECTED",
      description: "Ruang utama operasional Warung Bang Kobra dari ENV",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "System",
      updatedBy: "System",
    });
  }

  return {
    spaces: initialSpaces,
    defaultSpaceId: initialSpaces[0]?.id || "",
    dailySummaryTime: "21:00",
    dailySummaryEnabled: true,
  };
}

function writeVault(data: VaultData) {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing vault file:", err);
  }
}

// Mask webhook URL so client never sees secrets/tokens
export function maskWebhookUrl(url: string): string {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    if (parsed.search) {
      const params = new URLSearchParams(parsed.search);
      for (const [key, val] of params.entries()) {
        if (val.length > 6) {
          params.set(key, val.slice(0, 3) + "••••••••" + val.slice(-3));
        } else {
          params.set(key, "••••••••");
        }
      }
      return `${parsed.origin}${parsed.pathname}?${params.toString()}`;
    }
    // Path masking
    const parts = parsed.pathname.split("/");
    const maskedParts = parts.map((p, idx) => (idx > 2 && p.length > 6 ? p.slice(0, 3) + "••••" : p));
    return `${parsed.origin}${maskedParts.join("/")}`;
  } catch {
    if (url.length > 12) {
      return url.slice(0, 8) + "••••••••" + url.slice(-4);
    }
    return "••••••••";
  }
}

// Google Chat Card V2 Builder
function buildGoogleChatPayload(options: {
  title: string;
  subtitle?: string;
  headerIcon?: string;
  bodyText: string;
  sections?: Array<{
    header?: string;
    widgets: any[];
  }>;
  actionUrl?: string;
  actionText?: string;
}) {
  const { title, subtitle, headerIcon, bodyText, sections = [], actionUrl, actionText } = options;

  const widgetsList: any[] = [];

  // Text paragraph widget
  widgetsList.push({
    textParagraph: {
      text: bodyText.replace(/\n/g, "<br>"),
    },
  });

  // Action button widget if actionUrl provided
  if (actionUrl) {
    widgetsList.push({
      buttonList: {
        buttons: [
          {
            text: actionText || "LIHAT DI APLIKASI",
            onClick: {
              openLink: {
                url: actionUrl,
              },
            },
            color: {
              red: 0.95,
              green: 0.55,
              blue: 0.1,
              alpha: 1,
            },
          },
        ],
      },
    });
  }

  const allSections = [
    {
      widgets: widgetsList,
    },
    ...sections,
  ];

  const cardV2 = {
    cardId: `wbk_${Date.now()}`,
    card: {
      header: {
        title: title || "WARUNG BANG KOBRA",
        subtitle: subtitle || "Sistem Notifikasi Otomatis",
        imageUrl:
          headerIcon ||
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=128&auto=format&fit=crop&q=80",
        imageType: "CIRCLE",
      },
      sections: allSections,
    },
  };

  return {
    text: bodyText,
    cardsV2: [cardV2],
  };
}

// Send to Google Chat with exponential retry
async function postToGoogleChat(webhookUrl: string, payload: any, maxRetries = 2): Promise<{ success: boolean; data?: any; error?: string }> {
  let attempt = 0;
  let lastError = "";

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const resText = await response.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch {
        resData = { raw: resText };
      }

      if (response.ok) {
        return { success: true, data: resData };
      } else {
        lastError = `Google Chat HTTP ${response.status}: ${resText.slice(0, 200)}`;
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    attempt++;
    if (attempt <= maxRetries) {
      const delayMs = attempt * 1000;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { success: false, error: lastError };
}

export function createGoogleChatRouter(): Router {
  const router = Router();

  // 1. GET /api/google-chat/config
  // Returns spaces with masked secrets and connection status
  router.get("/config", (_req, res) => {
    try {
      const vault = readVault();
      const maskedSpaces = vault.spaces.map((s) => ({
        ...s,
        webhookUrl: maskWebhookUrl(s.webhookUrl),
        isConfigured: Boolean(s.webhookUrl),
      }));

      const isAnyConnected = vault.spaces.some((s) => s.status === "CONNECTED" && Boolean(s.webhookUrl));

      return res.json({
        success: true,
        connectionStatus: isAnyConnected ? "CONNECTED" : "DISCONNECTED",
        spaces: maskedSpaces,
        defaultSpaceId: vault.defaultSpaceId,
        dailySummaryEnabled: vault.dailySummaryEnabled,
        dailySummaryTime: vault.dailySummaryTime,
        lastDailySummaryDate: vault.lastDailySummaryDate,
      });
    } catch (err: unknown) {
      console.error("Error getting Google Chat config:", err);
      return res.status(500).json({ success: false, message: "Gagal mengambil konfigurasi Google Chat" });
    }
  });

  // 2. POST /api/google-chat/spaces
  // Add or update a space. Validates URL and stores it securely on server
  router.post("/spaces", (req, res) => {
    try {
      const { id, name, spaceId, webhookUrl, isDefault, description, updatedBy } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({ success: false, message: "Nama Space wajib diisi" });
      }

      const vault = readVault();
      const existingIdx = vault.spaces.findIndex((s) => s.id === id);

      let finalWebhookUrl = "";
      if (webhookUrl && typeof webhookUrl === "string" && !webhookUrl.includes("••••")) {
        // Must be a valid HTTP/HTTPS URL
        try {
          const parsed = new URL(webhookUrl);
          if (!parsed.protocol.startsWith("http")) {
            return res.status(400).json({ success: false, message: "URL Webhook harus menggunakan protokol https://" });
          }
          finalWebhookUrl = webhookUrl.trim();
        } catch {
          return res.status(400).json({ success: false, message: "Format URL Webhook tidak valid" });
        }
      } else if (existingIdx >= 0) {
        // Keep existing secret if masked was sent back
        finalWebhookUrl = vault.spaces[existingIdx].webhookUrl;
      }

      const targetId = id || `space-${Date.now()}`;
      const now = new Date().toISOString();

      if (isDefault) {
        vault.spaces.forEach((s) => (s.isDefault = false));
        vault.defaultSpaceId = targetId;
      }

      const spaceObj: VaultSpace = {
        id: targetId,
        name: name.trim(),
        spaceId: spaceId || `spaces/${targetId}`,
        webhookUrl: finalWebhookUrl,
        isDefault: Boolean(isDefault || vault.spaces.length === 0),
        status: finalWebhookUrl ? "CONNECTED" : "DISCONNECTED",
        description: description || "",
        createdAt: existingIdx >= 0 ? vault.spaces[existingIdx].createdAt : now,
        updatedAt: now,
        createdBy: existingIdx >= 0 ? vault.spaces[existingIdx].createdBy : updatedBy || "Owner",
        updatedBy: updatedBy || "Owner",
      };

      if (existingIdx >= 0) {
        vault.spaces[existingIdx] = spaceObj;
      } else {
        vault.spaces.push(spaceObj);
      }

      if (spaceObj.isDefault) {
        vault.defaultSpaceId = spaceObj.id;
      }

      writeVault(vault);

      return res.json({
        success: true,
        message: "Ruang Google Chat berhasil disimpan",
        space: {
          ...spaceObj,
          webhookUrl: maskWebhookUrl(spaceObj.webhookUrl),
          isConfigured: Boolean(spaceObj.webhookUrl),
        },
      });
    } catch (err: unknown) {
      console.error("Error saving Google Chat space:", err);
      return res.status(500).json({ success: false, message: "Gagal menyimpan ruang Google Chat" });
    }
  });

  // 3. DELETE /api/google-chat/spaces/:id
  router.delete("/spaces/:id", (req, res) => {
    try {
      const { id } = req.params;
      const vault = readVault();
      vault.spaces = vault.spaces.filter((s) => s.id !== id);

      if (vault.defaultSpaceId === id) {
        vault.defaultSpaceId = vault.spaces[0]?.id || "";
        if (vault.spaces[0]) vault.spaces[0].isDefault = true;
      }

      writeVault(vault);
      return res.json({ success: true, message: "Ruang Google Chat berhasil dihapus" });
    } catch (err: unknown) {
      console.error("Error deleting Google Chat space:", err);
      return res.status(500).json({ success: false, message: "Gagal menghapus ruang Google Chat" });
    }
  });

  // 4. POST /api/google-chat/test-connection
  // Sends a verified test ping card to Google Chat
  router.post("/test-connection", async (req, res) => {
    try {
      const { spaceId, webhookUrl } = req.body;
      const vault = readVault();

      let targetUrl = "";
      let targetSpaceName = "Ruang Google Chat";

      if (webhookUrl && typeof webhookUrl === "string" && !webhookUrl.includes("••••")) {
        targetUrl = webhookUrl.trim();
      } else if (spaceId) {
        const found = vault.spaces.find((s) => s.id === spaceId);
        if (found) {
          targetUrl = found.webhookUrl;
          targetSpaceName = found.name;
        }
      } else if (vault.defaultSpaceId) {
        const found = vault.spaces.find((s) => s.id === vault.defaultSpaceId);
        if (found) {
          targetUrl = found.webhookUrl;
          targetSpaceName = found.name;
        }
      }

      if (!targetUrl) {
        return res.status(400).json({
          success: false,
          message: "URL Webhook Google Chat belum dikonfigurasi. Masukkan Webhook URL terlebih dahulu.",
        });
      }

      const nowStr = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "full",
        timeStyle: "medium",
      });

      const testPayload = buildGoogleChatPayload({
        title: "✅ TEST KONEKSI GOOGLE CHAT",
        subtitle: "WARUNG BANG KOBRA — POS & MANAGEMENT SYSTEM",
        bodyText: `<b>STATUS KONEKSI: TERHUBUNG</b>\n\nSelamat! Webhook Google Chat untuk <b>${targetSpaceName}</b> telah berhasil terhubung dengan sistem Warung Bang Kobra.\n\nWaktu Tes: ${nowStr}\nSistem: Siap menerima notifikasi otomatis (Pesanan baru, Delivery DQM, PO Acara, Stok, dan Laporan Harian).`,
        actionText: "BUKA DASHBOARD TOKO",
        actionUrl: req.headers.origin || "https://warung-bang-kobra.web.app",
      });

      const sendResult = await postToGoogleChat(targetUrl, testPayload);

      // Update space test timestamp if matched
      if (spaceId) {
        const space = vault.spaces.find((s) => s.id === spaceId);
        if (space) {
          space.lastTestedAt = new Date().toISOString();
          space.status = sendResult.success ? "CONNECTED" : "ERROR";
          writeVault(vault);
        }
      }

      if (sendResult.success) {
        return res.json({
          success: true,
          message: "Koneksi berhasil! Pesan tes telah dikirimkan ke ruang Google Chat.",
          response: sendResult.data,
        });
      } else {
        return res.status(502).json({
          success: false,
          message: `Gagal mengirim ke Google Chat: ${sendResult.error}`,
        });
      }
    } catch (err: unknown) {
      console.error("Test connection error:", err);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan internal saat mencoba tes koneksi.",
      });
    }
  });

  // 5. POST /api/google-chat/disconnect
  router.post("/disconnect", (req, res) => {
    try {
      const { spaceId } = req.body;
      const vault = readVault();

      if (spaceId) {
        const target = vault.spaces.find((s) => s.id === spaceId);
        if (target) {
          target.status = "DISCONNECTED";
          target.webhookUrl = "";
        }
      } else {
        vault.spaces.forEach((s) => {
          s.status = "DISCONNECTED";
          s.webhookUrl = "";
        });
      }

      writeVault(vault);
      return res.json({
        success: true,
        message: "Koneksi Google Chat berhasil diputuskan.",
      });
    } catch (err: unknown) {
      console.error("Disconnect error:", err);
      return res.status(500).json({ success: false, message: "Gagal memutuskan koneksi." });
    }
  });

  // 6. POST /api/google-chat/send
  // Main notification sender with strict Idempotency
  router.post("/send", async (req, res) => {
    try {
      const {
        eventId,
        notificationType,
        spaceId,
        referenceId,
        title,
        customText,
        templateVariables,
        actionUrl,
        actionText,
      } = req.body;

      if (!notificationType) {
        return res.status(400).json({ success: false, message: "notificationType wajib diisi" });
      }

      // Idempotency verification: prevent duplicates from refresh, retry, or multiple listeners
      const idempotencyKey = eventId || `${referenceId || Date.now()}_${notificationType}`;
      if (processedEventIds.has(idempotencyKey)) {
        return res.json({
          success: true,
          duplicated: true,
          eventId: idempotencyKey,
          message: "Pesan notifikasi sudah pernah dikirim sebelumnya (Anti-Duplikasi).",
        });
      }

      const vault = readVault();
      let targetSpace = vault.spaces.find((s) => s.id === spaceId);
      if (!targetSpace) {
        targetSpace = vault.spaces.find((s) => s.id === vault.defaultSpaceId) || vault.spaces[0];
      }

      if (!targetSpace || !targetSpace.webhookUrl) {
        return res.status(200).json({
          success: false,
          status: "FAILED",
          error: "Webhook Google Chat belum dikonfigurasi.",
          message: "Pesanan tersimpan, namun Google Chat belum terhubung.",
        });
      }

      // Format notification text based on notificationType
      let formattedText = customText || "";
      let headerTitle = title || "NOTIFIKASI WARUNG BANG KOBRA";

      if (!formattedText && templateVariables) {
        const v = templateVariables;
        switch (notificationType) {
          case "ORDER_NEW":
            headerTitle = "🔔 PESANAN BARU — WARUNG BANG KOBRA";
            formattedText = `🔔 *PESANAN BARU*\n*WARUNG BANG KOBRA*\n\n<b>Nomor Pesanan:</b> ${v.orderNumber || "-"}\n<b>Nama Pelanggan:</b> ${v.customerName || "-"}\n<b>No. WhatsApp:</b> ${v.phone || "-"}\n<b>Jenis Pesanan:</b> ${v.orderType || "TAKEAWAY"}\n<b>Alamat:</b> ${v.address || "-"}\n\n<b>Daftar Pesanan:</b>\n${v.items || "-"}\n\n<b>Total:</b> ${v.total || "Rp0"}\n<b>Metode Pembayaran:</b> ${v.paymentMethod || "CASH"}\n<b>Status:</b> ${v.status || "MENUNGGU KONFIRMASI"}\n<b>Waktu:</b> ${v.createdAt || new Date().toLocaleString("id-ID")}`;
            break;

          case "ORDER_DELIVERY":
            headerTitle = "🚚 DELIVERY BARU — WARUNG BANG KOBRA";
            formattedText = `🚚 *DELIVERY BARU*\n\n<b>Nomor:</b> ${v.orderNumber || "-"}\n<b>Pelanggan:</b> ${v.customerName || "-"}\n<b>WhatsApp:</b> ${v.phone || "-"}\n<b>Alamat:</b> ${v.address || "-"}\n<b>Total:</b> ${v.total || "Rp0"}\n<b>Minimal delivery:</b> Rp20.000\n<b>Status:</b> ${v.status || "MENUNGGU DIPROSES"}`;
            break;

          case "ORDER_PO":
            headerTitle = "🎉 PO / PESANAN ACARA BARU — WARUNG BANG KOBRA";
            formattedText = `🎉 *PO / PESANAN ACARA BARU*\n\n<b>Nomor PO:</b> ${v.poNumber || v.orderNumber || "-"}\n<b>Nama Pemesan:</b> ${v.customerName || "-"}\n<b>Tanggal Acara:</b> ${v.eventDate || "-"}\n<b>Waktu:</b> ${v.createdAt || "-"}\n<b>Jumlah Pesanan:</b> ${v.items || "-"}\n<b>Total:</b> ${v.total || "Rp0"}\n<b>Catatan:</b> ${v.notes || "-"}\n<b>Status:</b> ${v.status || "MENUNGGU KONFIRMASI"}`;
            break;

          case "STOCK_LOW":
            headerTitle = "⚠️ STOK MENIPIS — WARUNG BANG KOBRA";
            formattedText = `⚠️ *STOK MENIPIS*\n\n<b>Produk:</b> ${v.productName || "-"}\n<b>Stok:</b> ${v.stock || "0"}\n<b>Minimum:</b> ${v.minStock || "5"}\n<b>Status:</b> SEGERA RESTOCK`;
            break;

          case "STOCK_OUT":
            headerTitle = "🚨 PRODUK HABIS — WARUNG BANG KOBRA";
            formattedText = `🚨 *PRODUK HABIS*\n\n<b>Produk:</b> ${v.productName || "-"}\n<b>Stok:</b> 0\n<b>Status:</b> OUT OF STOCK`;
            break;

          case "DAILY_SUMMARY":
            headerTitle = "📊 LAPORAN HARIAN — WARUNG BANG KOBRA";
            formattedText = `📊 *LAPORAN HARIAN*\n*WARUNG BANG KOBRA*\n\n<b>Tanggal:</b> ${v.date || "-"}\n<b>Total Transaksi:</b> ${v.totalTransactions || "0"}\n<b>Total Penjualan:</b> ${v.totalSales || "Rp0"}\n<b>Cash:</b> ${v.cashSales || "Rp0"}\n<b>Transfer:</b> ${v.transferSales || "Rp0"}\n<b>QRIS:</b> ${v.qrisSales || "Rp0"}\n<b>E-Wallet:</b> ${v.ewalletSales || "Rp0"}\n<b>Delivery:</b> ${v.deliveryCount || "0"}\n<b>Takeaway:</b> ${v.takeawayCount || "0"}\n<b>PO:</b> ${v.poCount || "0"}\n<b>Pengeluaran:</b> ${v.totalExpense || "Rp0"}\n<b>Estimasi Laba:</b> ${v.estimatedProfit || "Rp0"}\n<b>Produk Terlaris:</b> ${v.topProduct || "-"}`;
            break;

          case "EXPENSE_NEW":
            headerTitle = "💸 PENGELUARAN BARU — WARUNG BANG KOBRA";
            formattedText = `💸 *PENGELUARAN BARU*\n\n<b>Kategori:</b> ${v.category || "Operasional"}\n<b>Keterangan:</b> ${v.description || "-"}\n<b>Jumlah:</b> ${v.amount || "Rp0"}\n<b>Dicatat Oleh:</b> ${v.user || "Staf"}\n<b>Waktu:</b> ${v.createdAt || "-"}`;
            break;

          case "PAYMENT_SUCCESS":
            headerTitle = "💰 PEMBAYARAN BERHASIL — WARUNG BANG KOBRA";
            formattedText = `💰 *PEMBAYARAN BERHASIL*\n\n<b>Nomor Pesanan:</b> ${v.orderNumber || "-"}\n<b>Pelanggan:</b> ${v.customerName || "-"}\n<b>Metode:</b> ${v.paymentMethod || "QRIS"}\n<b>Total:</b> ${v.total || "Rp0"}\n<b>Waktu:</b> ${v.createdAt || "-"}`;
            break;

          case "ORDER_COMPLETED":
            headerTitle = "✅ PESANAN SELESAI — WARUNG BANG KOBRA";
            formattedText = `✅ *PESANAN SELESAI*\n\n<b>Nomor Pesanan:</b> ${v.orderNumber || "-"}\n<b>Pelanggan:</b> ${v.customerName || "-"}\n<b>Total:</b> ${v.total || "Rp0"}\n<b>Status:</b> SELESAI`;
            break;

          case "ORDER_CANCELLED":
            headerTitle = "❌ PESANAN DIBATALKAN — WARUNG BANG KOBRA";
            formattedText = `❌ *PESANAN DIBATALKAN*\n\n<b>Nomor Pesanan:</b> ${v.orderNumber || "-"}\n<b>Pelanggan:</b> ${v.customerName || "-"}\n<b>Alasan:</b> ${v.reason || "Dibatalkan oleh kasir/pelanggan"}`;
            break;

          case "SECURITY_ALERT":
            headerTitle = "🔒 PERINGATAN KEAMANAN — WARUNG BANG KOBRA";
            formattedText = `🔒 *PERINGATAN KEAMANAN*\n\n<b>Aktivitas:</b> ${v.activity || "Login terdeteksi"}\n<b>Pengguna:</b> ${v.user || "-"}\n<b>IP/Perangkat:</b> ${v.device || "-"}\n<b>Waktu:</b> ${v.timestamp || "-"}`;
            break;

          case "SYSTEM_ERROR":
            headerTitle = "⚠️ ERROR SISTEM PENTING — WARUNG BANG KOBRA";
            formattedText = `⚠️ *ERROR SISTEM PENTING*\n\n<b>Modul:</b> ${v.module || "Sistem"}\n<b>Pesan Error:</b> ${v.errorMessage || "-"}\n<b>Waktu:</b> ${v.timestamp || "-"}`;
            break;

          default:
            formattedText = `📢 *NOTIFIKASI WARUNG BANG KOBRA*\n\n${JSON.stringify(v, null, 2)}`;
        }
      }

      const payload = buildGoogleChatPayload({
        title: headerTitle,
        subtitle: `Space: ${targetSpace.name}`,
        bodyText: formattedText,
        actionText: actionText || "BUKA DETAIL PESANAN",
        actionUrl: actionUrl || req.headers.origin || "https://warung-bang-kobra.web.app",
      });

      const sendResult = await postToGoogleChat(targetSpace.webhookUrl, payload);

      if (sendResult.success) {
        // Mark as processed in idempotency tracker
        persistEventId(idempotencyKey);

        return res.json({
          success: true,
          status: "SENT",
          eventId: idempotencyKey,
          spaceId: targetSpace.id,
          spaceName: targetSpace.name,
          message: "Notifikasi Google Chat berhasil dikirim.",
          response: sendResult.data,
        });
      } else {
        // Record failure without crashing the client order
        return res.json({
          success: false,
          status: "FAILED",
          eventId: idempotencyKey,
          spaceId: targetSpace.id,
          spaceName: targetSpace.name,
          error: sendResult.error,
          message: "Pesanan berhasil dibuat, tetapi notifikasi Google Chat sedang menunggu pengiriman.",
        });
      }
    } catch (err: unknown) {
      console.error("Error sending Google Chat notification:", err);
      return res.status(200).json({
        success: false,
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        message: "Pesanan berhasil dibuat, tetapi notifikasi Google Chat sedang menunggu pengiriman.",
      });
    }
  });

  // 7. POST /api/google-chat/retry/:logId
  router.post("/retry/:logId", async (req, res) => {
    try {
      const { webhookUrl, messageText, title, spaceId } = req.body;
      const vault = readVault();

      let targetUrl = webhookUrl;
      if (!targetUrl || targetUrl.includes("••••")) {
        const found = vault.spaces.find((s) => s.id === spaceId) || vault.spaces[0];
        if (found) targetUrl = found.webhookUrl;
      }

      if (!targetUrl) {
        return res.status(400).json({ success: false, message: "URL Webhook tidak ditemukan" });
      }

      const payload = buildGoogleChatPayload({
        title: title || "🔄 NOTIFIKASI DIKIRIM ULANG",
        bodyText: messageText || "Pesan kirim ulang",
        actionUrl: req.headers.origin || "https://warung-bang-kobra.web.app",
      });

      const sendResult = await postToGoogleChat(targetUrl, payload);

      return res.json({
        success: sendResult.success,
        status: sendResult.success ? "SENT" : "FAILED",
        error: sendResult.error,
        message: sendResult.success ? "Kirim ulang berhasil!" : `Gagal: ${sendResult.error}`,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
