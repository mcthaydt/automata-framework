# @mcthaydt/automata-ship

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
- a9d3f00: `automata-check-boundaries --platform-imports <root>...` checks that a distribution target's platform packages
  (`@ruken/*`, `@tauri-apps/*`) are imported only by files under a folder named for that target (`ruken/`, `tauri/`),
  tests included (DIST.3b, ADR 0006). Each finding names the file, the import and the AF replacement. Only real imports
  count; a package named in a string, a comment or a template does not. `pnpm boundaries` runs it over `packages`,
  `games`, `examples` and `tooling`.
  
  `@mcthaydt/automata-ship` exports `rukenHeaders(config, target)`: the headers Ruken serves a game's build with, from
  its ship config, so a game's `vite preview` gets Ruken's CSP without importing `@ruken/manifest`.
- 09bed6e: `automata-ship prepare --target tauri` builds a game's desktop bundles for the OS it runs on (DIST.5b, DIST spec §6.2).
  It runs these checks first, and each one that fails names what to change:
  - the release tag;
  - the new `tauri` section of `ship.config.ts` (`identifier`, an optional `icon`);
  - a semver `game.version`;
  - an `index.html` entry;
  - a webview CSP without `'unsafe-eval'`;
  - the public-build scans (secrets, `@pixi/3d`);
  - the toolchain: `cargo`, WebKitGTK 4.1 on Linux, and the game's `@tauri-apps/cli`.
  
  It then writes a Tauri project into `.automata/tauri/`. The crates are pinned exactly, the plugins are the store and
  process ones the desktop adapter calls, and only those permissions are granted. It runs `tauri build` there and copies
  each bundle to `dist-tauri/<id>-<version>-<os>-<kind>.<ext>`: Linux `deb` and `appimage`, macOS `dmg`, Windows `nsis`
  and `msi`. The builds are unsigned; signing comes with the release job. New exports: `prepareTauri`, `TAURI_CLI`,
  `TauriConfig`, `tauriConfigSchema`, and the errors `TauriBuildInvalid`, `TauriToolchainMissing` and `TauriBuildFailed`.
- c88a91a: `automata-ship publish --target itch --from tauri` pushes a game's desktop bundles from `dist-tauri/` to itch.io as
  Downloadable files (DIST.5c, DIST spec §6.4). It pushes one bundle per OS, each to its own butler channel: Linux's
  AppImage, macOS's dmg and Windows's NSIS installer, on the channels `linux`, `mac` and `windows`. The new
  `itch.downloads` setting can rename any of them. It needs the same `itch` section, key and butler as an HTML5 push, and
  fails before anything runs when no bundle of this version is there (`ItchDownloadsMissing`). New exports:
  `publishDownloadsToItch` and `ItchDownloadsMissing`.
  
  `game-release.yml` takes `desktop: true`, which builds unsigned bundles on each of `desktop-runners` (default
  `af-linux` and `af-mac`), keeps them as an artifact and, with `itch: true`, pushes them to itch.io. With
  `desktop-signing: true` it builds the signed and notarized macOS bundle in the `release` environment, using the
  `APPLE_*` secrets; a missing secret fails the job by name.
- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.
- Updated dependencies [3a22b55]
- Updated dependencies [6d60a91]
- Updated dependencies [de363d9]
- Updated dependencies [bd91af2]
  - @mcthaydt/automata-content@0.0.5
  - @mcthaydt/automata-node@0.0.5

## 0.0.4

### Patch Changes

- 57f411e: `prepare` and itch.io's `prepare --target itch` refuse a build that contains `@pixi/3d`, a closed beta, for a public target (`Pixi3dInPublicBuild`, M3 spec §4.8 X-b); `deploy-dev` and the new `publish --private`, which uploads only when `RUKEN_API` is Ruken's local stack (`PrivatePublishNotLocal` otherwise), allow it. Every build that contains `@pixi/3d/extras` is refused (`Pixi3dExtrasInBuild`, S7-g). `PrepareInput.audience`, `publishBuild`, `isLocalStack`, `findPixi3d` and the marker lists are exported.
  
  BREAKING: the API report counts `PrepareInput`'s new optional `audience` as a changed interface. Existing callers compile; a public `prepare` of a build without `@pixi/3d` behaves as before.
- bb4e89d: Bundle Ruken's packages from RukenApp `e376a2d`, where they are MIT licensed. `VENDORED.md` names the new commit and hashes, and now also each bundled package's licence and the licence text, which MIT asks every copy of the code to carry. The bundled Ruken code itself is unchanged: every `dist/` is the same as at `d0fa2fe`.
- 2687799: Bundle Ruken's packages from RukenApp `d0fa2fe` instead of `b30d31b` (`VENDORED.md` names the commit and hashes). The bundled `@ruken/sdk-host` and `@ruken/cli` now declare `zod` 4.6.6 (the SDK only as a dev dependency; `@ruken/manifest` does not use zod), so nothing in AF installs 4.6.5 (GHSA-mrhx-c7xc-m3w5). The SDK also trusts Ruken's private beta sites as hosts, and Ruken's host now answers `Hosting.leaderboards.get` with the player's own entry only; the call is unchanged.
- 53d2743: The bundle secret scan reports a Slack token under gitleaks' own rule IDs, by prefix: `slack-bot-token` (`xoxb-`), `slack-user-token` (`xoxp-`), `slack-legacy-token` (`xoxs-`) and `slack-legacy-workspace-token` (`xoxa-`, `xoxr-`), instead of `slack-token`, which gitleaks 8.30.1 does not have. It finds the same strings as before and still calls each one "a Slack token"; only a Slack finding's `rule` changes.
- b47e796: A game's ship config can declare `audience: 'private'`: `automata-ship prepare` then checks the build as private and writes no `ruken.toml` (M3 spec §4.8).
- Updated dependencies [6dea6a0]
  - @mcthaydt/automata-node@0.0.4

