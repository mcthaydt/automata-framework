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

**Sessions:** a session is refreshed after 90 minutes (the Owner's rule). Most tasks fit one session; tasks 3.3,
4.3, 5.4 and 7.2 do not, and name their session breaks. A session ends by ticking its steps, updating
`progress.md`, pushing, and writing a two-line handoff at the bottom of this file's execution log. A task that
spans sessions is still one row in the tracking table.

**Changesets:** before 1.0 every changeset is a `patch` (`check-changesets` fails `minor` and `major`, and the
fixed version group would move every package to 1.0.0). A breaking change says so in the changeset's text. A
package that is deleted gets no changeset; it simply stops being released.

**Pull requests:** each phase PR opens as a draft and is marked ready for review once its checks pass locally, so
the gated jobs (`parity`, `e2e-2d`, the game jobs), which skip drafts, run on its head before it merges.

**Reviewed:** stage 3 (the [plan audit](2026-11-05-core-and-2d-plan-audit.md)) checked this plan against the
codebase on 2026-11-05; its fixes (P1 to P31) are applied below.

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
  `tooling/examples-runner/playwright.config.ts`, `tooling/frame-budget/playwright.config.ts`,
  `tooling/playwright-preset/{package.json,tsconfig.json,src/index.ts}`
- Modify: `package.json` (`test:e2e`, `test:frame-budget`), `turbo.json` (a `test:e2e` task), each moved area's
  `package.json` (`"test:e2e": "playwright test"`), `tooling/frame-budget/src/playwright-run.ts` (its `selectRun`
  now wraps only the frame-budget config)
- Delete: `playwright.config.ts` (root)

- [ ] **Step 1: Write the preset.** One function holds what every config shared in the root file (reporter,
  retries, trace, the `AF_E2E_*` port scheme) so each area's config is short:

  ```ts
  // tooling/playwright-preset/src/index.ts
  // The settings every AF Playwright config shares. Each game or example set has its own config, which starts
  // only its own servers, so a run for one area never waits on another area's builds.
  import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

  /**
   * The sizes every 2D journey runs at: a phone, the compact landscape height every layout must hold
   * (780 × 270, AGENTS.md), and an iPad, the Owner's test device.
   */
  export const sizes = {
    phone: devices['iPhone 15'],
    compact: { ...devices['Pixel 7 landscape'], viewport: { width: 780, height: 270 } },
    ipad: devices['iPad Pro 11'],
  } as const

  export function defineJourneys(config: PlaywrightTestConfig): PlaywrightTestConfig {
    return defineConfig({
      // Journeys end in `.e2e.ts` until phase 3 renames them to `*.test.ts` under `tests/e2e/` (task 3.3).
      // Playwright fails a run that matches nothing, so this line and the file names change in one commit.
      testMatch: '**/*.e2e.ts',
      forbidOnly: process.env.CI !== undefined,
      fullyParallel: true,
      retries: process.env.CI ? 1 : 0,
      reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
      use: { trace: 'retain-on-failure' },
      ...config,
    })
  }
  ```

- [ ] **Step 2: Emberwick's config.** `testDir: 'e2e'` for now (phase 3 moves it to `tests/e2e`), the two
  `webServer` entries that today live in the root config (`e2e:game`, `e2e:host`, with the `base2dPorts` env), and
  five projects: `emberwick-phone-chromium`, `emberwick-phone-webkit`, `emberwick-compact-chromium` (today's
  `base-2d-compact`), `emberwick-ipad-chromium`, `emberwick-ipad-webkit` (`{ ...sizes.phone, browserName: 'webkit'
  }`, and so on). The golden-route journey is tagged `@slow` and runs in the two `ipad` projects only (`grepInvert`
  on the others). The project names keep `base-2d` out already; the package is renamed in task 6.1.
- [ ] **Step 3: Run it and see it pass in both engines.**
  `pnpm --filter @af-examples/base-2d exec playwright test` → expected: every journey passes in all five projects.
  A WebKit-only failure is a product bug: fix it in this task, with a unit test that shows the cause where one can.
  Record the first-attempt result in the execution log.
- [ ] **Step 4: The other areas.** Move each remaining project and the servers it needs out of the root config:

  | Today's projects | New config |
  |---|---|
  | `examples`, `examples-compact`, `demos` (hot reload), `ui-primitives`, `matrix-*` (the input matrix, from `@mcthaydt/automata-testing/e2e`) | `examples/playwright.config.ts` |
  | `examples-webkit` (`render3d-*`, `figures-*`), `base-3d` | `games/base-3d/playwright.config.ts` (3D; the 3D/editors workflow runs it) |
  | `playground-*`, `playground-frame-*` | `tooling/examples-runner/playwright.config.ts` |
  | the frame-budget projects (`AF_FRAME_BUDGET=1` through `selectRun`) | `tooling/frame-budget/playwright.config.ts`; root `test:frame-budget` becomes `pnpm --filter @mcthaydt/frame-budget exec playwright test` |

  Keep `placeholder` out: phase 2 deletes it, and until then it is run by nothing. The 2D examples' config ignores
  `render3d-*` and `figures-*`.
- [ ] **Step 5:** Root `package.json`: `"test:e2e": "turbo run test:e2e"`; `turbo.json` gets the task with
  `"cache": false` and `PLAYWRIGHT_BROWSERS_PATH` passed through. Delete the root `playwright.config.ts`. Run `pnpm test:e2e --filter @af-examples/base-2d
  --filter @af-examples/examples` → passes.
- [ ] **Step 6: Commit** `ci(e2e): one Playwright config per game and example set`.

### Task 1.2: The pull request gate

**Files:**
- Modify: `.github/workflows/ci.yml`, `.github/workflows/release-packages.yml`, `package.json` (`ci:local`,
  `test:journeys`, new `test:unit:core` and `test:parity:core`)
- Create: `.github/workflows/release-checks.yml`, `.github/workflows/3d-and-editors.yml`

- [ ] **Step 1: Scripts.** Root `test:unit` and `test:parity` end in `-- <vitest args>`, so `pnpm test:unit
  --filter=…` would hand the filter to Vitest. Add `test:unit:core` and `test:parity:core`, each `turbo run <task>`
  with the filters before the `--`: `--filter='!./packages/editor-*' --filter='!@af-games/base-3d'
  --filter='!./packages/render-pixi3d' --filter='!./packages/figures' --filter='!./packages/sector-format'`. Check
  with `turbo run test:unit <filters> --dry=json | jq '.tasks[].package'`: no 3D or editor package listed.
- [ ] **Step 1b: `checks` job** keeps: install, lint, typecheck, boundaries, style, knip, `test:unit:core`,
  audit:deps, secrets, deps:new, `changeset status` and `check-changesets` (seconds each; spec veto default 9). It
  drops `test:journeys`, the example builds, the bundle budget, `api-report`, `build`, the dist test, `api-index`,
  `agent-skills` and `plugin:validate`.
- [ ] **Step 2: New `e2e-2d` job** on every non-draft PR and push to `main`: install Chromium and WebKit, run
  `pnpm --filter @af-examples/base-2d test:e2e` and `pnpm --filter @af-examples/examples test:e2e`, upload the
  report on failure. `timeout-minutes: 20`.
- [ ] **Step 3: `parity`** runs `test:parity:core` (and `--affected` on PRs, as today).
- [ ] **Step 4: `3d-and-editors.yml`:** triggered on PRs whose paths include `packages/editor-*/**`,
  `packages/render-pixi3d/**`, `packages/figures/**`, `packages/sector-format/**`, `games/base-3d/**`,
  `examples/render3d/**`, `examples/figures/**`, `agents/**`, **or** any core package (so the codemod's results are
  checked). It runs those packages' unit, parity and journey suites (`test:journeys`, the base-3d and 3D examples'
  Playwright config) and base-3d's `game-ci` job, which leaves `ci.yml`. It is not a required check in branch
  protection: a required check that its path filter skips never reports, and the PR could never merge.
