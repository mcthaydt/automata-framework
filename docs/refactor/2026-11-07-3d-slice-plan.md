# 3D Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task,
> with superpowers:test-driven-development for every code change and superpowers:verification-before-completion before
> ticking a box. The plugin's default, subagent-driven-development, is not used: the Owner allows no subagents, ever
> (no Task-tool delegation, no workflows), and the user's rule wins over the skill. Steps use checkbox (`- [ ]`)
> syntax. Tick a step only when its check has passed, in the same session.

**Goal:** AF ready to ship 3D: one feature-grouped `@automata/3d` package holding everything from both builders, drawn
by Pixi 3D in their pixel-art look on DUEL; Ember Hall edited in one redesigned suite on a phone, an iPad or a
computer; the site showing 3D beside 2D; the release written and waiting for Pixi 3D.

**Architecture:** Four parts in the Owner's order (3D core, the rest of AF using 3D, the editors, the site), 20 phases,
one stacked PR per phase. Contracts shared by two features live in `packages/3d/src/shared/` (timeline, level,
time of day) and `app/` composes features, so the `--features` rule holds. The look is GPU passes on Pixi 3D; the CPU
painters survive only as a test oracle.

**Tech Stack:** pnpm 10 + turbo 2.11, Node 24 (`/opt/node24/bin`), TypeScript, Vitest 5 (browser mode), Playwright
1.63, Svelte 5.57, PixiJS 8.22, vendored `@pixi/3d` 0.1.0-beta.2, Zod 4.6.6, Biome.

