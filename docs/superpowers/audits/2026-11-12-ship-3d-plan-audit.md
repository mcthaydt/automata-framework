# The 3D and editors ship plan: plan audit

Workstream 7, stage 3. Audited: the spec
[`2026-11-12-ship-3d-and-editors-design.md`](../specs/2026-11-12-ship-3d-and-editors-design.md), the survey
[`2026-11-12-ship-3d-survey.md`](2026-11-12-ship-3d-survey.md) and the plan
[`2026-11-12-ship-3d-and-editors.md`](../plans/2026-11-12-ship-3d-and-editors.md), on `claude/ship-3d-plan` at
`c9c2b990` (the brief named `0a333a4b`; the branch moved twice while this ran, and both later commits were merged in and
audited). The fixes are made in the plan and the survey, and in the spec as a dated amendment, on
`claude/ship-3d-plan-audit`. One session, no subagents, no product code.

## Verdict

**Yes: execution of Part A can start the moment `claude/pixi-3d-public` is on `main`**, from this audited plan, on two
conditions: (1) that branch's three conflicts are resolved to what the code says, not by taking a side (finding 20:
`template.test.ts`'s "four edits" against "three"); (2) the Part A session runs the plan as fixed here, not the
`c9c2b990` text, which would have failed `pnpm check` at A2 (finding 1) and could not execute A4 (finding 7). Part A
needs nothing else: not the scope rename, not the editor journeys, not the editors v2 landing.

The three Part B branches can start when Part A merges: A5 now writes every shared list they need, so they touch no
shared file. Part C cannot start until the editors v2 landing's tasks 2 to 4 and 6 and `claude/editor-journeys-green`
have merged (finding 6). Part D can start when B10 merges, beside C.

Found: **7 blocking, 16 should fix, 4 tidy**. All 27 are fixed in the plan; 4 also need a word from the coordinator
and 2 from the Owner (marked).

## How it was run

- This branch: `origin/claude/ship-3d-plan` `c9c2b990`, which contains `905cc01c` and `0a333a4b`. `main` `d401ec4d`.
  `pnpm install --frozen-lockfile`.
- A scratch worktree outside the repository: `origin/main` merged with `origin/claude/pixi-3d-public` (`be6db992`),
  the survey's tree. The merge stops on the same three conflicts the survey found; for measuring, the branch's side
  was taken in the two painter files and `main`'s in `progress.md`. `pnpm install --frozen-lockfile` there. Never
  committed to any branch.
- In that scratch tree: a trial tsdown build of `@automata/3d` (13 entries, `vitest` as an optional peer) and of every
  kit; `svelte-package` plus `finishSvelteDist` for the two Svelte kits; `pnpm pack` of each; the API index's own
  `indexRows` and `checkDocs` over each package's built `.d.ts`; `pnpm build` (exit 0, 24 s); and the 3D stranger's
  journey, four times, with `DEBUG=pw:api` and the line reporter (streaming).
