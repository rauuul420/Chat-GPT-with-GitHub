#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { runExperimentCampaign, campaignToCsv } from "./campaign.js";

function parseArguments(args) {
  const options = {
    scenario: "balanced",
    runs: 100,
    days: 1000,
    baseSeed: 20261114,
    format: "json",
    output: null
  };
  const names = new Map([
    ["--scenario", "scenario"],
    ["--runs", "runs"],
    ["--days", "days"],
    ["--seed", "baseSeed"],
    ["--format", "format"],
    ["--output", "output"]
  ]);
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    const key = names.get(argument);
    if (!key) throw new Error(`Argumento desconocido: ${argument}`);
    const value = args[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`Falta el valor de ${argument}.`);
    options[key] = ["runs", "days", "baseSeed"].includes(key) ? Number(value) : value;
  }
  if (!["json", "csv"].includes(options.format)) throw new Error("--format debe ser json o csv.");
  return options;
}

const HELP = `Wild Systems · campañas experimentales offline

Uso:
  npm run campaign -- [opciones]

Opciones:
  --scenario <id>  balanced | herbivore_bloom | predator_pressure | scarce_resources | predator_free
  --runs <n>       Mundos independientes (1–1000; por defecto 100)
  --days <n>       Días por mundo (1–3000; por defecto 1000)
  --seed <n>       Primera semilla uint32 (por defecto 20261114)
  --format <tipo>  json o csv (por defecto json)
  --output <ruta>  Guarda el informe en un archivo
  --help           Muestra esta ayuda

Ejemplo:
  npm run campaign -- --scenario predator_pressure --runs 250 --days 1500 --seed 42000 --format csv --output campaign.csv
`;

export async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const campaign = runExperimentCampaign(options);
  const output = options.format === "csv"
    ? campaignToCsv(campaign)
    : JSON.stringify(campaign, null, 2) + "\n";
  if (options.output) {
    await writeFile(options.output, output, "utf8");
    process.stdout.write(`Campaña completada: ${campaign.settings.runs} mundos · ${campaign.settings.days} días · ${options.output}\n`);
  } else {
    process.stdout.write(output);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
