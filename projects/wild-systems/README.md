# Wild Systems

**Wild Systems** is an experimental ecosystem simulation about emergent behaviour: simple organisms follow local rules, compete for resources, reproduce, and die. The goal is to discover whether interesting, legible worlds can arise without scripting every event.

The project deliberately starts outside the desktop-app space. It runs in a modern browser with native JavaScript modules and Canvas; the simulation core has no browser dependency and can be tested directly with Node.js.

## Run it

Because the app uses native JavaScript modules, serve the folder over HTTP rather than opening the HTML file directly.

From this directory, run:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

No build step or third-party dependency installation is required.

For larger offline campaigns, use the Node.js command-line runner described below.

For syntax checks and automated tests, use Node.js 20 or newer:

```bash
npm run check
npm test
```

GitHub Actions runs the test suite when files in this project change.

## Current prototype

**Version 0.13.0 — population variability analysis.** Animal target selection accounts for biome affinity and local resource or prey concentration. Individuals carry heritable speed, metabolism and feeding-efficiency traits; offspring inherit their parent's traits with small random mutations. Juveniles must reach species-specific maturity before reproducing.

- **Vegetation** regrows within a population cap, with seasonal growth rates and a bias towards fertile, moist terrain cells.
- **Terrain and biomes** form a deterministic 12 × 7 grid. Fertility, elevation, soil moisture and surface water drive six changing habitat classes: aquatic, wetland, forest, grassland, arid and barren. Each biome modifies local vegetation suitability.
- **Seasons and climate** follow a deterministic four-season calendar. Seasonal rainfall and evaporation feed a local water cycle: rain accumulates on the surface, infiltrates soil, evaporates or runs towards lower neighbouring cells. Soil moisture and surface water remain separate state variables.
- **Herbivores** choose vegetation using distance, local plant suitability and biome affinity, then consume energy, reproduce, and die.
- **Predators** favour suitable habitats and local concentrations of herbivores when selecting prey, then reproduce when sufficiently fed.
- **Genetics** gives each animal speed, metabolism and feeding-efficiency traits. Asexual offspring inherit these traits with independent small mutations; generation and parent IDs are tracked, population-average traits and their ranges are visible live, and experiment batches calculate initial-to-final trait changes for both species and export the results to CSV.
- **Life history** distinguishes juveniles from adults. Herbivores mature at 30 days and predators at 45 days by default; the experiment laboratory can override both ages.
- Pause, resume, advance one day, reset, and adjust simulation speed.
- A deterministic seeded random generator makes runs reproducible; enter a seed in the interface to replay a world.
- The simulation runs on a fixed time step, independent of display refresh rate.
- Live statistics and experiment summaries distinguish juveniles from adults in both species.
- A rolling population chart tracks vegetation, herbivores, and predators over the last 300 simulated days.
- A concise event feed reports feeding, births, deaths, and predation.
- A live habitat breakdown shows plants, herbivores and predators in each biome. Click an animal to inspect its species, ID, life stage, age, energy, generation, parent and inherited traits.
- Export and import complete world saves as versioned JSON files.
- Run batches of independent seeded worlds across five starting scenarios, compare final populations and extinction rates, and export CSV results.

## Project structure

```text
projects/wild-systems/
├── index.html          # Interface and canvas
├── app.js              # Rendering, controls, animation loop
├── experiments.js      # Scenarios and reproducible multi-run experiment runner
├── campaign.js         # Offline campaign runner and CSV report export
├── run-campaign.js     # Node.js command-line interface
├── environment.js      # Deterministic seasons and climate
├── core.js             # Pure simulation rules and world state
├── package.json        # Native Node test command
├── README.md
├── CHANGELOG.md
└── tests/
    ├── core.test.js    # Determinism and simulation invariants
    └── campaign.test.js # Offline campaign and CSV tests
```

## Experiment laboratory

