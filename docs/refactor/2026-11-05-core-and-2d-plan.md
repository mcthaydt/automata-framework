# Core and 2D refactor: plan

> **For the agent building this:** work through the tasks in order with the superpowers `executing-plans` skill
> (`test-driven-development` for every code change, `verification-before-completion` before ticking a box). Steps
> use checkboxes (`- [ ]`). Tick a step only when its check has passed, in the same session, and update
> [progress.md](progress.md) at the end of every task (section "Tracking"). No subagents: the Owner allows none.

**Goal:** carry out the [spec](2026-11-05-core-and-2d-spec.md): four feature-grouped core packages, Effect out of
the browser, tests in `tests/` folders, Emberwick's journeys gating every pull request in Chromium and WebKit, and
a repository with `main` plus fewer than five branches.

**Architecture:** behaviour-preserving moves first (phases 1 to 4), then the one semantic change (phase 5, Effect
out), then naming, process and copy (phases 6 to 8), then the branch clean-up (phase 9). Every phase is its own pull
request off `main` and merges before the next starts.

**Tech stack:** pnpm 10 + turbo 2.11, Node 24.21, TypeScript 6 (strict, `isolatedDeclarations`), Vitest 5 with
browser mode (Playwright provider), Playwright 1.63, Svelte 5.57, PixiJS 8.22, Zod 4.6, Biome. Effect 3.22 stays in
Node tooling only.

**Sessions:** each task is sized for one session of under 90 minutes. A session ends by ticking its steps,
updating `progress.md`, pushing, and writing a two-line handoff at the bottom of this file's execution log.

---

## Tracking

`docs/refactor/progress.md` holds the stage table. During stage 4 (build) it also holds this table, one row per
task, and the stage's percentage is `done tasks / 30`:

```markdown
### Build: 0% (0 of 30 tasks)

| Task | Phase | Status | PR |
|---|---|---|---|
| 1.1 Per-area Playwright configs | 1 | Not started | |
...
```

At the end of each task: set its row to "Done, <date>", recompute the build percentage and the overall
percentage (`stages done / 24`, counting the build stage as done only at 30 of 30), and commit the change with the
task.

---

## Phase 1: CI tells the truth (one PR, branch `claude/refactor-2d-ci`)

### Task 1.1: Per-area Playwright configs

**Files:**
- Create: `games/emberwick/playwright.config.ts`, `examples/playwright.config.ts`, `games/base-3d/playwright.config.ts`,
  `tooling/examples-runner/playwright.config.ts`, `tooling/playwright-preset/src/index.ts`,
  `tooling/playwright-preset/package.json`
- Modify: `package.json` (`test:e2e`), `turbo.json` (a `test:e2e` task), each moved area's `package.json`
  (`"test:e2e": "playwright test"`)
- Delete: `playwright.config.ts` (root)

- [ ] **Step 1: Write the preset.** One function holds what every config shared in the root file (reporter,
  retries, trace, the `AF_E2E_*` port scheme) so each area's config is short:

  ```ts
  // tooling/playwright-preset/src/index.ts
  // The settings every AF Playwright config shares. Each game or example set has its own config, which starts
  // only its own servers, so a run for one area never waits on another area's builds.
  import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

  /** A phone and an iPad, the two sizes every 2D journey runs at. */
  export const sizes = {
    phone: devices['iPhone 15'],
    ipad: devices['iPad Pro 11'],
  } as const

  export function defineJourneys(config: PlaywrightTestConfig): PlaywrightTestConfig {
    return defineConfig({
      testMatch: '**/*.test.ts',
      fullyParallel: true,
      retries: process.env.CI ? 1 : 0,
      reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
      use: { trace: 'retain-on-failure' },
      ...config,
    })
  }
  ```

- [ ] **Step 2: Emberwick's config.** `testDir: 'e2e'` for now (phase 3 moves it to `tests/e2e`), the two
  `webServer` entries that today live in the root config (`e2e:game`, `e2e:host`), and four projects:
  `emberwick-phone-chromium`, `emberwick-ipad-chromium`, `emberwick-phone-webkit`, `emberwick-ipad-webkit`
  (`{ ...sizes.phone, browserName: 'webkit' }`, and so on). The golden-route journey is tagged `@slow` and runs in
  the two `ipad` projects only (`grepInvert` on the phone projects).
- [ ] **Step 3: Run it and see it pass in both engines.**
  `pnpm --filter @af-examples/base-2d exec playwright test` → expected: every journey passes in all four projects.
  A WebKit-only failure is a product bug: fix it in this task, with a unit test that shows the cause where one can.
  Record the first-attempt result in the execution log.
