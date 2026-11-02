import { openRouterChat } from "./_shared/openrouter.mjs";

export default async function handler(request) {
  return openRouterChat(request, {
    systemPrompt: "You are Riyad AI, a helpful general-purpose assistant. Respond in the user's language. Be clear, practical, honest, and concise. Explain difficult ideas step by step when useful. Help with learning, writing, coding, debugging, planning, and analysis. Do not claim to have browsed, executed code, changed files, or performed actions unless that actually happened.",
    maxTokens: 3000,
    modelEnv: "OPENROUTER_CHAT_MODEL"
  });
}

export const config = {
  path: "/api/chat",
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 8 }
};
