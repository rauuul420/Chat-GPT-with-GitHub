import { createWorld, stepWorld, getWorldStats } from "./core.js";

export const EXPERIMENT_SCENARIOS = Object.freeze({
  balanced: Object.freeze({
    label: "Ecosistema equilibrado",
    description: "Configuración base del simulador.",
    config: Object.freeze({})
  }),
  herbivore_bloom: Object.freeze({
    label: "Explosión de herbívoros",
    description: "Más herbívoros al inicio y menos presión de depredación.",
    config: Object.freeze({
      initialPlants: 300,
      initialHerbivores: 72,
      initialPredators: 3,
      maxHerbivores: 190
    })
  }),
  predator_pressure: Object.freeze({
    label: "Presión de depredadores",
    description: "Mayor población inicial de depredadores y caza más intensa.",
    config: Object.freeze({
      initialPlants: 260,
      initialHerbivores: 48,
      initialPredators: 17,
      predatorSpeed: 1.15,
      predatorDailyCost: 0.24
    })
  }),
  scarce_resources: Object.freeze({
    label: "Escasez de recursos",
    description: "Menos vegetación inicial y crecimiento lento.",
    config: Object.freeze({
      initialPlants: 65,
      initialHerbivores: 42,
      initialPredators: 8,
      plantGrowthPerDay: 1
    })
  }),
  predator_free: Object.freeze({
    label: "Sin depredadores",
    description: "Aísla la dinámica entre vegetación y herbívoros.",
    config: Object.freeze({
      initialPredators: 0,
      maxPredators: 0
    })
  })
});

export function getExperimentScenario(id) {
  const scenario = EXPERIMENT_SCENARIOS[id];
  if (!scenario) throw new RangeError("El escenario seleccionado no existe.");
  return {
    id,
    label: scenario.label,
    description: scenario.description,
    config: { ...scenario.config }
  };
}