**Spec:** [2026-11-07-3d-slice-spec.md](2026-11-07-3d-slice-spec.md) (section numbers below are the spec's). The facts
behind it: the [audit](2026-11-07-3d-slice-audit.md).

## Global Constraints

- Order: part A, then B, then C, then D; a part's PRs merge before the next part's first opens for review (Owner,
  2026-11-07 10:38). Phase 1's editor test fixes are the one exception: they are gate work.
- Each phase is one PR stacked on the one before, opened ready, not draft; the agent merges its own PR once every
  check, parity and the 3D workflow included, is green on the head, by hand (GitHub auto-merge is unavailable).
- Strict TDD in `packages/`, `tooling/`, `examples/`, `games/`; `spikes/` is exempt.
- The sim never imports Effect; no `Date`, timers, `Math.random`, `**`, `Object.keys/values/entries` in sim files;
  `packages/3d` has no Effect at all after phase 3.
- Determinism is cross-engine: base-3d's golden replay hash never changes in this slice; a mismatch is investigated,
  never rebaselined.
- Changesets: `patch` only; only published packages (`@automata/content`, `@automata/framework`, `@automata/tools`,
  `create-game`). `@automata/3d` gets none until phase 20.
- After changing a published package's exports or doc comments: `pnpm api-report --update`, `pnpm agent-skills
  --write`, and `pnpm cheatsheet` when `api-index` says so.
- Files under `packages/*/src` stay at or under 600 lines; split by responsibility.
- Every user-facing string changed goes in `docs/refactor/copy.md` ("3D editors" or "Base 3D"), old and new, and passes
  the drunk grandma test: could a drunk grandma tell what is happening and how to use it?
- Touch targets 44 px, primary actions 48 px; corners from `--edge-sm/md/lg`, never a pill.
- Ported code: read only FigureBuilder `025ffb4` and EnvironmentBuilder `6d82a52`; every ported file gets a row in
  `docs/provenance/sources.md`; no file outside `docs/` records names a source project or a plan ID.
- Visual changes: expected, actual and diff images opened and every change explained in the PR; acceptance recorded
  under "Auto approve all visual acceptance too" (Owner, 2026-10-30).
- Cloud sessions run Chromium only; a WebKit or Firefox step is ticked "Chromium here; WebKit/Firefox on the Owner's
  `pnpm ci:local` or hosted CI", and the progress row says which engines ran. editor-3d's browser runs use
  `--project 'layout (chromium)' --project canvas`.
- `pnpm format` then `pnpm check` before every commit; Conventional Commits; end each commit with the session's
  attribution lines.
- Sessions refresh after 90 minutes: tick the steps, update `progress.md`, push, add two lines to this plan's
  execution log. Named breaks: tasks 2.1, 2.2, 6.2, 6.3, 7.2, 7.3, 8.2, 12.1, 14.1, 16.1, 17.1, 18.2.

## Review Focus

1. **A `/1` level that uses fields `/2` renames** (`texture` on a wall, a bare-number `floor`): the migration keeps
   every value, and reading the `/2` file back gives the same level. Test in task 7.1:
   `migrates every /1 fixture losslessly`.
2. **A room the world builder cannot mesh** (three collinear corners, a hole touching the outline, a zero-height
   room): the builder returns a problem naming the room, never throws, and the editor shows it as a check. Test in
   task 7.2: `reports a degenerate room instead of throwing`.
3. **Two extensions registering the same garment, hair piece or fabric name:** the second fails with a message naming
   both, so a game never silently gets the wrong look. Test in task 6.4: `refuses a second registration of a name`.
4. **A level naming a kit, prop, swatch or time of day the game does not have:** `automata check` and Levels 3D both
   say which name and where; the game draws the room undressed rather than failing to start. Tests in tasks 7.3
   (`an unknown kit leaves the room bare and reports it`) and 16.2.
5. **The phone keyboard or browser bar changing the height mid-edit** (an inspector number field focused at 390 ×
   844): the compact layout stays compact, the field stays visible, Save stays whole. Test in task 16.1:
   `keyboard occlusion keeps compact layout and the focused field`.

## Tracking

`docs/refactor/progress.md`'s "3D" slice gets one row per task during stage 4; the build's percentage is `done tasks /
53`. At the end of each task set its row to "Done, <date>, <engines run>", recompute both percentages, and commit with
the task.

## Builders' checkouts

Clone both at the recorded commits beside the checkout: `git clone https://github.com/mcthaydt/figurebuilder
../FigureBuilder` and `…/environmentbuilder ../EnvironmentBuilder`; `git -C ../FigureBuilder checkout 025ffb4` and
`git -C ../EnvironmentBuilder checkout 6d82a52`. Tools used below: the module mover `node
tooling/codemods/src/move-modules-cli.ts --map <map> [--dry-run]`; the test mover `node tooling/codemods/src/cli.ts
<package> --environment node|jsdom [--keep-qualifier <q>] [--dry-run]`.

---

# Part A: the 3D core

## Phase 1: The 3D gate runs and is green (PR `claude/3d-gate`)

### Task 1.1: Every unit test in the gate (spec 5)

**Files:**
- Modify: `package.json` (`check` runs `pnpm test:unit` in place of `pnpm test:unit:2d`; `ci:local` adds
  `pnpm test:browser:3d`, `pnpm test:journeys:3d`, `pnpm test:e2e --filter @af-games/base-3d --filter
  @af-examples/examples-3d`), `.github/workflows/ci.yml:113` (`pnpm test:unit`), `AGENTS.md` (the gate line),
  `docs/status.md`
- Test: `tooling/repo-hygiene/tests/unit/gate-scripts.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm check` and the hosted core job run the 3D unit tests (every later task's gate).

- [ ] **Step 1: Write the failing tests**

```ts
it('check runs every unit test', () => {
  expect(scripts.check).toContain('pnpm test:unit &&')
  expect(scripts.check).not.toContain('test:unit:2d')
})
it('the hosted core job runs every unit test', () => {
  expect(readWorkflow('ci.yml')).toMatch(/run: pnpm test:unit\n/)
})
it('ci:local runs the 3D browser suites and journeys', () => {
  expect(scripts['ci:local']).toContain('pnpm test:browser:3d')
  expect(scripts['ci:local']).toContain('pnpm test:journeys:3d')
})
```

- [ ] **Step 2: Run, expect FAIL**: `pnpm --filter @automata/repo-hygiene exec vitest run
  tests/unit/gate-scripts.test.ts` → the three fail on today's scripts.
- [ ] **Step 3: Change the scripts and `ci.yml`.**
- [ ] **Step 4: Run, expect PASS**; then `pnpm check` passes with the 3D unit tests (record the count; the audit had
  3,836).
- [ ] **Step 5: Commit** `ci(gate): every unit test in pnpm check and the hosted core job`

### Task 1.2: Three 3D jobs and #425's timeout fix (spec 5)

**Files:**
- Modify: `.github/workflows/3d.yml` (drop the `3D - unit` steps; merge the editor's journeys into `3D - journeys`;
  `paths` gains `vendor/pixi-3d/**`, keeps every current entry), `package.json` (every `test:browser*` script:
  `--concurrency=2`, `--hookTimeout=90000`)
- Test: `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts`, `gate-scripts.test.ts`

**Interfaces:**
- Consumes: task 1.1 (the hosted core job runs the 3D unit tests, so `3d.yml` need not).
- Produces: the job names `3D - journeys`, `3D - parity (chromium, webkit, firefox)`, `base-3d through game-ci`.

- [ ] **Step 1: Write the failing tests**

```ts
it('the 3D workflow has three jobs and runs on vendor changes', () => {
  const wf = parseWorkflow('3d.yml')
  expect(Object.values(wf.jobs).map((j) => j.name)).toEqual([
    '3D - journeys', '3D - parity (chromium, webkit, firefox)', 'base-3d through game-ci'])
  expect(wf.on.pull_request.paths).toEqual(expect.arrayContaining(
    ['packages/**', 'games/base-3d/**', 'examples/3d/**', 'vendor/pixi-3d/**', 'agents/**', 'pnpm-lock.yaml']))
})
it('browser runs use two at a time and a 90 s hook timeout', () => {
  for (const [name, line] of browserScripts()) {
    expect(line, name).toContain('--concurrency=2')
    expect(line, name).toContain('--hookTimeout=90000')
  }
})
```

- [ ] **Step 2: Run, expect FAIL** (four jobs; concurrency 3).
- [ ] **Step 3: Take #425's hunks** (`git diff origin/claude/project-thread-xe0752...origin/claude/project-thread-ajhkmg
  -- package.json tooling/repo-hygiene/tests/unit/gate-scripts.test.ts`), then edit `3d.yml`.
- [ ] **Step 4: Run, expect PASS**; `pnpm lint:actions` if Docker runs, else a YAML parse and "actionlint: the
  Owner's" in the log.
- [ ] **Step 5: Commit** `ci(3d): three jobs, browser runs at concurrency 2`; then comment on #425 that the fix is
  carried here and close it.

### Task 1.3: One scroll region per dialog (the seven `open-flows` failures)

**Files:**
- Modify: `packages/editor-3d/src/ui/document/ErrorPanel.svelte`, its dialog caller,
  `packages/editor-3d/src/ui/document/open-flows.layout.test.ts`
- Create test: `packages/editor-3d/src/ui/document/error-panel.dom.test.ts` (moves to `tests/` in task 14.1)

**Interfaces:**
- Produces: `ErrorPanel` prop `inDialog?: boolean` (default `false`).

- [ ] **Step 1: Write the failing test**

```ts
it('declares no scroll region of its own inside a dialog', () => {
  render(DialogWithErrors, { problems: forty })
  expect(document.querySelectorAll('[role=dialog] [data-scroll-region]')).toHaveLength(1)
})
```

- [ ] **Step 2: Run, expect FAIL** (2 regions).
- [ ] **Step 3: Add `inDialog`; the dialog caller passes it; the layout test reads the list by
  `getByRole('list', { name: /problems/i })`.**
- [ ] **Step 4: Run** `npx vitest run --project 'layout (chromium)' src/ui/document/open-flows.layout.test.ts` in
  `packages/editor-3d` → 7 pass, and the DOM test passes.
- [ ] **Step 5: Commit** `fix(editor-3d): one scroll region in the open-problems dialog`

### Task 1.4: The plan clear of the sheet (the Pencil failure)

**Files:**
- Modify: `packages/editor-3d/src/app/plan-controller.ts`, `packages/editor-3d/src/ui/plan/PlanCanvas.svelte` (reads the
  usable rectangle from the kit's geometry owner), `packages/editor-3d/src/ui/plan/sector-tools.layout.test.ts`
- Test: `packages/editor-3d/src/app/plan-controller.test.ts`

**Interfaces:**
- Produces: `fitToRoom(room: Bounds, usable: Rect): PlanView` in `plan-controller.ts`; the page exposes the usable
  rectangle as `data-usable="x y w h"` on the plan stage for tests.

- [ ] **Step 1: Write the failing test**

```ts
it('fits the room inside the area the sheet and tools leave', () => {
  const view = fitToRoom(room10x6, { x: 0, y: 56, width: 744, height: 420 })
  expect(projectedBounds(view, room10x6)).toBeWithin({ x: 0, y: 56, width: 744, height: 420 })
})
```

- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement**; the layout test draws inside `data-usable`.
- [ ] **Step 4: Run** the editor-3d Chromium set → 195 pass, 0 fail (187 + 8).
- [ ] **Step 5: Commit** `fix(editor-3d): fit the plan to the area the sheet and tools leave`

### Task 1.5: Every action whole and uncovered (spec 5; audit note 17)

**Files:**
- Modify: `packages/automata/src/testing/layout/assertions.ts` (add `findCovered`),
  `packages/automata/src/testing/ui/layout-contract.ts` (`checkLayout` adds the bar selector to `findClipped` and calls
  `findCovered`), `packages/automata/src/entries/testing-fixtures.ts` (export `findCovered`), regions in
  `packages/editor` and `packages/editor-3d` that lack `data-region`
- Test: `packages/automata/tests/browser/ui/actions-inside.test.ts`

**Interfaces:**
- Consumes: `findClipped(root: ParentNode, selector: string): string[]` (exists).
- Produces: `findCovered(root: ParentNode, selector: string): string[]`; `BAR_ACTIONS =
  '[data-region=topbar] :is(button,a,[role=tab],[role=menuitem]), [data-region=rail] :is(…), [data-region=panel]
  :is(…), [data-region=dock] :is(…), [data-region=tools] :is(…)'`.

- [ ] **Step 1: Write the failing tests**

```ts
it('reports a bar button its bar clips', () => {
  mount(`<div data-region="topbar" style="width:120px;overflow:hidden;display:flex">
    <button style="flex:none;width:100px">Back</button><button style="flex:none;width:80px">Publish</button></div>`)
  expect(checkLayout(phone, [])).toContainEqual(expect.stringContaining('Publish'))
})
it('reports a bar button another element covers', () => {
  mount(`<div data-region="topbar"><button>Save</button></div><div style="position:fixed;inset:0"></div>`)
  expect(findCovered(document.body, BAR_ACTIONS)).toEqual([expect.stringContaining('Save')])
})
```

- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement.**
- [ ] **Step 4: Run** both editors' layout suites in Chromium: only the Studio's phone portrait fails (Publish, T5);
  mark it `.fails` with the comment "Publish is clipped on a phone until the Characters redesign"; any other failure
  is fixed here.
- [ ] **Step 5:** API report, agent skills, changeset `patch` for `@automata/framework`. **Commit**
  `test(layout): every action in a bar is whole and uncovered`

### Task 1.6: The 3D editor's journeys in Chromium

**Files:** Modify `packages/editor-3d/vitest.config.ts` (the journeys project lists Chromium and WebKit through
`packages/editor/src/testing/kit/journey-project.ts`).

- [ ] **Step 1:** Run `pnpm --filter @automata/editor-3d test:journeys` before the change → only WebKit is listed
  (record). **Step 2:** change the project. **Step 3:** run → 3 journeys pass in Chromium; a Chromium-only failure is a
  product bug fixed with its own test. **Step 4: Commit** `test(editor-3d): journeys run in Chromium too`

### Task 1.7: Paraglide never empties its folder (T6)

**Files:**
- Modify: `packages/content/src/shared/locale/compile-messages.ts:89` (`compileInFolder`)
- Test: `packages/content/tests/unit/shared/locale/compile-messages.test.ts`

**Interfaces:**
- Produces: `syncFolder(from: string, to: string): Promise<{ written: number; removed: number }>` in
  `packages/content/src/shared/locale/sync-folder.ts`; `compileInFolder` compiles to `${folder}.next-<pid>` then calls it.

- [ ] **Step 1: Write the failing tests**

```ts
it('an unchanged compile writes nothing', async () => {
  await compileMessages(input); const before = mtimes(out)
  await compileMessages(input)
  expect(mtimes(out)).toEqual(before)
})
it('the output folder is never empty during a compile', async () => {
  await compileMessages(input)
  const seen = watchCounts(out)
  await compileMessages(changedInput)
  expect(Math.min(...seen())).toBeGreaterThan(0)
})
it('removes files a compile no longer makes', async () => { /* drop a message; its file is gone */ })
```

- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement `syncFolder` and use it.** **Step 4: Run, expect PASS**; then
  base-3d's browser projects three times in a row → no "Could not load src/paraglide".
- [ ] **Step 5:** changeset `patch` for `@automata/content`. **Commit** `fix(content): compile messages without
  emptying the output folder`

---

## Phase 2: One 3D package (PR `claude/3d-package`)

### Task 2.1: The move map and `packages/3d` (spec 7; audit notes 3, 4, 5; **session break** after the dry run)

**Files:**
- Create: `docs/refactor/move-map-3d.json`, `packages/3d/{package.json,tsconfig.json,vitest.config.ts,biome.json}`
- Delete (by the move): `packages/render-pixi3d`, `packages/figures`, `packages/sector-format`
- Modify (importers, audit note 5): `packages/editor-3d`, `games/base-3d`, `examples/3d`, `tooling/frame-budget`,
  `tooling/examples-runner/src/catalog.ts` (`UNPUBLISHED_EXTENSIONS`, its fixtures and tests),
  `tooling/api-report/reports/{figures,render-pixi3d,sector-format}.api.md` → `3d.api.md`,
  `tooling/release/tests/unit/private-build.test.ts`, `site/playground/build.ts`,
  `site/playground/src/playground-resources.ts`, `packages/tools/src/shared/ship/prepare/pixi3d-markers.ts`,
  `packages/automata/src/app/define-game.ts` (comment), `agents/automata` API reference, `docs/{README,status,versions}.md`,
  `docs/adr/0002-*.md`, `vendor/pixi-3d/README.md`, `AGENTS.md` (the `render-pixi3d` rules become `@automata/3d`'s; the
  game-layout line says games use `--features` layout like Emberwick), root `package.json` (`boundaries` sim list,
  `--forbid packages/editor:@pixi/3d,@automata/editor-3d,@automata/3d`, the `:3d` filters name `./packages/3d`),
  `knip.json`, `turbo.json`, `.github/workflows/3d.yml`

The map (every source file appears once; spec 7's tree):

| From | To |
|---|---|
| `render-pixi3d/src/renderer/create-pixi3d-renderer.ts` | `3d/src/app/create-renderer.ts` |
| `render-pixi3d/src/render3d.extension.ts`, `figures/src/figures.extension.ts` | `3d/src/app/` |
| `render-pixi3d/src/{renderer,model,bundle}/*`, `views/*` (box, mesh, pose-3d, shared material, view-3d) | `features/renderer/` |
| `render-pixi3d/src/camera/*`, `camera-view.ts` | `features/camera/` |
| `render-pixi3d/src/sim/*` (camera heading: component, plugin, turn command and system, view schema, heading, stick mapper, view latch) | `features/camera/sim/` |
| `render-pixi3d/src/{light,occluders}/*` | `features/look/{light,occluders}/` |
| `render-pixi3d/src/figure/*` (meshes, colour, skin, joints, decals, view) | `features/figures/view/` |
| `render-pixi3d/src/no-eval*` | `features/renderer/no-eval/` |
| `figures/src/{genes,parts,rig}` | `features/figures/body/` |
| `figures/src/{motion,pose,solve}` | `features/figures/motion/` |
| `figures/src/hair` | `features/figures/hair/` |
| `figures/src/{garments,streetwear}` | `features/figures/outfit/` (streetwear leaves in task 6.5) |
| `figures/src/{build,figure}` | `features/figures/figure/` |
| `figures/src/{clip,evaluate}` | `features/figures/clips/` (keys and eases go to `shared/timeline/` in task 6.3) |
| `figures/src/{library,content}` | `features/figures/content/` |
| `figures/src/math`, `render-pixi3d/src/parity` | `shared/math/`, `shared/parity/` |
| `sector-format/src/*` | `shared/level/` |
| `sector-format/blockout/*` | `shared/level/blockout/` (deleted in task 4.1) |
| `*/src/testing/*` | `testing/` (`public.ts` re-exports what `./testing` published) |

**Interfaces:**
- Produces: `@automata/3d` entries `.`, `./sim`, `./level`, `./figures`, `./camera-view`, `./no-eval`, `./testing`;
  `"automata": { "simEntries": ["./sim"] }`; `private: true`. Every former export keeps its name.

- [ ] **Step 1:** Record counts: `pnpm test:unit:3d`, and `npx vitest run --project 'browsers (chromium)'` in each of
  the three packages (parity 17, goldens 24).
- [ ] **Step 2:** Write the map; `--dry-run` → no unresolved specifier, no clash. **Session break here if needed.**
- [ ] **Step 3:** Run the mover; one import style (`.ts` specifiers; S9). The renderer's imports of the figures go
  through `app/compose-scene.ts` (`composeScene(renderer, figureViews, look)`), so no feature imports another.
- [ ] **Step 4:** `pnpm install`, `pnpm typecheck`, `pnpm test:unit:3d` → the counts of step 1. `pnpm boundaries`
  with `packages/3d/src/features/camera/sim packages/3d/src/shared/level packages/3d/src/entries/sim.ts` in the sim list.
- [ ] **Step 5: Commit** `refactor(3d): one @automata/3d package from render-pixi3d, figures and sector-format`

### Task 2.2: Tests in `tests/`, the feature rule on (**session break** after the mover)

**Files:**
- Move: every `*.test.ts` under `packages/3d/src` → `packages/3d/tests/{unit,browser}/…` with `#src/…` imports
- Modify: root `package.json` (`boundaries --features packages/3d`; `style --test-imports packages/3d`; the
  `--plan-comments` for `packages/3d` is added in task 10.1), `packages/3d/vitest.config.ts` (projects by folder)

- [ ] **Step 1:** `node tooling/codemods/src/cli.ts packages/3d --environment node --keep-qualifier parity
  --keep-qualifier bench --dry-run`, then for real. **Session break here if needed.**
- [ ] **Step 2:** `pnpm boundaries` → `--features packages/3d` finds 0 (a finding is fixed by moving the shared part to
  `shared/` or composing in `app/`, never by an exemption).
- [ ] **Step 3:** `pnpm test:unit:3d` and `npx vitest run --project 'browsers (chromium)'` in `packages/3d` → parity
  17, goldens 24. **Commit** `refactor(3d): tests in tests/, feature boundaries on`

---

## Phase 3: Effect out of the 3D package (PR `claude/3d-no-effect`)

### Task 3.1: The renderer in plain TypeScript (S4; audit note 6)

**Files:**
- Modify: the four source files that import `effect` (`app/create-renderer.ts`, `features/renderer/context-loss.ts`,
  `features/renderer/load-models.ts`, `testing/compile-fixture.ts`) and the five tests; `packages/3d/package.json` and
  `games/base-3d/package.json` (drop `effect`); `packages/automata/src/entries/testing.ts` (export `fakeClock`,
  `FakeClock`)
- Test: `packages/3d/tests/unit/no-effect.test.ts` (temporary), the rewritten renderer and context-loss tests

**Interfaces:**
- Consumes: `Clock`, `disposables(): Disposables` from `@automata/framework`; `fakeClock(): FakeClock` from
  `@automata/framework/testing` (newly public).
- Produces: `createRenderer(options: RendererOptions & { clock?: Clock }): Promise<Renderer3d>` where `Renderer3d`
  has `dispose(): void`; `watchContextLoss(canvas, clock, onLost): () => void`.

- [ ] **Step 1: Write the failing test**

```ts
it('no 3D source imports effect', () => {
  expect(grepFiles(['packages/3d/src', 'games/base-3d/src'], /from 'effect'/)).toEqual([])
})
```

- [ ] **Step 2: Run, expect FAIL** (4 files). **Step 3:** rewrite each: `Scope` → `Disposables`, `Effect.gen` →
  `async`, time through `Clock`; tests use `fakeClock()`.
- [ ] **Step 4: Run** unit and Chromium parity → PASS. Replace the grep test with `--forbid packages/3d:effect` and
  `--forbid games/base-3d:effect` in `boundaries`; delete the grep test.
- [ ] **Step 5:** API report and agent skills for `@automata/framework`, changeset `patch`. **Commit**
  `refactor(3d): the renderer without Effect`

---

## Phase 4: Cuts (PR `claude/3d-cuts`)

### Task 4.1: The source game's level format goes (D3)

**Files:**
- Delete: `packages/3d/src/shared/level/blockout/`, the `./blockout` export, `packages/editor-3d/src/format/`,
  `src/profile/last-light-*`, `src/checks/facility/`, `src/checks/last-light/`, `src/model/facility-*`,
  `src/testing/{toy-blockout,shipped-facility}.ts` and their tests
- Modify: `packages/editor-3d/src/profile/registry.ts` (one profile, a plain import), every `format/` importer (to
  `@automata/3d/level`), `docs/provenance/sources.md` (the deleted files' rows: "removed 2026-11, D3")

- [ ] **Step 1:** `grep -rln "blockout\|facility\|last-light" packages/editor-3d/src packages/3d/src` → the list; record
  the test counts. **Step 2:** delete; `pnpm typecheck` and `pnpm knip` find the rest. **Step 3:** editor-3d unit and
  Chromium layout pass; the counts drop by exactly the deleted tests (record). **Step 4: Commit** `refactor(3d): the
  editor opens af-sector levels only`

### Task 4.2: Goldens recorded from AF's own code (S7)

**Files:**
- Create: `packages/3d/scripts/record-goldens.ts`
- Delete: `packages/3d/scripts/figurebuilder-{,action-,motion-}goldens.ts`
- Test: `packages/3d/tests/unit/goldens-fresh.test.ts`

**Interfaces:**
- Produces: `recordGoldens(outDir: string): Promise<string[]>` (the files written); CLI `node
  packages/3d/scripts/record-goldens.ts [--out <dir>]`, default `tests/fixtures/goldens/`.

- [ ] **Step 1: Write the failing test**

```ts
it('recording into a temporary folder reproduces the committed goldens', async () => {
  const out = await tempDir(); await recordGoldens(out)
  expect(readTree(out)).toEqual(readTree(GOLDENS))
})
```

- [ ] **Step 2: Run, expect FAIL** (no script). **Step 3:** implement. **Step 4: Run, expect PASS**; a difference
  here is a bug in the move, not a rebaseline. **Step 5: Commit** `test(3d): goldens recorded from AF's own code`

---

## Phase 5: DUEL is AF's palette (PR `claude/duel-palette`)

### Task 5.1: The palette in `-content` (spec 1.6; audit note 16)

**Files:**
- Create: `packages/content/src/shared/palette/duel.ts` (the 32 × 8 ramps of FigureBuilder
  `src/features/paint/duel-ramps.ts`), `docs/art/palettes/duel.txt`, `docs/art/palettes/duel.md` (source: generated
  from the DUEL LUT; author and licence: asked of the Owner)
- Delete: `packages/content/src/shared/palette/endesga-64.ts`, `docs/art/palettes/endesga-64.txt` and its page
- Modify: `packages/content/src/shared/palette/palette.ts`, `packages/content/src/entries/palette.ts`,
  `packages/content/src/shared/assets/build-atlases.ts`, `docs/provenance/sources.md`
- Test: `packages/content/tests/unit/shared/palette/palette.test.ts`, `content-hash.test.ts`,
  `compile-content.test.ts`, `browser-entries.test.ts`

**Interfaces:**
- Produces: `DUEL_RAMPS: readonly (readonly string[])[]` (32 × 8, hex); `DEFAULT_PALETTE: Palette` with `name:
  'DUEL'`, `colors` = ramps row-major; `rampOf(index: number): number`; `step(index: number, by: number): number`
  (clamped to the ramp's ends); `nearestDuel(hex: string): number` (OKLab).

- [ ] **Step 1: Write the failing tests**

```ts
it('DUEL has 256 colours, ramp r step s at r * 8 + s', () => {
  expect(DEFAULT_PALETTE.colors).toHaveLength(256)
  expect(DEFAULT_PALETTE.colors[3 * 8 + 5]).toBe(DUEL_RAMPS[3][5])
  expect(rampOf(3 * 8 + 5)).toBe(3)
})
it('step moves along a ramp and stops at its ends', () => {
  expect(step(3 * 8 + 6, 4)).toBe(3 * 8 + 7)
  expect(step(3 * 8 + 1, -4)).toBe(3 * 8)
})
```

- [ ] **Step 2: Run, expect FAIL.** **Step 3:** DUEL in; record each content hash that moves.
- [ ] **Step 4: Run** `pnpm --filter @automata/content test:unit` → PASS with the new hashes, each named in the commit.
- [ ] **Step 5:** API report, agent skills, changeset `patch`. **Commit** `feat(content): DUEL is the default palette`

### Task 5.2: Emberwick, the theme, the examples and the editors' game art on DUEL

**Files:**
- Create: `tooling/codemods/src/remap-palette.ts` and its test (kept for the next palette pull)
- Modify: `games/emberwick/src/shared/art/{palette.ts,sprites.ts,PROVENANCE.md}`,
  `games/emberwick/src/features/scene/backdrop.ts`, `games/emberwick/main.ts`, every file `grep -rln
  "Endesga\|endesga" games examples packages docs agents` lists (with `docs/cheatsheet.md`, `examples/README.md` and the
  editor-3d Studio fixtures), `packages/automata/src/shared/ui/theme.css`,
  `packages/editor/src/shared/level-2d/canvas/colors.ts`, editor-3d's plan room fills; not `tokens.css`
- Test: `games/emberwick/tests/unit/shared/art/art.test.ts` (checks against `docs/art/palettes/duel.txt`),
  `packages/automata/tests/unit/shared/ui/theme.test.ts`

**Interfaces:**
- Consumes: `nearestDuel(hex)` (task 5.1).
- Produces: `remapPalette(fromHex: readonly string[]): number[]` (CLI prints the table).

- [ ] **Step 1:** Before screenshots (Emberwick title and play, the editor's Level view, the site's Home) at 390 × 844,
  1194 × 834 and 1440 × 900 into project files `refactor/2026-11-07-duel-screens/before/`.
- [ ] **Step 2: Write the failing tests**: `every art index is a DUEL colour`; `the theme's contrast pairs keep at least
  their current ratios` (the ratios recorded from today's theme as the test's table). Run → FAIL.
- [ ] **Step 3:** run the remap; hand-fix what reads wrong, each fix in `PROVENANCE.md`.
- [ ] **Step 4: Run** Emberwick's unit, browser and Chromium journeys → PASS; the sim hash unchanged. After screenshots;
  before/after/diff opened; the PR lists every hash and screenshot change.
- [ ] **Step 5: Commit** `feat(art): Emberwick, the theme and the examples on DUEL`

### Task 5.3: The 3D swatches are DUEL steps

**Files:**
- Modify: `packages/3d/src/features/figures/content/swatch.schema.ts`, `features/figures/figure/materials.ts`,
  `features/figures/view/figure-colour.ts`, `packages/3d/src/testing/golden-checks.ts`,
  `games/base-3d/src/content/figure-swatches/*.toml`, `games/base-3d/src/views/index.ts`, `examples/3d/*`
- Test: `packages/3d/tests/unit/figures/content/swatch.schema.test.ts`; goldens re-recorded with `record-goldens.ts`

**Interfaces:**
- Produces: a swatch is `{ ramp: DuelRampName; step: 0..7 }` or `{ tile: string }`; `DuelRampName` is the 32 names
  exported from `@automata/content/palette` (`DUEL_RAMP_NAMES`).

- [ ] **Step 1: Write the failing test** `a swatch names a DUEL ramp and step` (`{ ramp: 'skin', step: 5 }` parses;
  `{ ramp: 'skin', step: 8 }` fails with "step is 0 to 7"). **Step 2:** FAIL. **Step 3:** implement; TOML swatches
  rewritten. **Step 4:** 3D unit, parity and base-3d's golden replay pass (hash unchanged); `grep -rn "Endesga\|endesga"
  packages games examples site docs agents` → only `sources.md` and the codemod's test. **Step 5: Commit**
  `feat(3d): swatches are DUEL steps`

---

## Phase 6: Everything from FigureBuilder (PRs `claude/3d-figures-port`, `claude/3d-figures-outfit`)

Every task here ports from `../FigureBuilder` at `025ffb4`, writes one `sources.md` row per source file, and ports the
source's tests first, rewritten to AF's outputs (meshes, joint positions, ring radii), not painted texels. The base
pair (`base/base.ts`) is the fixture each port is checked on.

### Task 6.1: The provenance record (spec 8.4)

**Files:**
- Modify: `docs/provenance/sources.md` ("The figure source", "The environment source": repository, full commit,
  licence fact, the pull procedure; one row for the `a1f7246` extraction)
- Create: `docs/provenance/builders-manifest.json` (from `git ls-files` at both commits)
- Test: `tooling/repo-hygiene/tests/unit/sources-md.test.ts`

**Interfaces:**
- Produces: `checkSources(md: string, manifest: Manifest): string[]` in `tooling/repo-hygiene/src/sources-md.ts`;
  `--complete` makes a missing row an error (turned on in task 10.2).

- [ ] **Step 1: Write the failing tests**: `each builder section names a 40-character commit and the pull procedure`;
  `every row's AF path exists or says left out`; `with --complete, every manifest file has a row`. **Step 2:** FAIL.
  **Step 3:** the sections and the manifest. **Step 4:** PASS (without `--complete`); `pnpm source-names` passes.
  **Step 5: Commit** `docs(provenance): where the figures and the world come from, and how to pull again`

### Task 6.2: The body, the stand and the face (**session break** after body)

**Source files:** `src/features/body/{genes,head,parts,rig}.ts`, `src/features/motion/{motion,presets}.ts`,
`tests/features/body/*`, `tests/features/motion/*`, `base/base.ts`.

**Files:**
- Create: `packages/3d/tests/fixtures/base-pair.ts`
- Modify: `packages/3d/src/features/figures/body/*`, `motion/*`, `content/figure.schema.ts`, the `figure-stands` kind
- Test: `packages/3d/tests/unit/figures/body/*.test.ts`, `motion/*.test.ts`

**Interfaces:**
- Produces: genes gain `fat` (limbs, neck, jaw), `bust`, `seat`, `bodyAsymmetry`, `faceAsymmetry`, `eyeSize`,
  `eyeSpacing`, `eyeTilt`, each `number` in `[0, 1]` with a default that keeps Wick's goldens; `naturalStand(m:
  Measure): Pose`.

- [ ] **Step 1: Port the tests, failing**, e.g.

```ts
it('fat thickens the limb rings and leaves defaults unchanged', () => {
  expect(ringRadius(build(basePair.m, { fat: 1 }), 'thighL')).toBeGreaterThan(ringRadius(build(basePair.m), 'thighL'))
  expect(build(wick)).toEqual(build(wick, DEFAULT_GENES_DELTA))
})
it('the natural stand puts the head over the shoulders', () => {
  expect(Math.abs(joint(naturalStand(m), 'head').x - joint(naturalStand(m), 'chest').x)).toBeLessThan(0.01)
})
```

- [ ] **Step 2:** FAIL. **Session break here if needed.** **Step 3:** port the code. **Step 4:** unit and AF goldens
  (Wick unchanged) pass; every slider pushed to both ends builds (`sliders.test.ts`). **Step 5:** rows. **Commit**
  `feat(3d): the natural stand and the body and face sliders`

### Task 6.3: One timeline; lighting; actions as clips (spec 6, 8.3)

**Source files:** FigureBuilder `src/features/lighting/*`, `src/features/actors/{actions,pose-spec}.ts`,
`library/actions.json`, `lighting/library/times.json`; EnvironmentBuilder `src/features/world/timeline.ts` (the key
model), `src/features/paint/library/times.json`.

**Files:**
- Create: `packages/3d/src/shared/timeline/{key.ts,ease.ts,sample.ts,track.ts}` (from `features/figures/clips/`'s
  `ease.ts`, `sample.ts`, `clip-time.ts`), `packages/3d/src/shared/time-of-day/{time-of-day.schema.ts,
  time-of-day.content.ts,library/times.json}` (the two libraries merged), `features/figures/content/{figure-action.schema.ts,
  figure-actions.content.ts}`, `games/base-3d/src/content/figure-actions/*.toml` (reach, look, flinch; moved to
  `content/` in task 11.1)
- Modify: `features/figures/clips/*` (read keys and eases from `shared/timeline/`), `features/figures/lighting/*`
- Delete: the fixture clips for reach, look and flinch
- Test: `tests/unit/shared/timeline/*.test.ts`, `tests/unit/shared/time-of-day.test.ts`,
  `tests/unit/figures/clips/actions.test.ts`

**Interfaces:**
- Produces: `interface Key<V> { t: number; value: V; ease: Ease }`; `type Ease = 'linear' | 'step' | 'in' | 'out' |
  'inOut' | 'smooth'` (AF's names; `hold` reads as `step`); `sample<V>(track: Track<V>, t: number, mix: Mix<V>): V`;
  `compileAction(action: FigureAction): Clip`; `TimeOfDay { name; scene: { light, haze, grade }; figure: { key, fill,
  bounce } }` and `timeOfDay(name: string, overrides?): TimeOfDay`.

- [ ] **Step 1: Write the failing tests** (both sources' cases):

```ts
it('holds the first value before the first key and the last after the last', () => {
  expect(sample(track([[0, 1], [1, 3]]), -1, mixNumber)).toBe(1)
  expect(sample(track([[0, 1], [1, 3]]), 2, mixNumber)).toBe(3)
})
it('a frame at t is the same drawn alone', () => {
  const tr = track([[0, 0, 'smooth'], [2, 10]])
  expect(sample(tr, 1.3, mixNumber)).toBe(sampleFresh(tr, 1.3))
})
it('reads hold as step', () => expect(parseEase('hold')).toBe('step'))
it('merges the six times of day', () => {
  expect(TIMES.map((t) => t.name)).toEqual(['day', 'golden', 'dusk', 'night', 'lampLit', 'bar'])
  expect(timeOfDay('dusk').figure.key).toBeDefined()
})
it('each source action compiles to a clip that matches the source actor', () => {
  for (const a of SOURCE_ACTIONS) expect(poseAt(compileAction(a), 0.5)).toBeCloseToPose(sourceActorAt(a, 0.5), 1e-3)
})
```

- [ ] **Step 2:** FAIL. **Step 3:** the timeline, then clips read from it (clip tests pass unchanged), then the
  action kind, the merged times and lighting. **Step 4:** 3D unit and goldens pass (Wick unchanged);
  `grep -rn "type Ease\b" packages/3d/src` → only `shared/timeline/ease.ts`. **Step 5:** rows. **Commit**
  `feat(3d): one timeline; actions are clips; one time of day`

### Task 6.4: Hair, fit, seats and the registries (PR `claude/3d-figures-outfit`; **session break** after hair; audit notes 7, 8)

**Source files:** `src/features/hair/hair.ts` and `library/`, `src/features/outfit/{fit,garments,items}.ts` and
`library/`, `src/features/paint/fabric.ts` (the registry only), `src/features/figure/{cast,cloth,frames,figure}.ts`.

**Files:**
- Modify: `features/figures/hair/*`, `outfit/*`, `figure/*`, `app/figures.extension.ts` (registers the classic set)
- Create: `features/figures/registry/{garment,outfit-hooks,hair-piece,finish,fabric}.registry.ts`
- Test: ported `tests/unit/figures/hair/*`, `outfit/fit.test.ts`, `tests/unit/figures/registry/*.test.ts`

**Interfaces:**
- Produces, from `@automata/3d/figures`: `registerGarment(kind: string, entry: GarmentKind): void`,
  `registerOutfitHooks(hooks: OutfitHooks): void`, `registerHairPiece(kind: string, piece: HairPiece): void`,
  `registerFinish(name: string, finish: HairFinish): void`, `registerFabric(name: string, fabric: Fabric): void`; each
  throws `RegistryClash` on a second registration of a name; `profiles(m: Measure)`, `ringAt`, `girth`.

- [ ] **Step 1: Write the failing tests**:

```ts
it('refuses a second registration of a name', () => {
  registerGarment('cape', capeKind)
  expect(() => registerGarment('cape', otherCape)).toThrow('A garment called "cape" is already registered')
})
it('core registers only the classic set', () => {
  expect(registeredGarments()).toEqual(['cap', 'cape', 'shoes', 'trousers'])
})
it('a cuff hugs the arm at every slider end', () => {
  for (const m of sliderEnds(basePair.m)) expect(cuffRadius(m) - girth(m, 'wristL')).toBeCloseTo(TEXEL, 5)
})
```

- [ ] **Step 2:** FAIL. **Step 3:** hair (low pony, bun, fall, curl volume). **Session break here if needed.**
  **Step 4:** fit, seats, the registries; the classic set registered by `figures.extension.ts`; the `figure-headwear`
  kind folds into the garment registry (Wick's cap is `cap`). **Step 5:** unit and goldens pass (Wick unchanged).
  Rows. **Commit** `feat(3d): hair pieces, garments fitted to the body, and the wardrobe registries`

### Task 6.5: Streetwear becomes an example extension (D6, B2; audit note 7)

**Files:**
- Move: `packages/3d/src/features/figures/outfit/streetwear/` → `examples/3d/wardrobe/`, with `wardrobe.extension.ts`
- Modify: `features/figures/content/garment.schema.ts`, `garment-defaults.ts`, `swatch.schema.ts`, `outfit/classic.ts`
  (no streetwear types), `examples/3d/figures/figures-outfits-items.ts`, `examples/3d/package.json` (`test:unit`),
  create `examples/3d/vitest.config.ts`
- Test: `examples/3d/tests/unit/wardrobe.test.ts`; streetwear goldens move to the example

**Interfaces:**
- Consumes: the registries (task 6.4), `defineExtension` from `@automata/framework`.
- Produces: `wardrobeExtension` (default export of `wardrobe.extension.ts`).

- [ ] **Step 1: Write the failing test** `a figure in a bomber compiles once the wardrobe extension is set up, and
  fails with "No garment called bomber" without it`. **Step 2:** FAIL. **Step 3:** the move. **Step 4:** `pnpm
  test:unit:3d` and the example's unit test pass; `grep -rn "bomber\|hoodie\|puffer" packages/3d/src` → none.
  **Step 5: Commit** `refactor(3d): the streetwear wardrobe is an example extension`

---

## Phase 7: One level format and the world (PRs `claude/3d-level-2`, `claude/3d-world`)

Ports from `../EnvironmentBuilder` at `6d82a52`, with `sources.md` rows.

### Task 7.1: `af-sector/2` and its migration (spec 9; audit note 10)

**Files:**
- Create: `packages/3d/src/shared/level/af-sector-2.schema.ts` (every row of spec 9's table),
  `af-sector-1-to-2.migration.ts`, `shared/level/sim/` (floors, walls, pits, things and their fields, spawn),
  `packages/3d/scripts/convert-builder-maps.ts` (run in task 7.3)
- Modify: `shared/level/af-sector.schema.ts` (reads `/1` and `/2`, returns `/2`),
  `games/base-3d/src/content/levels/room.af-sector.json` (migrated), `games/base-3d/src/content/levels/sector-area.ts`
  (reads `corners`; pits by flag), `games/base-3d/src/content/room.ts` (`ROOM_VIEWS` leaves code for the file's
  `views`), editor-3d's level readers (open `/1`, write `/2`)
- Test: `packages/3d/tests/unit/shared/level/af-sector-2.schema.test.ts`, `migration.test.ts`,
  `convert-builder-maps.test.ts`; base-3d's golden replay

**Interfaces:**
- Produces: `type AfSector2` and `afSector2Schema`; `readLevel(json: unknown): { level: AfSector2; migrated: boolean;
  problems: Problem[] }`; `migrateAfSector1(level: AfSector): AfSector2`; `simLevel(level: AfSector2): SimLevel`
  (what the sim reads, from `@automata/3d/sim`); `convertBuilderMap(plan: unknown): AfSector2`.

- [ ] **Step 1: Write the failing tests**

```ts
it('migrates every /1 fixture losslessly', () => {
  for (const f of V1_FIXTURES) {
    const two = migrateAfSector1(f)
    expect(afSector2Schema.parse(JSON.parse(JSON.stringify(two)))).toEqual(two)
    expect(simLevel(two)).toEqual(simLevelOfV1(f))
  }
})
it('reads a bare-number floor as a plane', () => {
  expect(readLevel(withFloor(1.5)).level.sectors[0].floor).toEqual({ z: 1.5 })
})
it("reads a wall's texture as its surface", () => { /* /1 texture → /2 surface */ })
it('says when a level was migrated', () => expect(readLevel(v1Room).migrated).toBe(true))
it('converts a builder map: rect sectors to corners, sprites to props and cast', () => {
  const two = convertBuilderMap(builderMap('apartment-small'))
  expect(two.sectors[0].corners).toHaveLength(4); expect(two.props?.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2:** FAIL. **Step 3:** the schema, the migration, `simLevel`, the converter. **Step 4:** PASS; base-3d's
  unit tests (82) and golden replay pass with the migrated room, sim hash unchanged. **Step 5: Commit**
  `feat(3d): af-sector/2, one level format for the game, the editor and the world`

### Task 7.2: The world builder (spec 9; audit note 12; **session break** after mesh)

**Source files:** `src/features/world/{build,sectors,mesh,subdivide,surface,swatches,map,types}.ts`,
`src/lib/{geometry,rng}.ts`.

**Files:**
- Create: `packages/3d/src/features/world/{build,sectors,mesh,subdivide,surface,swatches}.ts`
- Modify: `features/renderer/` (draws world pieces: `world-pieces.ts`), `games/base-3d/src/content/levels/sector-area.ts`
  (box room → world pieces; deleted if nothing else reads it), `packages/editor-3d/src/view/mesh/sector-mesh.ts`
  (replaced by the world builder), `app/compose-scene.ts`
- Test: ported `tests/unit/world/{build,mesh,subdivide,surface}.test.ts`; render parity for base-3d's room re-recorded
  once

**Interfaces:**
- Consumes: `AfSector2` (task 7.1); `createRng(seed)` from `@automata/sim` (EnvironmentBuilder's `lib/rng.ts` is not
  ported).
- Produces: `buildWorld(level: AfSector2, library: WorldLibrary): { pieces: WorldPiece[]; problems: Problem[] }`;
  `interface WorldPiece { id: string; sector: string; part: 'floor' | 'ceiling' | 'wall' | 'decor' | 'prop' | 'lamp';
  mesh: MeshData; surface: Surface }`; `drawWorld(scene, pieces): WorldView` in `features/renderer/world-pieces.ts`.

- [ ] **Step 1: Write the failing tests** (the source's cases, plus):

```ts
it('reports a degenerate room instead of throwing', () => {
  const { pieces, problems } = buildWorld(levelWith(collinearRoom), LIB)
  expect(problems).toContainEqual(expect.objectContaining({ where: 'room-2' }))
  expect(pieces.every((p) => p.sector !== 'room-2')).toBe(true)
})
it('a sloped floor tilts its plane', () => { /* floor { z: 0, slope: [0.1, 0] } → vertices rise along x */ })
it('an open-sky sector has no ceiling piece', () => { /* ceiling { z: 3, sky: true } */ })
```

- [ ] **Step 2:** FAIL. **Step 3:** the builder (build, sectors, mesh). **Session break here if needed.** **Step 4:**
  subdivide, surface, swatches; the renderer draws the pieces; the old box room and `sector-mesh.ts` go.
- [ ] **Step 5:** 3D unit, render parity (re-recorded once; expected/actual/diff opened, change explained: the world
  builder replaces the box room) and base-3d's golden replay (unchanged) pass. Rows. **Commit** `feat(3d): the world
  builder draws levels`

### Task 7.3: Props, the dresser, lamps, decals, lettering, generated maps (**session break** after props)

**Source files:** `src/features/world/{props,dress,decals,lettering,generate}.ts`,
`library/{props,kits,glyphs,maps,swatches}.json`; `src/features/paint/look.ts` (the lamp kit), `library/look.json`.

**Files:**
- Create: `features/world/{props,dress,decals,lettering,generate}.ts`, `features/world/library/{props,kits,swatches,
  glyphs}.json`, `features/world/library/maps/*.af-sector.json` (by `convert-builder-maps.ts`), the content kinds
  `world-kit`, `world-prop`, `world-swatch` (`world-kit.schema.ts`, `world-prop.schema.ts`, `world-swatch.schema.ts`,
  `world.content.ts`)
- Modify: `games/base-3d/src/content/levels/room.af-sector.json` (dressed from a kit, a lamp, a time of day)
- Test: `tests/unit/world/{dress,props,generate,library}.test.ts`

**Interfaces:**
- Consumes: `buildWorld` (task 7.2), `timeOfDay` (task 6.3).
- Produces: `dressSector(sector: Sector2, kit: Kit, seed: number): PlacedProp[]` (each with a stable `id`);
  `generateMap(name: 'apartment' | 'block', seed: number): AfSector2`; `WorldLibrary { kits; props; swatches; glyphs }`
  merged from core and the game's content.

- [ ] **Step 1: Write the failing tests**

```ts
it('dressing is deterministic and every piece has an id', () => {
  const a = dressSector(room, KITS.office, 7), b = dressSector(room, KITS.office, 7)
  expect(a).toEqual(b); expect(new Set(a.map((p) => p.id)).size).toBe(a.length)
})
it('an unknown kit leaves the room bare and reports it', () => {
  const { pieces, problems } = buildWorld(levelDressedAs('spaceship'), LIB)
  expect(problems).toContainEqual(expect.objectContaining({ code: 'unknown-kit', name: 'spaceship' }))
  expect(pieces.some((p) => p.part === 'floor')).toBe(true)
})
it('every library entry parses', () => { /* world-kit, world-prop, world-swatch schemas over the library */ })
it('apartment@1 and block@1 generate valid /2 levels', () => {
  for (const n of ['apartment', 'block'] as const) expect(afSector2Schema.safeParse(generateMap(n, 1)).success).toBe(true)
})
```

- [ ] **Step 2:** FAIL. **Step 3:** props and the dresser. **Session break here if needed.** **Step 4:** lamps, decals,
  lettering, generators, the converted maps. **Step 5:** base-3d's unit tests and golden replay pass (hash unchanged:
  dressing is presentation); its journeys pass in Chromium with the dressed room; images in the PR, each change
  explained. Rows. **Commit** `feat(3d): props, furnished rooms, lamps and generated maps`

### Task 7.4: The stage (spec 8.3)

**Source files:** EnvironmentBuilder `src/features/stage/{actor,cast,camera,runtime,state}.ts`,
`src/features/view/shots.ts`; FigureBuilder `src/features/actors/actor.ts` (the script).

**Files:**
- Create: `packages/3d/src/features/stage/{stage-script.schema.ts,stage.content.ts,scene-state.ts,director.ts,
  sequence.ts}`, `features/renderer/update-pieces.ts`
- Modify: `app/compose-scene.ts` (gives the director `startClip`)
- Test: `tests/unit/stage/*.test.ts`

**Interfaces:**
- Consumes: `Track`, `sample` (task 6.3); `WorldPiece` ids (task 7.2).
- Produces: `createDirector(script: StageScript, startClip: (who: string, clip: string, atTick: number) => void):
  Director`; `Director.stateAt(t: number): SceneState`; `SceneState { camera; doors: Record<string, number>; lamps:
  Record<string, LampState>; time: string; grade: string; props: Record<string, PropState> }`;
  `updatePieces(view: WorldView, before: SceneState, after: SceneState): number` (pieces changed).

- [ ] **Step 1: Write the failing tests**

```ts
it('a state at t comes from the keys alone', () => {
  expect(createDirector(script, noop).stateAt(1.5)).toEqual(createDirector(script, noop).stateAt(1.5))
})
it('a door key changes only that door', () => {
  expect(updatePieces(view, stateAt(0), stateAt(1))).toBe(piecesOf(view, 'door-1').length)
})
it('a cue starts its clip at its tick', () => {
  const calls: unknown[] = []; const d = createDirector(cueAt(2, 'wick', 'reach'), (...a) => calls.push(a))
  d.stateAt(1.9); expect(calls).toEqual([]); d.stateAt(2); expect(calls).toEqual([['wick', 'reach', 2]])
})
```

- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS; `boundaries` keeps `Date` and `performance` out of
  `features/stage` (add `--forbid-globals packages/3d/src/features/stage:Date,performance` if the tool lacks a rule,
  with its own test in `packages/tools/tests/unit/boundaries/`). `grep -rn "class Actor\|Troupe" packages/3d/src` →
  none. Rows. **Commit** `feat(3d): the stage plays scripts on the one timeline`

---

## Phase 8: The look on Pixi 3D (PR `claude/3d-look`)

### Task 8.1: Measure, then choose (ADR 0007)

**Files:** Create `spikes/3d-look/` (exempt from TDD; candidates (a) passes and (b) bake on base-3d's dressed room
with Wick), `docs/adr/0007-3d-look.md`.

- [ ] **Step 1:** Check that the beta takes a custom material and a low-resolution render target drawn
  nearest-neighbour (record yes or no for each).
- [ ] **Step 2:** Measure both with the phone and iPad profiles on the GPU runner (the Owner's `ci:local`), and in
  Chromium here (software: recorded, not judged).
- [ ] **Step 3:** Write the ADR (what was measured, where, the choice by spec 6's rule). **Commit** `docs(adr): the 3D
  look on Pixi 3D`

### Task 8.2: The passes and the reference (**session break** after the filters; audit note 14)

**Source files:** EnvironmentBuilder `src/features/paint/*`, `src/features/stage/sprite-light.ts`; FigureBuilder
`src/features/paint/{paint,raster,fabric}.ts`, `src/features/lighting/light.ts`.

**Files:**
- Create: `packages/3d/src/features/look/{look.ts,look.schema.ts,ramp-light.material.ts,duel-snap.filter.ts,
  outline.filter.ts,sprite-light.ts,sky.ts,rain.ts,post.ts}` with `.glsl` + `.wgsl` pairs, `look/library/look.json`,
  `packages/3d/src/testing/look-reference/` (both painters, plain TypeScript), `packages/3d/scripts/look-sheet.ts`
  (contact sheets from the reference, for a reviewer)
- Modify: `app/create-renderer.ts` (low-resolution target, then the passes), `app/compose-scene.ts`, base-3d's views
- Test: `tests/unit/look/*.test.ts`, `tests/unit/entries.test.ts`, `tests/browser/look/look.parity.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_PALETTE`, `step` (task 5.1); `timeOfDay` (task 6.3).
- Produces: `Look { pixel: { width: 320; height: 180 }; steps: number; outline: boolean; dither: boolean; grade: string;
  switches: Record<'outline' | 'sky' | 'stars' | 'rain' | 'bloom' | 'grade' | 'dither', boolean> }`;
  `createLookPasses(look: Look, time: TimeOfDay): LookPasses`; `spriteLight(figure, time): SpriteLight`;
  `paintReference(scene, camera, look): Uint8Array` (palette indices; test-only).

- [ ] **Step 1: Write the failing tests**

```ts
it('no product entry reaches the reference painters', () => {
  for (const e of PRODUCT_ENTRIES) expect(importGraph(e).some((f) => f.includes('look-reference'))).toBe(false)
})
it('ramp light moves a colour in whole steps along its ramp', () => {
  expect(rampLit(3 * 8 + 4, 0.5, look)).toBe(step(3 * 8 + 4, -2))
})
it('sprite light gives a flat light at the chest, a one-step form and a rim', () => { /* … */ })
// browser: WebGL2 and WebGPU agree; Pixi 3D and paintReference agree within 2 % of pixels off by one ramp step
```

- [ ] **Step 2:** FAIL. **Step 3:** the filters. **Session break here if needed.** **Step 4:** the material, sprite
  light, sky and rain, through the game's camera. **Step 5:** parity in Chromium (WebKit/Firefox: the Owner's), the
  reference agreement, base-3d's journeys pass; images opened and explained. Rows (painters: *rewritten: reference
  only*). **Commit** `feat(3d): the pixel-art look, drawn by Pixi 3D`

---

## Phase 9: Textures and the builders' checks (PR `claude/3d-textures`)

### Task 9.1: `automata textures` in `-tools` (spec 9; audit note 13)

**Source files:** EnvironmentBuilder `src/features/photo/{pipeline,structure,textures}.ts`, `library/photos.json`, the
photos, `src/lib/png.ts`, `scripts/{textures,photos}.ts`.

**Files:**
- Create: `packages/tools/src/features/textures/{pipeline.ts,png.ts,structure.ts,textures-command.ts}`,
  `packages/3d/assets/photos/` (photos and `photos.json` with each credit; outside `files`),
  `packages/3d/src/features/world/library/tiles/` (generated, committed, each with `<name>.tile.json` holding the
  photo's sha-256)
- Modify: `packages/tools/src/shared/check/` (the stale-tile finding), `packages/tools/src/cli.ts` (the command)
- Test: `packages/tools/tests/unit/textures/*.test.ts`, a tiny image made by the test under
  `packages/tools/tests/fixtures/textures/`

**Interfaces:**
- Consumes: `DEFAULT_PALETTE`, `nearestDuel` from `@automata/content/palette` (the only dependency; never
  `@automata/3d`).
- Produces: `photoToTile(png: Uint8Array, knobs: PhotoKnobs): { tile: Uint8Array; width: number; height: number }`;
  `automata textures <photos> --out <folder>`; finding code `stale-tile`.

- [ ] **Step 1: Write the failing tests**

```ts
it('every tile pixel is a DUEL colour', () => {
  const { tile } = photoToTile(checkerPng(16), DEFAULT_KNOBS)
  expect([...tile].every((i) => i < 256)).toBe(true)
})
it('runs flatten, facet, resample, index, wear and clean in order', () => { /* the source's stage cases */ })
it('refuses a missing folder', async () => {
  expect(await run(['textures', 'nope', '--out', 'x'])).toMatchObject({ code: 1, stderr: expect.stringContaining('nope') })
})
it('reports a stale tile', () => {
  expect(checkTiles(withEditedPhoto)).toContainEqual(expect.objectContaining({ code: 'stale-tile' }))
})
```

- [ ] **Step 2:** FAIL. **Step 3:** the port; generate the tiles and commit them. **Step 4:** PASS; `-tools` has no
  `@automata/3d` dependency (`pnpm knip`, and `tooling/release/tests/unit/private-build.test.ts`). **Step 5:**
  changeset `patch` for `@automata/tools`; rows. **Commit** `feat(tools): automata textures turns photos into DUEL tiles`

### Task 9.2: The builders' `reads` checks (spec 8.4; audit note 11)

**Source files:** EnvironmentBuilder `scripts/{check,checks}.ts`, `photo/structure.ts` (`checkReads`),
`view/view-frame.ts` (`frameIssues`), the `reads` fields of `swatches.json` and `maps.json`.

**Files:**
- Create: `packages/3d/src/features/world/reads.ts` (pure: a swatch's and a level's declared `reads` against what they
  build)
- Modify: `games/base-3d/tests/unit/content.test.ts` (runs `checkReads` over the game's levels; the 3D template of
  task 12.2 copies the line). `-tools` gets no 3D dependency: the published `automata check` keeps its `levels` step,
  and a game's declared `reads` are its own test's and Levels 3D's (task 16.2)
- Test: `packages/3d/tests/unit/world/reads.test.ts`

**Interfaces:**
- Produces: `checkReads(level: AfSector2, library: WorldLibrary): Problem[]` (exported from `@automata/3d/level`).

- [ ] **Step 1: Write the failing tests**: `a swatch whose edge is under its minEdge is reported`; `a level whose room is too small for its
  declared minEdge is reported`. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. Rows. **Commit**
  `feat(check): the 3D content's declared reads`

