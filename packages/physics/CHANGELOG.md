# @mcthaydt/automata-physics

## 0.0.3

### Patch Changes

- ecf937f: Document the exports of testing and physics: the viewport, resize-observer and mount fixtures, the reference sizes and variants, the golden and snapshot round-trip checks and their reports; and the physics kinds, spawn helpers, options and collision events, in 2D and 3D.
- e686fc5: An extension declares which of its entries a game's sim may import, in its own `package.json` (`"automata": { "simEntries": ["./2d", "./3d"] }`), and `automata-check-boundaries` reads it. The two physics entries are no longer hard-coded in the checker; physics declares them. A malformed declaration is reported with the package's name.
- 50ec5a9: Depend on `zod` 4.6.6: 4.6.5 and earlier carry GHSA-mrhx-c7xc-m3w5 (a high-severity memory exhaustion while validating oversized constrained collections), which the dependency audit now reports.
- Updated dependencies [00ca723]
- Updated dependencies [25d5a68]
- Updated dependencies [0c84109]
- Updated dependencies [50ec5a9]
  - @mcthaydt/automata-sim@0.0.3

## 0.0.2

### Patch Changes

- @mcthaydt/automata-sim@0.0.2

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
- Updated dependencies [c7ae066]
  - @mcthaydt/automata-sim@0.0.1
