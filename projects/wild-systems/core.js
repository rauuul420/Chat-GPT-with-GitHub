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

function createPlant(world, config) {
  return {
    id: world.nextId++,
    x: random(world, 5, config.width - 5),
    y: random(world, 5, config.height - 5),
    energy: random(world, 0.3, 1)
  };
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
    nextEventId: 1,
    events: [],
    config,
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

function recordEvent(world, type, details = {}) {
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

  for (let i = 0; i < config.plantGrowthPerDay; i++) {
    if (world.plants.length >= config.maxPlants) break;
    world.plants.push(createPlant(world, config));
  }

  const herbivoreBirths = [];
  const survivingHerbivores = [];

  // Iterate over the population that existed at the beginning of this phase.
  for (const herbivore of world.herbivores) {
    const food = nearest(world.plants, herbivore);
    moveAnimal(world, herbivore, food, config.herbivoreSpeed, config);
    herbivore.energy -= config.herbivoreDailyCost;
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
    const prey = nearest(world.herbivores, predator);
    moveAnimal(world, predator, prey, config.predatorSpeed, config);
    predator.energy -= config.predatorDailyCost;
    predator.age += 1;

    if (prey && distance(predator, prey) < 11) {
      predator.energy += config.predatorFoodGain;
      recordEvent(world, "predation", { predatorId: predator.id, preyId: prey.id });
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
  return {
    day: world.day,
    plants: world.plants.length,
    herbivores: world.herbivores.length,
    predators: world.predators.length,
    totalOrganisms: world.herbivores.length + world.predators.length
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

  if (!Number.isFinite(world.config.width) || world.config.width <= 0 ||
      !Number.isFinite(world.config.height) || world.config.height <= 0 ||
      world.day < 0 || world.nextId < 1 || world.nextEventId < 1) {
    throw new Error("El guardado contiene parámetros fuera de rango.");
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
