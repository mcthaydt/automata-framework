# M8: CLI 1.0 and adoption (milestone spec)

- **Status:** Draft, approved on recommended defaults by the Owner (2026-10-16 ruling: "approve all AF spec reviews … M3.0–M8.0 drafts, on recommended defaults; money stays mocked"); decisions M8-D1 to M8-D14 (§15) are listed for veto. Task **M8.0** in [02 Master delivery plan](../../02-master-delivery-plan.md). The review that merges this draft freezes the contracts in §4. After that they change only additively or through a written change request (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)).
- **Owner direction:** 2026-10-11: AF is Ruken first; M8 is "full CLI, codemods, docs, 1.0 (AF is finished for 2D and 2.5D); FloorFifty and The Last Light each run a slice on AF packages" (master spec §11). 2026-10-16 ([PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) PD-1, F6): core is free (MIT, public npm), extensions are Automata Plus, and from M8 a breaking change needs a codemod. 2026-10-16 ([DX spec](./2026-10-16-dx-small-games-ai-native-design.md) D-DX-1): core publishes to public npm. 2026-10-16 ([PUB spec](./2026-10-16-publish-targets-design.md)): a game targets Ruken or itch.io at build time.
- **Depends on:** "everything it adopts" (01 §3).
  - 1.0 needs every core contract that AF 1.0 claims: M4 and M5 core parts, PRODUCT.L, PRODUCT.1, DX.2, PUB.1.
  - It also needs core on public npm (DX.11; blocked on the Owner's `NPM_TOKEN`) and the Plus workspace (PRODUCT.5; blocked on the Owner's `mcthaydt/automata-plus` repo).
  - The FloorFifty slice needs M4.1–M4.4 (the `ui` geometry and layout primitives it adopts).
  - The Last Light slice needs M6.4 (`sectors`) and M6.6 (`puzzle`), and so M3 (`render-pixi3d`, for `sectors`' render side) and D-1.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `6664a6f` | What exists (§2): `packages/cli/src/*`, `packages/ship/src/cli-args.ts`, `tooling/release/src/{check-changesets,publishable-packages,write-vendored}.ts`, `tooling/api-report/src/{breaks,run,extract}.ts`, `.changeset/config.json`, every `packages/*/package.json` |
| FloorFifty, `SNEKPRTY/FloorFifty` | `ac72660` (local clone at `/home/user/floorfifty`, read 2026-10-17) | The FloorFifty slice: `apps/client/src/ruken/*`, `managers/{assets,fetch-progress,load-meter,veil,boot-version-check}.ts`, `ui/boot-loader.ts`, `ui/layout/*`, `ui/{form-factor,height-tier,hidden-browser-bar,viewport-tracking.svelte,device-class}.ts`, `tests/client/{ruken,managers,ui}/*`, `tests/e2e/*`, `package.json` toolchain pins |
| The Last Light, `mcthaydt/pixijs3d_experiment_001` | `17eb568` (local clone, read 2026-10-17) | The Last Light slice: `src/game/{puzzle,puzzle-solver,sectors,sector-format}.ts`, `src/game/contracts/puzzle.ts`, `tests/{puzzle-*,clinic-puzzle,sectors}.test.ts`, `tests/generated/*-routes.test.ts`, `package.json`, `AGENTS.md` (frozen contracts) |
| Ruken, vendored | RukenApp `b30d31b` ([`vendor/ruken/`](../../../vendor/ruken/README.md)) | `@ruken/manifest` `parseManifest`; `ruken publish` (packs and validates); `@ruken/sdk-host` `createFakeHost`, `compileHeaders`; Ruken's pinned-SHA playthrough of FloorFifty (`floorfifty.sha`, [extraction map](./2026-10-11-core-and-extensions-extraction-map.md) row 33) |
| [Master spec](./2026-10-11-automata-framework-ruken-first-design.md) §4.1 (`cli` row), §11, §12 D-2 | — | The CLI's command list; M8's outcome and exit; D-2's default |
| [01 Decomposition](../../01-decomposition.md) §3, §4 (M8) | — | `create`/`update`/`lock`/`deploy`/`validate`/`doctor`, codemods, docs, 1.0; the slices and the pinned-commit pattern |
| [PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) F6, §6, §10 P-b, PD-1 | approved | Versioned contracts and codemods; `automata add`; the Party Racer as FloorFifty's full-loop acceptance |
| [DX spec](./2026-10-16-dx-small-games-ai-native-design.md) §3.5, §3.6, D-DX-1 | approved | `create-game`, `npm create @mcthaydt/automata`, `automata check`; public npm |
| [PUB spec](./2026-10-16-publish-targets-design.md) §2 | approved | `automata build --target ruken\|itch\|web` |
| [M6 spec](./2026-10-16-m6-gameplay-extensions-design.md) §4.3, §4.5, §13 (branch `claude/clever-pasteur-ujmu6e-m6spec`) | approved | `sectors` and `puzzle` contracts; P-b (the 16 route tests) and SC-a |
| [M7 spec](./2026-10-17-m7-online-store-design.md) §11 | merged | The highest Ruken request number so far (R-15) |

**Not verified here:**
- public npm publishing (no `NPM_TOKEN`);
- the Plus registry (no `automata-plus` repo);
- any AF package installed into FloorFifty or The Last Light (neither has a branch that consumes AF);
- FloorFifty's and The Last Light's own CI;
- a Windows or macOS shell for the CLI.

FloorFifty and The Last Light test counts are top-level `it(`/`test(` calls (appendix A), not runs.

## 1. Goal and boundaries

**Goal.** AF 1.0: the free core is stable, documented and published, and one command line does the whole life of a game:
- create it;
- add a Plus kit;
- check it;
- run it under the fake host;
- build it for a target, validate it and publish it;
- update it across AF versions, with codemods doing the edits.

Two real games prove the framework by running part of themselves on AF packages, each passing its own existing tests at a pinned commit.

**Deliverables:**
1. **The `automata` CLI at 1.0** (`packages/cli`, core): the commands in §4.1, one binary, `--json` and exit codes 0/1/2 on every command (as `automata check` already does).
2. **Versioning from 1.0** (§4.2):
   - semver on the fixed core group;
   - an API report diffed on every release;
   - a major release that fails without a codemod;
   - deprecations that live for at least one minor.
3. **Codemods and `automata update`** (§4.3), including the 0.x → 1.0 migration of a `create-game` output.
4. **1.0 documentation** (§4.4): guides, the generated API reference, the migration guide, all checked in CI.
5. **The 1.0 release** of the core packages to public npm (§4.5).
6. **Reference-game checks** (§4.6): AF's nightly job installs AF's packed packages into each reference game at its pinned commit and runs that game's adopted-slice tests (Ruken's `floorfifty.sha` pattern).
7. **Adoption slices (D-2, §4.7):**
   - FloorFifty runs its host, loading and layout on AF core;
   - The Last Light runs its puzzle and sectors on AF Plus.

