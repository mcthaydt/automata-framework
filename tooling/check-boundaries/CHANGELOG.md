# @mcthaydt/automata-check-boundaries

## 0.0.3

### Patch Changes

- d4254cf: `--inline` checks one-file examples: only the arguments of `defineSystem` and `definePlugin` calls are held to the sim rules, and file-level browser code and imports are left alone. A folder walk now skips `node_modules` and `dist`, and a root may be a single file.
- e686fc5: An extension declares which of its entries a game's sim may import, in its own `package.json` (`"automata": { "simEntries": ["./2d", "./3d"] }`), and `automata-check-boundaries` reads it. The two physics entries are no longer hard-coded in the checker; physics declares them. A malformed declaration is reported with the package's name.
- 50ec5a9: Depend on `zod` 4.6.6: 4.6.5 and earlier carry GHSA-mrhx-c7xc-m3w5 (a high-severity memory exhaustion while validating oversized constrained collections), which the dependency audit now reports.

## 0.0.2

No changes in this release.

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