---

## Phase 10: Words and provenance in the 3D core (PR `claude/3d-words`)

### Task 10.1: No plan IDs or source names in code

**Files:**
- Modify: every file under `packages/3d`, `tooling/repo-hygiene/src/source-names.ts` (`--code <folders>`: reads `.ts`,
  `.svelte`, `.css`, `.json`, `.toml` under them; learns `environment[\s_-]?builder`), root `package.json`
  (`source-names --code packages/3d`; `style --plan-comments packages/3d/src`)
- Test: `tooling/repo-hygiene/tests/unit/source-names.test.ts`

**Interfaces:**
- Produces: `findSourceNames(files: readonly string[], options: { code: readonly string[] }): Finding[]`.

- [ ] **Step 1: Write the failing tests**: `a .ts file naming a source under a --code folder fails`; `one outside does
  not`; `docs/provenance stays exempt`. **Step 2:** FAIL. **Step 3:** the option; rewrite the comments (what and why,
  not where from). **Step 4:** `pnpm source-names` and `pnpm style` pass. The `--code` list grows: `packages/automata`,
  `content`, `tools`, `games/base-3d`, `examples/3d` in task 13.2; `packages/editor-3d`, `packages/editor` in 17.2, which
  replaces the list with every source folder. **Step 5: Commit** `refactor(3d): comments say what and why`

