# @mcthaydt/automata-game

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
- e6c5c3e: `keys()` takes an `analog` option (the sticks and the camera drag added to the held keys' payload), `InputMap` gains `touchStick` and `toCommand`'s optional third parameter, `TouchButton` an optional `side`, and the default play screen draws the camera-drag surface and the touch stick when the map asks for them.
  
  BREAKING: `InputMap` gains the required `touchStick` (only `keys()` and `inputs()` build one), `KeysOptions` gains the optional `analog`, `TouchButton` the optional `side`, and `ScreensCopy.play` gains the required `move` (the stick's accessible name; `DEFAULT_SCREENS_COPY` has it, a game that spells out the whole `play` object adds it).
- 3abd0e6: The default Paused screen shows its "reconnect your controller" line under the menu, as it does the save lines, so on a short screen at TV scale (780 x 270) the actions stay on screen and the line scrolls. The line now shows on the menu only, not on the quit confirm. Core's layout contract covers the reconnect variant.
- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.
- Updated dependencies [3a22b55]
- Updated dependencies [cfb2cf0]
- Updated dependencies [6d60a91]
- Updated dependencies [b112a01]
- Updated dependencies [bb98b8b]
- Updated dependencies
- Updated dependencies [de363d9]
- Updated dependencies [bd91af2]
- Updated dependencies [ad11ae6]
- Updated dependencies [94d3212]
  - @mcthaydt/automata-content@0.0.5
  - @mcthaydt/automata-host@0.0.5
  - @mcthaydt/automata-ui@0.0.5
  - @mcthaydt/automata-runtime@0.0.5
  - @mcthaydt/automata-render-pixi@0.0.5
  - @mcthaydt/automata-sim@0.0.5

## 0.0.4

### Patch Changes

- 2ff17aa: First publish of the runtime, the Pixi renderer, the game package and the umbrella (DX.2a), so a game, and Automata
  Plus, can install them. Each ships `dist` only, `svelte` and `pixi.js` are caret peers, and every export has a doc
  comment. The runtime's Svelte rune modules stay files of their own (`*.svelte.js`) and it ships Ruken's types, not
  its code; the game package ships its screens as Svelte source under the `svelte` condition and bundles the one Ruken
  value it uses (D-8, listed in its `VENDORED.md`).
- 66fe89d: The default screens' words come from the game (DX.2d). `GameSpec.copy.screens` takes a part of the new `ScreensCopy`
  record, or a function of the locale that returns one, over the English defaults: Play, Pause, the paused menu and its
  quit confirm, every Settings group, the save slots and status, the board, and the unsupported-controller notice. The
  screens read it in the player's language and again on each change, without remounting. `TouchControls` now wraps a
  side whose labels do not fit on one row, and breaks a long label inside its button, so a longer language never pushes
  the touch row off screen.
- eb734a4: The runtime can run a 3D renderer (M3.4a). `RendererFactory` may fail with `ModelInvalid { file, reason }`, a model file the renderer could not read, which boot shows as the `model-invalid` panel with Try again (`BootError` carries it). `RenderTarget.reportLost` shows the "picture stopped" panel for a graphics context that does not come back, and Try again rebuilds the renderer from the sim's state (M3 spec §5); `RuntimeFacts` gains the context facts. `GameDefinition.preload` and `GameSpec.preload` list files the preload screens fetch before the renderer starts, kept out of the content and its hash. `GameSpec.createRenderer` makes the renderer from the Pixi options `defineGame` built, so an extension's renderer (render-pixi3d) can draw the game; it defaults to core's Pixi renderer.
  
  BREAKING: `RendererFactory`'s error now includes `ModelInvalid`, and `BootError`, `RuntimeFacts`, `RenderTarget`, `GameDefinition` and `GameSpec` gain members, so an exhaustive `switch` over the boot error or the facts must add their cases. A 2D game that does not set the new options is unchanged.
- 0670bfe: `inputs(...maps)` joins several `keys()` maps into one input map: each map sends its own command every tick, read from one Input over the merged bindings, with one set of touch buttons and one Controls section (a 3D game sends its move, lock and action buttons as separate commands). It throws on no maps, on two maps for one command, and on an action id, a key or a pad button two maps share.
- Updated dependencies [2ff17aa]
- Updated dependencies [992b7f5]
- Updated dependencies [66fe89d]
- Updated dependencies [7af981d]
- Updated dependencies [eb734a4]
- Updated dependencies [263d3e0]
- Updated dependencies [3c965f8]
- Updated dependencies [7f2c27c]
- Updated dependencies [1fa16c8]
- Updated dependencies [bb4e89d]
- Updated dependencies [2687799]
- Updated dependencies [79457ff]
- Updated dependencies [e0fe104]
  - @mcthaydt/automata-render-pixi@0.0.4
  - @mcthaydt/automata-runtime@0.0.4
  - @mcthaydt/automata-ui@0.0.4
  - @mcthaydt/automata-host@0.0.4
  - @mcthaydt/automata-sim@0.0.4
