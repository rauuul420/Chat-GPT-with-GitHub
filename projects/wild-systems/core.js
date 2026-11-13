import { getEnvironment } from "./environment.js";

const DEFAULT_CONFIG = Object.freeze({
  width: 960,
  height: 540,
  initialPlants: 210,
  initialHerbivores: 34,
  initialPredators: 7,
  maxPlants: 520,
  maxHerbivores: 150,
  maxPredators: 45,
  plantGrowthPerDay: 3,
  seasonLengthDays: 90,
  terrainColumns: 12,
  terrainRows: 7,
  herbivoreSpeed: 0.85,
  predatorSpeed: 1.05,
  herbivoreDailyCost: 0.19,
  predatorDailyCost: 0.28,
  herbivoreFoodGain: 25,
  predatorFoodGain: 48,
  herbivoreBirthThreshold: 125,
  predatorBirthThreshold: 145,
  herbivoreMaxAge: 1900,
  predatorMaxAge: 2200
});

function random(world, min = 0, max = 1) {
  // Mulberry32: compact, deterministic and fully serializable through rngState.
  world.rngState = (world.rngState + 0x6D2B79F5) >>> 0;
  let value = world.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  const unit = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  return min + unit * (max - min);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearest(items, source) {
  let candidate = null;
  let bestDistance = Infinity;
  for (const item of items) {
    const currentDistance = distance(item, source);
    if (currentDistance < bestDistance) {
      candidate = item;
      bestDistance = currentDistance;
    }
  }
  return candidate;
}

function hashTerrain(seed, x, y, salt) {
  let value = (seed ^ Math.imul(x + 1, 0x9E3779B1) ^ Math.imul(y + 1, 0x85EBCA77) ^ salt) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7FEB352D);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846CA68B);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}


export function classifyBiome(cell) {
  if (cell.surfaceWater >= 0.35) return "aquatic";
  if (cell.surfaceWater >= 0.12 || cell.moisture >= 0.84) return "wetland";
  if (cell.moisture <= 0.28) return "arid";
  if (cell.fertility >= 0.68 && cell.moisture >= 0.48) return "forest";
  if (cell.fertility >= 0.34) return "grassland";
  return "barren";
}

function getHabitatSuitability(cell) {
  const moistureSuitability = Math.max(0.05, 1 - Math.abs(cell.moisture - 0.62) / 0.62);
  const biomeFactor = {
    aquatic: 0.12, wetland: 0.72, forest: 1.08,
    grassland: 1, arid: 0.48, barren: 0.32
  }[cell.biome];
  return cell.fertility * moistureSuitability * biomeFactor;
}

export function createTerrain(seed, config = DEFAULT_CONFIG) {
  const columns = config.terrainColumns ?? DEFAULT_CONFIG.terrainColumns;
  const rows = config.terrainRows ?? DEFAULT_CONFIG.terrainRows;
  if (!Number.isInteger(columns) || columns < 2 || columns > 40 ||
      !Number.isInteger(rows) || rows < 2 || rows > 30) {
    throw new RangeError("La cuadrícula del terreno debe tener entre 2–40 columnas y 2–30 filas.");
  }
  const cellWidth = config.width / columns;
  const cellHeight = config.height / rows;
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const fertility = 0.2 + hashTerrain(seed, x, y, 0xA341316C) * 0.8;
      const moisture = 0.15 + hashTerrain(seed, x, y, 0xC8013EA4) * 0.85;
      cells.push({
        id: y * columns + x, x, y,
        left: x * cellWidth, top: y * cellHeight,
        width: cellWidth, height: cellHeight,
        fertility: Number(fertility.toFixed(4)),
        moisture: Number(moisture.toFixed(4)),
        surfaceWater: 0.02,
        elevation: Number(hashTerrain(seed, x, y, 0xAD90777D).toFixed(4)),
        biome: "grassland",
        growthWeight: 0
      });
      const cell = cells[cells.length - 1];
      cell.biome = classifyBiome(cell);
      cell.growthWeight = Number(getHabitatSuitability(cell).toFixed(4));
    }
  }
  return { columns, rows, cells };
}