- [ ] **Step 4: The other areas.** Move each remaining project of the root config into its area's config
  (examples, base-3d, examples-runner playground). Keep `placeholder` out: phase 2 deletes it, and until then it is
  run by nothing.
- [ ] **Step 5:** Root `package.json`: `"test:e2e": "turbo run test:e2e"`; `turbo.json` gets the task with
  `"cache": false`. Delete the root `playwright.config.ts`. Run `pnpm test:e2e --filter @af-examples/base-2d
  --filter @af-examples/examples` → passes.
- [ ] **Step 6: Commit** `ci(e2e): one Playwright config per game and example set`.

### Task 1.2: The pull request gate

**Files:**
- Modify: `.github/workflows/ci.yml`, `package.json` (`ci:local`, `test:journeys`)
- Create: `.github/workflows/release-checks.yml`, `.github/workflows/3d-and-editors.yml`

- [ ] **Step 1: `checks` job** keeps: install, lint, typecheck, boundaries, style, knip, `test:unit` (core and 2D
  only: `--filter='!./packages/editor-*' --filter='!@af-games/base-3d' --filter='!./packages/render-pixi3d'
  --filter='!./packages/figures' --filter='!./packages/sector-format'`), audit:deps, secrets, deps:new. It drops
  `test:journeys`, the example builds, the bundle budget, both changeset checks, `api-report`, `build`, the dist
  test, `api-index`, `agent-skills` and `plugin:validate`.
- [ ] **Step 2: New `e2e-2d` job** on every non-draft PR and push to `main`: install Chromium and WebKit, run
  `pnpm --filter @af-examples/base-2d test:e2e` and `pnpm --filter @af-examples/examples test:e2e`, upload the
  report on failure. `timeout-minutes: 20`.
- [ ] **Step 3: `parity`** runs core and 2D packages only (same filters as step 1).
- [ ] **Step 4: `3d-and-editors.yml`:** triggered on PRs whose paths include `packages/editor-*/**`,
  `packages/render-pixi3d/**`, `packages/figures/**`, `packages/sector-format/**`, `games/base-3d/**`,
  `examples/render3d/**`, `examples/figures/**`, **or** any core package (so the codemod's results are checked). It
  runs those packages' unit, parity and journey suites. It is not a required check for a PR that does not touch
  their paths.
- [ ] **Step 5: `release-checks.yml`:** on `release: published`, `workflow_dispatch` and nightly: build, dist test,
  `api-report`, `api-index`, `agent-skills`, `plugin:validate`, `changeset status`, `check-changesets`, consumer
  smoke. `release-packages.yml` calls it before publishing.
- [ ] **Step 6:** Remove the nightly `e2e` job (its work is now `e2e-2d` on every PR plus the 3D and editors
  workflow). Remove the `placeholder` game job.
- [ ] **Step 7:** `ci:local` becomes `pnpm check && pnpm test:parity && pnpm test:e2e --filter
  @af-examples/base-2d --filter @af-examples/examples`.
- [ ] **Step 8: Check:** `pnpm lint:actions` passes; push the branch and see the PR run `checks`, `parity` and
  `e2e-2d` green. Commit `ci: gate pull requests on 2D journeys; move release and 3D/editor suites out`.

### Task 1.3: The frame budget skips on a software renderer

**Files:**
- Modify: `tooling/frame-budget/src/budget.ts`, `tooling/frame-budget/src/check-cli.ts`
- Test: `tooling/frame-budget/src/budget.test.ts`

- [ ] **Step 1: Failing test.** In `budget.test.ts`: a result whose `environment.gpu` is a software renderer
  (`SwiftShader`, `llvmpipe`) gives `{ verdict: 'skipped', message: 'skipped: drawn by a software renderer
  (llvmpipe), so the frame budget cannot be measured here' }`, and the CLI exits 0. Run `pnpm --filter
  @mcthaydt/frame-budget test` → fails (today: "NOT COMPARABLE", exit 1).
- [ ] **Step 2:** Make the software-renderer branch at `budget.ts:113` return `skipped`; the CLI exits 0 on
  `skipped` and 1 only on `over`. A GPU mismatch (`budget.ts:149`) stays a failure. Test passes.
- [ ] **Step 3:** Move the `frame-budget` job to nightly only. Commit `fix(frame-budget): skip, not fail, on a
  software renderer`.

### Task 1.4: `.vscode`

**Files:**
- Create: `.vscode/settings.json`, `.vscode/extensions.json`
- Modify: `.gitignore` (stop ignoring `.vscode/` if it is listed; keep ignoring `.vscode/*.local.json`)

- [ ] **Step 1:** `settings.json` with the audit's section 6 lists as `files.exclude` and `search.exclude` (the
  same keys, `true`), the "hide while 2D runs" block under its comment, plus:

  ```jsonc
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[svelte]": { "editor.defaultFormatter": "svelte.svelte-vscode" },
  "typescript.tsdk": "node_modules/typescript/lib"
  ```

