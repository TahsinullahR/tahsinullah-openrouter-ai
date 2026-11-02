const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" }
});

const MAX_BODY = 64 * 1024;
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 12000;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

export async function openRouterChat(request, { systemPrompt, maxTokens = 3000, modelEnv = "OPENROUTER_MODEL" }) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ error: "Origin not allowed." }, 403);
    } catch {
      return json({ error: "Invalid origin." }, 403);
    }
  }

  const apiKey = Netlify.env.get("OPENROUTER_API_KEY");
  const model = Netlify.env.get(modelEnv) || Netlify.env.get("OPENROUTER_MODEL") || "openrouter/free";
  if (!apiKey) {
    return json({ error: "OpenRouter is not configured. Add OPENROUTER_API_KEY in Netlify environment variables." }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY) return json({ error: "Request is too large." }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  if (!Array.isArray(payload?.messages) || payload.messages.length < 1 || payload.messages.length > MAX_MESSAGES) {
    return json({ error: "Send between 1 and 24 messages." }, 400);
  }

  const messages = [];
  for (const message of payload.messages) {
    if (!message || !ALLOWED_ROLES.has(message.role) || typeof message.content !== "string") {
      return json({ error: "Invalid message format." }, 400);
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) {
      return json({ error: "Each message must be 1–12,000 characters." }, 400);
    }
    messages.push({ role: message.role, content });
  }

  if (messages[messages.length - 1].role !== "user") {
    return json({ error: "The last message must be from the user." }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 52000);

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": "Bearer " + apiKey,
        "content-type": "application/json",
        "accept": "text/event-stream",
        "http-referer": "https://riyad-ai-studio.netlify.app",
        "x-title": "Riyad AI Studio"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: maxTokens,
        stream: true
      }),
      signal: controller.signal
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return json({ error: "OpenRouter free-model limit reached. Try again later or check your OpenRouter usage." }, 429);
      if (upstream.status === 401) return json({ error: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in Netlify." }, 502);
      return json({ error: "OpenRouter request failed. Check model availability and your OpenRouter account." }, 502);
    }

    if (!upstream.body) return json({ error: "OpenRouter returned no response stream." }, 502);
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
    const timedOut = error?.name === "AbortError";
    return json({ error: timedOut ? "The AI request timed out. Try again." : "Unable to reach OpenRouter." }, timedOut ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
}
