import express from "express";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyProposal, createInitialWorld, validateProposal } from "./world.js";
import { configuredProviders, generationPrompt, proposeWithFallback } from "./providers.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(root, "data");
const dataFile = path.join(dataDirectory, "world.json");
const port = Number(process.env.PORT || 8787);
const app = express();
const cooldowns = new Map();
const runtime = { status: "quiet", message: "This place is deliberately empty. Add a model key to let its first idea arrive.", maker: null, error: null };
let world;
let generationRunning = false;

function loadLocalEnv() {
  const envFile = path.join(root, ".env");
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || match[1] in process.env) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

async function loadWorld() {
  try {
    const saved = JSON.parse(await readFile(dataFile, "utf8"));
    if (saved?.version !== 1 || !Array.isArray(saved.objects) || !Array.isArray(saved.memories)) {
      throw new Error("Saved world data has an unsupported format.");
    }
    return saved;
  } catch (error) {
    if (error.code === "ENOENT") return createInitialWorld();
    throw error;
  }
}

async function persistWorld(nextWorld) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(`${dataFile}.tmp`, `${JSON.stringify(nextWorld, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(`${dataFile}.tmp`, dataFile);
}

async function growWorld() {
  if (generationRunning) return false;
  generationRunning = true;
  runtime.status = "thinking";
  runtime.message = "A new thought is taking shape beyond the horizon.";
  runtime.error = null;
  try {
    const { result, maker } = await proposeWithFallback(generationPrompt(world), cooldowns);
    const proposal = validateProposal(result, world.objects);
    const nextWorld = structuredClone(world);
    applyProposal(nextWorld, proposal, maker);
    await persistWorld(nextWorld);
    world = nextWorld;
    runtime.status = "awake";
    runtime.message = `${proposal.title} — ${proposal.observation}`;
    runtime.maker = maker;
    console.info(`World thought ${world.cycle} added ${proposal.objects.length} features via ${maker}.`);
    return true;
  } catch (error) {
    runtime.status = "quiet";
    runtime.error = error.message || "The world could not grow this time.";
    runtime.message = runtime.error;
    return false;
  } finally {
    generationRunning = false;
  }
}

loadLocalEnv();
world = await loadWorld();

app.disable("x-powered-by");
app.use(express.json({ limit: "4kb" }));
app.get("/api/world", (_request, response) => {
  response.set("Cache-Control", "no-store");
  response.json({ world, runtime: { ...runtime, thinking: generationRunning, providers: configuredProviders().map((provider) => provider.id) } });
});
app.post("/api/grow", async (_request, response) => {
  if (generationRunning) return response.status(409).json({ error: "A new thought is already taking shape." });
  const ok = await growWorld();
  return response.status(ok ? 200 : 503).json({ error: ok ? null : runtime.error });
});
if (existsSync(path.join(root, "dist"))) {
  app.use(express.static(path.join(root, "dist")));
  app.get("*", (_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
}

app.listen(port, "127.0.0.1", () => {
  console.info(`Alien world service listening on http://127.0.0.1:${port}`);
});

setTimeout(() => { void growWorld(); }, 9000);
setInterval(() => { void growWorld(); }, 35_000);