function validateInteger(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} debe estar entre ${minimum} y ${maximum}.`);
  }
}

export function runExperiment(seed, days, config = {}) {
  validateInteger(seed, "La semilla", 0, 0xFFFFFFFF);
  validateInteger(days, "Los días", 1, 100000);

  const world = createWorld(seed, config);
  const initialGenetics = getWorldStats(world).genetics;
  const sums = { plants: 0, herbivores: 0, predators: 0 };
  const squaredSums = { plants: 0, herbivores: 0, predators: 0 };
  const peak = { ...getWorldStats(world) };
  const extinctionDays = {
    herbivores: world.herbivores.length === 0 ? 0 : null,
    predators: world.predators.length === 0 ? 0 : null
  };

  for (let day = 1; day <= days; day++) {
    stepWorld(world);
    const stats = getWorldStats(world);

    for (const species of ["plants", "herbivores", "predators"]) {
      sums[species] += stats[species];
      squaredSums[species] += stats[species] ** 2;
      peak[species] = Math.max(peak[species], stats[species]);
    }

    if (extinctionDays.herbivores === null && stats.herbivores === 0) {
      extinctionDays.herbivores = day;
    }
    if (extinctionDays.predators === null && stats.predators === 0) {
      extinctionDays.predators = day;
    }
  }

  const final = getWorldStats(world);
  const variability = Object.fromEntries(["plants", "herbivores", "predators"].map(species => {
    const mean = sums[species] / days;
    const variance = Math.max(0, squaredSums[species] / days - mean ** 2);
    const standardDeviation = Math.sqrt(variance);
    return [species, {
      standardDeviation: Number(standardDeviation.toFixed(3)),
      coefficientOfVariation: Number((mean > 0 ? standardDeviation / mean : 0).toFixed(3))
    }];
  }));
  const geneticChange = Object.fromEntries(["herbivores", "predators"].map(species => [
    species, Object.fromEntries(["speed", "metabolism", "efficiency"].map(trait => [
      trait, Number((final.genetics[species][trait] - initialGenetics[species][trait]).toFixed(3))
    ]))
  ]));
  return {
    seed,
    days,
    final: {
      plants: final.plants,
      herbivores: final.herbivores,
      predators: final.predators,
      lifeStages: final.lifeStages
    },
    mean: {
      plants: sums.plants / days,
      herbivores: sums.herbivores / days,
      predators: sums.predators / days
    },
    variability,
    peak: {
      plants: peak.plants,
      herbivores: peak.herbivores,
      predators: peak.predators
    },
    extinctionDays,
    eventTotals: { ...world.eventTotals },
    initialGenetics,
    genetics: final.genetics,
    geneticChange
  };
}

export function summarizeExperiments(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new RangeError("Se necesita al menos un resultado para calcular el resumen.");
  }

  const averageFinal = { plants: 0, herbivores: 0, predators: 0 };
  const averageVariability = Object.fromEntries(["plants", "herbivores", "predators"].map(species => [
    species, { standardDeviation: 0, coefficientOfVariation: 0 }
  ]));
  const averageLifeStages = {
    herbivores: { juveniles: 0, adults: 0 },
    predators: { juveniles: 0, adults: 0 }
  };
  const averageGenetics = Object.fromEntries(["herbivores", "predators"].map(species => [
    species, { speed: 0, metabolism: 0, efficiency: 0, averageGeneration: 0 }
  ]));
  const averageGeneticChange = Object.fromEntries(["herbivores", "predators"].map(species => [
    species, { speed: 0, metabolism: 0, efficiency: 0 }
  ]));
  for (const result of results) {
    for (const species of Object.keys(averageFinal)) {
      averageFinal[species] += result.final[species] / results.length;
      for (const metric of Object.keys(averageVariability[species])) {
        averageVariability[species][metric] += (result.variability?.[species]?.[metric] ?? 0) / results.length;
      }
    }
    for (const species of ["herbivores", "predators"]) {
      for (const stage of ["juveniles", "adults"]) {
        averageLifeStages[species][stage] += (result.final.lifeStages?.[species]?.[stage] ?? 0) / results.length;
      }
    }
    for (const species of ["herbivores", "predators"]) {
      for (const trait of Object.keys(averageGenetics[species])) {
        averageGenetics[species][trait] += (result.genetics?.[species]?.[trait] ?? 0) / results.length;
      }
      for (const trait of Object.keys(averageGeneticChange[species])) {
        averageGeneticChange[species][trait] += (result.geneticChange?.[species]?.[trait] ?? 0) / results.length;
      }
    }
  }
  for (const species of ["plants", "herbivores", "predators"]) {
    for (const metric of Object.keys(averageVariability[species])) {
      averageVariability[species][metric] = Number(averageVariability[species][metric].toFixed(3));
    }
  }
  for (const species of ["herbivores", "predators"]) {
    for (const trait of Object.keys(averageGenetics[species])) {
      averageGenetics[species][trait] = Number(averageGenetics[species][trait].toFixed(3));
    }
    for (const trait of Object.keys(averageGeneticChange[species])) {
      averageGeneticChange[species][trait] = Number(averageGeneticChange[species][trait].toFixed(3));
    }
  }

  return {
    runs: results.length,
    averageFinal,
    averageVariability,
    averageLifeStages,
    averageGenetics,
    averageGeneticChange,
    herbivoreExtinctionRate: Math.round(
      results.filter(result => result.extinctionDays.herbivores !== null).length / results.length * 100
    ),
    predatorExtinctionRate: Math.round(
      results.filter(result => result.extinctionDays.predators !== null).length / results.length * 100
    )
  };
}


export const EXPERIMENT_PARAMETER_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "experiment-plant-growth", key: "plantGrowthPerDay", min: 0, max: 20, integer: true }),
  Object.freeze({ id: "experiment-season-length", key: "seasonLengthDays", min: 30, max: 180, integer: true }),
  Object.freeze({ id: "experiment-herbivore-cost", key: "herbivoreDailyCost", min: 0.01, max: 5, integer: false }),
  Object.freeze({ id: "experiment-predator-cost", key: "predatorDailyCost", min: 0.01, max: 5, integer: false }),
  Object.freeze({ id: "experiment-predator-speed", key: "predatorSpeed", min: 0.1, max: 3, integer: false }),
  Object.freeze({ id: "experiment-herbivore-maturity", key: "herbivoreMaturityAge", min: 1, max: 365, integer: true }),
  Object.freeze({ id: "experiment-predator-maturity", key: "predatorMaturityAge", min: 1, max: 365, integer: true })
]);

const EXPERIMENT_SETTINGS_FORMAT = "wild-systems-experiment-settings";
const EXPERIMENT_SETTINGS_VERSION = 1;

function normalizeExperimentSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("La configuración del experimento debe ser un objeto JSON.");
  }
  const scenario = getExperimentScenario(value.scenario);
  validateInteger(value.runs, "Las ejecuciones", 1, 20);
  validateInteger(value.days, "Los días por mundo", 1, 3000);
  validateInteger(value.baseSeed, "La semilla base", 0, 0xFFFFFFFF);
  const suppliedConfig = value.config ?? {};
  if (!suppliedConfig || typeof suppliedConfig !== "object" || Array.isArray(suppliedConfig)) {
    throw new Error("Los parámetros de la configuración no son válidos.");
  }
  const config = {};
  for (const [key, parameter] of Object.entries(suppliedConfig)) {
    const definition = EXPERIMENT_PARAMETER_DEFINITIONS.find(item => item.key === key);
    if (!definition) throw new RangeError(`El parámetro ${key} no está permitido en una configuración compartida.`);
    if (!Number.isFinite(parameter) || parameter < definition.min || parameter > definition.max ||
        (definition.integer && !Number.isInteger(parameter))) {
      throw new RangeError(`El parámetro ${key} debe estar entre ${definition.min} y ${definition.max}${definition.integer ? " y ser entero" : ""}.`);
    }
    config[key] = parameter;
  }
  return {
    scenario: scenario.id,
    config,
    runs: value.runs,
    days: value.days,
    baseSeed: value.baseSeed
  };
}

export function serializeExperimentSettings(settings) {
  const normalized = normalizeExperimentSettings(settings);
  return JSON.stringify({
    format: EXPERIMENT_SETTINGS_FORMAT,
    version: EXPERIMENT_SETTINGS_VERSION,
    ...normalized
  }, null, 2);
}

export function restoreExperimentSettings(serialized) {
  let payload;
  try {
    payload = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  } catch {
    throw new Error("El archivo de configuración no contiene JSON válido.");
  }
  if (!payload || payload.format !== EXPERIMENT_SETTINGS_FORMAT ||
      payload.version !== EXPERIMENT_SETTINGS_VERSION) {
    throw new Error("El formato o la versión de la configuración no son compatibles.");
  }
  return normalizeExperimentSettings(payload);
}