### Task 10.2: README, a complete record, part A's close

**Files:** Create `packages/3d/README.md` (entries, the beta rule); modify `docs/README.md`, `docs/provenance/sources.md`,
root `package.json` (`sources-md --complete` in `source-names`), `progress.md`.

- [ ] **Step 1:** Turn on `--complete`; run → it lists every manifest file without a row; fill them (each *ported*,
  *rewritten* or *left out: why*). **Step 2:** PASS.
- [ ] **Step 3:** Part A's done check: spec criteria 1 to 7 (commands and output in the PR); `pnpm check`, the 3D
  browser suites in Chromium and the 3D workflow on the PR green. **Commit** `docs(3d): the package's README; part A done`
- [ ] **Step 4:** Merge part A's PRs in stack order once every head is green. Part B starts after.

---

# Part B: the rest of AF that uses 3D

## Phase 11: Ember Hall (PR `claude/3d-game`)

### Task 11.1: The feature layout and `content/` (audit notes 18, 19)

**Files:**
- Create: `docs/refactor/move-map-base-3d.json`, `games/base-3d/content/editors.toml`
- Move: `games/base-3d/src/{commands,components,events,resources,state,systems,views,screens,constants}` →
  `src/{app,entries,features/{hero,embers,room,scene,screens},shared,testing}` like `games/emberwick/src`;
  `src/content/` → `content/` (levels, figures, figure kinds, figure actions, generated); tests → `tests/{unit,browser}`
  with `#src/…` imports; the tunable numbers in `constants/` → `content/tuning.toml`
