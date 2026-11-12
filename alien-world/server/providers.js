import { FORMS, CATEGORIES } from "./world.js";

const responseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    observation: { type: "STRING" },
    edits: {
      type: "ARRAY",
      maxItems: 3,
      items: {
        type: "OBJECT",
        properties: {
          target: { type: "STRING" },
          change: { type: "STRING" },
          patch: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" }, detail: { type: "STRING" },
              color: { type: "STRING" }, size: { type: "NUMBER" },
              x: { type: "NUMBER" }, z: { type: "NUMBER" },
              form: { type: "STRING", enum: FORMS }
            }
          }
        },
        required: ["target", "change", "patch"]
      }
    },
    objects: {
      type: "ARRAY", minItems: 3, maxItems: 5,
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" }, category: { type: "STRING", enum: CATEGORIES },
          form: { type: "STRING", enum: FORMS }, color: { type: "STRING" },
          size: { type: "NUMBER" }, x: { type: "NUMBER" }, z: { type: "NUMBER" },
          detail: { type: "STRING" }
        },
        required: ["name", "category", "form", "color", "size", "x", "z", "detail"]
      }
    }
  },
  required: ["title", "observation", "edits", "objects"]
};

const systemPrompt = `You are a singular, curious world-making intelligence. Invent original life, landforms, dwellings, artifacts, and phenomena for a world that has no source material. Do not imitate, name, or allude to any existing book, game, film, franchise, artist, or real culture. Avoid familiar fantasy and science-fiction templates. Make each thought surprising, internally coherent, and unlike Earth; let alien biology, perception, physics, and social arrangements emerge from your own ideas. You are proposing features, not writing fiction about known characters. Be evocative but concise. Return only the requested JSON.`;

function parseProposal(text, maker) {
  if (typeof text !== "string" || !text.trim()) throw new ProviderError(`${maker} returned no proposal.`, 502);
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); }
  catch { throw new ProviderError(`${maker} returned invalid JSON.`, 502); }
}

async function request(url, options, maker) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(40000) });
  } catch {
    throw new ProviderError(`${maker} timed out or could not connect.`);
  }
  if (!response.ok) {
    // Do not echo provider response bodies: they can contain account or request details.
    throw new ProviderError(`${maker} rejected the generation request.`, response.status);
  }
  try { return await response.json(); }
  catch { throw new ProviderError(`${maker} returned an unreadable response.`, 502); }
}

function openAIProvider({ id, envKey, modelEnv, defaultModel, endpoint, headers = {} }) {
  return {
    id, envKey,
    model: () => process.env[modelEnv] || defaultModel,
    async propose(apiKey, model, prompt) {
      const result = await request(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...headers },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${systemPrompt}\nReturn one JSON object with title, observation, edits, and objects. Each object requires name, category, form, color, size, x, z, and detail. Each edit requires target, change, and patch.` },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 1.05
        })
      }, id);
      return parseProposal(result?.choices?.[0]?.message?.content, id);
    }
  };
}

const providers = [
  {
    id: "Gemini", envKey: "GEMINI_API_KEY",
    model: () => process.env.GEMINI_MODEL || "gemini-2.5-flash",
    async propose(apiKey, model, prompt) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const result = await request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 1.1 }
        })
      }, "Gemini");
      const text = result?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
      return parseProposal(text, "Gemini");
    }
  },
  {
    id: "Groq", envKey: "GROQ_API_KEY",
    model: () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    async propose(apiKey, model, prompt) {
      const result = await request("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${systemPrompt}\nReturn one JSON object with title, observation, edits, and objects. Each object requires name, category, form, color, size, x, z, and detail. Each edit requires target, change, and patch.` },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }, temperature: 1.1
        })
      }, "Groq");
      return parseProposal(result?.choices?.[0]?.message?.content, "Groq");
    }
  },
  openAIProvider({
    id: "NVIDIA", envKey: "NVIDIA_API_KEY", modelEnv: "NVIDIA_MODEL",
    defaultModel: "meta/llama-3.3-70b-instruct",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions"
  }),
  openAIProvider({
    id: "OpenRouter", envKey: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    headers: { "HTTP-Referer": "http://127.0.0.1:5173", "X-Title": "Unfamiliar Ground" }
  })
];

export class ProviderError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

export function configuredProviders() {
  return providers.filter((provider) => Boolean(process.env[provider.envKey]));
}

export async function proposeWithFallback(prompt, cooldowns = new Map(), now = Date.now()) {
  const available = configuredProviders();
  if (!available.length) {
    throw new ProviderError("Add at least one provider key to .env before inviting a maker.", 0);
  }
  const preferred = (process.env.PROVIDER_ORDER || "Gemini,Groq,NVIDIA,OpenRouter")
    .split(",").map((name) => name.trim().toLowerCase());
  available.sort((a, b) => {
    const ai = preferred.indexOf(a.id.toLowerCase());
    const bi = preferred.indexOf(b.id.toLowerCase());
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  const failures = [];
  for (const provider of available) {
    const cooldown = cooldowns.get(provider.id);
    if (cooldown && cooldown.retryAt > now) continue;
    try {
      const result = await provider.propose(process.env[provider.envKey], provider.model(), prompt);
      cooldowns.delete(provider.id);
      return { result, maker: provider.id };
    } catch (error) {
      const status = error instanceof ProviderError ? error.status : 0;
      const previous = cooldown?.failures || 0;
      const delay = Math.min(15 * 60_000, (status === 429 ? 60_000 : 20_000) * (2 ** previous));
      cooldowns.set(provider.id, { failures: previous + 1, retryAt: Date.now() + delay });
      failures.push(`${provider.id}${status ? ` (${status})` : ""}`);
      console.warn(`World proposal failed for ${provider.id}${status ? ` (${status})` : ""}; trying the next configured provider.`);
    }
  }
  if (!failures.length) throw new ProviderError("Configured makers are cooling down after provider errors. They will be retried automatically.");
  throw new ProviderError(`No maker could respond (${failures.join(", ")}). Check provider access or model availability.`);
}

export function generationPrompt(world) {
  const recent = world.memories.slice(-8).map((memory) => `${memory.title}: ${memory.observation}`).join("\n");
  const features = world.objects.slice(-24).map((item) => `${item.name} (${item.category}, ${item.form}): ${item.detail}`).join("\n");
  return `The world has reached thought ${world.cycle}. It contains ${world.objects.length} features. Its recent memory is:\n${recent || "(nothing has happened yet)"}\n\nNearby feature memory:\n${features || "(none)"}\n\nLet this world's past become malleable: propose 3 to 5 new features and, when an idea genuinely transforms something that already exists, up to 3 edits. Each edit must target an existing feature by its exact name and provide a concise change explanation plus a patch containing only the fields that change (name, detail, color, size, x, z, form). Edits are optional; leave features alone when they should remain strange and stable. First thought: introduce at least three features. Later thoughts: introduce at least one. Invent the next independent but interesting emergence. Change the world's assumptions, not merely its scenery: invent a strange causal or ecological relation. Use categories ${CATEGORIES.join(", ")} and forms ${FORMS.join(", ")}. Choose evocative original names, concise details, and colors as six-digit hex. Coordinates x and z must be between -65 and 65; cluster features where meaningful but don't repeat existing names. Return one short title and an observation that adds a durable clue about this world.`;
}
