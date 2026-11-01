# @mcthaydt/automata-testing

## 0.0.5

### Patch Changes

- 6d60a91: The packages import nothing of Ruken's outside a `ruken/` folder (DIST.3a, ADR 0006).
  
  - `@mcthaydt/automata-content` owns the game config (`GameConfig`, `gameConfigSchema`, `RENDERERS`, `ORIENTATIONS`,
    `INPUTS`, `RATINGS`, `LEADERBOARD_ORDERS`, `GAME_ID_PATTERN`), also from the browser-safe
    `@mcthaydt/automata-content/game-config` entry. The keys are Ruken's manifest names, unchanged, and a test holds
    AF's lists to Ruken's.
  - `ShipConfig` extends that `GameConfig`. `game.sdk` is optional; `prepare --target ruken` refuses a config without
    it, through Ruken's own parser. Every existing `ship.config.ts` type-checks unchanged.
  - `defineExtension`'s `GameConfig` and `defineGame`'s id check use the game config.
  - `ui` and `testing` take their host types (`DisplayMetricsPayload`, `FullscreenRes`, `ErrorCode`) from
    `@mcthaydt/automata-host`, and no longer vendor Ruken's declarations. `game` no longer vendors Ruken's `SLUG_RE`.
  - `RuntimeTest` (Ruken's fake host) and the Ruken-backed tests move under `ruken/` folders, as do ship's Ruken
    target (`targets/ruken/`) and its itch target (`targets/itch/`). The public entry points are unchanged.
  
  BREAKING: `ShipConfig` is now `GameConfig & { itch?, audience? }` from `@mcthaydt/automata-content/game-config`, with the
  same keys; `game.sdk` is optional, so code that reads `config.game.sdk` must handle `undefined`. `defineExtension`'s
  `GameConfig` is `Pick<GameConfig, 'game' | 'runtime' | 'content'>` from the same entry. `ui`'s `ErrorCode` is
  `@mcthaydt/automata-host`'s `ErrorCode`, the same ten codes. The published `ui`, `game` and `testing` packages no
  longer ship `dist/vendor/` copies of Ruken's declarations or `SLUG_RE`.
- b112a01: AF's own fake host (DIST.4, DIST spec §7). `@mcthaydt/automata-testing/host` exports `FakeHosting` (a layer giving
  `Hosting` and `FakeHostControl`) and `fakeHosting` (its control handle and a `make` for boot). They implement AF's host
  contract in process for the `web`, `itch`, `ruken` and `tauri` targets: each target's kind, name, grants and error codes,
  deferred readiness, schema-checked host changes, planned failures, held calls for timeouts, consent, menu and close.
  
  `@mcthaydt/automata-host/contract-suite` publishes the `Hosting` contract's Vitest cases (`describeHostingContract`), which
  every adapter and the fake pass; `vitest` is an optional peer of `host`.
  
  The runtime takes `seams.hosting`: a function that builds the game's `Hosting` in place of the build target's adapter,
  for example `fakeHosting().make`. A game's tests can boot on any target without Ruken's fake host.
- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.
- Updated dependencies [cfb2cf0]
- Updated dependencies [b112a01]
- Updated dependencies [bb98b8b]
- Updated dependencies [de363d9]
  - @mcthaydt/automata-host@0.0.5
  - @mcthaydt/automata-sim@0.0.5

## 0.0.4

### Patch Changes

- 1fa16c8: Add the `xx-long` pseudo-locale to `@mcthaydt/automata-content/locale` (`PSEUDO_LOCALE`, `pseudoLocalize`, `pseudoMessages`, `hasRawText`, `MessageValue`): every letter accented, about 40% longer, between `⟦ ⟧`, placeholders kept. `@mcthaydt/automata-testing` gains `findCutAtSide` (a control cut at the side of a declared scroll region that clips it; a region that scrolls sideways on purpose declares `data-scroll-region="both"`) and `pressedPart` (a checkbox's or radio's label). `checkLayout` (`@mcthaydt/automata-ui/testing`) now also fails a control cut at the side of the scroll region it scrolls in and a control whose words run past its edge. Long-language fixes: ScreenFrame's actions let an ActionBar give way instead of widening the body, Settings' tabs wrap and its groups keep to the list's width, and a Toggle keeps its state word whole beside the track while a long name breaks a word only where the toggle is given less room than its longest word.
- @mcthaydt/automata-sim@0.0.4

## 0.0.3

### Patch Changes

- b9f9a5b: `goldenCommands({ root })` lets the browser golden read command serve golden files from a folder wider than the Vitest project's root, for a package whose goldens sit beside it (the examples runner reads `examples/__goldens__`). Additive: `goldenCommands()` keeps the project root.
  
  BREAKING: the API report counts `goldenCommands`' new optional `options` parameter as a changed signature. Existing calls, `goldenCommands()`, behave as before.
- ecf937f: Document the exports of testing and physics: the viewport, resize-observer and mount fixtures, the reference sizes and variants, the golden and snapshot round-trip checks and their reports; and the physics kinds, spawn helpers, options and collision events, in 2D and 3D.
- e6b642f: The input × form-factor matrix (M4.10): a new `@mcthaydt/automata-testing/e2e` entry with `FakePad` (a standard controller for a real built game, reachable in the game's frame under a host), the touch helpers `tap`, `hold`, `swipe` and `flick`, and `INPUT_MATRIX`, the M4 spec's cells as data; and `@mcthaydt/automata-testing/input` with `fakeGamepads()`, a `navigator.getGamepads` stand-in for unit tests. `@playwright/test` is an optional peer, needed only by the `e2e` entry. The private runtime and game packages gain the active device following the host's input mode (`makeInput({ hostInput })`) and the "This controller isn't supported yet" toast for a pad without the standard mapping.
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
