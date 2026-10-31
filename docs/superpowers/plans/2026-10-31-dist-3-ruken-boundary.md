# DIST.3 plan: no `@ruken/*` outside a `ruken/` folder

> Row: DIST.3 in [02](../../02-master-delivery-plan.md). Spec:
> [DIST spec](../specs/2026-10-31-dist-target-neutral-design.md) §4.4 (game config), §5 (the boundary and the moves),
> §5.3 (`--mode`), acceptance DIST-b. Lanes: game, runtime, ui, testing, content, ship, cli. Stacked on DIST.4
> (`claude/dist-4-fake-host`, #323). Strict TDD.

DIST.3 is two pull requests, one push each, because it touches about 55 files in eight packages, three games and four
tools:

- **DIST.3a (packages):** `ui`, `testing`, `runtime`, `game`, `content`, `ship` and `cli` import no `@ruken/*` outside a
  `ruken/` folder; the game config schema in `content` (§4.4).
- **DIST.3b (games, examples, tooling, and the rule):** the same for `games/*`, `examples/` and `tooling/`, the
  `platform-imports` check in `pnpm boundaries` over all four trees, the games' `build:<target>` scripts, and
  host-neutral copy.

## DIST.3a

### Interfaces

- **Produces** (`@mcthaydt/automata-content`): `GameConfig`, `gameConfigSchema` (the keys of `ship.config.ts` every
  target reads, Ruken's snake_case, unchanged), and AF's enums `RENDERERS`, `ORIENTATIONS`, `INPUTS`, `RATINGS`,
  `GAME_ID_PATTERN`.
- **Changes:** `defineExtension`'s `GameConfig` is content's `Pick<GameConfig, 'game' | 'runtime' | 'content'>`;
  `ShipConfig` is content's `GameConfig` plus `itch` and `audience`, with `game.sdk` required only by the Ruken target;
  `defineGame` checks ids with `GAME_ID_PATTERN`; `ui`'s `HostDisplay`, `FullscreenRes` and `ErrorCode` come from
  `@mcthaydt/automata-host`; `testing`'s viewport fixture likewise.
- **Unchanged:** every published name; `ship.config.ts` files type-check with no edit.

### Files

| Package | Change |
|---|---|
| `content` | Create `src/game/game-config.schema.ts` (+ test); `game-facts.ts` uses it; `ruken-check.ts` → `src/game/ruken/ruken-check.ts`; Ruken-using tests → `src/game/ruken/`, `src/preload/ruken/`; conformance test `src/game/ruken/conformance.test.ts` (AF's enums against `@ruken/manifest`'s) |
| `ui` | `geometry.ts`, `landscape-gate.ts`, `boot-failure.ts` import from `@mcthaydt/automata-host` (new dependency); delete `build/ruken-sdk.ts` and `tsdown.dts.config.ts`; `build/finish-dist.ts` without vendored Ruken types |
| `testing` | `fixtures/viewport-window.ts` on host types; `tsdown.config.ts` drops `bundleRuken` |
| `runtime` | `extension/define-extension.ts` on content's `GameConfig`; `testing/runtime-test.ts` → `testing/ruken/runtime-test.ts` (`RuntimeTest` keeps its export path); each test importing `@ruken/sdk-host` → a `ruken/` folder beside its subject; `build/ruken-manifest.ts` deleted, `build/ruken-sdk-host-testing.ts` → `build/ruken/`; `tsdown.config.ts` |
| `game` | `define-game.ts` on `GAME_ID_PATTERN`; `build/ruken-manifest.ts` deleted with its vendor entry; the two screens tests → `src/screens/ruken/` |
| `ship` | `config/ship-config.ts` on content's `GameConfig`; `manifest/*`, `publish/publish-to-ruken*`, `deploy/deploy-dev*` and the Ruken parts of `errors.ts` → `src/targets/ruken/`; the itch files → `src/targets/itch/` |
| `cli` | `check/csp-probe-live.ts` → `check/ruken/csp-probe-live.ts` |

### Steps

1. [x] **Game config schema.** `game-config.schema.test.ts`: parses Emberwick's and the template's configs; rejects an
   unknown renderer, rating, input or orientation and an id that breaks the pattern. Red: no module. Green: the schema.
2. [x] **Conformance with Ruken's manifest** (`content/src/game/ruken/conformance.test.ts`): AF's `RENDERERS`,
   `ORIENTATIONS`, `INPUTS`, `RATINGS` equal Ruken's; `GAME_ID_PATTERN` and `SLUG_RE` agree on a fixture list. Red: a
   deliberately wrong enum, then restored.
3. [x] **Consumers on the AF schema:** `game-facts.ts`, `define-extension.ts`, `define-game.ts`, `ship-config.ts`. Each
   package's suite and `tsc` pass; every `ship.config.ts` type-checks unchanged.
4. [x] **`ui` and `testing` on host types;** their Ruken type vendoring removed. `ui`'s and `testing`'s suites, `pnpm
   build` and `api-report` show no public type change except the declarations' source.
5. [x] **Moves into `ruken/`** (the Files table), relative imports fixed; every moved suite passes unchanged.
6. [x] **Red/green for the moves:** a temporary `rg` check (the same as DIST.3b's rule will enforce) lists no file
   under `packages/*/src` or `packages/*/build` importing `@ruken/*` outside a `ruken/` segment.
7. [x] Changeset (patch: `content`, `ui`, `testing`, `runtime`, `game`, `ship`); `api-report --update`, `api-index`,
   `agent-skills --write`.
8. [ ] Gates; one push; draft PR stacked on #323.

### Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `api-report`; `api-index`; `agent-skills`; changesets;
consumer smoke from packs (build configs change); `build:examples`, `build:demos`; focused E2E: placeholder, base-2d
(their configs read ship and content), demos. Parity: `ui`'s geometry types only, no behavior or golden change
(omitted, with the reason).

## DIST.3b

### Interfaces

- **Produces:** `automata-check-boundaries --platform-imports <root>...` (rule `platform-import`); `pnpm boundaries`
  runs it over `packages games examples tooling`. `@mcthaydt/automata-ship` `rukenHeaders(config, target)` and
  `RukenHeaderTarget`.

### Files

| Where | Change |
|---|---|
| `tooling/check-boundaries` | Create `src/platform-imports.ts` (+ test); `cli.ts` `--platform-imports`; `check.ts` adds the rule name |
| `packages/ship` | Create `src/targets/ruken/ruken-headers.ts` (+ test), exported from the root |
| `games/emberwick`, `games/placeholder`, `games/base-3d` | `vite.config.ts` uses `rukenHeaders` (no `@ruken/manifest`); `e2e/host/` → `e2e/ruken/`; `src/boot.ts`(+test) → `src/ruken/`; the placeholder's `s8/` → `ruken/s8/` |
| `tooling/examples-runner` | `host/preview-headers.ts` uses `rukenHeaders`; `host/host.ts` → `host/ruken/host.ts`; the playground's `harness.ts`, `fake-host-options.ts`, `frame-policy.ts` (+ tests) → `src/playground/ruken/` |
| `tooling/consumer-smoke` | the `ruken.toml` header reader → `src/ruken/ruken-headers.ts` |
| root | `package.json` `boundaries`; `knip.jsonc` (the placeholder's moved entry) |

### Steps

1. [x] **The rule.** `platform-imports.test.ts`: each import form outside its folder is found with the import and the
   replacement named; each platform is allowed only under its own folder; strings, comments and templates are not
   imports; Svelte scripts are read at their lines; tests and Svelte files are collected, `node_modules`, `dist` and
   declarations are not; the CLI exits 1 with each finding and 0 on a clean tree. Red: no module. Green.
2. [x] **The repo, red:** the rule over the four trees (and `agents/`) found 18 imports (games 11, tooling 7).
3. [x] **`rukenHeaders`.** Red: no module; green (3 cases, equal to `compileHeaders` on the checked manifest).
4. [x] **Moves and the games' Vite configs** (the Files table); every moved suite passes.
5. [x] **The repo, green:** 0 findings; `pnpm boundaries` runs the rule.
6. [x] Changeset (patch: `check-boundaries`, `ship`); API outputs.
7. [ ] Gates; one push; draft PR stacked on #326.

**Out of 3b, by decision (veto items):** the games' `build:<target>` scripts with `--mode` go to DIST.6 with
`create-game` (every game today ships to Ruken only; dropping plain `build` would change turbo's and CI's build of
the games), so the three games keep an explicit `automata-ruken` condition. Running content's Ruken fields check only
for Ruken builds needs the target passed to the content compiler; proposed as a follow-up row.

## Execution log

- 2026-10-31: plan written on `claude/dist-4-fake-host` `b112a019`. Measured: 55 files import `@ruken/*` outside a
  `ruken/` folder (packages 41, games 11, tooling 10 before excluding strings in tests).
- DIST.3a step 1: red (no module), then green 7/7 (`content/src/game/game-config.schema.ts`; `exactOptional()` for the
  optional keys under `exactOptionalPropertyTypes`).
- Step 2: `content/src/game/ruken/conformance.test.ts`. Red with `'adult'` added to `RATINGS` (the enum case
  failed), green restored, 3/3; type-level checks that each config section fits the manifest section the Ruken target
  writes.
- Step 3: `game-facts.ts` on the AF schema (`RukenFields` keeps its name and shape: it still names the file the Ruken
  target reads). `define-extension.ts`, `define-game.ts` and `ship-config.ts` import the schema from a new browser-safe
  `@mcthaydt/automata-content/game-config` entry (content's root carries Node-only compiler code). `defineGame`'s
  message says "is not a game id". `ShipConfig extends GameConfig`; `game.sdk` is optional, and `rukenToml` writes no
  `sdk` line without one (new test, red then green: Ruken's parser then refuses the manifest naming `game.sdk`).
- Step 4: `ui` (geometry, landscape gate, boot failure) and `testing` (viewport fixture) on host types; `ui`'s
  `tsdown.dts.config.ts` and `build/ruken-sdk.ts`, and `game`'s `tsdown.config.ts` and `build/ruken-manifest.ts`, are
  deleted with their vendoring; `runtime` vendors `@ruken/sdk-host`'s types only. `packages/ui/dist` and
  `packages/game/dist` have no `vendor/` folder and no `@ruken` string after `pnpm build`.
- Step 5: the moves of the Files table, with an import-aware mover (rewrites only import specifiers, `vi.mock` and
  `new URL(…, import.meta.url)`). Found and fixed on the way: a first mover rewrote a fixture string (`'../up'` in
  `ruken-check.test.ts`, caught by its test); files moved together kept a sibling import (`./ruken-check`,
  `./runtime-test.js`, caught by `tsc`); a test computing `src/` from `__dirname` (`run-game.test.ts`, caught by its
  test); and a broad `@ruken/` grep that matched comments, moving `run-game.ts` and `build/finish-dist.ts`, which were
  moved back unchanged.
- Step 6: no `import`/`export … from`/`import()` of `@ruken/*` under `packages/*/src` or `packages/*/build` outside a
  `ruken/` segment (grep; DIST.3b's rule makes it permanent).
- Deferred to DIST.3b: content's compiler still runs the Ruken fields check for every game (`compile-content.ts` calls
  `ruken/ruken-check.ts`); spec §5.2 runs it only for a game that builds for `ruken`, which needs the target passed to
  the compiler's Vite plugin.
- Gates: `pnpm format`; `TURBO_FORCE=true pnpm check`: lint, typecheck (37), boundaries, style pass; knip found the
  now-unused `@ruken/manifest` dev dependency of `runtime` (removed; knip clean). `pnpm build`; `api-report --update`
  (content's new entry and types; `ShipConfig extends GameConfig`; runtime's and ui's aliases); `api-index` after doc
  comments on the four type aliases; `pnpm cheatsheet`; `agent-skills --write`. `pnpm test:unit` 35/35;
  `check-changesets` 31, 0 problems; consumer smoke from packs passed; `build:examples`, `build:demos` pass; E2E
  placeholder, base-2d and demos 14/14. Parity omitted: no sim, renderer or golden change; `ui`'s change is type
  imports only.
- DIST.3b steps 1–6: the rule red (no module), then green with its tests (check-boundaries 109 tests); the repo red with
  18 findings (games 11, tooling 7; the release tooling's string fixtures correctly not counted), then 0 after the
  moves; `rukenHeaders` red then green (its first "no eval" assertion was wrong: Ruken's CSP has
  `'wasm-unsafe-eval'`, so it now matches the quoted `'unsafe-eval'` keyword). `automata-verify`'s rule table
  documents `platform-import` (an agent-skills test requires every rule there). knip: the placeholder's moved entry,
  and `@ruken/manifest` no longer used by `games/emberwick` and `games/base-3d` (3D lane's `package.json`, one line).
- DIST.3b gates: `pnpm format`; `TURBO_FORCE=true pnpm check`: lint, typecheck (37), boundaries (60, 55 and 2,563
  files, 0 findings), style, knip pass; `test:unit` failed once on the undocumented rule (fixed), then 35/35. `pnpm
  build`; `api-report --update` (ship: `rukenHeaders`, `RukenHeaderTarget`); `api-index`, `pnpm cheatsheet`,
  `agent-skills --write`. `check-changesets` 32, 0 problems. Consumer smoke from packs passed. `build:examples`,
  `build:demos` pass; the placeholder's S8 budget (`budget:size`) met from `ruken/s8/`. E2E (Chromium) placeholder,
  base-2d, demos, examples and playground-frame: first run 95 passed, 1 skipped, **1 failed**:
  `core-saves.e2e.ts` "another device changes the slot" ran out of its 30 s test budget (31.6 s) at a key press after
  the remote write and Load newer had succeeded through the moved host; first-attempt trace kept in the session
  scratchpad. Re-run alone: 3/3 passed, that test in 19.9 s. Not this change's: the run was two workers on four
  CPUs, and the test sits near its budget; noted for the integration owner rather than changed here.
- DIST.3a, after review: merged #323 (with #321's declared breaks and `main`). No package imports `@ruken/*` outside a
  `ruken/` folder after the merge. The changeset declares 3a's own breaks with a `BREAKING:` line (`ShipConfig`,
  `defineExtension`'s `GameConfig`, `ui`'s `ErrorCode`, the vendored declarations gone); the plain `pnpm api-report`:
  13 breaks, 0 undeclared. `pnpm check` passes; `api-index`, `agent-skills`, `check-changesets` clean.
- DIST.3b, after review: merged #326 (with #323, #321 and `main`). Conflicts: `games/base-3d/vite.config.ts` (`main`'s
  e2e host origin, now through `rukenHeaders`), `games/base-3d/package.json` (`main`'s `@playwright/test` kept,
  `@ruken/manifest` dropped), this plan, and the lockfile (regenerated). The rule over the four trees: 2,496 files, 0
  findings. `pnpm check` passes; `pnpm build`; `pnpm api-report` 13 breaks, 0 undeclared; `api-index`,
  `agent-skills`, `check-changesets` clean; `base-3d`'s new E2E project 3/3 (standalone under Ruken's headers, in the
  fake host on another origin, no screen before ready).
