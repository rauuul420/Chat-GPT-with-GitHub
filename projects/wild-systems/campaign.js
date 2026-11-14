import { runExperiment, summarizeExperiments, getExperimentScenario } from "./experiments.js";

const MAX_CAMPAIGN_RUNS = 1000;
const MAX_CAMPAIGN_DAYS = 3000;

function validateCampaign(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new TypeError("La campaña debe definirse mediante un objeto.");
  }
  const scenario = getExperimentScenario(settings.scenario ?? "balanced");
  const runs = settings.runs ?? 100;
  const days = settings.days ?? 1000;
  const baseSeed = settings.baseSeed ?? 20261114;

  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_CAMPAIGN_RUNS) {
    throw new RangeError(`Las ejecuciones deben estar entre 1 y ${MAX_CAMPAIGN_RUNS}.`);
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_CAMPAIGN_DAYS) {
    throw new RangeError(`Los días deben estar entre 1 y ${MAX_CAMPAIGN_DAYS}.`);
  }
  if (!Number.isInteger(baseSeed) || baseSeed < 0 || baseSeed > 0xFFFFFFFF) {
    throw new RangeError("La semilla base debe ser un entero entre 0 y 4294967295.");
  }

  return { scenario, runs, days, baseSeed };
}

export function runExperimentCampaign(settings = {}) {
  const normalized = validateCampaign(settings);
  const results = Array.from({ length: normalized.runs }, (_, index) => {
    const seed = (normalized.baseSeed + index) >>> 0;
    return runExperiment(seed, normalized.days, normalized.scenario.config);
  });

  return {
    format: "wild-systems-campaign",
    version: 1,
    settings: {
      scenario: normalized.scenario.id,
      runs: normalized.runs,
      days: normalized.days,
      baseSeed: normalized.baseSeed
    },
    summary: summarizeExperiments(results),
    results
  };
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function campaignToCsv(campaign) {
  if (!campaign || campaign.format !== "wild-systems-campaign" || !Array.isArray(campaign.results)) {
    throw new TypeError("El informe de campaña no tiene un formato válido.");
  }
  const columns = [
    "seed", "days",
    "final_plants", "final_herbivores", "final_predators",
    "mean_plants", "mean_herbivores", "mean_predators",
    "peak_plants", "peak_herbivores", "peak_predators",
    "herbivore_extinction_day", "predator_extinction_day",
    "herbivore_extinction_rate_percent", "predator_extinction_rate_percent",
    "herbivore_speed_change", "herbivore_metabolism_change", "herbivore_efficiency_change",
    "predator_speed_change", "predator_metabolism_change", "predator_efficiency_change"
  ];
  const rows = campaign.results.map(result => [
    result.seed, result.days,
    result.final.plants, result.final.herbivores, result.final.predators,
    result.mean.plants, result.mean.herbivores, result.mean.predators,
    result.peak.plants, result.peak.herbivores, result.peak.predators,
    result.extinctionDays.herbivores, result.extinctionDays.predators,
    campaign.summary.herbivoreExtinctionRate, campaign.summary.predatorExtinctionRate,
    result.geneticChange.herbivores.speed, result.geneticChange.herbivores.metabolism,
    result.geneticChange.herbivores.efficiency, result.geneticChange.predators.speed,
    result.geneticChange.predators.metabolism, result.geneticChange.predators.efficiency
  ]);
  return [columns, ...rows].map(row => row.map(csvCell).join(",")).join("\n") + "\n";
}