- [ ] **Step 2:** `extensions.json`: `biomejs.biome`, `svelte.svelte-vscode`, `ms-playwright.playwright`,
  `vitest.explorer`.
- [ ] **Step 3: Check:** `pnpm lint` passes (Biome reads `.vscode/*.json`); open the folder in VS Code (or list
  with `jq '."files.exclude" | keys' .vscode/settings.json`) and confirm every pattern names a path that exists.
  Commit `chore: add .vscode settings that hide generated and tool files`.
- [ ] **Step 4:** Open the phase 1 PR, get it green, merge.

---

## Phase 2: Remove what is unused (two PRs)

### Task 2.1: Tag the starting point

- [ ] `git tag pre-refactor-2d origin/main && git push origin pre-refactor-2d`. A tag is not a branch and deletes
  nothing. Record the commit in the execution log.

### Task 2.2: Emberwick's stand-ins (PR `claude/refactor-2d-unused`)

**Files:**
- Delete: `games/emberwick/src/{play-room,loop,boot-page,boot-failure}.ts`, `src/input/{devices,keys}.ts`,
  `src/render/renderer.ts`, `src/ruken/boot.ts`, and their tests (`play-room.test.ts`, `loop.test.ts`,
  `boot-page.test.ts`, `boot-failure.test.ts`, `input/keys.test.ts`, `render/renderer.browser.test.ts`,
  `ruken/boot.test.ts`)
- Modify: `games/emberwick/package.json` (drop the `./play` export), `examples/content/hot-reload/*` (boot through
  `startGame`), `games/emberwick/src/index.ts`, `games/emberwick/src/exports.test.ts`

- [ ] **Step 1:** Confirm nothing on the game's path uses them: `pnpm knip` with the `./play` export removed lists
  exactly these files as unused (plus their tests). If it lists more or fewer, stop and record why.
- [ ] **Step 2: The hot-reload demo first (TDD).** Its journey (`examples/content/hot-reload/e2e/*.e2e.ts`) passes
  today; change the demo to `startGame(emberwick)` with the content Vite plugin's hot update, and keep the journey
  green.
