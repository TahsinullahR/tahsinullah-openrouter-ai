# Riyad AI Studio — first web workspace

This is the first UI + AI-connected stage, served from the existing Node backend at `/studio`.

## Current
- OpenRouter-powered streaming chat using the existing `/api/chat` endpoint.
- Video Studio prompt workflow that asks the configured model to generate a self-contained HTML/CSS/JS animation.
- In-browser preview and HTML source download.
- Plugin, Skills and Terminal navigation scaffolds.

## Not connected yet
- Image uploads are selected locally but are not sent for visual analysis yet.
- Video URL/video-file frame extraction is not implemented.
- MP4 rendering and automatic SRT generation need a dedicated rendering/worker service.
- Terminal must run in a separate isolated remote sandbox; the browser UI intentionally does not execute shell commands.
- Plugin and Skills installation backends are planned for the next stage.

## Deploy
Keep the existing server-side OpenRouter key in the host's secret environment variables. Never add real keys to this repository.
