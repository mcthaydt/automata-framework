# EnvironmentBuilder, surveyed for the fold

Workstream 6, stage 2. The spec is
[`2026-11-12-builders-into-the-framework-design.md`](../../specs/2026-11-12-builders-into-the-framework-design.md); the
plan is [`2026-11-12-builders-fold.md`](../../plans/2026-11-12-builders-fold.md); the first survey is
[`figure-builder.md`](figure-builder.md).

## What was read and run

- `mcthaydt/EnvironmentBuilder` at `f7c535694fd7a53a8f94129b9e13b9ab3503a095` (its `main`), a full clone, read only.
  Nothing was committed or pushed there.
- The framework at `main` `0df11a43`: `packages/3d`, `extensions/world-kit`, `extensions/character-kit`,
  `docs/provenance/sources.md` and `docs/provenance/builders-manifest.json`.
- "Already ported" below means: `docs/provenance/sources.md` has a row for the builder's file, and the framework file
  that row names exists at `0df11a43`. A script read all 209 files of the builder's `src/`, `base/`, `scripts/` and
  `tests/` against the provenance table and checked every named framework file with `existsSync`: **0 named files are
  missing.** The rows were written at the builder's `6d82a52` (2026-11-06); what changed after that is its own section.
- Run on the session's machine (x86_64, 4 cores):
  - `npm ci`, its submodule at its own pin, `npx vitest run`: **55 files, 578 tests pass, 3 todo, 130 s**.
  - `npx vitest run tests/golden` (the three goldens alone): **pass, 33 s**.
  - The same suite with its FigureBuilder submodule moved from its pin to the framework's pin: **27 tests fail** (below).
  - A byte comparison of its 38 photos and a key comparison of its libraries with the world kit's.
- **Not run:** `npm run test:gpu`, `npm run check`, `gpu:diff`, `gpu:parity` (they need Chromium on SwiftShader or a
  real GPU, and no number in the plan depends on them); any render, board or tune script.

## What is in the repository

321 tracked files, 13.8 MB in the working tree; 250 commits on `main` (196 without merges; none of the subjects is a
Conventional Commit); the whole clone packs to 13.32 MiB.

| Folder | Files | What |
|---|---|---|
| `src/` | 116 | 69 `.ts` (9,104 lines), 8 library `.json` (3,143 lines), 38 photo `.png`, one `.html` |
| `base/` | 1 | `base.ts`, 80 lines: the four base scenes |
| `scripts/` | 19 | 1,236 lines: `render`, `map`, `board`, `lit`, `textures`, `tune`, `tune-light`, `check`, `photos`, `golden`, `gpu-diff`, `gpu-parity`, `gpu-view` and what they share |
| `tests/` | 70 | 67 `.ts` (4,627 lines), 3 golden `.json` (7.4 kB) |
| `docs/` | 62 | 45 `.md`, 4 `.png` (frames of the reference game), copies of 15 of that game's source files |
| `vendor/` | 3 | the FigureBuilder submodule (a gitlink), the `@pixi/3d` beta.2 tarball and its licence |
| root | 9 | `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.gpu.config.ts`, `CLAUDE.md`, `README.md`, `.gitmodules`, `.gitignore`, and `.claude/`, `.vscode/` settings |

No source file is over 600 lines (the longest is `world/props.ts`, 508). 42 PNGs in all: 38 photos (5.4 MB with the
four reference frames).

## The finding that shapes the plan: its goldens are tied to an older painter

EnvironmentBuilder's submodule pins FigureBuilder at **`50235f4`** (2026-11-05). The framework pins it at `23f889c8`,
159 commits later. Everything the builder draws goes through FigureBuilder's rasteriser and palette
(`src/lib/figure.ts`), and its scenes hold FigureBuilder's figures.

Measured: with its submodule at `23f889c8`, `npx tsc --noEmit` reports 0 errors, and `npx vitest run` fails 27 tests
in 4 files:

