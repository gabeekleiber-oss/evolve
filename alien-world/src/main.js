import { WorldView } from "./world-view.js";
import "./style.css";

const view = new WorldView(document.querySelector("#scene"));
const cycleCount = document.querySelector("#cycle-count");
const agentStatus = document.querySelector("#agent-status");
const agentMessage = document.querySelector("#agent-message");
const noteText = document.querySelector("#note-text");
const noteCycle = document.querySelector("#note-cycle");
const intro = document.querySelector("#intro");
const toast = document.querySelector("#toast");
const growButton = document.querySelector("#grow-button");
const enterButton = document.querySelector("#enter-button");
let latestCycle = 0;
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 4500);
}

async function refreshWorld() {
  try {
    const response = await fetch("/api/world", { cache: "no-store" });
    if (!response.ok) throw new Error("World service is unavailable.");
    const data = await response.json();
    const { world, runtime } = data;
    view.updateWorld(world);
    const cycle = Number(world.cycle) || 0;
    cycleCount.textContent = cycle ? `THOUGHT ${String(cycle).padStart(2, "0")} · ${world.objects.length} FEATURES` : "WAITING FOR A FIRST THOUGHT";
    agentStatus.textContent = runtime.thinking ? "A thought is forming" : runtime.maker ? `${runtime.maker} is listening` : "Listening for a maker";
    agentMessage.textContent = runtime.message;
    growButton.disabled = runtime.thinking;
    growButton.innerHTML = runtime.thinking ? "Listening… <span>◌</span>" : "Invite a new thought <span>↗</span>";
    document.querySelector(".pulse").classList.toggle("active", runtime.thinking || cycle > 0);
    if (cycle > latestCycle && world.memories.length) {
      const memory = world.memories[world.memories.length - 1];
      noteCycle.textContent = String(memory.cycle).padStart(2, "0");
      noteText.textContent = memory.observation;
      if (latestCycle > 0) showToast(`${memory.title}: ${memory.observation}`);
      latestCycle = cycle;
    }
    if (!cycle) latestCycle = 0;
  } catch (error) {
    agentStatus.textContent = "The world service is offline";
    agentMessage.textContent = error.message;
  }
}

async function inviteThought() {
  growButton.disabled = true;
  try {
    const response = await fetch("/api/grow", { method: "POST" });
    const result = await response.json();
    if (!response.ok) showToast(result.error || "The world could not grow just now.");
    await refreshWorld();
  } catch {
    showToast("Could not reach the world service.");
  } finally {
    growButton.disabled = false;
  }
}

growButton.addEventListener("click", inviteThought);
enterButton.addEventListener("click", () => {
  intro.classList.add("dismissed");
  view.renderer.domElement.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  document.querySelector(".controls").classList.toggle("dimmed", document.pointerLockElement === view.renderer.domElement);
});
void refreshWorld();
setInterval(() => void refreshWorld(), 2500);