**D-2 is decided here (M8-D1):** a slice each, not a full migration.
- **FloorFifty:** `host`, loading and `ui` layout.
- **The Last Light:** `puzzle` and `sectors`.
- FloorFifty's whole loop (room, race, results) is proven separately by the Party Racer (PRODUCT.8, PRODUCT spec P-b), not by moving FloorFifty itself.
- The 3D game's concept stays with GAME-3D.0.

**Exclusions:**
- **No full migration** of either reference game. Its gameplay, content, server and art stay its own.
- **No changes to FloorFifty's or The Last Light's tests** to make a slice pass. A slice changes source, never the tests that judge it (§6).
- **No `automata pack`.** Ruken packs and validates (`ruken publish`); AF never builds its own zip (master spec §4.1, M1.2). PUB's itch.io zip is `ship`'s, behind `--target itch`.
- **No separate `automata lock`** (M8-D5). `doctor` reports mixed AF versions and `update` aligns them.
- **No 3D in 1.0:**
  - `render-pixi3d` stays unpublished (D-1);
  - full 3D is M9;
  - 2.5D is in 1.0 only as far as M3 lands it, privately while D-1 stands.
- **Website deployment is not here** (DX.12, M10).
- **Plus packages are not part of the core 1.0.** They release on their own line from the Plus workspace (M8-D8).
- **No real money**, as in M7.

**Prerequisites:**
- DX.11 for M8.9 (public 1.0).
- PRODUCT.5 for every Plus-facing command (`add`, the Plus half of `doctor`) and for the Last Light slice.
- Owner read access for AF's CI to `SNEKPRTY/FloorFifty` and `mcthaydt/pixijs3d_experiment_001` (M8-D11) for M8.10–M8.12.

## 2. What already exists (verified at `6664a6f`, not rebuilt)

### 2.1 On `main`

| Capability | Where | M8 does |
|---|---|---|
| `automata` binary with `create-game` and `check` | `packages/cli/src/bin.ts` (151 lines), `create-game.ts` (299), `check/*` (9 files) | Becomes the dispatcher for every command (§4.1); `check` and `create-game` are unchanged |
| `automata check [dir] [--json] [--sim-only] [--csp] [--fail-fast]`, exit 0/1/2 | `packages/cli/src/check/` (DX.6) | The model for every command's report and exit codes |
| `automata-ship prepare \| publish \| deploy-dev \| test-remote` | `packages/ship/src/cli-args.ts`, `cli.ts` | `automata validate`, `publish` and `deploy` call the same Effect programs; `automata-ship` stays for the reusable workflows (M8-D4) |
| `prepareBuild` (writes `ruken.toml`, `parseManifest`, version, tag, root-absolute and secret checks) | `packages/ship/src/prepare/` | `validate` is `prepare` without writing outside a temp copy (§4.1) |
| Changesets, one fixed group `@mcthaydt/automata-*`, `access: restricted` | `.changeset/config.json` | `access: public` for core at DX.11; semver from 1.0 (§4.2) |
| "Every changeset is a patch before 1.0" check | `tooling/release/src/check-changesets.ts` | From 1.0: patch/minor/major allowed; a major needs a codemod (§4.2) |
| API reports per core package; undeclared break fails; "before 1.0 a patch with `BREAKING:`, from 1.0 a major" | `tooling/api-report/src/breaks.ts`, `run.ts`; `tooling/api-report/reports/*.api.md` | Adds the codemod requirement and the deprecation rule (§4.2) |
| API index, cheatsheet, `llms-api.txt`, the skill's `api.md` | `tooling/api-index`, `tooling/agent-skills` | The 1.0 API reference is this output (§4.4) |
| Release list and published-package checks; `VENDORED.md` in packages that bundle Ruken code | `tooling/release/src/{publishable-packages,verify-published,write-vendored}.ts` | Unchanged; 1.0 still bundles the vendored Ruken code until Ruken publishes (01 §6) |
| Core package versions | `packages/*/package.json` | `0.0.2` for content, host, node, physics, ship, sim, testing, ui; `cli` 0.0.1 and `render-pixi` 0.0.1 private; `runtime` 0.0.0 private; `game` private (DX.2, G-1) |

