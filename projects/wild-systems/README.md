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

For syntax checks and automated tests, use Node.js 20 or newer:

```bash
npm run check
npm test
```

GitHub Actions runs the test suite when files in this project change.

## Current prototype

- **Vegetation** regrows within a population cap.
- **Herbivores** seek vegetation, consume energy, reproduce, and die.
- **Predators** hunt herbivores and reproduce when sufficiently fed.
- Pause, resume, advance one day, reset, and adjust simulation speed.
- A deterministic seeded random generator makes runs reproducible; enter a seed in the interface to replay a world.
- The simulation runs on a fixed time step, independent of display refresh rate.
- A rolling population chart tracks vegetation, herbivores, and predators over the last 300 simulated days.\n- A concise event feed reports feeding, births, deaths, and predation.\n- Export and import complete world saves as versioned JSON files.\n- Run batches of independent seeded worlds, compare final populations and extinction rates, and export CSV results.

## Project structure

```text
projects/wild-systems/
├── index.html          # Interface and canvas
├── app.js              # Rendering, controls, animation loop\n├── experiments.js      # Reproducible multi-run experiment runner
├── core.js             # Pure simulation rules and world state
├── package.json        # Native Node test command
├── README.md
└── tests/
    └── core.test.js    # Determinism and simulation invariants
```

## Experiment laboratory\n\nThe browser laboratory can run 1–20 independent worlds for up to 3,000 days per world. Each run receives a deterministic seed derived from the base seed. Results include final, mean, and peak populations, first extinction day for herbivores and predators, and event totals. Export the run table as CSV for analysis. Batch execution yields between runs so the page can repaint and report progress.\n\n## Model and current limitations

- The world is a continuous 2D plane with reflecting borders.
- Organisms use nearest-target steering; there is no memory, territory, genetics, or social behaviour yet.
- The model is an exploratory toy model, not a scientifically calibrated ecological model.
- Predators act after the herbivore phase, so newly born herbivores can be hunted on the day they are born. Newborns do not otherwise take a turn in their birth phase.
- The nearest-target search is currently linear in the number of available targets; spatial indexing will matter for larger worlds.
- The population chart starts a fresh history window after loading a save; historical chart samples are not yet included in save files.\n- World editing is not implemented yet.

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
- [ ] Inspect individual organisms and their current energy/age.
- [x] Seed entry for reproducible experiments.
- [x] Export and import complete world state as JSON.\n- [x] Reproducible multi-seed experiment batches with population and extinction summaries.\n- [x] Export experiment results as CSV.\n- [ ] Copyable experiment settings.

### 0.4 — More interesting worlds
- [ ] Seasons and environmental variation.
- [ ] Terrain and resource distribution.
- [ ] Traits, inheritance, mutation, and selection.
- [ ] Scenario presets and parameter controls.

## Validation questions

- Do populations settle into stable cycles, collapse, or oscillate?
- Which parameters produce interesting behaviour rather than immediate extinction or runaway growth?
- Can a user understand *why* a population changed?
- Is the simulation engaging enough to justify a deeper editor and observation toolkit?

## Development principle

Do not add complexity merely because it is possible. Each new mechanic should create observable consequences and be measurable in experiments.
