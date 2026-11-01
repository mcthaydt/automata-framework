# @mcthaydt/automata-runtime

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
- bb98b8b: The desktop (`tauri`) host adapter (DIST.5a, ADR 0006). `@mcthaydt/automata-host/target` under the `automata-tauri`
  condition gives a desktop build's `Hosting`. It is the web adapter's page plus:
  - the game's saves in one `saves.json` store in the app's data folder. They are never kept in `localStorage` or memory;
    when the store cannot be read, `saves` is not granted and every call fails `DENIED`;
  - a flush that writes the store and answers `persisted: 'device'`;
  - Quit (`exit` is granted). `exit` and the window's close request run the game's exiting handlers, then the flush,
    within `HOST_EXIT_CAP`, then quit.
  
  `@tauri-apps/api`, `@tauri-apps/plugin-store` and `@tauri-apps/plugin-process` are optional peers that a desktop game
  installs. `TAURI_MARKERS` and `findTauriMarkers` check that only a `tauri` build holds Tauri's IPC code.
  
  `ui`'s boot failure knows the `tauri` host kind. Its exit action reads "Quit" (the new `quit` copy key), and a saves
  failure that will not clear offers "Continue without loading". The runtime passes `tauri` through to it.
  
  BREAKING: `ui`'s `HostKind` adds `'tauri'`, so an exhaustive `switch` over it must add a case. `BootFailureCopy` adds
  the `quit` key, so a complete copy object must give it. `bootFailureView` now offers "Continue without loading" for a
  non-retryable saves failure on every host but Ruken, and the exit action for an unsupported device wherever exit can be
  granted (Ruken and the desktop).
- A target that does not grant `saves` (a web page with storage blocked) no longer stops the game at boot (DIST spec §8
  flow 5). The boot reads settings only when `saves` is granted and otherwise starts on their defaults; the save service
  lists every slot empty, loads an empty slot as the empty value and sends no write, so nothing fails and the paused
  screen says progress won't be kept. Nothing is written to the device's storage instead.
- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.
- 94d3212: The presentation bus publishes a new fact, `sim.step`, with `sim.events`: the step's tick (`StepResult.tick`) and the same events, for a listener that needs to know when an event happened. `sim.events` is unchanged.
- Updated dependencies [3a22b55]
- Updated dependencies [cfb2cf0]
- Updated dependencies [6d60a91]
- Updated dependencies [b112a01]
- Updated dependencies [bb98b8b]
- Updated dependencies [de363d9]
- Updated dependencies [bd91af2]
- Updated dependencies [ad11ae6]
  - @mcthaydt/automata-content@0.0.5
  - @mcthaydt/automata-host@0.0.5
  - @mcthaydt/automata-ui@0.0.5
  - @mcthaydt/automata-sim@0.0.5

## 0.0.4

### Patch Changes

- 2ff17aa: First publish of the runtime, the Pixi renderer, the game package and the umbrella (DX.2a), so a game, and Automata
  Plus, can install them. Each ships `dist` only, `svelte` and `pixi.js` are caret peers, and every export has a doc
  comment. The runtime's Svelte rune modules stay files of their own (`*.svelte.js`) and it ships Ruken's types, not
  its code; the game package ships its screens as Svelte source under the `svelte` condition and bundles the one Ruken
  value it uses (D-8, listed in its `VENDORED.md`).
- eb734a4: The runtime can run a 3D renderer (M3.4a). `RendererFactory` may fail with `ModelInvalid { file, reason }`, a model file the renderer could not read, which boot shows as the `model-invalid` panel with Try again (`BootError` carries it). `RenderTarget.reportLost` shows the "picture stopped" panel for a graphics context that does not come back, and Try again rebuilds the renderer from the sim's state (M3 spec §5); `RuntimeFacts` gains the context facts. `GameDefinition.preload` and `GameSpec.preload` list files the preload screens fetch before the renderer starts, kept out of the content and its hash. `GameSpec.createRenderer` makes the renderer from the Pixi options `defineGame` built, so an extension's renderer (render-pixi3d) can draw the game; it defaults to core's Pixi renderer.
  
  BREAKING: `RendererFactory`'s error now includes `ModelInvalid`, and `BootError`, `RuntimeFacts`, `RenderTarget`, `GameDefinition` and `GameSpec` gain members, so an exhaustive `switch` over the boot error or the facts must add their cases. A 2D game that does not set the new options is unchanged.
- 79457ff: Inside a Ruken session, the boot-failure panel's Try again reloads the game's frame (the host answers one hello per frame load); standalone keeps the in-place retry. New `RuntimeSeams.reload`.
- Updated dependencies [66fe89d]
- Updated dependencies [2908b30]
- Updated dependencies [7af981d]
- Updated dependencies [263d3e0]
- Updated dependencies [3c965f8]
- Updated dependencies [7f2c27c]
- Updated dependencies [b15b260]
- Updated dependencies [1fa16c8]
- Updated dependencies [bb4e89d]
- Updated dependencies [2687799]
- Updated dependencies [e0fe104]
  - @mcthaydt/automata-ui@0.0.4
  - @mcthaydt/automata-content@0.0.4
  - @mcthaydt/automata-host@0.0.4
  - @mcthaydt/automata-sim@0.0.4
