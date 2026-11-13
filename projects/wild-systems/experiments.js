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
  const sums = { plants: 0, herbivores: 0, predators: 0 };
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
  return {
    seed,
    days,
    final: {
      plants: final.plants,
      herbivores: final.herbivores,
      predators: final.predators
    },
    mean: {
      plants: sums.plants / days,
      herbivores: sums.herbivores / days,
      predators: sums.predators / days
    },
    peak: {
      plants: peak.plants,
      herbivores: peak.herbivores,
      predators: peak.predators
    },
    extinctionDays,
    eventTotals: { ...world.eventTotals },
    genetics: final.genetics
  };
}

export function summarizeExperiments(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new RangeError("Se necesita al menos un resultado para calcular el resumen.");
  }

  const averageFinal = { plants: 0, herbivores: 0, predators: 0 };
  const averageGenetics = Object.fromEntries(["herbivores", "predators"].map(species => [
    species, { speed: 0, metabolism: 0, efficiency: 0, averageGeneration: 0 }
  ]));
  for (const result of results) {
    for (const species of Object.keys(averageFinal)) {
      averageFinal[species] += result.final[species] / results.length;
    }
    for (const species of ["herbivores", "predators"]) {
      for (const trait of Object.keys(averageGenetics[species])) {
        averageGenetics[species][trait] += (result.genetics?.[species]?.[trait] ?? 0) / results.length;
      }
    }
  }
  for (const species of ["herbivores", "predators"]) {
    for (const trait of Object.keys(averageGenetics[species])) {
      averageGenetics[species][trait] = Number(averageGenetics[species][trait].toFixed(3));
    }
  }

  return {
    runs: results.length,
    averageFinal,
    averageGenetics,
    herbivoreExtinctionRate: Math.round(
      results.filter(result => result.extinctionDays.herbivores !== null).length / results.length * 100
    ),
    predatorExtinctionRate: Math.round(
      results.filter(result => result.extinctionDays.predators !== null).length / results.length * 100
    )
  };
}
