export const SEASONS = Object.freeze([
  Object.freeze({ id: "spring", label: "Primavera", temperature: 15, plantGrowth: 1.25, moistureChange: 0.0012, herbivoreCost: 0.95, predatorCost: 0.95 }),
  Object.freeze({ id: "summer", label: "Verano", temperature: 25, plantGrowth: 1, moistureChange: -0.0012, herbivoreCost: 1.05, predatorCost: 1.05 }),
  Object.freeze({ id: "autumn", label: "Otoño", temperature: 12, plantGrowth: 0.65, moistureChange: 0.0006, herbivoreCost: 1, predatorCost: 1 }),
  Object.freeze({ id: "winter", label: "Invierno", temperature: 2, plantGrowth: 0.25, moistureChange: -0.0006, herbivoreCost: 1.2, predatorCost: 1.15 })
]);

export const DEFAULT_SEASON_LENGTH_DAYS = 90;

export function getEnvironment(day, config = {}) {
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError("El día debe ser un entero no negativo.");
  }
  const seasonLength = config.seasonLengthDays ?? DEFAULT_SEASON_LENGTH_DAYS;
  if (!Number.isInteger(seasonLength) || seasonLength < 1 || seasonLength > 10000) {
    throw new RangeError("La duración de cada estación debe estar entre 1 y 10000 días.");
  }

  const yearLength = seasonLength * SEASONS.length;
  const dayOfYear = Math.max(0, day - 1) % yearLength;
  const seasonIndex = Math.floor(dayOfYear / seasonLength);
  const season = SEASONS[seasonIndex];
  const dayInSeason = dayOfYear % seasonLength;
  const seasonalProgress = dayInSeason / seasonLength;
  const annualWave = Math.sin((dayOfYear / yearLength) * Math.PI * 2 - Math.PI / 2);
  const weatherWave = Math.sin(day * 2.399963229728653) * 1.8
    + Math.sin(day * 0.417) * 1.2;

  return {
    season: season.id,
    seasonLabel: season.label,
    dayInSeason: dayInSeason + 1,
    seasonLengthDays: seasonLength,
    dayOfYear: dayOfYear + 1,
    yearLengthDays: yearLength,
    temperature: Number((season.temperature + annualWave * 2 + weatherWave).toFixed(1)),
    plantGrowthMultiplier: season.plantGrowth,
    moistureChange: season.moistureChange,
    herbivoreCostMultiplier: season.herbivoreCost,
    predatorCostMultiplier: season.predatorCost
  };
}
