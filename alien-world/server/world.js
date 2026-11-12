import { randomUUID } from "node:crypto";

export const CATEGORIES = ["landform", "organism", "dwelling", "phenomenon", "artifact"];
export const FORMS = ["spire", "orb", "arch", "pod", "crawler", "reed", "ring", "monolith", "shelf", "landform"];

export function createInitialWorld() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    cycle: 0,
    objects: [],
    memories: []
  };
}

function boundedNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error("A proposal contains a number outside the allowed world bounds.");
  }
  return number;
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") throw new Error("A proposal is missing required text.");
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!text || text.length > maxLength) throw new Error("A proposal contains empty or oversized text.");
  return text;
}

export function validateProposal(input, existingObjects = []) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("The maker returned an invalid proposal.");
  }
  const title = cleanText(input.title, 64);
  const observation = cleanText(input.observation, 360);
  if (!Array.isArray(input.objects) || input.objects.length < (existingObjects.length ? 1 : 3) || input.objects.length > 5) {
    throw new Error(existingObjects.length
      ? "A proposal must introduce at least one world feature."
      : "A proposal must introduce between three and five world features.");
  }

  const knownNames = new Set(existingObjects.map((item) => item.name.toLocaleLowerCase()));
  const newNames = new Set();
  const edits = input.edits === undefined ? [] : input.edits;
  if (!Array.isArray(edits) || edits.length > 3) throw new Error("A proposal contains too many edits.");
  const editedIds = new Set();
  const validatedEdits = edits.map((edit) => {
    if (!edit || typeof edit !== "object" || typeof edit.target !== "string") {
      throw new Error("A proposal contains an invalid edit.");
    }
    const target = existingObjects.find((item) => item.name.toLocaleLowerCase() === edit.target.trim().toLocaleLowerCase());
    if (!target || editedIds.has(target.id)) throw new Error("An edit must target one existing feature exactly once.");
    if (!edit.change || typeof edit.change !== "string" || edit.change.trim().length > 160) {
      throw new Error("An edit needs a short explanation.");
    }
    const change = { id: target.id, change: cleanText(edit.change, 160), patch: {} };
    const patch = edit.patch;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("An edit needs a feature update.");
    for (const [key, value] of Object.entries(patch)) {
      if (key === "name") {
        const name = cleanText(value, 42);
        const lowerName = name.toLocaleLowerCase();
        if ((knownNames.has(lowerName) && lowerName !== target.name.toLocaleLowerCase()) || newNames.has(lowerName)) {
          throw new Error("An edit repeats a feature name.");
        }
        newNames.add(lowerName);
        change.patch.name = name;
      } else if (key === "detail") {
        change.patch.detail = cleanText(value, 150);
      } else if (key === "color") {
        if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error("An edit contains an invalid color.");
        change.patch.color = value.toLowerCase();
      } else if (key === "size") {
        change.patch.size = boundedNumber(value, 0.65, 5);
      } else if (key === "x" || key === "z") {
        change.patch[key] = boundedNumber(value, -65, 65);
      } else if (key === "form") {
        if (!FORMS.includes(value)) throw new Error("An edit contains an unknown form.");
        change.patch.form = value;
      } else {
        throw new Error("An edit contains an unsupported field.");
      }
    }
    if (!Object.keys(change.patch).length) throw new Error("An edit must change at least one feature field.");
    editedIds.add(target.id);
    return change;
  });

  const objects = input.objects.map((item) => {
    if (!item || !CATEGORIES.includes(item.category) || !FORMS.includes(item.form)) {
      throw new Error("A proposal contains an unknown world-feature type.");
    }
    const name = cleanText(item.name, 42);
    const key = name.toLocaleLowerCase();
    if (knownNames.has(key) || newNames.has(key)) throw new Error("A proposal repeats a feature name.");
    newNames.add(key);
    if (typeof item.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(item.color)) {
      throw new Error("A proposal contains an invalid color.");
    }
    return {
      id: randomUUID(),
      name,
      category: item.category,
      form: item.form,
      color: item.color.toLowerCase(),
      size: boundedNumber(item.size, 0.65, 5),
      x: boundedNumber(item.x, -65, 65),
      z: boundedNumber(item.z, -65, 65),
      detail: cleanText(item.detail, 150)
    };
  });
  return { title, observation, objects, edits: validatedEdits };
}

export function applyProposal(world, proposal, maker) {
  const cycle = world.cycle + 1;
  const createdAt = new Date().toISOString();
  for (const edit of proposal.edits) {
    const target = world.objects.find((item) => item.id === edit.id);
    if (!target) throw new Error("The feature to edit no longer exists.");
    Object.assign(target, edit.patch, { revision: (target.revision || 0) + 1 });
  }
  world.cycle = cycle;
  world.objects.push(...proposal.objects);
  world.memories.push({
    cycle,
    createdAt,
    title: proposal.title,
    observation: proposal.observation,
    edits: proposal.edits.map(({ id, change }) => ({ id, change })),
    maker
  });
  world.objects = world.objects.slice(-300);
  world.memories = world.memories.slice(-48);
  return world;
}