function chooseTerrainCell(world) {
  const cells = world.terrain.cells;
  const totalWeight = cells.reduce((sum, cell) => sum + cell.growthWeight, 0);
  let selection = random(world, 0, totalWeight);
  for (const cell of cells) {
    selection -= cell.growthWeight;
    if (selection <= 0) return cell;
  }
  return cells[cells.length - 1];
}

function createAnimal(world, species, config, x, y) {
  const herbivore = species === "herbivore";
  return {
    id: world.nextId++,
    species,
    x: x ?? random(world, 10, config.width - 10),
    y: y ?? random(world, 10, config.height - 10),
    angle: random(world, 0, Math.PI * 2),
    energy: herbivore ? random(world, 55, 90) : random(world, 65, 100),
    age: 0
  };
}

function createPlant(world, config, selectedCell = null) {
  const cell = selectedCell ?? chooseTerrainCell(world);
  return {
    id: world.nextId++,
    x: random(world, cell.left + 5, cell.left + cell.width - 5),
    y: random(world, cell.top + 5, cell.top + cell.height - 5),
    energy: random(world, 0.3, 1),
    terrainCellId: cell.id
  };
}

const HERBIVORE_BIOME_AFFINITY = Object.freeze({
  grassland: 1, forest: 0.92, wetland: 0.68, barren: 0.42, arid: 0.3, aquatic: 0.08
});
const PREDATOR_BIOME_AFFINITY = Object.freeze({
  forest: 1, grassland: 0.94, wetland: 0.78, barren: 0.62, arid: 0.5, aquatic: 0.18
});

function terrainCellAt(world, x, y) {
  const columns = world.terrain.columns;
  const column = Math.max(0, Math.min(columns - 1, Math.floor(x / world.config.width * columns)));
  const row = Math.max(0, Math.min(world.terrain.rows - 1, Math.floor(y / world.config.height * world.terrain.rows)));
  return world.terrain.cells[row * columns + column];
}

function selectHerbivoreFood(world, herbivore) {
  let candidate = null;
  let bestScore = Infinity;
  for (const plant of world.plants) {
    const cell = world.terrain.cells[plant.terrainCellId] ?? terrainCellAt(world, plant.x, plant.y);
    const affinity = HERBIVORE_BIOME_AFFINITY[cell.biome] ?? 0.4;
    const habitatQuality = 0.35 + cell.growthWeight * 1.2 + affinity * 0.55;
    const score = distance(plant, herbivore) / habitatQuality;
    if (score < bestScore) { candidate = plant; bestScore = score; }
  }
  return candidate;
}

function selectPredatorPrey(world, predator) {
  let candidate = null;
  let bestScore = Infinity;
  for (const prey of world.herbivores) {
    const cell = terrainCellAt(world, prey.x, prey.y);
    const affinity = PREDATOR_BIOME_AFFINITY[cell.biome] ?? 0.5;
    let localPrey = 0;
    for (const other of world.herbivores) if (distance(prey, other) <= 105) localPrey++;
    const concentrationBonus = 1 + Math.max(0, localPrey - 1) * 0.12;
    const habitatQuality = 0.65 + affinity * 0.45;
    const score = distance(prey, predator) / (habitatQuality * concentrationBonus);
    if (score < bestScore) { candidate = prey; bestScore = score; }
  }
  return candidate;
}

function moveAnimal(world, animal, target, pace, config) {
  if (target) {
    const desired = Math.atan2(target.y - animal.y, target.x - animal.x);
    const delta = Math.atan2(
      Math.sin(desired - animal.angle),
      Math.cos(desired - animal.angle)
    );
    animal.angle += Math.max(-0.13, Math.min(0.13, delta));
  } else {
    animal.angle += random(world, -0.12, 0.12);
  }

  animal.x += Math.cos(animal.angle) * pace;
  animal.y += Math.sin(animal.angle) * pace;

  if (animal.x < 5 || animal.x > config.width - 5) {
    animal.angle = Math.PI - animal.angle;
    animal.x = Math.max(5, Math.min(config.width - 5, animal.x));
  }
  if (animal.y < 5 || animal.y > config.height - 5) {
    animal.angle = -animal.angle;
    animal.y = Math.max(5, Math.min(config.height - 5, animal.y));
  }
}