### 2.2 Pending elsewhere (consumed, not redefined)

- **DX.5:** `create-game` makes a real game (both targets, PUB.5). **DX.11:** MIT, public npm. **Follow-up (DX.2):** publish `runtime`, `render-pixi` and `game`.
- **PRODUCT.5:** `automata add <kit>` and the Plus registry. M8 lists it under the CLI but does not rebuild it.
- **PUB.2/PUB.3:** `ship --target itch`, the web adapter. `automata build --target` dispatches to them.
- **M4, M5, PRODUCT.L:** the core contracts 1.0 freezes. **M6.4/M6.6:** `sectors` and `puzzle`.
- **M7.7:** the server deploy target. `automata deploy --server` dispatches to it when `server` is installed.

**Not in AF anywhere:**
- `update`, `doctor`, `dev`, `validate`, `build`, `deploy` and `publish` as `automata` commands;
- any codemod or codemod runner;
- a deprecation policy;
- user guides;
- a reference-game job;
- any branch of FloorFifty or The Last Light that consumes AF.

## 3. Ownership

| State or contract | Owner (lane, package) | Writers | Consumers |
|---|---|---|---|
| The `automata` command set, its flags, reports and exit codes | integration, `packages/cli` | `packages/cli` | games, the plugin hooks (DX.7), docs |
| Build, validate, publish and deploy programs | ship lane, `packages/ship` | `packages/ship` | `automata` commands, the reusable workflows |
| Versions, changesets and the release | ship lane, `tooling/release`, `.changeset/` | the "Version packages" PR | npm, games |
| API reports, breaks, deprecations | ship lane, `tooling/api-report` | `pnpm api-report --update` | the release check, codemods |
| Codemods (`packages/cli/codemods/<from>-to-<to>/`) | the lane that makes the break | that lane's PR, with the break | `automata update` |
| Guides (`docs/guide/`) | integration | each feature's PR | the website (DX.10, M10) |
| Reference-game pins (`reference/<game>.json`) and the nightly job | ship lane | the reference-game PR that moves a pin | the M8 exit |
| The FloorFifty slice | FloorFifty's repository (its owner's process: FloorFifty `AGENTS.md`) | a FloorFifty PR | AF's reference job |
| The Last Light slice | The Last Light's repository (its `AGENTS.md`: the owner approves every gate; contracts frozen) | a The Last Light PR with a "Contract change" section | AF's reference job |

## 4. Contracts

### 4.1 The `automata` commands (`packages/cli`, M8.1–M8.6)

Every command:
- runs in a game folder (or `[dir]`);
- prints text by default and one JSON object with `--json`;
- exits 0 (pass), 1 (findings) or 2 (a tool, file or network step could not run). A step that could not run is never reported as a pass (DX spec §6).

Commands are thin. Each calls one Effect program from `cli`, `ship`, `content` or the Plus workspace and adds no logic of its own (M8-D4).

| Command | Does | Program | Task |
|---|---|---|---|
| `automata create-game <dir> [--id] [--title]` (and `npm create @mcthaydt/automata <dir>`) | Scaffolds a game | `createGame` (exists; DX.5 completes it) | — |
| `automata add <kit>` | Copies a Plus kit or starter | PRODUCT.5 | — |
| `automata check [--json] [--sim-only] [--csp] [--fail-fast]` | The rules | `runCheck` (exists) | — |
| `automata dev [--port] [--host-origin]` | Vite dev server plus the fake Ruken host harness: one page, the game in a frame, `compileHeaders`' CSP on the game | new, over `@ruken/sdk-host` (as `tooling/examples-runner` does) | M8.4 |
| `automata build [--target ruken\|itch\|web]` | `vite build` with the target's host adapter selected at build time (PUB §2) | the game's `vite build` with `AF_TARGET` | M8.5 |
| `automata validate [--dist] [--target]` | Checks the build without publishing: for `ruken`, `prepareBuild` and `parseManifest` on a temp copy; for `itch`, PUB.2's prepare checks | `prepareBuild`, PUB.2 | M8.5 |
| `automata publish [--target] [--activate]` | `ship publish` (`ruken publish`, which packs and validates) or PUB.2's butler push | `ship` | M8.5 |
| `automata deploy [--dev\|--server]` | `deploy-dev` to the standalone dev host; `--server` runs M7.7's deploy when `server` is installed, else exit 2 naming the missing package | `ship`, Plus `server` | M8.5 |
| `automata update [--to <version>] [--dry-run]` | Runs the codemods from the game's AF version to the target, aligns every `@mcthaydt/automata-*` dependency to one version, reinstalls, then runs `automata check` | §4.3 | M8.3 |
| `automata doctor` | Reports the environment and the project (§4.1.1) | new | M8.4 |