- Modify: root `boundaries` (keep `--game games/base-3d/src`, which reads feature layouts by suffix; add `--features
  games/base-3d`), `style` (drop `--role-layout games/base-3d/src`; add `--plan-comments games/base-3d/src`,
  `--test-imports games/base-3d`), `games/base-3d/{vite,vitest,playwright}.config.ts`
- Delete: `games/base-3d/EDITOR-GAPS.md` (closed by `af-sector/2` and the Things layer; G3)
- Test: the moved tests; `tests/unit/editors-list.test.ts`

**Interfaces:**
- Produces: `content/editors.toml` rows `content/levels/*.af-sector.json` → `levels-3d`, `content/figures/*.toml` →
  `studio`, `content/tuning.toml` → `tuner`, with `exports`, `gates` and `checks` as Emberwick's.

- [ ] **Step 1:** Record counts (unit 82, browser and layout 32, journeys 8, the replay hash). Dry run, then move.
- [ ] **Step 2: Write the failing test** `the editor list parses and every glob matches a file`; FAIL; write
  `editors.toml`; PASS.
- [ ] **Step 3:** `--features games/base-3d` and `--game` pass; every suite passes with the counts of step 1; the
  replay hash unchanged. **Commit** `refactor(base-3d): feature folders and content/ like Emberwick`

