# The builders fold: plan audit

Workstream 6, stage 3. Audited: the spec
[`2026-11-12-builders-into-the-framework-design.md`](../specs/2026-11-12-builders-into-the-framework-design.md), the plan
[`2026-11-12-builders-fold.md`](../plans/2026-11-12-builders-fold.md) and its two surveys
([`figure-builder.md`](2026-11-12-builders-fold-survey/figure-builder.md),
[`environment-builder.md`](2026-11-12-builders-fold-survey/environment-builder.md)), on `claude/builders-fold-plan` at
`7cd5df6c` (`main` `0de72717` already in it). Every finding below was checked by running something; the command and its
result are given. The fixes are made in the plan, the surveys and the spec on `claude/builders-fold-plan-audit`.

## How it was run

- FigureBuilder cloned in full outside the repository; its `main` is now `c29284c` (the retirement note, `3caa9ad`,
  merged on top of `23f889c8`). EnvironmentBuilder likewise; its `main` is `1eb60f9` (the note `6983342` on `f7c5356`).
  Both are archived: read only. Nothing was pushed to either.
- The builder's own `npm ci` was refused by this session's permission check, so its suite ran with the framework's own
  installed toolchain (Vitest 5.0.3, TypeScript 6.0.3, `pixi.js` 8.22.0, `@pixi/3d` beta.2) linked into the scratch
  clone's `node_modules`, under Node 24.21.0 (the framework's) and, for one file, Node 22.23.4. `@napi-rs/canvas` was
  not installed, so the six scripts that import it were not type-checked or run.
- In that clone, on `23f889c8`, in the plan's order: the five clean c5 picks, N4 with the plan's resolution, the
  turned-face fix, then `claude/c9-wardrobe` merged.
