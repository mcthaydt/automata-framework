# The builders fold, group 1: implementation audit

**Date:** 2026-11-12. **Stage:** 5 (implementation audit) of workstream 6, group 1. **Branch:**
`claude/builders-fold-implementation-audit`, from `main` at `4a505e86` (the merge of #661; the branch's last commit
`3dfba79b`; `main` before it `924a26ef`). **Audited:** `git diff 924a26ef..4a505e86` (284 files, +29,268 / −670; 185 of
them under `extensions/figures`, 162 painter commits reachable from `main`), against [the spec](../specs/2026-11-12-builders-into-the-framework-design.md)
and its two amendments, [the plan](../plans/2026-11-12-builders-fold.md) with its log of six execution sessions,
[the plan audit](2026-11-12-builders-fold-plan-audit.md), the surveys, `AGENTS.md` and the code on `main`. FigureBuilder
(archived) was attached read only and cloned blobless outside the repository; nothing was pushed there. No code and no
test was changed by this stage; every probe below ran in a scratch clone and was reverted (`git status` clean after each).

## Verdict

1. **The painter arrived whole and draws exactly what it drew:** the five goldens equal FigureBuilder's at `23f889c8`
   byte for byte but for the three files of the Owner's turned-face re-record; `paint()`'s cut is token-identical; every
   suite passes, and a fresh clone passes the whole `pnpm check` uncached with no submodule and no manual step.
2. **One blocker, outside the code:** PR #661's required gate job was **red** when it merged (a stale `vendor/FigureBuilder/`
   on one self-hosted runner, now linted because the fold removed its Biome exclusion).
3. **Five should-fix:** a hand-run recorder broken by the move, a workflow invariant that misses a real submodule step,
   one ticked step not carried out, stale paths and commands in the painter, and records that are no longer true. Ten
   notes. 16 findings in all.

## Findings

### B1, blocker: the pull request merged with its gate red, and a runner's stale submodule breaks the gate

**Evidence.** PR #661's check run "lint, typecheck, boundaries, style, unit" (run `43245391355`, job `131276539530`, on the
`af-mac` runner whose workspace is `/Users/mcthaydt/ar3/_work`) **concluded `failure`**; the PR was merged anyway. Its log:
`biome check` reports 239 errors and 1,354 more diagnostics in `vendor/FigureBuilder/…` (for example
`vendor/FigureBuilder/vitest.config.ts:1:1 assist/source/organizeImports`). That runner's workspace still holds the old
submodule's checkout as an untracked folder: `actions/checkout` does not remove it, and the fold removed `biome.json`'s
`"!vendor/FigureBuilder"` exclusion (`biome.json:20` at `924a26ef`) and `.gitignore` does not name it, so Biome (which
reads the VCS ignore file, `vcs.useIgnoreFile`) lints it. The same job on `main`'s push (run `43245414189`, runner
`af-mac-3`) passed lint, typecheck, boundaries, style and knip: the failure follows the runner, so any pull request
scheduled onto the stale runner fails. The plan's log (task 13) says "the whole `pnpm check`… exit 0" and the PR's own
gate disagreed; the plan's rule "Never accept a hash mismatch as flaky" applies to a red gate too.

**Breaks:** `AGENTS.md`, Gates ("Pull requests run `pnpm check`…"); the spec's first "Done means" line (a checkout with
the old submodule's folder in it does not check).