- [ ] **Step 3:** Delete the files. `pnpm check` and Emberwick's journeys pass. Commit `refactor(emberwick):
  remove the pre-core stand-ins`.

### Task 2.3: The placeholder game (same PR)

- [ ] Delete `games/placeholder`, its `ci.yml` job (already gone in 1.2), `ci:local` steps, the
  `budget:size`/`budget:boot` scripts that hang off it, and the knip/boundaries entries. Move the S8 bundle budget's
  numbers to the bundle report (task 5.1). `pnpm install && pnpm check` passes. Commit `chore: remove the
  placeholder game`. Open the PR, green, merge.

### Task 2.4: Features no game uses (PR `claude/refactor-2d-d4`)

Delete each feature in the spec's section 5 table marked **delete**, one commit each, in this order (leaf first, so
each commit builds): leaderboards, net, haptics and vibration, swipe gestures, gamepad glyph families, rebinding and
input profiles, the Tauri target.

For each feature:

- [ ] **Step 1:** List every file that names it: `grep -rliE '<pattern>' packages games examples tooling --include=*.ts
  --include=*.svelte` (patterns: `leaderboard`, `\bnet\b|NetPort`, `haptic|vibrat`, `swipe`, `glyph-family|GlyphFamily`,
  `rebind|input-profile|InputProfile|ControlsSection`, `tauri`). Paste the list in the commit body.
- [ ] **Step 2:** Delete the files and the exports; remove the host capability from the contract schema, the
  settings section from the settings screen, the example and its journey and replay golden, and the `ship` target.
- [ ] **Step 3:** `pnpm check`, `pnpm test:parity` (core and 2D), Emberwick's journeys and the 3D/editors workflow
  locally (`pnpm --filter @af-games/base-3d test:unit`) all pass. For haptics, `games/base-3d/src/screens/settings.ts`
  loses its vibration line in the same commit.
- [ ] **Step 4:** `pnpm api-report --update` and `pnpm agent-skills --write`; add one changeset per published
  package touched (`major`: removed exports). Commit `feat!(<pkg>): remove <feature>, which no game uses`.
- [ ] **Step 5:** After the seven: amend ADR 0006 (Tauri is no longer a core target; it comes back as a target
  package when a game ships to desktop). Open the PR, green, merge.

---

## Phase 3: Tests in `tests/` folders (one PR, `claude/refactor-2d-tests`)

### Task 3.1: The Vitest preset

**Files:**
- Create: `tooling/vitest-preset/{package.json,src/index.ts}`, `tooling/vitest-preset/tests/unit/preset.test.ts`

- [ ] **Step 1: Failing test:** `defineTests({})` returns two projects named `unit` (include
  `tests/unit/**/*.test.ts`, environment `node`) and `browser` (include `tests/browser/**/*.test.ts`, browser
  mode, instances Chromium, WebKit and Firefox); `defineTests({ svelte: true })` adds the Svelte plugin and
  `*.test.svelte.ts`; `bench` is a third project only when `process.env.AF_BENCH` is set.
- [ ] **Step 2:** Implement in under 60 lines, with a comment on each choice (the connect timeout, the
  `optimizeDeps` list that stops mid-run reloads). Test passes. Commit.

### Task 3.2: The move codemod

**Files:**
- Create: `tooling/codemods/src/move-tests.ts`, `tooling/codemods/tests/unit/move-tests.test.ts`,
  `tooling/codemods/tests/fixtures/move-tests/**`

- [ ] **Step 1: Failing test on a fixture package:** given `src/a/b.ts`, `src/a/b.test.ts`, `src/a/b.parity.test.ts`,
  `src/a/c.dom.test.ts`, `src/a/d.layout.test.ts`, `src/a/e.bench.test.ts`, `src/testing/helper.ts`, the codemod
  moves them to `tests/unit/a/b.test.ts`, `tests/browser/a/b.test.ts`, `tests/unit/a/c.test.ts` (with
  `// @vitest-environment jsdom` added as line 1), `tests/browser/a/d.test.ts`, `tests/bench/a/e.test.ts`, leaves
  `src/testing/helper.ts` where it is (published helper), and rewrites each moved test's relative imports:
  `./b.ts` → `#src/a/b.ts`. It adds `"imports": { "#src/*": "./src/*" }` to `package.json`.
- [ ] **Step 2:** Implement with `oxc-parser` (already a dependency) for import spans and `git mv` for moves, so
  history follows. The suffix → folder table lives at the top of the file with one comment per row. Test passes.
- [ ] **Step 3:** A dry run over the repository prints the move count per package. Expected: about 405 files in core
  and 2D. Record the count. Commit.

### Task 3.3: Run it, package by package

For `sim`, `content`, `host`, `ui`, `runtime`, `render-pixi`, `game`, `automata`, `testing`, `node`, `ship`, `cli`,
`games/emberwick`, then `tooling/*` and `examples`:

- [ ] **Step 1:** Run the codemod on the package. Replace its `vitest.config.ts` with
  `export default defineTests({ svelte: <true for ui, game, runtime> })`. Add `tests` to its `tsconfig.json`
  `include`. Emberwick's `e2e/` moves to `tests/e2e/` and its Playwright config's `testDir` follows.
- [ ] **Step 2:** `pnpm --filter <pkg> test:unit`, `test:parity` (now `test:browser`) and `typecheck` pass, with the
  **same test count as before** (record before and after in the execution log; a lower count is a lost test).
- [ ] **Step 3:** One commit per package: `test(<pkg>): move tests to tests/`.
- [ ] **Step 4:** Update `check-style` (tests exempt by folder, not suffix), `knip.jsonc` and `biome.json` fixture
  paths, and the turbo task names (`test:parity` → `test:browser`). `pnpm check` passes. Open the PR, green, merge.

---

## Phase 4: Four packages, grouped by feature (two PRs)

### Task 4.1: The boundaries rules (TDD, before any move)

**Files:**
- Create: `tooling/check-boundaries/src/features.ts`, `tooling/check-boundaries/src/browser-only.ts`
- Test: `tooling/check-boundaries/tests/unit/features.test.ts`, `.../browser-only.test.ts`, fixtures under
  `tests/fixtures/features/`
- Modify: `tooling/check-boundaries/src/cli.ts`, `src/check.ts` (find sim files by role suffix)

- [ ] **Step 1: Failing tests** for each rule in spec section 3.3 (one fixture per rule: a feature importing a
  feature, shared importing a feature, a feature importing `app/`, logic in `entries/`, product code importing
  `testing/`), each expecting the exact message in spec section 3.5. And for `--browser`: a file reachable from
  `src/entries/index.ts` that imports `effect` fails with `"<file>" runs in the browser and imports "effect". Effect
  is for Node tooling only (ADR 0003).`; the same import in a file not reachable from an entry passes.
- [ ] **Step 2:** Implement over the existing AST reader (`ast.ts`). Tests pass.
- [ ] **Step 3: Sim files by suffix:** failing test that `games/x/src/features/player/player-move.system.ts` is
  checked as a sim file and `games/x/src/features/player/hud.ts` is not; implement; pass. Commit
  `feat(check-boundaries): feature, browser-only and sim-by-suffix rules`.

### Task 4.2: The move map and the import codemod

**Files:**
- Create: `docs/refactor/move-map.json`, `tooling/codemods/src/move-modules.ts`,
  `tooling/codemods/tests/unit/move-modules.test.ts`

- [ ] **Step 1: Write the move map.** One entry per source folder (and per file where a folder splits), from its
  current path to its new one, following the spec's section 3.3. The folder-level map:

  | From | To (`packages/automata/src/…` unless noted) |
  |---|---|
  | `host/src/contract/` | `shared/host/` |
  | `host/src/{web,ruken}/`, `host/src/menu.ts`, `exit-handlers.ts`, `rounds.ts`, `sdk-markers.ts` | `features/targets/{web,ruken}/`, `features/targets/` |
  | `host/src/subscribable.ts` | `shared/lib/subscribable.ts` |
  | `host/src/contract-suite.ts`, `host/src/testing/` | `testing/host/` |
  | `runtime/src/{audio,display,extension,flow,loading,locale,settings}/` | `features/<same>/` |
  | `runtime/src/save/` | `features/saves/` |
  | `runtime/src/input/` | `features/input/` |
  | `runtime/src/{loop,time,presentation,render}/`, `runtime/src/boot/` | `app/{loop,time,presentation,render,boot}/` |
  | `runtime/src/testing/` | `testing/runtime/` |
  | `render-pixi/src/*` | `features/render/` (`no-eval.ts` → `entries/no-eval.ts`) |
  | `ui/src/{controls,dialog,focus,geometry,layout,slots,status,touch,prompts,display,browser}/`, `theme.css` | `shared/ui/<same>/` |
  | `ui/src/saves/` | `features/saves/ui/` |
  | `ui/src/settings/` | `features/settings/ui/` |
  | `ui/src/testing/` | `testing/ui/` |
  | `game/src/{define-game,start-game,default-content}.ts`, `game/src/draw/` | `app/` |
  | `game/src/input/` | `features/input/` |
  | `game/src/screens/` | `features/screens/` (save and settings screens split into `features/saves/ui/` and `features/settings/ui/`) |
  | `game/src/tooling.ts` | `entries/tooling.ts` |
  | `automata/src/*` | `entries/` |
  | `testing/src/{fixtures,layout,input}/` | `testing/` |
  | `testing/src/host/` | `testing/host/` |
  | `testing/src/sim/` | `packages/sim/src/testing/` |
  | `testing/src/e2e/` | `packages/tools/src/e2e/` |
  | `ship/src/*`, `cli/src/*`, `node/src/*` | `packages/tools/src/features/{ship,…}`, `src/features/{create-game,add,check,editor,build}`, `src/shared/node/` |

  And an entry map: every old public entry (`@mcthaydt/automata-runtime`, `…-ui/testing`, `…-render-pixi`, the 16
  that 3D and the editors import, and the rest) → its new entry and, per exported name, where it now comes from.
- [ ] **Step 2: Failing tests for the codemod** on fixtures: it moves files by the map with `git mv`; rewrites
  relative imports inside the moved package; rewrites bare imports in every other workspace package (3D and the
  editors included) by the entry map, splitting one import into two when names now come from two entries; and
  prints the names each consumer imports, which is the surface report (S4).
- [ ] **Step 3:** Implement. Pass. Commit.

### Task 4.3: Build `packages/automata` (PR `claude/refactor-2d-packages`)

- [ ] **Step 1:** Run the codemod for the browser rows. Merge the moved packages' `dependencies` into
  `packages/automata/package.json`; delete the old `package.json`, `tsconfig*.json`, `tsdown.config.ts`,
  `vitest.config.ts`, `biome.json`, `svelte.config.js`, `CHANGELOG.md` and `LICENSE` of `host`, `runtime`,
  `render-pixi`, `ui`, `game` and `testing` (keep `automata`'s, it is the survivor). One `tsdown.config.ts` builds
  every entry.
- [ ] **Step 2:** `pnpm boundaries --features packages/automata` lists every cross-feature import. Fix each: move
  the shared part to `shared/`, or have `app/` pass the value in. The known ones from the audit (S3): `runtime`'s
  11 files that import `ui` (they become `app/boot` importing `shared/ui`, or `features/flow` taking a screen
  component from `app/`); `render-pixi`'s 8 files that import `runtime` or `ui` (render takes the quality and the
  letterbox geometry as arguments). Each fix is its own commit with a test that shows the feature working alone.
- [ ] **Step 3:** `pnpm check`, `pnpm test:browser`, Emberwick's journeys, and the 3D and editors suites pass. The sim
  goldens' hashes are unchanged (`git diff --stat -- '**/__goldens__'` is empty).
