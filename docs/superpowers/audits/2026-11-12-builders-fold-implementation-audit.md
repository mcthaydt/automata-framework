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

**Stage 6**, 2026-11-12, on the same branch from `4aeafb04`, no subagents. **Progress: 16 of 16 findings answered (100%)**; the runs are listed below the table; the
table is updated as each fix commits. The commit column holds the short hash of the fix.

| Finding | Commit | What changed | How it is proved, or why it is left |
| --- | --- | --- | --- |
| B1 | `0fe17264a` (#662, merged as `4afc2a158`), not mine | #662 (`4afc2a15` on `main`) added `/vendor/FigureBuilder/` and `/vendor/figure-builder/` to `.gitignore` and the `.gitleaks.toml` allowlist for the two hash files. This branch has `main` merged, so it holds them | Checked here on a scratch tree: a `vendor/FigureBuilder/probe.ts` with an unsorted import and a `!` is reported by `biome check` without the lines and `biome check .` passes (0 errors) with them; the probe was removed again. The `ar3` runner's re-run was not looked at (the Owner's runner) |
| S1 | `cc285d807` | `scripts/showcase-imports.ts` names the painter file for each of the showcase's three imports (`src/entries/index.ts`, `src/shared/body/parts.ts`, `src/shared/math/math.ts`) and throws, naming it, on a fourth; `record-runway-cells.ts` uses it. `runway-cells.json` not touched | `tests/unit/fashion/runway-recorder.test.ts` (3 cases: the three showcase lines rewritten and `existsSync` on every file named; an unknown specifier throws). It failed first (module missing). The recorder itself needs the archived clone and has no check mode, so it was not run |
| S2 | `9e9e08c5f` | `workflowProblems` gets a sixth rule: a step with `submodules:` set to anything but false, or a `git submodule` command, is a problem; the old text pattern stays for the `vendor/…` names; a hygiene case that `.gitmodules` does not exist | `workflow-invariants.test.ts`: the new case (`submodules: recursive`, `submodules: true`, `git submodule update --init --recursive`, a wrapped `git  submodule sync`; `submodules: false` and `pnpm install` pass) failed first (`expected [] to deeply equal [...]`, the audit's probe), the file's 11 cases and the real workflows pass now |
| S3 | `81fc0a05b` | `pnpm source-names` now reads `extensions/figures/src` too (the root script and the test that pins it): it found 8 lines, all fixed: `pose.ts:125` drops the old repository and commit (and the game's name), `stage.ts:42,48,51`, `cell.ts:6`, `figure-build.ts:21` and `entries/index.ts:3` say what they mean without naming a source project. `nurse` is now `tiltedLoose` (`scripts/c9-sheet.ts`), `NURSE` is `TILTED` (`tests/unit/hair/standoff.test.ts`); no value moved | `source-names-wired.test.ts` failed first (the pinned script lacked the folder), then `pnpm source-names` failed with 8 findings, now 0; `grep -rni nurse` over `src`, `scripts`, `tests`, `viewer`, `docs/contract.md`, `docs/actors.md` and the README finds only the guard below. The standoff and pose tests and the goldens pass. **Left, by reason:** `viewer/main.ts:6,50`, `tests/unit/stage/pose.test.ts:80` and `docs/contract.md:49,88,109` name The Last Light as the camera the `gameplay` pose copies: a dev viewer, a test title and a contract that say whose camera it is, outside `src` and unpublished (the plan keeps the game's name there); `tests/unit/hair/fringe.test.ts:207` holds `/Ada|Nurse|Voss/`, the guard that a hair style's description names no character, so the names are the check; `docs/archive/figure-painter/c9-wardrobe/` names Ada and the Night Nurse about 40 times: the archive is a record (the framework's own archive already names both), and the Owner decides before the repository goes public (N10) |
| S4 | `6461a5413` | Every item the audit lists, against the code: the four links to missing documents (`c9-sheet.ts` now points at the archived wardrobe plan and design, `golden.ts`, `layers.test.ts` and `stand.test.ts` lose theirs: the documents are nowhere); `npm run …` to `pnpm --filter @automata/figures <script>` in 16 places; `npx vite-node` to `pnpm --filter @automata/figures exec tsx` (run: it prints `PINS`); `pins.ts`'s `npm run pins` to `scripts/c9-pins.ts`; the old name in `entries/index.ts` (fixed in S3), `stage.ts`, `template.test.ts` (two places); five more stale paths the new check found (`src/index.ts`, `src/kit.ts`, `src/view.ts` in `entries/view.ts`, `stage.ts`, `api.test.ts` twice, `viewer/main.ts`); the contract's rows for `duel`/`oklab` (`paint-style.ts`) and for `Casting` (`actor-types.ts`, found by the same check); the kit's `gate.ts` message (N10: it now says `git submodule update --init vendor/FigureBuilder` in that old tree) | New `extensions/figures/tests/unit/references.test.ts` (6 cases, in the package's own unit suite, so `pnpm check` reaches it with `AF_UNIT_FULL`): no `npm run`/`npx`/`vite-node`; every `pnpm --filter @automata/figures <x>` names a `package.json` script; every `docs/….md` cited exists; every `src/….ts` cited in a `.ts` file exists; no `.ts` file says FigureBuilder; every name in the contract's breaking-change table is defined in the file its row gives. It failed first on 16 + 4 + 5 + 2 findings and on 3 table rows, passes now. `pnpm style --docs` (the repo's Markdown link checker) already read the package's Markdown: 0 findings before and after. Left: `docs/contract.md`'s changelog (lines 211, 214) names `src/index.ts` and `src/kit.ts` as they were when each version came, a record |
| S5 | `60435fcf2` | The 13 dead `biome-ignore-all` headers removed (`actor-cast.ts`, `actor-types.ts`, `garments-types.ts`, `garments-parts.ts`, `garments-registry.ts`, `paint-stamp.ts`, `paint.ts`, `paint-face.ts`, `motion-types.ts`, `motion.ts`, `view-check.test.ts`, `view-claims.ts`, `viewer/main.ts`); the plan: task 1 steps 1 to 3 and task 13 step 7 ticked (7 says who opened #661 and that its gate was red), the tracking line 16 of 28 (57%), the group 1b note says 56 carried the header, 173 `!` in 43 files, 13 for nothing, 43 now, and tasks 22 to 27 each list the files whose header they remove (task 21: none), task 4d's "all `wave`" is wave, swing, punch, two stands and script (18 keys); `progress.md` says merged as #661 with the gate red, and 43 files | The headers: with all 56 stripped in a working copy, `biome lint --only=style/noNonNullAssertion` reports 173 warnings in 43 files, the other 13 are exactly the audit's list; `pnpm exec biome check` on the 13 passes; the other 43 files keep theirs (`grep -rl` finds 43). The plan's per-task lists are generated from the 43 headers' own task numbers. The 4d key names are the audit's measurement against FigureBuilder at `23f889c8` (the archived repository was not read again; the filtered history here does not hold that commit) |
| N1 | `14e7c3ee3` | The 43 headers now say why ("until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check") and no longer name a task or the plan; `tsconfig.json`'s and the README's sentences lose the plan too (the plan, which lists the files per task, says so). The detector learns the form | `tooling/check-style/tests/unit/plan-comments.test.ts`: 3 flagged cases (`task 27 of the builders-fold plan`, `tasks 21 to 27 of the fold plan`, `the builders-fold plan's ledger`) failed first; 2 near-misses pass (`Task 27 of 30`, `The ledger of the plan`); the check-style suite 143 pass; `pnpm style` 0 findings. The same run found that S1's new test spelled `../../src` strings that `pnpm style` (not part of the commit hook) read as imports: spelled in parts here (`UP`) |
| N2 | none | Left: the audit found the pair of checks sound (`layers.test.ts` for relative specifiers, `pnpm boundaries --features` for a `#src/…` import in `src/`) | Nothing to change |
| N3 | `ef28a5163` | Left where it is, and now named: the kinds' types live in `features/fashion/garments.ts` and `shared/` (the door) may not import `features/`, so the `declare module '@automata/figures'` stays beside them. The door test has a case that this is the only such augmentation | `tests/unit/shared/door.test.ts`: a case that the files holding a `declare module '@automata/figures…'` are exactly `src/features/fashion/garments.ts` (the door's import check cannot see an augmentation); 6 pass. `--confine` (N4) reads imports, so it does not see an augmentation either, and the kit's own door test is where that is pinned |
| N4 | `235011bdb` | `automata-check-boundaries --confine <package>:<folder> <root>...` (`packages/tools/src/features/boundaries/confine.ts`, rule `confined-import`, the `--forbid` reader with the folder exempt); `pnpm boundaries` runs it as `--confine @automata/figures:extensions/character-kit/src/shared/figures packages extensions games examples tooling`; the verify skill's rule table has the row; a patch changeset for `@automata/tools` (a published package) | `confine.test.ts` (4 cases: the door and its subpaths pass; any other source and test fail naming the specifier and the door; `door-2` is not the door; a lookalike package is not the package) and two CLI cases in `cli.test.ts` (exit 0 / 1 / 2) failed first (missing module, exit 1 for a flag it did not know). Run on the real tree: 4,795 files, 0 findings; with a probe `games/emberwick/src/probe/p.ts` importing `@automata/figures` (removed again): `confined-import … which only extensions/character-kit/src/shared/figures may use`, exit 1 |
| N5 | none | Left, with the reason: the suite covers every case the deleted script did (227 by name). A `debug` dump of the CPU and GPU frames and their difference belongs to the beta.3 port of the view (`claude/pixi-3d-beta-3`), which owns `features/view/` and its tests and is live; adding it here would collide with that branch for a diagnostic nobody needs until a real GPU disagrees. It is on the port's list | Not run |
| N6 | none | Left, with the reason: `pnpm test:browser:3d` skips the painter's 105 WebGPU cases off a GPU, in words, by design; the gate counts on the Mac GPU runner. That runner has now run it: the 3D parity job of run `43256485494` (`main` at `4afc2a15`, after #662) **passed** on `af-mac` (`pnpm test:browser:3d`, 12 min 41 s, all steps success), so the painter's browser suite ran on a real GPU there. Changing `turbo.json` would not make a GPU appear | Read from the Actions API (jobs and conclusions only; the job log was not read) |
| N7 | `141379097` | One copy: `tooling/vitest-preset/src/ulp.ts` (`step`, `nudged`; exported as `@automata/vitest-preset/ulp`, a devDependency both packages already have); the painter's and the kit's `fixtures/ulp.ts` are deleted and their three tests import it. The kit's copy was kept (it compiles under the strict flags the painter's does not have yet, and the old reason, "the door hands over the builder's src", is gone) | `tooling/vitest-preset/tests/unit/ulp.test.ts` (3 cases: `step` up and down for both signs, `nudged` moves results by a last bit only and restores `Math`, also when the run throws; seed 0 nudges nothing) failed first (module missing). The painter's `hair/ulp.test.ts` (goldens project, 5 pass) and the kit's `fashion/ulp.test.ts` (1 pass), both typechecks, the preset's 19 tests |
| N8 | `ffe780356` | The nine helpers leave `tests/unit/` for `tests/fixtures/`: `body-ends.ts`, `wardrobe.ts`, `fabrics.ts`, `stage.ts`, and `frames/{actors,base,lit,sprite,sprites}.ts` (the golden recorders' frames; `tests/fixtures/golden/` keeps the recorded data). `git mv`, the importers (25 test and script files) and the comments that named the old paths follow; `wardrobe.ts`'s `declare module` now names `#src/…` | `references.test.ts` gained a case (every `tests/…` or `scripts/…` file a comment or doc cites exists): it passed before the move and failed on exactly the 8 stale cites after it, and passes now. `tsc -p .`, `pnpm style`, `pnpm style --docs` pass; the painter's whole unit suite (`AF_UNIT_FULL=1`) 54 files, 730 tests (723 + the 7 of `references.test.ts`), no golden or md5 moved |
| N9 | for the coordinator, not fixed here | Recorded, not mine to fix. **The runs:** `3d.yml` on `main` at `4a505e86` (the merge of #661): run `43245415214`, concluded `failure` (parity died on `@automata/world-kit`'s `ward.test.ts` timeout and turbo stopped the painter's and the kit's suites; the audit's reading). `3d.yml` on `main` at `4afc2a15` (the merge of #662): run `43256485494`, concluded `failure` on one step only: its parity job (`af-mac`) **passed**, its journeys job passed `test:journeys:3d`, base-3d `test:e2e` and examples-3d `test:e2e` and failed at `pnpm --filter @af-examples/3d-story test:e2e` after 11 s (job `131315989249`, runner `owner-pc-wsl-af-3`). So the `ward.test` timeout did not repeat on the second run, and the 3D-story e2e is red on `main` with the painter's suite behind a green parity job. `main` was red before the fold (`924a26ef`: run `43192999533`, `failure`) | Read from the Actions API; the logs of the failing steps were not read |
| N10 | `81fc0a05b`, `6461a5413` | Fixed in `src` (S3) and in the kit's `gate.ts` message (S4: it now says `git submodule update --init vendor/FigureBuilder` in that old tree). Left, by choice and with each place listed under S3: the game's name in `viewer/main.ts`, `pose.test.ts`, `docs/contract.md`; the name guard in `fringe.test.ts`; Ada and the Night Nurse in the archived wardrobe documents. Whether they go before the repository is public is the Owner's | See S3's row |

**The fixes' diff** (`git diff 4aeafb04..HEAD`, `origin/main` merged at `4afc2a158`): the painter's source files touched are only comments and 13 deleted header lines, no value and no code (`src/entries/{index,view}.ts`, `src/shared/figure/{frames,figure-build}.ts`, `src/shared/stage/{stage,pose,cell}.ts`, the line-1 headers of `src/shared/{actors,motion,outfit,paint}/…` and 43 reworded ones); `tests/` and `scripts/` of the painter (nine helpers moved, `references.test.ts` new, imports), the kit (`scripts/showcase-imports.ts`, `gate.ts`, three tests), `packages/tools` (`--confine`, with a changeset), `tooling/repo-hygiene`, `tooling/check-style`, `tooling/vitest-preset` (`ulp`), the root `package.json` (`source-names` and `boundaries`), the verify skill's rule table, this audit, the plan and `progress.md`. No golden, recorded cell, md5 or hash was touched: `git diff 4aeafb04..HEAD --name-only | grep -E '\.(json|gz|png)$'` prints only `package.json`, `tooling/vitest-preset/package.json` and `extensions/figures/tsconfig.json`, none of the recorded files (the frame recorders under `tests/fixtures/frames/` are code).

**Runs for this stage** (Node 24.21.0, Linux x64, Chromium only, software GL; `AF_WEBGPU=software`): `pnpm knip`, `pnpm style` (three runs, 0 findings), `pnpm lint`, `pnpm boundaries` (0 findings, the `--confine` run among them), `pnpm source-names` exit 0; `pnpm secrets`: no leaks in the full history (3,753 commits, after `git fetch --unshallow`); the painter's whole unit suite (`AF_UNIT_FULL=1`) 54 files, 730 tests, 240 s (the tree after the moves; no painter file changed after it but docs); the painter's browser suite (`test:browser`) 2 files, 227 pass; the kit's `browser (chromium)` and `webgpu` projects 58 pass, 3 skipped by design; the kit's unit 29 files, 232 pass (the commit hook ran it, `goldens` and the rest, on every commit that touched the kit or the painter). The whole `pnpm check` uncached (`TURBO_FORCE=true`) on the final tree (`fee33f68d`, `origin/main` at `4afc2a158` merged): **exit 0**, 56 of 56 tasks, 13 min 54 s, `check-changesets: 78 changesets, 0 problems`. **Not run:** WebKit, Firefox, a real GPU, arm64; `goldens:runway` (needs the archived clone, and no recorded cell may move); the painter's hand-run sheet scripts (`render`, `lit`, `actors`, `c5`, `c9`, `viewer`).
