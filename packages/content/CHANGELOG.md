# @mcthaydt/automata-content

## 0.1.0

### Minor Changes

- 12bda87: The first public release: the four packages are on npmjs.org, free to install with no sign-in. `npx @automata/tools create-game my-game` makes a small game that runs, with a level you can open in the editor, a test and its own release workflow.
  
  BREAKING: this release replaces everything published before it under `@mcthaydt/*`. The packages are now `@automata/framework`, `@automata/content`, `@automata/sim` and `@automata/tools`; the browser packages (host, runtime, render, ui, game, testing) are one package, and the build tools (ship, cli, node) are one package, `@automata/tools`. The browser runtime no longer uses Effect, `NetworkPort` and `AuthoritativeSnapshot` are gone, and the root entry of `@automata/framework` is smaller (600 names became 274). Change your imports and your `package.json` to the new names.
  
  - `automata editor` opens the 2D level editor and the Tuner, which shows your game beside its settings, with nothing else installed; it names the game it opened in plain words.
  - `automata check` runs the determinism and layout checker, and a `levels` step that fails when a level project and the game files saved from it disagree; `--only <step>` runs one step.
  - `automata ship prepare` and `publish` take `--target web|itch|tauri|ruken` and check a web build for secrets, inlined assets, `eval` and root-absolute paths.
  - `@automata/content` has `level-2d`, the 2D level format the editor writes and games read, two browser-safe entries (`schema`, `palette`), and tunables that may carry a `label`, `feel`, `unit` and `scale`. In dev, a content save updates the running game in place.
  - `@automata/framework` has plainer default screens and messages, `startGame(game, { at })`, and `checkLayout` targets for editors.
  - The messages and `--help` of every command say what to do next in plain words.

### Patch Changes

- 5386c34: `@automata/framework/testing` now exports `fakeClock`, and `@automata/framework` exports `systemClock`, so a renderer can time a wait without Effect. `@automata/content` adds `compileContentResult` and `@automata/tools` adds `manifestOf` and `rukenHeadersOf`, plain-value forms of what the Effect API did.
- 474d2f9: A game declares achievements in `ship.config.ts` beside its leaderboards: an id, a title, a description and one goal on one of its boards (`reach` a score, or the `top_percent` of players). `@automata/content/game-config` exports `AchievementConfig` and `AchievementGoal` and its schema checks the declaration; it names no host. `automata ship prepare --target ruken` writes each achievement into `ruken.toml` (and a board's `title`), refuses a top share Ruken has no rule for with the shares it allows, and puts Ruken's own achievement errors in plain words. The web, itch.io and desktop builds accept the declaration and do nothing with it. `automata check` has a new `achievements` step, and `automata words` writes the achievements' source words to `messages/achievements/en.json` and translates them like any other catalog. `@automata/content/game-config` can now be loaded by plain Node from source.
- 30e8765: The comments in the generated API reference say what each name does and why, not which project the code first came from.
- 856e7eb: Compiling a game's messages no longer empties the Paraglide folder on the way. The compile goes to a temporary folder and only the files that changed reach `outdir`, so a dev server watching it no longer loads a page with its message modules missing, and a compile that changes nothing touches nothing.
- ee474b0: A character definition in `project.toml` may have an `animation`: a picture cut into equal frames and named clips over them (`ContentAnimation`, `animationSchema`). A project without one reads as before.
- 3357672: A game can read a level's tile rows, auto stacks and objects, the frame of a tile in its tileset, the placeholder colours and how a character looks (`pictureOf`), the same way the editor draws them.
- 4b4328b: A game's default controls can be data: `content/controls.toml` (the `controls` kind in `@automata/content/controls`) and `controlsFrom(command, file)` in the framework build the same input map `keys()` does.
- b0f31b6: A credits name is held to every language's font. `@automata/content/schema` gains `verbatim()`, beside `localized()`: text drawn as written in every language, with no message key. The font build cuts every face to it and refuses a build in which a language's faces lack one of its characters, naming the file, the key and the characters. The credits kind marks a name with it, and `creditsSchemaWith` takes the name's schema as an optional second argument.
- 0500f40: `@automata/content/locale` now names the six default languages (`DEFAULT_LOCALES`: en, ja, ko, es-419, pt-BR, zh-Hans) and each one's own name for itself (`ENDONYMS`), and `endonymOf` answers from them before asking `Intl.DisplayNames`, so every engine and the font build spell a name the same way.
- f863ad0: `PROMPT_COPY`, `STICK_DIRECTIONS` and `Picture` have doc comments: what each holds and where a game uses it, so the API index and the cheatsheet describe them.
- fa85558: The default palette is DUEL: 256 colours as 32 ramps of 8, replacing Endesga 64. `@automata/content/palette` adds `DUEL_RAMPS`, `rampOf`, `step` and `nearestDuel`. A game without `content/palette.toml` now gets DUEL, so its content hash changes.
- 551a11f: The workspace's source entries of `@automata/content` (and the `@automata/sim` modules they reach) load under plain Node: relative imports name their `.ts` file, and the atlas error's field is no longer a parameter property. `automata check --only no-eval` now passes for a game inside the repository; a published install was never affected.
- 156126a: A built game carries each font's licence text. The Vite plugin emits the texts the font build writes beside the subsets (`<font>-OFL.txt`) into the build's assets, next to the faces, whenever the build carries any font subset.
- ceb2a01: The font build cuts each language's subset to every word a game shows (its content, its interface words in `messages/ui`, and the words of `@automata/framework`, `@automata/ui-screens` and `@automata/net-ui`), and with a `content/fonts.toml` every language the content compiles must be served by a font: no language falls back to the device's fonts. A font may name `reserved_name` and `license_file`: its subsets are renamed `<font> <language>` (the OFL's Reserved Font Name) and the licence ships beside them. The build also writes `fonts.css`, one `@font-face` per font and language and a `:root:lang()` rule that sets `--af-font`, so a language change changes the face with no code. `gameWords` is exported from `@automata/content/assets`, and `subsetWoff2` takes an optional rename.
- a66b4e0: The test of the Vite plugin's HMR update no longer fails on a runner whose file watcher reports a setup write late: it waits for the watcher to catch up before it makes the change it counts. No behaviour of the plugin changes.
- 3aef585: A game's language may be named with a three-digit region, so `content/messages/es-419.json` (Latin American Spanish, one of the framework's six default languages) is a translation instead of being refused as "not a language tag".
- Updated dependencies [551a11f]
- Updated dependencies [12bda87]
- Updated dependencies [0990eea]
  - @automata/sim@0.1.0

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
