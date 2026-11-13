import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, createTerrain, classifyBiome, stepWorld, getWorldStats, getWorldSnapshot, serializeWorld, restoreWorld } from "../core.js";
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
  assert.equal(getEnvironment(0).season, "spring");
  assert.equal(getEnvironment(0).dayInSeason, 1);
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
  delete payload.world.terrain;
  const restored = restoreWorld(payload);
  assert.equal(restored.plantGrowthRemainder, 0);
  assert.equal(restored.config.seasonLengthDays, 90);
  assert.deepEqual(restored.terrain, createTerrain(world.seed, restored.config));
  assert.equal(getEnvironment(91, restored.config).season, "summer");
});

test("terrain is reproducible, spatially varied, and independent of simulation RNG", () => {
  const first = createTerrain(13579);
  const second = createTerrain(13579);
  assert.deepEqual(first, second);
  assert.equal(first.cells.length, 84);
  assert.ok(new Set(first.cells.map(cell => cell.fertility)).size > 50);
  assert.ok(new Set(first.cells.map(cell => cell.moisture)).size > 50);
  assert.ok(first.cells.every(cell => cell.growthWeight > 0 && cell.growthWeight <= 1));
  assert.throws(() => createTerrain(1, { width: 960, height: 540, terrainColumns: 1, terrainRows: 7 }), /cuadrícula/);
});

test("initial vegetation is assigned to terrain cells and biased by local resources", () => {
  const world = createWorld(24680);
  assert.equal(world.terrain.cells.length, 84);
  assert.ok(world.plants.every(plant => Number.isInteger(plant.terrainCellId)));
  const counts = new Array(world.terrain.cells.length).fill(0);
  for (const plant of world.plants) counts[plant.terrainCellId]++;
  const fertile = world.terrain.cells.reduce((best, cell) => cell.growthWeight > best.growthWeight ? cell : best);
  const barren = world.terrain.cells.reduce((worst, cell) => cell.growthWeight < worst.growthWeight ? cell : worst);
  assert.ok(counts[fertile.id] > counts[barren.id]);
});

test("terrain survives saves and legacy worlds regenerate it deterministically", () => {
  const world = createWorld(97531);
  const restored = restoreWorld(serializeWorld(world));
  assert.deepEqual(restored.terrain, world.terrain);
  const legacy = JSON.parse(serializeWorld(world));
  delete legacy.world.terrain;
  const migrated = restoreWorld(legacy);
  assert.deepEqual(migrated.terrain, world.terrain);
  assert.deepEqual(restoreWorld(legacy).terrain, world.terrain);
});

test("seeded terrain does not break deterministic world evolution", () => {
  const first = createWorld(86420);
  const second = createWorld(86420);
  for (let day = 0; day < 180; day++) {
    stepWorld(first);
    stepWorld(second);
  }
  assert.deepEqual(first, second);
});


test("predation increments both predation and herbivore death counters", () => {
  const world = createWorld(1122, {
    initialPlants: 0,
    initialHerbivores: 1,
    initialPredators: 1,
    plantGrowthPerDay: 0,
    herbivoreSpeed: 0,
    predatorSpeed: 0
  });
  const prey = world.herbivores[0];
  const predator = world.predators[0];
  predator.x = prey.x;
  predator.y = prey.y;
  stepWorld(world);
  assert.equal(world.herbivores.length, 0);
  assert.equal(world.eventTotals.predation, 1);
  assert.equal(world.eventTotals.herbivore_death, 1);
  assert.equal(world.events.filter(event => event.type === "herbivore_death" && event.cause === "predation").length, 1);
});

test("restore rejects malformed terrain dimensions and cell values", () => {
  const payload = JSON.parse(serializeWorld(createWorld(91)));
  payload.world.terrain.columns = 1;
  assert.throws(() => restoreWorld(payload), /terreno inválido/);
  const invalidCell = JSON.parse(serializeWorld(createWorld(92)));
  invalidCell.world.terrain.cells[0].moisture = 4;
  assert.throws(() => restoreWorld(invalidCell), /terreno inválido/);
});

