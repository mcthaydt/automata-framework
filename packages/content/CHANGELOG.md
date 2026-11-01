# @mcthaydt/automata-content

## 0.0.5

### Patch Changes

- 3a22b55: The Vite plugin defines `__AUTOMATA_DEBUG__` for the game: true in the dev server and in a build made with `AUTOMATA_DEBUG=1` (`automata build --debug`), false in a release build, so a block a game guards with it is dropped from what ships.
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
- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.
- bd91af2: The `paraglide` option compiles a game's catalogs when the game builds with `vite build --configLoader runner`: Paraglide is loaded with Node's own `require` instead of `import()`, which Vite's module runner rewrites and has closed by the time the content compiles ("Vite module runner has been closed").
- Updated dependencies [de363d9]
  - @mcthaydt/automata-sim@0.0.5

## 0.0.4

### Patch Changes

- 2908b30: The content Vite plugin (`automataContent` from `@mcthaydt/automata-content/vite`) now sets `build.assetsInlineLimit: 0` when the game's Vite config leaves it unset, so every asset ships as a file. Vite would otherwise inline an asset under 4 kB as a `data:` URL, which Pixi's loader fetches and Ruken's CSP (`connect-src`, which has no `data:`) refuses, so the asset never loaded. A value the game sets itself is kept.
- 7f2c27c: The font build cuts every content language's name, as the language picker shows it, into every subset, and the glyph gate holds each language's subsets to the names of the languages the fonts serve: a missing glyph is `missingGlyph` at the language's entry in `locales` in `content/fonts.toml` (M5.5F). `endonymOf` moves to `@mcthaydt/automata-content/locale`, so the build and the picker share one function; `@mcthaydt/automata-ui` re-exports it unchanged and now depends on `@mcthaydt/automata-content`.
- b15b260: A preloaded screen's atlases and fonts join the generated preload list (M5 spec §4.7). A screen names them in `assets.toml` beside its `files` (`atlases = ["wick"]`, `fonts = ["pixel"]`, by their names in `atlases.toml` and `fonts.toml`); `preloadList` then adds each atlas page's Spritesheet JSON and image (`atlases/<atlas>-<page>.json` and `.png`) and every language's subset that `fonts.json` names (`fonts/<file>`), from the outputs `automata-content assets` wrote below `outDir`. A name not declared is `unknownReference`; an atlas or font not built, or a page or subset missing from the build, is `missingAsset`, all reported at once at the screen's key. An `assets.toml` that names none compiles and preloads as before.
  
  BREAKING: the API report counts `AssetsSource`'s new optional `atlases` and `fonts` as a changed interface. Code that reads or builds an `AssetsSource` compiles and behaves as before.
- 1fa16c8: Add the `xx-long` pseudo-locale to `@mcthaydt/automata-content/locale` (`PSEUDO_LOCALE`, `pseudoLocalize`, `pseudoMessages`, `hasRawText`, `MessageValue`): every letter accented, about 40% longer, between `⟦ ⟧`, placeholders kept. `@mcthaydt/automata-testing` gains `findCutAtSide` (a control cut at the side of a declared scroll region that clips it; a region that scrolls sideways on purpose declares `data-scroll-region="both"`) and `pressedPart` (a checkbox's or radio's label). `checkLayout` (`@mcthaydt/automata-ui/testing`) now also fails a control cut at the side of the scroll region it scrolls in and a control whose words run past its edge. Long-language fixes: ScreenFrame's actions let an ActionBar give way instead of widening the body, Settings' tabs wrap and its groups keep to the list's width, and a Toggle keeps its state word whole beside the track while a long name breaks a word only where the toggle is given less room than its longest word.
- bb4e89d: Bundle Ruken's packages from RukenApp `e376a2d`, where they are MIT licensed. `VENDORED.md` names the new commit and hashes, and now also each bundled package's licence and the licence text, which MIT asks every copy of the code to carry. The bundled Ruken code itself is unchanged: every `dist/` is the same as at `d0fa2fe`.
- 2687799: Bundle Ruken's packages from RukenApp `d0fa2fe` instead of `b30d31b` (`VENDORED.md` names the commit and hashes). The bundled `@ruken/sdk-host` and `@ruken/cli` now declare `zod` 4.6.6 (the SDK only as a dev dependency; `@ruken/manifest` does not use zod), so nothing in AF installs 4.6.5 (GHSA-mrhx-c7xc-m3w5). The SDK also trusts Ruken's private beta sites as hosts, and Ruken's host now answers `Hosting.leaderboards.get` with the player's own entry only; the call is unchanged.
- @mcthaydt/automata-sim@0.0.4

## 0.0.3

### Patch Changes

- c07e66a: Document the exports of content, host, node and ship: the content kinds, generators, tuning, flow and diagnostics types and the Vite plugin; the host's analytics properties and test options; the `Files` and `ProcessRunner` services and their live layers; and the ship inputs, `deployDev`, `publishToRuken`, `testRemote`, `rukenToml` and the build checks.
- 276a7ae: Font subsetting (M5.5): `content/fonts.toml` names each committed source font with its sha256, licence and languages. `automata-content assets` cuts each language's subset to woff2 with a content-hashed name and writes `fonts.json`. A source whose hash differs is refused (`invalidAsset`), and a message with a character none of its language's subsets holds fails at the message's `file:line:col` with the code point (`missingGlyph`). The `./assets` entry adds `buildFonts`, `subsetWoff2` and `fontCoverage`. `CompiledContent.messageLocations` says where each language's message is written.
- f05aaba: Atlas packing (M5.6): `content/atlases.toml`, the `@mcthaydt/automata-content/assets` entry (`buildAtlases`, the deterministic `packFrames`), and `automata-content assets`, which writes each atlas page's PNG and Pixi Spritesheet JSON. With a declared `content/palette.toml`, frames are checked against it (`offPalette`); a broken frame is `invalidAsset`.
- 0d11a56: Content localization (PRODUCT.L2): a translation's missing key is reported at the source text's `file:line:col`, and an extra or non-text key at its own line and column; `CompiledContent` gains `languages` and `catalogs`; `ContentOptions.paraglide` compiles the catalogs (and a game's own) with Paraglide on build; the new `@mcthaydt/automata-content/locale` entry has `createContentText` for run-time lookup and the per-locale glyph sets.
  
  BREAKING: `CompiledContent` gains the required `languages` and `catalogs` members, so a hand-built `CompiledContent` must add them. `ContentOptions` gains the optional `paraglide` member.
- 9244e86: Raise the `vite` peer floor to `^8.3.3`: 8.3.0 to 8.3.2 carry GHSA-587h-7wmj-h5pm (a high-severity `launch-editor` check bypass on Windows, dev server only), which the dependency audit now reports.
- 50ec5a9: Depend on `zod` 4.6.6: 4.6.5 and earlier carry GHSA-mrhx-c7xc-m3w5 (a high-severity memory exhaustion while validating oversized constrained collections), which the dependency audit now reports.
- Updated dependencies [00ca723]
- Updated dependencies [25d5a68]
- Updated dependencies [0c84109]
- Updated dependencies [50ec5a9]
  - @mcthaydt/automata-sim@0.0.3

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
