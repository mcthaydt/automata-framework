# The builders fold, group 2: implementation audit

**Date:** 2026-11-12. **Stage:** 5 (implementation audit) of workstream 6, group 2. **Branch:**
`claude/builders-fold-scenes`, audited at its head `7a344452` (`origin/main` `d401ec4d` merged by `74797869`).
**Audited:** `git diff origin/main...7a344452` (11 files, +530 / −40; seven commits and the merge), against
[the spec](../specs/2026-11-12-builders-into-the-framework-design.md) and its two amendments, [the plan](../plans/2026-11-12-builders-fold.md)
(tasks 15 to 19; task 20 does not run, the Owner ruled "A"), [the EnvironmentBuilder survey](2026-11-12-builders-fold-survey/environment-builder.md),
[the plan audit](2026-11-12-builders-fold-plan-audit.md), [group 1's audit](2026-11-12-builders-fold-implementation-audit.md)
as the model, `AGENTS.md` and the code. EnvironmentBuilder (archived) was attached read only and cloned outside the
repository (`f7c5356` and `6d82a52` fetched by depth; its tip `1eb60f9`); nothing was pushed there. Every probe below
that changed a file was reverted at once (`git status` clean after each). No subagents.

## Verdict

1. **The substance holds.** The tiles cross-check really runs the kit's own photo pipeline (`photoToTile` in
   `src/features/textures/tile.ts`) on the kit's own photos (all 38 PNGs byte-equal to the source's at `f7c5356`) and
   gives all 112 md5s; a changed photo, a changed swatch knob and a changed pipeline constant each fail, naming their
   keys. The bedroom's `reads` is the only content hunk since `6d82a52` to port, re-derived here from the source's
   history. The manifest is exactly `git ls-tree -r --name-only f7c5356` (282 files); every row's framework file exists;
   all 22 corrected rows and 20 of the 68 added were checked against their counterparts. Option A is honoured: nothing of
   the CPU scene renderer or its `base`/`scenes` goldens came. No golden, md5 or hash moved. The whole uncached
   `pnpm check` passes.
2. **No blocker.** **Three should-fix:** the tiles fixture is not the source's file byte for byte, though four records
   say it is (S1); the photo document's two commands crash under the repository's Node (S2, a cause on `main` the
   document now leads readers into); the provenance section's "Pull again" names a command that only checks (S3).
   **Six notes.** 9 findings in all.
3. **Ready to be named for merge once S1 to S3 are fixed** (they are small: see Fixes).

## Findings

### S1, should fix: the tiles fixture is not the source's file, though the records say it is

**Evidence.** `git -C $EB show f7c5356:tests/golden/tiles.json | cmp - extensions/world-kit/tests/fixtures/builder-tiles.json`:
`differ: char 4, line 2`. The source's file is 6,138 bytes, indented one space; the fixture is 6,250 bytes, indented two
(Biome's format: the commit hook runs `biome check` on staged JSON, and `biome.json` excludes only the painter's goldens,
`extensions/figures/tests/fixtures/golden/*.json`). sha-256: source `10add88b…7517f7`, fixture `dceddb54…6419ad`. As parsed
JSON they are equal: the same 112 keys in the same order and the same md5s (checked with `node`). The records say
otherwise: the plan's table and log for task 15 ("`cmp`-equal", "fixture restored `cmp`-equal"), `progress.md`
("a fixture (`cmp`-equal)"), the provenance row for `tests/golden/tiles.json` ("ported: the file unchanged") and the
test's own first comment ("unchanged"). The plan's step 1 said "byte for byte"; the spec's rule 4 asks for the source
commit and a checksum where a file is not carried with its history, and this is the one file of the source that came
across as a file.

**Fix.** Restore the source's bytes and exclude the file from Biome beside the painter's goldens, so the hook leaves it;
pin it with a test (the fixture's sha-256 equals the source file's), seen failing first on the reformatted file.

### S2, should fix: the photo document's commands crash under the repository's Node

**Evidence.** `extensions/world-kit/docs/photos.md:89-90` gives `pnpm --filter @automata/world-kit textures` and
`textures:check` as the way to make and check tiles. Under Node 24.21.0 (the `engines` floor) both exit 1 before doing
anything:

```
packages/sim/src/shared/world/snapshot.ts:135
  constructor(private readonly bytes: Uint8Array) {
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not supported in strip-only mode
```

The chain, traced with a resolve hook: `textures-cli.ts` ← `textures-command.ts` ← `photos.ts` ← `pipeline.ts` ←
`@automata/3d/props-kit` ← `packages/3d/src/features/world/build.ts` (`createRng`) ← `@automata/sim` ← `snapshot.ts`
(and `features/replay/codec.ts:90`, the same form). The cause is on `main`, not this branch: `551a11f2` fixed the same
thing in `@automata/content` and wrote "sim's own root entry still has parameter properties in `replay` and `snapshot`;
content does not reach them". The kit's CLI does reach them, and no test runs the CLI as a process
(`textures-command.test.ts` calls `runTextures` inside Vitest, which transpiles). Task 17's evidence ran `style`,
`source-names` and `check`, not the commands it documents. Probe: with the two parameter properties written as fields
(reverted after), `textures:check` exits 0 and prints the reads lines. The README's
`pnpm exec automata-world-textures --check` also fails inside the workspace (N4).