- `git filter-repo` a40bce548d2c (pip's 2.47.0), the plan's exact command, in a fresh clone.
- The framework: `pnpm install --frozen-lockfile`, the submodule at `23f889c8`, x86_64, 4 cores.

## Findings

Severity: **blocking** (an execution session following the plan as written would stop, fail or do the wrong thing),
**should fix** (it would guess, or a stated fact is wrong), **tidy**.

### A1, blocking: N4 meets a file `main` added after the c5 branch was cut

Checked: the c5 picks and N4 with the plan's one-hunk resolution, then `tsc --noEmit` (TypeScript 6.0.3).
Result: 4 errors, `src/features/lighting/sprite.ts(194)`: `Property 'lo' does not exist on type 'Weave'` (and `hi`), and
the same at `tests/features/lighting/sprite.test.ts(164)`. N4 replaces `Weave.lo`/`hi` with a depth table and makes
`on` 1 + an index into it; `lighting/sprite.ts` came to `main` with c8-lit after the branch was cut and still reads
`weave.lo[k]`, `weave.hi[k]`, and tests `weave.on[k] === 1` at lines 100 and 175. No conflict marks it: git merges the
file cleanly. The type errors are loud, but the two `=== 1` tests are silent: a texel of a second fabric depth
(`on === 2`) would be lit as untiled.
Fix in the scratch clone (then the whole suite, below): `=== 1` to `!== 0` at both lines; `...depthAt(weave!, k)` for
the two reads, as N4 itself wrote `light.ts`; the test the same. 0 type errors after.
**Changed:** task 4c gains step 3b: a test first (a sprite-lit figure in two fabrics of different depths, so some texel
has `on === 2`, and every tiled texel equals `tiled(lit, label, ...depthAt(weave, k))`), seen to fail, then the four
edits, as its own commit. The goldens wear no fabric, so none can catch it.

### A2, blocking: the preset cannot make the `goldens` project the plan asks for

Checked: `tooling/vitest-preset/src/index.ts`. `defineTests` makes one Node project, named `unit`, over
`tests/unit/**/*.test.ts`; it has no option for a second Node project. Task 7, step 3 says "uses `defineTests` …
with two Node projects", which cannot be written. The preset is private, but changing it for one package is not needed.
**Changed:** task 7, step 3 gives the configuration: `defineTests` as the kit uses it, then its `unit` project split in
the package's own `vitest.config.ts` into `goldens` (`include`: the nine files) and `unit` (`exclude`: the same), with
the code. The check that both runs together have the old test count stays.

### A3, blocking: a wardrobe test fails on the framework's Node

Checked: the wardrobe branch alone, `tests/features/body/face-d2.test.ts`, under both Nodes.
Result: Node 22.23.4: 39 of 39 pass. Node 24.21.0: 1 fails, `headForm at the default sliders keeps its width, front and
back`: `front 0.95: expected 0.07329037500000002 to be 0.07329037500000003`. The test pins the head's profile to the last
bit with `toBe`; the branch recorded it on Node 22. The framework requires Node 24.21 (`engines`, `.nvmrc`), so task 5,
step 3 ("every test passes") stops. The five goldens and every pin of cells pass on Node 24.21: no texel moves, only the
last bit of one float of geometry. Which operation differs between the two V8 versions was not traced.
**Ruled by the coordinator (2026-11-12):** the pin compares within a few ulps, in its own commit, with a test that no
painted cell depends on that bit, and the plan names the authoritative Node. Measured for it: the difference is 1 ulp;
on the wardrobe branch alone, 29 files and 353 tests (goldens, cell pins, `ulp`, `sheets`, hair, outfit, paint) pass
identically on Node 22.23 and 24.21 but for this pin. **Changed:** task 5, step 3b (a nudge case in `ulp.test.ts` first,
then the pin within 2 ulps; Node 24.21.0 named authoritative by `engines`, `.nvmrc`, `useNodeVersion` and CI). Earlier
text: task 5, step 3 expected this one failure and made it a stop for the coordinator with the measured
cause and the recommended fix: the pin compares within a few units in the last place (the cells are the painter's
promise, and `ulp.test.ts` already holds them under a last-bit nudge), in its own `test(figures)` commit after the
merge, never by re-recording under one Node. The Owner's arm64 run (task 13) must use Node 24.21, since the runtime is a
second axis besides the architecture.

### A4, blocking: the turned-face fix fails five tests in four files, not four in three

Checked: the whole suite with everything applied (Node 24.21): **52 files, 651 tests, 6 fail, 267 s.** Besides A3's,
the turned-face fix fails `golden/actors` (`base-m`: 10 frames, `base-f`: 8 frames, all `wave`), `golden/base` at
density 1 (`base-m-hero-d1`: 9 bytes, the first at 6284), the sprites golden (`base-m-D1`) **and**
`tests/features/stage/sheets.test.ts` ("the stage keeps the base goldens": `base-m hero0 at D1`, 3 texels). The last
reads the base golden's data; the plan session ran only the goldens and the painter's tests, so it was not seen.
Task 4d, step 2 says any failing test that is not a golden is a stop.
**Changed:** task 4d names the fifth test as expected (a reader of the base golden, green again after the base
re-record), and the numbers above. That `sheets.test.ts` passes after `golden -- base` was not run here.

### A5, blocking: the strict tasks' speed proof and their checked reader

Checked, in three scratch copies with A1's fix, on the rasteriser's hottest loop (`rasterize`, `paint/raster.ts`):
- The plan's `pnpm --filter @automata/character-kit bench` does not exist: the kit has no `bench` script
  (`AF_BENCH=1 … vitest run --project bench`), and its one bench, `tests/bench/lit.bench.test.ts`, subtracts the
  painter's own `cellOf` time by design, so it cannot see a slower rasteriser.
- The plan's reader, `at(xs, i)` (one generic function that throws), through every read in `rasterize`: a synthetic
  bench (3,000 triangles in 192 × 192, 200 passes, 4 runs each) went from **1,150 ms to 6,400 ms (5.5×)**. The base,
  lit and sprite goldens went from 9.43 s to 10.04 s mean (+6.5%, 3 runs each): under the plan's 10% bar only because
  rasterising is a small share of a golden.
- The inline form `xs[i] ?? outside(xs, i)` (`outside` returns `never` and throws a `RangeError` naming the index and
  the length): **1,160 ms against 1,180 ms (+1.7%, within the runs' spread)**, and `rasterize`'s strict errors go from
  55 to 0 under `--noUncheckedIndexedAccess`. It hides nothing: a missing element still throws.
**Changed:** the strict rule 3 is the inline form with `outside` (task 21's test pins it); the generic `at` is not
used in a loop. "After each folder" times a new painter bench, `tests/bench/raster.bench.test.ts` (task 21 writes it:
the synthetic loop above plus the base pair's sheets drawn cold), with the right command, and the kit's bench is
named for what it measures (the light), not as the painter's proof.

### A6, should fix: the strict ledger counts only `src` and `base`

Checked: `tsc --noEmit --noUncheckedIndexedAccess --exactOptionalPropertyTypes` over the whole package with the fix
branches and the wardrobe branch in. Result: `src` **1,427** (1,395 at `23f889c8`), `tests` **579**, `scripts` 51,
`viewer` 28: 658 errors the ledger did not count, which task 27, step 2 would meet in one step ("tests and scripts
included"). By test folder: `hair` 133, `outfit` 127, `stage` 100, `paint` 54, `figure` 49, `motion` 38, `body` 35,
`view` 15, `support` 9, `lighting` 9, `actors` 3, `api` 3, `golden` 2, `draw` 1, `architecture` 1.
**Changed:** the ledger gains a column for the tests and rows for `scripts` and `viewer`; each strict task takes its
layers' test folders (`tests/unit/<layer>`), and task 27 takes the scripts, the viewer and what is left.

### B1, should fix: the filter on an archived source whose `main` moved

Checked: the plan's filter command in a fresh clone. `main` is `c29284c` now, not `23f889c8`. The two retirement
commits touch only `README.md`, so the filter prunes them: the commit map has `23f889c8 → 31b9967` and
`3caa9ad`, `c29284c → 0000…`, and filtered `main` is the same 236 commits. With the four refs the plan filters: **251
commits** (236 + 7 + 6 + 2), **134 files**, none outside `extensions/figures/`, **1.72 MiB** fetched into an empty
repository (the plan said 243 and 1.64 MB, for two refs). The filtered ids: S1 `27a8fa8`, S2 `8dfb448`, N1 `a293d24`,
N2 `b3cdafb`, N5 `eaebfbf`, N4 `37cf985`; the turned-face fix `8bd4715` (its re-record `3a3bb16` is not brought); the
wardrobe's F0 `f301682` to F6 `f9b1b3d`.
**Changed:** task 2, step 1 sets `main` to `$PIN` before filtering and checks the commit map maps `$PIN` to filtered
`main`; the expected numbers and ids are the measured ones. (Superseded by B9's ruling: the history now starts at the last content cut, 126 commits and
1.04 MiB, and the ids are those of that run.) The "History" section and the survey say the same.

### B2, should fix: the c5 picks' listing command lists the whole history

`git log --format='%h %s' painter-history/claude/c5-finish-fixes` prints all 263 commits of the branch's ancestry.
**Changed:** `git log --reverse --format='%h %s' painter-history/main..painter-history/claude/c5-finish-fixes` (6
lines), with the ids above.

### B3, should fix: the retirement notes are merged and both repositories archived

The Owner's decision 4. Checked: FigureBuilder `3caa9ad` merged as `c29284c`; EnvironmentBuilder `6983342` merged as
`1eb60f9`; their texts differ from the plan's drafts. **Changed:** "The retirement notes" records what is merged
(commits, not drafts); task 19, step 3 records those commits instead of asking; a new paragraph, "The archived
sources", says what read-only means for each step that reads them: they clone, their branches and tags read, every
step pins a commit and never `main`, nothing can be pushed, commented or merged there (FigureBuilder #29 stays open for
good), and an execution session attaches both read only before task 1 (task 1's `git submodule update --init` needs
FigureBuilder too).

### B4, should fix: the hook's cache and `AF_UNIT_FULL`

Checked: `turbo.json`, `lefthook.yml`, the root scripts, `ci.yml` (`pnpm test:unit`, line 126) and the windows trial
(POSIX script shell). The split runs as the plan says: the hook's `turbo run test:unit --filter="...[HEAD]"` sets no
variable; `pnpm check` and CI go through the root `test:unit`. But `"env": ["AF_UNIT_FULL"]` on the generic
`test:unit` task changes every package's cache key, so no package's hook run serves `pnpm check`. **Changed:** the
entry is `@automata/figures#test:unit`, and it repeats `passThroughEnv` (a package's entry replaces the generic one).

### B5, should fix: the fresh-clone check cannot pass `check:changesets`

`pnpm check` ends with `changeset status --since=origin/main`. A clone of the local working tree has no
`origin/main` unless the session's repository has a local `main`. **Changed:** task 4, step 6 fetches
`refs/remotes/origin/main` into the fresh clone first, with the command.

### B6, should fix: `docs/actors.md` at the root would be a published surface

Task 12 created `docs/actors.md`; the root `docs/` (outside the record folders) is read by `pnpm source-names`, and
the builder's file names the builder. **Changed:** `extensions/figures/docs/actors.md`, beside the contract.

### B7, should fix: the tiles cross-check, run: 112 of 112

Checked: a scratch script that rebuilds each key's spec from the builder's JSON (as its `tests/golden/tiles.ts` and
`swatchTextureOf` do), runs the world kit's `photoToTile` on the kit's own photo bytes (each equal to the builder's,
size included) at wear 0.3, seed 1, 32 texels a metre, and hashes `` `${width}x${height}` `` and the labels' bytes.
Result: **112 keys, 112 equal, 0 differ, 10 s.** The kit's `Uint16Array` labels hash as the builder's `Int16Array`
because labels are never negative. The 36 `/swatch` keys need the builder's swatch knobs: the kit's
`library/swatches.json` holds all 167 of the builder's swatches with the same `texture` (and 3 more), and the
builder's rule over the kit's file gives the same spec for all 38 photos. **Changed:** task 15's steps are the measured
procedure (the specs from the kit's own library by the builder's rule, written in the test with a comment), its
expected result is 112 equal, and "no mapping can be written" goes.

### B8, should fix: the hunks since `6d82a52`, read

Checked: `git diff 6d82a52 f7c5356` over the ten files, against the framework. The table is now in the survey ("The
hunks, read"). Already answered: `MIN_READ` (`reads-against.ts:9`), the swatch-texture rule (task 15's test), the
exposure for painted figures (the character kit's `room-light.ts`). Not wanted: the CPU renderer's albedo export,
`largestReadIn`, the CPU frame, `FigureLightKey`, the grime-mark types and `propSectorOf` (the framework has no grime
marks), the CPU figure light in `look.json`/`look.ts`, `sprite-light.ts`'s `exposure` and `flatTop` (no framework
caller of `@automata/3d`'s `spriteLight`). **To port: one**: `maps.json` gives the bedroom `"reads": {}`; the kit's
`tests/fixtures/builder-maps.json` (taken at `6d82a52`) lacks it, the other four maps are equal. **Follows, not
portable yet: one**: `base/base.ts` drops the interior's `hot` waiver after the builder turned exposure on; the
framework's `base-scenes.ts` keeps `reads: { hot: true }`, and no framework step judges a level's reads yet (the
following work "a level's `reads` as a gate"). No hunk moves a recorded frame of the world kit or the 3D package.
**Changed:** task 16 is the one port (test first) and the one line of following work; its step 1 is done.

### B9, should fix: what the filtered history brings

Checked: `git grep` over every commit the filter keeps. The history carries the builder's first cast, cut on
2026-11-05: named characters of the reference game and the Owner's SNEKPRTY graphics (`src/render/figure/streetwear.ts`,
`library/graphics.json`, `looks.json`, `sets.json`, `headwear.json`, the dressed golden's 44 sheets, the scene
pipeline, the portraits), and the characters inside `render/figure/cast.ts`, `genes.ts`, `rig.ts`, `paint.ts` until
`d8f7fcd` and `e6cbf80` swept them. The coordinator was told at once and ruled: **strip it, because history is published
with the repository.**

A path filter cannot do it: `cast.ts`, `presets.ts`, `genes.ts`, `swatches.json` and `items.json` are machinery
renamed into `src/features/` and kept at the tip, and the engine files of that time name the characters in their own
text. So, as the coordinator's fallback proposed, the kept history starts at the last cut. Dry run, in a fresh clone of
the archived repository, `main` set to `$PIN`: every commit that descends from `6b6819c` (filtered `e6cbf80`) kept,
every parent outside that set dropped with `git replace --graft` (two grafts: the cut itself becomes the root, and the
merge `13407db` keeps only its parent from the cut branch), then the plan's one `filter-repo` run, which writes the
grafts in. Result, fetched into an empty repository: **126 commits** (`main` 111, wardrobe 7, c5 6, turned face 2), one
root, **1.04 MiB**; `main is the pin` and `main`'s tree `d4976948…` is the same as before (so the checksum manifest
holds unchanged); **0 blobs** match `snek[ _-]?prty`; **0** paths of the cut content in any commit. Left: "the Nurse"
in three tip comments (`body/parts.ts`, `motion/motion.ts`, `paint/paint.ts`) and in two wardrobe files
(`scripts/c9-sheet.ts`, `tests/features/hair/standoff.test.ts`), which must stay byte-identical at arrival, and the
wardrobe's guard that no hair style's text names Ada, the Nurse or Voss. The root commit holds the whole tree of that
moment; its message describes a change against a parent that is not there, which the merge body says.
**Changed:** task 2, step 1's command (the grafts before the filter), its expected counts and ids, and the content
check; "History"; the merge body; task 12's provenance section; task 12, step 4 rewords all five files' mentions.

### B10, should fix: the spec, on two points the plan found

The type-declarations step cannot go while the strict flags are off (the plan's own finding), and rule 1 cannot hold
for EnvironmentBuilder's `base` and `scenes` goldens (they move with its painter at the framework's pin). **Changed:**
a dated amendment in the spec for each, under option A and saying what B changes.

### B11, should fix: the live branches the fold meets

- `claude/pixi-3d-beta-3` moves the `pixi.js` pin to 8.23.0 in `vendor/figure-builder/package.json`, a file task 4
  deletes: a modify/delete conflict when it merges after the fold. **Changed:** item (0) of what the upgrade inherits:
  delete the file, and move the pin in `extensions/figures/package.json` (peer and dev).
- `claude/last-light-prologue` edits the same root script lines the fold edits (`boundaries`, `style`,
  `test:unit:2d`/`3d`, `test:browser:*`, `source-names`) and adds two path filters right above `3d.yml`'s submodule
  filters; its game imports `paintedFigure` from the kit's entry, not the door's path. **Changed:** task 4b finds its
  lines by its own test, not by the line numbers, if `main` moved them; task 7 says to add to each list beside whatever
  is there.

### B12, should fix: the declarations must come before every typecheck, not only the kit's

Checked: this session's first `pnpm check` ran after an install whose `prepare` found no submodule checked out, so the
wrapper's `types/` was not built. It failed in `@af-examples/examples-3d#typecheck` with the painter's `TS2532` and
`TS2375` errors: `examples/3d` imports the kit, and with no declarations TypeScript checked the painter's source under
the strict flags. After `pnpm --filter figure-builder run prepare` the typecheck passed. The plan's task 3 orders only
`@automata/character-kit#typecheck` after the painter's; `examples/3d` (and on `claude/last-light-prologue` the game)
would race it. **Changed:** task 3, step 3 gives the generic `typecheck` a `dependsOn` on
`@automata/figures#typecheck` (with the package's own entry, so it does not wait on itself) and checks it with
`rm -rf extensions/figures/types && pnpm typecheck`; the risks row and task 27 follow.

### C1, tidy: the workflow table holds at `main` `0de72717`

`grep -rn "SUBMODULES_TOKEN\|checkout-submodules\|vendor/FigureBuilder\|vendor/figure-builder\|submodule"
.github/workflows/*.yml`: 73 lines in the eight files, at exactly the plan's line numbers (no workflow changed since
`0df11a43`). The workflows' steps and `checkout-submodules.sh` read as the plan says.

### C2, tidy: the times of the split

The `goldens` project's nine files under Node 24.21: **74 tests, 33 s** (4 cores, alone). The whole suite with
everything applied: 267 s. The plan's "about 30 to 60 s" and "about 3 minutes" hold.

### C3, tidy: the SUBMODULES_TOKEN secret

A branch that has not merged `main` past task 4b still runs the submodule step on push events with its own workflow
files. **Changed:** task 4b, step 4 says the Owner deletes the secret once no open branch predates the fold, or
accepts that such a branch's run warns and fails its install.

## Not verified here

- Anything on arm64, and WebKit, Firefox or a real GPU.
- The view check (`view-check`) and any render script: they need `@napi-rs/canvas`, which was not installed (the
  builder's `npm ci` was refused here).
- Task 2's workspace package as a whole (`pnpm install` with the new package, its `prepare`, `knip` and
  `pnpm check` with it in): not tried in a scratch worktree.
- That `stage/sheets.test.ts` passes after `golden -- base`; which V8 operation moves A3's last bit.
- The kit's suites with the fix branches and the wardrobe applied (the kit was not pointed at the scratch painter).
- The full history size of the framework (the clone is shallow).