| File | Failed | What moved |
|---|---|---|
| `tests/golden/base.test.ts` | 8 of 8 frames | every base scene, diorama and first person |
| `tests/golden/scenes.test.ts` | 14 of 14 frames | every base map, diorama and first person |
| `tests/base/readability.test.ts` | 3 of 26 | how the figures read against their rooms |
| `tests/scripts/lit-rooms.test.ts` | 2 of 5 | the figures' edge reads at a lamp level |
| `tests/golden/tiles.test.ts` | 0 | the photo tiles do not touch the painter's changes |

So once both builders live in one repository on one painter, **two of the three goldens cannot pass unmoved**, whatever
the plan does: they record the CPU scene renderer drawing with the painter of 2026-11-05. The spec's rule 1 cannot hold
for them as written. The question went to the coordinator for the Owner (the plan, "Questions for the Owner", 1); the
plan's default is that the CPU scene renderer and those two goldens do not come.

## Each feature against the framework

"Home" follows the standing rule: core only if any game could use it and it imports no extension; an extension if
generic within a genre; otherwise not in the framework.

### The photo pipeline and its library

| Builder | Lines | Status | Framework file checked |
|---|---|---|---|
| `photo/pipeline.ts` (flatten, facet, resample, index, wear, clean) | 214 | **already ported** (rewritten, stages as written) | `extensions/world-kit/src/features/textures/pipeline.ts`, `tile.ts`, `texture-spec.ts` |
| `photo/textures.ts` (tiles) | 129 | **already ported** (tiles are committed files) | `extensions/world-kit/src/features/textures/photos.ts`, `swatch-tiles.ts`, `swatch-issues.ts`, `textures-command.ts`; 62 files in `extensions/world-kit/library/tiles/` |
| `photo/structure.ts` (the `reads` checks: blotch, flat, span, spots, patches) | 179 | **already ported** | `extensions/world-kit/src/features/textures/structure.ts`, `check-reads.ts` |
| `photo/library/photos.json` | 40 | **already ported** | `extensions/world-kit/assets/photos/photos.json`: the same data (compared as parsed JSON) |
| `photo/library/photos/*.png` | 38 files | **already ported** | `extensions/world-kit/assets/photos/`: **38 of 38 byte-identical** (`cmp`) |
| `lib/png.ts` | 43 | **already ported** (the decoder; the encoder served the CPU renderer) | `extensions/world-kit/src/features/textures/png.ts` |
| `paint/colour.ts` (OKLab, the DUEL index, the hash) | 36 | **already ported** | `extensions/world-kit/src/features/textures/colour.ts` |

**Licences.** All 38 photos are `CC0`, from Poly Haven; each entry of `photos.json` has `file`, `size`, `source`,
`licence` and `credit`, and the kit's copy carries the same five fields. The kit's
`tests/unit/textures/swatch-tiles.test.ts` already fails when a photo lacks its source, licence or credit, or when a
tile's recorded photo hash is stale. `docs/provenance/sources.md` has a row per photo. **Nothing to move; the record is
already whole.**

### The tiles golden

`tests/golden/tiles.json` (6.1 kB) holds an md5 per `<photo>/<mode>` of the tile's labels at 32 texels a metre, wear
0.3, seed 1. The kit's pipeline is a rewrite "as written", and the kit has no test that compares its output with the
builder's.

**To move, in restated form:** a world-kit unit test that feeds each photo and the builder's knobs to the kit's
`photoToTile` and compares with the builder's md5s
(`extensions/world-kit/tests/unit/textures/builder-tiles.test.ts`, data in `tests/fixtures/goldens/`). Whether the
kit's labels come out in a layout the builder's md5 can be taken over was **not measured here**; it is the first
task of the plan's second group, and a difference is a stop (the port has drifted from its source).

### World data, maps and generators