**Fix.** The two parameter properties as declared fields (no behaviour change: the precedent is `551a11f2`), with a
`patch` changeset for `@automata/sim`, and a kit test that runs the CLI with a real `node`, seen failing first.

### S3, should fix: "Pull again" names a command that does not write the manifest

**Evidence.** `docs/provenance/sources.md`, "The environment source": "add a row for every new file, run
`pnpm sources-md`, and record the new commit here and in the manifest". `tooling/repo-hygiene/src/sources-md-cli.ts`
only reads both files and reports (`checkSources`); nothing writes `builders-manifest.json`. Task 18's own note says so
and that the manifest was written by a script; the section a later puller reads still does not say how.

**Fix.** Say it: write `environment.commit` and `environment.files` from `git -C <clone> ls-tree -r --name-only <commit>`
(the command that reproduces both the old 214 and the new 282, measured), then `pnpm sources-md --complete`.

### Notes

- **N1. Six rows give a reason that is not true yet.** The `docs/reference/the-last-light/source/…` rows say "the
  reference game is in the framework itself (`games/`)"; `games/` holds `base-3d` and `emberwick`. The Last Light is
  being remade in the framework (workstream 2), not there today. Fix: say that.
- **N2. The restated test lost three guards and the key order.** The source's `tiles.test.ts` also held that every
  photo a swatch names has a swatch frame, that no two photos share a swatch frame, and that the frames two photos share
  are flat at wear 0 and are exactly six (`ceilingPaint`, `concrete`, `plaster`, `scallopPlaster`, `stucco` in tone,
  `stucco` in swatch); and it compared the keys in order, where the framework sorts them. The plan asked for the md5
  assertion only, and with a fixed fixture the guards hold while every md5 does; they guarded a re-record, which the
  plan forbids. Cheap to keep: restate the flat-share guard and drop the sort.
- **N3. Task 17's record names other commands than the document.** The plan's row says the document uses
  "`automata-world-textures`, `--check`"; it uses the package scripts. Correct the row when S2 is fixed.
- **N4. The README's command does not resolve inside the workspace.** `pnpm exec automata-world-textures --check` in
  `extensions/world-kit` prints `Command "automata-world-textures" not found` (a package's own bin is not linked into
  it). On `main` before this branch, and right for a game that depends on the kit; left, with the document's package
  scripts as the in-repository form.
- **N5. `convert.test.ts:1` is a 170-character comment line** (the formatter's width is 110 and Biome does not wrap
  comments). Wrap it.
- **N6. The kit's `maps` script regenerates the whole `library/maps/` folder**, which task 16 says never to do. Today it
  is harmless: the converter's output equals all five library files as parsed JSON (measured), differing only in Biome's
  array layout. On `main` before this branch; left.

## Verified and sound

