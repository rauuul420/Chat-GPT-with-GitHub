# Changelog

Notable changes to Wild Systems are documented here.

## [0.13.0] — 2026-11-13

- Added population standard deviation and coefficient of variation across experiment runs.
- Included variability metrics in batch summaries and CSV exports.
- Added deterministic and zero-population variability tests.


## [0.12.0] — 2026-11-13

- Added validated JSON export/import for reproducible experiment settings.
- Preserved accumulated experiment results when importing a new settings file.
- Added automated tests for settings round-trips and invalid configuration rejection.


## [0.11.0] — 2026-11-13

- Added species-specific juvenile maturation: herbivores mature at 30 days and predators at 45 days by default.
- Added experiment overrides for both maturity ages.
- Added juvenile/adult life-stage information to the organism inspector.
- Added live juvenile/adult population counts, experiment summaries, and CSV fields.
- Validated maturity settings and migrated older saves to the new defaults.
- Updated the project version to 0.11.0.

## [0.10.0] — 2026-11-13

- Added heritable speed, metabolism, and feeding-efficiency traits.
- Added bounded independent mutations during asexual reproduction.
- Applied traits to movement, energy costs, food gains, and predator strike distance.
- Added generation and parent lineage tracking with backward-compatible save migration.
- Added live trait averages and ranges, experiment trait-shift summaries, and CSV export fields.
- Added tests for inheritance, mutation, trait effects, and genetic statistics.

## [0.9.0] — 2026-11-13

- Added habitat-aware herbivore and predator target selection.
- Added live population distribution by biome.
- Added tests for habitat statistics and target-selection behaviour.
