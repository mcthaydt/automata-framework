# @mcthaydt/automata-ship

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
