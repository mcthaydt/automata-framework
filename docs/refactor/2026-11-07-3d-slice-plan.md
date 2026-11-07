# 3D slice refactor: plan

> **For the agent building this:** work through the tasks in order with the superpowers `executing-plans` skill
> (`test-driven-development` for every code change, `verification-before-completion` before ticking a box), followed
> by hand: the plugin is not installed in cloud sessions. **Execution is inline, in the session, with no subagents
> ever** (no Task-tool delegation, no subagent-driven execution, no workflows): the Owner allows none. Steps use
> checkboxes (`- [ ]`). Tick a step only when its check has passed, in the same session, and update
> [progress.md](progress.md) at the end of every task (section "Tracking").

**Goal:** carry out the [spec](2026-11-07-3d-slice-spec.md): AF ready to ship 3D. Someone makes a 3D game, edits its
level and its hero in one redesigned editor suite on a phone, an iPad or a computer, sees the change in the game, and
(once Pixi 3D is public) publishes it; the 3D code is one feature-grouped package that holds everything from
FigureBuilder and EnvironmentBuilder, drawn by Pixi 3D in their pixel-art look on the DUEL palette; the site shows 3D
beside 2D.

**Order (the Owner, 2026-11-07 10:38):** "fix 3D, then the other automata stuff that uses 3D, then editors, then site".
Part A, the 3D core (phases 1 to 10); part B, the rest of AF that uses 3D (11 to 13); part C, the editors (14 to 18);
part D, the site and the release (19, 20). Each part is finished, merged and ticked before the next starts. The one
exception is phase 1's editor test fixes: they are gate work, and every later phase is measured by the gate.

**Tech stack:** as the 2D slice: pnpm 10 + turbo 2.11, Node 24, TypeScript, Vitest 5 with browser mode, Playwright 1.63,
Svelte 5.57, PixiJS 8.22, the vendored `@pixi/3d` 0.1.0-beta.2, Zod 4.6.6, Biome.

**Sessions:** a session is refreshed after 90 minutes (the Owner's rule). Tasks 2.1, 2.2, 6.2, 7.3, 8.2, 14.1, 16.1 and
17.1 do not fit one session and name their breaks (a task may span sessions and still counts once). A session ends
by ticking its steps, updating `progress.md`, pushing, and writing a two-line handoff in this file's execution log.

**Browsers in a cloud session:** only Chromium installs. A step that needs WebKit or Firefox says so; it is ticked
"Chromium here, WebKit/Firefox on the Owner's `pnpm ci:local` or hosted CI" and the progress row says which engines ran.
Node 24 is `/opt/node24/bin`. The 3D editor's browser runs use `--project 'layout (chromium)' --project canvas`.

**Changesets:** `patch` only before 1.0. Only published packages get one; `@automata/3d` is private until phase 20, so
it gets none until then. `@automata/content` (DUEL, the Paraglide fix) and `-tools` (the command) get one.

**Pull requests:** each phase is a PR stacked on the one before (the first on this plan's branch), opened ready, not
draft. The agent may merge its own PR once every check, parity and the 3D workflow included, is green on the head
(AGENTS.md, Owner 2026-10-30, 2026-11-06 "Auto merge").

**Code standard:** spec section 16. Ported code is rewritten to AF's conventions as it lands: minimal, modular, in
the existing patterns, with comments that explain what and why (never plan IDs or source names).

**Reviewed:** written from the earlier thread's draft (branch `claude/project-thread-7exkdq`), then checked against the
checkout at #442's head and both builders at the recorded commits; changes from the draft: the figures move once
(phase 2), one timeline covers clips, actions, camera and scene state (task 6.4), the stage is its own task (7.4), the
photos come in (phase 9), the painters stay out of every browser entry (task 8.2), the suite's phone layout is a task
(15.4), #425's timeout fix is carried (1.2), and every task names its files, tests and checks. The plan audit (stage
3) reviews it next; accepted under the standing rule once its fixes are in.

**Provenance (pulling again):** every task that ports builder code adds rows to `docs/provenance/sources.md`, in the
sections "The figure source" and "The environment source" (spec 7.5): one row per source file, with the source path,
the AF path and *ported* / *rewritten: what* / *left out: why*. Task 6.1 writes the sections' heads (repository, full
commit, licence fact, the pull procedure). A later pull is a planned task: `git -C <builder> diff <recorded>..<new> --
<the rows' source paths>`, then port the diff. `sources.md` is the only file that names them (`pnpm source-names`).

**Builders' checkouts:** add both repositories to the session (`add_repo`), then `git clone --depth 1
https://github.com/mcthaydt/figurebuilder ../figurebuilder` and the same for `environmentbuilder` (the photos, 2.9 MB,
come too: spec veto default 9); check `git rev-parse HEAD` starts `025ffb4` and `6d82a52`, else `git fetch --depth 50
origin <commit> && git checkout <commit>`. Port from those commits only, even if `main` has moved (spec section 14).

**Copy:** every user-facing string a task changes goes in `docs/refactor/copy.md` (sections "3D editors" and "Base 3D"),
old and new, in the same commit, and passes the drunk grandma test: could a drunk grandma tell what is happening and how
to use it?

**Command lines used below:** the module mover is `node tooling/codemods/src/move-modules-cli.ts --map <map> [--dry-run]
[--surface]`; the test mover is `node tooling/codemods/src/cli.ts <package> --environment node|jsdom [--keep-qualifier
<q>] [--dry-run]`.

---

## Tracking

`docs/refactor/progress.md` gains a "3D" slice with the stage table and, during stage 4, this table, one row per task;
the build's percentage is `done tasks / 52`:

```markdown
### Build: 0% (0 of 52 tasks)

| Task | Phase | Status | PR |
|---|---|---|---|
| 1.1 Every unit test in `check` | 1 | Not started | |
...
```

At the end of each task: set its row to "Done, <date>" with the engines that ran, recompute the build percentage and
the overall percentage, and commit the change with the task.

---

# Part A: the 3D core

## Phase 1: The 3D gate runs and is green (one PR, `claude/3d-gate`)

### Task 1.1: Every unit test in `check`

**Files:**
- Modify: `package.json` (`check` calls `test:unit`; `ci:local` adds `test:browser:3d`, `test:journeys:3d` and the 3D
  e2e), `AGENTS.md` (the gate lines), `docs/status.md`
- Test: `tooling/repo-hygiene/tests/unit/gate-scripts.test.ts` (modify)

- [ ] **Step 1: Failing test.** Assert `check` calls `test:unit` with no `--filter`, and `ci:local` runs
  `test:browser:3d`. Run `pnpm --filter @automata/repo-hygiene exec vitest run tests/unit/gate-scripts.test.ts` → fails.
- [ ] **Step 2:** Change the scripts. Run `pnpm check` → passes with the 3D unit tests (record the counts: the audit
  had 3,836).
- [ ] **Step 3: Commit.** `ci(gate): pnpm check runs the 3D unit tests`

### Task 1.2: The 3D workflow, on and lean

