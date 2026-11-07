# 3D Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task,
> with superpowers:test-driven-development for every code change and superpowers:verification-before-completion before
> ticking a box. The plugin's default, subagent-driven-development, is not used: the Owner allows no subagents, ever
> (no Task-tool delegation, no workflows), and the user's rule wins over the skill. Steps use checkbox (`- [ ]`)
> syntax. Tick a step only when its check has passed, in the same session.

**Goal:** AF ready to ship 3D: one feature-grouped `@automata/3d` package holding everything from both builders, drawn
by Pixi 3D in their pixel-art look on DUEL; Ember Hall edited in one redesigned suite on a phone, an iPad or a
computer; the site showing 3D beside 2D; the release written and waiting for Pixi 3D.

> **Scope trim (Owner, 2026-11-07 19:28: "Make sure we're not overscoping 3D, it should be as lightweight as 2D,
> everything else should go into plus"; 19:31: "we aren't just moving stuff around right?").** Core is as light as 2D
> core: it draws the game's own data and ships no ready-made library. Libraries, furnishing, generators, the photo
> pipeline, the sky and rain, and the extra clothes and hairstyles go to `@automata/world-kit` and
> `@automata/character-kit` in the Plus port. The ruling, the refactor findings R1 to R11 and the port's addendum are in
> [2026-11-07-3d-scope-trim.md](2026-11-07-3d-scope-trim.md). Task numbers are kept; 9.1 and 9.2 moved to the port, 7.5
> and 7.6 are new, so there are still 53. Where a task below and the trim document differ, the trim document wins.

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
- Changesets: `patch` only; only published packages (the `fixed` group: `@automata/framework`, `@automata/content`,
  `@automata/sim`, `@automata/tools`). `automata create-game` is a command of `@automata/tools`, not a package.
  `@automata/3d` gets none until phase 20.
- After changing a published package's exports or doc comments: `pnpm build`, then `pnpm api-report --update` and
  `pnpm api-index --write` (it rewrites the cheatsheet and the agent package's API reference), and commit what they
  write (AGENTS.md). There is no `pnpm cheatsheet` and `agent-skills` has no `--write`.
- Files under `packages/*/src` stay at or under 600 lines; split by responsibility.
- Every user-facing string changed goes in `docs/refactor/copy.md` ("3D editors" or "Base 3D"), old and new, and passes
  the drunk grandma test: could a drunk grandma tell what is happening and how to use it?
- Touch targets 44 px, primary actions 48 px; corners from `--edge-sm/md/lg`, never a pill.
- Ported code: read only FigureBuilder `025ffb4` and EnvironmentBuilder `6d82a52`; every ported file gets a row in
  `docs/provenance/sources.md`; no file outside `docs/` records names a source project or a plan ID.
- Visual changes: expected, actual and diff images opened and every change explained in the PR; acceptance recorded
  under "Auto approve all visual acceptance too" (Owner, 2026-10-30).
- `--features` holds for `packages/3d` from task 2.2 on: a feature imports only itself, `shared/` and packages; what
  two features use is `shared/`; `app/` composes. A new file that would import another feature goes in `app/` (spec 7).
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
4. **A level naming a prop, swatch, time of day or extension the game does not have:** `automata check` and Levels 3D
   both say which name and where; the game draws the room bare rather than failing to start, and never fills it some
   other way. Tests in tasks 7.3 (`an unknown prop is reported and the room still draws`, `a room asking for the world
   kit draws bare and says so`) and 16.2.
5. **The phone keyboard or browser bar changing the height mid-edit** (an inspector number field focused at 390 ×
   844): the compact layout stays compact, the field stays visible, Save stays whole. Test in task 16.1:
   `keyboard occlusion keeps compact layout and the focused field`.

## Tracking

`docs/refactor/progress.md`'s "3D" slice gets one row per task during stage 4; the build's percentage is `done tasks /
53`. At the end of each task set its row to "Done, <date>, <engines run>", recompute both percentages, and commit with
the task.

## Changes from the automata-skills plan (PR #446, skills spec section 7; relayed 2026-11-07 11:48)

Apply each when the task is reached, and tick it in the execution log:

- [ ] **13.2:** drop the 3D skills and the 3D API reference from `agents/` (they return in 20.1).
- [ ] **20.1:** add them when `@automata/3d` goes public. A new test fails on any unpublished package named in `agents/`.
- [ ] **10.1:** keep a single environment-builder pattern, since skills task 2.4 may add it first.
- [x] **5.1:** add one "How it looks" skill line.
- [ ] **5.2:** add create-game's template colours (`0xffc825`, `0x64748b`) to its file list.
- [ ] **11.1:** delete `ROLE_LAYOUT_GAMES` and the hook's role list.
- [ ] **13.1:** keep the editor skill at "2D level files" until phase 20.

## Notes from the automata-plus audit (PR #40, relayed 2026-11-07 11:49)

Decided by the Owner (2026-11-07 15:05): Plus becomes AF extensions, and the sim part of the level and the stage move to the Plus port (see the Plus port spec (`2026-11-07-plus-port-spec.md`, AF PR #457) section 9, which holds the exact changes to this plan). X1 is settled: `shared/level/sim/` and `simLevel()` are not built here (the `sectors` extension); task 7.4's stage is cut down to the piece states (the `cutscenes` extension builds the director and the `stage-script` kind). X2 (`shared/timeline/`): Plus's `cutscenes` is a
fourth keyed-time model; core's timeline owns keys and eases, so the design stands. X3 (task 4.1): deleting
`blockout` breaks Plus's `pipe blockout`; agreed (D3). X4: keep the 12 names Plus imports from sector-format's root
(`SectorDef`, `WallDef`, `Corner`, `Trim`, `STEP`, `WALL_THICK` and others) exported from `@automata/3d/level` with the
same shapes where af-sector/2 allows.

Also from the automata-skills build (relayed 12:14): its part 2 puts the second builder's name
(`environment[\s_-]?builder`, last entry) in `tooling/repo-hygiene` `SOURCE_NAMES` and scans `.md`/`.ts`/`.mjs`/`.json` under
`agents/`; task 10.1 keeps one pattern and adds only what is missing. Task 13.2 puts no 3D skill text in `agents/automata`
before phase 20: `tooling/agent-skills` `published-only.test.ts` fails on any unpublished `@automata/*` package named
there (details: skills spec section 7).

## Builders' checkouts

Clone both at the recorded commits beside the checkout: `git clone https://github.com/mcthaydt/figurebuilder
../FigureBuilder` and `…/environmentbuilder ../EnvironmentBuilder`; `git -C ../FigureBuilder checkout 025ffb4` and
`git -C ../EnvironmentBuilder checkout 6d82a52`. Tools used below: the module mover `node
tooling/codemods/src/move-modules-cli.ts --map <map> [--dry-run]`; the test mover `node tooling/codemods/src/cli.ts
<package> --environment node|jsdom [--browser-folders] [--feature-folders] [--keep-qualifier <test file>] [--dry-run]`.

---

# Part A: the 3D core

## Phase 1: The 3D gate runs and is green (PR `claude/3d-gate`)

### Task 1.1: Every unit test in the gate (spec 5)

**Files:**
- Modify: `package.json` (`check` runs `pnpm test:unit` in place of `pnpm test:unit:2d`; `ci:local` adds
  `pnpm test:browser:3d`, `pnpm test:journeys:3d`, `pnpm test:e2e --filter @af-games/base-3d --filter
  @af-examples/examples-3d`), `.github/workflows/ci.yml:113` (`pnpm test:unit`), `AGENTS.md` (the "2D gate" line under Packages and features: the
  gate runs every unit test, and `3d.yml` runs the 3D browser suites and journeys),
  `docs/status.md`
- Test: `tooling/repo-hygiene/tests/unit/gate-scripts.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm check` and the hosted core job run the 3D unit tests (every later task's gate).

- [x] **Step 1: Write the failing tests**

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

- [x] **Step 2: Run, expect FAIL**: `pnpm --filter @automata/repo-hygiene exec vitest run
  tests/unit/gate-scripts.test.ts` → the three fail on today's scripts.
- [x] **Step 3: Change the scripts and `ci.yml`.**
- [x] **Step 4: Run, expect PASS**; then `pnpm check` passes with the 3D unit tests (record the count; the audit had
  3,836).
- [x] **Step 5: Commit** `ci(gate): every unit test in pnpm check and the hosted core job`

### Task 1.2: Three 3D jobs and #425's timeout fix (spec 5)

**Files:**
- Modify: `.github/workflows/3d.yml` (drop the `3D - unit` steps; merge the editor's journeys into `3D - journeys`;
  `paths` gains `vendor/pixi-3d/**`, keeps every current entry), `package.json` (every `test:browser*` script:
  `--concurrency=2`, `--hookTimeout=90000`)
- Test: `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts`, `gate-scripts.test.ts`

**Interfaces:**
- Consumes: task 1.1 (the hosted core job runs the 3D unit tests, so `3d.yml` need not).
- Produces: the job names `3D - journeys`, `3D - parity (chromium, webkit, firefox)`, `base-3d through game-ci`.

- [x] **Step 1: Write the failing tests**

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

- [x] **Step 2: Run, expect FAIL** (four jobs; concurrency 3).
- [x] **Step 3: Take #425's hunks** (`git diff origin/claude/project-thread-xe0752...origin/claude/project-thread-ajhkmg
  -- package.json tooling/repo-hygiene/tests/unit/gate-scripts.test.ts`), then edit `3d.yml`.
- [x] **Step 4: Run, expect PASS**; `pnpm lint:actions` if Docker runs, else a YAML parse and "actionlint: the
  Owner's" in the log.
- [x] **Step 5: Commit** `ci(3d): three jobs, browser runs at concurrency 2`; then comment on #425 that the fix is
  carried here and close it.

### Task 1.3: One scroll region per dialog (the seven `open-flows` failures)

**Files:**
- Modify: `packages/editor-3d/src/ui/document/ErrorPanel.svelte`, its dialog caller,
  `packages/editor-3d/src/ui/document/open-flows.layout.test.ts`
- Test: `packages/editor-3d/src/ui/document/ErrorPanel.dom.test.ts` (exists; the new case goes in it; it moves to
  `tests/` in task 14.1)

**Interfaces:**
- Produces: `ErrorPanel` prop `inDialog?: boolean` (default `false`).

- [x] **Step 1: Write the failing test**

```ts
it('declares no scroll region of its own inside a dialog', () => {
  render(DialogWithErrors, { problems: forty })
  expect(document.querySelectorAll('[role=dialog] [data-scroll-region]')).toHaveLength(1)
})
```

- [x] **Step 2: Run, expect FAIL** (2 regions).
- [x] **Step 3: Add `inDialog`; the dialog caller passes it; the layout test reads the list by
  `getByRole('list', { name: /problems/i })`.**
- [x] **Step 4: Run** `npx vitest run --project 'layout (chromium)' src/ui/document/open-flows.layout.test.ts` in
  `packages/editor-3d` → 7 pass, and the DOM test passes.
- [x] **Step 5: Commit** `fix(editor-3d): one scroll region in the open-problems dialog`

### Task 1.4: The plan clear of the sheet (the Pencil failure)

**Files:**
- Modify: `packages/editor-3d/src/app/plan-controller.ts`, `packages/editor-3d/src/ui/plan/PlanCanvas.svelte` (reads the
  usable rectangle from the kit's geometry owner), `packages/editor-3d/src/ui/plan/sector-tools.layout.test.ts`
- Test: `packages/editor-3d/src/app/plan-controller.test.ts`

**Interfaces:**
- Produces: `fitToRoom(room: Bounds, usable: Rect): PlanView` in `plan-controller.ts`; the page exposes the usable
  rectangle as `data-usable="x y w h"` on the plan stage for tests.

- [x] **Step 1: Write the failing test**

```ts
it('fits the room inside the area the sheet and tools leave', () => {
  const view = fitToRoom(room10x6, { x: 0, y: 56, width: 744, height: 420 })
  expect(projectedBounds(view, room10x6)).toBeWithin({ x: 0, y: 56, width: 744, height: 420 })
})
```

- [x] **Step 2: Run, expect FAIL.** **Step 3: Implement**; the layout test draws inside `data-usable`.
- [x] **Step 4: Run** the editor-3d Chromium set → 195 pass, 0 fail (187 + 8).
- [x] **Step 5: Commit** `fix(editor-3d): fit the plan to the area the sheet and tools leave`

### Task 1.5: Every action whole and uncovered (spec 5; audit note 17)

**Files:**
- Modify: `packages/automata/src/testing/layout/assertions.ts` (add `findCutByBar` and `findCovered`),
  `packages/automata/src/testing/ui/layout-contract.ts` (`checkLayout` calls both with `BAR_ACTIONS`), `packages/automata/src/entries/testing-fixtures.ts` (export `findCovered`), regions in
  `packages/editor` and `packages/editor-3d` that lack `data-region`
- Test: `packages/automata/tests/browser/ui/actions-inside.test.ts`

**Interfaces:**
- Consumes: `visibleControls`, `nameOf` and `findCoveredCorners`' rule for what may cover a control (a modal dialog,
  which makes the page inert, and an ErrorPanel that had to rise) from the same files. `findClipped` is not the tool:
  it measures a node's own vertical overflow (`scrollHeight > clientHeight`), so a button its bar cuts across is never
  seen by it.
- Produces: `findCutByBar(root: ParentNode, selector: string): string[]` (a control whose box runs past the box of an
  ancestor that clips its overflow and is not a declared scroll region); `findCovered(root: ParentNode, selector:
  string): string[]` (`elementFromPoint` at the control's centre is not the control or inside it, with the same
  exceptions as `findCoveredCorners`); `BAR_ACTIONS =
  '[data-region=topbar] :is(button,a,[role=tab],[role=menuitem]), [data-region=rail] :is(…), [data-region=panel]
  :is(…), [data-region=dock] :is(…), [data-region=tools] :is(…)'`.

- [x] **Step 1: Write the failing tests**

```ts
it('reports a bar button its bar clips', () => {
  mount(`<div data-region="topbar" style="width:120px;overflow:hidden;display:flex">
    <button style="flex:none;width:100px">Back</button><button style="flex:none;width:80px">Publish</button></div>`)
  expect(checkLayout(phone, [])).toContainEqual(expect.stringContaining('Publish'))
})
it('lets a modal dialog cover the bar', () => {
  mount(`<div data-region="topbar"><button>Save</button></div><dialog open aria-modal="true" style="position:fixed;inset:0"></dialog>`)
  expect(findCovered(document.body, BAR_ACTIONS)).toEqual([])
})
it('reports a bar button another element covers', () => {
  mount(`<div data-region="topbar"><button>Save</button></div><div style="position:fixed;inset:0"></div>`)
  expect(findCovered(document.body, BAR_ACTIONS)).toEqual([expect.stringContaining('Save')])
})
```

- [x] **Step 2: Run, expect FAIL.** **Step 3: Implement.**
- [x] **Step 4: Run** both editors' layout suites in Chromium: only the Studio's phone portrait fails (Publish, T5);
  mark it `.fails` with the comment "Publish is clipped on a phone until the Characters redesign"; any other failure
  is fixed here.
- [x] **Step 5:** `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`; changeset `patch` for
  `@automata/framework`. **Commit** `test(layout): every action in a bar is whole and uncovered`

### Task 1.6: The 3D editor's journeys in Chromium

**Files:** Modify `packages/editor-3d/vitest.config.ts` (the journeys project lists Chromium and WebKit through
`packages/editor/src/testing/kit/journey-project.ts`).

- [x] **Step 1:** Run `pnpm --filter @automata/editor-3d test:journeys` before the change → only WebKit is listed
  (record). **Step 2:** change the project. **Step 3:** run → 3 journeys pass in Chromium; a Chromium-only failure is a
  product bug fixed with its own test. **Step 4: Commit** `test(editor-3d): journeys run in Chromium too`

### Task 1.7: Paraglide never empties its folder (T6)

**Files:**
- Modify: `packages/content/src/shared/locale/compile-messages.ts:89` (`compileInFolder`)
- Test: `packages/content/tests/unit/shared/locale/compile-messages.test.ts`

**Interfaces:**
- Produces: `syncFolder(from: string, to: string): Promise<{ written: number; removed: number }>` in
  `packages/content/src/shared/locale/sync-folder.ts`; `compileInFolder` compiles to `${folder}.next-<pid>` then calls it.

- [x] **Step 1: Write the failing tests**

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

- [x] **Step 2: Run, expect FAIL.** **Step 3: Implement `syncFolder` and use it.** **Step 4: Run, expect PASS**; then
  base-3d's browser projects three times in a row → no "Could not load src/paraglide".
- [x] **Step 5:** changeset `patch` for `@automata/content`. **Commit** `fix(content): compile messages without
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
  `docs/adr/0002-*.md`, `vendor/pixi-3d/README.md`, root `package.json` (`boundaries` sim list,
  `--forbid packages/editor:@pixi/3d,@automata/editor-3d,@automata/3d`, the `:3d` filters name `./packages/3d`),
  and every `!./packages/{render-pixi3d,figures,sector-format}` filter of `test:unit:2d`, `test:browser:2d` and
  `test:browser:affected`, `knip.jsonc`, `turbo.json`, `.github/workflows/3d.yml`, `.gitleaks.toml`,
  `.vscode/settings.json`, `site/tests/unit/playground/runtime/playground-{catalog,resources}.test.ts`,
  `tooling/repo-hygiene/tests/unit/secret-scan.test.ts` (each names a moved path; `git grep -l -E
  "render-pixi3d|sector-format|automata/figures"` is empty outside `docs/` records afterwards)

The map (every source file appears once; spec 7's tree):

The map is drawn from today's imports, so `--features` holds after it (stage 3 audit): the render views import the
light, the model loader imports the shared material, and the figure view, the camera driver and the occluders import
the render views, so those three folders are `shared/render/`; the occluders import the camera nine times, so they are
the camera's; `create-pixi3d-renderer.ts` imports the camera, the occluders, the light and the models, so it is `app/`.

| From | To |
|---|---|
| `render-pixi3d/src/renderer/create-pixi3d-renderer.ts` | `3d/src/app/create-renderer.ts` |
| `render-pixi3d/src/render3d.extension.ts`, `figures/src/figures.extension.ts` | `3d/src/app/` |
| `render-pixi3d/src/index.ts`, `camera-view.ts`, `no-eval.ts`; `figures/src/index.ts`; `sector-format/src/index.ts` | `3d/src/entries/{index,camera-view,no-eval,figures,level}.ts` (only re-exports) |
| `render-pixi3d/src/renderer/context-loss.ts`, `no-eval/*`, `bundle/testing/*` | `features/renderer/` (`bundle/testing` to `testing/bundle/`) |
| `render-pixi3d/src/{views,model,light}/*` | `shared/render/{views,model,light}/` |
| `render-pixi3d/src/camera/*` | `features/camera/` |
| `render-pixi3d/src/occluders/*` (with `occluders/testing`) | `features/camera/occluders/` |
| `render-pixi3d/src/sim/*` (camera heading: component, plugin, turn command and system, view schema, heading, stick mapper, view latch) | `features/camera/sim/` |
| `render-pixi3d/src/figure/*` (meshes, colour, skin, joints, decals, view) | `features/figures/view/` |
| `render-pixi3d/src/{css,env}.d.ts` | `packages/3d/src/` (type declarations, no feature) |
| `figures/src/{genes,parts,rig}` | `features/figures/body/` |
| `figures/src/{motion,pose,solve}` | `features/figures/motion/` |
| `figures/src/hair` | `features/figures/hair/` |
| `figures/src/{garments,streetwear}` | `features/figures/outfit/` (streetwear leaves in task 6.5) |
| `figures/src/{build,figure}` | `features/figures/figure/` (`garment.schema.ts`, `garment-defaults.ts`, `figure.schema.ts` among them) |
| `figures/src/{clip,evaluate}` | `features/figures/clips/` (keys and eases go to `shared/timeline/` in task 6.3) |
| `figures/src/{library,content}` | `features/figures/content/` |
| `figures/src/math`, `render-pixi3d/src/parity` | `shared/math/`, `shared/parity/` |
| `sector-format/src/*` | `shared/level/` |
| `sector-format/blockout/*` | `shared/level/blockout/` (deleted in task 4.1) |
| `*/src/testing/*`, `*/src/*/testing/*` | `testing/` (`public.ts` re-exports what `./testing` published); `figures/src/testing/__goldens__/` and `fixtures/` are test data and go to `tests/fixtures/` in task 2.2 |

**Interfaces:**
- Produces: `@automata/3d` entries `.`, `./sim`, `./level`, `./figures`, `./camera-view`, `./no-eval`, `./testing`;
  `"automata": { "simEntries": ["./sim"] }`; `private: true`. Every former export keeps its name.

- [x] **Step 1:** Record counts: `pnpm test:unit:3d`, and `npx vitest run --project 'browsers (chromium)'` in each of
  the three packages (parity 17, goldens 24).
- [x] **Step 2:** Write the map; `--dry-run` → no unresolved specifier, no clash. **Session break here if needed.** (390 files move, 1 duplicate removed, 232 files change text; sector-format's `blockout/` was `git mv`ed under `src/` first, since the mover only reads `src/` and `tests/`)
- [x] **Step 3:** Run the mover; one import style (`.ts` specifiers; S9). The renderer's imports of the figures go
  through `app/compose-scene.ts` (`composeScene(renderer, figureViews, look)`), so no feature imports another.
  AGENTS.md: rule 5's "The 3D renderer keeps Effect until the 3D phase" stays until task 3.1, which deletes it.
- [x] **Step 4:** `pnpm install`, `pnpm typecheck`, `pnpm test:unit:3d` → the counts of step 1. `pnpm boundaries`
  with `packages/3d/src/features/camera/sim packages/3d/src/shared/level packages/3d/src/entries/sim.ts` in the sim list.
- [x] **Step 5: Commit** `refactor(3d): one @automata/3d package from render-pixi3d, figures and sector-format`

### Task 2.2: Tests in `tests/`, the feature rule on (**session break** after the mover)

**Files:**
- Move: every `*.test.ts` under `packages/3d/src` → `packages/3d/tests/{unit,browser}/…` with `#src/…` imports
- Modify: root `package.json` (`boundaries --features packages/3d`; `style --test-imports packages/3d`; the
  `--plan-comments` for `packages/3d` is added in task 10.1), `packages/3d/vitest.config.ts` (projects by folder)

- [x] **Step 1:** `node tooling/codemods/src/cli.ts packages/3d --environment node --browser-folders --feature-folders
  --dry-run`, then for real (`--browser-folders` sorts `.parity`, `.layout`, `.canvas` and `.journey` tests into their
  folders; `--keep-qualifier` takes a test file's path, only for a clash the dry run names). `__goldens__/` and the
  content fixtures move to `tests/fixtures/` by hand in the same commit. **Session break here if needed.**
- [x] **Step 2:** `pnpm boundaries` → `--features packages/3d` finds 0 (a finding is fixed by moving the shared part to
  `shared/` or composing in `app/`, never by an exemption).
- [x] **Step 3:** `pnpm test:unit:3d` and `npx vitest run --project 'browsers (chromium)'` in `packages/3d` → parity
  17, goldens 24. **Commit** `refactor(3d): tests in tests/, feature boundaries on`

---

## Phase 3: Effect out of the 3D package (PR `claude/3d-no-effect`)

### Task 3.1: The renderer in plain TypeScript (S4; audit note 6)

**Files:**
- Modify: the four source files that import `effect` (`app/create-renderer.ts`, `features/renderer/context-loss.ts`,
  `features/renderer/load-models.ts`, `testing/compile-fixture.ts`) and the five tests; `packages/3d/package.json` and
  `games/base-3d/package.json` (drop `effect`); `packages/automata/src/entries/testing.ts` (export `fakeClock`,
  `FakeClock`); `AGENTS.md` (rule 5 loses "The 3D renderer keeps Effect until the 3D phase")
- Test: `packages/3d/tests/unit/no-effect.test.ts` (temporary), the rewritten renderer and context-loss tests

**Interfaces:**
- Consumes: `Clock`, `disposables(): Disposables` from `@automata/framework`; `fakeClock(): FakeClock` from
  `@automata/framework/testing` (newly public).
- Produces: `createRenderer(options: RendererOptions & { clock?: Clock }): Promise<Renderer3d>` where `Renderer3d`
  has `dispose(): void`; `watchContextLoss(canvas, clock, onLost): () => void`.

- [x] **Step 1: Write the failing test**

```ts
it('no 3D source imports effect', () => {
  expect(grepFiles(['packages/3d/src', 'games/base-3d/src'], /from 'effect'/)).toEqual([])
})
```

- [x] **Step 2: Run, expect FAIL** (4 files). **Step 3:** rewrite each: `Scope` → `Disposables`, `Effect.gen` →
  `async`, time through `Clock`; tests use `fakeClock()`.
- [x] **Step 4: Run** unit and Chromium parity → PASS. Replace the grep test with `--forbid packages/3d:effect` and
  `--forbid games/base-3d:effect` in `boundaries`; delete the grep test.
- [x] **Step 5:** `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write` for `@automata/framework`,
  changeset `patch`. **Commit** `refactor(3d): the renderer without Effect`

---

## Phase 4: Cuts (PR `claude/3d-cuts`)

### Task 4.1: The source game's level format goes (D3)

**Files:**
- Delete: `packages/3d/src/shared/level/blockout/`, the `./blockout` export, `packages/editor-3d/src/format/`,
  `src/profile/last-light-*`, `src/checks/facility/`, `src/checks/last-light/`, `src/model/facility-*`,
  `src/testing/{toy-blockout,shipped-facility}.ts` and their tests
- Modify: `packages/editor-3d/src/profile/registry.ts` (one profile, a plain import), every `format/` importer (to
  `@automata/3d/level`), `docs/provenance/sources.md` (the deleted files' rows: "removed 2026-11, D3")

- [x] **Step 1:** `grep -rln "blockout\|facility\|last-light" packages/editor-3d/src packages/3d/src` → the list; record
  the test counts. **Step 2:** delete; `pnpm typecheck` and `pnpm knip` find the rest. **Step 3:** editor-3d unit and
  Chromium layout pass; the counts drop by exactly the deleted tests (record). **Step 4: Commit** `refactor(3d): the
  editor opens af-sector levels only`

### Task 4.2: Goldens recorded from AF's own code (S7)

**Files:**
- Create: `packages/3d/scripts/record-goldens.ts`
- Delete: `packages/3d/scripts/figurebuilder-{,action-,motion-}goldens.ts` (they run the source's code from a checkout)
- Move: `tests/fixtures/__goldens__/figurebuilder-{dress,actions,motion}.json` → `tests/fixtures/goldens/{dress,actions,
  motion}.json`; `src/testing/figurebuilder-hand-on-hip.ts` → `src/testing/hand-on-hip.ts`; the readers
  (`testing/golden-checks.ts`, `testing/motion-goldens.ts`, `clips/actions.test.ts`, `motion/hair-spring.test.ts`) and
  their comments follow (no source name in a path or a comment)
- Test: `packages/3d/tests/unit/goldens-fresh.test.ts`

**Interfaces:**
- Produces: `recordGoldens(outDir: string): Promise<string[]>` (the files written); CLI `node
  packages/3d/scripts/record-goldens.ts [--out <dir>]`, default `tests/fixtures/goldens/` (`GOLDENS`). From here on
  the goldens are AF's record of its own behaviour; a port that moves them re-records them in a named commit with the
  change explained (phase 6).

- [x] **Step 1: Write the failing test**

```ts
it('recording into a temporary folder reproduces the committed goldens', async () => {
  const out = await tempDir(); await recordGoldens(out)
  expect(readTree(out)).toEqual(readTree(GOLDENS))
})
```

- [x] **Step 2: Run, expect FAIL** (no script). **Step 3:** implement. **Step 4: Run, expect PASS**; a difference
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
- [ ] **Step 5:** `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, changeset `patch`. **Commit**
  `feat(content): DUEL is the default palette`

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
  `features/figures/content/swatch-colours.ts`,
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
- Produces: `checkSources(md: string, manifest: Manifest, options?: { complete?: boolean }): string[]` in
  `tooling/repo-hygiene/src/sources-md.ts`; CLI `tooling/repo-hygiene/src/sources-md-cli.ts [--complete]`, root script
  `sources-md`, chained into `source-names` (`... source-names-cli.ts && node .../sources-md-cli.ts`); `--complete`
  makes a missing row an error (turned on in task 10.2).

- [x] **Step 1: Write the failing tests**: `each builder section names a 40-character commit and the pull procedure`;
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
- Produces: genes gain `bust`, `seat`, `eyeSize`, `eyeSpacing`, `eyeTilt` (default 0.5), `bodyAsymmetry` and
  `faceAsymmetry` (FigureBuilder's `asymmetry`; default 0), each `number` in `[0, 1]`, each a no-op at its default;
  the existing `fat` (default 0.4) takes FigureBuilder's newer reading (the limbs, the neck and the jaw swell; every
  multiplier 1 at fat 0); `naturalStand(m: Measure): Pose`, the stand of a figure that names none (spec 8.2).

- [x] **Step 1: Port the tests, failing**, e.g.

```ts
it('fat thickens the limb rings, and fat 0 changes nothing', () => {
  expect(ringRadius(build(basePair.m, { fat: 1 }), 'thighL')).toBeGreaterThan(ringRadius(build(basePair.m), 'thighL'))
  expect(build(basePair.m, { fat: 0 })).toEqual(buildBeforeThePort(basePair.m, { fat: 0 }))
})
it('each new gene at its default leaves the figure as it was', () => {
  for (const [gene, value] of NEW_GENE_DEFAULTS) expect(build(wick, { [gene]: value })).toEqual(build(wick))
})
it('the natural stand puts the head over the shoulders', () => {
  expect(Math.abs(joint(naturalStand(m), 'head').x - joint(naturalStand(m), 'chest').x)).toBeLessThan(0.01)
})
```

- [x] **Step 2:** FAIL. **Session break here if needed.** **Step 3:** port the code. **Step 4:** unit tests pass;
  every slider pushed to both ends builds (`sliders.test.ts`). The new `fat` moves Wick (fat 0.3) and the fixtures with
  fat above 0: re-record with `record-goldens.ts` in its own commit, `test(3d): re-record the figure goldens for the
  new fat`, with before and after contact sheets (`look-sheet.ts` once it lands; until then the parity images) opened
  and explained in the PR. base-3d's replay hash does not move (the sim reads no mesh). **Step 5:** rows. **Commit**
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
- Produces: `interface Key<V> { t: number; value: V; ease?: Ease }` (no ease is linear); `type Ease = 'linear' |
  'step' | 'in' | 'out' | 'inOut' | 'smooth' | readonly [number, number, number, number]` (AF's names and its CSS
  cubic-bezier tuple, which today's clips use, plus `smooth`; `hold` reads as `step`, and a source key's `v` as
  `value`); a clip's content keys stay `{ t, pose, ease? }` and compile to `Key<Pose>`; `sample<V>(track: Track<V>, t: number, mix: Mix<V>): V`;
  `compileAction(action: FigureAction): Clip`; `TimeOfDay { name; scene: { light, haze, grade }; figure: { key, fill,
  bounce }; label: string }` (the editor's words: Day, Golden hour, Dusk, Night, Lamplight, Bar light) and
  `timeOfDay(name: string, overrides?): TimeOfDay`.

- [x] **Step 1: Write the failing tests** (both sources' cases):

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
it('keeps a cubic-bezier ease', () => expect(parseEase([0.4, 0, 0.2, 1])).toEqual([0.4, 0, 0.2, 1]))
it('merges the six times of day', () => {
  expect(TIMES.map((t) => t.name)).toEqual(['day', 'golden', 'dusk', 'night', 'lampLit', 'bar'])
  expect(timeOfDay('dusk').figure.key).toBeDefined()
})
it('each source action compiles to a clip that matches the source actor', () => {
  for (const a of SOURCE_ACTIONS) expect(poseAt(compileAction(a), 0.5)).toBeCloseToPose(sourceActorAt(a, 0.5), 1e-3)
})
```

- [x] **Step 2:** FAIL. **Step 3:** the timeline, then clips read from it (clip tests pass unchanged), then the
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

- [x] **Step 1: Write the failing tests**:

```ts
it('refuses a second registration of a name', () => {
  registerGarment('cape', capeKind)
  expect(() => registerGarment('cape', otherCape)).toThrow('A garment called "cape" is already registered')
})
it('core registers only the classic set', () => {
  expect(registeredGarments()).toEqual(['apron', 'belt', 'cap', 'cape', 'coat', 'eyes', 'gloves', 'hair', 'legs',
    'mark', 'shoes', 'skirt', 'top', 'trousers', 'waistcoat'])
})
it('a cuff hugs the arm at every slider end', () => {
  for (const m of sliderEnds(basePair.m)) expect(cuffRadius(m) - girth(m, 'wristL')).toBeCloseTo(TEXEL, 5)
})
```

- [x] **Step 2:** FAIL. **Step 3:** hair (low pony, bun, fall, curl volume). **Session break here if needed.**
  **Step 4:** fit, seats, the registries; the classic set registered by `figures.extension.ts`; the `figure-headwear`
  kind folds into the garment registry (Wick's cap is `cap`). **Step 5:** unit and goldens pass (Wick unchanged).
  Rows. **Commit** `feat(3d): hair pieces, garments fitted to the body, and the wardrobe registries`

### Task 6.5: Streetwear becomes an example extension (D6, B2; audit note 7)

**Files:**
- Move: `packages/3d/src/features/figures/outfit/streetwear/` → `examples/3d/wardrobe/`, with `wardrobe.extension.ts`
- Modify: `features/figures/figure/garment.schema.ts`, `features/figures/figure/garment-defaults.ts`,
  `features/figures/content/swatch.schema.ts`, `features/figures/outfit/classic.ts` (no streetwear types), `examples/3d/figures/figures-outfits-items.ts`, `examples/3d/package.json` (`test:unit`),
  create `examples/3d/vitest.config.ts`
- Test: `examples/3d/tests/unit/wardrobe.test.ts`; streetwear goldens move to the example

**Interfaces:**
- Consumes: the registries (task 6.4), `defineExtension` from `@automata/framework`.
- Produces: `wardrobeExtension` (default export of `wardrobe.extension.ts`).

- [x] **Step 1: Write the failing test** `a figure in a bomber compiles once the wardrobe extension is set up, and
  fails with "No garment called bomber" without it`. **Step 2:** FAIL. **Step 3:** the move. **Step 4:** `pnpm
  test:unit:3d` and the example's unit test pass; `grep -rn "bomber\|hoodie\|puffer" packages/3d/src` → none.
  **Step 5: Commit** `refactor(3d): the streetwear wardrobe is an example extension`

---

## Phase 7: One level format and the world (PRs `claude/3d-level-2`, `claude/3d-world`)

Ports from `../EnvironmentBuilder` at `6d82a52`, with `sources.md` rows.

### Task 7.1: `af-sector/2` and its migration (spec 9; audit note 10)

**Files:**
- Create: `packages/3d/src/shared/level/af-sector-2.schema.ts` (every row of spec 9's table),
  `af-sector-1-to-2.migration.ts`,
  `packages/3d/scripts/convert-builder-maps.ts` (run in task 7.3)
- Modify: `shared/level/af-sector.schema.ts` (reads `/1` and `/2`, returns `/2`),
  `games/base-3d/src/content/levels/room.af-sector.json` (migrated), `games/base-3d/src/content/levels/sector-area.ts`
  (reads `corners`; pits by flag), `games/base-3d/src/content/room.ts` (`ROOM_VIEWS` leaves code for the file's
  `views`), editor-3d's level readers (open `/1`, write `/2`)
- Test: `packages/3d/tests/unit/shared/level/af-sector-2.schema.test.ts`, `migration.test.ts`,
  `convert-builder-maps.test.ts`; base-3d's golden replay

**Interfaces:**
- Produces: `interface LevelProblem extends Problem { where: string; name?: string }` in
  `shared/level/problem.ts` (`Problem` is `@automata/content`'s `{ path, code, message }`, so `automata check` places it
  in its file); `type AfSector2` and `afSector2Schema`; `readLevel(json: unknown): { level: AfSector2; migrated:
  boolean; problems: LevelProblem[] }`; `migrateAfSector1(level: AfSector): AfSector2`; `convertBuilderMap(plan: unknown): AfSector2`.

- [x] **Step 1: Write the failing tests**

```ts
it('migrates every /1 fixture losslessly', () => {
  for (const f of V1_FIXTURES) {
    const two = migrateAfSector1(f)
    expect(afSector2Schema.parse(JSON.parse(JSON.stringify(two)))).toEqual(two)
  }
})
it('carries zone, masses, and a wall\'s cut and hideFrom through the migration unchanged', () => { /* one assertion per field; `AfWall` no longer omits cut and hideFrom */ })
it('reads a bare-number floor as a plane', () => {
  expect(readLevel(withFloor(1.5)).level.sectors[0].floor).toEqual({ z: 1.5 })
})
it("reads a wall's texture as its surface", () => { /* /1 texture → /2 surface */ })
it('says when a level was migrated', () => expect(readLevel(v1Room).migrated).toBe(true))
it('converts a builder map: rect sectors to corners, sprites to props and cast', () => {
  const two = convertBuilderMap(builderMap('bedroom')) // maps.json: bedroom, neonBar, streetNight, forestClearing, signs
  expect(two.sectors[0].corners).toHaveLength(4); expect(two.props?.length).toBeGreaterThan(0)
})
```

- [x] **Step 2:** FAIL. **Step 3:** the schema, the migration, the converter (the `entries/sim.ts` re-exports only `features/camera/sim`; `simEntries` stays `["./sim", "./level"]`; what the sim reads from a level is the `sectors` extension's, not built here). **Step 4:** PASS; base-3d's
  unit tests (82) and golden replay pass with the migrated room, sim hash unchanged. **Step 5: Commit**
  `feat(3d): af-sector/2, one level format for the game, the editor and the world`

### Task 7.2: The world builder (spec 9; audit note 12; **session break** after mesh)

**Source files:** `src/features/world/{build,sectors,mesh,subdivide,surface,swatches,map,types}.ts`,
`src/lib/{geometry,rng}.ts`.

**Files:**
- Create: `packages/3d/src/features/world/{build,sectors,mesh,subdivide,surface,swatches}.ts`,
  `packages/3d/src/shared/math/geometry.ts` (EnvironmentBuilder `lib/geometry.ts`), `packages/3d/src/app/world-view.ts`
  (draws the pieces; in `app/` because it reads the world's pieces and the renderer's views)
- Modify: `games/base-3d/src/content/levels/sector-area.ts`
  (box room → world pieces; deleted if nothing else reads it), `packages/editor-3d/src/view/mesh/sector-mesh.ts`
  (replaced by the world builder), `app/compose-scene.ts`
- Test: ported `tests/unit/world/{build,mesh,subdivide,surface}.test.ts`; render parity for base-3d's room re-recorded
  once

**Interfaces:**
- Consumes: `AfSector2` (task 7.1); `createRng(seed)` from `@automata/sim` (EnvironmentBuilder's `lib/rng.ts` is not
  ported).
- Produces: `buildWorld(level: AfSector2, library: WorldLibrary): { pieces: WorldPiece[]; problems: LevelProblem[] }`;
  `interface WorldPiece { id: string; sector: string; part: 'floor' | 'ceiling' | 'wall' | 'decor' | 'prop' | 'lamp';
  mesh: MeshData; surface: Surface }`; `drawWorld(scene, pieces): WorldView` in `app/world-view.ts`.

- [x] **Step 1: Write the failing tests** (the source's cases, plus):

```ts
it('reports a degenerate room instead of throwing', () => {
  const { pieces, problems } = buildWorld(levelWith(collinearRoom), LIB)
  expect(problems).toContainEqual(expect.objectContaining({ where: 'room-2' }))
  expect(pieces.every((p) => p.sector !== 'room-2')).toBe(true)
})
it('a sloped floor tilts its plane', () => { /* floor { z: 0, slope: [0.1, 0] } → vertices rise along x */ })
it('an open-sky sector has no ceiling piece', () => { /* ceiling { z: 3, sky: true } */ })
```

- [x] **Step 2:** FAIL. **Step 3:** the builder (build, sectors, mesh). **Session break here if needed.** **Step 4:**
  subdivide, surface, swatches; the renderer draws the pieces; the old box room and `sector-mesh.ts` go.
- [x] **Step 5:** 3D unit, render parity (re-recorded once; expected/actual/diff opened, change explained: the world
  builder replaces the box room) and base-3d's golden replay (unchanged) pass. Rows. **Commit** `feat(3d): the world
  builder draws levels`

### Task 7.3: Props a game places, and lamps (trimmed 2026-11-07; scope trim section 2)

**Source files:** `src/features/world/{props,build}.ts`; `src/features/paint/look.ts` (the lamp kit), `library/look.json`.
The prop library, kits, the dresser, decals, lettering, generated maps and the converter are **not** core: they leave
`packages/3d` in this task (the commit `78e0ca7f` stays on the branch as the source port task 3.7 moves them from).

**Files:**
- Keep (built in `78e0ca7f`): `features/world/{place-props,lamp-kit}.ts`, `features/world/props/{piece,resolve}.ts`,
  `features/world/library/lamp-kit.json`, `features/world/content/{world-prop.schema,world-swatch.schema,world.content}.ts`
- Create: `features/world/props/prop-generator.registry.ts` (`registerPropGenerator`, `propGenerator(kind)`,
  `registeredPropGenerators()`), `features/world/props/primitives.ts` (`box`, `cylinder`, registered by
  `app/render3d.extension.ts`)
- Delete from `packages/3d`: `props/{furniture,nature,signs,small-things,street,generators}.ts`,
  `library/{props,kits,glyphs}.json`, `library/swatches.json` (the swatches the room uses move to
  `games/base-3d/src/content/world-swatches/`), `lettering.ts`, `stream.ts` if only lettering reads it,
  `convert-builder-map.ts`, `scripts/convert-builder-maps.ts`, their tests and their `sources.md` rows (each row says
  *moved to `@automata/world-kit`*)
- Modify: `shared/level/af-sector-2.schema.ts` (`dress` stays a field: the format is one), `features/world/build.ts`
  (a sector with `dress` is drawn bare with a `needs-extension` problem), `games/base-3d/src/content/levels/room.af-sector.json`
  (a few `box` and `cylinder` props from the game's own `world-prop` files, a lamp, a time of day)
- Test: `tests/unit/world/{props,library,prop-registry}.test.ts`

**Interfaces:**
- Consumes: `buildWorld` (task 7.2), `timeOfDay` (task 6.3), `RegistryClash` (task 6.4).
- Produces: `registerPropGenerator(kind: string, generator: Generator): void` (a second registration of a kind throws
  `RegistryClash`); `WorldLibrary { props; swatches }` merged from core's primitives and the game's content; problem
  codes `unknown-prop`, `unknown-generator`, `needs-extension` (`name: 'world-kit'`).

- [x] **Step 1: Write the failing tests**

```ts
it('core registers only box and cylinder', () => expect(registeredPropGenerators()).toEqual(['box', 'cylinder']))
it('refuses a second generator of a kind', () => {
  expect(() => registerPropGenerator('box', otherBox)).toThrow('A prop generator called "box" is already registered')
})
it('an unknown prop is reported and the room still draws', () => {
  const { pieces, problems } = buildWorld(levelWithProp('spaceship'), LIB)
  expect(problems).toContainEqual(expect.objectContaining({ code: 'unknown-prop', name: 'spaceship' }))
  expect(pieces.some((p) => p.part === 'floor')).toBe(true)
})
it('a room asking for the world kit draws bare and says so', () => {
  const { pieces, problems } = buildWorld(levelDressedAs('office'), LIB)
  expect(problems).toContainEqual(expect.objectContaining({ code: 'needs-extension', name: 'world-kit' }))
  expect(pieces.every((p) => p.part !== 'prop')).toBe(true)
})
it("every library entry parses", () => { /* world-prop and world-swatch over core's and base-3d's content */ })
```

- [x] **Step 2:** FAIL. **Step 3:** the registry and the primitives; the deletions. **Step 4:** the room's props and
  swatches in base-3d's content; the `needs-extension` problem, with the words of scope trim section 2. **Step 5:**
  base-3d's unit tests and golden replay pass (hash unchanged: props are presentation); its journeys pass in Chromium;
  images in the PR, each change explained. `grep -rn "furniture\|kits.json\|glyphs" packages/3d/src` → none. Rows.
  **Commit** `feat(3d): props a game places, lamps, and a generator registry`

### Task 7.4: The piece states (spec 8.3; cut down on the Owner's word, 2026-11-07)

The director, the `stage-script` content kind and the sequences move to the `@automata/cutscenes` extension (Plus port
spec section 9). What stays is the small thing the renderer needs to move a door or a lamp: the state of the world's
pieces, and applying a change of it.

**Source files:** EnvironmentBuilder `src/features/stage/state.ts` (the state a scene is in).

**Files:**
- Create: `packages/3d/src/shared/level/piece-states.ts` (`PieceStates`, `LampState`, `PropState`),
  `app/update-pieces.ts` (reads the world's view and two `PieceStates`)
- Modify: `app/compose-scene.ts` (gives the scene a `startClip(who, clip, atTick)` callback, so a cue from outside, such
  as the extension's, can start a figure's clip)
- Test: `tests/unit/shared/level/piece-states.test.ts`, `tests/unit/app/update-pieces.test.ts`

**Interfaces:**
- Consumes: `Track`, `sample` (task 6.3); piece ids as plain strings.
- Produces: `PieceStates { doors: Record<string, number>; lamps: Record<string, LampState>; props: Record<string, PropState> }`;
  `updatePieces(view: WorldView, before: PieceStates, after: PieceStates): number` (pieces changed).

- [x] **Step 1: Write the failing test**

```ts
it('a door key changes only that door', () => {
  expect(updatePieces(view, statesAt(0), statesAt(1))).toBe(piecesOf(view, 'door-1').length)
})
```

- [x] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. No `features/stage/`, no `stage-script` kind and no
  director here: `@automata/cutscenes` builds them. Rows. **Commit** `feat(3d): the world's pieces move on the one timeline`

### Task 7.5: One sector geometry (new, 2026-11-07; scope trim R1)

Sector geometry is written three times today: `packages/editor-3d/src/geometry/{sectors,triangulate}.ts`,
`extensions/sectors/src/shared/sim/{queries,pieces}.ts` (the Plus port) and `features/world/sectors.ts`. Core owns it once.

**Files:**
- Create: `packages/3d/src/shared/level/geometry.ts` (`polygonArea`, `insideSector`, `segmentDistance`, `crossing`,
  `opening`, `walkBlocker`, `triangulate`), exported from `@automata/3d/level` (a sim entry: the sim's rules hold, so
  `pnpm boundaries` reads it)
- Modify: `features/world/sectors.ts` (imports it; its own `triangulate` goes)
- Test: `tests/unit/shared/level/geometry.test.ts` (editor-3d's `geometry/{sectors,triangulate}.test.ts` cases, moved)

**Interfaces:**
- Produces: the seven functions with the editor's signatures (the editor's tests are the most complete); where the
  extension's sim version and the editor's differ, the sim-safe one is the body and both callers' tests must pass.

- [ ] **Step 1:** move the editor's geometry tests to the new file, importing `#src/shared/level/geometry.ts` → FAIL.
  **Step 2:** the file, sim-safe (only the allowed `Math` members). **Step 3:** PASS; world builder tests and base-3d's
  replay unchanged; `pnpm boundaries` green. editor-3d switches in task 14.1, the extension in port task 5.1. Rows.
  **Commit** `refactor(3d): one sector geometry, in the level entry`

### Task 7.6: Clothes, hairstyles and seats leave core (new, 2026-11-07; scope trim section 2, R3)

**Files:**
- Delete from `packages/3d` (the commit before this one is the source port task 3.6 moves from): the garment kinds
  `apron`, `belt`, `coat`, `gloves`, `legs`, `mark`, `skirt`, `waistcoat` (their parts of `outfit/garments/classic.ts`,
  `classic-kinds.ts` and `figure/garment.schema.ts`), the hair pieces (`hair/{sweep,tail,loose,shell}.ts` and the
  piece builders in `hair-parts.ts`), the extra finishes, `motion/seated.ts`, `content/seat.schema.ts` and the
  `figure-seat` kind, their tests and goldens, their fixtures
- Modify: `hair/hair-parts.ts` (builds a style's pieces through `registerHairPiece`'s registry; core registers none and
  keeps `locks`), `content/hair.schema.ts` (a piece is a registered kind's schema), `registry/*` unchanged,
  `motion/hems.ts` (no seated argument), `sources.md` rows (*moved to `@automata/character-kit`*)
- Test: `tests/unit/figures/registry/*.test.ts`, `tests/unit/figures/hair/*.test.ts`

- [ ] **Step 1: Write the failing tests**: `core registers exactly cap, cape, eyes, hair, shoes, top, trousers` (if
  `cap` needs `mark`, `mark` stays and the log says why); `a style naming a bun fails with "No hair piece called bun"`;
  `Wick and the base pair build the same meshes as before` (recorded before the change).
- [ ] **Step 2:** FAIL. **Step 3:** the deletions and the registry-driven `hairParts`. **Step 4:** 3D unit, the figure
  goldens for Wick and the base pair unchanged; goldens of removed kinds leave with them (listed in the log, moved by
  port task 3.6); the Characters editor's tests pass (a kind it lists that core no longer has is gone from its list).
  `grep -rn "waistcoat\|seated\|bun" packages/3d/src` → none. **Commit** `refactor(3d): the wardrobe and hairstyles
  leave core for the character kit`

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

### Task 8.2: The passes (**session break** after the filters; audit note 14; trimmed 2026-11-07, scope trim section 2)

Trimmed: no CPU reference painters and no `look-sheet.ts` (2D proves its look with parity images from the real
renderer, and so does 3D); sky, stars, rain and bloom are `@automata/world-kit`'s (port task 3.8), added through
`addLookPass`. Ignore those names in the lists below.

**Source files:** EnvironmentBuilder `src/features/paint/*`, `src/features/stage/sprite-light.ts`; FigureBuilder
`src/features/paint/{paint,raster,fabric}.ts`, `src/features/lighting/light.ts`.

**Files:**
- Create: `packages/3d/src/features/look/{look.ts,look.schema.ts,ramp-light.material.ts,duel-snap.filter.ts,
  outline.filter.ts,sprite-light.ts,post.ts,look-pass.ts}` with `.glsl` + `.wgsl` pairs, `look/library/look.json`
- Modify: `app/create-renderer.ts` (low-resolution target, then the passes), `app/compose-scene.ts`, base-3d's views
- Test: `tests/unit/look/*.test.ts`, `tests/unit/entries.test.ts`, `tests/browser/look/look.parity.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_PALETTE`, `step` (task 5.1); `timeOfDay` (task 6.3).
- Produces: `targetSize(stage: { width: number; height: number }): { width: number; height: number }` (short side 180,
  long side rounded from the stage's aspect); `Look { pixel: { short: 180 }; steps: number; outline: boolean; dither: boolean; grade: string;
  switches: Record<'outline' | 'sky' | 'stars' | 'rain' | 'bloom' | 'grade' | 'dither', boolean> }`;
  `createLookPasses(look: Look, time: TimeOfDay): LookPasses`; `spriteLight(figure, time): SpriteLight`;
  `addLookPass(pass: LookPass): void` (a pass an extension adds after core's; a pass whose name is taken throws
  `RegistryClash`). `Look.switches` keeps only `outline`, `grade` and `dither`; an extension's pass has its own switch.

- [ ] **Step 1: Write the failing tests**

```ts
it('an added pass runs after core passes, and a taken name is refused', () => { /* addLookPass */ })
it('ramp light moves a colour in whole steps along its ramp', () => {
  expect(rampLit(3 * 8 + 4, 0.5, look)).toBe(step(3 * 8 + 4, -2))
})
it('sprite light gives a flat light at the chest, a one-step form and a rim', () => { /* … */ })
it('the low-resolution target keeps its short side at 180 and follows the stage', () => {
  expect(targetSize({ width: 1280, height: 720 })).toEqual({ width: 320, height: 180 })
  expect(targetSize({ width: 390, height: 844 })).toEqual({ width: 180, height: 390 })
})
// browser: after a context loss and restore, the target and the filters are rebuilt and the next frame draws
// browser: WebGL2 and WebGPU agree; the parity images of base-3d's room are opened and explained
```

- [ ] **Step 2:** FAIL. **Step 3:** the filters. **Session break here if needed.** **Step 4:** the material, sprite
  light and `addLookPass`, through the game's camera. **Step 5:** parity in Chromium (WebKit/Firefox: the Owner's),
  base-3d's journeys pass; images opened and explained. Rows (painters: *left out: the look is drawn by Pixi 3D only*). **Commit** `feat(3d): the pixel-art look, drawn by Pixi 3D`

---

## Phase 9: Textures and the builders' checks (PR `claude/3d-textures`)

### Task 9.1: `automata textures` in `-tools` (spec 9; audit note 13)

> **Moved to the Plus port, task 3.8 (scope trim, 2026-11-07).** The photo pipeline, the photos and the tiles are
> `@automata/world-kit`'s; `-tools` gains nothing. Not built here; the row says "Moved". The text below is the port's
> source.

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

> **Moved to the Plus port, task 3.8 (scope trim, 2026-11-07).** `checkReads` is `@automata/world-kit`'s; base-3d's
> content test does not run it. Not built here; the row says "Moved".

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
- Produces: `checkReads(level: AfSector2, library: WorldLibrary): LevelProblem[]` (exported from `@automata/3d/level`).

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
- Produces: `findSourceNames(root: string, options?: { code?: readonly string[] }): string[]` (today's signature and
  finding format, `file:line: names a source project (entry N)`, kept; `code` adds those folders' files, and a file
  whose path names a source is a finding at line 0).

- [ ] **Step 1: Write the failing tests**: `a .ts file naming a source under a --code folder fails`; `one outside does
  not`; `a file whose name names a source fails`; `docs/provenance stays exempt`. **Step 2:** FAIL. **Step 3:** the option; rewrite the comments (what and why,
  not where from); 190 plan IDs in `packages/3d/src` at `78e0ca7f` (count again first). Scope trim R5: the clip
  blender `features/figures/clips/sample.ts`'s `sample` becomes `blendKeyPoses`, so the package has one `sample`. **Step 4:** `pnpm source-names` and `pnpm style` pass. The `--code` list grows: `packages/automata`,
  `content`, `tools`, `games/base-3d`, `examples/3d` in task 13.2; `packages/editor-3d`, `packages/editor` in 17.2, which
  replaces the list with every source folder. **Step 5: Commit** `refactor(3d): comments say what and why`

### Task 10.2: README, a complete record, part A's close

**Files:** Create `packages/3d/README.md` (entries, the beta rule, what is core and what the character kit and the
world kit add); modify `docs/README.md`, `docs/provenance/sources.md`,
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
- Produces: `content/editors.toml` (`format = "af-editors/1"`) rows `content/levels/*.af-sector.json` → `levels-3d`,
  `content/figures/*.toml` → `studio`, `content/tuning.toml` → `tuner`, each `modes = ["edit"]`, `gates = []`,
  `checks = ["content"]` as Emberwick's (the editor ids are the suite editors' own: `levels-3d`, `studio`, `tuner`).

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
- Create: `examples/3d/{figures-stand-and-sliders,look-pixel-art,world-time-of-day}.ts`, `examples/3d/README.md`
  (trimmed 2026-11-07: the hair, wardrobe, furnished-room and generated-map examples show extensions and are the Plus
  port's task 3.9)
- Test: `examples/3d/e2e/*.e2e.ts` (each boots and reaches ready), the examples runner's list

- [ ] **Step 1:** Failing journeys for the three. **Step 2:** the three examples. **Step 3:** the moved figures and
  render3d examples on the new entries. **Step 4:** PASS in Chromium. **Step 5: Commit** `feat(examples): the 3D examples show
  the figures, the world and the look`

### Task 12.2: `create-game --template 3d`

When the Plus port's task 3.4 lands, the 3D template lists `@automata/sectors` (Plus port spec section 9); until then it does not.

**Files:**
- Create: `packages/tools/src/shared/create-game/template-3d.ts`
- Modify: `packages/tools/src/shared/create-game/` (`automata create-game` has one template today; it gains
  `--template 2d|3d`, `2d` the default, and `--help` lists `3d` only when `@automata/3d` resolves: inside this
  repository or with `AF_BETA_3D=1`), `tooling/consumer-smoke` (a 3D stranger behind
  `AF_BETA_3D=1`)
- Test: `packages/tools/tests/unit/create-game/template-3d.test.ts`, the smoke

**Interfaces:**
- Produces: `template3d(name: string): TemplateFiles` (one room with box and cylinder props, Wick, a tuning file, an
  editor list, the feature layout, the content test).

- [ ] **Step 1: Write the failing tests**: `the 3D template's files pass automata check`; `without the 3D package it
  says "3D games need a package that is not public yet. For now, make a 2D game: leave out --template." and exits
  1`; `without --template it makes the 2D game it makes today`. **Step 2:** FAIL. **Step 3:** the template.
  **Step 4:** PASS; the smoke passes with `AF_BETA_3D=1`. **Step 5:** changeset `patch` for `@automata/tools`.
  **Commit** `feat(create-game): a 3D template`

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
  rewrite. **Step 3:** PASS; `pnpm build`, `pnpm api-index --write` (the agent package's API reference and the cheatsheet), `pnpm agent-skills`. **Step 4:
  Commit** `docs: 3D in the guides and the agent package`

### Task 13.3: The 3D frame-budget projects (spec 6; audit note 15)

**Files:**
- Create: `tooling/frame-budget/stress/3d/{index.html,main.ts}` (Ember Hall's room with Wick, every core pass on, the
  camera turning)
- Modify: `tooling/frame-budget/src/playwright-run.ts` (`frameBudgetProjects` gains `frame-budget-3d-phone`, Pixel 7
  as the phone project, and `frame-budget-3d-ipad` at 1194 × 834; `playwright.config.ts` only calls it),
  `tooling/frame-budget/budget.json` (`projects` gains the two rows in its own shape, `{ workMsP95, intervalMsP95 }`:
  33.3 and 33.3 for the phone, 16.7 and 16.7 for the iPad, the spec's targets until the Owner's GPU run replaces them;
  the first pose's 5 ms is a separate `firstPoseMs` row checked by the stress page)
- Test: `tooling/frame-budget/tests/unit/budget-3d.test.ts`

- [ ] **Step 1: Write the failing tests**: `budget.json has the 3D rows`; `a software renderer skips with "Skipped:
  software renderer, no frame budget measured."`. **Step 2:** FAIL. **Step 3:** the page and projects. **Step 4:** PASS
  here (skips). `pnpm budget:frame` fails closed (a budgeted project with no hardware result fails), so it stays red
  for the 3D rows until the Owner's GPU run: say so in the PR and the progress row, never loosen the check; the GPU
  runner's run is the Owner's queue; the first pose is met or changed to the measured number in
  spec 15. **Step 5:** Part B's done check. **Commit** `test(frame-budget): 3D budgets for the look`
- [ ] **Step 6:** Merge part B's PRs in stack order once green. Part C starts after.

---

# Part C: the editors

## Phase 14: `editor-3d` by feature (PR `claude/3d-editor-features`)

### Task 14.1: Feature folders and `tests/` (**session break** after the map)

**Files:**
- Create: `docs/refactor/move-map-editor-3d.json`, every file once (after task 4.1 and 15.3's deletions; `ask-controller.ts`
  stays where it is until 15.3 deletes it):

| From | To |
|---|---|
| `ui/suite/studio/{studio-*.ts,ui/*,stage/*}` | `features/studio/` (`ui/` and `stage/` keep their names; `testing/` → `testing/studio/`) |
| `ui/{plan,walk,dollhouse,inspector,definitions,document,home}/*` | `features/levels-3d/<same name>/` |
| `ui/suite/{Levels3dInspector,Levels3dRegions,Levels3dStatus}.svelte`, `levels-3d-suite-editor.ts`, `plan-tools-of.ts`, `pointer.svelte.ts` | `features/levels-3d/` (Levels 3D's own, not the suite's) |
| `app/{plan,sector,split,vertex,wall,merge}-*.ts`, `plan-picture.ts`, `plan-status.ts`, `tool-paint.ts`, `wall-place.ts`, `sector-id.ts`, `loupe*.ts` | `features/levels-3d/plan/` |
| `app/{dollhouse-controller,dollhouse-paint}.ts` | `features/levels-3d/dollhouse/` |
| `app/{walk-hud,walk-session}.ts`, `view/walk/*`, `view/mesh/{camera-3d,follow-camera,heading,mesh-pick,vec3}.ts` | `features/levels-3d/walk/` (`camera-3d`, `mesh-pick` and `vec3` to `shared/geometry/` if the dollhouse imports them too) |
| `view/plan/*` | `features/levels-3d/plan/` |
| `app/{inspector-cards,inspector-edits,material-session}.ts`, `view/materials/*` | `features/levels-3d/inspector/` |
| `app/{definitions-controller,thing-fields}.ts`, `entities/*`, `things/*` | `features/levels-3d/{definitions,things}/` |
| `app/checks-panel-controller.ts`, `app/problem-count.ts`, `checks/*` | `features/levels-3d/checks/` |
| `app/document/*`, `app/{open-level,read-level,patched-document,import-files}.ts` | `features/levels-3d/document/` |
| `app/home/*`, `app/project-list.ts` | `features/levels-3d/home/` |
| `app/{editor-app,levels-3d-session,layers-model,geometry-cache}.ts` | `app/` (they wire the features) |
| `model/*` | `shared/edit/` |
| `geometry/*` | deleted where `@automata/3d/level`'s geometry covers it (task 7.5; scope trim R7): `sectors.ts` and `triangulate.ts` go and their callers import the level entry; `loops.ts` moves to `shared/geometry/` only if nothing in the level entry does its job |
| `profile/*`, `profile/af-sector/*`, `codec/` (tests only) | `shared/level-session/` |
| `view/selection-of.ts` | `shared/edit/` |
| `suite-main.ts`, `ui/suite/index.ts` | `app/suite/` |
| `main.css`, `vitest-setup.ts` | `app/main.css`, `tests/setup.ts` |
| `journeys/*.journey.test.ts` | `tests/browser/journeys/` (by the mover) |

  A row the dry run shows importing another feature goes to `shared/` or `app/` by the rule above, written in the map.
- Move: tests → `tests/{unit,browser/{layout,canvas,journeys}}` with `--browser-folders --feature-folders`
  (`--environment node --other-environment` for nothing: `.dom` tests get the jsdom directive and land in `unit/`)
- Modify: root `boundaries` (`--features packages/editor-3d --components`), `style` (`--test-imports
  packages/editor-3d`), `packages/editor-3d/vitest.config.ts` (projects by folder, as `packages/editor`'s), its
  `package.json` (`test:unit` runs `--project unit`)

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

**Files:** Modify `packages/editor-3d/src/app/suite/main.ts`; create `packages/editor-3d/src/testing/sample-3d.ts`
(`SAMPLE_3D`: a 3D room and Wick). Test `packages/editor-3d/tests/unit/suite/open-checkout.test.ts`.

**Interfaces:**
- Consumes: `openSuitePorts` (`packages/editor/src/features/suite/shell/open-suite-ports.ts`, what the 2D page uses) and
  `samplePorts(files: Readonly<Record<string, string>>): Promise<SuitePorts>` with `SAMPLE_GAME` (both exist; no
  signature changes).
- Produces: the 3D page opens the checkout through `openSuitePorts`, and for the site `samplePorts({ ...SAMPLE_GAME,
  ...SAMPLE_3D })`.

- [ ] **Step 1: Write the failing tests**: `on a checkout the suite lists base-3d's room and Wick`; `served for the site
  it opens the sample with a 3D room and Wick`. **Step 2:** FAIL. **Step 3:** `openSuitePorts` as the 2D page.
  **Step 4:** PASS. **Commit** `fix(suite): the full suite opens the game's folder`

### Task 15.2: One page, chosen by the game (D4, E3, E4)

**Files:**
- Modify: `packages/tools/src/features/editor/editor-command.ts` (no `--app`; `BUILDS` is the 2D suite and the full
  suite), `docs/guides/editor.md`, the help text
- Delete: `packages/editor-3d/src/main.ts`, its `index.html` and standalone build; the 2D standalone page:
  `packages/editor/index.html`, `src/app/editor-2d/main.ts`, the default `vite build` (`dist/2d`, so `build` is only
  `vite build --mode suite`) and `packedEditor('2d')` in the command. The rest of `app/editor-2d/` stays: the suite's
  Levels editor imports its `profiles.ts`, `testing/level-2d/journey-editor.ts` its `DocumentScreen.svelte`, and 43 test
  files its `boot.ts` and `main.css`; `pnpm knip` decides whether `App.svelte` goes, and the folder is renamed
  `app/level-2d/` (the standalone app is gone, the 2D level editor is not)
- Test: `packages/tools/tests/unit/editor/editor-command.test.ts`; the 2D unit, layout and journey counts before and
  after (only the standalone page's own tests, such as `editor-app-import.test.ts`, may drop, each named)

**Interfaces:**
- Produces: `pageFor(game: GameFiles, builds: Builds): 'suite-2d' | 'suite-full'`.

- [ ] **Step 1: Write the failing tests**: `base-3d gets the full page`; `Emberwick gets the 2D page`; `--app says
  "This option is gone: automata editor picks the editors your game needs." and exits 1`. **Step 2:** FAIL. **Step 3:**
  the change and deletions. **Step 4:** both editors' suites pass; `pnpm knip` clean. **Step 5:** changeset `patch`.
  **Commit** `feat(editor): one editor app for every game`

### Task 15.3: The cuts (D6, E6)

**Files:** Delete World, Ask (`ask-controller.ts`, `testing/fake-ask.ts`, `SuiteAsk.svelte`, the top bar's Ask), the
change-set desk (Review, Export changes, Import changes, Publish over a sample) in `packages/editor` and
`packages/editor-3d`; the `ask` mode of `af-editors/1` (`packages/editor/src/shared/editor-list/editors.schema.ts`
`modes`: `edit` only; every committed list already says `["edit"]`).

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
(Room, Corner, Doorway, Door, Window, Thing, Furniture, Lamp; Furniture places one of the game's own props). Test `tests/browser/layout/levels-3d/*.test.ts`,
`tests/unit/levels-3d/*` (DOM, jsdom), the canvas suite.

- [ ] **Step 1: Write the failing tests**: at 390 × 844, 844 × 390, 1194 × 834, 1440 × 900 `a drawing tool, the view
  switch, the inspector and Save are reachable` and `checkLayout` is clean; `every tool is reachable by role and name`;
  `keyboard occlusion keeps compact layout and the focused field` (an inspector number focused, the visual viewport
  shrunk by 300 px: still compact, the field visible, Save whole). **Step 2:** FAIL. **Step 3:** top bar and tools.
  **Session break here if needed.** **Step 4:** inspector, layers, layouts. **Step 5:** PASS; before/after at the four
  sizes against the mock-up. **Commit** `feat(levels-3d): the approved look, with every tool on a phone`

### Task 16.2: The builders' authoring (spec 10.3; trimmed 2026-11-07, scope trim section 2)

No Fill with furniture, no `furnishAs`, no `checkReads` and no kit checks: furnishing is the world kit's, and the editor
is core, which never imports an extension.

**Files:**
- Modify: `features/levels-3d/inspector/` (Time of day, Wall trim, Windows), `features/levels-3d/plan/tools/`
  (Furniture, Lamp), `shared/edit/` (one undoable command each), `features/levels-3d/checks/` (a prop outside every
  room; a lamp inside a wall; a prop, swatch or time the game lacks; a room asking for an extension), the 3D view
  (draws through the world builder)

**Interfaces:**
- Consumes: `buildWorld` (task 7.2), the `needs-extension` problem (task 7.3).
- Produces: edit commands `placeProp(use, at)`, `placeLamp(kind, at)`, `setTimeOfDay(name)`, `setWallTrim(wall, trim)`,
  `setWindows(wall, grid)`, each `EditCommand` with a `label`.

- [ ] **Step 1:** For each change, in order: a failing unit test of its command (`undo restores the level byte for
  byte`; Undo's label "Undo place furniture"; Time of day lists each time's `label`), its DOM test, its canvas test;
  then the code. A room asking for the world kit shows "This room asks to be furnished by the world kit, which this
  game doesn't have. Add @automata/world-kit, or remove "dress" from the room." **Step 2:** all PASS. **Commit**
  `feat(levels-3d): place furniture and lamps, pick the time of day`

### Task 16.3: Plan, 3D and Walk in the game's look (spec 6, 10.3)

**Source files:** EnvironmentBuilder `src/features/view/{view-frame,readability}.ts`; `render.ts` and `fp.ts` for
their camera and framing rules only.

**Files:**
- Create: `packages/editor-3d/src/features/levels-3d/views/{plan,diorama,walk}/`, `views/shared/frame-map.ts`
  (trimmed 2026-11-07: readability is the world kit's, port task 3.8), `tooling/frame-budget/stress/3d-editor/` with projects `frame-budget-3d-editor-{phone,ipad}`
- Modify: `features/levels-3d/{plan,dollhouse,walk}/` draw through these views; Walk's hint
- Test: `tests/unit/levels-3d/views/frame-map.test.ts`, canvas and layout tests

**Interfaces:**
- Produces: `frameMap(level: AfSector2, view: 'plan' | 'diorama' | 'walk', viewport: Rect): Camera3d`.

- [ ] **Step 1: Write the failing tests** (the source's framing cases). **Step 2:** FAIL. **Step 3:** the three views. **Step 4:** unit, canvas and
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
names out of `packages/editor-3d` (465 plan IDs in its `src` at `78e0ca7f`; count again first) and `packages/editor`; root `package.json` (`source-names --code` covers every source
folder). Test `tests/unit/studio/*` (DOM), a thumbnail canvas test.

- [ ] **Step 1: Write the failing tests**: `each new control has its role and name`; `each new slider's ends say the
  spec 11 words` (fat "Thin"/"Heavy", bust and seat "Smaller"/"Larger", eye size "Small"/"Large", eye spacing
  "Close"/"Wide", eye tilt "Down"/"Up", asymmetry "Even"/"Uneven"); `actions list by name`. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS; `pnpm source-names`
  passes repository-wide. **Commit** `feat(studio): every slider the figures have, in words`

## Phase 18: Copy and real journeys (PR `claude/3d-editor-journeys`)

### Task 18.1: The copy pass (C1 to C9)

**Files:** Modify every string of spec 11 and the rest the pass finds; create
`features/levels-3d/checks/messages.ts`; `docs/refactor/copy.md` "3D editors". Test
`tests/unit/levels-3d/checks/messages.test.ts`, `tests/unit/copy.test.ts` (DOM).

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

**Files:** Modify `packages/editor/tests/e2e/harness/fixtures.ts` (the game to copy is a fixture option:
`EMBERWICK` or a new `BASE_3D`), `run-game.ts` if base-3d's dev server needs its own start; create
`packages/editor/tests/e2e/journeys/{levels-3d-save-reaches-the-game,character-save-reaches-the-game,
levels-3d-on-a-phone}.test.ts`. The 2D slice's harness (`run-editor.ts`, `run-game.ts`, `temp-game.ts`) already copies a
game, starts the real `automata editor` and the game's server on their own ports and stops only what it started; no
second harness.

**Interfaces:**
- Consumes: `copyGame`, `runEditor`, the journeys' `test` fixture (`tests/e2e/harness/`); `playwright.journeys.config.ts`
  (`pnpm --filter @automata/editor test:e2e`).

- [ ] **Step 1:** `BASE_3D` in the fixtures, with a test that a base-3d run leaves no process and no folder (as the 2D
  ones do). **Session break here if needed.**
- [ ] **Step 2:** spec 10.4's journeys, failing where the product lacks a hook (each fixed as a product bug with a
  test). **Step 3:** PASS in Chromium, WebKit on the runner; the 2D journeys' count is unchanged. `3d.yml`'s
  `3D - journeys` job runs `pnpm --filter @automata/editor test:e2e --grep 3d` (named in task 1.2's test once added). Part C's done check: spec criteria 8 to 13. **Commit**
  `test(editors): journeys from the editor to the game`
- [ ] **Step 4:** Merge part C's PRs in stack order once green. Part D starts after.

---

# Part D: the site and the release

## Phase 19: The site's 3D pages (PR `claude/3d-site`)

### Task 19.1: Behind the switch (W1)

**Files:** Modify `site/src/shared/framework/examples.ts`, `site/src/features/{home,editor,docs,api,examples}/`, the
routes under `site/src/routes/` that the switch adds, `site/vite.config.ts` (`AF_SITE_3D`),
`site/scripts/scan-closed-beta.ts` (the scan that proves no `@pixi/3d` byte ships). Test the scan's own test, the
visitor's journey with the switch on (`site/tests/e2e/`), the site's browser gates on the new pages.

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

## Stage 3 plan audit (2026-11-07)

Audited with the superpowers plugin (`writing-plans`' self-review checklist) against the checkout at #444's head
(`64c27c91`), FigureBuilder `025ffb4` and EnvironmentBuilder `6d82a52`; the record and every finding is
[2026-11-07-3d-slice-plan-audit.md](2026-11-07-3d-slice-plan-audit.md). Every fix is in the tasks above; the build
reads only this plan and the spec. DUEL's author and licence stay the Owner's open question (D8).

## Execution log

(One two-line entry per session: what was done, where to resume.)
- Task 1.1: done (7eb54b3b). pnpm check green with every unit test.
- Task 1.2: done (66b8ac65). actionlint not run here (no Docker daemon): the Owner's. #425 comment and close pending the push.
- Task 1.3: done. Ruling: no `inDialog` prop — ErrorPanel renders its own Dialog, so the dialog body is the one scroll region and the problems list is a plain labelled list (`aria-label=Problems`); the layout test reads it by that label — cost if wrong: a caller wanting a standalone panel adds the prop. open-flows 32 pass in Chromium.
- Task 1.4: done. Ruling: the camera helper is `fitInto(bounds, usable, size)` in plan-viewport.ts and the controller gets `setUsable(Rect|undefined)`, with the kit's `Rect` ({x,y,w,h}) in place of the plan's `fitToRoom(room, {width,height})`/`PlanView` (PlanView is already the controller's hover state) — cost if wrong: a rename. The usable rect is computed by `ui/plan/usable-area.ts` (tool row 56 px, any docked sheet over the canvas bottom) and exposed as `data-usable`. The real cause of the iPad mini failure was a 24 px triangle collapsing on the snap grid / overlapping the hall (the band above the level is under 1 m), so the layout test now zooms out and draws a metre-wide triangle inside `data-usable`. editor-3d Chromium layout+canvas: 203 pass, 0 fail.
- Task 1.5: done. Rulings: (1) test file is `packages/automata/tests/browser/testing/ui/actions-inside.test.ts` (mirrors src/testing/ui; there is no tests/browser/ui) — cost: none. (2) `findCovered` skips a control behind an open dialog (the topmost dialog is on top; the kit's scrim is a sibling of the dialog, so the page behind is covered on purpose, inert or not) and a control inside a declared scroll region (scrolled out of view is not covered; the region's own checks judge it), and takes an `excused(cover)` callback the contract uses for an ErrorPanel that had to rise — cost if wrong: a bar control hidden behind a non-modal popover is not reported. (3) The new checks found two real bugs, fixed here with the failing suites as their tests: the 2D document bar drew the problems chip over the Characters tab at 900 x 600 (`.switch` min-width:0 let the tabs shrink under the tools; now min-content, the name's track gives way) and the kit's Tabs panel scrolled without declaring `data-scroll-region` (it hid the Studio's steppers and the Definitions button from the check). (4) No Studio `.fails`: the Studio's phone layout test passes under the new checks (32/32), so there is nothing to mark; the suite's Publish clip is for the Characters redesign (17.1) to prove with its own test. Chromium: automata browser 2,124 pass; editor layout 446 pass; editor-3d layout+canvas 203 pass; WebKit/Firefox on the Owner's ci:local.
- Task 1.6: done. Before the change `journeys` listed only WebKit (not installed in cloud sessions: 'Executable doesn't exist'); `journeyProject(provider, { browsers })` is new, editor-3d passes chromium and webkit; 3 journey files, 16 tests pass in Chromium; no Chromium-only failure. WebKit on the Owner's ci:local / hosted CI.
- Task 1.7: done. Ruling: the compile goes to `<tmp folder>/built` (the temporary folder the inlang project already uses), not `${outdir}.next-<pid>` beside the outdir, so a watcher on `src/` never sees the temporary output — cost if wrong: none (same sync). syncFolder: 3 unit tests; compile-messages: 'unchanged compile writes nothing' and 'never empty' RED then GREEN, 'removes left-over files' guards the sync. content 421 unit pass; base-3d browsers+layout (Chromium) 32/32 three runs in a row, no 'Could not load src/paraglide'.
- Task 2.1 step 1 done (counts before the move, Chromium, 2026-11-07): unit render-pixi3d 292, figures 426, sector-format 104 (822); browsers render-pixi3d 17 pass + 2 skipped (5 files), figures 24 (goldens, 1 file); sector-format has no browser project. `packages/render-pixi3d/vitest.config.ts` projects are `node` and `browsers`; figures' are `unit`, `bench`, `browsers`.
- Session 1 (build thread, 11:45 to 13:05): phase 1 (tasks 1.1 to 1.7) done, PR #453 open on #445, `pnpm check` green. **Resume at task 2.1 step 2** (write `docs/refactor/move-map-3d.json`, then `node tooling/codemods/src/move-modules-cli.ts --map docs/refactor/move-map-3d.json --dry-run`): the source trees are `packages/{render-pixi3d,figures,sector-format}`; the map's rows are in the task's table; `figures/src/testing/index.ts` becomes `testing/public.ts`, and `testing/` takes three packages' folders (watch clashes on `index.ts`, `golden-checks.ts` and fixtures); the `figurebuilder-*` names stay until 4.2.
- Task 2.1: done. Counts after the move (Chromium, 2026-11-07): 3d unit 821 (822 before: render-pixi3d 292 + figures 426 + sector-format 104; the two identical `browser-imports.test.ts` became one), Chromium browsers 41 pass + 2 skipped (parity 17 + 2 skipped, goldens 24) as before; full `pnpm test:unit` 30/30 tasks; typecheck 27/27; boundaries, style, source-names, knip, changesets clean. Rulings: (1) `blockout/` sat outside `src/`, which the mover does not read, so it was `git mv`ed to `src/blockout` first (the two `../src/` imports fixed by sed); `figures/scripts/` moved to `packages/3d/scripts/` by hand (4.2 deletes them). (2) The mover wrote `.js`, `.ts` and bare specifiers as it found them, so a one-off script rewrote all 238 files' relative specifiers to name their `.ts` file (S9); `allowImportingTsExtensions` is on. (3) `./blockout` stays an entry (`entries/blockout.ts`) until 4.1 deletes it, and `automata.simEntries` is `["./sim", "./level"]` (sector-format was a sim entry, so a game's sim may keep importing `@automata/3d/level`); the spec's `["./sim"]` arrives when `shared/level/sim` does (7.1). (4) `entries/sim.ts` is not in the root `boundaries` sim list: the checker treats a listed file as its own root and refuses its relative imports; it only re-exports `features/camera/sim`, which is listed. `--skip-dir blockout` keeps the doomed blockout (Math.hypot, Object.entries) out of the sim rules until 4.1, which removes the flag. (5) The extension's registered name is now `'3d'` (was `'render-pixi3d'`; no other file read it); the `figures` extension keeps `'figures'`. (6) `entries/no-eval.ts` held a statement, which `--features` refuses, so the install moved to `features/renderer/no-eval/install-no-eval.ts` and `sideEffects` lists both files. (7) `app/compose-scene.ts` is not made here: `app/create-renderer.ts` is in `app/`, which may import features, and `--features packages/3d` already finds 0 (turned on in 2.2); it appears with the look (8.2). (8) `tooling/release/tests/unit/private-build.test.ts` lost "includes the sector format" (it was the one private package shipping `dist`); the Plus catch-up (automata-plus #40, P-D4) decides whether `@automata/3d` builds `dist`. (9) The api-report/api-index files were regenerated (`3d.api.md` replaces three), a patch changeset `3d-one-package` covers the comment changes in `@automata/framework` and `@automata/tools`; `define-game.ts`'s comment says "a 3D extension's renderer" so no unpublished package is named in `agents/`. Resume at task 2.2.
- Task 2.2: done. 96 test files moved by the mover (unit 89, browser 6, bench 1) into `tests/{unit,browser,bench}`; counts unchanged: unit 821, Chromium browser 41 pass + 2 skipped; the bench runs (1). Rulings: (1) the package's browser project is now `browser` (the preset's name; it was `browsers`), so the Chromium command is `--project 'browser (chromium)'`; vitest.config.ts is `defineTests({ svelte, optimizeDeps, browserCommands })` with no `alsoInNode` (the parity tests need WebGL). (2) `src/testing/{__goldens__,fixtures}` went to `tests/fixtures/{__goldens__,content}` and their readers follow; the nightstand model fixture stays in `src/testing/model/fixtures` (not named by the plan; it is a prop, not a figures fixture). (3) The six "check by eye" tests: camera-view, browser-imports, actions, parse-glb, pixi3d-bundle, sector-format; `browser-imports` had read `dirname` as the source folder and would have passed on an empty list, so it now asserts it found over 100 source files. (4) `tsconfig` includes `tests/`; `--features packages/3d` and `style --test-imports packages/3d` are in the root scripts and find 0.
- Task 3.1: done. The four source files and four tests that imported `effect` are plain TypeScript; `no-effect.test.ts` is replaced by `--forbid packages/3d:effect games/base-3d:effect` in `boundaries` (0 findings in 202 files). 3d unit 822 and Chromium parity 41 pass + 2 skipped as before; base-3d unit 82; `pnpm build`, `api-report --update` and `api-index --write` run. Rulings: (1) the content compile and the ship helpers are Effect APIs in published packages, so plain-value forms were added there rather than keeping `effect` in 3D: `compileContentResult` (`@automata/content`), `manifestOf` and `rukenHeadersOf` (`@automata/tools` internal); each has its own test. Cost if wrong: three small exports that a later cleanup can fold into one. (2) `createPixi3dRenderer(options)` takes `clock` inside `Pixi3dOptions`, not a second `seams` argument, and `Pixi3dSeams` is gone; `systemClock` and `TimeoutHandle` are now exported from `@automata/framework`, `fakeClock` and `FakeClock` from `@automata/framework/testing`. (3) A Try again that finishes after `dispose` throws the new app away instead of drawing into a dead renderer. Changeset: `.changeset/3d-without-effect.md` (framework, content, tools; patch).
- Task 4.1: done. Deleted the source game's level format and everything that read it: `packages/3d` `./blockout` entry, `shared/level/blockout/` and its two tests (2 files); in `packages/editor-3d` the `format/` folder, `profile/last-light-*`, `checks/facility/` and `checks/last-light/`, `model/facility-*`, the facility editor, and `testing/{toy-blockout,shipped-facility,geometry-golden,game-facts}` with the Last Light fixtures; `registry.ts` now has the one profile (`PROFILES = [afSectorProfile]`, one sentence for a file that is not af-sector). Tests that mixed Last Light into generic coverage were moved to the depot and the toy level, or to a synthetic profile (a `pinned` list, no `definitions`, a refusing `materials`, a test-held `links` table, a `zone` definition with an `area`), so the Things tool's rectangles and links, the material picker's "no list", the cut refusal and the definitions sheet's "fixed" note are still covered. Tests that could only mean Last Light (connector surfaces, nav, facility, pilaster walls) were deleted. Counts (Chromium, 2026-11-07): editor-3d unit+dom 2,196 pass (151 files); layout+canvas 203 pass, journeys 16 pass, typecheck 0 errors, knip clean. Rulings: (1) X3 holds: Plus's `pipe blockout` breaks, as agreed (D3). (2) X4 holds with no work: `@automata/3d/level` still exports `sector.schema.ts` (`SectorDef`, `WallDef`, `Corner`, `Trim`, `STEP`, `WALL_THICK` and the rest). (3) `format/af-sector.schema.ts` was a re-export of `@automata/3d/level` kept for old names; its five test importers now import `@automata/3d/level`, and it is gone. (4) The Home test for a "facility" row and `LevelSummary`'s facility rule are gone with the facility. Resume at task 4.2.
- Task 4.2: done. The recorder is `packages/3d/scripts/record-goldens.ts` (`recordGoldens(outDir)`, run with `pnpm --filter @automata/3d goldens [--out <dir>]`); `scripts/extensionless-ts.ts` is a Node resolve hook the package script loads with `--import`, because `@automata/content` writes relative imports without `.ts` and plain Node cannot load it. The three goldens are `tests/fixtures/goldens/{dress,motion,actions}.json`; `src/testing/hand-on-hip.ts` (`HAND_ON_HIP`); the three source-checkout scripts are gone. RED: with one number of `actions.json` changed, `goldens-fresh.test.ts` fails on `ends.look-out[0][0]` (0.5 against 1e-9); GREEN with the file restored. Counts (Chromium, 2026-11-07): 3d unit 812 in 88 files (the two blockout tests went in 4.1, `goldens-fresh` adds 2); Chromium browser 41 pass + 2 skipped as before (the parity golden test now reads `dress.json`); `tsc`, knip, style, source-names and boundaries clean. Rulings: (1) The plan says moving the goldens, but the recorder writes AF's own output, which cannot equal files the source produced (its nameplate and pendant anchor were cut, the pony's cuffs added). So the files are re-recorded once here, after checking the old against the new within the readers' own 1e-9: geometry 23,068 numbers, worst difference 0 (the cuffs and the cut plate and pendant aside); locomotion, holds and stands identical (the two chain outfits' crossed arms are now recorded too, so the readers' PENDANT skip, the `cut` marker and the cuff filter are gone); actions differ by at most 1.4e-4 figure units (the clips are fitted to 1e-3, so the F-g check now guards the clips against drifting from their own recorded end pose); the hair spring's steps 22 to 39 differ because AF's walking head has no idle twitch (the twitch is idle's), so the recorded head, and the spring that follows it, are AF's — cost if wrong: the hair spring is no longer checked against the source's head, only against AF's. (2) The recorder compares with 1e-9 in the test, not byte for byte, because the files keep 12 and 13 digits and platforms' `Math` differ in the last bit (the same tolerance the readers use). (3) `figureOf` moved to `testing/golden-outfits.ts` and `surfaceOf` to `testing/stand-surface.ts` so the recorder and the tests share them (neither imports vitest). (4) `hand-on-hip.ts` keeps its recorded numbers; they are a table, not recomputed. (5) `tsconfig` now includes `scripts/`. (6) Source names stay in the header comments of base/stands/hold tests ("Ported from ...") outside the golden sentences; the later source-names work (spec 8) takes them. Resume at task 5.1.
- Task 5.1 to 5.3: done, as one commit. Rulings: (1) the three land together because the default palette cannot be green until every consumer is remapped (a commit with only 5.1 fails knip and the 3d swatch tests); `endesga-64.txt` was deleted in 5.2, not 5.1, for the same reason — cost if wrong: one larger commit. (2) The theme's contrast floor is the WCAG minimums plus at least 85% of the Endesga theme's ratios, because DUEL has no pure white and the old ratios cannot all be met — cost: a slightly lower contrast on a few pairs, all still AA. (3) The 32 ramp names are AF's own labels (DUEL names none); `duel.md` says so. (4) The editors' and editor-3d's colours are chrome fallbacks, not Endesga-bound, and were left alone. (5) Swatch colours came from the FigureBuilder row and step comments where a TOML had one, else from the OKLab remap; hex colours in the 3D views and examples (not white, which the lighting multiplies by) moved to the nearest DUEL colour. The 3D player-yellow test's classifier loosened from `b < 70` to `b < 90` because DUEL's nearest orange has more blue — cost: none. (6) The goldens did not need re-recording: they record geometry, not palette indexes, and `goldens-fresh` stays green. (7) `swatchColourProblems` stays, now checking the resolved index against a game's own palette.
- Plan change from the Owner (2026-11-07 15:05, via the coordinator; exact edits from the Plus port spec section 9, PR #457, at 15:15): Plus becomes AF extensions and two pieces move to the Plus port. Task 7.1 drops `shared/level/sim/`, `simLevel()` and the `simLevel` assertion (the round trip stays; `entries/sim.ts` re-exports only `features/camera/sim`; `simEntries` stays `["./sim", "./level"]`). Task 7.4 shrinks to `shared/level/piece-states.ts`, `app/update-pieces.ts` and compose-scene's `startClip`; only the "a door key changes only that door" test stays; no `features/stage/`, `stage-script` kind or director (`@automata/cutscenes`). Task 12.1 makes seven examples, not eight (no `stage-script.ts`). The 3D spec's sections 3, 7, 8.3 and 9 and the plan's audit notes now say so. No 3D task waits on the port. Pass this on at every handoff.
- Plan change (2026-11-07 15:28, via the coordinator; Plus port plan audit, #457 at f991018a): task 7.1's `af-sector/2` also carries `zone` on a sector, `masses` on the level, and `cut` and `hideFrom` on a corner's wall (`AfWall` stops omitting them), each with a spec section 9 table row (added) and a migration test (one assertion per field). Task 12.2: the 3D template lists `@automata/sectors` once port task 3.4 lands. Pass on at every handoff.
- Task 6.1: done (62f032fc). `checkSources(md, manifest, {complete?, exists?})` and `pnpm sources-md [--complete]` (chained into `pnpm source-names`); the manifests are the file lists at `025ffb4` (figure, 300) and `6d82a52` (environment, 214). `--complete` reports 514 findings today, one per file with no row, and goes on in task 10.2 (Ruling: the plan's step 4 says "PASS without --complete"; that is what the commit gates on).
- Task 6.2: done. Ruling: the plan's `naturalStand(m): Pose` does not exist in the source; the natural stand is `relaxed` (RELAX 0.4: a lighter contrapposto, the free foot a quarter ahead) plus `STAND_SLIDE` (the neck slides back 3 cm times the figure's scale) and `STAND_LIFT` (the chest 0.02 rad up) inside `base`, so the test is on `base` with a stand (`natural-stand.test.ts`). Ruling: the face's asymmetry is `face.asymmetry` and both asymmetries run -1 to 1, as the source's, not `[0, 1]`. Ruling: `standOut` is now the whole value (the source's `standOut ?? armOut`), so the fixture gaits and the five figures examples carry `standOut: 0` and the source's `standElbow` (strut 0.26, loose 0.34, bounce 0.36, still 0.22). The body's new ring numbers moved the leg at every fat, not just above 0 (the profiles are one query now, `body/profiles.ts`), so all three figure goldens were re-recorded once, in this commit with their cause: the body geometry (fat, the leg rings), the stand (`relaxed`, the neck's slide, the chest's lift, the stand leg's 0.9995) and the fixture gaits' `standElbow`. The sim hash did not move. The `Sliders` ends sweep (`slider-ends.test.ts`, 80 cases) passed first run: it guards the sliders, it does not drive new code. `seated` and the seats wait for 6.4.
- Task 6.3: done (session fov5js, 2026-11-07). Rulings: (1) `TimeOfDay` is `{ name, label, scene: { light, sky, haze?, stars?, grade }, figure: { exposure, lift, key } }`, not the plan's `figure: { key, fill, bounce }`: the figure source has no per-time `fill` or `bounce` (a bounce is the floor and a glow at the figure's feet, per lighting, not per time), so inventing them would put fields in the library with no source; `exposure` and `lift` (its `exposure` and `figureLift`) are what the sprite light reads, and `grade` is the source's ambient colour and `tint`. Colours stay `#rrggbb` as both sources and the editors have them. Cost if wrong: a rename when 8.2 consumes it. (2) Only reach, look and flinch become `figure-action` files (the plan's file list names them); the source's nineteen pose-spec actions (wave to handshake) need its spec-to-pose IK and are `left out` in `sources.md` with the reason, as are `lighting/grade.ts` and `light.ts` (the colour moves and `lightFigure` are the look's sprite light and reference, 8.2). Cost if wrong: those actions are a later pull. (3) An action compiles to a clip (`compileAction`) and `clipsWithActions(clips, actions)` merges them, so `evaluate` stays the only player; the content kind's id clashes with a `figure-clip` id are an error naming it. The `loop: [from, to]` repeat range of the source is not carried (no consumer). (4) `Ease` gained `smooth` and reads `hold` as `step` through `easeSchema`, in `shared/timeline/ease.ts`; `Key`, `Track`, `sample`, `bracket` and `wrapTime` are generic over the clip's own `{ t, ease? }` keys, so a clip's authored keys are not copied per frame. A key with no ease is linear (the environment source's default was `inOut`; the maps converter, 7.3, writes `inOut` explicitly). (5) Reach, look and flinch moved from fixture clips to fixture actions and are also copied into base-3d with their four poses (the plan's `games/base-3d/src/content/figure-actions/`; 11.1 moves them again); the recorded F-g end poses pass unchanged. (6) The lamp is `FigureLamp` (`features/figures/lighting/lamps.ts`) to keep it apart from the scene-lighting `Lamp`; the level's lamp kit (7.3) decides how they meet. Counts (Chromium not needed): 3d unit 963 in 96 files, base-3d unit 82. Resume at task 6.4.
- Task 6.4 part 1: done (session fov5js, 2026-11-07). Rulings: (1) The garment registry (`registry/garment-registry.ts`, `registerGarment`, `RegistryClash`) holds the classic kinds with a `wear` function and the streetwear kinds with a `build`; `dress` dispatches on whichever the kind has, and a kind none of the registry knows is `No garment called "x" is registered`. The registry files are `*-registry.ts`, not `*.registry.ts`, because `pnpm style` has no `registry` role. (2) `ExtensionDef` has no setup hook, so kinds register when their module loads (`classic-kinds.ts`, and the 6.5 wardrobe extension on import); `figure.schema.ts` imports both so a schema parse always sees them. (3) `keyedUnion` takes a thunk for its members and reads it on every parse, so a kind registered after the schema is built is accepted. (4) The plan's test `core registers only the classic set` waits for 6.5, which removes streetwear from core; today the test checks the classic set is a subset. Session break: inside 6.4, after the garment and outfit-hook registries; the hair pieces, finishes and fabrics registries, the fit work (`girth`, `ringAt`, collar, cuffs), the seats and the head-wear fold remain. Cost if wrong: none.
- Task 6.4 part 2 (fit): done (session fov5js, 2026-11-07). Rulings: (1) `girth`, `clearance`, `Body` and `bodyOf` live in `body/profiles.ts` beside `profiles`, not in `outfit/fit.ts`, because the layers let the body's query be read by the garments and the source's `fit.ts` imported the hair file only for `PPM`; the clearance is one texel at the fixed `FIGURE_PPM` (`bodyOf(m, s)` has no density argument, AF draws at one density). (2) The plan says "Wick unchanged", but a cuff that hugs the arm is the task, so Wick's and the keeper's cuffs move: `dress.json` is re-recorded in this commit with its cause; the other recorded files (`motion.json`, `actions.json`) and the 24 Chromium figure goldens did not move. The sim hash did not move. (3) `Wearing` (streetwear/registry kinds' context) gained `body: Body` and `Dressing` gained the same, so a kind sized from `body.girth(...)` plus `body.clear` clears any body. The tests are `tests/unit/figures/outfit/fit.test.ts` (girth box, clearance floor, `bodyOf`, cuff = girth + one texel for both bases and both sleeves, cuffs at the ends of fat, muscle and frame, fat grows the cuff, the collar rides the neck and not the bust); the source's mesh-against-ellipse clearance sweep over every slider end at three densities is not carried because AF has one density and the cuff test reads the same girth the cuff is built from.
- Task 6.4 part 3 (hair, finish and fabric registries): done (session fov5js, 2026-11-07). Rulings: (1) `registerHairPiece(kind, { schema?, build, crown? })`, `registerFinish(name, { matte })` and `registerFabric(name, fabric)` each throw `RegistryClash` (`A hair piece called "x" is already registered`) and the base generators (scalp, rows, tail, fall, bun, sweep, block, edges) and base finishes (coil, braid, loc, sleek, straight) count as taken. A finish is only `matte` in the 3D look (tones are swatch variants), not the source's `tones` triple. (2) A registered piece's data is read through its own `schema` (or any value when it has none) in the hair style schema, which reads the registry at every parse, as `keyedUnion` already does for garments; a style naming a finish no one registered is refused with the list of finishes there are. (3) A fall the cap leaves out stays silent; a piece that is not a base generator and not registered is a `RangeError` naming it, at build. (4) Fabrics have a registry and `labelAt` but no consumer: the painter that reads the labels is not taken (spec section 4.4.1), so nothing in the look moves. Cost if wrong: a later pull of the painter.
- Task 6.4 part 4 (low pony): done (session fov5js, 2026-11-07). `Tail.hang = "down"` ties the pony where `at` says (the nape) and sends it straight down the back, no rise and no arc; the base figures and goldens did not move (the field is optional). Test: `tests/unit/figures/hair/tail-hang.test.ts` (a low pony's top is under the head's middle where a high one reaches the crown; the schema takes `down` only). Still open in 6.4: the bun's `flat`, the new fall's `curl` and `volume` (AF's `fall` is the older lock list, so the new one needs a shape that tells them apart), seats, and folding the `figure-headwear` kind into the garment registry.
- Task 6.4 part 5 (bun): done (session fov5js, 2026-11-07). The bun is the source's flattened spiral (`flat`, default 0.6; `turns`, default 2.5, now optional) in place of the older coil; `model-puffer`'s part list moved, so `dress.json` is re-recorded in this commit with its cause (motion.json and actions.json did not move; the 24 Chromium figure goldens pass). Test: `tests/unit/figures/hair/bun.test.ts`.
- Task 6.4 part 6 (loose hair): done (session fov5js, 2026-11-07). Ruling: the source's newer `fall` (a hairline `from`, `count`, `length`, `curl`, `volume`) is `hair/loose.ts` and shares the `fall` key with AF's older list of locks (`at`, `lift`, `plumb`): the schema is a union of the two and the builder tells them apart by `from`. The older one stays because the fixture styles and the goldens use it; the source's newer base dropped it for a fork, and a later cleanup can move it to a registered piece. The finishes `smooth` and `curl` joined the base ones. No recorded file moved (no fixture uses the new fall). Test: `tests/unit/figures/hair/loose.test.ts`. 6.4 still open: seats, and folding `figure-headwear` into the garment registry.
- Task 6.4 part 7 (seats): done (session fov5js, 2026-11-07). Rulings: (1) The seats are a `figure-seat` content kind (folder `figure-seats`, `Seat` and `SeatHand` in `content/seat.schema.ts`) instead of the source's `SEATS` code table, as stands and gaits are; the eight seats are fixture files. (2) `seated(s, gait, seat, t)` is in `motion/seated.ts` with no `lookUp` or `view` (AF has no sprite cheats); `placeHems` takes a fifth argument `seated`, and `sideBend` is exported from `motion/base.ts`. (3) The seat test runs on the base man: a seat's height is fixed, so a shorter body (Wick) cannot put its ankle on the floor in the slump seat (6.8 mm short); that is the seat's, not a bug. No recorded file moved. Still open in 6.4: folding `figure-headwear` into the garment registry.
- Task 6.4: done (session fov5js, 2026-11-07; the parts are logged above). Last ruling: the plan's "the `figure-headwear` kind folds into the garment registry" is met by the registry holding `cap` (a classic kind, `classic-kinds.ts`) and the `figure-headwear` library staying a content kind, because styles of headwear are shared by figures and games the way hair styles are; folding the library into inline fields would break every figure file and the editors for no consumer. Cost if wrong: a content migration. The test `core registers only the classic set` is exact only after 6.5; today it checks the classic fifteen are a subset. Counts: 3d unit 1010, base-3d unit 82, editor-3d 2196; 24 Chromium figure goldens pass. Resume at task 6.5 (see /mnt/project-files/refactor/2026-11-07-3d-build-handoff-fov5js.md for the size of the move).
- Task 6.5: done (session d60hqd, 2026-11-07). Rulings: (1) The wardrobe is its own workspace package, `@af-examples/wardrobe-3d` (`examples/3d/wardrobe/`, with `package.json`, `vitest.config.ts`, `tests/unit`, `tests/browser/parity`, `goldens/`, `scripts/record-goldens.ts`), not files inside `@af-examples/examples-3d`: the examples catalog skips a folder with a `package.json`, which a library of eleven builders needs (they are not one-file examples with a header and a 100-line budget). It joins `test:unit:3d` and `test:browser:3d`. The plan's "modify `examples/3d/package.json`" and "create `examples/3d/vitest.config.ts`" become the wardrobe's own; `figures-outfits-items.ts` is left alone (it wears classic garments only). (2) The extension-author surface is one new entry, `@automata/3d/figures-kit` (the registries, the contract types, the body, rig, mesh, skinning, hair and maths a garment builder reaches into), plus `@automata/3d/testing-checks` (the golden checks, browser-safe, because `@automata/3d/testing` loads the content compiler) and a wider `@automata/3d/testing` (compile fixture, random cast, recorders, motion comparisons). The kit loads the classic set first, so a wardrobe's kinds always register after it (`classic-kinds.ts` is now in `sideEffects`). (3) The contract types `Fit`, `Wearing`, `Paint`, `Worn`, `Legs`, `Section` and `Shell` moved to core (`registry/garment-fit.ts`); the wardrobe re-exports them beside its helpers. `Garment` is `Classic | object` (`CustomGarment`), so a wardrobe's interfaces are garments without an index signature. (4) `reachable` (the openings no outer garment covers) is the wardrobe's, set as the outfit hook `anchors`; the hook gained a third argument, `{ m, s, garments }`. Core's default is every opening the kinds published, and the classic kinds publish none. (5) Core's golden outfits keep their bodies, hair and caps and wear classic garments where they wore streetwear (renamed `model-braids`, `tall-fade`, `model-bun`, `tall-locs`, `model-quiff`), so hair-piece coverage stays in core; the seven streetwear outfits are the wardrobe's (`testing/wardrobe-outfits.ts`). Core's random cast draws a classic outfit when no registered garment has a layer; a wardrobe passes its draws (`randomCharacter(seed, library, draws)`). (6) The stands that need pockets (fall back, hand in pocket) are checked in the wardrobe; core asserts only that every stand ends relaxed. Evidence the move changed nothing: the wardrobe's recorded dress and stand goldens equal, as JSON, the entries those outfits had in core's `dress.json` and `motion.json` at 2783cd05. Cost if wrong: a game wanting streetwear adds `examples/3d/wardrobe` as a dependency or copies it; `grep -rn "bomber\|hoodie\|puffer" packages/3d/src` finds nothing. `docs/refactor/move-map-3d.json` still names the old folder (a record of task 2.1).
- Task 7.1: done (session d60hqd, 2026-11-07). Rulings: (1) `afSectorSchema` stays the strict `/1` envelope; `/2` is `afSector2Schema` and the one door is `readLevel(json)` (either format in, a `/2` level out, `migrated` true for a `/1` file, a `LevelProblem` list instead of a throw). The plan's "`af-sector.schema.ts` reads `/1` and `/2`" is `readLevel`, because editor-3d's whole edit model is typed on `/1` (`floor: number`) until the phase 14-16 rewrite, and widening `afSectorSchema` would have broken its 2,196 tests for no reader. (2) The editor therefore still opens and writes `/1` in this task. The "This level was made with an older version. Saving updates it." line, and writing `/2` on Save, move to task 14.1 (`shared/level-session/` reads through `readLevel`) and 16.2 (the inspector edits `/2` fields). Until then the editor cannot open base-3d's room, which is now `/2`. Cost if wrong: one phase of an editor that opens the toy `/1` levels only. (3) `LevelProblem` is its own interface (`path`, `code: string`, `message`, `where`, `name?`), not `extends Problem`: `@automata/content` does not export `Problem`, and its `code` is the closed `DiagnosticCode` union, which cannot hold `unknown-kit`. The checks task (9.2) maps a `LevelProblem` to a diagnostic where `automata check` places it. (4) A plane is the one thing the `/2` schema transforms: a number parses to `{ z }`, so every reader sees one shape. A file may still write a number (the migrated room does). (5) `/1`'s wall `texture` is `/2`'s `surface`, and a `/2` wall's `trim` is `/1`'s heights object or the builder's surface (an object with a `tile` is the surface). (6) A builder `shade` step is a tenth of light (`light = 1 - 0.1 * shade`, rounded to 0.01): the builder's maps use shade 0, 1 and 2 only, and its painter lights per vertex, so the value only has to order the rooms. (7) The builder's map name `name` becomes `title`; `name` is the id (the file name), as `/1`. Decals and lettering are carried as written (`Marking`) until 7.3 ports the generators that read them. A portal (`next`) between two builder sectors is not inferred: the builder joined rooms by shared edges, and the world builder (7.2) decides which edges are shared. (8) base-3d's room is `/2` with `pit: true` on the two channels (a floor below 0 no longer means a pit) and the three camera views in its `views`; `ROOM_VIEWS` is gone, and `areaFromSector(json, { file })` reads either format. (9) `convertBuilderMap` lives in `features/world/convert-builder-map.ts`, not `shared/level/`, and is not exported from `@automata/3d/level`: that entry is a sim entry that imports nothing but zod (`sector-format.test.ts`), and the converter is a build-time tool (the script and tests import it directly). Evidence: 113 level tests in `packages/3d`, 84 base-3d unit tests (82 + 2 new) with the sim and render goldens unchanged. Also recorded: 5 builder maps convert and parse back unchanged. Resume at task 7.2 (the world builder; session break after mesh).
- Task 7.2: done (session h7alco, 2026-11-07). Rulings: (1) Walls are built whole, in the first-person way: a level is not cut for a view (the diorama's `dollhouseStub`, `wallInDiorama` and `lintel*` and the top-down clip are the editor's, per the Owner's 11:04 word), so `features/world/` has no `MapView`. (2) The shared stretch of an edge is found by geometry (the source's rule, T-junctions included); a wall's `next` is accepted only if it names a room that shares some stretch of that edge, else `portal-not-shared` (and the stretch stays solid). Cost if wrong: a Last Light level whose rooms touch with a solid wall and no `next` opens there. (3) `WorldLibrary` is `{ swatches }` for now (the builder only asks whether a name is there; an unknown name is `unknown-swatch`); kits, props and glyphs arrive with 7.3. (4) A wall's `door` and `window` (the `/1` vocabulary) are openings cut from its face (a lintel above, a breast under a window; a window gets a pane and bars); a door opening is left empty, the game's door entity fills it. `decor` (a window, door or shopfront drawn on the wall) and `windows` (a facade grid) are the builder's, ported. A `sign` draws nothing until 7.3 ports the lettering. A sector-level `trim` and a wall's `trim` heights give skirting and rail; `wainscot`, `cap` and `capital` (the editor blockout's) are not drawn. (5) A hinged door is built shut and its piece carries `door: { hinge, swing }` for 7.4's `update-pieces` to turn it. (6) `drawWorld(scene, pieces)` takes the colour of a swatch from the caller (`colourOf`): the swatch content kind and its colours are 7.3. (7) `Occluders.face(mesh, span, occlude?)` is new: the occluder rule's walls were slabs it built itself; a face the builder made registers as a wall with no thickness and no floor trim. A face that never rises above the floor (the side of a pit) follows no rule. (8) base-3d's room draws through the builder: its file names its surfaces (`floorTexture`, `ceilingTexture`, `wallTexture`: `floor`, `ceiling`, `wall`, `lava` for the channels), the game gives each a DUEL colour, and the two pit sectors' ceiling is 3 like their neighbours (it was 0, a lid at floor level). `areaFromSector` still reads the file for the sim (the sim needs boxes), so `sector-area.ts` stays; what left is `sceneOf`, the wall and floor boxes and the lava box (`channelBoxes` is `lipBoxes`). The visible change, from the opened before and after frames (project files `refactor/2026-11-07-3d-7-2-room-shots/`): a wall is a face and has no thickness, so the dark top of each wall slab and the floor-trim stub at the near edge are gone; a channel now has walls and a lava floor of its own. Sim hash and goldens unchanged. (9) editor-3d's `view/mesh/sector-mesh.ts` is not replaced: the editor's blockout carries a selection id and an `occlude` per surface and is typed on `/1` until 14.1 and 16.2 (task 7.1's rulings 1 and 2); the swap goes with them. (10) There is no `app/compose-scene.ts` yet (6.x did not create it): the game's `scene` hook is the composer, and 7.4 adds `startClip` where it lands. Cost if wrong: one hook moved. (11) Holes: the plan did not say; a hole is walled and left out of the floor by a bridged ear-clipping (`fill`). Evidence: 41 new unit tests in `tests/unit/world` and `tests/unit/app`, 3 more in the occluders' tests; base-3d unit 85 with the sim hash unchanged; the game boots in Chromium and both frames were opened. Resume at task 7.3 (props, the dresser, lamps, decals, lettering, generated maps; session break after props).
- Task 7.3: done as the scope ruling trimmed it (session 50d3sw, 2026-11-07; the Owner's 19:28 word: 3D as light as 2D, the rest in extensions; the ruling came from the "Trim 3D core to match 2D" thread). Rulings: (1) The first half was built whole (commit 78e0ca7f: 70 prop presets and their generators, the kits, lettering, the lamp kit) and then cut back: that commit stays on the branch as the source the world-kit extension ports from; the dresser (`dress/*`, `world-kit.schema.ts`, written but never committed) is in project files `af-world-kit-source/`, with `props.json` and `swatches.json`. (2) Core keeps: `placeProps`, `props/piece.ts`, `props/resolve.ts`, a generator registry (`registerPropGenerator`, throwing `RegistryClash` on a taken name, also core's `box` and `cylinder`), the lamp kit and the level's lamps and a prop's lights, the `world-swatch` and `world-prop` content kinds, doors and windows. `RegistryClash` moved to `shared/registry/` so the figures' registries and this one share it. (3) Out of core: the furniture, small-thing, street, nature and sign generators, the prop, swatch and kit libraries (`CORE_LIBRARY`, `mergeLibrary`), lettering, glyphs and `stream.ts`, the dresser, the `world-kit` content kind, decals, `generateMap` (apartment and block), the converted builder maps, `convert-builder-map.ts` and its script, test and fixture (task 7.1 built them; the `/2` schema's comment now names the extension's converter). `world-prop`'s schema checks only that `kind` is a string: an extension's kind may register after the content is read, so a kind with no generator is `unknown-generator` from the builder. (4) The `Marking` decals and lettering fields of `/2` stay in the schema, carried as written; core draws none. (5) The superquadric and limb primitives, noise and colour helpers moved to `shared/math` for the world's props; they stay there (the figures import them from it), the cost being one more shared folder if wrong. (6) Ember Hall's room has no kit: its file places five crates and barrels (`props`); its swatches (`wall`, `floor`, `ceiling`, `lava`, `crate`, `barrel`, DUEL steps, the colours the views had) and its two presets (a `box` and a `cylinder`) are TOML under `games/base-3d/src/content/world-swatches/` and `world-props/`, compiled with the `world-swatch` and `world-prop` kinds (new Node-safe entry `@automata/3d/world-content`, listed in the game's `vite.config.ts`), and `roomWorld(content)` builds the room from them; the views read each colour from the swatch (`swatchColour`), only the lip's stays in code. It has no lamp or time of day: nothing in base-3d lights from a lamp until 8.2's look, so a lamp written now would be dead data. Cost if wrong: one lamp and one `time` added to the file. (7) A room with `dress` (its own or the level's, unless the level's `keep` is false) is drawn bare with a `needs-extension` problem (`name: 'world-kit'`, the scope trim's words). The generator registry holds core's `box` and `cylinder` from the start (`registeredPropGenerators()`), and `world-prop` accepts any `kind` string. The sim hash and goldens are unchanged (85 unit tests; `sim-content.hash` did not move, `content.hash` did for the new TOML); the crates and barrels stand clear of the embers and the roll path. Frames: project files `refactor/2026-11-07-3d-7-3-room-shots/` (`before.png`, `after.png`: the far wall of the first room now has two crates and a barrel). Evidence: 107 world and app unit tests, base-3d's 7 Chromium journeys, knip, boundaries and style clean. Resume at task 7.4 (the stage); 8.2's passes, 9.1, 9.2 and the 6.x follow-ups are held until the amended plan.
- Scope trim (session 2kk058, 2026-11-07, Opus): the Owner at 19:28, "Make sure we're not overscoping 3D, it should be as lightweight as 2D, everything else should go into plus", and at 19:31, "we aren't just moving stuff around right?". Ruled feature by feature against 2D core in [2026-11-07-3d-scope-trim.md](2026-11-07-3d-scope-trim.md) (measured at `78e0ca7f`): 7.3 trimmed to placement through a generator registry, `box` and `cylinder`, lamps and the two content kinds; 7.5 (one sector geometry) and 7.6 (clothes, hairstyles and seats leave core) added; 8.2 without reference painters or sky and rain; 9.1 and 9.2 moved to the Plus port (3.8); 12.1, 12.2, 13.3, 14.1, 16.1 to 16.3 and 17.2 amended; refactor findings R1 to R11 placed in tasks here and in the port's addendum (section 6 of the trim document). Accepted under "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals" (Owner, 2026-10-31).
- Task 7.4: done (session 50d3sw, 2026-11-07). Rulings: (1) `PieceStates` is `{ doors, lamps, props }` as the plan says; a door is its room's (`doors[<room id>]`, a hinged door being a doorway sector's), clamped to 0..1; a prop's state is `{ at?, turn?, hidden? }` about its base; a lamp's is `{ level, color? }`. (2) `updatePieces(view, before, after)` touches only the pieces whose state differs and returns how many; a door turns about its hinge by `swing × open`, a prop's pieces move, turn and hide together. To know which pieces those are, `WorldView` now carries its `pieces` and a prop's `WorldPiece` carries `prop: { id, at }`. (3) A lamp is not a piece: its state reaches the light through `sceneLamps(lamps, night, states)` (level scaled, colour replaced), next to the sim's own lamp switches. (4) No `app/compose-scene.ts` and no `startClip`: the plan said to give the scene a `startClip(who, clip, atTick)` callback, but there is no composer (task 7.2's ruling 10) and the figure view already starts a clip from the `action` of the state a game hands it, so a cue from outside sets that; adding a callback now would be a second way to do the same. Cost if wrong: one callback, added where the extension needs it. (5) `PieceStates` and its helpers are exported from `@automata/3d/level` (pure data, so a sim or a cutscene extension reads the same shape); `updatePieces` from the main entry. Evidence: 6 unit tests for the states, 7 for `updatePieces` (a door key changes only that door; the hinge stays put; a prop turns about its base), 1 for `sceneLamps`; knip, boundaries and style clean. WebKit and Firefox not run.
