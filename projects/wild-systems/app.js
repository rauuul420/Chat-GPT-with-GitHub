import { createWorld, stepWorld, getWorldStats } from "./core.js";

const canvas = document.querySelector("#world");
const context = canvas.getContext("2d");
const width = canvas.width;
const height = canvas.height;
const element = id => document.getElementById(id);

let world = createWorld(Date.now() >>> 0);
let running = true;
let speed = 1;
let previousTime = 0;
let accumulator = 0;
const STEP_INTERVAL = 1000 / 30;

function updateStats() {
  const stats = getWorldStats(world);
  element("herb").textContent = stats.herbivores;
  element("pred").textContent = stats.predators;
  element("plants").textContent = stats.plants;
  element("day").textContent = stats.day;
  element("speed").textContent = `${speed}× velocidad`;
}

function draw() {
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

function resetWorld() {
  const seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
  world = createWorld(seed);
  accumulator = 0;
  updateStats();
  draw();
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
      accumulator -= STEP_INTERVAL;
      steps += 1;
    }
    if (steps > 0) updateStats();
  }

  draw();
  requestAnimationFrame(animate);
}

element("toggle").addEventListener("click", () => {
  running = !running;
  element("toggle").textContent = running ? "Pausar" : "Reanudar";
});

element("step").addEventListener("click", () => {
  if (!running) {
    stepWorld(world);
    updateStats();
    draw();
  }
});

element("reset").addEventListener("click", resetWorld);
element("slower").addEventListener("click", () => {
  speed = Math.max(1, speed - 1);
  updateStats();
});
element("faster").addEventListener("click", () => {
  speed = Math.min(12, speed + 1);
  updateStats();
});

updateStats();
draw();
requestAnimationFrame(animate);
