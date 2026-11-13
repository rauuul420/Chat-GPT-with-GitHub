import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, stepWorld, getWorldStats, getWorldSnapshot, serializeWorld, restoreWorld } from "../core.js";
import { runExperiment, summarizeExperiments, getExperimentScenario, EXPERIMENT_SCENARIOS } from "../experiments.js";
import { getEnvironment } from "../environment.js";

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

test("saving and restoring preserves the complete simulation state", () => {
  const original = createWorld(424242);
  for (let day = 0; day < 275; day++) stepWorld(original);

  const serialized = serializeWorld(original);
  const restored = restoreWorld(serialized);
  assert.deepEqual(restored, original);

  stepWorld(original);
  stepWorld(restored);
  assert.deepEqual(restored, original);
});

test("restore rejects unsupported or malformed save files", () => {
  assert.throws(() => restoreWorld("{not json"), /JSON válido/);
  assert.throws(() => restoreWorld(JSON.stringify({ format: "other", version: 1 })), /no son compatibles/);
  assert.throws(() => restoreWorld(JSON.stringify({
    format: "wild-systems-save",
    version: 1,
    world: { day: 0 }
  })), /estructura incorrecta/);
});

test("experiment runs are deterministic for the same seed and parameters", () => {
  const first = runExperiment(12345, 120);
  const second = runExperiment(12345, 120);
  assert.deepEqual(first, second);
});

test("experiment metrics and extinction dates are internally consistent", () => {
  const result = runExperiment(77, 30, {
    initialPlants: 0,
    initialHerbivores: 0,
    initialPredators: 0,
    plantGrowthPerDay: 0
  });
  assert.equal(result.days, 30);
  assert.equal(result.final.herbivores, 0);
  assert.equal(result.final.predators, 0);
  assert.equal(result.extinctionDays.herbivores, 0);
  assert.equal(result.extinctionDays.predators, 0);
  assert.equal(result.mean.herbivores, 0);
  assert.equal(result.peak.predators, 0);
});

test("experiment summaries calculate average outcomes and extinction rates", () => {
  const first = runExperiment(1, 20, {
    initialPlants: 0, initialHerbivores: 0, initialPredators: 0, plantGrowthPerDay: 0
  });
  const second = runExperiment(2, 20, {
    initialPlants: 0, initialHerbivores: 1, initialPredators: 0,
    plantGrowthPerDay: 0, herbivoreDailyCost: 100
  });
  const summary = summarizeExperiments([first, second]);
  assert.equal(summary.runs, 2);
  assert.equal(summary.herbivoreExtinctionRate, 100);
  assert.equal(summary.predatorExtinctionRate, 100);
  assert.equal(summary.averageFinal.herbivores, 0);
});

test("experiment validation rejects invalid run lengths", () => {
  assert.throws(() => runExperiment(-1, 10), /semilla/);
  assert.throws(() => runExperiment(1, 0), /días/);
  assert.throws(() => summarizeExperiments([]), /al menos un resultado/);
});

test("lifetime event counters are included in snapshots and saves", () => {
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

  stepWorld(world);
  assert.equal(world.eventTotals.herbivore_feeding, 1);
  const restored = restoreWorld(serializeWorld(world));
  assert.deepEqual(restored.eventTotals, world.eventTotals);
});

test("experiment scenarios provide isolated configuration overrides", () => {
  const first = getExperimentScenario("scarce_resources");
  const second = getExperimentScenario("scarce_resources");
  assert.equal(first.config.plantGrowthPerDay, 1);
  assert.notEqual(first.config, second.config);
  first.config.plantGrowthPerDay = 99;
  assert.equal(getExperimentScenario("scarce_resources").config.plantGrowthPerDay, 1);
  assert.equal(Object.keys(EXPERIMENT_SCENARIOS).length, 5);
  assert.throws(() => getExperimentScenario("unknown"), /no existe/);
});

test("custom experiment parameters override only the selected scenario", () => {
  const scenario = getExperimentScenario("predator_pressure");
  const result = runExperiment(123, 10, {
    ...scenario.config,
    initialPlants: 0,
    initialHerbivores: 0,
    initialPredators: 0,
    plantGrowthPerDay: 2
  });
  assert.equal(result.final.plants, 20);
  assert.equal(result.final.herbivores, 0);
  assert.equal(result.final.predators, 0);
});

test("the seasonal calendar changes at exact configured boundaries", () => {
  assert.equal(getEnvironment(1).season, "spring");
  assert.equal(getEnvironment(90).season, "spring");
  assert.equal(getEnvironment(91).season, "summer");
  assert.equal(getEnvironment(180).season, "summer");
  assert.equal(getEnvironment(181).season, "autumn");
  assert.equal(getEnvironment(271).season, "winter");
  assert.equal(getEnvironment(360).season, "winter");
  assert.equal(getEnvironment(361).season, "spring");
});

test("seasonal weather is deterministic and supports custom season lengths", () => {
  assert.deepEqual(getEnvironment(137), getEnvironment(137));
  assert.equal(getEnvironment(1, { seasonLengthDays: 30 }).season, "spring");
  assert.equal(getEnvironment(31, { seasonLengthDays: 30 }).season, "summer");
  assert.throws(() => getEnvironment(-1), /entero no negativo/);
  assert.throws(() => getEnvironment(1, { seasonLengthDays: 0 }), /duración/);
});

test("seasonal plant growth accumulates fractional growth without losing it", () => {
  const world = createWorld(101, {
    initialPlants: 0,
    initialHerbivores: 0,
    initialPredators: 0,
    plantGrowthPerDay: 1,
    maxPlants: 100
  });
  stepWorld(world);
  assert.equal(world.plants.length, 1);
  stepWorld(world);
  assert.equal(world.plants.length, 2);
  stepWorld(world);
  assert.equal(world.plants.length, 3);
  stepWorld(world);
  assert.equal(world.plants.length, 5);
});

test("legacy saves restore with a default seasonal growth accumulator", () => {
  const world = createWorld(2026);
  const payload = JSON.parse(serializeWorld(world));
  delete payload.world.plantGrowthRemainder;
  delete payload.world.config.seasonLengthDays;
  const restored = restoreWorld(payload);
  assert.equal(restored.plantGrowthRemainder, 0);
  assert.equal(getEnvironment(91, restored.config).season, "summer");
});
