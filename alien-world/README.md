# Unfamiliar Ground

A first-person, real-time 3D world that starts almost empty and grows through original ideas from an AI maker. The local Node server proposes one small emergence at a time, validates its shape and world bounds, applies it, and saves the result. Provider credentials remain on the local server and are never sent to browser code.

## Quick start (Windows)

1. Install [Node.js 20 or newer](https://nodejs.org/).
2. Double-click `run.bat`.
3. On first launch, the launcher creates `.env.example` as `.env` and opens it in Notepad. Add at least one API key, save, then return to the launcher.
4. The launcher installs dependencies if needed, starts the game, and opens http://127.0.0.1:5173.

You can add more provider keys later. The server tries configured providers in the order in `PROVIDER_ORDER` and falls back when a provider errors or is rate limited. Keys are read only by the local Node service.

## Supported AI providers

Set any combination in `.env`:

- `GEMINI_API_KEY` — Google Gemini; default model `gemini-2.5-flash`.
- `GROQ_API_KEY` — Groq; default model `llama-3.3-70b-versatile`.
- `NVIDIA_API_KEY` — NVIDIA NIM; default model `meta/llama-3.3-70b-instruct`.
- `OPENROUTER_API_KEY` — OpenRouter; default model `meta-llama/llama-3.3-70b-instruct`.

Optional model overrides are `GEMINI_MODEL`, `GROQ_MODEL`, `NVIDIA_MODEL`, and `OPENROUTER_MODEL`. Change `PROVIDER_ORDER` to control fallback priority, for example `NVIDIA,OpenRouter,Gemini,Groq`. Model availability and account quotas vary by provider.

## Controls

Click **Step into the quiet** to capture the mouse. Move with **WASD**, look with the mouse, and press **Esc** to release. Use **Invite a new thought** to trigger generation immediately; otherwise the world tries on startup and about every 35 seconds.

## Memory and creative direction

`data/world.json` is created on the first successful generation and ignored by Git. Each entry adds named features and a short observation, and can also make small, explicit edits to existing features. Saved memory is bounded to 300 rendered features and 48 observations. Rename or remove that file to start a new world.

## Manual commands

```cmd
npm install
npm run dev
```

Open http://127.0.0.1:5173. For a production build:

```cmd
npm test
npm run build
npm start
```

The development web server listens on port 5173 and the local API listens on port 8787.