### Task 11.2: One name, the menu and the HUD (G4 to G6, C10)

**Files:**
- Modify: `games/base-3d/src/messages/ui/en.json`, `src/features/screens/flow.ts`, `src/features/screens/Hud.svelte`,
  the play view's framing, `DESIGN.md`, `package.json` (`automata.title: "Ember Hall"`), `docs/refactor/copy.md`
- Test: `tests/unit/screens/flow.test.ts`, `tests/browser/screens/{hud,play}.layout.test.ts`

**Interfaces:**
- Consumes: `checkLayout` with the bar rule (task 1.5).

- [ ] **Step 1: Write the failing tests**

```ts
it('the title menu offers Continue only with a save, then New game and Settings', () => {
  expect(menuItems({ hasSave: true })).toEqual(['Continue', 'New game', 'Settings'])
  expect(menuItems({ hasSave: false })).toEqual(['New game', 'Settings'])
})
it('the HUD says what it counts', async () => {
  await page.goto(play); await expect(page.getByText('Embers 0 of 6')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})
it('the room fills the stage on an iPad', async () => { expect(await roomBoxHeightShare(1194, 834)).toBeGreaterThanOrEqual(0.8) })
```

- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS; journeys pass; before/after screens in the PR.
  **Step 5: Commit** `feat(base-3d): Ember Hall, a menu with Settings and a HUD that says what it counts`

### Task 11.3: Journeys that play (G2)

**Files:** Modify `games/base-3d/e2e/base-3d.e2e.ts`, `games/base-3d/src/testing/route.ts` (a test-only seed and route).

- [ ] **Step 1: Write the failing journey**: with touch, the stick moves the hero, Roll rolls, an ember is collected
  and the HUD says "Embers 1 of 6", the goal ends the game; at 390 × 844 and 1194 × 834. **Step 2:** FAIL on the missing
  route. **Step 3:** the route. **Step 4:** PASS in Chromium (WebKit on the runner); first-attempt failures kept.
  **Step 5: Commit** `test(base-3d): journeys play to the goal`

## Phase 12: The examples and the 3D template (PR `claude/3d-examples`)

### Task 12.1: The 3D examples on the new package (**session break** after four examples)

**Files:**
- Modify: `examples/3d/{figures,render3d}/*` (imports from `@automata/3d`; `// --- <role> ---` sections)
- Create: `examples/3d/{figures-stand-and-sliders,figures-hair,figures-wardrobe,look-pixel-art,world-furnished-room,
  world-generated-map,world-time-of-day,stage-script}.ts`, `examples/3d/README.md`
