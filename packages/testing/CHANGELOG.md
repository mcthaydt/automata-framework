# @mcthaydt/automata-testing

## 0.0.3

### Patch Changes

- b9f9a5b: `goldenCommands({ root })` lets the browser golden read command serve golden files from a folder wider than the Vitest project's root, for a package whose goldens sit beside it (the examples runner reads `examples/__goldens__`). Additive: `goldenCommands()` keeps the project root.
  
  BREAKING: the API report counts `goldenCommands`' new optional `options` parameter as a changed signature. Existing calls, `goldenCommands()`, behave as before.
- ecf937f: Document the exports of testing and physics: the viewport, resize-observer and mount fixtures, the reference sizes and variants, the golden and snapshot round-trip checks and their reports; and the physics kinds, spawn helpers, options and collision events, in 2D and 3D.
- e6b642f: The input × form-factor matrix (M4.10): a new `@mcthaydt/automata-testing/e2e` entry with `FakePad` (a standard controller for a real built game, from FloorFifty's fake gamepad, reachable in the game's frame under a host), the touch helpers `tap`, `hold`, `swipe` and `flick`, and `INPUT_MATRIX`, the M4 spec's cells as data; and `@mcthaydt/automata-testing/input` with `fakeGamepads()`, a `navigator.getGamepads` stand-in for unit tests. `@playwright/test` is an optional peer, needed only by the `e2e` entry. The private runtime and game packages gain the active device following the host's input mode (`makeInput({ hostInput })`) and the "This controller isn't supported yet" toast for a pad without the standard mapping.
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
