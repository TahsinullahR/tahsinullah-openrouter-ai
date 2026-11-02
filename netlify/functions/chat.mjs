export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" }
    });
  }

  const apiKey = Netlify.env.get("VENICE_API_KEY");
  const model = Netlify.env.get("VENICE_MODEL") || "venice-uncensored";
  if (!apiKey) {
    return Response.json({ error: "VENICE_API_KEY is not configured in Netlify." }, { status: 503 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const cleanMessages = messages
    .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-30)
    .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
  if (!cleanMessages.length) {
    return Response.json({ error: "A non-empty messages array is required." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const upstream = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are Riyad AI, a helpful assistant. Answer clearly and accurately."
          },
          ...cleanMessages
        ],
        temperature: 0.7,
        max_tokens: 1200,
        stream: true
      }),
      signal: controller.signal
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return Response.json({ error: detail || "Venice AI request failed." }, { status: upstream.status });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform"
      }
    });
  } catch (error) {
    return Response.json({
      error: error?.name === "AbortError" ? "Venice AI request timed out." : "AI request failed."
    }, { status: error?.name === "AbortError" ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export const config = { path: "/api/chat" };