| Builder | Lines | Status | Framework file checked |
|---|---|---|---|
| `world/types.ts` | 385 | **already ported** (as Zod) | `packages/3d/src/shared/level/af-sector-2.schema.ts` |
| `world/sectors.ts` | 107 | **already ported** | `packages/3d/src/features/world/sectors.ts` |
| `world/map.ts` | 395 | **already ported** | `packages/3d/src/features/world/plane-mesh.ts`, `decor.ts`, `build.ts` |
| `world/build.ts` | 169 | **already ported** | `packages/3d/src/features/world/build.ts` |
| `world/mesh.ts`, `subdivide.ts`, `surface.ts`, `swatches.ts` | 203 | **already ported** | the files of the same names under `packages/3d/src/features/world/` |
| `world/props.ts` (the five base generators) | 508 | **already ported** | `packages/3d/src/features/world/props/base-props.ts`, `stream.ts` |
| `world/props.ts` (the rest), `library/props.json` (92 props) | | **already ported** | `extensions/world-kit/src/features/props/` (7 files), `extensions/world-kit/library/props.json` (95 entries; the six of the builder's it lacks are core's base props and prims) |
| `world/library/swatches.json` (167) | 169 | **already ported** | `extensions/world-kit/library/swatches.json` (170: all 167 and three more); the base scenes' swatches in `packages/3d/src/features/world/base/base-library.ts` |
| `world/library/maps.json` (5 maps) | 1,789 | **already ported** | `extensions/world-kit/library/maps/*.af-sector.json`, 5 files, converted by `src/features/maps/convert-builder-map.ts` and held by `tests/unit/maps/convert.test.ts` with `tests/fixtures/builder-maps.json` |
| `world/generate.ts` (`apartment@1`, `block@1`) | 123 | **already ported** | `extensions/world-kit/src/features/maps/generate-map.ts`, `apartment.ts`, `block.ts` |
| `world/lettering.ts`, `library/glyphs.json` | 428 | **already ported** | `extensions/world-kit/src/shared/lettering/lettering.ts`, `library/glyphs.json` (the same one top-level key) |
| `world/timeline.ts` | 54 | **already ported** | `packages/3d/src/shared/timeline/sample.ts` |
| `world/decals.ts` (wall decals, litter, grime steps, puddles) | 132 | **not wanted in this fold** | the level schema carries the fields (`packages/3d/src/shared/level/af-sector-2.schema.ts`, `decals`); drawing patterns and grime is already an open row of workstream 4's record task ("patterns and grime as ladders"). This fold does not open it a second time |
| `lib/geometry.ts`, `lib/colour.ts`, `lib/rng.ts` | 49 | **already ported** | `packages/3d/src/shared/math/geometry.ts`, `colour.ts`; `packages/sim/src/shared/rng/rng.ts` |

`docs/provenance/sources.md` still says of `dress.ts`, `generate.ts`, `lettering.ts`, `decals.ts` and four library
files "left out: goes to `@automata/world-kit`". The kit has since taken all but the decals. **To move: nothing but the
record**: those rows are corrected to name the kit's files.

### The dresser and its kits

| Builder | Lines | Status | Framework file checked |
|---|---|---|---|
| `world/dress.ts` | 435 | **already ported** | `extensions/world-kit/src/features/furnish/dress.ts`, `clutter.ts`, `fixtures.ts`, `floor-plan.ts`, `furniture.ts`, `context.ts`, `kit.schema.ts`, `kit.content.ts` |
| `world/library/kits.json` (8 kits) | 467 | **already ported** | `extensions/world-kit/library/kits.json`: **8 of 8 by name** |

### The painter and the look

