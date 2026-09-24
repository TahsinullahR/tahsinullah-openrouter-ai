require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const appointmentRoutes = require("./appointment-routes");

const app = express();
const PORT = Number(process.env.PORT || 3001);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const SITE_URL = process.env.SITE_URL || "https://tahsinullahriyad.world";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || SITE_URL)
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY");
  process.exit(1);
}

app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json({ limit: "64kb" }));app.get("/appointment", (_req, res) => { res.sendFile(path.join(__dirname, "appointment.html")); });

app.get("/", (_req, res) => {
  res.sendFile(require("path").join(__dirname, "frontend-widget.html"));
});

const appointmentLimiter = rateLimit({windowMs:10*60*1000,limit:Number(process.env.APPOINTMENT_RATE_LIMIT||8),standardHeaders:true,legacyHeaders:false,message:{error:"Too many booking attempts. Please try later."}});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." },
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Tahsinullah Riyad Custom AI",
    model: OPENROUTER_MODEL,
  });
});

appointmentRoutes.routes(app, appointmentLimiter);

app.post("/api/chat", limiter, async (req, res) => {
  try {
    const inputMessages = Array.isArray(req.body?.messages)
      ? req.body.messages
      : [];

    if (!inputMessages.length) {
      return res.status(400).json({ error: "messages is required" });
    }

    // Keep public requests bounded.
    const messages = inputMessages
      .slice(-20)
      .map((m) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: String(m?.content || "").slice(0, 12000),
      }))
      .filter((m) => m.content.trim());

    if (!messages.length) {
      return res.status(400).json({ error: "No valid messages supplied" });
    }

    const systemPrompt = `You are a helpful general-purpose AI assistant embedded on Tahsinullah Riyad's website.

Answer general questions across programming, technology, mathematics, science, education, writing, translation, research, business, productivity, and everyday topics.

You may also answer questions about Tahsinullah Riyad's portfolio, projects, skills, and services when the user asks about them. Do not force unrelated questions into the portfolio context.

Support Bangla, Banglish, and English. Prefer the language used by the user.

Be accurate and transparent. Do not invent personal or portfolio information. If you do not know something about Tahsinullah Riyad, say so.

When a question requires current information, do not claim it is current unless the application provides a verified web-search tool.`;

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.REQUEST_TIMEOUT_MS || 120000)
    );

    req.on("close", () => controller.abort());

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-Title": "Tahsinullah Riyad - Custom AI",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: Number(process.env.TEMPERATURE || 0.7),
        max_tokens: Number(process.env.MAX_TOKENS || 1200),
      }),
    });

    clearTimeout(timeout);

    if (!upstream.ok || !upstream.body) {
      const errorText = await upstream.text().catch(() => "");
      console.error("OpenRouter error:", upstream.status, errorText);
      res.write(`data: ${JSON.stringify({
        error: "AI provider request failed"
      })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } finally {
      reader.releaseLock();
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (error) {
    console.error("Chat error:", error);

    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }

    try {
      res.write(`data: ${JSON.stringify({
        error: "The AI request could not be completed."
      })}\n\n`);
      res.end();
    } catch {}
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(403).json({ error: err.message || "Request not allowed" });
  }
});

app.listen(PORT, () => {
  console.log(`AI backend running on port ${PORT}`);
  console.log(`Model: ${OPENROUTER_MODEL}`);
});




