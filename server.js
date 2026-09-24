require("dotenv").config();
const path = require("path");

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const appointmentRoutes = require("./appointment-routes");

const app = express();
const PORT = Number(process.env.PORT || 3001);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const SITE_URL = process.env.SITE_URL || "https://tahsinullahriyad.world";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);
const TEMPERATURE = Number(process.env.TEMPERATURE || 0.7);
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 1200);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "64kb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: RATE_LIMIT_PER_MINUTE,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." }
});
app.use("/api/chat", limiter);

const appointmentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.APPOINTMENT_RATE_LIMIT || 8),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many appointment requests. Please try again later." }
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Tahsinullah Riyad Custom AI",
    model: OPENROUTER_MODEL
  });
});

app.get("/appointment", (_req, res) => {
  res.sendFile(path.join(__dirname, "appointment.html"));
});

appointmentRoutes.routes(app, appointmentLimiter);

app.post("/api/chat", async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured." });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) {
    return res.status(400).json({ error: "messages array is required." });
  }

  const cleanMessages = messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-30)
    .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));

  if (!cleanMessages.length) {
    return res.status(400).json({ error: "No valid messages supplied." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-Title": "Tahsinullah Riyad Custom AI"
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content: "You are Tahsinullah Riyad's helpful AI assistant. Answer clearly and accurately. If a user wants to book an appointment, tell them to use the Book button and never claim a booking is confirmed unless the booking system confirms it."
          },
          ...cleanMessages
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ error: body || "OpenRouter request failed." });
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    if (!response.body) {
      return res.end();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      clearTimeout(timeout);
      res.end();
    }
  } catch (error) {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(error?.name === "AbortError" ? 504 : 500).json({
        error: error?.name === "AbortError" ? "OpenRouter request timed out." : "AI request failed."
      });
    } else {
      res.end();
    }
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`AI backend running on port ${PORT}`);
  console.log(`Model: ${OPENROUTER_MODEL}`);
});