- Test: `examples/3d/e2e/*.e2e.ts` (each boots and reaches ready), the examples runner's list

- [ ] **Step 1:** Failing journeys for the eight. **Step 2:** four examples. **Session break here if needed.**
  **Step 3:** the other four. **Step 4:** PASS in Chromium. **Step 5: Commit** `feat(examples): the 3D examples show
  the figures, the world and the look`

### Task 12.2: `create-game --template 3d`

**Files:**
- Create: `packages/tools/src/shared/create-game/template-3d.ts`
- Modify: `packages/tools/src/shared/create-game/` (the template list; `--help` lists `3d` only when `@automata/3d`
  resolves: inside this repository or with `AF_BETA_3D=1`), `tooling/consumer-smoke` (a 3D stranger behind
  `AF_BETA_3D=1`)
- Test: `packages/tools/tests/unit/create-game/template-3d.test.ts`, the smoke

**Interfaces:**
- Produces: `template3d(name: string): TemplateFiles` (one room, Wick, a tuning file, an editor list, the feature
  layout, the content test with `checkReads`).

- [ ] **Step 1: Write the failing tests**: `the 3D template's files pass automata check`; `without the 3D package it
  says "3D games need a package that is not public yet." and exits 1`. **Step 2:** FAIL. **Step 3:** the template.
  **Step 4:** PASS; the smoke passes with `AF_BETA_3D=1`. **Step 5:** changeset `patch` for `@automata/tools` and
  `create-game`. **Commit** `feat(create-game): a 3D template`

## Phase 13: The command, docs, agents and budgets (PR `claude/3d-rest`)

### Task 13.1: `automata editor` reads 3D levels (C7)

**Files:** Modify `packages/tools/src/features/editor/editor-policy.ts`, `editor-command.ts`. Test
`packages/tools/tests/unit/editor/{editor-policy,editor-command}.test.ts`.

**Interfaces:**
- Produces: `LEVEL_FILES = ['.af2d.json', '.af-sector.json'] as const`; the first line "Opened <title>." from
  `automata.title`.

- [ ] **Step 1: Write the failing tests**: `a game without a list lists its .af-sector.json room`; `the first line
  names the game by its title`. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** changeset
  `patch`. **Commit** `fix(editor): the command opens 3D levels and names the game`

### Task 13.2: Docs, agents and words outside the 3D package (S8)

**Files:** Create `docs/guides/3d.md`; modify `docs/README.md`, the agent package's 3D skills and API reference,
`games/base-3d/README.md`, every plan ID and source name in `packages/automata`, `content`, `tools`, `games/base-3d`,
`examples/3d`; root `package.json` (`source-names --code` and `style --plan-comments` cover them).

- [ ] **Step 1:** Add the folders to `--code`; run `pnpm source-names` → the findings (record the count). **Step 2:**
  rewrite. **Step 3:** PASS; `pnpm api-index`, `pnpm agent-skills --write`, `pnpm cheatsheet` if stale. **Step 4:
  Commit** `docs: 3D in the guides and the agent package`

### Task 13.3: The 3D frame-budget projects (spec 6; audit note 15)

**Files:**
- Create: `tooling/frame-budget/stress/3d/{index.html,main.ts}` (Ember Hall's dressed room with Wick, every pass on, the
  camera turning)
- Modify: `tooling/frame-budget/playwright.config.ts` (projects `frame-budget-3d-phone`, `frame-budget-3d-ipad` at
  1194 × 834), `tooling/frame-budget/budget.json` (33 ms, 16.7 ms, the first pose 5 ms)
- Test: `tooling/frame-budget/tests/unit/budget-3d.test.ts`

- [ ] **Step 1: Write the failing tests**: `budget.json has the 3D rows`; `a software renderer skips with "Skipped:
  software renderer, no frame budget measured."`. **Step 2:** FAIL. **Step 3:** the page and projects. **Step 4:** PASS
  here (skips); the GPU runner's run is the Owner's queue; the first pose is met or changed to the measured number in
  spec 15. **Step 5:** Part B's done check. **Commit** `test(frame-budget): 3D budgets for the look`
- [ ] **Step 6:** Merge part B's PRs in stack order once green. Part C starts after.

---

# Part C: the editors

## Phase 14: `editor-3d` by feature (PR `claude/3d-editor-features`)

### Task 14.1: Feature folders and `tests/` (**session break** after the map)

**Files:**
- Create: `docs/refactor/move-map-editor-3d.json`: `ui/suite/studio/*` → `features/studio/`; `ui/{plan,walk,dollhouse,
  inspector,definitions,document,home}`, `app/*-controller.ts`, `checks/`, `things/`, `entities/`, `model/` →
  `features/levels-3d/<same name>/`; `view/*` → `features/levels-3d/{plan,walk,dollhouse}/`; `geometry/`, `codec/`,
  `profile/` → `shared/{geometry,level-session}/`; `suite-main.ts`, `ui/suite/*` → `app/suite/`; `testing/` stays
- Move: tests → `tests/{unit,dom,browser/{layout,canvas},journeys}` (`--keep-qualifier layout --keep-qualifier canvas
  --keep-qualifier journey`)
- Modify: root `boundaries` (`--features packages/editor-3d --components`), `style` (`--test-imports
  packages/editor-3d`), `packages/editor-3d/vitest.config.ts`

- [ ] **Step 1:** Record counts (unit and DOM; Chromium layout and canvas 195; journeys). Write the map; dry run.
  **Session break here if needed.** **Step 2:** move; `--features` finds 0; every suite passes with the counts.
  **Step 3: Commit** `refactor(editor-3d): feature folders, tests in tests/`

### Task 14.2: Dead entries, the shim and the tokens (E5, K3, V3)

**Files:**
- Delete: `packages/editor-3d/src/index.ts`, the `./suite` entry, what only they used (`pnpm knip`)
- Modify: `suite-content-shim.ts` (inlined into its caller with `@automata/content/schema` and `/palette`), every
  unknown `var(--…)`, `tooling/check-style/src/` (the token rule)
- Test: `tooling/check-style/tests/unit/tokens.test.ts`

**Interfaces:**
- Produces: `findUnknownTokens(css: string, known: ReadonlySet<string>): Finding[]`; `style --tokens packages/editor/src/shared/kit/tokens.css packages/editor-3d/src`.

- [ ] **Step 1: Write the failing test** `an editor var(--x) the kit and the file do not define fails`; run on
  editor-3d → finds the 14 tokens and the 23 radius uses. **Step 2:** the fixes. **Step 3:** layout and canvas pass;
  pixel changes explained. **Step 4: Commit** `refactor(editor-3d): kit tokens only; no dead entries`

## Phase 15: One suite (PR `claude/3d-one-suite`)

### Task 15.1: The full suite opens the checkout (E2)

**Files:** Modify `packages/editor-3d/src/app/suite/main.ts`, `packages/editor/src/features/suite/memory/sample-ports.ts`
(takes extra sample files from its caller). Test `packages/editor-3d/tests/dom/suite/open-checkout.dom.test.ts`.

**Interfaces:**
- Produces: `samplePorts(extra?: readonly SampleFile[]): SuitePorts`; the 3D page passes a 3D room and Wick.

- [ ] **Step 1: Write the failing tests**: `on a checkout the suite lists base-3d's room and Wick`; `served for the site
  it opens the sample with a 3D room and Wick`. **Step 2:** FAIL. **Step 3:** `openSuitePorts` as the 2D page.
  **Step 4:** PASS. **Commit** `fix(suite): the full suite opens the game's folder`

### Task 15.2: One page, chosen by the game (D4, E3, E4)

**Files:**
- Modify: `packages/tools/src/features/editor/editor-command.ts` (no `--app`; `BUILDS` is the 2D suite and the full
  suite), `docs/guides/editor.md`, the help text
- Delete: `packages/editor-3d/src/main.ts`, its `index.html` and standalone build, `packages/editor/src/app/editor-2d/`
- Test: `packages/tools/tests/unit/editor/editor-command.test.ts`; the 2D journeys re-pointed at the suite (same counts)

**Interfaces:**
- Produces: `pageFor(game: GameFiles, builds: Builds): 'suite-2d' | 'suite-full'`.

- [ ] **Step 1: Write the failing tests**: `base-3d gets the full page`; `Emberwick gets the 2D page`; `--app says
  "This option is gone: automata editor picks the editors your game needs." and exits 1`. **Step 2:** FAIL. **Step 3:**
  the change and deletions. **Step 4:** both editors' suites pass; `pnpm knip` clean. **Step 5:** changeset `patch`.
  **Commit** `feat(editor): one editor app for every game`

### Task 15.3: The cuts (D6, E6)

