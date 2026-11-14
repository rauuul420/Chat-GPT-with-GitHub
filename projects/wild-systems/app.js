import { createWorld, stepWorld, getWorldStats, serializeWorld, restoreWorld } from "./core.js";
import { runExperiment, summarizeExperiments, getExperimentScenario, EXPERIMENT_PARAMETER_DEFINITIONS, serializeExperimentSettings, restoreExperimentSettings } from "./experiments.js";
import { getEnvironment } from "./environment.js";

const canvas = document.querySelector("#world");
const context = canvas.getContext("2d");
const historyCanvas = document.querySelector("#history");
const historyContext = historyCanvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;
const element = id => document.getElementById(id);
const HISTORY_LIMIT = 300;
const experimentParameterDefinitions = EXPERIMENT_PARAMETER_DEFINITIONS;
const STEP_INTERVAL = 1000 / 30;

let world = createWorld(Math.floor(Math.random() * 0xFFFFFFFF) >>> 0);
let running = true;
let speed = 1;
let previousTime = 0;
let accumulator = 0;
let history = [];
let selectedOrganism = null;

function recordHistory() {
  const stats = getWorldStats(world);
  history.push({
    day: stats.day,
    plants: stats.plants,
    herbivores: stats.herbivores,
    predators: stats.predators
  });
  if (history.length > HISTORY_LIMIT) history.shift();
}

function renderInspector() {
  const panel = element("organism-inspector");
  if (!selectedOrganism) {
    panel.textContent = "Haz clic sobre un herbívoro o depredador para inspeccionarlo.";
    return;
  }

  const population = selectedOrganism.species === "herbivore" ? world.herbivores : world.predators;
  const organism = population.find(item => item.id === selectedOrganism.id);
  if (!organism) {
    panel.textContent = `El organismo #${selectedOrganism.id} ya no está vivo.`;
    selectedOrganism = null;
    return;
  }

  const species = organism.species === "herbivore" ? "Herbívoro" : "Depredador";
  const traits = organism.traits ?? { speed: 1, metabolism: 1, efficiency: 1 };
  const generation = organism.generation ?? 0;
  const lineage = organism.parentId === null || organism.parentId === undefined
    ? "fundador"
    : "descendiente de #" + organism.parentId;
  const maturityAge = organism.species === "herbivore"
    ? world.config.herbivoreMaturityAge
    : world.config.predatorMaturityAge;
  const lifeStage = organism.age >= maturityAge ? "adulto" : "juvenil";
  panel.textContent = `${species} #${organism.id} · ${lifeStage} · Edad: ${organism.age} días · Energía: ${organism.energy.toFixed(1)} · Generación: ${generation} · ${lineage} · Velocidad: ${traits.speed.toFixed(2)}× · Metabolismo: ${traits.metabolism.toFixed(2)}× · Eficiencia: ${traits.efficiency.toFixed(2)}×`;
}

function renderEvents() {
  const list = element("event-log");
  list.replaceChildren();
  const recent = world.events.slice(-8).reverse();
  if (recent.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Todavía no ha ocurrido nada destacable.";
    list.append(empty);
    return;
  }

  const descriptions = {
    herbivore_feeding: event => `Herbívoro #${event.organismId} encontró alimento`,
    herbivore_birth: event => `Nació el herbívoro #${event.organismId}`,
    predator_birth: event => `Nació el depredador #${event.organismId}`,
    herbivore_death: event => `Herbívoro #${event.organismId} murió`,
    predator_death: event => `Depredador #${event.organismId} murió`,
    predation: event => `Depredador #${event.predatorId} cazó al herbívoro #${event.preyId}`
  };

  for (const event of recent) {
    const item = document.createElement("li");
    item.textContent = `Día ${event.day} · ${descriptions[event.type]?.(event) ?? "Acontecimiento del ecosistema"}`;
    list.append(item);
  }
}

