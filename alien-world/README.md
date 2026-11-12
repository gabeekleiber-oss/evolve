# Unfamiliar Ground

A first-person, real-time 3D world that starts almost empty and grows through original ideas from an AI maker. The local Node server proposes one small emergence at a time, checks its shape and world bounds, applies it, and saves the result. The browser only renders the world; provider keys never enter frontend code.

## Run locally

Requires Node.js 20 or newer.

```powershell
cd alien-world
npm install
Copy-Item .env.example .env
# Open .env and set GEMINI_API_KEY and/or GROQ_API_KEY.
npm run dev
```

Open the Vite URL printed in the terminal (normally http://127.0.0.1:5173). Click **Step into the quiet** to capture the mouse; move with **WASD**, look with the mouse, and press **Esc** to release. The service listens locally on port 8787. Use **Invite a new thought** to ask for a generation immediately; otherwise, the world tries after startup and then about every 35 seconds.

With no provider key configured, the world stays intentionally empty and the UI explains how to enable a maker. Set either key, or both for automatic fallback. To run a production build, use `npm run build` then `npm start`; the Node service serves the built game and its API.

## Providers

Provider calls run only in `server/`. The defaults use Google Gemini's `generateContent` API (`gemini-2.5-flash`) first and Groq's OpenAI-compatible chat-completions API (`llama-3.3-70b-versatile`) second. If a provider fails or is rate limited, the server tries the next configured one and temporarily cools down failing providers. Override the defaults with `GEMINI_MODEL` and `GROQ_MODEL` if your account no longer has access to a listed model.

Free access, quotas, model IDs, and regional availability change over time and depend on provider account settings. Confirm current model access and free-tier terms in each provider's console before relying on them; this prototype does not guarantee free capacity. If a key has been pasted into a chat, ticket, or other shared place, rotate it in the provider console before adding its replacement to your local `.env`.

## Memory and creative direction

`data/world.json` is created on the first successful generation and is ignored by Git. Each entry adds named features and a short observation, and can also make small, explicit edits to existing features. Those changes retain the feature identity and are recorded in the thought history; recent observations and features are sent back as context so later ideas can build on or deliberately diverge from earlier ones. Saved memory is bounded to 300 rendered features and 48 observations. Rename or remove that file to start a new world.

The maker prompt asks for alien causal, ecological, and social ideas, forbids imitation or references to existing media and real cultures, and does not prescribe a setting or storyline. A deterministic server-side gate rejects malformed proposals, duplicate names, unsupported forms, and out-of-bounds placements before the world changes. New features are rendered from a small vocabulary of geometric forms, leaving their names, meanings, and relationships open.

## Verify

```powershell
npm test
npm run build
```