#### 4.1.1 `doctor` checks

Each check is a row (`pass`, `warn`, `fail`, `skipped` with the reason). Doctor never changes a file.

| Check | Fails when |
|---|---|
| Node | The major differs from AF's `docs/versions.md` (24) |
| Package manager | pnpm or npm missing; a pnpm major other than AF's |
| AF versions | Two `@mcthaydt/automata-*` packages resolve to different versions (the case `lock` would have covered, M8-D5) |
| Plus access | A Plus package is a dependency and the registry token is missing; the error names the variable, never its value |
| Game files | `ship.config.ts`, `src/main.ts` or the content folder missing; `ruken.toml` would not parse (via `prepareBuild` on a temp copy) |
| Browsers | Playwright's browsers missing (needed by `check --csp` and `dev`'s smoke) |
| Ruken | The vendored Ruken revision the installed `@mcthaydt/automata-host` bundles (`VENDORED.md`), shown, never fetched |

### 4.2 Versioning from 1.0 (`tooling/release`, `tooling/api-report`, M8.1)

- **Core is one fixed group.** It stays one version for every core package, as now (`.changeset/config.json` `fixed`). `access` becomes `public` at DX.11.
- **Semver from 1.0.0.**
  - A patch fixes behavior without changing an API report.
  - A minor adds to a report.
  - A major removes or changes an export.
  - `check-changesets.ts` allows `minor` and `major` once the group's version is ≥ 1.0.0, and still refuses `minor`/`major` before it.
- **A major needs a codemod.** The release check fails when a changeset bumps the group to a new major unless `packages/cli/codemods/<old>-to-<new>/` exists with at least one transform and its tests. A break the codemod cannot fix is listed in the migration guide with the manual edit (M8-D6).
- **Deprecation.** An export is marked `@deprecated <replacement>` in its doc comment. It then keeps working for at least one minor and is removed only in a major whose codemod rewrites its uses (M8-D7). The API index shows deprecated exports, and `automata check` warns (exit 0) on a use of one.
- **What 1.0 freezes.** It freezes the API reports of the core packages DX.11 publishes, checked with `pnpm api-report` on the release commit. The seams in `tooling/api-report/src/seams.ts` are part of the freeze.

### 4.3 Codemods and `update` (`packages/cli/codemods`, M8.2, M8.3)

```ts
/** One source edit, applied to a game's TypeScript and Svelte files. */
export interface Codemod {
  readonly id: string                        // `0.x-to-1.0/rename-start-game-option`
  readonly description: string               // one line, shown by `update --dry-run`
  readonly transform: (file: SourceFile) => SourceEdit[] // pure; no I/O
}
export interface SourceFile { readonly path: string; readonly text: string }
export interface SourceEdit { readonly start: number; readonly end: number; readonly text: string }
export interface Migration {
  readonly from: string                      // a semver range, `0.0.x`
  readonly to: string                        // `1.0.0`
  readonly codemods: readonly Codemod[]      // applied in order
  readonly manual: readonly string[]         // breaks no codemod fixes, copied into the migration guide
}
```

