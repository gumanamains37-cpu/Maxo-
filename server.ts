import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI server-side with required User-Agent headers
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Astrology Search Grounding API Route
app.post("/api/astrology/verify", async (req, res) => {
  const { queryText } = req.body;
  if (!queryText || typeof queryText !== "string") {
    return res.status(400).json({ error: "Missing or invalid queryText parameter" });
  }

  try {
    console.log(`[AstrologyGrounding] Grounding query for: "${queryText}"`);

    const prompt = `You are an elite cosmic astrologer. Analyze, verify, and explain the current horoscope trends, stellar facts, or element compatibility for: "${queryText}". 
Use Google Search grounding to retrieve actual accurate star maps, cosmic transits, or today's trending astrological data. 
Provide a detailed, elegant, inspirational, and grounded reading.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // Extract grounding metadata safely
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null;
    const responseText = response.text || "Starlight coordinates is currently fluctuating. Try aligning your focus in a moment.";

    return res.json({
      text: responseText,
      metadata: groundingMetadata
    });
  } catch (error: any) {
    console.error("[AstrologyGrounding] Error querying Gemini Grounding:", error);
    return res.status(500).json({
      error: "Failed to align celestial coordinates via Gemini Search Grounding",
      details: error.message || error
    });
  }
});

// API health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "VoiceStar Cosmic Engine" });
});

async function startServer() {
  // Vite dev or production static server setup
  if (process.env.NODE_ENV !== "production") {
    console.log("[VoiceStar Server] Mounting Vite Dev Server Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[VoiceStar Server] Serving Static Production Build Assets...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VoiceStar Server] Running full-stack on http://0.0.0.0:${PORT}`);
  });
}

startServer();
