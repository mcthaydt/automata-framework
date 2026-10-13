# @mcthaydt/automata-content

## 0.0.2

### Patch Changes

- c763d97: Send the dev server's HMR event only when a rebuild's result actually changed, so one save — which macOS may
  report as several watcher events, and which the watcher also emits for authored files at startup — never sends
  a second, identical `automata:content` or `automata:content-error`.
- @mcthaydt/automata-sim@0.0.2

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
- 38fdbf6: Make the compiler's skipped-file test portable to a case-insensitive filesystem.
- Updated dependencies [c7ae066]
  - @mcthaydt/automata-sim@0.0.1