- [ ] **Step 5: `release-checks.yml`:** on `workflow_call`, `workflow_dispatch` and nightly: build, dist test,
  `api-report`, `api-index`, `agent-skills`, `plugin:validate`, consumer smoke. Publishing runs from
  `release-packages.yml` on a push to `main` (this repository uses no GitHub releases), so that workflow calls
  `release-checks.yml` first and its publish job `needs` it.
- [ ] **Step 6:** Remove the nightly `e2e` job (its work is now `e2e-2d` on every PR plus the 3D and editors
  workflow) and its `budget:boot` step (the placeholder's; phase 2 deletes it). Remove the `placeholder` game job.
  The `frame-budget` job is already nightly-only; drop its `needs: e2e` (the job it waited on is gone) and keep its
  `concurrency` group.
- [ ] **Step 7:** `check` uses `test:unit:core`; `ci:local` becomes `pnpm install --frozen-lockfile && pnpm check
  && pnpm test:parity:core && pnpm test:e2e --filter @af-examples/base-2d --filter @af-examples/examples`.
- [ ] **Step 8: Check:** `pnpm lint:actions` passes; push the branch and see the PR run `checks`, `parity` and
  `e2e-2d` green. Commit `ci: gate pull requests on 2D journeys; move release and 3D/editor suites out`.

### Task 1.3: The frame budget skips on a software renderer

**Files:**
- Modify: `tooling/frame-budget/src/budget.ts`, `tooling/frame-budget/src/check-cli.ts`
- Test: `tooling/frame-budget/src/budget.test.ts`

- [ ] **Step 1: Failing test.** In `budget.test.ts`: when every result's `environment.gpu` is a software renderer
  (`isSoftwareGpu`: SwiftShader, llvmpipe) and the budget is set and valid, `checkFrameBudget` gives verdict
  `skipped` with the message `skipped: drawn by a software renderer (llvmpipe), so the frame budget cannot be
  measured here`. Run `pnpm --filter @mcthaydt/frame-budget test` → fails (today: `not-comparable`).
- [ ] **Step 2:** Add `skipped` to `Verdict` and to `SEVERITY` (between `unset` and `over`, so an invalid or unset
  budget still wins); the software-renderer branch in `checkFrameBudget` adds `skipped`. `check-cli.ts` exits 0 on
  `pass` or `skipped` and 1 on everything else, so `invalid`, `unset`, `over` and a GPU mismatch still fail closed.
  Tests pass, with a CLI test for each exit code. Commit `fix(frame-budget): skip, not fail, on a software
  renderer`. (The job is already nightly-only; task 1.2 step 6 fixes its `needs`.)

### Task 1.4: `.vscode`

**Files:**
- Create: `.vscode/settings.json`, `.vscode/extensions.json`
- Modify: `.gitignore` (it does not list `.vscode/` today; add `.vscode/*.local.json` only)

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
  Phases 2, 4 and 7 move or delete paths it names; each of those tasks updates `.vscode/settings.json` in the same
  commit. Commit `chore: add .vscode settings that hide generated and tool files`.
- [ ] **Step 4:** Open the phase 1 PR, get it green, merge.

---

## Phase 2: Remove what is unused (two PRs)

### Task 2.1: Land the two open core fixes, then tag the starting point

- [ ] **Step 1 (not done, see the log):** #379 (no double-tap zoom or long-press selection) and #383 (browser-safe content entries
  `./schema` and `./palette`; base-3d's dev server boots) are small fixes from the Owner's iPad tests, open as
  drafts since 2026-11-01. Rebase each on `main`, rerun its own listed gates, mark it ready, and merge once every
  check, parity included, is green on its head (`AGENTS.md` allows the agent to merge its own PRs then). If either
  cannot go green in this session, leave it open and record why; the refactor then carries it in task 4.3.
- [ ] **Step 2 (not done, see the log):** `git tag pre-refactor-2d origin/main && git push origin pre-refactor-2d`. A tag is not a branch
  and deletes nothing. Record the commit in the execution log.

### Task 2.2: Emberwick's stand-ins (PR `claude/refactor-2d-unused`)

**Files:**
- Delete: `games/emberwick/src/{play-room,loop,boot-page,boot-failure}.ts`, `src/input/{devices,keys}.ts`,
  `src/render/renderer.ts`, `src/ruken/boot.ts`, and their tests (`play-room.test.ts`, `loop.test.ts`,
  `boot-page.test.ts`, `boot-failure.test.ts`, `input/keys.test.ts`, `render/renderer.browser.test.ts`,
  `ruken/boot.test.ts`)
- Modify: `games/emberwick/package.json` (drop the `./play` export; drop `@ruken/sdk` if nothing else imports it),
  `examples/content/hot-reload/*` (boot through `startGame`; it also imports `./no-eval`, `./style.css`, `./sim` and
  `./room`, which stay), `games/emberwick/src/index.ts`, `games/emberwick/src/exports.test.ts`

- [x] **Step 1:** Confirm nothing on the game's path uses them: `pnpm knip` with the `./play` export removed lists
  exactly these files as unused (plus their tests). If it lists more or fewer, stop and record why.
- [x] **Step 2: The hot-reload demo first (TDD).** Its journey (`examples/content/hot-reload/e2e/*.e2e.ts`) passes
  today; change the demo to `startGame(emberwick)` with the content Vite plugin's hot update, and keep the journey
  green.
- [x] **Step 3:** Delete the files. `pnpm check` and Emberwick's journeys pass. Commit `refactor(emberwick):
  remove the pre-core stand-ins`.

### Task 2.3: The placeholder game (same PR)

- [x] Delete `games/placeholder`, its `ci.yml` job (already gone in 1.2), `ci:local` steps, the
  `budget:size`/`budget:boot` scripts that hang off it, the knip/boundaries entries, and the placeholder lines of
  the root `ci:local` and `packages/ship/src/workflows.test.ts`. The S8 bundle budget's last numbers go in
  `progress.md`, where the bundle report (task 5.1) picks them up; until then no bundle budget runs. #379 also
  touched the placeholder's `style.css`; nothing else carries over. `pnpm install && pnpm check` passes. Commit
  `chore: remove the placeholder game`. Open the PR, green, merge.

### Task 2.4: Features no game uses (PR `claude/refactor-2d-d4`)

Delete each feature in the spec's section 5 table marked **delete** (the networking port),
plus leaderboards if step 0 says so, one commit each.

- [x] **Step 0: Check what `defineGame` wires in.** Emberwick passes its own `screens` (plain DOM: splash, menu,
  room, paused, end), so it shows none of the default screens; `games/base-3d` uses the default Title, Pause and
  Settings screens with `CORE_SETTINGS`. So the check runs on both games: run each one's journeys with a trace and
  list every screen and section it shows (Title, Pause, Settings: Audio, Controls, Touch, Vibration, Language,
  Display). A feature behind any section either game shows is used, whatever a grep says. For leaderboards: delete
  only if neither game shows leaderboard UI and both boot unchanged without it; record the finding either way in
  the execution log and in the spec's section 5 table.

For each feature:

- [x] **Step 1:** List every file that names it: `grep -rliE '<pattern>' packages games examples tooling --include=*.ts
  --include=*.svelte` (patterns: `\bnet\b|NetPort`, and `leaderboard` if step 0 cleared it). Add `agents` to the search paths. Paste the list in the commit body. Known users that are not games, which go
  with the feature (spec section 5): `core-leaderboard` and its journey,
  `examples-runner`'s fake Ruken host and `examples/ui/primitives` (leaderboards, if deleted).
- [x] **Step 2:** Delete the files and the exports; remove the host capability from the contract schema, the
  settings section from the settings screen, the example and its journey and replay golden, and the `ship` target.
- [x] **Step 3:** `pnpm check`, `pnpm test:parity` (core and 2D), Emberwick's journeys and the 3D/editors workflow
  locally (`pnpm --filter @af-games/base-3d test:unit`) all pass.
- [x] **Step 4:** `pnpm api-report --update` and `pnpm agent-skills --write`; add one `patch` changeset per
  published package touched, whose text says which exports are removed. Commit `feat!(<pkg>): remove <feature>, which no game uses`.
- [x] **Step 5:** Open the PR, green, merge. (ADR 0006 is unchanged: Tauri stays a core target, spec section 5.)

---

## Phase 3: Tests in `tests/` folders (one PR, `claude/refactor-2d-tests`)

### Task 3.1: The Vitest preset

**Files:**
- Create: `tooling/vitest-preset/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`,
  `tooling/vitest-preset/tests/unit/preset.test.ts`

- [ ] **Step 0: Read every config first.** List what each of the 24 `vitest.config.ts` files sets (environment,
  setup files, `css`, plugins, `resolve.conditions`, browser instances, golden `commands`, `optimizeDeps`, connect
  timeout) in the execution log. The preset's options are exactly the differences found, no more (spec section
  3.4).
- [ ] **Step 1: Failing test:** `defineTests({})` returns two projects named `unit` (include
  `tests/unit/**/*.test.ts`, environment `node`) and `browser` (include `tests/browser/**/*.test.ts`, browser
  mode, instances Chromium, WebKit and Firefox); `defineTests({ environment: 'jsdom', setupFiles: [...], css: true
  })` sets them on `unit`; `defineTests({ svelte: true })` adds the Svelte plugins, the `browser` resolve condition
  and `*.svelte.test.ts`; `browserCommands` reaches the browser project; `bench` is a third project only when
  `process.env.AF_BENCH` is set (root `pnpm bench` sets it).
- [ ] **Step 2:** Implement in under 100 lines, with a comment on each choice (the connect timeout, the
  `optimizeDeps` list that stops mid-run reloads). Test passes. Commit.

### Task 3.2: The move codemod

**Files:**
- Create: `tooling/codemods/{package.json,tsconfig.json,vitest.config.ts}` (a new private package),
  `tooling/codemods/src/move-tests.ts`, `tooling/codemods/tests/unit/move-tests.test.ts`,
  `tooling/codemods/tests/fixtures/move-tests/**`

- [ ] **Step 1: Failing test on a fixture package:** given `src/a/b.ts`, `src/a/b.test.ts`, `src/a/b.parity.test.ts`,
  `src/a/c.dom.test.ts`, `src/a/d.layout.test.ts`, `src/a/e.bench.test.ts`, `src/a/f.svelte.test.ts`,
  `src/a/g.schema.test.ts`, `src/a/Host.test.svelte`, `src/testing/helper.ts` and `e2e/play.e2e.ts`, in a package
  whose unit environment is `node`, the codemod moves them to `tests/unit/a/b.test.ts`, `tests/browser/a/b.test.ts`,
  `tests/unit/a/c.test.ts` (with `// @vitest-environment jsdom` added as line 1, because it differs from the
  package's default), `tests/browser/a/d.test.ts`, `tests/bench/a/e.test.ts`, `tests/unit/a/f.svelte.test.ts`,
  `tests/unit/a/g.schema.test.ts` (role suffixes stay), `tests/fixtures/a/Host.test.svelte` and
  `tests/e2e/play.test.ts`; leaves `src/testing/helper.ts` where it is (published helper); and rewrites each moved
  test's relative imports: `./b.ts` → `#src/a/b.ts`. It adds `"imports": { "#src/*": "./src/*" }` to
  `package.json`. A name clash (`b.test.ts` and `b.parity.test.ts` both landing as `b.test.ts` in different
  folders is fine; two in one folder) stops the run with both paths named. The suffix table is the one task 3.1
  step 0 recorded, so every suffix in the repository has a row (`.contract`, `.integration`, `.golden`, `.browser`,
  `.smoke`, `.slow`, `.devices`, `.build`, `.analog`, `.canvas`, …).
- [ ] **Step 2:** Implement with `oxc-parser` (already a dependency) for import spans and `git mv` for moves, so
  history follows. The suffix → folder table lives at the top of the file with one comment per row. Test passes.
- [ ] **Step 3:** A dry run over the repository prints the move count per package. Expected: about 405 files in core
  and 2D. Record the count. Commit.

### Task 3.3: Run it, package by package

For `sim`, `content`, `host`, `ui`, `runtime`, `render-pixi`, `game`, `automata`, `testing`, `node`, `ship`, `cli`,
`games/emberwick`, then `tooling/*` and `examples`. Session breaks: after `ui`, after `cli`, after
`games/emberwick` (four sessions).

- [x] **Step 1:** Run the codemod on the package. Replace its `vitest.config.ts` with one `defineTests({...})` call
  carrying the options task 3.1 step 0 recorded for it. Add `tests` to its `tsconfig.json` `include`. Journeys move
  from `e2e/` to `tests/e2e/` and become `*.test.ts`; the area's Playwright config's `testDir` follows, and when the
  last area has moved, the preset's `testMatch` becomes `**/*.test.ts` (task 1.1).
- [x] **Step 2:** `pnpm --filter <pkg> test:unit`, `test:parity` (now `test:browser`) and `typecheck` pass, with the
  **same test count as before** (record before and after in the execution log; a lower count is a lost test).
- [x] **Step 3:** One commit per package: `test(<pkg>): move tests to tests/`.
- [x] **Step 4:** Update `check-style` (tests exempt by folder, not suffix), `knip.jsonc` and `biome.json` fixture
  paths, and the turbo task names (`test:parity` → `test:browser`). `pnpm check` passes. Open the PR, green, merge.

---

## Phase 4: Four packages, grouped by feature (two PRs)

### Task 4.1: The boundaries rules (TDD, before any move)

**Files:**
- Create: `tooling/check-boundaries/src/features.ts`, `tooling/check-boundaries/src/browser-only.ts`
- Test: `tooling/check-boundaries/tests/unit/features.test.ts`, `.../browser-only.test.ts`, fixtures under
  `tests/fixtures/features/`
- Modify: `tooling/check-boundaries/src/cli.ts`, `src/check.ts` (find sim files by role suffix)

- [x] **Step 1: Failing tests** for each rule in spec section 3.3 (one fixture per rule: a feature importing a
  feature, shared importing a feature, a feature importing `app/`, logic in `entries/`, product code importing
  `testing/`), each expecting the exact message in spec section 3.5. And for `--browser`: a file reachable from
  `src/entries/index.ts` that imports `effect` fails with `"<file>" runs in the browser and imports "effect". Effect
  is for Node tooling only (ADR 0003).`; the same import in a file not reachable from an entry passes.
- [x] **Step 2:** Implement over the existing AST reader (`ast.ts`). Tests pass.
- [x] **Step 3: Sim files by suffix and by import:** failing tests that
  `games/x/src/features/player/player-move.system.ts` is checked as a sim file, that `tuning.ts`, which it imports
  by relative path, is checked too, and that `games/x/src/features/player/hud.ts`, which no sim file imports, is
  not; that an `import type` from `effect` passes `--browser`; and that `#src/x` in a `src/` file fails. Implement;
  pass. Run the new `boundaries` line (spec section 3.5) on today's tree: it must check at least every file today's
  line checks (compare the two file lists in the execution log). Commit `feat(check-boundaries): feature,
  browser-only and sim-by-suffix rules`.

### Task 4.2: The move map and the import codemod

**Files:**
- Create: `docs/refactor/move-map.json`, `tooling/codemods/src/move-modules.ts`,
  `tooling/codemods/tests/unit/move-modules.test.ts`

- [x] **Step 1: Write the move map.** One entry per source folder (and per file where a folder splits), from its
  current path to its new one, following the spec's section 3.3. The folder-level map:

  | From | To (`packages/automata/src/…` unless noted) |
  |---|---|
  | `host/src/contract/` | `shared/host/` |
  | `host/src/{web,ruken,tauri}/`, `host/src/menu.ts`, `exit-handlers.ts`, `rounds.ts`, `sdk-markers.ts` | `features/targets/{web,ruken,tauri}/`, `features/targets/` |
  | `host/src/subscribable.ts` | `shared/lib/subscribable.ts` |
  | `host/src/contract-suite.ts`, `host/src/testing/` | `testing/host/` |
  | `host/src/{web,ruken,tauri}/target.ts` (the `./target` conditional entry) | `entries/target/{web,ruken,tauri}.ts` |
  | `host/src/index.ts`, `runtime/src/index.ts`, `ui/src/index.ts`, `game/src/index.ts`, `render-pixi/src/index.ts` | folded into `entries/index.ts` |
  | `runtime/src/{audio,display,extension,flow,loading,locale,settings}/` | `features/<same>/` |
  | `runtime/src/save/` | `features/saves/` |
  | `runtime/src/input/` | `features/input/` |
  | `runtime/src/{loop,time,presentation,render}/`, `runtime/src/boot/` | `app/{loop,time,presentation,render,boot}/` |
  | `runtime/src/testing/` | `testing/runtime/` |
  | `runtime/src/ruken/`, `runtime/src/input/ruken/`, `game/src/screens/ruken/` (tests of the Ruken seams) | `tests/unit/targets/ruken/` |
  | `ui/src/vitest-setup.ts`, `game/src/vitest-setup.ts` | `tests/fixtures/setup.ts` (one file) |
  | `game/src/no-eval.ts`, `automata/src/no-eval.ts` | `entries/no-eval.ts` (one file; `render-pixi`'s is the one they re-export) |
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
  | `sim/src/{world,schedule,define,rng,replay,hash}/` | `packages/sim/src/features/<same>/` |
  | `sim/src/{math,util}/`, `sim/src/version.ts` | `packages/sim/src/shared/{math,util,version}` |
  | `content/src/{compile,parse,assets,locale,flow,game,tuning,palette,preload,generate,vite}/` | `packages/content/src/features/<same>/` |
  | `content/src/{diagnostics,files,hash,schema}/` | `packages/content/src/shared/<same>/` |
  | `content/src/cli/` | `packages/content/src/app/cli/` |

  And an entry map: every old public entry (`@mcthaydt/automata-runtime`, `…-ui/testing`, `…-render-pixi`, the 16
  that 3D and the editors import, and the rest) → its new entry and, per exported name, where it now comes from.
- [x] **Step 2: Failing tests for the codemod** on fixtures: it moves files by the map with `git mv`; rewrites
  relative imports inside the moved package; moves each package's `tests/<kind>/<old folder>/` to
  `packages/<new package>/tests/<kind>/<new feature>/` by the same map (six `tests/` folders merge into
  `packages/automata/tests/`) and rewrites their `#src/…` imports to the new paths; rewrites bare imports in every
  other workspace package (3D, the editors, `tooling/`, `examples/` and `agents/` included) and in `vitest.config.ts`
  and `vite.config.ts` files by the entry map, splitting one import into two when names now come from two entries;
  and prints the names each consumer imports, which is the surface report (S4).
- [x] **Step 3:** Implement. Pass. Commit.

### Task 4.3: Build `packages/automata` (PR `claude/refactor-2d-packages`)

Session breaks: after step 1 (the move builds and its unit tests pass), and after every five cross-feature fixes
in step 2.

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
- [ ] **Step 3:** `pnpm check`, `pnpm test:browser`, Emberwick's journeys, and the 3D and editors suites pass, with
  the same test count as before the move. The sim goldens' hashes are unchanged: `git diff --stat --
  '**/__goldens__'` is empty and `GOLDEN_HASH` in `games/emberwick/src/golden.ts` is untouched.
- [ ] **Step 4:** API report for `@mcthaydt/automata` updated; one `patch` changeset for `@mcthaydt/automata`
  explaining the merge and listing the old package names it replaces. The old packages are deleted, so they get no
  changeset and are not released again; marking them deprecated in the registry is the Owner's (it needs the
  registry credentials). `check-changesets`' list of published packages loses them. Open the PR, green, merge.

### Task 4.4: `tools`, and `sim` and `content` inside (PR `claude/refactor-2d-tools`)

- [ ] **Step 1:** Run the codemod for `ship`, `cli`, `node` and `testing/src/e2e` into `packages/tools`. One bin,
  `automata`, dispatches `create-game`, `ship <cmd>`, `add`, `check`, `editor`, `build`; `automata-ship` is an
  alias that prints `automata-ship is now "automata ship". This name goes away in the next release.` to stderr and
  runs. Test both in `tests/unit/cli/bin.test.ts` first.
- [ ] **Step 2:** `sim` and `content` move to `src/{features,shared,app,entries,testing}` by the map (inside each
  package; their names do not change). `testing/src/sim` becomes `@mcthaydt/automata-sim/testing` (and
  `./testing/commands`, `./testing/property`); `vitest` becomes an optional peer of `automata-sim`; the sim purity
  check skips `packages/sim/src/testing/` (spec section 3.2).
- [ ] **Step 3:** `pnpm boundaries --features packages/{sim,content,tools}` passes; `--browser packages/content`
  checks the five browser-safe entries (`game-config`, `locale`, `assets`, `schema`, `palette`) reach no `effect`,
  `node:*`, `fontkit`, `pngjs` or `subset-font`.
- [ ] **Step 4:** Every game's scripts use `automata ship prepare`. `pnpm check`, browser, journeys, 3D and editors
  pass. Changesets, API reports. Open the PR, green, merge. **After this task, `packages/` holds `sim`, `content`,
  `automata`, `tools` and the 3D and editor packages, nothing else.** `tools` is published (spec veto default 8),
  so `check-changesets`' list gains it.

---

## Phase 5: Effect leaves the browser (two PRs)

### Task 5.1: The bundle report, before

**Files:** Create `tooling/bundle-report/{package.json,src/cli.ts,src/report.ts}`,
`tooling/bundle-report/tests/unit/report.test.ts`

- [x] **Step 1: Failing test:** given a Vite `manifest.json` and chunk files (fixture), `report` groups gzip bytes
  by package (`pixi.js`, `svelte`, `zod`, `effect`, `@mcthaydt/*`, the game) and prints a table.
- [x] **Step 2:** Implement (Vite's `build.manifest` plus `rollup-plugin-visualizer`'s JSON, or the source map's
  `sources`; pick the one that needs no new dependency: the source map). Pass.
- [x] **Step 3:** Run on Emberwick; paste the table into `progress.md` as "Bundle before D2". Commit.

### Task 5.2: The plain-TypeScript helpers (PR `claude/refactor-2d-no-effect-1`)

**Files:** Create `packages/automata/src/shared/lib/{clock,disposables,result,subscribable}.ts`,
`packages/automata/src/testing/fake-clock.ts`, tests in `packages/automata/tests/unit/lib/`

- [ ] **Step 1: Failing tests:** `disposables()` runs added functions once, in reverse order, and a throwing one
  does not stop the rest (the first error is rethrown after all ran); `fakeClock()` advances time and fires due
  timeouts in order; `Result` is `{ ok: true, value } | { ok: false, reason }` with `ok()`/`refused()` helpers;
  `subscribable(get, listen)` gives the current value then each change to a subscriber, loses no change made between
  `listen` and the first read (the guarantee `host/src/subscribable.ts` documents today), and stops on unsubscribe.
- [ ] **Step 2:** Implement, each file under 60 lines with a header comment saying which Effect idea it replaces
  and why it is enough here. Pass. Commit.

### Task 5.3: Host contract and targets (same PR)

- [ ] Convert `shared/host/` and `features/targets/` (today's 13 Effect files in `host`, Tauri included). For each file: rewrite its
  test to plain promises and `Result` first (failing), then the code. The contract suite (`testing/host`) runs
  against every target and passes. `pnpm boundaries --browser packages/automata` shows the host files gone from its
  list. Commit per target. Amend ADR 0003 in this PR. Open the PR, green, merge.

### Task 5.4: Runtime features and the app (PR `claude/refactor-2d-no-effect-2`)

Order, leaf first: `display`, `locale`, `settings`, `audio`, `saves`, `loading`, `input`, `flow`, `extension`,
`render` (`renderer.ts` imports Effect), `screens`, then `app/` (`loop`, `time`, `presentation`, `boot`, `run-game`,
`define-game`), then `testing/`, then Emberwick's own screens (`src/screens/emberwick-screens.ts` uses `Effect` and
`Scope`). Session breaks: after `saves`, after `extension`, after `app/`.

For each:

- [ ] **Step 1:** Rewrite the feature's tests to the plain API (failing).
- [ ] **Step 2:** Convert (spec section 4 table). A service becomes `create<Feature>(deps): <Feature> & { dispose() }`.
- [ ] **Step 3:** The feature's tests pass; Emberwick's journeys pass. Commit `refactor(<feature>): plain
  TypeScript, no Effect`.

Then:

- [ ] **Step 4:** `pnpm boundaries --browser packages/automata` passes with no exceptions; `effect` leaves
  `packages/automata/package.json` and `games/emberwick/package.json`; `grep -rl "from 'effect" games/emberwick/src
  examples` lists nothing; `pnpm knip` is clean.
- [ ] **Step 5:** Bundle report again, as "Bundle after D2", beside the "before" table, with the difference in kB
  gzip. Emberwick boot time in the `@slow` journey's trace, before and after, in the execution log.
- [ ] **Step 6:** 3D and editors pass (they use `runtime/extension` and `ui`; the codemod's entry map covers the
  names; any that used an Effect type get the plain one). Open the PR, green, merge.

---

## Phase 6: One name, one import, Emberwick by feature (one PR, `claude/refactor-2d-emberwick`)

### Task 6.1: Emberwick is Emberwick

- [ ] **Step 1: Failing test** in `games/emberwick/tests/unit/ship-config.test.ts`: id `emberwick`, title
  `Emberwick`.
- [ ] **Step 2:** Package `@af-games/emberwick`; id in `ship.config.ts` and `src/game.ts`; the sim plugin
  `base-2d.plugin.ts` → `emberwick.plugin.ts` with `name: 'emberwick'`; the golden evidence scenario name; CI job
  name `emberwick`; `pnpm --filter` uses everywhere, including the hot-reload demo's dependency and imports,
  `check-boundaries`' tests and `ship`'s `workflows.test.ts` (`grep -rn "base-2d" --exclude-dir=node_modules` lists
  none in core or 2D afterwards, except the history in `docs/archive/` and `docs/refactor/`).
- [ ] **Step 3: The golden hash.** The plugin name is part of the state hash (`sim/src/world/sim.ts`), so
  `golden.test.ts` now fails on `GOLDEN_HASH`. Confirm the route and `GOLDEN_GOAL_TICK` are unchanged, re-record the
  hash once in Node (`AUTOMATA_UPDATE_GOLDENS=1` or by hand in `golden.ts`, with the old hash in its comment like
  the earlier re-records), then run `test:browser`: Chromium, WebKit and Firefox must match the new hash. The
  commit says why the hash moved. Commit.

### Task 6.2: Emberwick imports one package

- [ ] Rewrite Emberwick's imports to `@mcthaydt/automata` (and `@mcthaydt/automata-tools` in config and tests).
  Any name it needs that the root entry lacks is added to `entries/index.ts` with a doc comment. Journeys pass.
  Commit.

### Task 6.3: Emberwick by feature

- [ ] Move `games/emberwick/src` to the layout in spec section 3.3 with the module codemod (a small map in
  `docs/refactor/move-map.json` under `"emberwick"`). Its package exports (`./sim`, `./room`, `./render`, `./game`,
  `./no-eval`) follow the files, and the hot-reload demo's imports with them; `ci.yml`'s `emberwick` job passes the
  new sim roots to `game-ci` (or none, if the in-repository check covers it, as base-3d's comment explains).
  `pnpm boundaries --features games/emberwick` and the sim rule (by suffix and import) pass, and the sim rule still
  checks `tiles.ts`, `tuning.ts` and `place-wick.ts`. Retire the GL spec's rule in `AGENTS.md` (phase 7 rewrites it anyway) and in `check-style`'s
  `--game` mode, which now checks features like a package. Same for `games/base-3d`'s style check: it keeps its role
  files until the 3D phase, so `check-style --game` stays for it alone, named `--role-layout games/base-3d/src`.
  Commit.

### Task 6.4: The surface

- [ ] **Step 1:** Run the codemod's surface report over Emberwick, the examples, 3D and the editors. Every export
  of `@mcthaydt/automata` that none of them imports is removed (or made internal), unless it is part of a documented
  API in `docs/guides/` (list those, then decide each in the execution log).
- [ ] **Step 2:** API report, changeset (`patch`, listing what left). Record the export count before and after in
  `progress.md`
  (audit: 1,042 across twelve packages). Open the PR, green, merge.

---

## Phase 7: Process weight (one PR, `claude/refactor-2d-docs`)

### Task 7.1: Docs and AGENTS.md

- [ ] **Step 1:** `git mv` to `docs/archive/`: `01-decomposition.md`, `02-master-delivery-plan.md`,
  `03-continuation-prompt.md`, `04-how-we-build.md`, `superpowers/`, `history/`, `research/`, `spikes/`,
  `cloud-parity.md`. Keep in place (tools or rules read them): `versions.md` and `stack.md` (`tooling/versions`),
  `cheatsheet.md` (`pnpm cheatsheet`), `provenance/` (`AGENTS.md`), `runbook.md`, `art/` and `design/` (spec
  section 7). Keep `00-overview.md` as `docs/README.md`, rewritten to one page. Fix every link into a moved file
  (`grep -rn "docs/0[0-4]-\|docs/superpowers" --include=*.md --include=*.ts`), and update `.vscode/settings.json`'s
  `docs/history` entry to `docs/archive`.
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
  the long step: work file by file, commit per package, with a session break after each package or every 300 hits,
  whichever comes first. 3D and editors are exempt until their phase
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

Emberwick's screens are its own (splash, menu, room, paused, end); it has no saves, settings, music or loading
screen, and this refactor adds no game features (spec section 2). So Emberwick's journeys cover what it has, and
the features it lacks are journeyed on the one-file examples that show them:

- [ ] **Pause on hide:** while playing, the page is hidden (`page.evaluate` dispatches `visibilitychange` with
  `document.hidden` stubbed); on return the pause menu is showing and "Resume" continues.
- [ ] **Boot failure:** the host refuses to start. The e2e host (`tests/e2e/ruken/host.ts`) gains a `?fail=boot`
  switch for this; it is test fixture code, not a game feature. The panel shows one plain sentence and a "Try
  again" button that reloads.
- [ ] **Touch-only on the iPad:** the room can be finished with the on-screen buttons only, and every button is at
  least 48 px (primary) or 44 px (secondary) tall (iPad projects).
- [ ] **The end screen:** after the golden route, "Play again" starts a fresh round and "Menu" returns to the title
  (`@slow`, iPad projects only).
- [ ] **Examples (`examples/tests/e2e/`, Chromium):** saves survive a reload (`core-saves`); a settings change
  survives a reload (the example that has the settings screen, found with `grep -l settings examples/*/*.ts`); a slow
  content load shows the loading text before the menu (`page.route` delay on the content chunk). If no example has
  a feature, its journey is dropped and the execution log says so.

### Task 8.3: The framework's own journey

- [ ] **`create-game` end to end** (`packages/tools/tests/e2e/create-game.test.ts`, Chromium only): in a temp folder,
  `automata create-game my-game`, `pnpm install` (workspace link), `pnpm build`, `vite preview` (on a port from the
  run's own range, never a shared one), open it, see the
  title screen, press Start, see the game canvas draw (a non-blank pixel), press Escape, see the pause menu. This
  proves the path a new developer takes. It runs in `e2e-2d` (`packages/tools` gets a `test:e2e` script and its
  own Playwright config from the preset).
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
- [ ] The Owner is asked to play Emberwick on the iPad from the last build (`game-ci`'s `emberwick-dist` artifact
  served by `vite preview --host` on the local network, or the dev host deploy if the Owner prefers); their answer
  goes in the log.

## Execution log

- 2026-11-05: plan and spec written (stage 2) on `claude/refactor-2d-plan`.
- 2026-11-05: the Owner asked why rebinding was cut ("I see that used"). It is used: `defineGame`'s default Settings screen wires it into every game. The D4 table now counts what `defineGame` wires in; rebinding, glyphs, swipe and haptics stay; leaderboards are checked in task 2.4 step 0.
- 2026-11-05: plan audit (stage 3): 31 findings, all fixed in the spec and plan; see
  [2026-11-05-core-and-2d-plan-audit.md](2026-11-05-core-and-2d-plan-audit.md).
- 2026-11-05 (stage 4, phase 1, PR #388): built tasks 1.1 to 1.4 on `claude/project-thread-k497wo`, stacked on #387.
  Environment: Node 24.21 comes from pnpm; the container has Chromium only (WebKit and Firefox cannot be downloaded
  here), so WebKit and Firefox projects, parity in three engines and `pnpm lint:actions` (no Docker daemon) are left to
  the PR's CI. First-attempt local results, Chromium: Emberwick 25 passed (phone, compact, iPad; golden route 49 s),
  examples 60 passed plus the Chromium matrix cell and `examples-compact` 47 passed, base-3d 7 passed.
  Deviations: (1) `test-remote` kept working: dispatch `spec` is now `<folder> <playwright args>` and runs in an
  `e2e-focused` job, since no root Playwright config exists; (2) the playground journeys (`tooling/examples-runner`)
  run in `release-checks.yml`, so removing the nightly `e2e` job does not drop them; (3) `e2e-2d` installs Firefox
  too (the input matrix has Firefox cells) and has a 30-minute limit; (4) the examples runner skips
  `playwright.config.ts` at the examples root and its screenshots go to the root `evidence/` folder; (5) knip lists
  each area's journeys and config as entries; (6) the editor-suite git test disables commit signing in its scratch
  repository (it failed on an unreachable signing server); (7) pre-commit's affected unit tests run on every commit.
- 2026-11-05 (stage 4, phase 2, task 2.2): the hot-reload demo now plays Emberwick itself. New
  `games/emberwick/src/make-game.ts` (`makeEmberwick(content, { id })`) builds the game from a room and tuning handed
  in; `game.ts` is `makeEmberwick(SIM_CONTENT)`; the `./play` export became `./make-game`. The demo needed the Svelte
  plugin and `assetsInlineLimit: 0` in its Vite config (it now loads the game package's screens). Its journey presses a
  key and clicks Play before reading `data-tick`, because the whole game, splash and menu included, is what runs.
  Deviations: (8) `GAME_ID` moved to `src/game-id.ts` (the e2e host page and `ship-config.test.ts` read it; the deleted
  `ruken/boot.ts` held it); (9) the plumbing test's 400-line limit counted `make-game.ts`, so its comments were
  trimmed, not the limit raised; (10) knip showed no stand-in file as unused any more because the files were deleted
  before the run; it listed only `@ruken/sdk` (dropped from the game's dependencies). Chromium: hot-reload 2 passed,
  Emberwick 24 passed (WebKit projects are not installed here).
- 2026-11-05 (stage 4, phase 2, task 2.3): `games/placeholder` deleted with its `knip.jsonc` entry, the `dist-s8`
  ignore line and every test line that named it. `ci.yml`'s job and the `budget:*` scripts were already gone in 1.2.
  The S8 numbers it last printed are in `progress.md`. Three tests (agent-skills, api-report, api-index) still looked
  for the release gates in `ci.yml` and `ci:local`, where phase 1 had removed them; they now read
  `release-checks.yml`. That fix belongs to phase 1 (PR #388) and went there as its own commit; the first attempt
  swept in the placeholder deletion by mistake (the index already held it), so a second commit on #388 restores
  it and the net change on #388 is the three tests only. Deviation (11): `packages/ship/turbo.json` no longer hashes
  `games/placeholder/e2e/**`, since no ship test reads a game's journeys.
- 2026-11-05 (stage 4, phase 2, task 2.1): the tag `pre-refactor-2d` exists locally on `origin/main` (da765837) but
  `git push origin refs/tags/pre-refactor-2d` fails with HTTP 403 from this environment (tag pushes are refused by the
  git proxy), so the Owner pushes it: `git tag pre-refactor-2d da765837 && git push origin pre-refactor-2d`. #379 and
  #383 are not landed: both are drafts with a stale base, branches this thread did not open, and the self-hosted
  runners were still working through phase 1's jobs, so a green head was not reachable in this session. The refactor
  carries both in task 4.3, as the plan allows.
- 2026-11-05 (stage 4, phase 2, task 2.4): step 0 result is in spec section 5: leaderboards **kept**. Networking
  port deleted: `packages/runtime/src/net`, its export, the seam entries in `tooling/api-report/src/seams.ts`, the
  `public-seams.test.ts` case that gave it to an extension (the test now gives the audio buses), the generated API
  report, `api.md` and cheatsheet. One `patch` changeset with the `BREAKING:` line `check-api-report` requires before
  1.0. Ran: `pnpm check`, `pnpm api-report` (2 breaks, 0 undeclared), `check-changesets`, `docs:stack`. Not run
  locally: `test:parity:core` (WebKit and Firefox are not installable here), left to the PR's CI. Deviation (12): the
  `stack-cards.ts` note about the planned `net` extension said "a `NetworkPort`"; it now says "a network seam".
- 2026-11-05 (stage 4, phase 3, tasks 3.1 and 3.2, branch `claude/project-thread-twtegf`, stacked on #390): built the
  Vitest preset (`tooling/vitest-preset`, `defineTests(options)`) and the move codemod (`tooling/codemods`, run with
  `node tooling/codemods/src/cli.ts <package> --environment node|jsdom [--dry-run]`; the dry run prints move counts,
  what stays and which files find files at run time). **Step 0 (what the old configs differed by):** environment (node
  or jsdom), setup files, `globalSetup` (runtime's Paraglide fixture), `css`, the Svelte plugin and the `browser`
  resolve condition, Testing Library's Svelte plugin (ui, game), the `automata-ruken` condition (runtime, game), a
  content plugin (Emberwick), `optimizeDeps` lists, `testTimeout` (testing's goldens), `server.deps.inline` (the
  Paraglide fixture), golden `commands`, a bench project, and parity/golden files that run in Node as well as in three
  browsers (sim, content, testing, Emberwick). Deviations: (13) the preset has the options `plugins`, `conditions`,
  `globalSetup`, `testTimeout`, `inline` and `alsoInNode` on top of the spec's list, because those are real
  differences; `alsoInNode` keeps the rule that a golden is checked in four engines. (14) One alias, `"#src/*":
  "./src/*"`, and every rewritten specifier names its file in full (`#src/a/b.ts`): several alias patterns that differ
  by suffix were ambiguous to Vite (`#src/a/fonts` went to the `.ts` pattern), and the base tsconfig now sets
  `allowImportingTsExtensions`. (15) `tsconfig.json` includes `tests`, not `vitest.config.ts`: a config's default export
  fails `isolatedDeclarations`. (16) The script and turbo task `test:parity` became `test:browser` everywhere in one
  commit, 3D and editor packages included (only the script name changed there), with the root scripts, workflows, README
  and ship's workflow tests. (17) cli's Chromium-driving `csp-probe` goes to `tests/slow/` (new kind, run by
  `test:slow`); runtime's `bench-chromium` project is gone (bench is Node-only now); Emberwick's `renderer` project had
  no test left and is gone. (18) The codemod's clash rule: a qualifier is kept only for files named in
  `keepQualifier` (`keys.analog`, `keys.devices`, `create-game.integration`, `fake-hosting.contract`). (19) Testing's
  golden files moved to `tests/fixtures/sim/__goldens__` (the golden path is relative to the test file). (20) Per-package
  commits were made with `LEFTHOOK=0`: the pre-commit hook runs every affected package's unit tests (4 minutes), so
  `pnpm check` is the gate. (21) History note: codemod commits `93f98577` and `eaf9d458` swept in a first attempt at
  moving content, host, node, ship and cli (staged by mistake); the per-package commits after them correct it and the net
  tree is right. **Unit test counts, before and after (equal):** sim 267, content 340, host 192, ui 648, runtime 570,
  render-pixi 121, game 229, automata 22, testing 168, node 12, ship 463, cli 188 (+4 slow), Emberwick 108. Chromium
  browser projects (first run, no WebKit or Firefox here): ui 1671, game 403, runtime 2, render-pixi 8, testing 39,
  content 3; Emberwick's journeys, phone Chromium: 8 passed.
  **Tooling and examples (second session).** Unit counts, before and after (equal): api-index 43, check-boundaries 109,
  check-style 71 (72 with the new folder test), repo-hygiene 65, agent-skills 95, examples-runner 112 + 1 skipped,
  frame-budget 45, playwright-preset 8, hot-reload 3; the primitives smoke test, Chromium: 26. Deviations: (22) the
  `turbo-inputs` tests of api-index and repo-hygiene resolve every relative import against its file, in `src/` and
  `tests/`, so moving a file never changes which sibling tooling folders count as inputs. (23) Fixtures moved to
  `tests/fixtures/` only where a test in `src/` owned them (`check-style` kit fixtures, `examples-runner` and
  `frame-budget` fixtures); `api-index/fixtures`, `check-boundaries/fixtures` and `api-report/fixtures` stay at the package
  root, where `biome.json` and `knip.jsonc` already exclude them, so no `biome.json` path changed. (24) `agent-skills`
  keeps its own `vitest.config.ts` (its root is the repository, for the skill's worked example and the sim alias); its
  install suite moved to `tests/install/` and `test:install` points there. (25) The `examples-runner` browser parity
  test runs in Node too through the preset's `alsoInNode`; `test:unit` and `test:browser` now name the projects `unit`
  and `browser`. (26) `check-style` skips any `tests/` folder; the `*.test.ts` suffix stays exempt until the 3D and
  editor packages move (they still keep tests in `src/`), at which point the suffix rule is deleted. (27) The examples'
  and `games/base-3d`'s Playwright configs, the 3D workflow's path filter and `knip.jsonc` follow the journeys to
  `tests/e2e/*.test.ts`. `pnpm check` passes (30 unit tasks, 0 cached). **Not run here:** WebKit and Firefox parity,
  every Playwright journey (the GPU/CI runner), `pnpm build` and the CI-only gates (left to the pull request's CI).
- **Task 4.1 (2026-11-05, second session).** `tooling/check-boundaries` has `--features <root>...`, `--browser
  <root>[:<entry>,…]...` and, in `--game`, the sim by role suffix and by import (files `features.ts`, `browser-only.ts`,
  `sim-by-suffix.ts`, and `imports.ts`, the one import reader the platform check now shares). 144 tests (109 before). Deviations:
  (28) The failing tests built their trees in temporary folders instead of under `tests/fixtures/features/`: each rule needs
  a four-line tree, and the test then reads next to its tree. (29) A multi-line message (spec section 3.5) prints under
  `file:line:col`, indented; single-line findings print as before. (30) `--browser` takes `root:entry,entry` for a package
  with Node entries too (content), because section 3.2 makes only some of its entries browser-safe; it also refuses
  `fontkit`, `pngjs`, `subset-font` and any Node built-in, as section 3.3 says for content. (31) `--game` takes the union of the
  role files (`base-3d` still has them) and the suffix set, and exits 2 only when both are empty. (32) **The file-list
  comparison (step 3) does not hold on today's tree, so `package.json`'s `boundaries` line is unchanged.** Today's line
  checks 12 files under `games/emberwick/src/sim`; the suffix rule finds 10. `sim/index.ts` (a barrel) and `place-wick.ts`
  are imported by `base-sim.ts` and `make-game.ts`, which are not sim files, and import sim files themselves, so no sim
  file reaches them (the spec's claim that `place-wick.ts` is reached by import is wrong). Task 6.3 must close it when
  Emberwick moves: rename `place-wick.ts` to `place-wick.command.ts`, drop the barrel, and switch the line to
  `--game games/*/src` in the same commit; `base-3d` (12 role files, 0 by suffix) keeps its role layout until the 3D area.
- **Task 4.2 (2026-11-05, second session).** `docs/refactor/move-map.json` (146 rows and the entry map),
  `tooling/codemods/src/move-modules.ts` (the pure plan, `planModules`, and `applyModulePlan`), and
  `src/move-modules-cli.ts` (`node tooling/codemods/src/move-modules-cli.ts [--dry-run] [--surface]`), with 17 tests on an
  in-memory file system. **Not applied:** moving the files before task 4.3 builds the package would break the tree. The dry
  run over today's tree: 764 files move, 1 duplicate is removed (the two identical `setup.ts`), 624 files change text, none
  is unmapped and none clashes. Deviations: (33) A test follows the source file it tests (`tests/unit/audio/a.test.ts` is the
  test of `src/audio/a.ts`), so a test needs no row of its own; rows exist only for the 16 tests with no source file by that
  name (the `index.test.ts` of each old barrel, `target.test.ts`, the Ruken seam tests, the two `setup.ts` and `testing`'s golden
  fixtures, which keep their path relative to the test file). (34) Two files with the same text on one path are one file
  (the first stays, `git rm` the rest); different text stops the run. (35) Each old `index.ts` moves to
  `entries/from-<package>.ts` and each old `no-eval.ts` to `entries/no-eval.ts` or `entries/from-<package>-no-eval.ts`, with
  its relative imports already right; task 4.3 step 1 writes the real `entries/index.ts` from them. (36) The map decides what
  the spec left open: `haptics` goes to `features/input/haptics`, `leaderboards` stays a feature (`features/leaderboards`),
  `host/src/testing` to `testing/host/page` (beside `testing/src/host`, which becomes `testing/host`), `ship`'s `cli.ts` to
  `app/ship-cli.ts` and `cli`'s `bin.ts` to `app/cli.ts` (task 4.4 merges them into the one bin). (37) A moved file that imports an old package of the same merge gets a relative import
  of the file that defines each name: the codemod reads the old package's `exports`, follows the entry file's re-exports
  (`export { a } from`, `export *`, `export { default as A } from`) to the defining module, and writes one import per module
  (`import type` kept). That took the 230 such imports to **10 left for task 4.3 step 1 by hand**: the two old barrels
  (`game/src/index.ts`, `automata/src/index.ts`, which are re-exports and become the real `entries/index.ts`), `ship`'s
  re-export of `node`, four Svelte screens that `import * ` from `ui`, and one test; `--dry-run` lists them. A build-time
  entry (`host/target`) stays a package specifier. (38) The other workspace packages' `package.json` swap each old package they
  import for the new one they now import (`ui` → `automata`, `testing/sim` → `automata-sim`), in the section the old one was
  in; 14 are rewritten. The merged package's own `package.json` (the union of the dependencies of `host`, `runtime`,
  `render-pixi`, `ui`, `game`, and the exports map) is written by hand in task 4.3 step 1. The 197 imports from other
  workspace files are rewritten by the entry map; the `names` overrides are empty, so a name that is not in its new entry is
  found by the typecheck in 4.3.
- **Task 5.1 (2026-11-05, second session), done before 4.3 because it needs only today's build.** `tooling/bundle-report` reads
  each chunk's source map (`sources` and `mappings`, decoded by a 30-line VLQ reader, so no new dependency), counts the
  generated bytes per source file, groups them by package, and shares each chunk's gzip size out by those counts. 12 tests on
  hand-built chunks. On Emberwick: 1,183 kB raw, 360 kB gzip, Effect 187 kB raw and 57.6 kB gzip (16%), Pixi 42.9%, zod 8%
  (table in `progress.md`). This is the number task 5.4 compares against; the placeholder game's 28.3 kB gzip for Effect
  was a smaller page.