## 0.0.3

### Patch Changes

- c07e66a: Document the exports of content, host, node and ship: the content kinds, generators, tuning, flow and diagnostics types and the Vite plugin; the host's analytics properties and test options; the `Files` and `ProcessRunner` services and their live layers; and the ship inputs, `deployDev`, `publishToRuken`, `testRemote`, `rukenToml` and the build checks.
- 6d8e5c7: EX.2: the reference games moved to `games/` (`games/emberwick`, `games/placeholder`); ship's port and `test-remote` notes name the new paths. No API change.
- b4cd14b: `inputsProblems(inputs, bindings)` checks `runtime.inputs` against a game's input bindings (M4 spec §4.13): pad buttons need `"gamepad"`, and `"touch"` needs a touch button or a gesture. `prepareBuild` takes an optional `inputBindings` and fails with the new `ManifestInputsMismatch` before writing `ruken.toml`. Additive: without `inputBindings`, prepare behaves as before.
- 4194f66: `runtime.inputs` against the game's input map without loading it (M4.1 follow-up): `prepare` (when the caller gives no `inputBindings`) and the private `automata check` (a new `inputs` step, rule `inputs-mismatch`) read the `keys()` calls in the game's sources, as the board and orientation checks read theirs, and apply `inputsProblems` to what they bind: a pad binding with no `gamepad`, or `touch` with nothing to touch. Anything not written as a literal counts as touchable and binds no pad, so a reported problem is always real. `ship` exports `keysBindingsIn`, `declaredInputsIn`, `findInputsProblems`, `isInputsSource` and `DeclaredInputs`.
- 7b1cf61: The game's orientation against the ship config (M4.7 follow-up): `prepare` fails with `OrientationMismatch`, and the private `automata check` gains an `orientation` step (rule `orientation-mismatch`), when a `defineGame` plays in an `orientation` other than `ship.config.ts`'s `runtime.orientation` (`any` when the game leaves it out). The sources are read, not run, as the board check reads them, so only string literals are compared. `ship` exports `gameOrientationsIn`, `declaredOrientationIn`, `findOrientationMismatches`, `isOrientationSource` and their types.
- 27726d2: M5.7 leaderboard flow. ui: `LeaderboardPanel` (loading, entries with the player's row marked, empty, unavailable, offline) and its `LeaderboardView`, `LeaderboardEntryView` and `LeaderboardCopy` types. ship: `prepareBuild` refuses a game that names a leaderboard its ship config does not declare (`UndeclaredBoard`, with the call site), and exports the scan (`findUndeclaredBoards`, `boardNamesIn`, `declaredBoardsIn`, `isBoardSource`). (The cli's new `automata check` step `boards`, rule `undeclared-board`, needs no changeset: the cli is private.) Additive for every caller.
- 231ee57: Add `--target itch` to `automata-ship prepare` and `publish`: itch.io's index.html, limit, case and ruken.toml checks, a byte-reproducible `<id>-<version>-itch.zip`, and `butler push` with `--userversion` and `--if-changed`. `ShipConfig` gains an optional `itch` section. The Ruken path is unchanged.
- 0d0c38d: `prepare` (and so `publish` and `deploy-dev`) now fails when the build holds a secret: a known key format (Stripe, AWS, GitHub, npm, private keys and others, named by their gitleaks rule IDs), the value of any variable in the game folder's `.env*` files, or a high-entropy quoted string. The error names the file, line, column and byte offset, never the secret. The scanner is exported as `scanTextForSecrets`, `findSecretsInBuild`, `readEnvValues` and `parseEnvFile` (QB.2).
  
  BREAKING: `PrepareInput` gains the optional `gameDir`, the folder whose `.env*` files the scan reads; existing callers compile unchanged.
- 92f5186: The release workflow's version commit carries `[skip ci]`, so a push to the Version packages branch starts no
  `ci`, `parity`, game-ci or consumer-smoke run (the release job checks and publishes the commit itself).
- 50ec5a9: Depend on `zod` 4.6.6: 4.6.5 and earlier carry GHSA-mrhx-c7xc-m3w5 (a high-severity memory exhaustion while validating oversized constrained collections), which the dependency audit now reports.
- Updated dependencies [c07e66a]
  - @mcthaydt/automata-node@0.0.3

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