**Files:**
- Modify: `.github/workflows/3d.yml` (paths: `packages/**`, `games/base-3d/**`, `examples/3d/**`, `vendor/pixi-3d/**`;
  the 3D editor's journeys (today in `3D - unit and iPad journeys`) and `3D journeys (base-3d and the 3D examples)`
  become one job, `3D - journeys`, that installs Chromium and WebKit once; `3D - unit` keeps `test:unit:3d`),
  root `package.json` (#425's timeout fix: every `test:browser*` script `--concurrency=2` and `--hookTimeout=90000`)
- Test: `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts` (the 3D workflow runs on pull requests and has
  three jobs), `tooling/repo-hygiene/tests/unit/gate-scripts.test.ts` (#425's assertions: concurrency 2, hook timeout)

- [ ] **Step 1:** `git diff origin/claude/project-thread-xe0752...origin/claude/project-thread-ajhkmg` → take only the
  `package.json` and `gate-scripts.test.ts` hunks (the pause was reverted on #425 itself). Failing invariants, then the
  YAML and the scripts. `pnpm lint:actions` if Docker is there, else a YAML parse and "actionlint: the Owner's" in the log.
- [ ] **Step 2: Commit.** `ci(3d): one journey job, browser runs at concurrency 2; the 3D workflow runs on every
  package change`. If #425 is still open, comment on it that the fix is carried here and close it (its branch is the
  Owner's to delete).

### Task 1.3: One scroll region per dialog (the seven `open-flows` failures)

**Files:**
- Modify: `packages/editor-3d/src/ui/document/ErrorPanel.svelte` (no `data-scroll-region` when inside a dialog: it
  takes an `inDialog` prop the dialog's caller sets), `packages/editor-3d/src/ui/document/open-flows.layout.test.ts`
  (find the list by `getByRole('list', { name: … })`)
- Test: the same layout test; a DOM test that a dialog holds exactly one `[data-scroll-region]`
  (`packages/editor-3d/src/ui/document/error-panel.dom.test.ts`, create; it moves to `tests/` in phase 14)

- [ ] **Step 1: Failing DOM test** (two regions today). **Step 2:** the prop. **Step 3:** the layout test reads by role.
  Run `npx vitest run --project 'layout (chromium)' src/ui/document/open-flows.layout.test.ts` in `packages/editor-3d`
  → 7 pass.
- [ ] **Step 4: Commit.** `fix(editor-3d): one scroll region in the open-problems dialog`

### Task 1.4: The plan clear of the sheet (the Pencil failure)

**Files:**
- Modify: `packages/editor-3d/src/app/plan-controller.ts` (fit-to-room frames the room inside the usable area),
  the plan's stage component in `packages/editor-3d/src/ui/plan/` (reads the usable area from the kit's geometry owner,
  `@automata/editor/kit` layout geometry, not a local measure), `packages/editor-3d/src/ui/plan/sector-tools.layout.test.ts`
  (the journey asks the page for the usable rectangle and draws inside it)
- Test: a unit test that fit-to-room with an occluding sheet keeps the room inside `usable` (`plan-controller.test.ts`)

- [ ] **Step 1: Failing unit test.** **Step 2:** fit to the usable area. **Step 3:** the layout test at all five
  non-compact sizes → passes, iPad mini landscape included.
- [ ] **Step 4:** Run the whole editor-3d Chromium set → 195 pass, 0 fail (the audit's 187 + 8). **Commit.**
  `fix(editor-3d): fit the plan to the area the sheet and tools leave`

### Task 1.5: Every action whole and inside

**Files:**
- Modify: `packages/automata/src/testing/ui/layout-contract.ts` (`checkLayout` adds the "actions whole and uncovered"
  rule: every button, link, tab and menuitem inside `[data-region="topbar"]`, `[data-region="dock"]` or
  `[data-region="tools"]` lies inside the viewport and `elementFromPoint` at its centre is itself or a descendant), the
  layout tests of `packages/editor` and `packages/editor-3d` (they already call `checkLayout`; regions get the
  attribute where missing)
- Test: `packages/automata/tests/browser/ui/actions-inside.test.ts` (create: a fixture bar with a clipped button fails)

- [ ] **Step 1: Failing browser test.** **Step 2:** the rule. **Step 3:** run the editor layout suites in Chromium:
  the Studio's phone portrait fails on Publish (T5, expected); mark that one test `.fails` with a comment naming task
  17.1, which removes it. Nothing else may fail; a new failure is fixed here.
- [ ] **Step 4:** API report for `-automata` if `checkLayout`'s options changed; changeset `patch`. **Commit.**
  `test(layout): every action in a bar is whole and uncovered`

### Task 1.6: The 3D editor's journeys in Chromium

**Files:**
- Modify: `packages/editor-3d/vitest.config.ts` (its journeys project lists Chromium and WebKit, through
  `packages/editor/src/testing/kit/journey-project.ts`)
- [ ] **Step 1:** Run `pnpm --filter @automata/editor-3d test:journeys` in Chromium → the 3 journeys pass (fix any
  Chromium-only failure as a product bug with a test). **Commit.** `test(editor-3d): journeys run in Chromium too`

### Task 1.7: Paraglide never leaves an empty folder (T6)

**Files:**
- Modify: `packages/content/src/shared/locale/compile-messages.ts` (`compileInFolder` compiles into a temporary
  folder beside the output, copies files whose bytes changed, deletes files that are gone, removes the temporary folder)
- Test: `packages/content/tests/unit/shared/locale/compile-messages.test.ts` (an unchanged compile writes nothing:
  mtimes unchanged; during a compile the folder is never empty: a watcher records every state)

- [ ] **Step 1: Failing tests.** **Step 2:** the change. **Step 3:** run base-3d's browser projects three times in a
  row → no "Could not load src/paraglide" error. Changeset `patch` for `-content`. **Commit.**
  `fix(content): compile messages without emptying the output folder`

---

## Phase 2: One 3D package (two PRs)

### Task 2.1: The move map and the package (PR `claude/3d-package`; **session break** after the dry run if needed)

**Files:**
- Create: `docs/refactor/move-map-3d.json` (every file of `packages/render-pixi3d/src`, `packages/figures/src`,
  `packages/sector-format/{src,blockout}` → `packages/3d/src/…`), `packages/3d/{package.json,tsconfig.json,
  vitest.config.ts,biome.json}`
- Delete (by the move): `packages/render-pixi3d`, `packages/figures`, `packages/sector-format`
- Modify: every importer (`packages/editor-3d`, `games/base-3d`, `examples/3d`, `tooling/frame-budget`), root
  `package.json` (`boundaries`, `style`, the `:3d` filters: `./packages/3d` in place of the three), `knip.json`,
  `turbo.json` if it names them, `.github/workflows/3d.yml`, `packages/editor`'s `--forbid` list (`@automata/3d` in
  place of `@automata/render-pixi3d,@automata/figures`)

The target folders (spec section 2's map; the figures go straight to their final folders, so phase 6 ports file
beside file and nothing moves twice):

```text
packages/3d/src/
  entries/       index.ts, sim.ts, level.ts, figures.ts, camera-view.ts, no-eval.ts, testing.ts
  app/           create-renderer.ts (was create-pixi3d-renderer.ts), render3d.extension.ts, figures.extension.ts
  features/
    renderer/    renderer/, context loss, models, bundle
    no-eval/     no-eval/
    camera/      camera/, camera-view, views/ (the Crow Country camera)
    look/        light/, occluders/ (the passes come in phase 8)
    figures/     body/ (genes, parts, rig), motion/ (motion, pose, solve), hair/, outfit/ (garments; streetwear until
                 phase 4), figure/ (build, figure), clips/ (clip, evaluate), content/ (library, content)
    level/       af-sector.schema, sector.schema, occlude, blockout/ (until phase 4), sim/ (from render-pixi3d's sim)
  shared/        math, parity helpers
  testing/
```

- [ ] **Step 1:** Record the counts before (`pnpm test:unit:3d`, and `npx vitest run --project 'browsers (chromium)'`
  in each of the three packages). Write the map; `--dry-run` → no unresolved specifier, no clash. Entries: `.` (renderer,
  camera, look), `./sim`, `./level`, `./figures`, `./camera-view`, `./testing`, `./no-eval`; `"automata": {
  "simEntries": ["./sim"] }`; `private: true`.
- [ ] **Step 2:** Run the mover; one import style (`.ts` specifiers, as `packages/automata`; S9).
- [ ] **Step 3:** `pnpm install`, `pnpm typecheck`, `pnpm test:unit:3d` → the same counts as Step 1.
  `pnpm boundaries` with `packages/3d/src/features/level/sim` and `packages/3d/src/entries/sim.ts` in the sim list.
- [ ] **Step 4: Commit.** `refactor(3d): one @automata/3d package from render-pixi3d, figures and sector-format`

### Task 2.2: Tests into `tests/` and the rules (same PR; **session break** after the mover runs if needed)

**Files:**
- Move: every `*.test.ts` of `packages/3d/src` → `packages/3d/tests/{unit,browser,parity}/…` with `#src/…` imports
- Modify: root `package.json` (`boundaries --features packages/3d`, `style --plan-comments packages/3d/src
  --test-imports packages/3d`), `packages/3d/vitest.config.ts` (projects by folder)

- [ ] **Step 1:** `node tooling/codemods/src/cli.ts packages/3d --environment node --keep-qualifier parity
  --keep-qualifier bench --dry-run`, then for real. **Step 2:** `pnpm boundaries`, `pnpm style` → the plan-comment rule
  reports the plan IDs; they are removed in task 10.1, so `--plan-comments` for `packages/3d` is added in 10.1, not here.
- [ ] **Step 3:** `pnpm test:unit:3d` and `npx vitest run --project 'browsers (chromium)'` in `packages/3d` → parity 17
  and goldens 24 pass. **Commit.** `refactor(3d): tests in tests/, feature boundaries on`

---

## Phase 3: Effect out of the 3D package (one PR, `claude/3d-no-effect`)

### Task 3.1: The renderer in plain TypeScript

**Files:**
- Modify: `packages/3d/src/app/create-renderer.ts` (was `create-pixi3d-renderer.ts`), `features/renderer/context-loss.ts`,
  `features/renderer/load-models.ts`: `Scope` → `Disposables` (`disposables()` from `@automata/framework`, the
  runtime surface in `packages/automata/src/entries/runtime.ts`); `Effect.gen` → `async` functions; `Runtime` gone;
  time through the framework's `Clock` (tests use the framework's `fakeClock` from `@automata/framework/testing`)
- Modify: `packages/3d/src/testing/compile-fixture.ts` (no Effect), `games/base-3d/package.json` (drop `effect`) and its
  one test
- Test: the existing renderer and context-loss tests, rewritten to a fake `Clock` and `disposables()`

- [ ] **Step 1:** A failing test: `packages/3d/tests/unit/no-effect.test.ts` greps `packages/3d/src` and
  `games/base-3d/src` for `from 'effect'` → finds 4 files. **Step 2:** rewrite each. **Step 3:** unit and Chromium parity
  pass. Add `--forbid packages/3d:effect` to `boundaries` and delete the grep test. **Commit.**
  `refactor(3d): the renderer without Effect`

---

## Phase 4: Cuts (one PR, `claude/3d-cuts`)

### Task 4.1: The source game's level format goes (D3)

**Files:**
- Delete: `packages/3d/src/features/level/blockout/`, the `./blockout` entry, `packages/editor-3d/src/format/` (the four
  re-export files and `blockout.schema`, `facility.schema`, `expand`), `src/profile/last-light-*`,
  `src/checks/facility/`, `src/checks/last-light/`, `src/model/facility-*`, `src/testing/toy-blockout.ts`,
  `src/testing/shipped-facility.ts`, and their tests
- Modify: `packages/editor-3d/src/profile/registry.ts` (one profile, a plain import), every importer of `format/`
  (to `@automata/3d/level`), `docs/provenance/sources.md` (rows for the deleted files marked "removed 2026-11, D3")

- [ ] **Step 1:** `grep -rln "blockout\|facility\|last-light" packages/editor-3d/src packages/3d/src` → the list; delete;
  `pnpm typecheck` and `pnpm knip` find the rest. **Step 2:** editor-3d unit + Chromium layout pass (counts drop by the
  deleted tests; record). **Commit.** `refactor(3d): AF's editor opens af-sector levels only`

### Task 4.2: The wardrobe leaves core (D6, B2)

**Files:**
- Move: `packages/3d/src/features/figures/streetwear/` → `examples/3d/wardrobe/` with a `wardrobe.extension.ts` that
  registers it; the `figure-headwear` content kind moves with it
- Modify: `examples/3d/figures/figures-outfits-items.ts` (registers the wardrobe), `games/base-3d/src/content/figure-headwear/`
  (Wick's cap stays base-3d content; until task 6.3's registries land, the `figure-headwear` kind is registered by a
  small `games/base-3d/src/cap.extension.ts`, never by importing the example; spec 7.3)
- Test: `examples/3d/tests/wardrobe.test.ts` (a figure in a bomber compiles through the extension); goldens that wore
  streetwear move to the example

- [ ] **Step 1–3:** failing example test, the move, `pnpm test:unit:3d` and the example's tests pass. **Commit.**
  `refactor(3d): the streetwear wardrobe is an example extension`

### Task 4.3: Goldens recorded from AF's own code (S7)

**Files:**
- Create: `packages/3d/scripts/record-goldens.ts` (records `tests/fixtures/goldens/*.json` from AF's generator)
- Delete: `packages/3d/scripts/*-goldens.ts` that need a source checkout
- Test: `packages/3d/tests/unit/goldens-fresh.test.ts` (recording into a temporary folder gives the committed files)
- [ ] **Step 1:** Record; the diff against the committed goldens is empty (AF's code reproduces them). If not empty,
  stop and investigate: a golden difference here is a bug in the move, not a rebaseline. **Commit.**
  `test(3d): goldens recorded from AF's own code`

---

## Phase 5: DUEL is AF's palette (one PR, `claude/duel-palette`)

### Task 5.1: The palette in `-content`

**Files:**
- Create: `packages/content/src/shared/palette/duel.ts` (the 32 × 8 ramps from FigureBuilder
  `src/features/paint/duel-ramps.ts` at `025ffb4`, with DUEL's credit)
- Delete: `packages/content/src/shared/palette/endesga-64.ts`
- Modify: `packages/content/src/shared/palette/palette.ts` (`DEFAULT_PALETTE` = DUEL row-major; `ramps`, `rampOf`,
  `step`), `packages/content/src/entries/palette.ts`, `packages/content/src/shared/assets/build-atlases.ts`
- Test: `packages/content/tests/unit/shared/palette/palette.test.ts` (256 colours, `rampOf(r * 8 + s)` is `r`, `step`
  clamps at a ramp's ends, the first ramp is the greys), `content-hash.test.ts` and `compile-content.test.ts` (new
  hashes, each named in the commit), `browser-entries.test.ts`

- [ ] **Step 1: Failing palette tests.** **Step 2:** DUEL in. **Step 3:** `pnpm --filter @automata/content test:unit`
  → passes with the new hashes. `docs/provenance/sources.md` row; `docs/art/` gets DUEL's source and credit, Endesga
  64's page goes. API report, agent skills, changeset `patch`. **Commit.** `feat(content): DUEL is the default palette`

### Task 5.2: Emberwick, the theme and the 2D examples on DUEL

**Files:**
- Modify: `games/emberwick/src/shared/art/{palette.ts,sprites.ts,PROVENANCE.md}`,
  `games/emberwick/src/features/scene/backdrop.ts`, `games/emberwick/main.ts`, every Emberwick file that names an
  Endesga index (`grep -rln "Endesga\|endesga" games/emberwick`), `packages/automata/src/shared/ui/theme.css`,
  `packages/automata/tests/unit/shared/ui/theme.test.ts`, the 2D examples that name palette indexes,
  `agents/automata` API reference, the editors' game-art colours (`packages/editor/src/shared/level-2d/canvas/colors.ts`
  layer colours, the 3D plan's room fills in `packages/editor-3d`), not `tokens.css` (spec veto default 11)
- Create: `tooling/codemods/src/remap-palette.ts` (one-off: maps an Endesga 64 index to the nearest DUEL index in
  OKLab, prints the table; kept with a test, since a later palette pull needs it again)
- Test: `games/emberwick/tests/unit/shared/art/art.test.ts` (every art index is a DUEL index), `theme.test.ts` (the
  contrast pairs keep their ratios ≥ the current ones)

- [ ] **Step 1:** Take before screenshots (Emberwick title, play, the editor's Level view, the site's Home) at 390 ×
  844, 1194 × 834, 1440 × 900 into the project files' `refactor/2026-11-07-duel-screens/before/`.
- [ ] **Step 2:** Failing art and theme tests; run the remap; hand-fix what reads wrong (each fix in `PROVENANCE.md`).
- [ ] **Step 3:** Emberwick's unit, browser and Chromium journeys pass; the sim hash is unchanged (if not, stop and
  investigate). After screenshots; open before/after/diff side by side; the PR lists every hash and screenshot change.
  Visual acceptance recorded under the standing rule ("Auto approve all visual acceptance too", 2026-10-30).
- [ ] **Step 4: Commit.** `feat(art): Emberwick, the theme and the examples on DUEL`

### Task 5.3: The 3D package on DUEL

**Files:**
- Modify: `packages/3d/src/features/figures/library/swatch.schema.ts`, `features/figures/build/materials.ts`,
  `features/look/` figure colour, `packages/3d/src/testing/golden-checks.ts`, `games/base-3d/src/content/figure-swatches/*.toml`
  (each swatch names a DUEL ramp and step: `ramp = "skin"`, `step = 5`), `games/base-3d/src/views/index.ts`,
  `examples/3d/*` that name Endesga
- Test: swatch schema tests; goldens re-recorded with `record-goldens.ts` (each change named in the commit)

- [ ] **Step 1–3:** failing schema test (a swatch by ramp and step), the change, 3D unit + parity + base-3d's golden
  replay pass. `grep -rn "Endesga\|endesga" packages games examples site docs agents --include=*.ts --include=*.md
  --include=*.css --include=*.toml` → only `sources.md` and the codemod. **Commit.** `feat(3d): swatches are DUEL steps`

---

## Phase 6: Everything from FigureBuilder (two PRs)

Every task ports from `../figurebuilder` at `025ffb4`, writes one `sources.md` row per source file, and checks
against the source's goldens first (`tests/golden/` copied to `packages/3d/tests/fixtures/source-goldens/` for the
comparison only, deleted at the end of task 6.4). Tests come first: the source's own tests under `tests/features/` are
ported as behaviour specs, rewritten to AF's outputs (meshes, joint positions, ring radii), not to painted texels.

### Task 6.1: The provenance sections (PR `claude/3d-figures-port`)

The figures are already in FigureBuilder's folders (task 2.1), so this task only opens the record.

**Files:**
- Modify: `docs/provenance/sources.md` (the sections "The figure source" and "The environment source": repository,
  full commit, licence fact, the pull procedure of spec 7.5, and an empty row table; one row for the `a1f7246`
  extraction the figures came from, which `figures`' comments named, so the record has the starting point)
- Test: `tooling/repo-hygiene/tests/unit/sources-md.test.ts` (create: each builder section names a 40-character commit
  and has the pull procedure; every row's AF path exists or says *left out*)

- [ ] **Step 1:** Failing test. **Step 2:** the sections. **Step 3:** `pnpm source-names` passes (`sources.md` is in
  a record folder). **Commit.** `docs(provenance): where the figures and the world come from, and how to pull again`

### Task 6.2: The body, the stand and the face (same PR; **session break** after body)

**Source files:** `src/features/body/{genes,head,parts,rig}.ts`, `src/features/motion/{motion,presets}.ts`, their
`tests/features/body/*` and `tests/features/motion/*`.

**Files:**
- Modify: `packages/3d/src/features/figures/body/*`, `motion/*` (genes gain `fat` on limbs, neck and jaw, `bust`, `seat`,
  `bodyAsymmetry`, the face's `asymmetry`, `eyeSize`, spacing and tilt; the natural stand: head over the shoulders, a
  straight weight leg, a weight shift, the arms at the thighs), `content/figure.schema.ts` (the new genes, each with a
  default that keeps Wick's goldens), the figure-stands content kind
- Test: ported `packages/3d/tests/unit/figures/body/*.test.ts`, `motion/*.test.ts`; source goldens for the stand and
  the diversity sliders

- [ ] **Step 1:** Port the source tests first, rewritten to AF's mesh outputs (joint positions, ring radii), failing.
- [ ] **Step 2:** Port the code. **Step 3:** unit, AF goldens (Wick unchanged with defaults) and source-golden
  comparison (within the tolerance the test names) pass. `sources.md` row. **Commit.**
  `feat(3d): the natural stand and the body and face sliders`

### Task 6.3: Hair, fit, seats and the registries (PR `claude/3d-figures-outfit`)

**Source files:** `src/features/hair/hair.ts` and `library/`, `src/features/outfit/{fit,garments,items}.ts` and
`library/`, `src/features/figure/{cast,cloth,frames,figure}.ts`, `base/base.ts` (the registries).

**Files:**
- Modify: `features/figures/hair/*` (low pony, bun, fall, curl volume), `outfit/*` (fit from rings and girth; cuffs,
  collars and hems sized from the body; seats), `figure/*`
- Create: `features/figures/registry/{garment,outfit-hooks,hair-piece,finish,fabric}.registry.ts` and their
  `register*` functions exported from `@automata/3d/figures`, used by `defineExtension`
- Modify: `examples/3d/wardrobe/wardrobe.extension.ts` (registers through them), `games/base-3d/src/cap.extension.ts`
  (registers Wick's cap through `registerGarment` instead of a content kind of its own; the `figure-headwear` kind goes)
- Test: ported hair and fit tests (every slider's end keeps cuffs clear of the body: the source's own check), a
  registry test (an extension's garment appears; core holds none)

- [ ] **Step 1–3:** failing tests, the port, unit + goldens + source goldens. `sources.md` rows. **Commit.**
  `feat(3d): hair pieces, garments fitted to the body, and the wardrobe registries`

### Task 6.4: One timeline; lighting; actions as clips (same PR)

**Source files:** FigureBuilder `src/features/lighting/*`, `src/features/actors/{actions,pose-spec}.ts` and
`library/actions.json`; EnvironmentBuilder `src/features/world/timeline.ts` (the key model only; its users come in
task 7.4).

**Files:**
- Create: `packages/3d/src/features/timeline/{key.ts,ease.ts,sample.ts,track.ts}` (moved from `figures/clips/`'s
  `ease.ts`, `sample.ts` and `clip-time.ts`, widened with `smooth`; `hold` is read as `step`; spec 7.4),
  `features/figures/content/figure-action.schema.ts` and `figure-actions.content.ts` (an action compiles to a clip: its
  pose spec becomes keys on the timeline), `games/base-3d/content/figure-actions/` (the actions Wick uses: reach, look,
  flinch, which today are fixture clips; base-3d's content folder moves in task 11.1, so this task writes under
  `src/content/` and 11.1 moves it)
- Modify: `features/figures/clips/*` (read keys and eases from `timeline/`), `features/figures/clips/evaluate.ts` (no
  change in behaviour), `features/figures/lighting/` (the figure's lamps, grade and light from FigureBuilder, as data the
  look reads in phase 8)
- Delete: the fixture clips for reach, look and flinch (now actions), `tests/fixtures/source-goldens/`
- Test: `tests/unit/timeline/*.test.ts` (the cases of both sources' ease and sampling tests: a key's ease, before the
  first and after the last key, a frame at `t` the same drawn alone), `tests/unit/figures/clips/actions.test.ts` (each
  source action compiles; evaluating it at t matches the source's actor at t within the tolerance the test names)

- [ ] **Step 1:** Failing timeline tests (both sources' cases) and action tests.
- [ ] **Step 2:** The timeline feature; clips read from it (the clip tests pass unchanged). **Step 3:** The action kind;
  lighting. 3D unit tests and goldens pass (Wick unchanged). `grep -rn "Ease\b" packages/3d/src` → defined only in
  `timeline/`. `sources.md` rows. **Commit.** `feat(3d): one timeline; actions are clips`

---

## Phase 7: One level format and the world (two PRs)

Ports from `../environmentbuilder` at `6d82a52`, with `sources.md` rows.

### Task 7.1: `af-sector/2` and its migration (PR `claude/3d-level-2`)

**Files:**
- Create: `packages/3d/src/features/level/af-sector-2.schema.ts` (spec section 8), `af-sector-1-to-2.migration.ts`,
  `level/sim/` (what the sim reads: floors, walls, pits, things and their fields, spawn),
  `packages/3d/scripts/convert-builder-maps.ts` (one-off, kept with a test for the next pull: EnvironmentBuilder's
  `maps.json` and base scenes → `/2` files under `features/world/library/maps/`; run in task 7.3)
- Modify: `af-sector.schema.ts` (reads `/1` and `/2`, returns `/2`), `games/base-3d/src/content/levels/room.af-sector.json`
  (migrated), `sector-area.ts` (reads `corners`, pits by flag, views from the file: `ROOM_VIEWS` leaves code),
  `packages/editor-3d` readers (open `/1`, write `/2`)
- Test: `tests/unit/level/af-sector-2.schema.test.ts`, `migration.test.ts` (every `/1` fixture migrates, and `/2` read
  back is equal), base-3d's golden replay (unchanged: the sim reads the same room)

- [ ] **Step 1–3:** failing schema and migration tests; the schema; base-3d's 82 unit and golden replay pass with the
  migrated room, sim hash unchanged. **Commit.** `feat(3d): af-sector/2, one level format for the game, the editor and the world`

### Task 7.2: The world builder (PR `claude/3d-world`)

**Source files:** `src/features/world/{build,sectors,mesh,subdivide,surface,swatches,map,types}.ts`, `src/lib/{geometry,rng,search}.ts`.

**Files:**
- Create: `packages/3d/src/features/world/{build,sectors,mesh,subdivide,surface,swatches}.ts` (renderer-free: an
  `af-sector/2` level → pieces with swatch materials; sloped planes, sky, wall decor, window grids),
  no rng of its own (EnvironmentBuilder's `lib/rng.ts` is replaced by `createRng` from `@automata/sim`)
- Modify: `features/renderer/` draws world pieces (the room in base-3d is built by the world builder, not by the old
  sector mesher, which is deleted)
- Test: ported `tests/features/world/*` for build and mesh; render parity for base-3d's room re-recorded once, the
  commit explaining the change (the world builder replaces the mesher)

- [ ] **Step 1:** Port the source's world tests first (build, mesh, subdivide, surface), failing. **Step 2:** the
  builder, then the renderer draws its pieces and the old mesher goes. **Step 3:** 3D unit, render parity (re-recorded
  once, expected/actual/diff opened and the change explained) and base-3d's golden replay (unchanged) pass. `sources.md`
  rows. **Commit.** `feat(3d): the world builder draws levels`

### Task 7.3: Props, the dresser, lamps, time, decals, lettering, generated maps (same PR; **session break** after props)

**Source files:** `src/features/world/{props,dress,decals,lettering,generate,timeline}.ts`, `library/{props,kits,glyphs,maps,swatches}.json`.

**Files:**
- Create: `features/world/{props,dress,decals,lettering,generate}.ts` (`generate` emits `/2` and takes AF's seeded
  rng), `features/world/library/{props,kits,swatches,glyphs}.json` and `library/maps/*.af-sector.json` (from
  `convert-builder-maps.ts`), the content kinds `world-kit`, `world-prop`, `world-swatch` (`*.schema.ts`,
  `world.content.ts`, so a game adds its own as content; spec veto default 13), `features/look/time-of-day.ts` (from
  `paint/library/times.json` and `paint/light.ts`'s presets)
- Modify: `games/base-3d/src/content/levels/room.af-sector.json` (dressed from a kit; a lamp; a time of day)
- Test: dressing is deterministic (the same level and seed give the same pieces, every piece with an id), every
  library entry parses, `apartment@1` and `block@1` generate valid `/2` levels

- [ ] **Step 1:** Failing tests (determinism, library parse, generated maps valid). **Step 2:** props and the dresser.
  **Session break here if needed** (log what is left). **Step 3:** lamps, time, decals, lettering, generators, the
  converted maps. **Step 4:** base-3d's unit tests and golden replay pass (sim hash unchanged: dressing is
  presentation); its journeys pass in Chromium with the dressed room; expected, actual and diff screenshots in the PR,
  each change explained. `sources.md` rows. **Commit.** `feat(3d): props, furnished rooms, lamps, time of day and
  generated maps`

### Task 7.4: The stage (same PR)

**Source files:** EnvironmentBuilder `src/features/stage/{actor,cast,camera,runtime,state}.ts`, `src/features/view/shots.ts`;
FigureBuilder `src/features/actors/actor.ts` (the script: cues on waypoints).

**Files:**
- Create: `packages/3d/src/features/stage/{stage-script.schema.ts,stage.content.ts,scene-state.ts,director.ts,
  sequence.ts}` (spec 7.4: a script of timeline tracks for the camera, doors, lamps, time of day, grade and props, and
  cues that start figure clips; sampled at the presentation's interpolated tick time; no gameplay state), the
  renderer's piece update (`features/renderer/update-pieces.ts`: change only what changed, from `runtime.ts`)
- Test: `tests/unit/stage/*.test.ts` (a state at `t` from keys alone; a door key turns only the door's pieces; a cue
  starts a clip at its tick; nothing reads `Date` or `performance.now`: the director takes a `Clock`-free time
  argument), the source's `tests/features/stage/*` cases ported

- [ ] **Step 1–3:** failing tests, the feature, 3D unit tests pass. `grep -rn "Actor\b\|Troupe" packages/3d/src` →
  none (one player: `evaluate()`). `sources.md` rows. **Commit.** `feat(3d): the stage plays scripts on the one timeline`

---

## Phase 8: The look on Pixi 3D (one PR, `claude/3d-look`)

### Task 8.1: Measure, then choose (ADR 0007)

**Files:**
- Create: `spikes/3d-look/` (exempt from TDD): candidate (a) passes and (b) bake on base-3d's dressed room with Wick;
  `docs/adr/0007-3d-look.md` (what was measured, on which runner, and the choice by spec section 6's rule)
- [ ] **Step 1:** Check that Pixi 3D's beta takes a custom material and a low-resolution render target drawn with
  nearest-neighbour scaling; if it takes no custom material, (a) quantises in the post filter from a lit buffer.
- [ ] **Step 2:** Measure both with `tooling/frame-budget` at the phone and iPad profiles on the GPU runner (the
  Owner's Mac via `ci:local`, or the runner job), and in Chromium here (software: recorded, not judged).
- [ ] **Step 3:** Write the ADR; **commit.** `docs(adr): the 3D look on Pixi 3D`

### Task 8.2: The passes and the reference (**session break** after the filters)

**Source files:** EnvironmentBuilder `src/features/paint/*` (light, look, occlusion, paint, perspective, post, rain,
sky, vertex-light, colour), `src/features/stage/*`, `src/features/view/*` (framing only); FigureBuilder
`src/features/paint/{paint,raster,fabric}.ts`.

**Files:**
- Create: `packages/3d/src/features/look/{look.ts,ramp-light.material.ts,duel-snap.filter.ts,outline.filter.ts,
  sprite-light.ts,sky.ts,rain.ts,post.ts}` (each filter a `.glsl` + `.wgsl` pair taking pixel position from the vertex
  stage; the passes the look's `switches` name: outline, sky, stars, rain, bloom, grade, dither), `look/library/look.json`,
  `packages/3d/src/testing/look-reference/` (both painters as the offline oracle, plain TypeScript, no globals); no
  camera presets: the builders' views are the editor's (task 16.3; the Owner, 2026-11-07 11:04)
- Modify: `app/create-renderer.ts` (renders to the low-resolution target, then the passes), base-3d's views
- Modify: root `boundaries` (`--forbid` `testing/look-reference` from every browser entry: `entries/{index,sim,level,
  figures,camera-view,no-eval}.ts`; if task 8.1 chose a figure bake, its Node entry `./bake` may import it)
- Test: `tests/unit/look/*` (look settings, ramp stepping), `tests/browser/look/look.parity.test.ts` (WebGL2 and
  WebGPU agree; a scene drawn by Pixi 3D and painted by the reference agree within the named palette-index tolerance),
  base-3d's screenshots (explained in the PR)

- [ ] **Step 1:** Failing unit tests (look settings parse, ramp stepping, sprite light's flat light and rim) and the
  failing parity test. **Step 2:** the filters (**session break here if needed**). **Step 3:** the material, sprite
  light, sky and rain, drawn through the game's camera. **Step 4:** parity in Chromium (WebKit/Firefox: the Owner's), the reference
  agreement, base-3d's journeys; the frame-budget probes run where a GPU is (task 13.3 makes them permanent). Visual
  acceptance under the standing rule ("Auto approve all visual acceptance too", 2026-10-30) once a reviewer has opened
  the before/after/diff images and the PR explains every change. `sources.md` rows (the painters' files: *rewritten:
  reference only*). **Commit.** `feat(3d): the pixel-art look, drawn by Pixi 3D`

---

## Phase 9: The photo tool (one PR, `claude/3d-photo`)

### Task 9.1: `automata textures`

**Source files:** EnvironmentBuilder `src/features/photo/{pipeline,structure,textures}.ts`, `library/photos.json`, the
photos it lists, `src/lib/png.ts`, `scripts/textures.ts`.

**Files:**
- Create: `packages/3d/src/features/photo/` (Node only), entry `./photo` (`entries/photo.ts`),
  `packages/3d/assets/photos/` (the library's photos and `photos.json` with each Poly Haven CC0 credit; outside the
  package's `files`), `features/world/library/tiles/` (the DUEL-indexed tiles the kits' swatches name, generated and
  committed, each stamped with its photo's hash), `packages/tools/src/features/textures/textures-command.ts`
  (`automata textures <photos> --out <folder>`; writes each photo's credit beside its tile)
- Modify: `packages/tools/src/features/check/` (a stale tile, whose stamp differs from its photo's hash, is a finding:
  "This texture is older than its photo. Run automata textures to update it.")
- Test: a small test image made for the test under `packages/3d/tests/fixtures/photo/` → a tile whose every pixel is a
  DUEL colour; the pipeline's stages (flatten, facet, resample, index, wear, clean) on it, from the source's
  `tests/features/photo/*`; the command's help and its refusal on a missing folder; the stale-tile check

- [ ] **Step 1–3:** failing tests, the port, the tiles generated and committed. `boundaries --platform-imports` keeps
  `node:` imports in `features/photo` and `entries/photo.ts` only. Changeset `patch` for `-tools`. `sources.md` rows.
  **Commit.** `feat(tools): automata textures turns photos into DUEL tiles`

---

## Phase 10: Words and provenance in the 3D core (one PR, `claude/3d-words`)

### Task 10.1: No plan IDs or source names in code

**Files:**
- Modify: every file under `packages/3d` (`grep -rEn` with the audit's plan-ID patterns and `source-names` patterns),
  root `package.json` (`style --plan-comments packages/3d/src`; `source-names --code packages/3d`),
  `tooling/repo-hygiene/src/source-names.ts` (a `--code <folders>` option: reads `.ts`, `.svelte`, `.css`, `.json` and
  `.toml` under the folders named, as well as the Markdown it reads today; learns `environment[\s_-]?builder`
  (FigureBuilder's pattern is there); the record folders of `docs/` stay exempt; its own file and its tests are the one
  code exemption, as now)
- Test: `tooling/repo-hygiene/tests/unit/source-names.test.ts` (a `.ts` file naming a source under a `--code` folder
  fails; one outside does not)

- [ ] **Step 1:** failing source-names test. **Step 2:** the rewrite (comments say what and why, not where from).
  **Step 3:** `pnpm source-names` and `pnpm style` pass with `packages/3d` in the code list. The list grows as each part
  is cleaned: `packages/automata` (202 hits), `content` (74), `tools` (13), `games/base-3d` and `examples/3d` in task
  13.2; `packages/editor-3d` and `packages/editor` in 17.2, after which `--code` names every source folder and the option's
  list is replaced by "everything but `docs/` records".
  **Commit.** `refactor(3d): comments say what and why`

### Task 10.2: README and the part's close

**Files:** Create `packages/3d/README.md` (what is in it, its entries, the beta rule); modify `docs/README.md`,
`docs/provenance/sources.md` (each row complete), `progress.md`.

- Test: `tooling/repo-hygiene/tests/unit/sources-md.test.ts` (task 6.1's) passes with every row filled: each source
  file of both builders at the recorded commits is a row (the test lists the files from a manifest committed beside
  `sources.md`, `docs/provenance/builders-manifest.json`, written from `git ls-files` at the two commits)

- [ ] **Step 1:** Part A's done check: spec criteria 1 to 7 pass (commands in the PR); `pnpm check`, the 3D browser
  suites in Chromium and the 3D workflow on the PR are green. **Commit.** `docs(3d): the package's README; part A done`
- [ ] **Step 2:** Merge part A's PRs in stack order once every check is green on each head (the Owner's "Auto merge",
  2026-11-06; by hand, since GitHub's auto-merge is unavailable). Part B starts after.

---

# Part B: the rest of AF that uses 3D

## Phase 11: Ember Hall (one PR, `claude/3d-game`)

### Task 11.1: The feature layout and `content/`

**Files:**
- Create: `docs/refactor/move-map-base-3d.json`
- Move (by the map): `games/base-3d/src/{commands,components,events,resources,state,systems,views,screens,constants}`
  → `src/{app,entries,features/{hero,embers,room,scene,screens},shared,testing}` like Emberwick (`games/emberwick/src`);
  `src/content/` → `content/` (levels, figures, the figure kinds, generated); the tests beside the code →
  `tests/{unit,browser}` with `#src/…` imports (the test mover); the tunable numbers of `constants/` →
  `content/tuning.toml` read through `-content`'s tuning, as Emberwick's
- Create: `games/base-3d/content/editors.toml` (rows: `content/levels/*.af-sector.json` → `levels-3d`,
  `content/figures/*.toml` → `studio`, `content/tuning.toml` → `tuner`; `exports`, `gates` and `checks` as Emberwick's)
- Modify: root `boundaries` (`--features games/base-3d`; its sim files by feature, `--game` dropped for it),
  `style` (drop `--role-layout games/base-3d/src`; add `--plan-comments`, `--test-imports games/base-3d`),
  `games/base-3d/{vite.config.ts,vitest.config.ts,playwright.config.ts}` (the paths), `EDITOR-GAPS.md` (deleted: its
  gaps are closed by `af-sector/2` and the Things layer; G3)
- Test: the moved tests, plus `tests/unit/editors-list.test.ts` (the list parses and every glob matches a file)

- [ ] **Step 1:** Record counts (unit 82, browser and layout 32, journeys 8, the golden replay hash). Dry run, then move.
- [ ] **Step 2:** `--features games/base-3d` and the sim rule pass; unit, browser, layout and journeys pass with the
  same counts; the golden replay hash is unchanged.
- [ ] **Step 3: Commit.** `refactor(base-3d): feature folders and content/ like Emberwick`

### Task 11.2: One name, the menu and the HUD (G4 to G6, C10)

**Files:**
- Modify: `games/base-3d/src/messages/ui/en.json` (or wherever 11.1 put them), `features/screens/flow.ts` (title menu:
  Continue when a save exists, New game, Settings), the HUD (`Hud.svelte`: "Embers 0 of 6" in words a sighted player
  reads too, a pause icon button named Pause, from the framework's icons), the play view (on an iPad the camera frames
  the room to the usable area, so it fills the screen; G6), `DESIGN.md` ("Ember Hall"), `package.json`
  (`automata.title: "Ember Hall"`), `docs/refactor/copy.md` ("Base 3D")
- Test: `tests/unit/screens/flow.test.ts` (the menu's items), `tests/browser/screens/hud.layout.test.ts` (the count's
  words visible; Pause has its name; actions whole and inside, task 1.5), `tests/browser/screens/play.layout.test.ts`
  (the room's drawn box covers at least 80 % of the stage's height at 1194 × 834)

- [ ] **Step 1:** Failing DOM and layout tests. **Step 2:** the change. **Step 3:** journeys pass; screenshots before
  and after in the PR. **Commit.** `feat(base-3d): Ember Hall, a menu with Settings and a HUD that says what it counts`

### Task 11.3: Journeys that play (G2)

**Files:**
- Modify: `games/base-3d/e2e/base-3d.e2e.ts` (play with touch: the stick moves the hero, Roll rolls, an ember is
  collected and the HUD says 1 of 6, the goal ends the game; one phone, 390 × 844, and one iPad, 1194 × 834),
  `games/base-3d/src/testing/` (a test-only seed and a short route through the room, so the journey is deterministic)

- [ ] **Step 1:** The journeys fail on the missing driver; the driver; they pass in Chromium here (WebKit on the
  runner). The first-attempt result is kept if a retry passes. **Commit.** `test(base-3d): journeys play to the goal`

## Phase 12: The examples and a new 3D game (one PR, `claude/3d-examples`)

### Task 12.1: The 3D examples on the new package

**Files:**
- Modify: `examples/3d/{figures,render3d}/*` (imports from `@automata/3d`; `// --- <role> ---` sections as the 2D
  examples), and new one-file examples: `figures-stand-and-sliders.ts`, `figures-hair.ts`, `figures-wardrobe.ts` (the
  extension of task 4.2), `look-pixel-art.ts`, `world-furnished-room.ts`, `world-generated-map.ts`,
  `world-time-of-day.ts`, `stage-script.ts`; `examples/3d/README.md`
- Test: `examples/3d/tests/*.test.ts` (each example boots; its journey reaches ready), the examples runner's list

- [ ] **Step 1:** Failing journeys for the new examples. **Step 2:** the examples. **Step 3:** journeys pass in
  Chromium (WebKit's on the runner). **Commit.** `feat(examples): the 3D examples show the figures, the world and the look`

### Task 12.2: `create-game --template 3d`

**Files:**
- Modify: `packages/tools/src/shared/create-game/` (a `3d` template from Ember Hall's starter: one room, Wick, a
  tuning file, an editor list, the feature layout; `template-3d.ts` beside `template-game.ts`), `--help` lists the
  template only when `@automata/3d` resolves (until phase 20, inside this repository or with `AF_BETA_3D=1`)
- Modify: `tooling/consumer-smoke` (a 3D stranger's journey against packed tarballs, behind `AF_BETA_3D=1`, since
  `@automata/3d` is private until phase 20: create, install, `pnpm check`, `pnpm test`, the web build boots)
- Test: `packages/tools/tests/unit/create-game/template-3d.test.ts` (the files, `automata check` passes on them), the
  smoke

- [ ] **Step 1:** Failing smoke and unit tests. **Step 2:** the template. **Step 3:** the smoke passes locally with
  `AF_BETA_3D=1`; without it, `create-game --template 3d` says "3D games need a package that is not public yet." and
  exits 1. Changeset `patch` for `-tools`. **Commit.** `feat(create-game): a 3D template`

## Phase 13: The command, docs, agents and probes (one PR, `claude/3d-rest`)

### Task 13.1: `automata editor` reads 3D levels

**Files:**
- Modify: `packages/tools/src/features/editor/editor-policy.ts` (`LEVEL_FILES = ['.af2d.json', '.af-sector.json']`
  for a game without an editor list), `editor-command.ts` (the first line names the game by its title: "Opened Ember
  Hall."; C7)
- Test: `packages/tools/tests/unit/editor/editor-policy.test.ts` (a game without a list lists its `.af-sector.json`
  room), `editor-command.test.ts` (the title)

- [ ] **Step 1–3:** failing tests, the change, the tools' unit tests pass. Changeset `patch`. **Commit.**
  `fix(editor): the command opens 3D levels and names the game`

### Task 13.2: Docs, agents and words outside the 3D package

**Files:**
- Create: `docs/guides/3d.md` (making a 3D game, its level, its characters, the look, furnishing a room, the beta rule)
- Modify: `docs/README.md` (the 3D package, base-3d as Ember Hall, no `packages/editor-*`; S8), the agent package's 3D
  skills and API reference (`pnpm api-index`, `pnpm agent-skills --write`, `pnpm cheatsheet` if stale), plan IDs and
  source names in `packages/automata` (202), `content` (74), `tools` (13), `games/base-3d` (59), `examples/3d` (13);
  root `package.json` (`source-names --code` adds them; `style --plan-comments` covers them), `games/base-3d/README.md`
- [ ] **Step 1–2:** the rewrite; `pnpm source-names` passes with those folders in the code list. Part B's done check:
  spec criteria 6 and 16 for these folders, the 3D workflow green. **Commit.** `docs: 3D in the guides and the agent package`

### Task 13.3: The 3D frame-budget probes

**Files:**
- Create: `tooling/frame-budget/src/probes/3d-game.ts` (Ember Hall's dressed room with Wick through the game's
  camera, every look pass on, the camera turning; the editor's views get their own probe in task 16.3), `budget.json` rows (spec section 6: 33 ms phone profile, 16.7 ms iPad profile; the
  hero's first pose, G7)
- Test: `tooling/frame-budget/tests/unit/probes-3d.test.ts` (the probes are listed; a software renderer skips with
  "Skipped: software renderer, no frame budget measured.")

- [ ] **Step 1–2:** the probes; they run on the GPU runner with exclusive access (the Owner's queue) and skip here
  with the message. The first-pose budget is met, or changed to the measured number with the reason recorded in the
  spec's veto defaults. Part B's done check. **Commit.** `test(frame-budget): 3D probes for the look`
- [ ] **Step 3:** Merge part B's PRs in stack order once green. Part C starts after.

---

# Part C: the editors

## Phase 14: `editor-3d` by feature (one PR, `claude/3d-editor-features`)

### Task 14.1: Feature folders and `tests/` (**session break** after the move map)

**Files:**
- Create: `docs/refactor/move-map-editor-3d.json` (spec 9.2's tree: `app/` the suite page; `features/levels-3d/
  {plan,walk,dollhouse,inspector,things,definitions,checks,document,home}`; `features/studio/{look,pose,animate,stage}`;
  `shared/{geometry,edit,level-session}`; `entries/`; `testing/`)
- Move: every file in `packages/editor-3d/src`; tests to `tests/{unit,dom,browser/{layout,canvas},journeys}` (the test
  mover with `--keep-qualifier layout --keep-qualifier canvas --keep-qualifier journey`)
- Modify: root `boundaries` (`--features packages/editor-3d --components`), `style` (`--test-imports
  packages/editor-3d`), `packages/editor-3d/vitest.config.ts` (projects by folder)

- [ ] **Step 1:** Record counts (unit and DOM; Chromium layout and canvas, now 195 after phase 1; journeys). Write the
  map; dry run. **Session break here if needed.**
- [ ] **Step 2:** Move; the test mover; every editor-3d suite passes with the same counts. **Commit.**
  `refactor(editor-3d): feature folders, tests in tests/`

### Task 14.2: Dead entries, the shim and the tokens (E5, K3, V3)

**Files:**
- Delete: `packages/editor-3d/src/index.ts` (384 lines of re-exports) and the `./suite` entry; what only they used
  (`pnpm knip` finds it)
- Modify: `suite-content-shim.ts` (imports `@automata/content/schema` and `/palette`; then inlined where it is used,
  since a shim with one caller is not worth a file), every `var(--…)` not in the kit's `tokens.css` (the 14 tokens to
  their kit names; `--radius*` and `--pill` to `--edge-sm/md/lg`), `tooling/check-style` (a rule: an editor's
  `var(--x)` must be a token the kit defines or the file itself defines)
- Test: `tooling/check-style/tests/unit/tokens.test.ts` (an unknown token fails)

- [ ] **Step 1:** Failing style rule (it finds the 14 and the 23). **Step 2:** the fixes. **Step 3:** layout and
  canvas suites pass; any pixel change explained. **Commit.** `refactor(editor-3d): kit tokens only; no dead entries`

## Phase 15: One suite (one PR, `claude/3d-one-suite`)

### Task 15.1: The full suite opens the checkout (E2)

**Files:**
- Modify: `packages/editor-3d/src/app/suite/main.ts` (was `suite-main.ts`: `openSuitePorts` like the 2D page; the
  sample only when served for the site's try-it page), the sample game
  (`packages/editor/src/features/suite/memory/sample-ports.ts` takes extra sample files from its caller: the 3D page
  passes a 3D room and Wick, since `packages/editor` may not import 3D)
- Test: `packages/editor-3d/tests/dom/suite/open-checkout.dom.test.ts` (on a checkout the suite lists base-3d's room and
  Wick; served for the site it opens the sample with a 3D room and Wick)

- [ ] **Step 1–3:** failing test, the change, the suite's tests pass. **Commit.** `fix(suite): the full suite opens the game's folder`

### Task 15.2: One page, chosen by the game (D4, E3, E4)

**Files:**
- Modify: `packages/tools/src/features/editor/editor-command.ts` (no `--app`; the full page when the game's list or
  files hold a 3D file and the 3D build exists, else the 2D page; `BUILDS` keeps two entries, both the suite),
  `docs/guides/editor.md`, the help text
- Delete: `packages/editor-3d/src/main.ts`, its `index.html` and standalone build, `packages/editor/src/app/editor-2d/`
  and its build (the 2D editor lives only inside the suite as Levels)
- Test: `packages/tools/tests/unit/editor/editor-command.test.ts` (base-3d → full page; Emberwick → 2D page; `--app` →
  "This option is gone: automata editor picks the editors your game needs." and exit 1), the 2D editor's journeys
  re-pointed at the suite page (same counts)

- [ ] **Step 1:** Failing command tests. **Step 2:** the change and the deletions. **Step 3:** the editor's and
  editor-3d's suites pass; `pnpm knip` clean. Changeset `patch` for `-tools`. **Commit.** `feat(editor): one editor
  app for every game`

### Task 15.3: The cuts (D6, E6)

**Files:**
- Delete: World (its view and "Not ready yet" copy), Ask (`ask-controller.ts`, `testing/fake-ask.ts`, `SuiteAsk.svelte`
  and the top bar's Ask), the change-set desk (Review, Export changes, Import changes, Publish over a sample, their
  dialogs and stores) in `packages/editor` and `packages/editor-3d`
- [ ] **Step 1:** Their tests go with them; nothing else changes (counts drop by exactly theirs, recorded); journeys
  pass; `pnpm knip` clean. **Commit.** `refactor(editors): only what works on a real game`

### Task 15.4: The suite on a phone (V4)

**Files:**
- Modify: the suite shell in `packages/editor/src/features/suite/shell/` (the top bar names the game; the bottom bar
  lists only the game's editors with one Levels for 2D and 3D; in phone landscape the bar folds into the top bar's menu;
  Home lists every file of every editor), the 3D page's registration of Levels 3D and Characters into it
- Test: `packages/editor/tests/browser/layout/suite-phone.test.ts` (390 × 844 and 844 × 390: the game's name shown, the
  tabs are the game's editors, the stage keeps at least 85 % of the height in landscape, actions whole and inside)

- [ ] **Step 1–3:** failing layout tests, the change, both suite pages' layout suites pass. Screenshots in the PR.
  **Commit.** `feat(suite): the suite on a phone names the game and lists its editors`

## Phase 16: Levels 3D redesigned (one PR, `claude/3d-levels-redesign`)

### Task 16.1: The frame, phone first (V1, V2, D5; **session break** after the top bar and tools)

**Files:**
- Modify: `packages/editor-3d/src/features/levels-3d/` (the top bar of spec 9.3; the floating tool bar with icons and
  names; the view tabs and their phone menu; the label-left inspector showing the level with nothing chosen; the
  layers sheet with one eye and one lock icon per row; the three container layouts by `shellModeOf`, with the tool dock
  at the thumb on compact), the kit's icons (new ones for Room, Corner, Doorway, Door, Window, Thing, Prop, Lamp, drawn
  in the kit's Lucide style)
- Test: `tests/browser/layout/levels-3d.layout.test.ts` (at 390 × 844, 844 × 390, 1194 × 834, 1440 × 900: a drawing
  tool, the view switch, the inspector and Save are reachable; actions whole and inside), `tests/dom/levels-3d/*`
  (every tool reachable by role and name), the canvas suite (pixel changes explained)

- [ ] **Step 1:** Failing layout and DOM tests. **Step 2:** the top bar and the tools. **Session break here if
  needed.** **Step 3:** the inspector, layers and the three layouts. **Step 4:** before/after screens at the four sizes
  in the PR, opened against the mock-up. **Commit.** `feat(levels-3d): the approved look, with every tool on a phone`

### Task 16.2: The builders' authoring (spec 9.3)

**Files:**
- Modify: `features/levels-3d/inspector/` (Furnish as on a room, from the game's `world-kit` content; Time of day on
  the level; Wall trim and Windows on a wall), `features/levels-3d/plan/tools/` (the Furniture and things tool, the
  Lamp tool), `shared/edit/` (one edit command per change, undoable), `features/levels-3d/checks/` (a prop outside
  every room, a lamp inside a wall, a kit the game does not have), the 3D view (draws the dressed room through the
  world builder, as the game does)
- Test: per change: a failing unit test of its edit command, then its DOM test, then a canvas test

- [ ] **Step 1–3:** each change in that order; undo and redo name it ("Undo Furnish as Office"). **Commit.**
  `feat(levels-3d): furnish rooms, place props and lamps, pick the time of day`

### Task 16.3: The builders' views: Plan, 3D and Walk (spec 6 and 9.3; the Owner, 2026-11-07 11:04)

**Source files:** EnvironmentBuilder `src/features/view/{view-frame,readability}.ts` (framing a map; how a figure reads
against its room), and `render.ts` and `fp.ts` for their camera and framing rules only (their CPU drawing is the
reference's, task 8.2).

**Files:**
- Create: `packages/editor-3d/src/features/levels-3d/views/{plan,diorama,walk}/` (top-down, diorama and first person,
  each a Pixi 3D camera over the game's look from `@automata/3d`), `views/shared/{frame-map.ts,readability.ts}` (the
  ported framing math, pure)
- Modify: the existing Plan, dollhouse and Walk code (`features/levels-3d/{plan,dollhouse,walk}/`) to draw through
  these views; the Walk view's hint when a character does not read ("Wick is hard to see here"; `copy.md`)
- Create: `tooling/frame-budget/src/probes/3d-editor-views.ts` (the diorama and Walk at the phone and iPad profiles)
- Test: `tests/unit/levels-3d/views/{frame-map,readability}.test.ts` (the source's cases), canvas tests of each view
  (pixel changes against the old views explained), layout tests (the view switch reachable at every size)

- [ ] **Step 1:** Port the framing and readability tests, failing. **Step 2:** the three views. **Step 3:** unit,
  canvas and layout pass in Chromium; the probe skips on a software renderer with its message. `sources.md` rows
  (*rewritten: editor views*). **Commit.** `feat(levels-3d): the plan, diorama and walk views in the game's look`

## Phase 17: Characters (the Studio) redesigned (one PR, `claude/3d-studio-redesign`)

### Task 17.1: The frame, phone first (V5; **session break** after the top bar)

**Files:**
- Modify: `packages/editor-3d/src/features/studio/` (the shared top bar; on a phone Undo and Redo in the menu, one
  Panels button, Dock gone, Save in place of Publish), the stage and the timeline sheet; the on-screen name Characters
- Delete: task 1.5's `.fails` mark
- Test: `tests/browser/layout/studio.layout.test.ts` (actions whole and inside at every size; Save visible at 390 × 844)

- [ ] **Step 1–3:** the test fails without `.fails`; the change; it passes at every size. **Commit.** `feat(studio):
  the approved look; Save fits on a phone`

### Task 17.2: New sliders, actions and words

**Files:**
- Modify: `features/studio/look/` (the body, face and hair controls of phase 6, each slider with words at its ends),
  `features/studio/animate/` (actions listed and edited as clips on the one timeline), names instead of ids (C9: a
  content entry's `name`, or its id in words), the Figures list's thumbnails (drawn by Pixi 3D into a small render
  texture; never by the reference painter); plan IDs and source names out of `packages/editor-3d` (520 hits) and
  `packages/editor`; root `package.json` (`source-names --code` covers every source folder now; task 10.1's last step)
- Test: `tests/dom/studio/*` (each new control by role and name; the words at a slider's ends), a canvas test of a
  thumbnail

- [ ] **Step 1–3:** failing DOM tests, the change; `pnpm source-names` passes repository-wide. **Commit.**
  `feat(studio): every slider the figures have, in words`

## Phase 18: Copy and real journeys (one PR, `claude/3d-editor-journeys`)

### Task 18.1: The copy pass (C1 to C9)

**Files:**
- Modify: every string in spec section 10's table and the rest the pass finds in `packages/editor-3d` and the suite;
  the problem messages grouped by room (`features/levels-3d/checks/messages.ts`, pure, unit-tested: a schema error
  becomes a sentence naming the room and what to do); `docs/refactor/copy.md` "3D editors"
- Test: `tests/unit/levels-3d/checks/messages.test.ts`; `tests/dom/copy.dom.test.ts` (no format id, path, plan ID or
  source name in any rendered screen of the fixtures)

- [ ] **Step 1:** Read every screen at the four sizes with the drunk grandma test; list each failure in `copy.md`.
  **Step 2:** failing tests, the words, the tests pass. **Commit.** `feat(editors): plain words in the 3D editors`

### Task 18.2: Journeys against the real command (T2)

**Files:**
- Create: `packages/editor-3d/tests/journeys/real/{levels,characters,phone}.journey.ts`, a harness
  (`tests/journeys/real/harness.ts`) that copies base-3d to a temporary folder, starts `automata editor` on a free port
  and the game's dev server on another, and stops both (owned processes only)
- [ ] **Step 1:** The spec 9.4 journeys fail first where the product lacks a hook (fix as product bugs, with tests).
  **Step 2:** they pass in Chromium here, WebKit on the runner. Part C's done check: spec criteria 8 to 13. **Commit.**
  `test(editors): journeys from the editor to the game`
- [ ] **Step 3:** Merge part C's PRs in stack order once green. Part D starts after.

---

# Part D: the site and the release

## Phase 19: The site's 3D pages (one PR, `claude/3d-site`)

### Task 19.1: Behind the switch

**Files:**
- Modify: `site/src/shared/framework/examples.ts` (the 3D group), `site/src/features/home/` (Ember Hall playable
  beside Emberwick), `site/src/features/editor/` (Try the 3D editor: the full suite's sample), `site/src/features/docs/`
  (the 3D section from `docs/guides/3d.md`), the API page for `@automata/3d`, `site/vite.config.ts` (`AF_SITE_3D`)
- Test: the site's scan test (with the switch off, no `@pixi/3d` byte and no 3D route in the build), the visitor's
  journey with the switch on (Home plays Ember Hall; the 3D editor opens the sample), the site's browser gates
  (horizontal scroll, console errors, third-party requests, axe, focus rings) on the new pages

- [ ] **Step 1:** Failing scan and journey tests. **Step 2:** the pages, in the site's look (the lean site's tokens).
  **Step 3:** the site's Chromium suite passes with the switch off and on; the site visual audit's script reruns for the
  new pages at phone, iPad and desktop, screens in the PR, each read with the drunk grandma test. **Commit.**
  `feat(site): 3D beside 2D, behind the beta switch`

## Phase 20: The release (one PR, `claude/3d-release`; merged only on the Owner's trigger)

### Task 20.1: Written and rehearsed now

**Files:**
- Modify: the `package.json` files that take `@pixi/3d` (from npm, at the version the Pixi team publishes),
  `packages/3d/package.json` (public; `files` leaves out `assets/`), `packages/tools` (packs the full suite; the
  closed-beta scan's refusal lifted for `@pixi/3d` from npm), `ship prepare` (the refusal lifted), the site deploy
  (`AF_SITE_3D=1`), `create-game` (the 3D template without `AF_BETA_3D`), a `patch` changeset adding `@automata/3d` to
  the published line (spec section 11)
- Delete: `vendor/pixi-3d`
- [ ] **Step 1:** Rehearse against a local registry (Verdaccio) with the vendored tarball standing in for npm: the 3D
  stranger's journey passes from the registry.
- [ ] **Step 2:** Leave the PR open with "Waits for Pixi 3D's public release" at the top. Part D's done check, except
  the merge. The trigger is the Owner's (D8): `@pixi/3d` on npm, or the Pixi team's written okay.

---

## Done (stage 4's last step)

Every row of the tracking table is done except 20.1's merge; `progress.md` says so; the spec's criteria 1 to 14 and 16
pass with the commands in each part's done check; 15 and 17 wait on the release.

## Execution log

(One two-line entry per session: what was done, where to resume.)
