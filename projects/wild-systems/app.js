import { createWorld, stepWorld, getWorldStats } from "./core.js";

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

function updateStats() {
  const stats = getWorldStats(world);
  element("herb").textContent = stats.herbivores;
  element("pred").textContent = stats.predators;
  element("plants").textContent = stats.plants;
  element("day").textContent = stats.day;
  element("speed").textContent = `${speed}× velocidad`;
  element("seed").value = String(world.seed);
}

function drawWorld() {
  context.fillStyle = "#17261b";
  context.fillRect(0, 0, width, height);
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
  }

  for (const animal of world.predators) {
    context.fillStyle = "#d77e69";
    context.beginPath();
    context.arc(animal.x, animal.y, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#f0b19e";
    context.lineWidth = 1;
    context.stroke();
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

recordHistory();
updateStats();
drawWorld();
drawHistory();
requestAnimationFrame(animate);