- **Parsing.** Transforms parse with the TypeScript compiler API, which AF already uses (`tooling/api-report/src/extract.ts`), not with a new codemod library (M8-D6). A transform returns edits; the runner applies them, refuses overlapping edits, and writes nothing on `--dry-run`.
- **Testing.** Each codemod has input/output fixtures (`<id>.input.ts`, `<id>.output.ts`). A test also proves it is idempotent: running it twice changes nothing.
- **The `update` order:**
  1. Read the game's AF version from `package.json`.
  2. Pick the migrations whose `from` covers it, up to `--to` (default: the CLI's own version).
  3. Run them in version order.
  4. Set every `@mcthaydt/automata-*` dependency to the target.
  5. Run the package manager's install.
  6. Run `automata check`.

  Each step's result is in the report, and a failed step stops the run (exit 1 for findings, 2 for a tool).
- **Git.** `update` refuses a dirty git tree (exit 2) unless `--allow-dirty`, so a migration is always reviewable as one diff.
- **0.x → 1.0.** The migration covers every break recorded as a `BREAKING:` changeset line between `0.0.2` and 1.0. M8.2 lists them from `.changeset/` history and the API reports, and each becomes a codemod or a `manual` entry.

### 4.4 1.0 documentation (`docs/guide/`, M8.6)

- **Guides.** Getting started (`npm create`, `dev`, `check`), "Your first system", content and localization, input and layout, saves, publishing to Ruken, publishing to itch.io (PUB.5's guide, moved in), adding a Plus kit, updating AF, and the 0.x → 1.0 migration.
- **API reference.** The API index output (`api.md`, `llms-api.txt`, `llms-full.txt`) and the cheatsheet, generated, never hand-edited.
- **Checks in CI.** Every guide's code block marked `ts` compiles against the workspace packages (extracted to a temp project), relative links resolve, and every command a guide names exists in `automata --help`. A guide that mentions a Plus feature says it is Plus.
- **Hosting.** The website (DX.10, M10) renders `docs/guide/`. M8 does not deploy it.

### 4.5 The 1.0 release (M8.9)

1. Review the API freeze (§4.2). The Owner's review of the API reports diff since `0.0.2` is the gate.
2. Add a changeset that bumps the core group to `1.0.0`. This needs `check-changesets` at its 1.0 rule.
3. Merge the "Version packages" PR. Publishing to public npm needs DX.11's `NPM_TOKEN`.
4. Run `verify-published` against npm.
5. In a clean container, run the consumer smoke from npm: `npm create @mcthaydt/automata`, then `automata check --csp`.

### 4.6 Reference-game checks (`reference/`, `.github/workflows/reference-games.yml`, M8.10)

```json
// reference/floorfifty.json
{ "repo": "SNEKPRTY/FloorFifty", "sha": "<40-hex>", "install": "pnpm install --frozen-lockfile",
  "tests": ["pnpm vitest run tests/client/ruken", "pnpm vitest run tests/client/managers/assets.test.ts", "…"],
  "e2e": ["pnpm exec playwright test tests/e2e/ruken-host.spec.ts --project=desktop"] }
```

1. **Checkout.** The nightly job (and `workflow_dispatch`) checks out each game at its pinned `sha` with a read token (M8-D11).
2. **Install AF.** It packs AF's core and the Plus packages the slice uses at the AF commit under test. It then installs them into the game through pnpm `overrides` or npm `overrides` (no edit to the game's files in its repository).
3. **Test.** It runs the listed tests. The pin moves only through an AF PR that names the game's commit and links its PR.
4. **Failure.** A red reference job blocks the next AF release (M8-D12). It is reported with the first failing test and the game commit, never retried into green.

### 4.7 Adoption slices (M8.11, M8.12)

**FloorFifty (core).** These measures are at `ac72660`.

| Slice part | FloorFifty source | AF replacement | Tests that must pass unchanged |
|---|---|---|---|
| Host | `apps/client/src/ruken/*.ts`: 6 files, 458 lines over vendored `@ruken/sdk` | `@mcthaydt/automata-host` `Hosting` layer; FloorFifty's modules keep their exports and become wrappers | `tests/client/ruken/*.test.ts`: 15 files, 90 tests; e2e `ruken-host.spec.ts` |
| Loading | `managers/{assets,fetch-progress,load-meter,veil,boot-version-check}.ts` (566 lines), `ui/boot-loader.ts` (119) | `@mcthaydt/automata-runtime` boot and loading (byte progress, stall, Try again, version check) | `tests/client/managers/{assets,fetch-progress,load-meter,boot-version-check}.test.ts` (47 tests), `tests/client/ui/boot-loader.test.ts` (3), `boot-first-paint.test.ts` (10); e2e `loading-throttled.spec.ts` |
| Layout | `ui/layout/*` (10 Svelte components, 5 modules) and `ui/{form-factor,height-tier,hidden-browser-bar,viewport-tracking.svelte,device-class}.ts`, 1,396 lines together | `@mcthaydt/automata-ui` geometry owner and layout primitives (M1.6, M4) | `tests/client/ui/{form-factor,form-factor-boundary,height-tier,hidden-browser-bar,viewport-tracking,layout-rules}.test.ts` and `tests/client/ui/layout/`; e2e `responsive-layout.spec.ts`, `shell-layout.spec.ts`; `desktop-guard.spec.ts` darwin baselines unchanged (FloorFifty `AGENTS.md`) |

- **Toolchain gap.** FloorFifty pins `vitest ^3.2.4` and `pixi.js ^8.21.0`; AF pins `vitest 5.0.3` and `pixi.js 8.21.0` (8.22 after M3.2). FloorFifty's tests run on its own vitest. AF's packages are libraries and must load under it (M8-D13). A pixi bump in AF (M3-D3) is checked against FloorFifty's range before the pin moves.
- **Sizes.** The slice records FloorFifty's client lines before and after, with appendix A's commands. No target is set: the slice's exit is its tests, not a line count.

**The Last Light (Plus).** These measures are at `17eb568`.

| Slice part | The Last Light source | AF replacement | Tests that must pass unchanged |
|---|---|---|---|
| Puzzle | `src/game/puzzle.ts` (134), `puzzle-solver.ts` (329), `contracts/puzzle.ts` (73) | Plus `puzzle` (M6.6; `PuzzleDef` unchanged in shape) | `tests/puzzle-engine.test.ts` (5), `puzzle-solver.test.ts` (8), `clinic-puzzle.test.ts` (3); `tests/generated/*-routes.test.ts`: 16 route tests (bay 8, clinic 5, clinic-dawn 2, prologue 1), regenerated by AF's generator only if The Last Light's own pipeline regenerates them |
| Sectors | `src/game/sectors.ts` (180), `sector-format.ts` (64) | Plus `sectors` (M6.4) sim side: `resolveMap`, `sectorAt`, `floorAt`, `segmentBlocked` | `tests/sectors.test.ts` (1); The Last Light's `scripts/verify/playthrough.mjs` reaches "won"; its clinic pixel diff stays 0 |

- **Frozen contracts.** `src/game/contracts/**` is frozen in The Last Light (its `AGENTS.md`). Moving `contracts/puzzle.ts` to an import from AF's `puzzle` is a contract change, proposed in that PR's "Contract change" section for its owner to approve.
- **Toolchain gap.** The Last Light uses npm, TypeScript `^5.9.3` and `vitest ^5.0.3`; AF compiles with TypeScript 7. Plus `puzzle` and `sectors` must ship `.d.ts` that TypeScript 5.9 reads (M8-D13), proven by the reference job's `tsc --noEmit`.
- **D-1.** `sectors` is private while D-1 stands (M6-D3). The Last Light is a private repository, so it installs the packed tarball through the reference job and its own `file:` dependency, as it already does for `@pixi/3d`.

## 5. Data and lifecycle flows

**`automata update` (0.0.x → 1.0.0):**
1. Read `package.json` and the lockfile, and resolve the current AF version. Mixed versions give exit 1, naming each package; `doctor` would report the same.
2. Check that the git tree is clean, unless `--allow-dirty`.
3. Select the migrations and print their codemod ids and manual items.
4. For each codemod in order: parse each `src/**/*.{ts,svelte}` file and collect its edits. Refuse a file with overlapping edits and leave it untouched (finding). Write the edited files.
5. Rewrite the `@mcthaydt/automata-*` ranges to the exact target.
6. Install. A failed install gives exit 2, with the package manager's message.
7. Run `automata check`, embedding its report.
8. Print the manual items left for the developer.

Git shows the whole change as one diff, and `git checkout .` undoes it.

**`automata dev`:**
1. Start Vite on a free port (or `--port`).
2. Start the fake-host page on the next port, with the game in an iframe, the game's origin allow-listed, and `compileHeaders`' CSP on the game's responses.
3. Print both URLs. Ctrl-C closes both servers through their `Scope`.

**The release (1.0):** the API freeze review, the 1.0 changeset, the Version packages PR, then publish (npm), `verify-published`, the npm consumer smoke and the reference job. Each step's result is recorded in 02's execution record.

**The reference job:** checkout at the pin, install AF's packs, run the slice's tests and e2e, then report. It runs nightly and on demand, and it is required before an AF release (M8-D12).

## 6. Failure policy

| Case | Behavior |
|---|---|
| A command's tool is missing (vite, Playwright, pnpm, butler) | Exit 2 naming what to install; never a pass |
| `update` on a dirty tree | Exit 2, nothing written |
| A codemod throws or makes overlapping edits on a file | That file is left untouched; finding with the file and codemod id; the other files' edits stand; `check` still runs; exit 1 |
| `update --to` a version with no migration path (a downgrade, or a gap) | Exit 2 naming the versions; nothing written |
| `publish` without `RUKEN_TOKEN`/`BUTLER_API_KEY` | Exit 2 naming the variable (never its value), nothing uploaded |
| `deploy --server` without the `server` package | Exit 2 naming the Plus package |
| `doctor` cannot read a file | That row is `skipped` with the reason, and the run exits 2 if any row could not run |
| A major changeset without a codemod folder | The release check fails naming the changeset |
| A reference game's test fails | The nightly job is red with the first failing test; the next AF release waits; the pin is not moved to hide it |
| A slice needs a reference game's test changed | Not allowed. The slice is redesigned, or the gap is written up as an AF change request. A test the game's owner changes for their own reasons moves with the pin, recorded in the pin's PR |
| npm publish fails part-way (some packages published) | `verify-published` lists what is missing; the fixed group is re-published at the next patch; nothing is unpublished |

## 7. UI inventory

M8 adds no game UI.
- The CLI's text output follows `automata check`'s format: one line per step with `pass`/`fail`/`skipped`, and findings indented under their step.
- `dev`'s harness page is the existing fake-host page (`tooling/examples-runner`).
- The FloorFifty slice keeps FloorFifty's screens. Any visible change shows up in its `desktop-guard` diff and needs that game owner's approval.

## 8. Responsive behavior

No new layouts. The FloorFifty slice is the responsive test: its own `responsive-layout` and `shell-layout` e2e and its darwin screenshot baselines must pass unchanged on AF's `ui` geometry. A difference is a slice failure, not a baseline update.

## 9. Test allocation

| Layer | What |
|---|---|
| Unit (Node) | Each codemod's fixtures and idempotence; the runner's overlap refusal and dry run; `update`'s version selection and failure exits; `doctor` rows on fixture projects; `check-changesets` at 0.x and ≥ 1.0; the codemod-required release rule; the deprecation rule in `api-report`; the commands' argument parsing and `--json` shapes |
| Integration (Node, temp dirs) | `update` on a `create-game` output generated by the last 0.x CLI (packed), to the 1.0 packs, then `check` passes and the game's golden is unchanged; `validate` on a good and a broken build; guide code blocks compile |
| Fake-host E2E (Chromium) | `automata dev` serves a `create-game` output that boots, plays and pauses under the harness with zero CSP violations |
| Reference games (nightly, GPU runner where e2e) | §4.6 for each game |
| Release | `verify-published` and the npm consumer smoke after the 1.0 publish |
| Owner gates | The API freeze review; the 1.0 publish; each slice's acceptance in its own repository |

## 10. Feedback workflow

- Codemods are developed against their fixtures first: `pnpm --filter @mcthaydt/automata-cli vitest run codemods/<id>`.
- `update`'s integration test reuses one packed set of AF tarballs per run (`pnpm pack` into the run's temp dir), keyed by the AF commit.
- The reference job is focused by `workflow_dispatch` input (`game`, `tests`). Locally it is `pnpm reference <game> [--tests ...]`, with the clone in a temp folder per run and the ports from `ports-for`.

