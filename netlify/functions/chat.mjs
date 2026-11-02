const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
const MAX_BODY = 64 * 1024;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 12000;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) return json({ error: "Origin not allowed." }, 403);
    } catch { return json({ error: "Invalid origin." }, 403); }
  }
  const apiKey = Netlify.env.get("VENICE_API_KEY");
  const model = Netlify.env.get("VENICE_MODEL") || "venice-uncensored";
  if (!apiKey) return json({ error: "AI service is not configured. Add VENICE_API_KEY in Netlify environment variables." }, 503);

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) return json({ error: "Request is too large." }, 413);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!Array.isArray(payload?.messages) || payload.messages.length < 1 || payload.messages.length > MAX_MESSAGES) {
    return json({ error: "Send between 1 and 30 messages." }, 400);
  }
  const clean = [];
  for (const message of payload.messages) {
    if (!message || !ALLOWED_ROLES.has(message.role) || typeof message.content !== "string") {
      return json({ error: "Invalid message format." }, 400);
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) return json({ error: "Each message must be 1–12,000 characters." }, 400);
    clean.push({ role: message.role, content });
  }
  if (clean[clean.length - 1].role !== "user") return json({ error: "The last message must be from the user." }, 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 52000);
  try {
    const upstream = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "authorization": "Bearer " + apiKey, "content-type": "application/json", "accept": "text/event-stream" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: "You are Riyad AI. Be useful, clear, honest, and concise. Do not claim to have performed actions you did not perform." }, ...clean],
        temperature: 0.7,
        max_tokens: 1600,
        stream: true
      }),
      signal: controller.signal
    });
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return json({ error: status === 429 ? "AI provider rate limit reached. Try again shortly." : "AI provider request failed." }, status);
    }
    if (!upstream.body) return json({ error: "AI provider returned no response stream." }, 502);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-cache, no-transform",
        "x-content-type-options": "nosniff",
        "x-accel-buffering": "no"
      }
    });
  } catch (error) {
    return json({ error: error?.name === "AbortError" ? "AI provider timed out." : "Unable to reach the AI provider." }, error?.name === "AbortError" ? 504 : 502);
  } finally { clearTimeout(timeout); }
}

export const config = {
  path: "/api/chat",
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 12 }
};