- Read, as diffs: `claude/pixi-3d-public`, `claude/painter-hands`, `claude/editors-v2-landing-plan` (`fdae6f18`, fetched
  after the coordinator's message) and the v2 tip `refs/pull/567/head` (`47391563`), the paths only.
- **Not on `origin` when this ran** (so not read): `claude/editor-journeys-green`, `claude/scope-rename`,
  `claude/desktop-games`, `claude/builders-fold-strict`.

## Findings

Severity: **blocking** (a session following the plan as written would stop, fail a gate or do the wrong thing),
**should fix** (it would guess, or a stated fact is wrong), **tidy**.

### 1, blocking: A2 and the kit recipe fail `pnpm check` on the private-build test

Checked: `tooling/release/tests/unit/private-build.test.ts:29-41`. Every private package that has
`publishConfig.exports` and no `bin` must have `publishConfig.exports` keys **equal** to its `exports` keys, and
`expect(manifest.publishConfig?.registry, '… must not name a registry').toBeUndefined()` (line 38). A2 step 2 told the
session to add `publishConfig.registry` and `access` while keeping `"private": true`: the unit suite fails. The kit
recipe (private + `publishConfig.exports`) fails the equal-keys case for every kit with a wildcard or test entry (5 of
12, finding 2), and the parallel B branches may not edit `tooling/` to make room.
**Fixed in plan:** A2 steps 1 and 2 (no `registry` or `access` while private; A5 adds them); A5 step 0 moves
`WORKSPACE_ONLY` from `release-list.test.ts` into `tooling/release/src/workspace-only.ts`, which both tests read, and
lists the kits' entries up front; recipe step 1.

### 2, blocking: five kits have entries that cannot build or do not work from `dist`

Checked: the trial build of every kit.
- `nav`: tsdown fails, `UNLOADABLE_DEPENDENCY Could not load src/testing/fixtures/clinic.boxes.toml?raw` (and
  `clinic.nav-graph.toml?raw`), from the `./testing/clinic` entry.
- `sectors`, `systems`, `narrative`: a `./testing/fixtures/*` wildcard entry, a folder of data, which no tsdown entry
  can be.
- `world-kit`: `./textures` builds, but `dist/textures.js:461`, `:743`, `:745` read
  `new URL("../../../assets/photos/", import.meta.url)`, `../../../library/swatches.json` and `../../../library/tiles/`:
  from `dist/` those leave the package. Nothing outside the kit imports it (`git grep "@automata/world-kit/textures"`:
  none).
- `character-kit`: `./testing` reads `join(import.meta.dirname, '../../tests/fixtures')`
  (`src/testing/kit-fixture.ts:18`), the same defect as `@automata/3d`'s A3; nothing outside the kit imports it.

The plan's "a kit's `exports` keys after its task equal its keys before, each with `publishConfig.exports`" cannot be
met. `@automata/puzzle` already publishes without its `./testing/*` entries (`release-list.test.ts`'s
`WORKSPACE_ONLY`).
**Fixed in plan:** the global constraint (workspace `exports` unchanged; what publishes leaves out a measured list);
A5 step 0 names the eleven entries with reasons; each B task names its published entries. **For the coordinator:** the
spec's "no entry is dropped" is written for `@automata/3d` (kept whole); say if any kit entry must ship (plan question 3).

### 3, blocking: deleting the painter's `types/` breaks the character kit's typecheck (1,440 errors)

Checked: in the scratch tree, `extensions/figures/package.json`'s `exports` reduced to their source targets and
`types/` moved away, then `tsc -p . --noEmit` in `extensions/character-kit`: **1,440 errors** (692 TS2532, 266 TS18048,
245 TS2345, 132 TS2322, 78 TS2538, …), all in `../figures/src`: the kit compiles the painter's source under the base's
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, which the painter has off. B4 step 1 required "`pnpm
typecheck` for the whole workspace stays green with `types/` deleted", and the plan orders the strict flags
(`claude/builders-fold-strict`) after B3 to B5. The builders-fold plan audit's B12 saw the same failure in
`examples/3d`.
**Fixed in plan:** B4 keeps `tsconfig.types.json`, `types/`, `prepare` and the workspace `types` conditions; only
`publishConfig.exports` points at `dist`. B10 no longer edits `turbo.json`. **For the coordinator:** the strict-flags
plan must take the removal (plan question 2).

### 4, blocking: the Svelte kits' build is not "svelte-package, then tsdown"

Checked: `extensions/debug/package.json` (`build: svelte-package -i src -o dist --tsconfig tsconfig.package.json && node
build/finish-dist.ts`), `extensions/debug/build/finish-dist.ts` (`finishSvelteDist(…, { testOnly: ['testing'] })`),
`net-ui` the same. No tsdown. The output keeps the source tree, so exports point at `./dist/entries/<name>.js`, not
`./dist/<name>.js` as the recipe's test demanded. `narrative` and `cutscenes` lack `@sveltejs/package` and
`@sveltejs/vite-plugin-svelte` (the trial needed both linked in). Built so, they work: exit 0; packs of 55,640 and
25,400 bytes; every `publishConfig` target exists. And `onlyImport`, which the plan named as the guard that a published
package imports nothing private, never runs for them.
**Fixed in plan:** recipe steps 1 and 3; B9; finding 9's test covers them.

### 5, blocking: the checksum manifest would stop Part C, and misses 35 recorded files

Checked: `git ls-files` with the plan's five patterns: **73** files. `__screenshots__` and `*.md5` match **nothing**
in the tree. Missed: `games/base-3d`, `games/emberwick` and `examples/2d/content/hot-reload` `content/generated/**`
(including `content.hash` and `sim-content.hash`), `examples/3d/wardrobe/goldens/*.json`. The proposed pathspecs
(`__goldens__`, `golden`, `goldens`, `tests/fixtures/golden*`, `content/generated`, `*.hash`, `*.replay`, `*.md5`,
`__screenshots__`, excluding `*.ts`) match **108**. And the manifest was a frozen file: Part D re-records pictures on
`main` while C runs, so C's `--check` after merging `main` would fail on D's pictures; any other lane moving a golden
does the same. C2 and C3 ended without the check at all. Inline hashes in test files are not files at all.
**Fixed in plan:** A1 rewritten: `pnpm recorded:check` compares with the branch's merge base (git already addresses
every file by content), over the 108-file pathspecs, plus the working tree; it lists every pre-existing test file the
branch changed for the log. Every task of A to C ends with it (C2, C3 added).

### 6, blocking: Part C packed two pages; `automata editor` serves one; the page is the v2 landing's

Checked: `packages/tools/src/features/editor/editor-command.ts:69-128` (`pageFor(deps.readEditorList(root))`, one
`appDir` to `deps.serve`); the content editors are a third page (`extensions/editors`, `vite build` of `suite.html`)
that `automata editor` cannot open even in the repository. With C1's two pages and C2's
`page: 'suite-full' | 'content'`, a 3D game gets the 3D editors or the content editors in one run, never both: the
spec's done-means 2 fails. Raised to the coordinator; **ruled 2026-11-12**: the every-editor page is the editors v2
landing plan's (`claude/editors-v2-landing-plan` `fdae6f18`, its section on Part C and tasks 2, 6 and 7), built once
as `extensions/editors/dist/suite`; Part C packages it, after the landing's tasks 2 to 4 and 6.
**Fixed in plan:** Part C's first section and C1 to C3 rewritten to that interface (`pagePath()` with no argument;
`pageFor(editorList, fullPageThere)`; C3's site-words step dropped: the landing's task 7 hosts the page; tsdown with
`clean: false` so it does not delete the page); the order diagram and tracking table name the dependency. The paths C
touches exist on `main` and on the v2 tip (`refs/pull/567/head` `47391563`).

### 7, blocking: there is no API-index list to add to; the API report already has `@automata/3d`

Checked: `tooling/api-index/src/entry-points.ts` takes every package `publishablePackages` returns (every manifest whose
`private` is not `true`); there is no list. `tooling/api-report/src/core-packages.ts:1-3` reports every `packages/*`
folder, private or not, and excludes extensions by design; `tooling/api-report/reports/3d.api.md` is committed. So A4
step 1 ("add `@automata/3d` to the API index's packages"), A4 step 3 ("add it to the API report"), recipe step 7 ("the
kit temporarily added to the entry list") and B10 step 5 ("index and report take the twelve") cannot be done as
written, and A4's done-means (index exits 0 with `@automata/3d` in it) cannot hold while the package is private.
**Fixed in plan:** A4 measures by setting `"private": false` in the working tree and restoring it (and the three files
the run writes); A5 writes the index; the kits get no report (the published extensions have none either); spec
amended.

### 8, should fix: exact outside peers fail the release test

Checked: `release-list.test.ts` "accept a caret range of each outside peer". `@automata/3d` peers `pixi.js` `8.23.0`
(after `pixi-3d-public`); `world-kit`, `lcd-panel`, `retro-crisp`, `character-kit`, `figures` pin `pixi.js` `8.23.0` and
`@pixi/3d` `0.1.0-beta.3`; `narrative`, `cutscenes` pin `svelte` `5.57.1`. All fail when they become publishable.
**Fixed in plan:** A5 step 2, B10 step 2.

### 9, should fix: nothing fails when a published package imports a private one

Checked: the plan named `onlyImport` (tsdown packages only; finding 4), the new `release-list` case (declared
dependencies only) and `--confine` (the painter only). A source import of `@automata/interact` from a Svelte kit, or an
undeclared one resolved by the workspace's hoisting, would pass all three. The coordinator asked for a check.
**Fixed in plan:** A5 step 0b, `published-imports.test.ts`: every import in a publishable package's `src/` that names a
workspace package names a publishable one (names read from manifests, never a scope in pieces); B10 adds the named
assertion for `interact`, `hud`, `pipelines`, `editor`, `editor-3d`.

### 10, should fix: the 3D stranger's journey passes without a GPU

Checked, streaming (`DEBUG=pw:api`, line reporter), on SwiftShader, in the scratch tree:
1. As the trial build stood (`sideEffects` naming source files only), with step 2b's turn added: **fail in 35 s** at
   `data-state`: `Received: "failed"`; console: `Boot defect: Error: @automata/3d: import '@automata/3d/no-eval' first,
   before anything else (in place of render-pixi/no-eval)`. The game's bundler dropped the no-eval install from the
   built package: the plan's review focus 1, and A2 step 4, happening.
2. With `./dist/no-eval.js` and the two hashed chunks added to `sideEffects`: **`1 passed (35.0s)`**: make, install,
   check, test, build, the hint upright, the turn, Play, Wick walks (the before and after screenshots differ), pause.

So neither the survey's twenty minutes nor "needs a GPU runner" holds: the wait was the rotate hint (the coordinator's
finding), and the walk draws on SwiftShader. The Owner's list item 3 asked his runner to pass it.
**Fixed in plan:** A2 step 4 says it is load-bearing, with the boot defect's words; A6 step 3 expects `1 passed` in
the session and makes a failure a stop to investigate; the Owner's item 3 keeps only the editor journeys.

### 11, should fix: the rotate hint: landscape by design; turn the live page

Checked: `packages/tools/src/shared/create-game/template-3d-game.ts:107-110` (the field is sized so "the long side a
phone held sideways", `orientation: 'landscape'`) and `template-3d.ts:41` (`shipConfigFile('landscape')`): by design.
The hint (`RotateHint.svelte`; `en.json:157-158`) says "Turn your phone sideways" / "This game plays in landscape.":
the title passes the drunk-grandma test (the body's "landscape" is the one word a grandma might not know; the title
already told her what to do). The hint appears after `data-state="ready"`, not at `goto`: an assertion right after
`goto` failed in 5 s in the first run. AGENTS.md: keep focus and state through rotation. The plan's step 2b set the
landscape size **before** `goto`, which proves the upright hint and the landscape game on two loads, never a turn.
**Fixed in plan:** A6 step 2b: upright, ready, the hint and its words, then `setViewportSize` swapped on the same page,
the hint gone, `data-state` still `ready`, then Play. Measured: exactly this sequence passed. Both orientations are
covered, in that order.

### 12, should fix: a pack found by its file name breaks silently on the scope rename

Checked: `tooling/consumer-smoke/src/run.ts:174-188`: the tools budget finds its pack with
`/automata-tools-.*\.tgz$/`. After `@automata` becomes `@automataframework`, `pnpm pack` writes
`automataframework-tools-….tgz`, the pattern matches nothing, and the step returns "installed from the registry: not
measured": a pass. The codemod rule `@automata(?![a-z0-9-])` does not touch it (no `@`). A6 step 1 said to add "the same
check" for `@automata/3d`. No other task builds a name in pieces; no new test pins the old scope in a form the codemod
cannot follow (every name in the plan's tests is a whole literal).
**Fixed in plan:** A6 step 1 (`budgets.ts`, keyed by package name, read from each tarball's manifest, the tools check
included); scope rule 6. **For the coordinator:** tell the `claude/scope-rename` session about `run.ts:178` today.

### 13, should fix: the doc comments, measured: 791

Checked: the built `.d.ts` of each package through `indexRows` and `checkDocs` (`tooling/api-index/src/rows.ts`,
`baseline.ts`). `@automata/3d`: 805 exports, **275** undocumented. Kits: `world-kit` 31, `lcd-panel` 4, `retro-crisp` 12,
`figures` 46, `character-kit` 26, `places` 1, `sectors` 27, `nav` 38, `level-2d` 3, `systems` **140**, `narrative`
**135**, `cutscenes` 53: **516**. (Published entries only, as the plan now has them.) A4's "write a doc comment on each"
is a session by itself; B8 and B9 are mostly this.
**Fixed in plan:** A4 (275, one commit per feature folder), the Part B table, every B task's step with its count and
its first five names.

### 14, should fix: tsdown builds without the written types; nothing enforces them

Checked: every kit with `isolatedDeclarations: false` built: `ℹ Emit types with typescript@7.0.2` after
`WARN TypeScript 7.0 does not yet have a stable API`. The shared setup's own header says declarations come from
isolatedDeclarations "so TypeScript's JS API (which TypeScript 7 lacks) is never needed"
(`tooling/release/src/tsdown-shared.ts:4-5`), and no test checks the flag on a published package. The counts
re-derived (TypeScript 6.0.3, `main` `d401ec4d`): figures 174, world-kit 17, character-kit 16, retro-crisp 4, lcd-panel
2: as the survey said; first ten of each kind in the appendix.
**Fixed in plan:** the Part B preface says why honestly; A5 step 1 adds the case "every publishable package resolves
`isolatedDeclarations: true`", which is what holds a kit to the coordinator's ruling. The ruling stands.

### 15, should fix: the painter's 174, by folder, and the hands branch

Checked: the 174 by folder: `shared/paint` **95**, `actors` 20, `math` 9, `motion` 9, `figure` 7, `hair` 7,
`lighting` 7, `outfit` 6, `stage` 2, `features/view` 2, `body` 1, and **`tests/fixtures` 9** (the flag covers
`tsconfig.json`'s `include`, which has `tests`). B3's folder list missed `stage` and `tests/fixtures`. On
`claude/painter-hands` (`94fb6d5a`): `paint-hands.ts` changed, `paint-hand-form.ts` new (223 lines),
`figure/figure-stamps.ts` one line. Neither hand file has a TS9 error today; `figure-stamps.ts:168` has one (TS9007).
**Fixed in plan:** B3 (every folder, smallest first, `paint` last; the hands rule now names `figure-stamps.ts` and
says what to re-count after that branch merges).

### 16, should fix: `@automata/3d/testing` throws at import from a pack

Checked: `packages/3d/src/testing/motion-goldens.ts:45-47` reads `motion.json` at module load, and `testing/public.ts`
re-exports it: from a pack, importing the entry throws `ENOENT`. A3's pack test was to be a case in
`private-build.test.ts`, which checks private packages only: after A5 it would stop running. The fixtures to ship are
1 MB on disk (`content` 476 kB, `goldens` 572 kB), so the pack grows past the survey's 307,703 bytes before A6 sets a
budget from that number.
**Fixed in plan:** A3 (its own `three-d-testing-dist.test.ts`, in `test:dist`; the expected failure is the `ENOENT`;
the pack size logged); A6 sets the budget from it.

### 17, should fix: DUEL is already in `@automata/content`

Checked: `packages/content/src/shared/palette/duel.ts:1-3`: "AF's default palette, DUEL … the palette's author and
licence are not recorded yet (docs/art/palettes/duel.md)"; `@automata/content/palette` exports `DUEL_RAMPS`
(`.changeset/duel-palette.md`); 24 files of `packages/3d/src` name it. The plan held only the painter on the question.
**Fixed in plan:** B4 step 3 records it once, in `docs/art/palettes/duel.md`; the question gates the first release of
`content`, `3d` and the painter; B10 does not wait on it. **For the Owner:** the question, reworded (plan, "For the
Owner only", item 2).

### 18, should fix: the publishable counts

`EXPECTED` has 13 names today. With `@automata/3d` and twelve kits that is **26** (the plan said 25), and **27** after
C1 (it said 26). **Fixed in plan:** A5 step 1 (14), B10 (26), C1 (27).

### 19, should fix: Part D's reach into `@pixi/3d`, and world-kit's PNGs

Checked on `claude/pixi-3d-public`: 47 imports of `@pixi/3d`, one of `@pixi/3d/extras`; no deep import into `dist`, and
no bundle file name (`pixi-3d*.mjs` or `pixijs-3d*.mjs`) anywhere (`git grep -nE "pixi-3d[a-z.*-]*\.mjs|pixijs-3d|@pixi/3d/(dist|lib|src)"`:
one test string, `extensions/figures/tests/unit/layers.test.ts:98`). `npm view @pixi/3d@0.1.0 exports`: `.`, `./webgl`,
`./extras`, `./webgpu` with `types` and `default` only, no `main` or `module`. The painter's `template.test.ts:14`
resolves with `createRequire(…).resolve('@pixi/3d')`: Node's CommonJS resolver accepts `default`, so it still finds
`dist/index.mjs`; the file it reads beside it is the thing to re-check. Not in the plan: `findPixi3d`'s markers
(`pixi3d-markers.ts`: `View3D.screenToRay:degenerate`, `View3D.worldToScreen:degenerate`, `pixi3d-shadow-budget`, and
three extras markers) live in files 0.1.0 changed (`View3D`, the shadow pass); if one went, `ship prepare`'s scan and
`copy-editor`'s 2D guard would pass silently; `packages/3d/tests/unit/renderer/bundle/pixi3d-bundle.test.ts` is the
test that says so. Also `extensions/figures/vitest.config.ts`'s `optimizeDeps`. The new `core/lightLimits` (where
`MAX_LIGHTS` moved, per the ship audit) was not in an area. World-kit's 38 PNGs are
`extensions/world-kit/assets/photos/`, the texture command's source photos, not recorded pictures: the survey and Part D
listed them as pictures the port may move. D2 was one checkbox for seven areas.
**Fixed in plan:** Part D's preface lists every reach-in; D1 step 2 runs the bundle test and checks the template's
path; D2 is eight areas with five steps each (`lightLimits` in area 2); the PNGs leave the list (a change to one is a
stop). The survey is corrected.

### 20, should fix: what Part A must re-check from `pixi-3d-public`

Checked: the scratch merge. Of the three conflicts, `progress.md` is a tracker; `cell-sprite.ts`'s is `main`'s
reworded first-line comment against the branch's added `BaseMaterial3DOptions` import (keep both); `template.test.ts`'s
is a number: `main` says the painter's template is the default "with four edits", the branch "three". A resolver who
takes a side gets a comment that may not match the code.
**Fixed in plan:** Part A's preface: count the edits; keep both sides of `cell-sprite.ts`; re-check `PIXI_3D_SPEC`
(`'0.1.0-beta.3'`), that `three-d-gate.ts` and `pack3d` still exist (A5 and A6 remove them) and that no
`vendor/pixi-3d` is left.

### 21, should fix: C and D share two files

Checked: D1 changes `PIXI_3D_SPEC` (`template-3d.ts:19`); C3 adds `@automata/editors` to the same file's package
writer (lines 36 to 40), each with the same test file; both change `pnpm-lock.yaml`. Different hunks.
**Fixed in plan:** the order section says so and who re-runs `pnpm install`; the shared-files table has the row.

### 22, should fix: the branches the plan waits on

Not on `origin` when this ran: `claude/editor-journeys-green`, `claude/scope-rename`, `claude/desktop-games`,
`claude/builders-fold-strict`. So their diffs were not read; the plan cannot be checked against them.
**Fixed in plan:** Part C states exactly what it needs from `claude/editor-journeys-green` (the maker's Play before
`pnpm dev`; the 2D editor journeys green with the harness change; the journeys' time limit). **For the coordinator:**
`claude/desktop-games` is the one most likely to touch Part A's files (`packages/tools/src/shared/create-game`,
`targets/tauri`): its session should read A5's file list before it merges.

### 23, should fix: A5's done-means could not pass at A5

Checked: `git grep AF_BETA_3D` on `pixi-3d-public` finds it in `.changeset/create-game-3d-template.md` (unreleased, and
false after A5) and in `tooling/consumer-smoke` (A6's files). **Fixed in plan:** A5 rewords the changeset and its grep
leaves `tooling/consumer-smoke` to A6, whose done-means has the full grep.

### 24, tidy: every kit already has `automata.simEntries`

`places` `.`, `sectors` `./sim` `./physics`, `nav`, `level-2d`, `systems`, `narrative`, `cutscenes` `./sim`. B6's "add each
kit's sim entries" had nothing to do. **Fixed in plan.**

### 25, tidy: the closed-beta guard needs a stated rule

`closed-beta-guard.test.ts` demands both `@pixi/3d` and `@automata/figures` in every publishable package's `--forbid`.
"Kept for the 2D packages" needs a definition a test can apply. **Fixed in plan:** A5's table (3D = names `@pixi/3d` or
`@automata/3d` as a dependency or peer); B10 step 3 applies it.

### 26, tidy: the generated `content.d.ts` files name the scope

`git grep -l @automata` over the recorded pathspecs: three `content/generated/content.d.ts` files. They are generated
types, not records; scope rule 3 now says so.

### 27, tidy: the spec's amendment was in the plan

The plan carried "Amendment to the spec's figures"; the spec did not. **Fixed:** a dated amendment in the spec, with
this audit's corrections added.

## The laws, the changesets, the sizing

- **The laws** hold in every task as fixed: no task touches sim code but D's areas (no sim file is in any of them), the
  boundaries `--forbid <kit>:effect` already covers every kit, and no task adds a schema language or a renderer.
  Platform packages: none of the kits imports `@ruken/*` or `@tauri-apps/*`.
- **Changesets:** only for published packages, `patch` (A5: `@automata/3d`, `@automata/tools`; B10: the twelve; C:
  `@automata/editors`, `@automata/tools`; D4: the pins). None for this audit (docs only).
  `.changeset/first-public-release.md` is untouched.
- **Sessions, honestly** (the measured doc and type counts are the size):

| Branch | Tasks | Sessions | Starts when |
| --- | --- | --- | --- |
| `claude/ship-3d-a` | A1 to A6 | 3 (A1 to A3; A4 alone, 275 doc comments; A5 and A6) | `pixi-3d-public` on `main` |
| `claude/ship-3d-b-looks` | B1, B2 | 1 | A merged |
| `claude/ship-3d-b-figures` | B3 to B5 | 2 (B3; B4 and B5) | A merged; `painter-hands` merged before B3's `figure` commit |
| `claude/ship-3d-b-story` | B6 to B9 | 2 (B6 to B8; B9) | A merged |
| `claude/ship-3d-b-join` | B10 | 1 | the three B branches merged |
| `claude/ship-3d-c-editors` | C1 to C4 | 2 | B10, `editor-journeys-green`, the v2 landing's tasks 2 to 4 and 6 |
| `claude/ship-3d-d-pixi` | D1 to D4 | 2, then the Owner (D3's review, D4's parity) | B10 |

24 tasks (unchanged in number), about **13 sessions**. The critical path is A (3) → B-story or B-figures (2) → B10 (1) →
C (2): **8 sessions in a row**, plus C's wait on the v2 landing, then the Owner's review of D's pictures.

## What was measured

- Every path and script the plan names, against `main` `d401ec4d` and `pixi-3d-public`: all exist or are created by an
  earlier task, but `docs/superpowers/audits/2026-11-12-pixi-3d-beta-3/README.md` (on `pixi-3d-public` only: there once
  it merges). `pnpm --filter @automata/release …`, `--filter @automata/consumer-smoke smoke` (`node src/run.ts`),
  `test:dist`, `api-index`, `api-report`, `boundaries`, `style`, `test:browser:2d` exist where the plan runs them.
- The trial builds and packs of `@automata/3d` (307,640 bytes, 0.7 s) and the twelve kits (the plan's Part B table).
- The undocumented exports (finding 13) and the isolatedDeclarations counts (finding 14, appendix).
- The 3D stranger's journey to its end (finding 10).
- The recorded files (finding 5). The painter without its declarations (finding 3).

## The gates on this branch

`pnpm format`: exit 0. `node tooling/check-style/src/cli.ts --docs` (the docs step of `pnpm style`): 2 findings, both
from before this audit and both the same link, `audits/2026-11-12-ship-readiness.md`, in `progress.md:485` and the
spec's line 9: that file is on `claude/ship-readiness-audit`, not on `main`, so `pnpm check` fails on this branch (and
on `claude/ship-3d-plan`) until that branch merges. The rest of `pnpm check` was not run: this branch changes Markdown
only.

## What was not measured

- Any browser suite but the journey, and anything on WebKit, Firefox or a GPU.
- The editor journeys and the C4 journeys (the v2 page is not on `main`).
- The four branches not on `origin` (finding 22).
- Whether `publishedBuild` passes `clean: false` through (C1 says what to do either way).
- The DUEL palette's source and terms (no web search was made).
- The pixels of 0.1.0.

## Appendix: isolatedDeclarations errors, the first ten of each kind

`pnpm --filter @automata/<kit> exec tsc -p . --noEmit --isolatedDeclarations true` on `main` `d401ec4d`. Paths are the
kit's.

### `figures`

TS9007 (73):
- src/features/view/camera.ts(35,24): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/actors/actions.ts(54,25): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/actors/actions.ts(104,17): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/actors/actor-cast.ts(17,20): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/body/rig.ts(243,17): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/figure/figure-stamps.ts(168,17): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/hair/hair-geometry.ts(61,17): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/hair/hair-geometry.ts(256,23): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/hair/hair-geometry.ts(338,17): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/hair/hair-registry.ts(59,23): Function must have an explicit return type annotation with --isolatedDeclarations.

TS9008 (5):
- src/shared/actors/actor.ts(21,3): Method must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/actors/actor.ts(26,3): Method must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/actors/actor.ts(85,3): Method must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/actors/actor.ts(385,3): Method must have an explicit return type annotation with --isolatedDeclarations.
- src/shared/figure/figure.ts(137,3): Method must have an explicit return type annotation with --isolatedDeclarations.

TS9010 (27):
- src/shared/actors/actions.schema.ts(21,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/actors/actions.schema.ts(64,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/figure/frames.ts(14,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/hair/hair-registry.ts(156,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/hair/hair.schema.ts(124,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/hair/hair.schema.ts(131,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/lighting/times.schema.ts(5,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/lighting/times.schema.ts(14,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/math/math.ts(142,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/shared/motion/gaits.schema.ts(9,14): Variable must have an explicit type annotation with --isolatedDeclarations.

TS9011 (11):
- src/shared/actors/actions.ts(56,55): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/actors/actions.ts(90,62): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/actors/actions.ts(104,64): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/actors/actor.ts(72,20): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/actors/actor.ts(402,49): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/actors/actor.ts(485,41): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/figure/figure.ts(152,12): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/figure/frames.ts(16,30): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/figure/frames.ts(49,12): Parameter must have an explicit type annotation with --isolatedDeclarations.
- src/shared/paint/paint.ts(48,10): Parameter must have an explicit type annotation with --isolatedDeclarations.

TS9013 (8):
- src/features/view/camera.ts(32,61): Expression type can't be inferred with --isolatedDeclarations.
- src/shared/actors/actions.ts(58,23): Expression type can't be inferred with --isolatedDeclarations.
- src/shared/actors/actions.ts(59,14): Expression type can't be inferred with --isolatedDeclarations.
- src/shared/actors/actions.ts(59,32): Expression type can't be inferred with --isolatedDeclarations.
- src/shared/actors/actions.ts(60,16): Expression type can't be inferred with --isolatedDeclarations.
- src/shared/actors/actions.ts(60,26): Expression type can't be inferred with --isolatedDeclarations.
- src/shared/stage/pose.ts(130,8): Expression type can't be inferred with --isolatedDeclarations.
- src/shared/stage/pose.ts(131,10): Expression type can't be inferred with --isolatedDeclarations.

TS9016 (47):
- src/shared/figure/frames.ts(16,62): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-detail.ts(366,12): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-detail.ts(366,18): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-detail.ts(366,23): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-prepare.ts(97,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-prepare.ts(98,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-prepare.ts(99,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-prepare.ts(100,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-prepare.ts(101,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/shared/paint/paint-prepare.ts(102,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.

TS9017 (3):
- src/shared/paint/paint-face.ts(156,10): Only const arrays can be inferred with --isolatedDeclarations.
- src/shared/paint/paint-style.ts(172,22): Only const arrays can be inferred with --isolatedDeclarations.
- src/shared/paint/paint-style.ts(179,27): Only const arrays can be inferred with --isolatedDeclarations.

### `world-kit`

TS9010 (5):
- src/features/sky/shader-parts.ts(49,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/features/sky/shader-parts.ts(66,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/features/textures/photos.ts(23,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/features/textures/textures-command.ts(32,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- tests/browser/sky/support.ts(55,14): Variable must have an explicit type annotation with --isolatedDeclarations.

TS9013 (12):
- src/features/sky/glow-effect.ts(109,49): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/glow-effect.ts(109,59): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/particles-effect.ts(78,49): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/particles-effect.ts(78,59): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/rain-effect.ts(60,49): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/rain-effect.ts(60,59): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/reflect-effect.ts(125,49): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/reflect-effect.ts(125,59): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/shafts-effect.ts(176,49): Expression type can't be inferred with --isolatedDeclarations.
- src/features/sky/shafts-effect.ts(176,59): Expression type can't be inferred with --isolatedDeclarations.

### `character-kit`

TS9007 (5):
- src/features/fashion/shells.ts(143,12): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/features/fashion/shells.ts(272,18): Function must have an explicit return type annotation with --isolatedDeclarations.
- src/features/fashion/shells.ts(304,17): Function must have an explicit return type annotation with --isolatedDeclarations.
- tests/fixtures/painted-cell.ts(13,17): Function must have an explicit return type annotation with --isolatedDeclarations.
- tests/fixtures/stage-scene.ts(95,17): Function must have an explicit return type annotation with --isolatedDeclarations.

TS9010 (5):
- src/features/garments/kit-garment.ts(15,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/features/garments/kit-garment.ts(16,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/features/garments/kit-garment.ts(17,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- tests/fixtures/stage-scene.ts(26,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- tests/fixtures/stage-scene.ts(29,14): Variable must have an explicit type annotation with --isolatedDeclarations.

TS9011 (2):
- src/features/painted/lit-cells.ts(46,34): Parameter must have an explicit type annotation with --isolatedDeclarations.
- tests/fixtures/stage-scene.ts(281,10): Parameter must have an explicit type annotation with --isolatedDeclarations.

TS9016 (4):
- src/features/fashion/shells.ts(137,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/features/fashion/shells.ts(138,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/features/fashion/shells.ts(139,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
- src/features/fashion/shells.ts(140,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.

### `retro-crisp`

TS9010 (3):
- src/features/crisp/crisp-profile.schema.ts(7,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- src/features/retro/retro-profile.schema.ts(56,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- tests/browser/support.ts(64,14): Variable must have an explicit type annotation with --isolatedDeclarations.

TS9016 (1):
- src/features/crisp/crisp-scale.ts(31,5): Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.

### `lcd-panel`

TS9010 (2):
- src/features/lcd-panel/lcd-profile.schema.ts(8,14): Variable must have an explicit type annotation with --isolatedDeclarations.
- tests/browser/support.ts(64,14): Variable must have an explicit type annotation with --isolatedDeclarations.