## 11. Ruken alignment and requests

- `validate` and `publish` use `@ruken/manifest`'s `parseManifest` and `ruken publish`. AF adds no pack and no second validator (master spec §4.1).
- `dev` uses `@ruken/sdk-host`'s fake host and `compileHeaders`, as the examples runner does.
- `doctor` shows the vendored Ruken revision and never fetches anything.
- The reference job follows Ruken's pinned-SHA FloorFifty playthrough (`floorfifty.sha`).
- **Requests to Ruken:**
  - **R-16:** publish `@ruken/sdk`, `@ruken/sdk-host` and `@ruken/manifest` to npm, so AF 1.0 depends on them instead of bundling `b30d31b` (01 §6 lists the publication; this asks for npm specifically, because AF core is on public npm, D-DX-1).
  - **R-17:** a `ruken validate <dir>` command, so `automata validate` need not run `prepare` on a temp copy. Until then, `prepareBuild` plus `parseManifest` is the check, and `ruken publish` stays the final validator.

## 12. Tasks

| ID | Task | Lane | Depends on |
|---|---|---|---|
| M8.1 | Versioning from 1.0: `check-changesets` 1.0 rule, codemod-required major, deprecation rule, API index marks deprecated | ship | — |
| M8.2 | Codemod runner and the 0.x → 1.0 migration (list every `BREAKING:` since `0.0.2`) | integration | M8.1 |
| M8.3 | `automata update` | integration | M8.2, DX.5 |
| M8.4 | `automata doctor` and `automata dev` | integration | DX.5 |
| M8.5 | `automata build`, `validate`, `publish`, `deploy` over `ship` (and PUB.2, M7.7 when present) | integration, ship | PUB.1, PUB.2 |
| M8.6 | 1.0 guides and their CI checks | integration | M8.3–M8.5 |
| M8.7 | API freeze review: the report diff since `0.0.2` | Owner | M4, M5 core parts, PRODUCT.L, M8.1 |
| M8.8 | Publish `runtime`, `render-pixi`, `game`, `cli` (the DX.2 follow-up, if not already done) | runtime, render, game | DX.11 |
| M8.9 | The 1.0 release (§4.5) | ship | M8.7, M8.8, DX.11 (`NPM_TOKEN`) |
| M8.10 | Reference-game job and pins | ship | read access (M8-D11) |
| M8.11 | FloorFifty slice (in FloorFifty) | FloorFifty | M8.10, M4.1–M4.4 |
| M8.12 | The Last Light slice (in The Last Light) | The Last Light | M8.10, M6.4, M6.6, PRODUCT.5 |
| M8.13 | M8 exit evidence | integration | all |

