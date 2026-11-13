import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, stepWorld, getWorldStats, getWorldSnapshot } from "../core.js";

test("the same seed creates an identical initial world", () => {
  const first = createWorld(123456);
  const second = createWorld(123456);
  assert.deepEqual(first, second);
});

test("different seeds produce different initial worlds", () => {
  assert.notDeepEqual(createWorld(123), createWorld(456));
});

test("the same seed produces identical results over many days", () => {
  const first = createWorld(98765);
  const second = createWorld(98765);

  for (let day = 0; day < 250; day++) {
    stepWorld(first);
    stepWorld(second);
  }

  assert.deepEqual(getWorldSnapshot(first), getWorldSnapshot(second));
});

test("a simulation step advances exactly one day", () => {
  const world = createWorld(7);
  stepWorld(world);
  assert.equal(world.day, 1);
});

test("population caps are respected", () => {
  const world = createWorld(42, {
    initialPlants: 20,
    initialHerbivores: 20,
    initialPredators: 5,
    maxPlants: 24,
    maxHerbivores: 22,
    maxPredators: 7
  });

  for (let day = 0; day < 500; day++) {
    stepWorld(world);
    assert.ok(world.plants.length <= 24);
    assert.ok(world.herbivores.length <= 22);
    assert.ok(world.predators.length <= 7);
  }
});

test("organisms remain inside the world and have valid energy", () => {
  const world = createWorld(314159);
  for (let day = 0; day < 300; day++) stepWorld(world);

  for (const organism of [...world.herbivores, ...world.predators]) {
    assert.ok(organism.x >= 5 && organism.x <= world.config.width - 5);
    assert.ok(organism.y >= 5 && organism.y <= world.config.height - 5);
    assert.ok(Number.isFinite(organism.energy) && organism.energy > 0);
    assert.ok(organism.age >= 0);
  }
});

test("statistics agree with the actual populations", () => {
  const world = createWorld(99);
  const stats = getWorldStats(world);
  assert.equal(stats.plants, world.plants.length);
  assert.equal(stats.herbivores, world.herbivores.length);
  assert.equal(stats.predators, world.predators.length);
  assert.equal(stats.totalOrganisms, stats.herbivores + stats.predators);
});

test("snapshots are detached copies", () => {
  const world = createWorld(77);
  const snapshot = getWorldSnapshot(world);
  snapshot.plants[0].x = -100;
  assert.notEqual(world.plants[0].x, -100);
});

test("feeding events are structured and dated", () => {
  const world = createWorld(20261113, {
    initialPlants: 0,
    initialHerbivores: 1,
    initialPredators: 0,
    plantGrowthPerDay: 0
  });
  const herbivore = world.herbivores[0];
  world.plants.push({
    id: world.nextId++,
    x: herbivore.x,
    y: herbivore.y,
    energy: 1
  });

  stepWorld(world);
  const event = world.events.find(item => item.type === "herbivore_feeding");
  assert.ok(event);
  assert.equal(event.day, 1);
  assert.equal(event.organismId, herbivore.id);
});

test("event history stays bounded when a new event is recorded", () => {
  const world = createWorld(2026, {
    initialPlants: 0,
    initialHerbivores: 1,
    initialPredators: 0,
    plantGrowthPerDay: 0
  });
  const herbivore = world.herbivores[0];
  world.plants.push({
    id: world.nextId++,
    x: herbivore.x,
    y: herbivore.y,
    energy: 1
  });
  world.events = Array.from({ length: 200 }, (_, index) => ({
    id: index + 1,
    day: 0,
    type: "test"
  }));
  world.nextEventId = 201;

  stepWorld(world);
  assert.equal(world.events.length, 200);
  assert.equal(world.events[0].id, 2);
  assert.equal(world.events.at(-1).type, "herbivore_feeding");
});