**Smallest fix:** add `vendor/FigureBuilder/` and `vendor/figure-builder/` to `.gitignore` (one comment: old checkouts
and runners keep the submodule's folder; Biome, knip and the style checks read the ignore file), then re-run the job on
the `ar3` runner. Deleting the folder on each runner is the Owner's, and does not protect a developer's old clone.
(`main`'s `ci.yml` and `3d.yml` were already red on `924a26ef` and earlier merges, before the fold; see N9.)

### S1, should fix: the runway recorder no longer finds the painter

**Evidence.** `extensions/character-kit/scripts/record-runway-cells.ts:33` points `BUILDER` at `extensions/figures`
(task 4), and lines 64 to 66 rewrite the showcase's `'../../src'` to `extensions/figures/src/index.ts` and
`'../../src/…'` to `extensions/figures/src/…`. Task 7 moved those files: the showcase (`cb4aa9f:demo/runway/wardrobe.ts`,
read from the archived repository) imports `'../../src'`, `'../../src/features/body/parts'` and `'../../src/lib/math'`, and
none of `src/index.ts`, `src/features/body/parts.ts` or `src/lib/math.ts` exists now (`ls` fails). So
`pnpm --filter @automata/character-kit goldens:runway` cannot re-record `runway-cells.json`, the kit golden a painter
change is most likely to move. Not run here (the session's permission check refused running the archived repository's
code), so the evidence is the paths, read.

**Breaks:** the spec's "Done means": "A figure change … can be made, tested and merged in the framework alone."

**Smallest fix:** a map of the three old specifiers to `src/entries/index.ts`, `src/shared/body/parts.ts` and
`src/shared/math/math.ts` (a fourth case throws, naming the specifier), and a unit test of the rewrite over the three
showcase lines.

### S2, should fix: the workflow invariant passes a real submodule step

**Evidence.** `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts:78-86` matches only
`SUBMODULES_TOKEN|checkout-submodules|vendor/FigureBuilder|vendor/figure-builder`. Probed in a scratch clone: with
`submodules: recursive` added under `consumer-smoke.yml`'s `actions/checkout` `with:`, the file's 8 tests pass; with a
step `run: git submodule update --init --recursive`, 8 pass. (Reverted.) Nothing else checks that `.gitmodules` stays gone.

**Breaks:** the brief's point 3 ("the invariant test really fails on a submodule step") and the test's own title ("the
repository has no submodule").

**Smallest fix:** add `submodules:` and `git submodule` to the pattern (and a case for each), and one hygiene case that
`.gitmodules` does not exist.

### S3, should fix: task 12 step 4 is ticked but the old game's repository is still named

**Evidence.** The plan (task 12, files list and step 4): "`pose.ts` keeps the game's name and drops the old repository's".
`extensions/figures/src/shared/stage/pose.ts:125` still reads "The Last Light's gameplay camera
(mcthaydt/PixiJS3D_Experiment_001 at 92e6704)". Task 12's commit `41adad76` changed only the header comment of that file.
Two identifiers keep a cut character's name: `scripts/c9-sheet.ts:99` `export const nurse` (left on purpose, the fourth
session's handoff) and `tests/unit/hair/standoff.test.ts:26` `const NURSE` (used at 230, 239, 252, 253); the task's check
(`grep -rn "Nurse"`) is case-sensitive and missed the second.

**Breaks:** `AGENTS.md` ("Tick a plan step only when its checks pass"); spec rule 3 (no game content).

**Smallest fix:** drop the repository and commit from `pose.ts:125`; rename `nurse`/`NURSE` for what they are (a tilted,
stooped figure with a loose spring); re-run the check case-insensitively.

### S4, should fix: stale paths and commands in the painter

**Evidence.** Four comments name documents that did not come and do not exist: `scripts/c9-sheet.ts:2`
(`docs/superpowers/plans/2026-11-11-c9-wardrobe.md`; it is now under `docs/archive/figure-painter/c9-wardrobe/`),
`scripts/golden.ts:20`, `tests/unit/layers.test.ts:6`, `tests/unit/motion/stand.test.ts:14`. Usage lines say `npm run …`
where the package is run with `pnpm --filter @automata/figures …`: `scripts/golden.ts:16`, `render.ts:4`, `lit.ts:7`,
`actors-demo.ts:7`, `c5-finish-sheet.ts:7-8`, `c9-sheet.ts:4-5`, `viewer/main.ts:4`, `src/shared/figure/frames.ts:12`,
`tests/unit/golden/base.ts:2`, `tests/unit/actors/actors.test.ts:16`; two name commands that do not exist:
`tests/fixtures/pins.ts:127` (`npm run pins`, no such script) and `scripts/c9-pins.ts:1` (`npx vite-node`, not a
dependency; the package uses `tsx`). Three call the package by its old name: `src/entries/index.ts:3`
("FigureBuilder's public surface"), `src/shared/stage/stage.ts:48`, `tests/unit/view/template.test.ts:9,29` (the
template guard's failure message says "FigureBuilder's copy must be redone"). The contract's table puts `duel` and
`oklab` in `src/shared/paint/paint.ts` (`docs/contract.md:183`); they are in `paint-style.ts` (re-exported). Task 12's
check grepped only `submodule|vendor/FigureBuilder`.

**Breaks:** `AGENTS.md` ("Comments say why"; a comment that sends a reader to a missing file does neither); the brief's
point 4.

**Smallest fix:** one `docs(figures)` commit: the four links to their archived home or removed, `pnpm --filter
@automata/figures <script>` for `npm run`, `tsx` for `vite-node`, the `pins` line pointed at `c9-pins.ts`, "the painter"
for "FigureBuilder", the contract's row to `paint-style.ts`.

### S5, should fix: records that are no longer true

**Evidence.**
- The plan's task 1 steps 1 to 3 are unticked (`- [ ]`) while its row says done, with evidence (`e074227fe`).
- Task 13 step 7 is unticked; the pull request is #661, merged.
- The tracking line says "15 of 28 tasks done (54%) (tasks 9 to 12 done)"; 16 are done (1 to 13 with 4b to 4d), as
  `progress.md` says (57%).
- "37 files carry a `biome-ignore-all lint/style/noNonNullAssertion`" (the plan's group 1b note; `progress.md`): **56**
  files carry it (`grep -rl`), because task 9's splits and task 11's new files copied the header. Measured with the lines
  stripped in a scratch clone (`biome lint --only=style/noNonNullAssertion`): **173** `!` in **43** files; **13** files
  carry the ignore with no `!` at all (`actor-cast.ts`, `actor-types.ts`, `garments-types.ts`, `garments-parts.ts`,
  `garments-registry.ts`, `paint-stamp.ts`, `paint.ts`, `paint-face.ts`, `motion-types.ts`, `motion.ts`,
  `tests/browser/view/view-check.test.ts`, `tests/fixtures/view-claims.ts`, `viewer/main.ts`).
- `progress.md` workstream 6 says "ready to merge; no pull request is opened"; it merged as #661 with its gate red (B1).
- Task 4d's text says the actors golden's moved frames are "all `wave`"; they are wave, swing, punch, two stands and
  script (`actors.json`, 18 keys, compared with `23f889c8`). The turned-face sheet itself is right.

**Breaks:** `AGENTS.md` ("Update `docs/refactor/progress.md` and the plan's log … Tick a plan step only when its checks
pass").

**Smallest fix:** tick task 1 and task 13 step 7; the count 16 of 28; "56 files (43 with `!`, 173 in all)" in the note and
in `progress.md`, and the 13 dead headers removed (Biome passes without them); `progress.md` says merged as #661 and that
its gate was red (B1); the 4d wording.

### Notes

- **N1. Comments that name a plan.** Each of the 56 ignore headers says "until task N of the builders-fold plan", and
  `extensions/figures/tsconfig.json:2-3` says "the builders-fold plan's ledger, tasks 21 to 27". `AGENTS.md`: comments
  "do not say which plan asked for the code". The coordinator accepted the headers as a ledger the strict tasks remove
  (task 27 step 4 greps for them); the `tsconfig.json` comment goes at task 27 step 2. `pnpm style --plan-comments`
  passes them, so its detector does not know this form; worth a case there.
- **N2. The layer order is enforced by two checks together, as the readme says.** `tests/unit/layers.test.ts` reads only
  relative specifiers, so a `#src/…` import in `src/` would pass it (probed: 6 of 6 pass with
  `src/shared/math/colour.ts` importing `#src/shared/stage/stage.ts`); `pnpm boundaries --features` refuses that import
  ("Import by relative path in src/", 1 finding). Sound; the spec's "restated in `pnpm boundaries`" is the plan's call 3
  (a package test), accepted.
- **N3. A kit file outside the door names the painter.** `extensions/character-kit/src/features/fashion/garments.ts`
  has `declare module '@automata/figures'` (module augmentation of `GarmentKinds`); the door test's pattern does not see
  `declare module`. Type-level only and older than the fold (`figure-builder` before). Either the augmentation moves into
  the door, or the door test names it as the one allowed exception.
- **N4. Nothing outside the kit is forbidden the painter by a check.** `pnpm boundaries` forbids `@automata/figures` in 13
  packages and `--no-extension-imports` keeps core off every extension; another extension, a game or an example could
  import it once it declares the dependency. Today `git grep @automata/figures` finds only the kit, the root scripts,
  `turbo.json` and the closed-beta guard.
- **N5. The view check's deletion.** The suite covers every case the script did (227 by name, task 11's log; 227 pass
  here). It lost the script's `OUT_DIR` dump of the CPU and GPU frames and their difference, which is what a person reads
  when a real GPU disagrees with the CPU ("Unproven", a real GPU). `?case=`/`?check=` had no other reader. Worth a `debug` dump in the suite
  before the beta.3 port.
- **N6. `pnpm test:browser:3d` skips the painter's 105 WebGPU cases off a GPU:** turbo passes no `AF_WEBGPU`
  (`turbo.json`), so on a machine without a GPU they skip in words; the gate counts on the Mac GPU runner.
- **N7. Duplicated helper.** `extensions/character-kit/tests/fixtures/ulp.ts` is "FigureBuilder's `tests/support/ulp.ts`,
  written again"; the original is now `extensions/figures/tests/fixtures/ulp.ts` in the same repository.
- **N8. Test helpers sit in `tests/unit/`**: `body/ends.ts`, `golden/{actors,base,lit,sprite,sprites}.ts` (the recorders,
  which `scripts/golden.ts` imports), `outfit/wardrobe-fixtures.ts`, `paint/fabric-fixtures.ts`, `stage/fixtures.ts`,
  where `AGENTS.md` names `fixtures/`. The plan put the recorders there on purpose.
- **N9. `main` was red before the fold.** `ci.yml` failed on `924a26ef` and the two merges before it; `3d.yml` failed on
  `924a26ef`. On `4a505e86`, `3d.yml`'s parity job failed on `@automata/world-kit`'s `ward.test.ts` (a 90 s timeout,
  WebGL2 on Chromium), and turbo stopped the other packages' suites (the painter's and the kit's) before they finished;
  its journeys job failed in `@af-examples/3d-story test:e2e`. Neither is the fold's code, but neither proves it either.
- **N10. Content left by choice.** "The Last Light" is named in `src/shared/stage/stage.ts:51`, `pose.ts:125`,
  `viewer/main.ts:6,50`, `tests/unit/stage/pose.test.ts:80` and `docs/contract.md:49,88,109` (the plan keeps the game's
  name); the archived wardrobe documents (`docs/archive/figure-painter/c9-wardrobe/`) name Ada and the Night Nurse about
  40 times (the framework's archive already named both). The Owner's call before the repository goes public.
  `kit`'s `gate.ts` error now says "give the figure builder's folder there the commit that tree names", which no reader
  can act on.

## Verified and sound

- **A fresh clone** of `main` at `4a505e86` (plain `git clone`, `pnpm install --frozen-lockfile`, Node 24.22.1): no
  `.gitmodules`, no `vendor/FigureBuilder`, no `vendor/figure-builder`; `TURBO_FORCE=true pnpm check` **exit 0**, 18m12s,
  the unit stage 66 of 66 tasks, the painter 53 files, 723 tests. Nothing else typed.
- **The goldens against FigureBuilder at `23f889c8`** (sha-256 of every file): `lit.json`, `sprite.json` and 11 of the 12
  base sheets identical; `actors.json` differs in exactly 18 keys (base-m 10, base-f 8), `sprites.json` in 1, and
  `base-m-hero-d1.rgba.gz` in 9 bytes (decompressed, from offset 6285): the Owner's re-record ("yes, give me both eyes"),
  `0eb1a766e`, after the builder's own fix `18d0cec77`. The kit's recorded files: none changed in `924a26ef..4a505e86`.
- **The suites, Chromium only, software GL:** the painter's unit suite on its own script and 30 s limit
  (`AF_UNIT_FULL=1`) 53 files, 723 pass, 4m37s; the painter's browser suite (`AF_WEBGPU=software`) 2 files, 227 pass; the
  kit's `browser (chromium)` and `webgpu` projects 58 pass, 3 skipped by design; the kit's unit 28 files, 229 pass.
  `git status` clean after them.
- **`paint()`'s cut (c).** The body at `dbf701f26` (the commit before `439487ff0`) against the fourteen phase bodies at
  `3854c1dd0`, in the order `paint.ts` calls them, with each phase's `const { … } = ctx` and `return { … }` dropped,
  compared with TypeScript's scanner: **12,354 tokens identical**, the one difference the final `return`, now in
  `paint.ts`; **150 comments identical**. The only `let` a phase hands on (`faceTh`, `faceForm`) is last assigned before
  the phase returns, and no returned closure assigns a context name, so no value is captured stale. Measured in the log:
  the cut is faster, not slower.
- **`class Figure` (d).** `faceAt` and `handsAt` in `figure-stamps.ts` equal the old methods with `this.` read as `f.`;
  `fillDepth` takes the four fields as arguments; the `Posed` object is built just before the two calls, and nothing in
  `figure-stamps.ts` assigns through it.
- **The split tests (e)** (`b3366fcdf`): the same assertions over the same samples: 5 sliders, 2 figures × 9 angles,
  2 × (1 standing + 15 walk frames, every tenth of 150, three per block of 30, each block stepping the walk from its
  start), and 22 body sliders; +51 tests, as the log says.
- **`asWritten` (b).** No schema has a `default`, `transform`, `catch`, `coerce`, `preprocess` or `pipe`, so a parsed
  value could only differ from the raw by key order; no reader lost a default.
- **The value-changing lint edits (i).** `noSelfCompare`: four `x !== x` to `Number.isNaN(x)` (equal for every value);
  `noApproximativeNumericConstant`: five ignores, no value changed; `noAssignInExpressions`, `useOptionalChain`,
  `noUnusedVariables` (pure arithmetic locals) and `noUnusedFunctionParameters` read: no order or value changed.
- **The root's Pixi (f)**: nothing in the workspace imports `pixi.js` or `@pixi/3d` without declaring it; the spikes
  link a package's `node_modules`. **`@napi-rs/canvas` (g)**: a dev dependency, with its `docs/versions.md` row.
- **The framework's rules:** no file over 600 lines; every file name kebab-case; Zod only; Pixi imported only in
  `src/features/view/`, the viewer and `tests/fixtures/view-draw.ts` (the layer test's case); every test imports `#src/…`
  (`pnpm style`); `"private": true`, no changeset; `pnpm boundaries` 0 findings.
- **History:** the pin's filtered commit `c85b9610c` and the root "Sweep dead exports…" (`36a135e67`) are reachable from
  `main`; no blob under `extensions/figures` in any of the 162 painter commits names SNEKPRTY; the commit map and the
  manifest are in `docs/provenance/`.
- **The door:** the kit's door test (5 cases) and `pnpm boundaries --forbid` hold; core imports no extension.
- **The workflows:** the eight files lose only lines (`git diff --stat`: deletions only), and the script and its test are
  gone.

## Unproven: what never ran, and what it could hide

- **arm64.** No gate has finished the painter's goldens on arm64. `ulp.test.ts` redraws with the maths a last bit off on
  x64; it cannot show a difference in a function it does not wrap, nor V8's own JIT choices on arm64 (`Math.fround`
  paths, fused multiply-add in compiled code). `main`'s `ci.yml` unit stage was running on `af-mac-3` (an Apple machine)
  when this was written: its result is the first arm64 run. The plan's request to the Owner (task 13 step 7) stands.
- **A real GPU.** The CPU-equals-GPU byte check has only ever run on SwiftShader. On `af-mac` (Metal through ANGLE, and
  Dawn's Metal backend for WebGPU), the WGSL template copy's texel snap and `frag_depth`, and the GLSL depth bit, could
  round differently; the 3D parity job that would have shown it was stopped by `world-kit`'s timeout (N9) before the
  painter's suite ran.
- **WebKit and Firefox.** The painter's browser projects are Chromium only by design; the kit's parity projects run
  there only on the Mac runner. A difference in WebGL readback or canvas colour handling would not show here.
- **The runway recorder** (S1) and the hand-run sheet scripts (`render`, `lit`, `actors`, `c5`, `c9`, `viewer`) were not
  run.

## Readiness for what follows

- **`claude/builders-fold-strict`:** it has 56 headers to remove, not 37 (S5), and 13 are dead already; `vitest.config.ts`
  keeps its one `as Project[]` (allowed); the declarations step and `turbo.json`'s `outputs` are as task 27 expects.
- **`claude/builders-fold-scenes`:** shares no file with the fold's leftovers.
- **The beta.3 port of the view:** `@pixi/3d` is pinned in `extensions/figures/package.json` (dependency and
  `optimizeDeps`); the template guard's message names FigureBuilder (S4); the port's proof is the browser suite, which has
  not yet run on a real GPU ("Unproven", a real GPU) and has no image dump (N5).
- **New hair and face options inside `paint()`:** a new local shared between phases must be returned by its phase and
  destructured by each reader; the chain in `paint.ts` spreads about 70 names per call. Workstream 4's step texts in
  `docs/archive/figure-painter/c9-wardrobe/` use the builder's old paths (`src/features/hair/hair.ts` and so on).
- **Any painter change that moves a kit golden** needs S1 first.

## Fixes

**Stage 6**, 2026-11-12, on the same branch from `4aeafb04`, no subagents. **Progress: 5 of 16 findings answered (31%)**; the
table is updated as each fix commits. The commit column holds the short hash once the fix is committed.

| Finding | Commit | What changed | How it is proved, or why it is left |
| --- | --- | --- | --- |
| B1 | | | |
| S1 | this commit | `scripts/showcase-imports.ts` names the painter file for each of the showcase's three imports (`src/entries/index.ts`, `src/shared/body/parts.ts`, `src/shared/math/math.ts`) and throws, naming it, on a fourth; `record-runway-cells.ts` uses it. `runway-cells.json` not touched | `tests/unit/fashion/runway-recorder.test.ts` (3 cases: the three showcase lines rewritten and `existsSync` on every file named; an unknown specifier throws). It failed first (module missing). The recorder itself needs the archived clone and has no check mode, so it was not run |
| S2 | this commit | `workflowProblems` gets a sixth rule: a step with `submodules:` set to anything but false, or a `git submodule` command, is a problem; the old text pattern stays for the `vendor/…` names; a hygiene case that `.gitmodules` does not exist | `workflow-invariants.test.ts`: the new case (`submodules: recursive`, `submodules: true`, `git submodule update --init --recursive`, a wrapped `git  submodule sync`; `submodules: false` and `pnpm install` pass) failed first (`expected [] to deeply equal [...]`, the audit's probe), the file's 11 cases and the real workflows pass now |
| S3 | this commit | `pnpm source-names` now reads `extensions/figures/src` too (the root script and the test that pins it): it found 8 lines, all fixed: `pose.ts:125` drops the old repository and commit (and the game's name), `stage.ts:42,48,51`, `cell.ts:6`, `figure-build.ts:21` and `entries/index.ts:3` say what they mean without naming a source project. `nurse` is now `tiltedLoose` (`scripts/c9-sheet.ts`), `NURSE` is `TILTED` (`tests/unit/hair/standoff.test.ts`); no value moved | `source-names-wired.test.ts` failed first (the pinned script lacked the folder), then `pnpm source-names` failed with 8 findings, now 0; `grep -rni nurse` over `src`, `scripts`, `tests`, `viewer`, `docs/contract.md`, `docs/actors.md` and the README finds only the guard below. The standoff and pose tests and the goldens pass. **Left, by reason:** `viewer/main.ts:6,50`, `tests/unit/stage/pose.test.ts:80` and `docs/contract.md:49,88,109` name The Last Light as the camera the `gameplay` pose copies: a dev viewer, a test title and a contract that say whose camera it is, outside `src` and unpublished (the plan keeps the game's name there); `tests/unit/hair/fringe.test.ts:207` holds `/Ada|Nurse|Voss/`, the guard that a hair style's description names no character, so the names are the check; `docs/archive/figure-painter/c9-wardrobe/` names Ada and the Night Nurse about 40 times: the archive is a record (the framework's own archive already names both), and the Owner decides before the repository goes public (N10) |
| S4 | this commit | Every item the audit lists, against the code: the four links to missing documents (`c9-sheet.ts` now points at the archived wardrobe plan and design, `golden.ts`, `layers.test.ts` and `stand.test.ts` lose theirs: the documents are nowhere); `npm run …` to `pnpm --filter @automata/figures <script>` in 16 places; `npx vite-node` to `pnpm --filter @automata/figures exec tsx` (run: it prints `PINS`); `pins.ts`'s `npm run pins` to `scripts/c9-pins.ts`; the old name in `entries/index.ts` (fixed in S3), `stage.ts`, `template.test.ts` (two places); five more stale paths the new check found (`src/index.ts`, `src/kit.ts`, `src/view.ts` in `entries/view.ts`, `stage.ts`, `api.test.ts` twice, `viewer/main.ts`); the contract's rows for `duel`/`oklab` (`paint-style.ts`) and for `Casting` (`actor-types.ts`, found by the same check); the kit's `gate.ts` message (N10: it now says `git submodule update --init vendor/FigureBuilder` in that old tree) | New `extensions/figures/tests/unit/references.test.ts` (6 cases, in the package's own unit suite, so `pnpm check` reaches it with `AF_UNIT_FULL`): no `npm run`/`npx`/`vite-node`; every `pnpm --filter @automata/figures <x>` names a `package.json` script; every `docs/….md` cited exists; every `src/….ts` cited in a `.ts` file exists; no `.ts` file says FigureBuilder; every name in the contract's breaking-change table is defined in the file its row gives. It failed first on 16 + 4 + 5 + 2 findings and on 3 table rows, passes now. `pnpm style --docs` (the repo's Markdown link checker) already read the package's Markdown: 0 findings before and after. Left: `docs/contract.md`'s changelog (lines 211, 214) names `src/index.ts` and `src/kit.ts` as they were when each version came, a record |
| S5 | this commit | The 13 dead `biome-ignore-all` headers removed (`actor-cast.ts`, `actor-types.ts`, `garments-types.ts`, `garments-parts.ts`, `garments-registry.ts`, `paint-stamp.ts`, `paint.ts`, `paint-face.ts`, `motion-types.ts`, `motion.ts`, `view-check.test.ts`, `view-claims.ts`, `viewer/main.ts`); the plan: task 1 steps 1 to 3 and task 13 step 7 ticked (7 says who opened #661 and that its gate was red), the tracking line 16 of 28 (57%), the group 1b note says 56 carried the header, 173 `!` in 43 files, 13 for nothing, 43 now, and tasks 22 to 27 each list the files whose header they remove (task 21: none), task 4d's "all `wave`" is wave, swing, punch, two stands and script (18 keys); `progress.md` says merged as #661 with the gate red, and 43 files | The headers: with all 56 stripped in a working copy, `biome lint --only=style/noNonNullAssertion` reports 173 warnings in 43 files, the other 13 are exactly the audit's list; `pnpm exec biome check` on the 13 passes; the other 43 files keep theirs (`grep -rl` finds 43). The plan's per-task lists are generated from the 43 headers' own task numbers. The 4d key names are the audit's measurement against FigureBuilder at `23f889c8` (the archived repository was not read again; the filtered history here does not hold that commit) |
| N1 | | | |
| N2 | | | |
| N3 | | | |
| N4 | | | |
| N5 | | | |
| N6 | | | |
| N7 | | | |
| N8 | | | |
| N9 | | | |
| N10 | | | |