**Files:** Delete World, Ask (`ask-controller.ts`, `testing/fake-ask.ts`, `SuiteAsk.svelte`, the top bar's Ask), the
change-set desk (Review, Export changes, Import changes, Publish over a sample) in `packages/editor` and
`packages/editor-3d`.

- [ ] **Step 1:** Record counts. **Step 2:** delete with their tests. **Step 3:** counts drop by exactly theirs; journeys
  pass; `pnpm knip` clean. **Commit** `refactor(editors): only what works on a real game`

### Task 15.4: The suite on a phone (V4)

**Files:** Modify `packages/editor/src/features/suite/shell/*`, the full page's registration of Levels 3D and
Characters. Test `packages/editor/tests/browser/layout/suite-phone.test.ts`.

- [ ] **Step 1: Write the failing tests** at 390 × 844 and 844 × 390: `the top bar names the game`; `the tabs are the
  game's editors with one Levels`; `in landscape the stage keeps at least 85 % of the height`; `checkLayout` clean.
  **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS for both pages; screens in the PR. **Commit**
  `feat(suite): the suite on a phone names the game and lists its editors`

## Phase 16: Levels 3D redesigned (PR `claude/3d-levels-redesign`)

### Task 16.1: The frame, phone first (V1, V2, D5; **session break** after the top bar and tools)

**Files:** Modify `packages/editor-3d/src/features/levels-3d/` (spec 10.3's top bar, floating tools, view tabs and phone
menu, label-left inspector, layers sheet, three layouts by `shellModeOf` with the dock on compact), the kit's icons
(Room, Corner, Doorway, Door, Window, Thing, Prop, Lamp). Test `tests/browser/layout/levels-3d.layout.test.ts`,
`tests/dom/levels-3d/*`, the canvas suite.

- [ ] **Step 1: Write the failing tests**: at 390 × 844, 844 × 390, 1194 × 834, 1440 × 900 `a drawing tool, the view
  switch, the inspector and Save are reachable` and `checkLayout` is clean; `every tool is reachable by role and name`;
  `keyboard occlusion keeps compact layout and the focused field` (an inspector number focused, the visual viewport
  shrunk by 300 px: still compact, the field visible, Save whole). **Step 2:** FAIL. **Step 3:** top bar and tools.
  **Session break here if needed.** **Step 4:** inspector, layers, layouts. **Step 5:** PASS; before/after at the four
  sizes against the mock-up. **Commit** `feat(levels-3d): the approved look, with every tool on a phone`

### Task 16.2: The builders' authoring (spec 10.3)

**Files:** Modify `features/levels-3d/inspector/` (Furnish as, Time of day, Wall trim, Windows), `features/levels-3d/
plan/tools/` (Furniture and things, Lamp), `shared/edit/` (one undoable command each), `features/levels-3d/checks/`
(`checkReads`; a prop outside every room; a lamp inside a wall; a kit, prop or time the game lacks), the 3D view (draws
through the world builder).

**Interfaces:**
- Consumes: `dressSector`, `buildWorld`, `checkReads` (tasks 7.2, 7.3, 9.2).
- Produces: edit commands `furnishAs(room, kit)`, `placeProp(use, at)`, `placeLamp(kind, at)`, `setTimeOfDay(name)`,
  `setWallTrim(wall, trim)`, `setWindows(wall, grid)`, each `EditCommand` with a `label`.

- [ ] **Step 1:** For each change, in order: a failing unit test of its command (`undo restores the level byte for
  byte`; the label "Furnish as Office"), its DOM test, its canvas test; then the code. A level naming a kit the game
  lacks shows "This room asks for furniture this game doesn't have: Spaceship." **Step 2:** all PASS. **Commit**
  `feat(levels-3d): furnish rooms, place props and lamps, pick the time of day`

### Task 16.3: Plan, 3D and Walk in the game's look (spec 6, 10.3)

**Source files:** EnvironmentBuilder `src/features/view/{view-frame,readability}.ts`; `render.ts` and `fp.ts` for
their camera and framing rules only.

**Files:**
- Create: `packages/editor-3d/src/features/levels-3d/views/{plan,diorama,walk}/`, `views/shared/{frame-map.ts,
  readability.ts}`, `tooling/frame-budget/stress/3d-editor/` with projects `frame-budget-3d-editor-{phone,ipad}`
- Modify: `features/levels-3d/{plan,dollhouse,walk}/` draw through these views; Walk's hint
- Test: `tests/unit/levels-3d/views/{frame-map,readability}.test.ts`, canvas and layout tests

**Interfaces:**
- Produces: `frameMap(level: AfSector2, view: 'plan' | 'diorama' | 'walk', viewport: Rect): Camera3d`;
  `readsAgainst(figure: FigureView, room: WorldView, camera: Camera3d): { reads: boolean; contrast: number }`.

- [ ] **Step 1: Write the failing tests** (the source's framing and readability cases; `Walk says "Wick is hard to see
  here" when a figure does not read`). **Step 2:** FAIL. **Step 3:** the three views. **Step 4:** unit, canvas and
  layout PASS in Chromium; the budget page skips on software. Rows (*rewritten: editor views*). **Commit**
  `feat(levels-3d): the plan, diorama and walk views in the game's look`

## Phase 17: Characters redesigned (PR `claude/3d-studio-redesign`)

### Task 17.1: The frame, phone first (V5; **session break** after the top bar)

**Files:** Modify `packages/editor-3d/src/features/studio/` (shared top bar; on a phone Undo and Redo in the menu, one
Panels button, Dock gone, Save for Publish; stage on top, the timeline a bottom sheet; on-screen name Characters).
Delete task 1.5's `.fails`. Test `tests/browser/layout/studio.layout.test.ts`.

- [ ] **Step 1:** Remove `.fails` → FAIL (Publish clipped). **Step 2:** top bar. **Session break here if needed.**
  **Step 3:** stage and sheet. **Step 4:** PASS at every size; Save visible at 390 × 844. **Commit** `feat(studio): the
  approved look; Save fits on a phone`

### Task 17.2: New sliders, actions and words

**Files:** Modify `features/studio/look/` (phase 6's controls, words at each slider end), `features/studio/animate/`
(actions as clips), names instead of ids (C9), thumbnails drawn by Pixi 3D into a render texture; plan IDs and source
names out of `packages/editor-3d` and `packages/editor`; root `package.json` (`source-names --code` covers every source
folder). Test `tests/dom/studio/*`, a thumbnail canvas test.

- [ ] **Step 1: Write the failing tests**: `each new control has its role and name`; `a slider's ends say "Thin" and
  "Heavy"`; `actions list by name`. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS; `pnpm source-names`
  passes repository-wide. **Commit** `feat(studio): every slider the figures have, in words`

## Phase 18: Copy and real journeys (PR `claude/3d-editor-journeys`)

### Task 18.1: The copy pass (C1 to C9)

**Files:** Modify every string of spec 11 and the rest the pass finds; create
`features/levels-3d/checks/messages.ts`; `docs/refactor/copy.md` "3D editors". Test
`tests/unit/levels-3d/checks/messages.test.ts`, `tests/dom/copy.dom.test.ts`.

**Interfaces:**
- Produces: `problemSentence(issue: ZodIssue, level: AfSector2): { room: string; text: string }`.

- [ ] **Step 1:** Read every screen at the four sizes with the drunk grandma test; list each failure in `copy.md`.
- [ ] **Step 2: Write the failing tests**:

```ts
it("turns a schema error into a sentence naming the room", () => {
  expect(problemSentence(issueAt(['sectors', 0, 'floor'], 'expected number'), level)).toEqual({
    room: 'Room 1', text: "Room 1's floor height isn't a number. Open the room and type a number." })
})
it('no screen shows a format id, a path, a plan ID or a source name', () => { /* every fixture screen */ })
```

- [ ] **Step 3:** FAIL, the words, PASS. **Commit** `feat(editors): plain words in the 3D editors`

### Task 18.2: Journeys against the real command (T2; **session break** after the harness)

**Files:** Create `packages/editor-3d/tests/journeys/real/{harness.ts,levels.journey.ts,characters.journey.ts,
phone.journey.ts}`.

**Interfaces:**
- Produces: `startRealEditor(): Promise<{ url: string; gameUrl: string; folder: string; stop(): Promise<void> }>`
  (copies base-3d to a temporary folder, starts `automata editor` and the game's dev server on free ports, stops only
  what it started).

- [ ] **Step 1:** The harness, with a test that `stop()` leaves no process and no folder. **Session break here if
  needed.** **Step 2:** spec 10.4's journeys, failing where the product lacks a hook (each fixed as a product bug with a
  test). **Step 3:** PASS in Chromium, WebKit on the runner. Part C's done check: spec criteria 8 to 13. **Commit**
  `test(editors): journeys from the editor to the game`
- [ ] **Step 4:** Merge part C's PRs in stack order once green. Part D starts after.

---

# Part D: the site and the release

## Phase 19: The site's 3D pages (PR `claude/3d-site`)

### Task 19.1: Behind the switch (W1)

**Files:** Modify `site/src/shared/framework/examples.ts`, `site/src/features/home/`, `site/src/features/editor/`,
`site/src/features/docs/`, `site/src/features/api/`, `site/vite.config.ts` (`AF_SITE_3D`). Test the site's scan, the
visitor's journey with the switch on, the site's browser gates on the new pages.

- [ ] **Step 1: Write the failing tests**: `with the switch off the build has no 3D route and no @pixi/3d byte`; `with
  it on, Home plays Ember Hall and the 3D editor opens the sample`. **Step 2:** FAIL. **Step 3:** the pages in the
  site's look. **Step 4:** the Chromium suite passes off and on; the visual audit's script reruns for the new pages,
  each read with the drunk grandma test. **Commit** `feat(site): 3D beside 2D, behind the beta switch`

## Phase 20: The release (PR `claude/3d-release`; merged only on the Owner's trigger)

### Task 20.1: Written and rehearsed now (audit note 21)

**Files:** Modify the `package.json` files that take `@pixi/3d`, `packages/3d/package.json` (public; `files` leaves out
`assets/`), `.changeset/config.json` (`@automata/3d` joins the `fixed` group), `packages/tools` (packs the full suite;
the closed-beta scan's refusal lifted for npm `@pixi/3d`), `ship prepare`, the site deploy (`AF_SITE_3D=1`),
`create-game` (the 3D template without `AF_BETA_3D`), a `patch` changeset. Delete `vendor/pixi-3d`.

- [ ] **Step 1: Write the failing test** `@automata/3d is in the changesets fixed group` in
  `tooling/release/tests/unit/`. **Step 2:** FAIL; the change; PASS.
- [ ] **Step 3:** Rehearse against a local registry (Verdaccio), the vendored tarball standing in for npm: the 3D
  stranger's journey passes from the registry.
- [ ] **Step 4:** Leave the PR open with "Waits for Pixi 3D's public release" at the top. The trigger is the Owner's
  (D8).

---

## Done (stage 4's last step)

Every row of the tracking table is done except 20.1's merge; `progress.md` says so; spec criteria 1 to 14 and 16 pass
with the commands in each part's done check; 15 and 17 wait on the release.

## Self-review (writing-plans, 2026-11-07)

1. **Spec coverage:** spec 5 → phase 1; 6 → 6.3, 8.1, 8.2, 13.3, 16.3; 7 → 2.1, 2.2; 8.1 → 6.2; 8.2 → 6.4, 6.5; 8.3 →
   6.3, 7.4; 8.4 → 6.1, 9.2, 10.2; 9 → 7.1 to 7.3, 9.1; 10.1 → 15.1 to 15.4; 10.2 → 4.1, 14.1, 14.2; 10.3 → 16, 17;
   10.4 → 18.2; 11 → 11.2, 18.1; 12 → 19.1, 20.1; 1.3 → 3.1; 1.6 → 5.1 to 5.3; 1.16 → 10.1, 13.2, 17.2. No gap.
2. **Step scan:** every test step names its test and assertions; every code step its file and signature; the two
   one-off scripts (`convert-builder-maps`, `remap-palette`) have tests because the next pull reuses them.
3. **Type consistency:** `AfSector2`, `WorldPiece`, `Key`/`Ease`/`sample`, `TimeOfDay`, the five `register*`, `Look`,
   `checkReads` and `findCovered` are defined once (tasks 7.1, 7.2, 6.3, 6.4, 8.2, 9.2, 1.5) and used by those names.
4. **Review Focus:** five lines, each with its test in the owning task (7.1, 7.2, 6.4, 7.3 and 16.2, 16.1).
5. **Proportion:** the plan is about three times the spec's length, because it carries 53 tasks' file lists and
   interfaces; code blocks are tests only, no function bodies.

## Audit notes folded in

Each of the paused audit's 21 findings, and where it went: 1 → 1.1; 2 → 1.2; 3 → 2.1's map (camera sim); 4 → spec 7,
2.1, 2.2; 5 → 2.1's importer list; 6 → 3.1, spec 15.15; 7 → 6.4, 6.5, spec 8.2; 8 → 6.2 (base pair), 6.4 (registries'
sources); 9 → 6.3, spec 6; 10 → spec 9's table, 7.1; 11 → spec 8.4, 9.2, 8.2's `look-sheet.ts`; 12 → 7.2; 13 → 9.1,
spec 9 and 15.9; 14 → 8.2's entry test, spec 6; 15 → 13.3, 16.3; 16 → 5.1, spec 14; 17 → 1.5; 18 → 11.1, spec 15.14;
19 → 6.3 writes under `src/content/` and 11.1 moves it, `--plan-comments` only in 10.1, 8.2 names `sprite-light.ts`;
20 → the named breaks in Global Constraints; 21 → 20.1.

## Execution log

(One two-line entry per session: what was done, where to resume.)