## 13. Exit criteria and acceptance cases

- **U-a.** A game generated by the last 0.x `create-game` (packed) runs `automata update --to 1.0.0`. The result is one diff, every codemod listed, `automata check` passing and the game's golden hash unchanged.
- **U-b.** Running `update` a second time changes nothing.
- **U-c.** `update` on a dirty tree exits 2 and writes nothing.
- **U-d.** A codemod with overlapping edits on a fixture file leaves that file untouched and reports it.
- **V-a.** `check-changesets` refuses `minor` before 1.0 and accepts it after.
- **V-b.** A `major` changeset without `codemods/<old>-to-<new>/` fails the release check, naming the changeset.
- **V-c.** Removing an export without a major changeset fails `api-report` as an undeclared break.
- **C-a.** Every command in §4.1 prints `--json` that parses, and exits 2 when its tool is missing.
- **C-b.** `automata dev` boots a `create-game` output under the fake host with zero CSP violations.
- **C-c.** `validate` passes a good Ruken build and fails one with an absolute asset path, naming the file.
- **D-a.** Every guide's `ts` block compiles, every relative link resolves, and every command a guide names is in `automata --help`.
- **R-a.** Core is on public npm at `1.0.0`, MIT, and `npm create @mcthaydt/automata x && cd x && npx automata check --csp` passes on a clean machine with no token.
- **F-a.** FloorFifty at its pinned commit, with AF's packed core installed, passes the tests in §4.7's FloorFifty table, its darwin `desktop-guard` baselines included.
- **L-a.** The Last Light at its pinned commit, with AF's packed `puzzle` and `sectors`, passes the tests in §4.7's table. Its playthrough reaches "won" and its clinic pixel diff is 0.
- **F-b (failure).** Breaking a FloorFifty-used export in AF turns the reference job red, naming the first failing FloorFifty test.