- **Task 15.** `builder-tiles.test.ts` 113 tests pass (7.3 s). It calls `photoToTile` (`tile.ts`: `decodePng`, `flatten`,
  `facet`, `resample`, `indexTone`/`indexPhoto`, `wear`, `clean`), on `photoBytes` of the kit's `assets/photos/`, with the
  source's knobs (`wear` 0.3, `seed` 1, `texels` [32, 32]) and the source's swatch rule over the kit's
  `library/swatches.json`; no output is copied in. Probes, each reverted: one byte of `brick.png`'s pixels changed:
  `brick/tone`, `brick/photo`, `brick/swatch` fail by name, 110 pass; `baseFacade`'s `contrast` 0.011 → 0.02:
  `concrete/swatch` alone fails; the wear seed's `+ 7` → `+ 8` in `tile.ts`: 107 fail. The 38 PNGs equal the source's
  at `f7c5356` (md5 each); `photos.json` 38 entries, each with `file`, `size`, `source`, `licence` (`CC0`), `credit`.
  The one-case-per-key split loses no md5 and names each failing key (the source's single test listed them); see N2.
- **Task 16, re-derived.** `git diff --name-status 6d82a52 f7c5356`: 113 files (68 added, 45 modified). The content
  files among them: `world/library/maps.json` (only the bedroom's `"reads": {}`), `paint/library/look.json`
  (`figureLight`: not wanted, the framework has no `figureLight` anywhere and `SPRITE_STYLE` is still 0.22 / 0.5),
  `tests/golden/base.json` and `scenes.json` (option A), `package.json`, `package-lock.json`, `.claude/settings.json`;
  no PNG and no other library file. The test hunks (`map.test.ts`'s prop grime, `readability.test.ts`'s exposure and
  "no base scene waives the hot rule") follow code the survey marks not wanted, or the `hot` waiver the plan lists as
  following work. The fixture equals `maps.json` at `f7c5356` as parsed JSON; the converter's output equals all five
  library maps as parsed JSON; the new case is in `convert.test.ts`.
- **Task 17.** Every path, test name, default (`TEXTURE_DEFAULTS`), threshold (`READS`, `SPOT_*`, `PATCH_*`), problem
  code (`stale-tile`, `swatch-reads`), exit code (0, 1, 2), example swatch (`brickRed`, `oakFloor`, as written), count
  (38 photos, at most 256 px a side, 62 tiles) and function (`tileStructure`, `checkReads(level, library, photos)`) it
  names exists and is as it says; the kit has no photo importer (`src/app` holds the textures CLI, the library, the
  dressed base scenes and the extension; `scripts/` only the map converter), and the document says so. No source
  project is named. The commands: S2.
- **Task 18.** The manifest's `environment` is `f7c5356…` with exactly the 282 paths of `ls-tree` (sorted diff
  empty); `main`'s 214 equal `ls-tree` at `6d82a52`. The diff adds 68 rows and changes 22; every backticked framework
  path in the 90 rows exists. Checked against their counterparts: all 22 corrected (glyphs: the same top-level key
  `font`; kits: the eight, by name; props: the six the kit lacks are core's base props and prims, named in
  `base-library.ts`; swatches: all 167 in the kit, textures equal, three more; the dresser's, generator's and lettering's
  kit files export the functions the rows name) and 20 added (the GPU harness's `9c2df06` is the source's commit that
  ended it; `packages/3d/tests/browser/parity/` exists; `expose.ts` → `room-light.ts` has `Exposure`, `scene-light.ts`
  exists; `lit-rooms.ts` is the tune-light search; the vendored tarball and its licence; the worker pool; N1).
  `pnpm source-names` exit 0 (inside the gate). `pnpm sources-md` only checks: S3.
- **Task 19.** `origin/main` is merged (`git merge-base --is-ancestor origin/main HEAD`; the two-dot diff against `main`
  is the same 11 files). Run here (Node 24.21.0, Linux x64): **the whole `pnpm check` uncached**
  (`git fetch origin main` first, `TURBO_FORCE=true`): exit 0, 66 tasks, 803 s, `check-changesets` 0 problems;
  `pnpm build` exit 0 (16 tasks); `pnpm api-report` 0 breaks, 0 undeclared; `pnpm api-index` 0 undocumented (check
  mode, writes only to `dist`); `pnpm secrets` no leaks (after `git fetch --unshallow`, 3,775 commits); the world kit's
  unit suite 22 files, 376 tests; its Chromium project (`--browser.name=chromium`, `AF_WEBGPU=software`) 5 files, 30
  tests; `git status` clean after each. The plain `pnpm test:browser` in the kit fails at once here: its project also
  names Firefox and WebKit, which are not installed.
- **No golden, md5 or hash moved.** The branch changes 11 files: four documents, the README link, `photos.md`, the
  bedroom's level, two fixtures and two tests. No file under any `golden`, `__goldens__`, parity or snapshot folder, and
  no recorded md5 or hash file.
- **Option A.** No renderer file came (`cpu-frame`, `fp`, `render`, `view-frame`, `features/gpu`); the source's
  `base.json` and `scenes.json` are rows "left out" quoting the Owner's "A"; the plan's task 20 is marked as not run.
- **The spec, for this group.** Rule 1: the kits' goldens and the painter's do not move; `tiles` comes and passes
  unmoved in its new home (its md5s; its file's bytes: S1); `base` and `scenes` do not come, by the Owner's "A" (the
  second amendment). Rule 2: tests in `tests/unit/…` importing `#src/…`, the fixture by a relative path as the kit's
  other fixtures are; kebab-case; no file over 600 lines; comments say why and name no plan. Rule 3: nothing of the
  source's brand or game content came (the reference copies are rows "left out"). Rule 4: the source commit and every
  file are recorded; the one file carried across is not byte-equal (S1). Rule 5: the photos keep their records. Rules 6
  and 7: not touched. "Done means": a fresh clone's check is group 1's (this branch adds no dependency); the kits draw
  what they drew (their suites pass, no recorded frame changed); `progress.md` records what moved and what did not; both
  repositories carry their retirement notes (EnvironmentBuilder's `README.md` at `1eb60f9`, merged from `6983342`).
- **Records.** The plan's table: tasks 1 to 13 (13), 4b to 4d (3) and 15 to 19 (5) done = 21; the 28 are those 21 and
  the strict branch's 21 to 27 (7); task 20 is conditional and not counted; 21 / 28 = 75%. `progress.md` row 6 says the
  same. The ledger row 13 and the "Following work" list are present and match the plan's lines (one line added, the
  source's look kept only in the archive).

## Unproven

Not run here: WebKit and Firefox (not installed), WebGPU on a real GPU, the source's own `test:gpu` and `check`, a
fresh clone's `pnpm check` for this branch. The archived state of the two repositories is the Owner's word; the clone
read `main` and saw the retirement note. FigureBuilder's retirement commit was not re-read here (group 1's audit).

## Fixes

Stage 6 follows on this branch, one commit a finding; this section is filled in as each commits.