export function createWorld(seed = 1, overrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  const normalizedSeed = Number(seed) >>> 0;
  const world = {
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextId: 1,
    day: 0,
    plantGrowthRemainder: 0,
    nextEventId: 1,
    events: [],
    eventTotals: {},
    config,
    terrain: createTerrain(normalizedSeed, config),
    plants: [],
    herbivores: [],
    predators: []
  };

  for (let i = 0; i < config.initialPlants; i++) world.plants.push(createPlant(world, config));
  for (let i = 0; i < config.initialHerbivores; i++) {
    world.herbivores.push(createAnimal(world, "herbivore", config));
  }
  for (let i = 0; i < config.initialPredators; i++) {
    world.predators.push(createAnimal(world, "predator", config));
  }

  return world;
}

function updateHydrology(world, environment) {
  const { columns, rows, cells } = world.terrain;
  const runoff = new Array(cells.length).fill(0);
  const moistureDelta = new Array(cells.length).fill(0);

  // Rain first reaches the surface. A portion infiltrates the soil; excess
  // water runs towards the lowest neighbouring cell without order bias.
  for (const cell of cells) {
    const weatherVariation = 0.75 + hashTerrain(world.seed, cell.x, cell.y, world.day ^ 0x51ED270B) * 0.5;
    cell.surfaceWater += environment.precipitation * weatherVariation;
    const infiltration = Math.min(cell.surfaceWater, (1 - cell.moisture) * 0.075);
    cell.surfaceWater -= infiltration;
    moistureDelta[cell.id] += infiltration;

    const evaporation = environment.evaporation * (0.65 + Math.max(0, environment.temperature) * 0.018);
    moistureDelta[cell.id] -= evaporation;
    cell.surfaceWater = Math.max(0, cell.surfaceWater - evaporation * 1.4);

    if (cell.surfaceWater > 0.16) {
      const neighbours = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const x = cell.x + dx;
          const y = cell.y + dy;
          if (x < 0 || x >= columns || y < 0 || y >= rows) continue;
          neighbours.push(cells[y * columns + x]);
        }
      }
      const lower = neighbours
        .filter(candidate => candidate.elevation < cell.elevation)
        .sort((a, b) => a.elevation - b.elevation || a.id - b.id)[0];
      if (lower) {
        const flow = (cell.surfaceWater - 0.16) * 0.2;
        runoff[cell.id] -= flow;
        runoff[lower.id] += flow;
      }
    }
  }

  for (const cell of cells) {
    cell.surfaceWater = Number(Math.max(0, Math.min(1, cell.surfaceWater + runoff[cell.id])).toFixed(4));
    cell.moisture = Number(Math.max(0.08, Math.min(0.98,
      cell.moisture + moistureDelta[cell.id]
    )).toFixed(4));
    // Plants prefer moist soil, but permanently saturated ground is not ideal.
    cell.biome = classifyBiome(cell);
    cell.growthWeight = Number(getHabitatSuitability(cell).toFixed(4));
  }
}

function recordEvent(world, type, details = {}) {
  world.eventTotals[type] = (world.eventTotals[type] ?? 0) + 1;
  world.events.push({
    id: world.nextEventId++,
    day: world.day,
    type,
    ...details
  });
  if (world.events.length > 200) world.events.shift();
}