test("seasonal weather changes local soil moisture within safe bounds", () => {
  const world = createWorld(54321, {
    initialPlants: 0,
    initialHerbivores: 0,
    initialPredators: 0,
    plantGrowthPerDay: 0
  });
  const initial = world.terrain.cells.map(cell => cell.moisture);
  for (let day = 0; day < 90; day++) stepWorld(world);
  assert.ok(world.terrain.cells.some((cell, index) => cell.moisture !== initial[index]));
  assert.ok(world.terrain.cells.every(cell => cell.moisture >= 0.08 && cell.moisture <= 0.98));
  assert.ok(world.terrain.cells.every(cell => {
    const suitability = Math.max(0.05, 1 - Math.abs(cell.moisture - 0.62) / 0.62);
    const biomeFactor = { aquatic: 0.12, wetland: 0.72, forest: 1.08, grassland: 1, arid: 0.48, barren: 0.32 }[cell.biome];
    return cell.growthWeight === Number((cell.fertility * suitability * biomeFactor).toFixed(4));
  }));
});

test("seasonal soil moisture is reproducible across identical worlds and saves", () => {
  const first = createWorld(67890);
  const second = createWorld(67890);
  for (let day = 0; day < 365; day++) {
    stepWorld(first);
    stepWorld(second);
  }
  assert.deepEqual(first.terrain, second.terrain);
  const restored = restoreWorld(serializeWorld(first));
  assert.deepEqual(restored.terrain, first.terrain);
  stepWorld(first);
  stepWorld(restored);
  assert.deepEqual(restored, first);
});


test("the water cycle keeps surface water and soil moisture bounded", () => {
  const world = createWorld(20261114, {
    initialPlants: 0, initialHerbivores: 0, initialPredators: 0, plantGrowthPerDay: 0
  });
  for (let day = 0; day < 720; day++) {
    stepWorld(world);
    assert.ok(world.terrain.cells.every(cell =>
      cell.surfaceWater >= 0 && cell.surfaceWater <= 1 &&
      cell.moisture >= 0.08 && cell.moisture <= 0.98
    ));
  }
});

test("hydrology is deterministic and survives save/restore without diverging", () => {
  const first = createWorld(20261115);
  const second = createWorld(20261115);
  for (let day = 0; day < 240; day++) {
    stepWorld(first);
    stepWorld(second);
  }
  assert.deepEqual(first.terrain, second.terrain);
  const restored = restoreWorld(serializeWorld(first));
  assert.deepEqual(restored, first);
  stepWorld(first);
  stepWorld(restored);
  assert.deepEqual(restored, first);
});

test("legacy 0.6 terrain saves receive deterministic hydrology defaults", () => {
  const world = createWorld(20261116);
  const payload = JSON.parse(serializeWorld(world));
  for (const cell of payload.world.terrain.cells) {
    delete cell.surfaceWater;
    delete cell.elevation;
  }
  const restored = restoreWorld(payload);
  assert.ok(restored.terrain.cells.every(cell =>
    cell.surfaceWater === 0.02 && Number.isFinite(cell.elevation)
  ));
  assert.deepEqual(restoreWorld(payload), restored);
});

test("seasonal environment exposes separate rainfall and evaporation rates", () => {
  const spring = getEnvironment(1);
  const summer = getEnvironment(91);
  assert.ok(spring.precipitation > summer.precipitation);
  assert.ok(summer.evaporation > spring.evaporation);
  assert.equal(typeof spring.precipitation, "number");
  assert.equal(typeof spring.evaporation, "number");
});


test("surface runoff transfers excess water to a lower neighbouring cell", () => {
  const world = createWorld(20261117, {
    initialPlants: 0, initialHerbivores: 0, initialPredators: 0, plantGrowthPerDay: 0
  });
  for (const cell of world.terrain.cells) {
    cell.elevation = 1;
    cell.surfaceWater = 0;
  }
  const source = world.terrain.cells[0];
  const destination = world.terrain.cells[1];
  source.elevation = 0.9;
  source.surfaceWater = 1;
  destination.elevation = 0.1;

  stepWorld(world);
  assert.ok(destination.surfaceWater > 0);
  assert.ok(source.surfaceWater < 1);
});


