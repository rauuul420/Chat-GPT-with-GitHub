import { createWorld, stepWorld, getWorldStats, serializeWorld, restoreWorld } from "./core.js";
import { runExperiment, summarizeExperiments, getExperimentScenario } from "./experiments.js";
import { getEnvironment } from "./environment.js";

const canvas = document.querySelector("#world");
const context = canvas.getContext("2d");
const historyCanvas = document.querySelector("#history");
const historyContext = historyCanvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;
const element = id => document.getElementById(id);
const HISTORY_LIMIT = 300;
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
  panel.textContent = `${species} #${organism.id} · Edad: ${organism.age} días · Energía: ${organism.energy.toFixed(1)} · Posición: ${organism.x.toFixed(1)}, ${organism.y.toFixed(1)}`;
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
  renderEvents();
  renderInspector();
}

function drawWorld() {
  context.fillStyle = "#17261b";
  context.fillRect(0, 0, width, height);

  for (const cell of world.terrain.cells) {
    const green = Math.round(48 + cell.fertility * 54);
    const blue = Math.round(28 + cell.moisture * 30);
    const alpha = (0.12 + cell.growthWeight * 0.22).toFixed(3);
    context.fillStyle = `rgba(70, ${green}, ${blue}, ${alpha})`;
    context.fillRect(cell.left, cell.top, cell.width, cell.height);
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
    line.textContent =
      `${group[0].scenarioLabel} (${parameters}) · ${summary.runs} ejecuciones · Media final: ${summary.averageFinal.herbivores.toFixed(1)} herbívoros, ${summary.averageFinal.predators.toFixed(1)} depredadores y ${summary.averageFinal.plants.toFixed(1)} plantas · Extinción: herbívoros ${summary.herbivoreExtinctionRate}%, depredadores ${summary.predatorExtinctionRate}%.`;
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
  const parameterDefinitions = [
    ["experiment-plant-growth", "plantGrowthPerDay", 0, 20, true],
    ["experiment-season-length", "seasonLengthDays", 30, 180, true],
    ["experiment-herbivore-cost", "herbivoreDailyCost", 0.01, 5, false],
    ["experiment-predator-cost", "predatorDailyCost", 0.01, 5, false],
    ["experiment-predator-speed", "predatorSpeed", 0.1, 3, false]
  ];
  let invalidParameter = false;
  for (const [id, key, minimum, maximum, integer] of parameterDefinitions) {
    const raw = element(id).value.trim();
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < minimum || value > maximum ||
        (integer && !Number.isInteger(value))) {
      invalidParameter = true;
      break;
    }
    customConfig[key] = value;
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
  for (const id of ["experiment-plant-growth","experiment-season-length","experiment-herbivore-cost","experiment-predator-cost","experiment-predator-speed"]) element(id).disabled = true;
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
    element("experiment-scenario").disabled = false;
    for (const id of ["experiment-plant-growth","experiment-season-length","experiment-herbivore-cost","experiment-predator-cost","experiment-predator-speed"]) element(id).disabled = false;
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

  const headers = ["scenario","seed","days","final_plants","final_herbivores","final_predators","herbivore_extinction_day","predator_extinction_day","mean_plants","mean_herbivores","mean_predators","peak_plants","peak_herbivores","peak_predators","event_totals_json","config_json"];
  const rows = lastExperimentResults.map(result => [
    result.scenario, result.seed, result.days, result.final.plants, result.final.herbivores,
    result.final.predators, result.extinctionDays.herbivores ?? "",
    result.extinctionDays.predators ?? "", result.mean.plants,
    result.mean.herbivores, result.mean.predators, result.peak.plants,
    result.peak.herbivores, result.peak.predators, JSON.stringify(result.eventTotals), JSON.stringify(result.config)
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