**Gates reported separately:**
- implemented;
- locally verified (`pnpm check`, parity, e2e);
- CI verified;
- published (npm 1.0);
- reference job green;
- each game's owner accepted its slice;
- Owner accepted.

**External dependencies:** `NPM_TOKEN` (DX.11); the `automata-plus` repo (PRODUCT.5); read tokens for both reference repositories; itch.io's `BUTLER_API_KEY` for `publish --target itch`; R-16 and R-17 are not blockers.

## 14. Risks

| Risk | Mitigation |
|---|---|
| A reference game moves fast (The Last Light was at `948abe9` in the extraction map, now `17eb568`) | Pins, not branches; the slice PR in each game names the pin |
| The two games' toolchains differ from AF's (vitest 3 vs 5, TypeScript 5.9 vs 7) | M8-D13: published packages are plain ESM with `.d.ts` checked by the reference job under each game's own compiler |
| 1.0 freezes contracts M4 and M5 have not finished | M8.7 is gated on their core tasks; 1.0 waits rather than freezing a draft |
| Bundled Ruken code in a public package | `VENDORED.md` names the commit and hashes; R-16 removes the bundle |
| Codemods drift from the breaks they fix | A major cannot release without them (V-b), and U-a runs on the real packs |

## 15. Open decisions (recommended defaults in effect; listed for the Owner's veto)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M8-D1 | D-2: adoption scope | **A slice each: FloorFifty host + loading + layout (core); The Last Light puzzle + sectors (Plus).** FloorFifty's whole loop is PRODUCT.8's job | Master spec §12 default; PRODUCT P-b already proves the loop on AF without moving FloorFifty |
| M8-D2 | Command name for scaffolding | **Keep `create-game`** (and `npm create`); no `create` alias | DX spec §3.5 and the plugin already use it; one name |
| M8-D3 | One binary or several | **One `automata` binary**; `automata-ship` stays as the workflows' entry | Workflows already call `automata-ship`; changing them is churn |
| M8-D4 | Where command logic lives | **In the programs (`ship`, `cli`, `content`, Plus); commands only parse and print** | One owner per behavior; workflows and CLI share code |
| M8-D5 | `automata lock` | **Not built**: `doctor` reports mixed versions, `update` aligns them | The fixed group already gives one version; a lock file would be a second source |
| M8-D6 | Codemod engine | **TypeScript compiler API with text edits**, no jscodeshift/ts-morph | AF already depends on `typescript`; no new dependency |
| M8-D7 | Deprecation window | **At least one minor, removed only in a major with a codemod** | F6; predictable for users |
| M8-D8 | Plus versioning | **Plus releases on its own line**, each Plus release states the core range it supports | Plus changes more often; core 1.0 must not wait on it |
| M8-D9 | What 1.0 includes | **The core packages DX.11 publishes plus `runtime`, `render-pixi`, `game`, `cli`** (M8.8) | A 1.0 without the runtime could not run a game |
| M8-D10 | 2.5D in 1.0 | **Only what M3 has landed, private while D-1 stands**; 1.0 is not held for 2.5D | D-1 forbids publishing `render-pixi3d` |
| M8-D11 | Reference-repo access | **A fine-grained read-only token per repository, stored as an AF secret by the Owner** | Both repositories are private; Owner action |
| M8-D12 | Reference job and releases | **Required green before an AF release; nightly otherwise** | A slice that breaks unseen defeats the exit |
| M8-D13 | Toolchain compatibility | **Plain ESM and `.d.ts` readable by TypeScript ≥ 5.9; no vitest coupling in runtime packages** | Both reference games' pins |
| M8-D14 | Docs location | **`docs/guide/` in AF, rendered by the website** | One source; M10 owns hosting |

## Appendix A. How the counts were produced

On FloorFifty at `ac72660`:

```sh
cat apps/client/src/ruken/*.ts | wc -l; ls tests/client/ruken/*.test.ts | wc -l
grep -hcE '^\s*(it|test)(\.each\([^)]*\))?\(' tests/client/ruken/*.test.ts | paste -sd+ | bc
cat apps/client/src/managers/{assets,fetch-progress,load-meter,veil,boot-version-check}.ts | wc -l
wc -l apps/client/src/ui/boot-loader.ts
cat apps/client/src/ui/layout/* apps/client/src/ui/{form-factor,height-tier,hidden-browser-bar,viewport-tracking.svelte,device-class}.ts | wc -l
for f in assets fetch-progress load-meter boot-version-check; do grep -cE '^\s*(it|test)\(' tests/client/managers/$f.test.ts; done
grep -cE '^\s*(it|test)\(' tests/client/ui/boot-loader.test.ts tests/client/ui/boot-first-paint.test.ts
```

On The Last Light at `17eb568`:

```sh
wc -l src/game/{puzzle,puzzle-solver,sectors,sector-format}.ts src/game/contracts/puzzle.ts
for t in tests/generated/*-routes.test.ts tests/puzzle-solver.test.ts tests/puzzle-engine.test.ts tests/sectors.test.ts tests/clinic-puzzle.test.ts; do
  echo "$t $(grep -cE '^\s*(it|test)(\.each)?\(' "$t")"
done
```