- [ ] **Step 4:** API report for `@mcthaydt/automata` updated; one `major` changeset for `@mcthaydt/automata`
  explaining the merge and listing the old package names; the old packages get a final `major` changeset whose
  README says "Use `@mcthaydt/automata`" (they are not published again after it). Open the PR, green, merge.

### Task 4.4: `tools`, and `sim` and `content` inside (PR `claude/refactor-2d-tools`)

- [ ] **Step 1:** Run the codemod for `ship`, `cli`, `node` and `testing/src/e2e` into `packages/tools`. One bin,
  `automata`, dispatches `create-game`, `ship <cmd>`, `add`, `check`, `editor`, `build`; `automata-ship` is an
  alias that prints `automata-ship is now "automata ship". This name goes away in the next release.` to stderr and
  runs. Test both in `tests/unit/cli/bin.test.ts` first.
- [ ] **Step 2:** `sim` and `content` move to `src/{features,shared,app,entries,testing}` by the map (inside each
  package; their names do not change). `testing/src/sim` becomes `@mcthaydt/automata-sim/testing`.
- [ ] **Step 3:** `pnpm boundaries --features packages/{sim,content,tools}` passes; `--browser packages/content`
  checks the three browser-safe entries reach no `effect`, `node:*`, `fontkit`, `pngjs` or `subset-font`.