function updateStats() {
  const stats = getWorldStats(world);
  element("herb").textContent = stats.herbivores;
  element("pred").textContent = stats.predators;
  element("plants").textContent = stats.plants;
  element("day").textContent = stats.day;
  const environment = getEnvironment(world.day, world.config);
  element("environment").textContent = `${environment.seasonLabel} · ${environment.temperature} °C · Día ${environment.dayInSeason}/${environment.seasonLengthDays}`;
  element("speed").textContent = `${speed}× velocidad`;
  const habitatNames = { aquatic: "Agua", wetland: "Humedal", forest: "Bosque", grassland: "Pradera", arid: "Árido", barren: "Desnudo" };
  const habitatPanel = element("habitat-stats");
  habitatPanel.replaceChildren();
  for (const [biome, counts] of Object.entries(stats.habitats)) {
    const line = document.createElement("div");
    line.textContent = `${habitatNames[biome]}: ${counts.herbivores} herbívoros · ${counts.predators} depredadores · ${counts.plants} plantas`;
    habitatPanel.append(line);
  }
  const lifeStagePanel = element("life-stage-stats");
  lifeStagePanel.replaceChildren();
  for (const [species, label] of [["herbivores", "Herbívoros"], ["predators", "Depredadores"]]) {
    const stages = stats.lifeStages[species];
    const line = document.createElement("div");
    line.textContent = `${label}: ${stages.juveniles} juveniles · ${stages.adults} adultos`;
    lifeStagePanel.append(line);
  }
  const geneticsPanel = element("genetics-stats");
  geneticsPanel.replaceChildren();
  for (const [species, label] of [["herbivores", "Herbívoros"], ["predators", "Depredadores"]]) {
    const traits = stats.genetics[species];
    const line = document.createElement("div");
    const range = key => {
      const values = traits.distribution[key];
      return `${traits[key].toFixed(2)}× [${values.min.toFixed(2)}–${values.max.toFixed(2)}]`;
    };
    line.textContent = `${label}: velocidad ${range("speed")} · metabolismo ${range("metabolism")} · eficiencia ${range("efficiency")} · generación media ${traits.averageGeneration.toFixed(1)}`;
    geneticsPanel.append(line);
  }
  renderEvents();
  renderInspector();
}

