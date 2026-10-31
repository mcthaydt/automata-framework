# @mcthaydt/automata-sim

## 0.0.4

No changes in this release.

## 0.0.3

### Patch Changes

- 00ca723: Add `definePlugin({ name, defs })`, which sorts one flat list of components, commands, events, resources and systems into the keyed lists, and the `defineSystem(name, run)` and `defineSystem(name, phase, run)` short forms (phase defaults to `gameplay`). Additive: existing plugins keep their schema hash.
- 25d5a68: Document `SystemSpec`, the object form of `defineSystem`.
- 0c84109: Document the sim's exports: the definition types and `define*` functions, `createSim` and the `Sim` types, the field and RNG types, the snapshot version and errors, the deterministic math functions, and the replay recorder, stepper and codec.
- 50ec5a9: Depend on `zod` 4.6.6: 4.6.5 and earlier carry GHSA-mrhx-c7xc-m3w5 (a high-severity memory exhaustion while validating oversized constrained collections), which the dependency audit now reports.

## 0.0.2

No changes in this release.

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
