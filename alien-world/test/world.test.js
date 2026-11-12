import test from "node:test";
import assert from "node:assert/strict";
import { applyProposal, createInitialWorld, validateProposal } from "../server/world.js";

function proposal(overrides = {}) {
  return {
    title: "The First Fold",
    observation: "The open plain bends sound toward its darker stones.",
    edits: [],
    objects: [
      { name: "Veyra", category: "landform", form: "landform", color: "#97a882", size: 2.1, x: -9, z: 12, detail: "A low, porous ridge." },
      { name: "Oruun", category: "organism", form: "crawler", color: "#c6a974", size: 1.4, x: 16, z: -7, detail: "Moves when no one looks directly at it." },
      { name: "Ish", category: "phenomenon", form: "ring", color: "#9bb9bb", size: 2.8, x: 5, z: -18, detail: "A brief blue halo." }
    ],
    ...overrides
  };
}

test("the starting world is quiet and empty", () => {
  const world = createInitialWorld();
  assert.equal(world.cycle, 0);
  assert.deepEqual(world.objects, []);
  assert.deepEqual(world.memories, []);
});

test("validated proposals become persistent world objects and memories", () => {
  const world = createInitialWorld();
  const accepted = validateProposal(proposal());
  applyProposal(world, accepted, "Gemini");
  assert.equal(world.cycle, 1);
  assert.equal(world.objects.length, 3);
  assert.equal(world.memories[0].maker, "Gemini");
  assert.ok(world.objects.every((item) => item.id && item.color.startsWith("#")));
});

test("out-of-range coordinates and invalid forms are rejected", () => {
  const outside = proposal();
  outside.objects[0].x = 500;
  assert.throws(() => validateProposal(outside), /world bounds/);

  const unknown = proposal();
  unknown.objects[0].form = "familiar";
  assert.throws(() => validateProposal(unknown), /unknown world-feature type/);
});

test("duplicate feature names are rejected across saved memory", () => {
  const prior = [{ name: "Veyra" }];
  assert.throws(() => validateProposal(proposal(), prior), /repeats a feature name/);
});

test("a later thought can safely edit an existing feature", () => {
  const world = createInitialWorld();
  const first = validateProposal(proposal());
  applyProposal(world, first, "Gemini");
  const target = world.objects[0];
  const next = proposal({
    edits: [{ target: target.name, change: "Its porous ridge has begun to migrate.", patch: { x: 14, detail: "A migrating, porous ridge." } }]
  });
  next.objects.forEach((item, index) => { item.name = `Later feature ${index}`; });
  const accepted = validateProposal(next, world.objects);
  applyProposal(world, accepted, "Groq");
  assert.equal(world.objects[0].id, target.id);
  assert.equal(world.objects[0].x, 14);
  assert.equal(world.objects[0].revision, 1);
  assert.equal(world.memories[1].edits[0].id, target.id);
});
