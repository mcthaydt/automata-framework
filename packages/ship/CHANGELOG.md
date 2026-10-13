# @mcthaydt/automata-ship

## 0.0.2

### Patch Changes

- 77be686: Inside AF, an example's game-ci job skips `Check` and the determinism checker (the `checks` job already runs
  them for every package), and `ci:local` stops repeating base-2d's check.
- 66914aa: Make the deploy test's tarball fixtures portable to bsdtar (macOS `tar`).
- @mcthaydt/automata-node@0.0.2

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
- Updated dependencies [c7ae066]
  - @mcthaydt/automata-node@0.0.1