| Builder | Lines | Status | Framework file checked, or the reason |
|---|---|---|---|
| `paint/paint.ts`, `perspective.ts`, `light.ts` (the CPU scene painter, the perspective G-buffer, lamp strength and shadow maps) | 767 | **not wanted** | The framework draws with the Pixi 3D look (`packages/3d/src/features/look/`, ADR 0007). The provenance table already records these three as left out for that reason |
| `paint/look.ts`, `library/look.json` | 111 | **already ported** | `packages/3d/src/features/look/look.ts`, `library/look.json` |
| `paint/library/times.json` | 189 | **already ported** | `packages/3d/src/shared/time-of-day/library/times.json` |
| `paint/vertex-light.ts` | 203 | **already ported** | `packages/3d/src/shared/render/light/vertex-light.ts` |
| `paint/occlusion.ts` | 78 | **already ported** | `packages/3d/src/shared/render/light/occlusion.ts` |
| `paint/post.ts` (the bloom) | 208 | **already ported** | `extensions/world-kit/src/features/sky/glow-effect.ts`, `shader-parts.ts` |
| `paint/rain.ts`, `sky.ts` | 129 | **already ported** | `extensions/world-kit/src/features/sky/rain-effect.ts`, `sky-passes.ts`, `stars-effect.ts` |
| `paint/albedo.ts` (the CPU's albedo and part ids as a debug export, for the GPU harness) | 34 | **not wanted** | it serves only the harness, below |

How close the framework's look is to the builder's is workstream 4's measure
([the survey](../2026-11-11-builders-look-survey.md) and its sheets); this fold does not repeat it.

### Figures in a scene

| Builder | Lines | Status | Framework file checked, or the reason |
|---|---|---|---|
| `stage/sprite-light.ts` | 164 | **already ported** | `packages/3d/src/features/look/sprite-light.ts`; for painted figures, FigureBuilder's own `lightSprite` through `extensions/character-kit/src/features/painted/room-light.ts` |
| `stage/state.ts` | 233 | **already ported** (the pieces' state) | `packages/3d/src/shared/level/piece-states.ts`, `packages/3d/src/app/update-pieces.ts` |
| `stage/camera.ts` | 174 | **already ported** | `packages/3d/src/features/camera/angled-camera.ts` |
| `stage/actor.ts`, `cast.ts`, `runtime.ts` | 366 | **not wanted** | a scripted actor is the cutscenes extension's, a figure in a level is a game's entity, and core keeps one clip player (the provenance table's reasons) |
| `view/readability.ts` | 116 | **already ported** | `extensions/world-kit/src/features/reads/figure-reads.ts` |
| `view/view-frame.ts` | 135 | **already ported** (the reads and their thresholds) | `extensions/world-kit/src/features/reads/reads-against.ts` |
| `view/expose.ts` (a figure's exposure toward its ring) | 68 | **already ported**, built by workstream 4's task 9 | `extensions/character-kit/src/features/painted/room-light.ts` (`Exposure`) and `packages/3d/src/shared/render/light/scene-light.ts` (`groundLuma`). It has no provenance row yet; a named difference from the builder's ring rule is on record in workstream 4 |

### The views

| Builder | Lines | Status | Reason |
|---|---|---|---|
| `view/render.ts` (the diorama and top-down CPU renderer), `view/fp.ts` (first person) | 873 | **not wanted** | "the diorama, first-person and top-down views belong in the editor, not in core" (the Owner, 2026-11-07, quoted in the provenance table); the framework's room views are Pixi 3D |
| `view/shots.ts` | 160 | **not wanted** | shots and sequences are the cutscenes extension's |
| `view/cpu-frame.ts` | 72 | **not wanted** | the CPU frame handed to the GPU harness |

### The GPU harness and its parity command

`src/features/gpu/` (21 `.ts` files, 1,926 lines, and a page), `scripts/gpu-diff.ts`, `gpu-parity.ts`, `gpu-view.ts`,
`tests/gpu/` (8 files) and `tests/features/gpu/` (6 files).

**Not wanted.** The harness draws the CPU painter's unlit albedo frame on the GPU and measures it against the CPU's:
it is cycle A of a plan to move the builder's own painter onto the GPU, and it needs the whole CPU path to have
anything to compare with. The builder's own log ended that plan: commit `9c2df06` (2026-11-10), "Phase 1 stops at
cycle 8; the look moves to AutomataFramework (owner, 2026-11-10)". The framework measures its own frames with its own
suites (`packages/3d/tests/browser/parity/`, 11 files).

**One idea worth keeping, as following work, not as code:** `gpu:parity` compares a real GPU's frame with
SwiftShader's, texel by texel, and classes the differences. Every framework session so far reports "WebGPU on a real
GPU: not run". A hand-run command of that shape over the framework's own frames would close that gap. It goes to the
plan's "Following work" list for workstream 5 (the runners).

### The tuning and check commands

| Builder | Lines | Status | Reason, or the framework file |
|---|---|---|---|
| `scripts/textures.ts`, `photos.ts` | | **already ported** | `extensions/world-kit/src/app/textures-cli.ts`, `src/features/textures/textures-command.ts` |
| `scripts/check.ts`, `checks.ts`, `check-worker.ts`, `pool.ts` (every declared check, a map a worker, about 40 s) | | **not wanted** | each declared `reads` is already a unit test or `checkReads` in the kit, and `pnpm check` is the framework's one gate; the `gpu-albedo` section goes with the harness |
| `scripts/tune.ts`, `lib/search.ts` (sweep a swatch's knobs, search one for its passing range) | 46 + script | **not wanted as a command; logged as an editor gap** | the Owner's direction is that content is changed by hand in an editor. Tuning a swatch against its `reads` belongs in the world kit's editor; the judge (`checkReads`) is already in the kit. The plan adds one row to the editor gaps ledger |
| `scripts/tune-light.ts`, `lit-rooms.ts` (search the figure light's floor) | | **not wanted** | it tunes the CPU painter's figure light; the framework's exposure is workstream 4's |
| `scripts/render.ts`, `map.ts`, `board.ts`, `lit.ts`, `golden.ts`, `save.ts`, `sheet.ts` | | **not wanted** | they drive the CPU renderer |

### Its three goldens

| Golden | Status |
|---|---|
| `tests/golden/tiles.json` | **to move, restated** as a world-kit test (above), if the kit's pipeline reproduces it |
| `tests/golden/base.json` (8 frames) | **does not come** under the plan's default: it records the CPU renderer, which does not come, with the older painter. Under the Owner's other option it comes and is re-recorded once |
| `tests/golden/scenes.json` (14 frames) | the same |

### The base scenes and the rest

| Builder | Status | Framework file checked |
|---|---|---|
| `base/base.ts` (interior, exterior, dressed variants) | **already ported** | `packages/3d/src/features/world/base/base-scenes.ts`, `base-library.ts`; the dressed variants in `extensions/world-kit/src/app/dressed-base-scenes.ts` |
| `src/index.ts`, `tests/api.test.ts`, `tests/architecture.test.ts` | **not wanted** | the builder's surface and layer rule; the framework's are `pnpm api-report` and `pnpm boundaries` |
| `docs/photos.md` (the photo process, 287 lines) | **to move, as a document** | the world kit has the code but not the written process (photograph in grey weather, square on, size known, record source, licence and credit). It becomes `extensions/world-kit/docs/photos.md`, reworded to the kit's commands |
| `docs/lighting.md`, `dressing.md`, `camera-and-state.md`, `gpu.md`, `environments-history.md` | **not wanted** | they describe the CPU renderer and the builder's history; the retired repository keeps them |
| `docs/reference/` (four frames of the reference game and copies of 15 of its source files) | **not wanted** | the reference game is in the framework itself (`games/`), which is the better reference |
| `docs/superpowers/` | **not wanted** | the builder's own specs, plans and audits |

## Its dependency on FigureBuilder

`src/lib/figure.ts` (15 lines) is its one door, and it reaches **inside** FigureBuilder, past its public surface:
`figure-builder/features/paint/raster` (the G-buffer, `rasterize`, `resolve`, `cleanup`), `paint/paint` (`duel`,
`oklab`), `paint/duel-ramps`, `body/parts`, `lib/math`, `body/rig`, and the public index (the base pair, `Figure`,
`ScriptedActor`, `Troupe`). 28 of its modules import the door.

When both live in one repository:

- **Under the plan's default** nothing that imports the door comes across, so the door has no successor. The kit and
  core already import their own maths, palette and meshes.
- **Under the Owner's other option** (the CPU renderer comes as a reference tool) the door becomes an import of
  `@automata/painted-figures/kit`. FigureBuilder made that entry for exactly this (`src/kit.ts`: "the rig names
  EnvironmentBuilder's door imports"): it exports every name the door takes from the internals. The door's public-index
  names come from `@automata/painted-figures`. `Casting` (a type the door takes from `features/actors/actor`) is on
  the index already. No deep import is left, and the 22 golden frames are re-recorded once.

## What changed after the provenance rows were written

The rows were read at `6d82a52` (2026-11-06). `f7c5356` is 68 commits later: 40 files of `src/` and `base/` changed,
+2,320 and −80 lines. All but 18 of those files are the GPU harness. The rest:

| File | + / − | Its row says | To do |
|---|---|---|---|
| `view/cpu-frame.ts`, `paint/albedo.ts` | new | no row | a row each: left out, with the harness |
| `view/expose.ts` | new, 68 | no row | a row: built in the kit by workstream 4 |
| `view/fp.ts`, `view/render.ts` | 54/34, 31/10 | left out | nothing |
| `view/readability.ts`, `view/view-frame.ts` | 23/0, 21/9 | ported to the kit's `reads/` | **read the hunks** against `figure-reads.ts` and `reads-against.ts` |
| `world/types.ts`, `world/map.ts`, `world/swatches.ts` | 18/1, 14/6, 13/0 | ported to `packages/3d` | **read the hunks** against the schema, `build.ts` and `swatches.ts` |
| `stage/sprite-light.ts` | 12/3 | ported to `look/sprite-light.ts` | **read the hunks** |
| `paint/look.ts`, `library/look.json`, `paint/paint.ts` | 5/3, 1/1, 12/5 | ported, ported, left out | **read the look hunks** |
| `world/decals.ts`, `world/library/maps.json`, `base/base.ts`, `src/index.ts` | small | left out, ported, ported, left out | **read `maps.json` and `base.ts`** against the kit's maps and the base scenes |

`docs/provenance/sources.md` prescribes this itself ("Pull again: … port each hunk (tests first), add a row for every
new file, run `pnpm sources-md`, and record the new commit"). Workstream 4 measured the framework's look against the
builder at `f7c5356`, so some of these hunks are likely already answered; **which ones was not checked here**, and the
plan gives the reading its own task.

## Summary

| | Count |
|---|---|
| Builder `src/` and `base/` TypeScript | 70 files, 9,184 lines |
| Already ported (a framework file named and checked) | the photo pipeline, tiles and structure checks, world data, maps, generators, dresser and kits, lettering, the look, vertex light, occlusion, sprite light, readability, exposure, sky, rain, bloom, the base scenes |
| To move | the tiles golden, restated (if it reproduces); `docs/photos.md`; the provenance rows brought to `f7c5356`; one editor-gap row |
| Not wanted | the CPU scene painter and its views (1,906 lines), the stage's actors and runtime (366), the GPU harness (1,926 and its tests), the tune, check and render commands, the decals' drawing (workstream 4's), two goldens of the CPU renderer |

**The second group is therefore small:** it moves almost no code. Its work is proof and record: the tiles cross-check,
the hunks since `6d82a52`, the photo document, the provenance table at `f7c5356` with every file of the builder given
a row, and the retirement notes.

## Open branches there

| Branch | Ahead / behind `main` | What | Work not on `main`? |
|---|---|---|---|
| `claude/eb-base-renders` | 1 / 4 | `085b50b` (2026-11-10): the base scenes' CPU renders, committed for the framework's baseline comparison | images only; the framework's copies are in `docs/superpowers/audits/builders-look-survey/builders/` |

## Not verified

- The tiles cross-check (the kit's pipeline against the builder's md5s) was not run.
- `npm run test:gpu`, `npm run check` and the `gpu:*` commands were not run.
- The hunks between `6d82a52` and `f7c5356` in the eight ported files were listed, not read against the framework.
- The library comparison is by entry name (kits, props, swatches) and by top-level key (glyphs); values were not
  compared except for `photos.json` (equal as parsed JSON) and the photos (equal bytes).
- Whether the kit's five converted maps equal the builder's `maps.json` at `f7c5356` (the kit's fixture
  `builder-maps.json` was not compared with it; `maps.json` changed by 2 lines since `6d82a52`).