test("biomes emerge from water, moisture and fertility thresholds", () => {
  assert.equal(classifyBiome({ surfaceWater: 0.4, moisture: 0.6, fertility: 0.8 }), "aquatic");
  assert.equal(classifyBiome({ surfaceWater: 0.2, moisture: 0.7, fertility: 0.4 }), "wetland");
  assert.equal(classifyBiome({ surfaceWater: 0.01, moisture: 0.9, fertility: 0.3 }), "wetland");
  assert.equal(classifyBiome({ surfaceWater: 0.01, moisture: 0.2, fertility: 0.8 }), "arid");
  assert.equal(classifyBiome({ surfaceWater: 0.01, moisture: 0.6, fertility: 0.8 }), "forest");
  assert.equal(classifyBiome({ surfaceWater: 0.01, moisture: 0.6, fertility: 0.5 }), "grassland");
  assert.equal(classifyBiome({ surfaceWater: 0.01, moisture: 0.6, fertility: 0.2 }), "barren");
});

test("terrain biomes are deterministic and update with local hydrology", () => {
  const first = createWorld(20261118, {
    initialPlants: 0, initialHerbivores: 0, initialPredators: 0, plantGrowthPerDay: 0
  });
  const second = createWorld(20261118, {
    initialPlants: 0, initialHerbivores: 0, initialPredators: 0, plantGrowthPerDay: 0
  });
  assert.deepEqual(first.terrain, second.terrain);
  assert.ok(first.terrain.cells.every(cell =>
    ["aquatic", "wetland", "forest", "grassland", "arid", "barren"].includes(cell.biome)
  ));
  for (let day = 0; day < 540; day++) {
    stepWorld(first);
    stepWorld(second);
  }
  assert.deepEqual(first.terrain, second.terrain);
  assert.ok(first.terrain.cells.every(cell =>
    cell.growthWeight >= 0 && cell.growthWeight <= 1 &&
    cell.biome === classifyBiome(cell)
  ));
});

test("biome classifications and habitat suitability survive save restoration", () => {
  const world = createWorld(20261119);
  for (let day = 0; day < 180; day++) stepWorld(world);
  const restored = restoreWorld(serializeWorld(world));
  assert.deepEqual(restored.terrain, world.terrain);
  assert.ok(restored.terrain.cells.every(cell => cell.biome === classifyBiome(cell)));
});

test("legacy hydrology saves receive biome classifications on migration", () => {
  const world = createWorld(20261120);
  const payload = JSON.parse(serializeWorld(world));
  for (const cell of payload.world.terrain.cells) delete cell.biome;
  const restored = restoreWorld(payload);
  assert.ok(restored.terrain.cells.every(cell => cell.biome === classifyBiome(cell)));
});


test("habitat population statistics exactly match organism and plant locations", () => {
  const world = createWorld(31002);
  const stats = getWorldStats(world);
  const totals = Object.values(stats.habitats).reduce((sum, habitat) => ({
    plants: sum.plants + habitat.plants,
    herbivores: sum.herbivores + habitat.herbivores,
    predators: sum.predators + habitat.predators
  }), { plants: 0, herbivores: 0, predators: 0 });
  assert.equal(totals.plants, world.plants.length);
  assert.equal(totals.herbivores, world.herbivores.length);
  assert.equal(totals.predators, world.predators.length);
});

test("habitat-aware animal decisions remain deterministic and survive save restoration", () => {
  const first = createWorld(31003);
  const second = createWorld(31003);
  for (let day = 0; day < 220; day++) { stepWorld(first); stepWorld(second); }
  assert.deepEqual(first, second);
  const restored = restoreWorld(serializeWorld(first));
  stepWorld(first);
  stepWorld(restored);
  assert.deepEqual(restored, first);
});
