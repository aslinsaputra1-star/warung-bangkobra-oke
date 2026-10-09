import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createGoogleChatRouter } from "./serverGoogleChat.ts";
import { createMaintenanceRouter } from "./serverMaintenance.ts";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware JSON body parser
  app.use(express.json({ limit: "15mb" }));

  // ==========================================
  // 1. API ROUTES (Backend Proxy untuk Google Apps Script & Health Check)
  // ==========================================

  // Endpoint Health Check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "Warung Bang Kobra POS API",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).send("OK");
  });

  // Google Chat Integration API
  app.use("/api/google-chat", createGoogleChatRouter());

  // Maintenance & System Health API
  app.use("/api/maintenance", createMaintenanceRouter());

  // Endpoint Proxy Sinkronisasi Google Sheets (Menghindari masalah CORS di Browser)
  app.post("/api/sync/proxy", async (req, res) => {
    try {
      const { scriptUrl, payload } = req.body;

      if (!scriptUrl || typeof scriptUrl !== "string") {
        return res.status(400).json({
          success: false,
          message: "URL Google Apps Script belum dikonfigurasi",
        });
      }

      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
        redirect: "follow",
      });

      const textResult = await response.text();
      let jsonResult;
      try {
        jsonResult = JSON.parse(textResult);
      } catch {
        jsonResult = { raw: textResult, status: response.status };
      }

      return res.json({
        success: response.ok,
        status: response.status,
        data: jsonResult,
      });
    } catch (error: unknown) {
      const errMessage =
        error instanceof Error ? error.message : "Unknown proxy error";
      console.error("Google Sheets Proxy Error:", errMessage);
      return res.status(500).json({
        success: false,
        message: "Koneksi ke server bermasalah. Silakan coba lagi.",
      });
    }
  });

  // Endpoint Server-Side Gemini Image Generation
  app.post("/api/ai/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({
          success: false,
          message: "Prompt deskripsi gambar wajib diisi",
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(200).json({
          success: false,
          fallback: true,
          message: "Layanan gambar AI menggunakan pratinjau lokal.",
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      let base64Image = "";
      let mimeType = "image/png";

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Image = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }

      if (!base64Image) {
        return res.status(200).json({
          success: false,
          fallback: true,
          message: "Menggunakan ilustrasi standar.",
        });
      }

      return res.json({
        success: true,
        dataUrl: `data:${mimeType};base64,${base64Image}`,
      });
    } catch (error: unknown) {
      console.warn("AI Image Generation Notice:", error);
      return res.status(200).json({
        success: false,
        fallback: true,
        message: "Menggunakan ilustrasi standar.",
      });
    }
  });

  // ==========================================
  // 2. VITE MIDDLEWARE / STATIC ASSETS
  // ==========================================
  const distPath = path.join(process.cwd(), "dist");
  const isProduction =
    process.env.NODE_ENV === "production" ||
    fs.existsSync(path.join(distPath, "index.html"));

  if (isProduction) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server Warung Bang Kobra POS berjalan di port ${PORT}`);
  });
}

startServer();
