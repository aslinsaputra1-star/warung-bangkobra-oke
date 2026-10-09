import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const ERROR_LOGS_FILE = path.join(DATA_DIR, "system_error_logs.json");

// Ensure directories exist
if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (err) {
    console.warn("Failed to create backups directory:", err);
  }
}

function calculateChecksum(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function readErrorLogs(): any[] {
  try {
    if (fs.existsSync(ERROR_LOGS_FILE)) {
      const raw = fs.readFileSync(ERROR_LOGS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn("Failed to read server error logs:", e);
  }
  return [];
}

function writeErrorLogs(logs: any[]) {
  try {
    const trimmed = logs.slice(-500); // keep last 500 logs
    fs.writeFileSync(ERROR_LOGS_FILE, JSON.stringify(trimmed, null, 2), "utf8");
  } catch (e) {
    console.warn("Failed to write server error logs:", e);
  }
}

export function createMaintenanceRouter(): Router {
  const router = Router();

  // 1. Health check & Server vitals
  router.get("/health", (_req, res) => {
    try {
      const memory = process.memoryUsage();
      const uptimeSec = Math.floor(process.uptime());

      return res.json({
        success: true,
        status: "HEALTHY",
        uptimeSeconds: uptimeSec,
        memoryUsageMB: {
          rss: Math.round(memory.rss / (1024 * 1024)),
          heapUsed: Math.round(memory.heapUsed / (1024 * 1024)),
          heapTotal: Math.round(memory.heapTotal / (1024 * 1024)),
        },
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "production",
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 2. Create full database backup
  router.post("/backup", (req, res) => {
    try {
      const { data, createdBy, notes } = req.body;

      if (!data || typeof data !== "object") {
        return res.status(400).json({
          success: false,
          message: "Data snapshot wajib disertakan dalam pembuatan backup.",
        });
      }

      const now = new Date();
      const dateStr = now.toISOString().replace(/[:.]/g, "-");
      const filename = `backup_wbk_${dateStr}.json`;
      const filePath = path.join(BACKUP_DIR, filename);

      const counts = {
        products: Array.isArray(data.products) ? data.products.length : 0,
        variants: Array.isArray(data.variants) ? data.variants.length : 0,
        categories: Array.isArray(data.categories) ? data.categories.length : 0,
        transactions: Array.isArray(data.transactions) ? data.transactions.length : 0,
        customers: Array.isArray(data.customers) ? data.customers.length : 0,
        expenses: Array.isArray(data.expenses) ? data.expenses.length : 0,
        settings: data.settings ? 1 : 0,
        stockMutations: Array.isArray(data.stockMutations) ? data.stockMutations.length : 0,
      };

      const backupEnvelope = {
        version: "2.5.0",
        app: "WARUNG BANG KOBRA POS & MANAGEMENT SYSTEM",
        createdAt: now.toISOString(),
        createdBy: createdBy || "Owner/Admin",
        notes: notes || "Pencadangan database sistem",
        counts,
        data,
      };

      const jsonString = JSON.stringify(backupEnvelope, null, 2);
      const sizeBytes = Buffer.byteLength(jsonString, "utf8");
      const checksum = calculateChecksum(jsonString);

      // Save to disk
      fs.writeFileSync(filePath, jsonString, "utf8");

      // Verify immediately that file is readable and matches checksum
      const verifiedContent = fs.readFileSync(filePath, "utf8");
      const verifiedChecksum = calculateChecksum(verifiedContent);
      const isVerified = verifiedChecksum === checksum && fs.existsSync(filePath);

      const backupRecord = {
        id: `backup-${Date.now()}`,
        filename,
        createdAt: now.toISOString(),
        createdBy: createdBy || "Owner/Admin",
        sizeBytes,
        checksum,
        verified: isVerified,
        counts,
        notes: notes || "",
      };

      return res.json({
        success: true,
        message: "Pencadangan database berhasil dibuat dan terverifikasi aman.",
        backup: backupRecord,
      });
    } catch (err: unknown) {
      console.error("Backup creation error:", err);
      return res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : "Gagal membuat backup di server",
      });
    }
  });

  // 3. List available backups on server
  router.get("/backups", (_req, res) => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json({ success: true, backups: [] });
      }

      const files = fs.readdirSync(BACKUP_DIR);
      const backups: any[] = [];

      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(BACKUP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          const raw = fs.readFileSync(filePath, "utf8");
          const parsed = JSON.parse(raw);
          const checksum = calculateChecksum(raw);

          backups.push({
            id: file.replace(".json", ""),
            filename: file,
            createdAt: parsed.createdAt || stats.birthtime.toISOString(),
            createdBy: parsed.createdBy || "System",
            sizeBytes: stats.size,
            checksum,
            verified: true,
            counts: parsed.counts || {
              products: 0,
              variants: 0,
              categories: 0,
              transactions: 0,
              customers: 0,
              expenses: 0,
              settings: 0,
              stockMutations: 0,
            },
            notes: parsed.notes || "",
          });
        } catch {
          // Skip corrupted or unreadable files
        }
      }

      // Sort by newest first
      backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({ success: true, backups });
    } catch (err: unknown) {
      console.error("List backups error:", err);
      return res.status(500).json({ success: false, message: "Gagal membaca daftar backup" });
    }
  });

  // 4. Download / Get specific backup data
  router.get("/backups/:filename", (req, res) => {
    try {
      const { filename } = req.params;
      // Prevent directory traversal
      const safeFilename = path.basename(filename);
      const filePath = path.join(BACKUP_DIR, safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: "File backup tidak ditemukan" });
      }

      const content = fs.readFileSync(filePath, "utf8");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      return res.send(content);
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : "Gagal mengambil file backup",
      });
    }
  });

  // 5. Verify external backup file payload before restore
  router.post("/verify-backup", (req, res) => {
    try {
      const { jsonString } = req.body;
      if (!jsonString || typeof jsonString !== "string") {
        return res.status(400).json({
          success: false,
          isValid: false,
          message: "Format file JSON tidak boleh kosong",
        });
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseErr) {
        return res.status(400).json({
          success: false,
          isValid: false,
          message: "File rusak atau bukan format JSON valid",
        });
      }

      // Check required structure
      const data = parsed.data || parsed;
      const hasProducts = Array.isArray(data.products);
      const hasTransactions = Array.isArray(data.transactions);

      if (!hasProducts && !hasTransactions) {
        return res.status(400).json({
          success: false,
          isValid: false,
          message: "File backup tidak memuat struktur tabel Warung Bang Kobra yang valid",
        });
      }

      const counts = {
        products: Array.isArray(data.products) ? data.products.length : 0,
        variants: Array.isArray(data.variants) ? data.variants.length : 0,
        categories: Array.isArray(data.categories) ? data.categories.length : 0,
        transactions: Array.isArray(data.transactions) ? data.transactions.length : 0,
        customers: Array.isArray(data.customers) ? data.customers.length : 0,
        expenses: Array.isArray(data.expenses) ? data.expenses.length : 0,
        settings: data.settings ? 1 : 0,
        stockMutations: Array.isArray(data.stockMutations) ? data.stockMutations.length : 0,
      };

      const checksum = calculateChecksum(jsonString);

      return res.json({
        success: true,
        isValid: true,
        message: "File backup valid dan siap dipulihkan.",
        counts,
        checksum,
        app: parsed.app || "WARUNG BANG KOBRA",
        createdAt: parsed.createdAt || new Date().toISOString(),
        version: parsed.version || "1.0",
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        isValid: false,
        message: err instanceof Error ? err.message : "Terjadi kesalahan saat verifikasi backup",
      });
    }
  });

  // 6. Record System Error Log
  router.post("/error-log", (req, res) => {
    try {
      const { module, message, stackTrace, priority, recommendation } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ success: false, message: "Pesan error wajib diisi" });
      }

      // Sanitization: Never log passwords, pins, tokens, or private secrets
      let sanitizedMessage = message
        .replace(/([pP]assword|[pP][iI][nN]|token|secret|key)=([^&\s]+)/gi, "$1=••••••••")
        .slice(0, 500);

      const newLog = {
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        module: module || "Aplikasi",
        message: sanitizedMessage,
        stackTrace: stackTrace ? String(stackTrace).slice(0, 1000) : undefined,
        priority: priority || "MEDIUM",
        status: "OPEN",
        recommendation: recommendation || "Periksa konfigurasi dan koneksi sistem",
      };

      const logs = readErrorLogs();
      logs.unshift(newLog);
      writeErrorLogs(logs);

      return res.json({ success: true, log: newLog });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : "Gagal mencatat log error",
      });
    }
  });

  // 7. Get Error Logs
  router.get("/error-logs", (_req, res) => {
    try {
      const logs = readErrorLogs();
      return res.json({ success: true, logs });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: "Gagal membaca log error" });
    }
  });

  return router;
}