The browser laboratory can run 1–20 independent worlds for up to 3,000 days per world. Choose one of five scenarios, optionally override vegetation growth, season length, daily energy costs, predator speed, and species maturity ages, then run independent seeds derived deterministically from the base seed. Results include final, mean, and peak populations, population standard deviation and coefficient of variation, first extinction day for herbivores and predators, event totals, final genetic averages, and initial-to-final trait changes. Results from different scenario runs accumulate in a comparison table with per-scenario summaries until cleared. Reusing the same base seed across scenarios helps compare different ecological conditions with a consistent seed set. The laboratory keeps up to 500 result rows in memory. Export the full table as CSV for analysis. Export and import validated JSON experiment settings to share reproducible configurations without replacing accumulated results. Batch execution yields between runs so the page can repaint and report progress.

## Offline experiment campaigns

The browser laboratory is intentionally limited to 1–20 worlds so it remains responsive. Node.js can run larger, independent campaigns without opening the browser. From this directory:

```bash
npm run campaign -- --scenario predator_pressure --runs 250 --days 1500 --seed 42000 --format csv --output campaign.csv
```

The command-line runner supports 1–1,000 worlds and 1–3,000 days per world. It uses consecutive uint32 seeds beginning at the supplied base seed, runs the same simulation engine and scenario presets as the browser, and does not change the open browser world. JSON output includes the complete per-world results and aggregate summary; CSV output contains one row per world with final, mean and peak populations, first extinction days, batch extinction rates and genetic trait shifts. Omit `--output` to write the selected format to standard output. Use `--help` for all options. Large campaigns can take substantial time and memory because the JSON report retains every per-world result.

## Genetic model

- Founders receive independent baseline values from 0.90 to 1.10 for speed, metabolism, and feeding efficiency.
- Each offspring inherits the three traits from one parent. Each trait mutates independently with an 18% probability; a mutation adds a random value from −0.08 to +0.08.
- Trait values are clamped to 0.65–1.35 and stored to three decimal places.
- Speed changes movement speed and predator strike distance; metabolism scales daily energy costs; efficiency scales energy gained from food.
- Herbivores become adults at 30 days and predators at 45 days by default. These ages can be changed in experiment runs.
- Experiment summaries report average initial-to-final trait changes. These are descriptive population shifts, not proof of natural selection or a calibrated fitness estimate.

## Model and current limitations

- The world is a continuous 2D plane with reflecting borders, overlaid by a 12 × 7 ecological grid.
- Biomes are emergent classifications, recalculated from local conditions each simulation day; they are not hand-painted map regions. Habitat suitability influences where new vegetation establishes.
- The hydrology model is intentionally simplified: it represents surface runoff between neighbouring cells, infiltration and evaporation, but not groundwater, river networks, erosion or calibrated water volumes. Plant growth is still a population-level regrowth budget distributed by local habitat suitability.
- A new world starts in spring. The seasonal year has four configurable seasons of 90 days each by default. Spring, summer, autumn and winter modify vegetation growth and daily energy costs; temperature is a deterministic indicator, not yet a physiological survival threshold.
- Organisms use habitat-weighted target selection with fixed species affinities. Genetics currently uses asexual inheritance from one parent; sexual reproduction, dominance, gene recombination, individual learning, memory, territory and social behaviour are not implemented.
- The model is an exploratory toy model, not a scientifically calibrated ecological model.
- Predators act after the herbivore phase, so newly born herbivores can be hunted on the day they are born. Newborns do not otherwise take a turn in their birth phase.
- Target selection and prey-density estimation are still direct scans; spatial indexing will matter for substantially larger worlds.
- The population chart starts a fresh history window after loading a save; historical chart samples are not yet included in save files.
- World editing is not implemented yet.

## Roadmap

### 0.2 — A trustworthy simulation core
- [x] Separate simulation rules from rendering and UI.
- [x] Add deterministic seeded randomness.
- [x] Use a fixed-step simulation clock.
- [x] Add automated tests for reproducibility and invariants.
- [x] Add continuous integration for the simulation tests.
- [x] Add a bounded event model for births, deaths, feeding, and predation.
- [x] Add versioned state serialization and restore tests.