export function stepWorld(world) {
  const { config } = world;
  world.day += 1;

  const environment = getEnvironment(world.day, config);
  updateHydrology(world, environment);
  const growthBudget = config.plantGrowthPerDay * environment.plantGrowthMultiplier
    + (world.plantGrowthRemainder ?? 0);
  const growthCount = Math.floor(growthBudget);
  world.plantGrowthRemainder = growthBudget - growthCount;
  for (let i = 0; i < growthCount; i++) {
    if (world.plants.length >= config.maxPlants) break;
    world.plants.push(createPlant(world, config));
  }

  const herbivoreBirths = [];
  const survivingHerbivores = [];

  // Iterate over the population that existed at the beginning of this phase.
  for (const herbivore of world.herbivores) {
    const food = selectHerbivoreFood(world, herbivore);
    moveAnimal(world, herbivore, food, config.herbivoreSpeed, config);
    herbivore.energy -= config.herbivoreDailyCost * environment.herbivoreCostMultiplier;
    herbivore.age += 1;

    if (food && distance(herbivore, food) < 9) {
      herbivore.energy += config.herbivoreFoodGain;
      recordEvent(world, "herbivore_feeding", { organismId: herbivore.id });
      const foodIndex = world.plants.findIndex(plant => plant.id === food.id);
      if (foodIndex !== -1) world.plants.splice(foodIndex, 1);
    }

    if (herbivore.energy > config.herbivoreBirthThreshold &&
        world.herbivores.length + herbivoreBirths.length < config.maxHerbivores) {
      herbivore.energy *= 0.53;
      const newborn = createAnimal(
        world, "herbivore", config,
        herbivore.x + random(world, -8, 8),
        herbivore.y + random(world, -8, 8)
      );
      herbivoreBirths.push(newborn);
      recordEvent(world, "herbivore_birth", { organismId: newborn.id, parentId: herbivore.id });
    }

    if (herbivore.energy > 0 && herbivore.age < config.herbivoreMaxAge) {
      survivingHerbivores.push(herbivore);
    } else {
      recordEvent(world, "herbivore_death", {
        organismId: herbivore.id,
        cause: herbivore.age >= config.herbivoreMaxAge ? "age" : "energy"
      });
    }
  }

  world.herbivores = survivingHerbivores.concat(herbivoreBirths);

  const predatorBirths = [];
  const survivingPredators = [];

  for (const predator of world.predators) {
    const prey = selectPredatorPrey(world, predator);
    moveAnimal(world, predator, prey, config.predatorSpeed, config);
    predator.energy -= config.predatorDailyCost * environment.predatorCostMultiplier;
    predator.age += 1;

    if (prey && distance(predator, prey) < 11) {
      predator.energy += config.predatorFoodGain;
      recordEvent(world, "predation", { predatorId: predator.id, preyId: prey.id });
      recordEvent(world, "herbivore_death", { organismId: prey.id, cause: "predation", predatorId: predator.id });
      const preyIndex = world.herbivores.findIndex(item => item.id === prey.id);
      if (preyIndex !== -1) world.herbivores.splice(preyIndex, 1);
    }

    if (predator.energy > config.predatorBirthThreshold &&
        world.predators.length + predatorBirths.length < config.maxPredators) {
      predator.energy *= 0.55;
      const newborn = createAnimal(
        world, "predator", config,
        predator.x + random(world, -8, 8),
        predator.y + random(world, -8, 8)
      );
      predatorBirths.push(newborn);
      recordEvent(world, "predator_birth", { organismId: newborn.id, parentId: predator.id });
    }

    if (predator.energy > 0 && predator.age < config.predatorMaxAge) {
      survivingPredators.push(predator);
    } else {
      recordEvent(world, "predator_death", {
        organismId: predator.id,
        cause: predator.age >= config.predatorMaxAge ? "age" : "energy"
      });
    }
  }

  world.predators = survivingPredators.concat(predatorBirths);
  return getWorldStats(world);
}

export function getWorldStats(world) {
  const habitats = Object.fromEntries(
    ["aquatic", "wetland", "forest", "grassland", "arid", "barren"].map(biome => [
      biome, { plants: 0, herbivores: 0, predators: 0 }
    ])
  );
  for (const plant of world.plants) {
    const cell = world.terrain.cells[plant.terrainCellId] ?? terrainCellAt(world, plant.x, plant.y);
    habitats[cell.biome].plants++;
  }
  for (const animal of world.herbivores) habitats[terrainCellAt(world, animal.x, animal.y).biome].herbivores++;
  for (const animal of world.predators) habitats[terrainCellAt(world, animal.x, animal.y).biome].predators++;
  return {
    day: world.day, plants: world.plants.length, herbivores: world.herbivores.length,
    predators: world.predators.length, totalOrganisms: world.herbivores.length + world.predators.length,
    habitats
  };
}

export function getWorldSnapshot(world) {
  return JSON.parse(JSON.stringify(world));
}

const SAVE_FORMAT = "wild-systems-save";
const SAVE_VERSION = 1;

export function serializeWorld(world) {
  return JSON.stringify({
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    world: getWorldSnapshot(world)
  }, null, 2);
}

