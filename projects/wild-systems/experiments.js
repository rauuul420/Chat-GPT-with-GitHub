import { createWorld, stepWorld, getWorldStats } from "./core.js";

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
    eventTotals: { ...world.eventTotals }
  };
}

export function summarizeExperiments(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new RangeError("Se necesita al menos un resultado para calcular el resumen.");
  }

  const averageFinal = { plants: 0, herbivores: 0, predators: 0 };
  for (const result of results) {
    for (const species of Object.keys(averageFinal)) {
      averageFinal[species] += result.final[species] / results.length;
    }
  }

  return {
    runs: results.length,
    averageFinal,
    herbivoreExtinctionRate: Math.round(
      results.filter(result => result.extinctionDays.herbivores !== null).length / results.length * 100
    ),
    predatorExtinctionRate: Math.round(
      results.filter(result => result.extinctionDays.predators !== null).length / results.length * 100
    )
  };
}
