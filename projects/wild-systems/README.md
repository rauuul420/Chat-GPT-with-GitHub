# Wild Systems

**Wild Systems** is an experimental ecosystem simulation about emergent behaviour: simple organisms follow local rules, compete for resources, reproduce, and die. The goal is to discover whether interesting, legible worlds can arise without scripting every event.

The project deliberately starts outside the desktop-app space. It runs in a modern browser with native JavaScript modules and Canvas; the simulation core has no browser dependency and can be tested directly with Node.js.

## Run it

Open `index.html` in a modern browser. No build step or dependency installation is required.

For automated tests, use Node.js 20 or newer:

```bash
npm test
```

## Current prototype

- **Vegetation** regrows within a population cap.
- **Herbivores** seek vegetation, consume energy, reproduce, and die.
- **Predators** hunt herbivores and reproduce when sufficiently fed.
- Pause, resume, advance one day, reset, and adjust simulation speed.
- A deterministic seeded random generator makes runs reproducible.
- The simulation runs on a fixed time step, independent of display refresh rate.

## Project structure

```text
projects/wild-systems/
├── index.html          # Interface and canvas
├── app.js              # Rendering, controls, animation loop
├── core.js             # Pure simulation rules and world state
├── package.json        # Native Node test command
├── README.md
└── tests/
    └── core.test.js    # Determinism and simulation invariants
```

## Model and current limitations

- The world is a continuous 2D plane with reflecting borders.
- Organisms use nearest-target steering; there is no memory, territory, genetics, or social behaviour yet.
- The model is an exploratory toy model, not a scientifically calibrated ecological model.
- Predators act after the herbivore phase, so newly born herbivores can be hunted on the day they are born. Newborns do not otherwise take a turn in their birth phase.
- The nearest-target search is currently linear in the number of available targets; spatial indexing will matter for larger worlds.
- Save/load, population history, and world editing are not implemented yet.

## Roadmap

### 0.2 — A trustworthy simulation core
- [x] Separate simulation rules from rendering and UI.
- [x] Add deterministic seeded randomness.
- [x] Use a fixed-step simulation clock.
- [x] Add automated tests for reproducibility and invariants.
- [ ] Add an explicit event model for births, deaths, feeding, and predation.
- [ ] Add state serialization and restore tests.

### 0.3 — Observe the ecosystem
- [ ] Population history chart.
- [ ] Event log with explanations for major population changes.
- [ ] Inspect individual organisms and their current energy/age.
- [ ] Seed entry and copyable experiment settings.

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
