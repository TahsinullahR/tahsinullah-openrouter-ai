# Tahsinullah Riyad — OpenRouter AI

## 1. Install

Node.js 18.17+ is required.

```bash
npm install
```

## 2. Configure

Copy `.env.example` to `.env` and add your OpenRouter key:

```bash
OPENROUTER_API_KEY=sk-or-...
```

Never commit `.env`.

## 3. Run

```bash
npm start
```

Health check:

`http://localhost:3001/health`

## 4. Connect the website

Open `frontend-widget.html`, replace:

`https://YOUR-BACKEND-URL.example.com/api/chat`

with your deployed backend URL + `/api/chat`.

Then paste the complete widget into your website's custom HTML/code area.

## 5. Deploy

This project can run on Render, Railway, Fly.io, a VPS, or another Node.js host.

Set the environment variables from `.env.example` in the hosting provider.

## Security

- The OpenRouter key is server-side only.
- The browser calls `/api/chat`, never OpenRouter directly.
- CORS is restricted to `ALLOWED_ORIGINS`.
- Basic rate limiting is enabled.
- Request size and conversation history are bounded.