### 0.3 — Observe the ecosystem
- [x] Population history chart (rolling 300-day window).
- [x] Event log with explanations for major population changes.
- [x] Inspect individual organisms and their current energy, age, and position.
- [x] Seed entry for reproducible experiments.
- [x] Export and import complete world state as JSON.
- [x] Reproducible multi-seed experiment batches with population and extinction summaries.
- [x] Export experiment results as CSV.
- [x] Export and import copyable experiment settings.

### 0.10 — Inherited traits and selection
- [x] Give animals heritable speed, metabolism and feeding-efficiency traits.
- [x] Add small bounded mutations during reproduction.
- [x] Make traits affect movement, energy use and feeding outcomes.
- [x] Track generation and parent lineage, including save migration.
- [x] Expose live trait averages and ranges for both populations.
- [x] Measure initial-to-final trait shifts across experiment batches and export selection indicators to CSV.

### 0.13 — Population variability analysis
- [x] Calculate daily population standard deviation and coefficient of variation.
- [x] Compare average variability across independent experiment batches.
- [x] Include variability metrics in CSV exports and summaries.

### 0.12 — Reproducible experiment configurations
- [x] Export experiment settings as versioned JSON.
- [x] Import settings with strict scenario, parameter, and run-limit validation.
- [x] Preserve accumulated results when loading a new configuration.

### 0.11 — Life-history dynamics
- [x] Add species-specific juvenile maturation before reproduction.
- [x] Expose maturity ages as experiment parameters.
- [x] Show juvenile/adult stage in the organism inspector.
- [x] Expose juvenile/adult population counts in live statistics and experiment summaries.
- [x] Validate maturity settings and preserve older saves with default values.

### 0.9 — Habitat-aware ecology
- [x] Give herbivores biome affinities when selecting vegetation.
- [x] Make predator target selection respond to biome suitability and nearby prey concentration.
- [x] Expose live plant and animal distribution by biome.
- [x] Test target selection, deterministic evolution, and habitat statistics.

### 0.8 — Emergent biomes
- [x] Classify aquatic, wetland, forest, grassland, arid and barren habitats from local environmental conditions.
- [x] Recalculate biome identity as water and soil moisture evolve.
- [x] Make habitat type influence vegetation suitability.
- [x] Visualize biome regions and distinguish surface water.
- [x] Preserve derived biome state through deterministic save migration.

### 0.7 — Local hydrology
- [x] Separate surface water from soil moisture.
- [x] Add seasonal rainfall and temperature-sensitive evaporation.
- [x] Route excess surface water towards lower neighbouring cells.
- [x] Make vegetation placement respond to moisture suitability, not simply wetter-is-better.
- [x] Migrate 0.6 terrain saves to the hydrology-aware schema.

### 0.6 — Spatial ecology
- [x] Generate reproducible fertility and moisture maps from the world seed.
- [x] Bias initial vegetation and regrowth towards resource-rich cells.
- [x] Visualize spatial variation directly on the world map.
- [x] Evolve soil moisture with seasonal rainfall and local deterministic weather.
- [x] Preserve terrain in saves and deterministically migrate older saves.
- [x] Validate terrain structure when loading saves.
- [x] Count predation as a herbivore death in lifetime event totals.

### 0.5 — A changing environment
- [x] Add a deterministic four-season calendar.
- [x] Add reproducible temperature variation.
- [x] Make vegetation growth and animal energy costs season-dependent.
- [x] Preserve seasonal growth state when saving and loading worlds.
- [x] Display the current season and temperature.

### 0.4 — More interesting worlds
- [x] Traits, inheritance, mutation, and selection.
- [x] Five scenario presets for controlled experiments.
- [x] Optional overrides for vegetation growth, energy costs, and predator speed.
- [x] Save and share custom scenario configurations.

## Validation questions

- Do populations settle into stable cycles, collapse, or oscillate?
- Which parameters produce interesting behaviour rather than immediate extinction or runaway growth?
- Can a user understand *why* a population changed?
- Is the simulation engaging enough to justify a deeper editor and observation toolkit?

## Development principle

Do not add complexity merely because it is possible. Each new mechanic should create observable consequences and be measurable in experiments.