export function restoreWorld(serialized) {
  let payload;
  try {
    payload = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }

  if (!payload || payload.format !== SAVE_FORMAT || payload.version !== SAVE_VERSION) {
    throw new Error("El formato o la versión del guardado no son compatibles.");
  }

  const world = payload.world;
  if (!world || !world.config ||
      !Number.isInteger(world.seed) ||
      !Number.isInteger(world.rngState) ||
      !Number.isInteger(world.nextId) ||
      !Number.isInteger(world.nextEventId) ||
      !Number.isInteger(world.day) ||
      !Array.isArray(world.plants) ||
      !Array.isArray(world.herbivores) ||
      !Array.isArray(world.predators) ||
      !Array.isArray(world.events)) {
    throw new Error("El guardado está incompleto o tiene una estructura incorrecta.");
  }

  world.config = { ...DEFAULT_CONFIG, ...world.config };
  world.terrain ??= createTerrain(world.seed, world.config);
  // Migrate 0.6 terrain cells to the hydrology-aware terrain schema.
  if (world.terrain && Array.isArray(world.terrain.cells)) {
    for (const cell of world.terrain.cells) {
      if (cell && Number.isInteger(cell.x) && Number.isInteger(cell.y)) {
        cell.surfaceWater ??= 0.02;
        cell.elevation ??= Number(hashTerrain(world.seed, cell.x, cell.y, 0xAD90777D).toFixed(4));
        cell.biome = classifyBiome(cell);
        cell.growthWeight = Number(getHabitatSuitability(cell).toFixed(4));
      }
    }
  }
  if (!world.terrain ||
      !Number.isInteger(world.terrain.columns) || world.terrain.columns < 2 || world.terrain.columns > 40 ||
      !Number.isInteger(world.terrain.rows) || world.terrain.rows < 2 || world.terrain.rows > 30 ||
      !Array.isArray(world.terrain.cells) ||
      world.terrain.cells.length !== world.terrain.columns * world.terrain.rows ||
      world.terrain.cells.some((cell, index) =>
        !cell || cell.id !== index ||
        !Number.isFinite(cell.fertility) || cell.fertility < 0 || cell.fertility > 1 ||
        !Number.isFinite(cell.moisture) || cell.moisture < 0 || cell.moisture > 1 ||
        !Number.isFinite(cell.surfaceWater) || cell.surfaceWater < 0 || cell.surfaceWater > 1 ||
        !Number.isFinite(cell.elevation) || cell.elevation < 0 || cell.elevation > 1 ||
        !Number.isFinite(cell.growthWeight) || cell.growthWeight < 0 || cell.growthWeight > 1 ||
        !Number.isFinite(cell.left) || !Number.isFinite(cell.top) ||
        !Number.isFinite(cell.width) || cell.width <= 0 ||
        !Number.isFinite(cell.height) || cell.height <= 0)) {
    throw new Error("El guardado contiene un terreno inválido.");
  }

  if (!Number.isFinite(world.config.width) || world.config.width <= 0 ||
      !Number.isFinite(world.config.height) || world.config.height <= 0 ||
      !Number.isInteger(world.config.seasonLengthDays) || world.config.seasonLengthDays < 1 || world.config.seasonLengthDays > 10000 ||
      world.day < 0 || world.nextId < 1 || world.nextEventId < 1) {
    throw new Error("El guardado contiene parámetros fuera de rango.");
  }

  world.plantGrowthRemainder ??= 0;
  if (!Number.isFinite(world.plantGrowthRemainder) || world.plantGrowthRemainder < 0 || world.plantGrowthRemainder >= 1) {
    throw new Error("El guardado contiene un acumulador de crecimiento vegetal inválido.");
  }
  world.eventTotals ??= {};
  if (!world.eventTotals || typeof world.eventTotals !== "object" || Array.isArray(world.eventTotals)) {
    throw new Error("El guardado contiene contadores de acontecimientos inválidos.");
  }

  const entities = [
    ...world.plants,
    ...world.herbivores,
    ...world.predators
  ];
  for (const entity of entities) {
    if (!Number.isInteger(entity.id) ||
        !Number.isFinite(entity.x) ||
        !Number.isFinite(entity.y) ||
        !Number.isFinite(entity.energy)) {
      throw new Error("El guardado contiene una entidad inválida.");
    }
  }

  return getWorldSnapshot(world);
}

export { DEFAULT_CONFIG };