- [ ] **Step 4:** Every game's scripts use `automata ship prepare`. `pnpm check`, browser, journeys, 3D and editors
  pass. Changesets, API reports. Open the PR, green, merge. **After this task, `packages/` holds `sim`, `content`,
  `automata`, `tools` and the 3D and editor packages, nothing else.**

---

## Phase 5: Effect leaves the browser (two PRs)

### Task 5.1: The bundle report, before

**Files:** Create `tooling/bundle-report/{package.json,src/cli.ts,src/report.ts}`,
`tooling/bundle-report/tests/unit/report.test.ts`

- [ ] **Step 1: Failing test:** given a Vite `manifest.json` and chunk files (fixture), `report` groups gzip bytes
  by package (`pixi.js`, `svelte`, `zod`, `effect`, `@mcthaydt/*`, the game) and prints a table.
- [ ] **Step 2:** Implement (Vite's `build.manifest` plus `rollup-plugin-visualizer`'s JSON, or the source map's
  `sources`; pick the one that needs no new dependency: the source map). Pass.
- [ ] **Step 3:** Run on Emberwick; paste the table into `progress.md` as "Bundle before D2". Commit.

### Task 5.2: The plain-TypeScript helpers (PR `claude/refactor-2d-no-effect-1`)

**Files:** Create `packages/automata/src/shared/lib/{clock,disposables,result}.ts`,
`packages/automata/src/testing/fake-clock.ts`, tests in `packages/automata/tests/unit/lib/`

- [ ] **Step 1: Failing tests:** `disposables()` runs added functions once, in reverse order, and a throwing one
  does not stop the rest (the first error is rethrown after all ran); `fakeClock()` advances time and fires due
  timeouts in order; `Result` is `{ ok: true, value } | { ok: false, reason }` with `ok()`/`refused()` helpers.
- [ ] **Step 2:** Implement, each file under 60 lines with a header comment saying which Effect idea it replaces
  and why it is enough here. Pass. Commit.

### Task 5.3: Host contract and targets (same PR)