function drawWorld() {
  context.fillStyle = "#17261b";
  context.fillRect(0, 0, width, height);

  const biomeColors = {
    aquatic: "#285b79", wetland: "#477b70", forest: "#315b39",
    grassland: "#718b45", arid: "#9a8050", barren: "#686c61"
  };
  for (const cell of world.terrain.cells) {
    context.globalAlpha = 0.28 + cell.growthWeight * 0.42;
    context.fillStyle = biomeColors[cell.biome] ?? "#52634b";
    context.fillRect(cell.left, cell.top, cell.width, cell.height);
    context.globalAlpha = 1;
    if (cell.surfaceWater > 0.035) {
      context.fillStyle = `rgba(55, 145, 190, ${Math.min(0.48, cell.surfaceWater * 1.8).toFixed(3)})`;
      context.fillRect(cell.left, cell.top, cell.width, cell.height);
    }
  }

  context.strokeStyle = "#263a2a";
  context.lineWidth = 1;

  for (let x = 0; x < width; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  for (const plant of world.plants) {
    context.globalAlpha = 0.45 + plant.energy * 0.5;
    context.fillStyle = "#9acb79";
    context.beginPath();
    context.arc(plant.x, plant.y, 1.4 + plant.energy * 1.4, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  for (const animal of world.herbivores) {
    context.fillStyle = "#e6c879";
    context.beginPath();
    context.arc(animal.x, animal.y, 3.2, 0, Math.PI * 2);
    context.fill();
    if (selectedOrganism?.species === "herbivore" && selectedOrganism.id === animal.id) {
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(animal.x, animal.y, 7, 0, Math.PI * 2);
      context.stroke();
    }
  }

  for (const animal of world.predators) {
    context.fillStyle = "#d77e69";
    context.beginPath();
    context.arc(animal.x, animal.y, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#f0b19e";
    context.lineWidth = 1;
    context.stroke();
    if (selectedOrganism?.species === "predator" && selectedOrganism.id === animal.id) {
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(animal.x, animal.y, 9, 0, Math.PI * 2);
      context.stroke();
    }
  }
}

function drawHistory() {
  const ctx = historyContext;
  const chartWidth = historyCanvas.width;
  const chartHeight = historyCanvas.height;
  const left = 42;
  const right = chartWidth - 12;
  const top = 12;
  const bottom = chartHeight - 24;
  const plotWidth = right - left;
  const plotHeight = bottom - top;

  ctx.clearRect(0, 0, chartWidth, chartHeight);
  ctx.fillStyle = "#17261b";
  ctx.fillRect(0, 0, chartWidth, chartHeight);

  const maximum = Math.max(10, ...history.map(point =>
    Math.max(point.plants, point.herbivores, point.predators)
  ));
  ctx.font = "11px ui-sans-serif, system-ui";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#304333";
  ctx.fillStyle = "#829582";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = top + (plotHeight * i) / 4;
    const value = Math.round(maximum * (1 - i / 4));
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillText(String(value), left - 8, y);
  }

  const series = [
    { key: "plants", color: "#9acb79" },
    { key: "herbivores", color: "#e6c879" },
    { key: "predators", color: "#d77e69" }
  ];

  for (const line of series) {
    if (history.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2;
    history.forEach((point, index) => {
      const x = left + (index / (HISTORY_LIMIT - 1)) * plotWidth;
      const y = bottom - (point[line.key] / maximum) * plotHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.fillStyle = "#829582";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(history.length ? `Día ${history[0].day}` : "Historial", left, chartHeight - 6);
  ctx.textAlign = "right";
  ctx.fillText(history.length ? `Día ${history[history.length - 1].day}` : "", right, chartHeight - 6);
}

function resetWorld(seedValue = null) {
  const seed = seedValue === null
    ? Math.floor(Math.random() * 0xFFFFFFFF) >>> 0
    : seedValue >>> 0;
  world = createWorld(seed);
  selectedOrganism = null;
  element("seed").value = String(seed);
  history = [];
  accumulator = 0;
  recordHistory();
  element("seed-error").textContent = "";
  updateStats();
  drawWorld();
  drawHistory();
}

function animate(timestamp) {
  if (!previousTime) previousTime = timestamp;
  const elapsed = Math.min(timestamp - previousTime, 250);
  previousTime = timestamp;

  if (running) {
    accumulator += elapsed * speed;
    let steps = 0;
    while (accumulator >= STEP_INTERVAL && steps < 8) {
      stepWorld(world);
      recordHistory();
      accumulator -= STEP_INTERVAL;
      steps += 1;
    }
    if (steps > 0) updateStats();
  }

  drawWorld();
  drawHistory();
  requestAnimationFrame(animate);
}

canvas.addEventListener("click", event => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (width / rect.width);
  const y = (event.clientY - rect.top) * (height / rect.height);
  let nearest = null;
  let nearestDistance = Infinity;

  for (const animal of [...world.herbivores, ...world.predators]) {
    const currentDistance = Math.hypot(animal.x - x, animal.y - y);
    if (currentDistance < nearestDistance) {
      nearest = animal;
      nearestDistance = currentDistance;
    }
  }

  selectedOrganism = nearest && nearestDistance <= 14
    ? { species: nearest.species, id: nearest.id }
    : null;
  updateStats();
  drawWorld();
});

element("toggle").addEventListener("click", () => {
  running = !running;
  element("toggle").textContent = running ? "Pausar" : "Reanudar";
});

element("step").addEventListener("click", () => {
  if (!running) {
    stepWorld(world);
    recordHistory();
    updateStats();
    drawWorld();
    drawHistory();
  }
});

element("reset").addEventListener("click", () => resetWorld());

element("save-world").addEventListener("click", () => {
  const blob = new Blob([serializeWorld(world)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wild-systems-seed-${world.seed}-day-${world.day}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

element("load-world").addEventListener("click", () => element("world-file").click());

element("world-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    world = restoreWorld(await file.text());
    selectedOrganism = null;
    element("seed").value = String(world.seed);
    const stats = getWorldStats(world);
    history = [{
      day: stats.day,
      plants: stats.plants,
      herbivores: stats.herbivores,
      predators: stats.predators
    }];
    accumulator = 0;
    element("seed-error").textContent = "";
    updateStats();
    drawWorld();
    drawHistory();
  } catch (error) {
    element("seed-error").textContent = error.message || "No se pudo cargar el mundo.";
  } finally {
    event.target.value = "";
  }
});

element("apply-seed").addEventListener("click", () => {
  const value = Number(element("seed").value);
  if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
    element("seed-error").textContent = "Introduce un entero entre 0 y 4294967295.";
    return;
  }
  resetWorld(value);
});

element("slower").addEventListener("click", () => {
  speed = Math.max(1, speed - 1);
  updateStats();
});

element("faster").addEventListener("click", () => {
  speed = Math.min(12, speed + 1);
  updateStats();
});

element("seed").value = String(world.seed);
recordHistory();
updateStats();
drawWorld();
drawHistory();
requestAnimationFrame(animate);

function renderExperimentResults(results) {
  const body = element("experiment-results");
  body.replaceChildren();

  for (const result of results) {
    const row = document.createElement("tr");
    for (const value of [
      result.scenarioLabel,
      result.seed,
      result.final.herbivores,
      result.final.predators,
      result.final.plants,
      result.extinctionDays.herbivores ?? "—",
      result.extinctionDays.predators ?? "—"
    ]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  }

  const groups = new Map();
  for (const result of results) {
    const groupKey = `${result.scenario}:${JSON.stringify(result.config)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(result);
  }

  element("experiment-summary").replaceChildren();
  for (const group of groups.values()) {
    const summary = summarizeExperiments(group);
    const line = document.createElement("p");
    const parameters = Object.entries(group[0].config).map(([key, value]) => `${key}: ${value}`).join(", ") || "valores base";
    const change = species => {
      const values = summary.averageGeneticChange[species];
      const signed = value => `${value > 0 ? "+" : ""}${value.toFixed(3)}`;
      return `velocidad ${signed(values.speed)}, metabolismo ${signed(values.metabolism)}, eficiencia ${signed(values.efficiency)}`;
    };
    line.textContent =
      `${group[0].scenarioLabel} (${parameters}) · ${summary.runs} ejecuciones · Media final: ${summary.averageFinal.herbivores.toFixed(1)} herbívoros, ${summary.averageFinal.predators.toFixed(1)} depredadores y ${summary.averageFinal.plants.toFixed(1)} plantas · Rango final (mín./mediana/máx.): herbívoros ${summary.finalDistribution.herbivores.min}/${summary.finalDistribution.herbivores.median}/${summary.finalDistribution.herbivores.max}, depredadores ${summary.finalDistribution.predators.min}/${summary.finalDistribution.predators.median}/${summary.finalDistribution.predators.max}, plantas ${summary.finalDistribution.plants.min}/${summary.finalDistribution.plants.median}/${summary.finalDistribution.plants.max} · Variabilidad CV: herbívoros ${(summary.averageVariability.herbivores.coefficientOfVariation * 100).toFixed(1)}%, depredadores ${(summary.averageVariability.predators.coefficientOfVariation * 100).toFixed(1)}%, plantas ${(summary.averageVariability.plants.coefficientOfVariation * 100).toFixed(1)}% · Estructura final media: herbívoros ${summary.averageLifeStages.herbivores.juveniles.toFixed(1)} juveniles/${summary.averageLifeStages.herbivores.adults.toFixed(1)} adultos, depredadores ${summary.averageLifeStages.predators.juveniles.toFixed(1)} juveniles/${summary.averageLifeStages.predators.adults.toFixed(1)} adultos · Cambio genético medio: herbívoros (${change("herbivores")}), depredadores (${change("predators")}) · Extinción: herbívoros ${summary.herbivoreExtinctionRate}%, depredadores ${summary.predatorExtinctionRate}%.`;
    element("experiment-summary").append(line);
  }
}

element("experiment-scenario-description").textContent = getExperimentScenario(element("experiment-scenario").value).description;
element("experiment-scenario").addEventListener("change", () => {
  element("experiment-scenario-description").textContent =
    getExperimentScenario(element("experiment-scenario").value).description;
});

let lastExperimentResults = [];

element("run-experiment").addEventListener("click", async () => {
  const runs = Number(element("experiment-runs").value);
  const days = Number(element("experiment-days").value);
  const baseSeed = Number(element("experiment-seed").value);
  const customConfig = {};
  let invalidParameter = false;
  for (const definition of experimentParameterDefinitions) {
    const raw = element(definition.id).value.trim();
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < definition.min || value > definition.max ||
        (definition.integer && !Number.isInteger(value))) {
      invalidParameter = true;
      break;
    }
    customConfig[definition.key] = value;
  }

  if (invalidParameter) {
    element("experiment-status").textContent = "Hay un parámetro fuera de rango. Revisa los límites indicados.";
    return;
  }

  if (!Number.isInteger(runs) || runs < 1 || runs > 20 ||
      !Number.isInteger(days) || days < 1 || days > 3000 ||
      !Number.isInteger(baseSeed) || baseSeed < 0 || baseSeed > 4294967295) {
    element("experiment-status").textContent = "Revisa los valores: 1–20 ejecuciones, 1–3000 días y una semilla válida.";
    return;
  }

  if (lastExperimentResults.length + runs > 500) {
    element("experiment-status").textContent = "El laboratorio conserva hasta 500 ejecuciones. Exporta y limpia resultados antes de continuar.";
    return;
  }

  const scenario = getExperimentScenario(element("experiment-scenario").value);
  const experimentConfig = { ...scenario.config, ...customConfig };
  const button = element("run-experiment");
  button.disabled = true;
  element("experiment-scenario").disabled = true;
  element("clear-experiments").disabled = true;
  element("export-experiments").disabled = true;
  element("export-experiment-settings").disabled = true;
  element("import-experiment-settings").disabled = true;
  for (const id of ["experiment-plant-growth","experiment-season-length","experiment-herbivore-cost","experiment-predator-cost","experiment-predator-speed","experiment-herbivore-maturity","experiment-predator-maturity"]) element(id).disabled = true;
  element("experiment-status").textContent = "Añadiendo resultados al laboratorio…";

  try {
    for (let index = 0; index < runs; index++) {
      const seed = (baseSeed + Math.imul(index, 0x9E3779B9)) >>> 0;
      const result = runExperiment(seed, days, experimentConfig);
      result.scenario = scenario.id;
      result.scenarioLabel = scenario.label;
      result.config = experimentConfig;
      lastExperimentResults.push(result);
      element("experiment-status").textContent = `Ejecutando experimento ${index + 1} de ${runs}…`;
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    renderExperimentResults(lastExperimentResults);
    element("experiment-status").textContent = `Añadidos ${runs} mundos × ${days} días. Total acumulado: ${lastExperimentResults.length} ejecuciones.`;
  } catch (error) {
    renderExperimentResults(lastExperimentResults);
    element("experiment-status").textContent = error.message || "No se pudieron completar los experimentos.";
  } finally {
    button.disabled = false;
    element("clear-experiments").disabled = false;
    element("export-experiments").disabled = false;
    element("export-experiment-settings").disabled = false;
    element("import-experiment-settings").disabled = false;
    element("experiment-scenario").disabled = false;
    for (const id of ["experiment-plant-growth","experiment-season-length","experiment-herbivore-cost","experiment-predator-cost","experiment-predator-speed","experiment-herbivore-maturity","experiment-predator-maturity"]) element(id).disabled = false;
  }
});

element("clear-experiments").addEventListener("click", () => {
  lastExperimentResults = [];
  element("experiment-results").replaceChildren();
  element("experiment-summary").replaceChildren();
  element("experiment-status").textContent = "Resultados eliminados.";
});

element("export-experiments").addEventListener("click", () => {
  if (lastExperimentResults.length === 0) {
    element("experiment-status").textContent = "Primero ejecuta un experimento.";
    return;
  }

  const headers = ["scenario","seed","days","final_plants","final_herbivores","final_predators","herbivore_extinction_day","predator_extinction_day","mean_plants","mean_herbivores","mean_predators","peak_plants","peak_herbivores","peak_predators","final_herbivore_juveniles","final_herbivore_adults","final_predator_juveniles","final_predator_adults","plants_std_dev","plants_cv","herbivores_std_dev","herbivores_cv","predators_std_dev","predators_cv","herbivore_mean_speed","herbivore_mean_metabolism","herbivore_mean_efficiency","herbivore_mean_generation","predator_mean_speed","predator_mean_metabolism","predator_mean_efficiency","predator_mean_generation","herbivore_delta_speed","herbivore_delta_metabolism","herbivore_delta_efficiency","predator_delta_speed","predator_delta_metabolism","predator_delta_efficiency","event_totals_json","config_json"];
  const rows = lastExperimentResults.map(result => [
    result.scenario, result.seed, result.days, result.final.plants, result.final.herbivores,
    result.final.predators, result.extinctionDays.herbivores ?? "",
    result.extinctionDays.predators ?? "", result.mean.plants,
    result.mean.herbivores, result.mean.predators, result.peak.plants,
    result.peak.herbivores, result.peak.predators,
    result.final.lifeStages.herbivores.juveniles, result.final.lifeStages.herbivores.adults,
    result.final.lifeStages.predators.juveniles, result.final.lifeStages.predators.adults,
    result.variability.plants.standardDeviation, result.variability.plants.coefficientOfVariation,
    result.variability.herbivores.standardDeviation, result.variability.herbivores.coefficientOfVariation,
    result.variability.predators.standardDeviation, result.variability.predators.coefficientOfVariation,
    result.genetics.herbivores.speed, result.genetics.herbivores.metabolism,
    result.genetics.herbivores.efficiency, result.genetics.herbivores.averageGeneration,
    result.genetics.predators.speed, result.genetics.predators.metabolism,
    result.genetics.predators.efficiency, result.genetics.predators.averageGeneration,
    result.geneticChange.herbivores.speed, result.geneticChange.herbivores.metabolism,
    result.geneticChange.herbivores.efficiency, result.geneticChange.predators.speed,
    result.geneticChange.predators.metabolism, result.geneticChange.predators.efficiency,
    JSON.stringify(result.eventTotals), JSON.stringify(result.config)
  ]);
  const csv = [headers, ...rows].map(row =>
    row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")
  ).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "wild-systems-experiments.csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});


element("export-experiment-settings").addEventListener("click", () => {
  try {
    const config = {};
    for (const definition of experimentParameterDefinitions) {
      const raw = element(definition.id).value.trim();
      if (raw !== "") config[definition.key] = Number(raw);
    }
    const settings = serializeExperimentSettings({
      scenario: element("experiment-scenario").value,
      config,
      runs: Number(element("experiment-runs").value),
      days: Number(element("experiment-days").value),
      baseSeed: Number(element("experiment-seed").value)
    });
    const url = URL.createObjectURL(new Blob([settings], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wild-systems-experiment-settings.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    element("experiment-status").textContent = "Configuración exportada.";
  } catch (error) {
    element("experiment-status").textContent = error.message || "No se pudo exportar la configuración.";
  }
});

element("import-experiment-settings").addEventListener("click", () => {
  element("experiment-settings-file").click();
});

element("experiment-settings-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const settings = restoreExperimentSettings(await file.text());
    element("experiment-scenario").value = settings.scenario;
    element("experiment-scenario-description").textContent =
      getExperimentScenario(settings.scenario).description;
    for (const definition of experimentParameterDefinitions) {
      element(definition.id).value = settings.config[definition.key] ?? "";
    }
    element("experiment-runs").value = String(settings.runs);
    element("experiment-days").value = String(settings.days);
    element("experiment-seed").value = String(settings.baseSeed);
    element("experiment-status").textContent = "Configuración importada. Los resultados existentes se han conservado.";
  } catch (error) {
    element("experiment-status").textContent = error.message || "No se pudo importar la configuración.";
  } finally {
    event.target.value = "";
  }
});
