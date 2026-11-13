# Wild Systems

**Wild Systems** is an experimental ecosystem simulation about emergent behaviour: simple organisms follow local rules, compete for resources, reproduce, and die. The goal is to discover whether interesting, legible worlds can arise without scripting every event.

This is the first project in the repository. It deliberately starts outside the desktop-app space: the prototype runs directly in a browser, with no framework, build step, account, or installation.

## Prototype 0.1

Open [index.html](./index.html) in a modern browser.

The current model contains:
- **Vegetation** that regrows over time.
- **Herbivores** that seek nearby vegetation, consume energy, reproduce, and die.
- **Predators** that hunt herbivores and reproduce when well-fed.
- A controllable simulation: pause, advance one day, reset, and change speed.

The prototype is intentionally small. It is a test bench for the central question: can a compact set of understandable rules produce population dynamics worth exploring?

## Current limitations

- The world is a continuous 2D plane with reflecting borders.
- Organisms use nearest-target steering; there is no memory, territory, genetics, or social behaviour.
- The simulation is not yet deterministic or saveable.
- Population updates are a simple model, not a scientifically calibrated ecological model.
- Rendering and simulation currently share one file and one update loop.

## Direction

The project can grow into a rich simulation sandbox, not just a screensaver:

1. **Reliable simulation core** — fixed-step updates, seeded randomness, reproducible runs, and automated tests.
2. **Richer ecology** — seasons, terrain, food chains, disease, carrying capacity, and environmental pressures.
3. **Evolution** — heritable traits, mutation, selection, and measurable adaptation.
4. **Observation tools** — population histories, event log, species lineage, and world inspection.
5. **World authoring** — editable rules, scenario presets, and shareable simulation seeds.
6. **Long-running worlds** — save/load, performance profiling, and larger populations.

## First validation questions

- Do populations settle into stable cycles, collapse, or oscillate?
- Which parameters produce interesting behaviour rather than immediate extinction or runaway growth?
- Can a user understand *why* a population changed?
- Is the simulation engaging enough to justify a deeper editor and observation toolkit?

## Development principle

Do not add complexity merely because it is possible. Each new mechanic should create observable consequences and be measurable in experiments.