- [ ] Convert `shared/host/` and `features/targets/` (today's 10 Effect files in `host`). For each file: rewrite its
  test to plain promises and `Result` first (failing), then the code. The contract suite (`testing/host`) runs
  against every target and passes. `pnpm boundaries --browser packages/automata` shows the host files gone from its
  list. Commit per target. Amend ADR 0003 in this PR. Open the PR, green, merge.

### Task 5.4: Runtime features and the app (PR `claude/refactor-2d-no-effect-2`)

Order, leaf first: `display`, `locale`, `settings`, `audio`, `saves`, `loading`, `input`, `flow`, `extension`,
`screens`, then `app/` (`loop`, `time`, `presentation`, `boot`, `run-game`, `define-game`).

For each:

- [ ] **Step 1:** Rewrite the feature's tests to the plain API (failing).
- [ ] **Step 2:** Convert (spec section 4 table). A service becomes `create<Feature>(deps): <Feature> & { dispose() }`.
- [ ] **Step 3:** The feature's tests pass; Emberwick's journeys pass. Commit `refactor(<feature>): plain
  TypeScript, no Effect`.

Then:

- [ ] **Step 4:** `pnpm boundaries --browser packages/automata` passes with no exceptions; `effect` leaves
  `packages/automata/package.json`; `pnpm knip` is clean.
- [ ] **Step 5:** Bundle report again, as "Bundle after D2", beside the "before" table, with the difference in kB
  gzip. Emberwick boot time in the `@slow` journey's trace, before and after, in the execution log.
- [ ] **Step 6:** 3D and editors pass (they use `runtime/extension` and `ui`; the codemod's entry map covers the
  names; any that used an Effect type get the plain one). Open the PR, green, merge.

---

## Phase 6: One name, one import, Emberwick by feature (one PR, `claude/refactor-2d-emberwick`)

### Task 6.1: Emberwick is Emberwick

- [ ] **Step 1: Failing test** in `games/emberwick/tests/unit/ship-config.test.ts`: id `emberwick`, title
  `Emberwick`.
- [ ] **Step 2:** Package `@af-games/emberwick`, id and title in `ship.config.ts`, Playwright project names, CI job
  name `emberwick`, `pnpm --filter` uses everywhere (`grep -rn "base-2d" --exclude-dir=node_modules` lists none in
  core or 2D afterwards, except the history in `docs/archive/`). Commit.

### Task 6.2: Emberwick imports one package

- [ ] Rewrite Emberwick's imports to `@mcthaydt/automata` (and `@mcthaydt/automata-tools` in config and tests).
  Any name it needs that the root entry lacks is added to `entries/index.ts` with a doc comment. Journeys pass.
  Commit.

### Task 6.3: Emberwick by feature

- [ ] Move `games/emberwick/src` to the layout in spec section 3.3 with the module codemod (a small map in
  `docs/refactor/move-map.json` under `"emberwick"`). `pnpm boundaries --features games/emberwick` and the sim rule
  (by suffix) pass. Retire the GL spec's rule in `AGENTS.md` (phase 7 rewrites it anyway) and in `check-style`'s
  `--game` mode, which now checks features like a package. Same for `games/base-3d`'s style check: it keeps its role
  files until the 3D phase, so `check-style --game` stays for it alone, named `--role-layout games/base-3d/src`.
  Commit.

### Task 6.4: The surface

- [ ] **Step 1:** Run the codemod's surface report over Emberwick, the examples, 3D and the editors. Every export
  of `@mcthaydt/automata` that none of them imports is removed (or made internal), unless it is part of a documented
  API in `docs/guides/` (list those, then decide each in the execution log).
- [ ] **Step 2:** API report, changeset (`major`). Record the export count before and after in `progress.md`
  (audit: 1,042 across twelve packages). Open the PR, green, merge.

---

## Phase 7: Process weight (one PR, `claude/refactor-2d-docs`)

### Task 7.1: Docs and AGENTS.md

- [ ] **Step 1:** `git mv` to `docs/archive/`: `01-decomposition.md`, `02-master-delivery-plan.md`,
  `03-continuation-prompt.md`, `04-how-we-build.md`, `superpowers/`, `history/`, `research/`, `spikes/`,
  `cloud-parity.md`, `stack.md`, `versions.md` (if `docs:stack` still writes it, keep it and its script). Keep
  `00-overview.md` as `docs/README.md`, rewritten to one page.
- [ ] **Step 2:** Write `docs/status.md`: what works today, what is next (the 3D phase), how to run it, links to
  `progress.md`. Under 80 lines.
- [ ] **Step 3:** Rewrite `AGENTS.md` under 150 lines: read order (README, status, progress, this spec), the seven
  laws, the package and feature rules (spec section 3), the test layout, the gates, the drunk grandma test, branch
  rules (no backup or handoff branches; a draft PR or tag instead). The direction paragraph moves to
  `docs/archive/direction-log.md` unchanged.
- [ ] **Step 4:** `docs/evidence/` PNGs: `git rm -r docs/evidence` and add `docs/evidence/` to `.gitignore`; CI
  already uploads evidence as artifacts. Fix links that pointed there (`grep -rn "docs/evidence" --include=*.md`).
- [ ] **Step 5:** `examples/README.md` lists the examples that exist, one line each. Commit.

### Task 7.2: Comments that cite plans

- [ ] **Step 1: Failing test** in `check-style`: a comment `// M5.2 owns this` fails with `A comment should say
  why, not which plan asked for it. Explain the reason in plain words.`; `// The Pixi default is 1, too blurry on
  an iPad` passes.
- [ ] **Step 2:** Implement (comments only, via the AST's comment list; strings and URLs are not checked). Pass.
- [ ] **Step 3:** Run it on core and 2D; rewrite each hit to the reason or delete it (audit: 1,385 hits). This is
  the long step: work file by file, commit per package. 3D and editors are exempt until their phase
  (`--exempt packages/editor-* ...`). Open the PR, green, merge.

---

## Phase 8: Copy, UX and journeys (one PR, `claude/refactor-2d-copy`)

### Task 8.1: The copy table

- [ ] **Step 1:** List every player-facing string in `features/screens/`, `features/saves/ui/`,
  `features/settings/ui/`, the boot failure panel and Emberwick's screens into `docs/refactor/copy.md`: a table of
  where, old text, new text, and which of the four questions (spec section 8) it failed. Also the CLI's messages
  (`automata create-game`, `ship prepare` errors) and the root and package READMEs' first screen.
- [ ] **Step 2:** Apply the new text. The existing DOM tests that assert text change with it.

### Task 8.2: New journeys (Emberwick, `tests/e2e/`)

Each journey asserts by role and accessible name, waits on semantic readiness, and runs in all four Emberwick
projects unless noted. Write each first and see it fail for the right reason (the feature is missing or the copy is
old), then make it pass:

- [ ] **Settings stick:** turn the music off in Settings, reload, the setting is still off.
- [ ] **Pause on hide:** while playing, the page is hidden (`page.evaluate` dispatches `visibilitychange` with
  `document.hidden` stubbed); on return the pause menu is showing and "Resume" continues.
- [ ] **Saved progress:** reach the ember, go back to the title, "Continue" is there and starts at the ember room.
- [ ] **Boot failure:** the host refuses to start (the e2e host's `?fail=boot`); the panel shows one plain sentence
  and a "Try again" button that reloads.
- [ ] **Touch-only on the iPad:** the room can be finished with the on-screen buttons only, and every button is at
  least 48 px (primary) or 44 px (secondary) tall (iPad projects).
- [ ] **Waits show:** throttle the network (`page.route` delay on the content chunk) and see the loading screen with
  its text before the menu.

### Task 8.3: The framework's own journey

- [ ] **`create-game` end to end** (`packages/tools/tests/e2e/create-game.test.ts`, Chromium only): in a temp folder,
  `automata create-game my-game`, `pnpm install` (workspace link), `pnpm build`, `vite preview`, open it, see the
  title screen, press Start, see the game canvas draw (a non-blank pixel), press Escape, see the pause menu. This
  proves the path a new developer takes. It runs in `e2e-2d`.
- [ ] Open the PR, green, merge.

---

## Phase 9: Branches (repository actions, no PR)

### Task 9.1: Prepare

- [ ] **Step 1:** Re-run the audit's branch comparison (appendix command) and write
  `docs/refactor/branches.md`: the merged list (to delete), the unmerged list (to tag `abandoned/<branch>`, then
  delete), the parked drafts #377, #381, #382 (tag `parked/<branch>`, close the PR with a comment naming the tag),
  #378 (close), #383 and #379 (closed as folded in, naming the refactor PR that carries their change; if either was
  not folded in, it stays open instead).
- [ ] **Step 2:** Write `tooling/repo-hygiene/src/prune-branches.ts`: reads `branches.md`, tags first, verifies
  each tag points at the branch tip, then deletes; `--dry-run` by default, `--apply` to act. Test the parsing and the
  "tag before delete, stop on any mismatch" order with a fake `git` in `tests/unit/prune-branches.test.ts`.

### Task 9.2: Run (the Owner's go)

- [ ] **Step 1:** Post the dry run's summary in the thread and ask the Owner to say go. Branch deletion is the
  Owner's call (`AGENTS.md`); this step waits for it.
- [ ] **Step 2:** On go: `--apply`; turn on `delete_branch_on_merge`
  (`gh api -X PATCH repos/mcthaydt/automata-framework -f delete_branch_on_merge=true`). Check: `git ls-remote --heads
  origin | wc -l` is under 5 plus `main`, and every one has an open PR with CI.

---

## Done (stage 4's last step)

- [ ] Every box above ticked; `progress.md` at 30 of 30 for the build.
- [ ] The spec's section 1 list checked line by line in the execution log, each with its command and output.
- [ ] The Owner is asked to play Emberwick on the iPad from the last PR's preview; their answer goes in the log.

## Execution log

- 2026-11-05: plan and spec written (stage 2) on `claude/refactor-2d-plan`.
