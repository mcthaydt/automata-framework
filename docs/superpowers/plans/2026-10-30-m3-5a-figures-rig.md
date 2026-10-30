# M3.5a: figures part 1 (package, math, rig, genes, figure content and libraries), TDD plan

- **Spec:** [M3 spec, revised three times](../specs/2026-10-18-m3-3d-characters-design.md), as amended 2026-10-30 (M3.0A, PR #195: FigureBuilder is the figure source): §1, §2.2, §4.4 (§4.4.1 for this task), §6 (the figure rows), §9 (unit layer), §13 (F-a, F-e).
- **Task:** `M3.5a — figures part 1: package, math, rig, genes, figure content and libraries` (02). Lane **figures**; prerequisite M3.0A. Size L.
- **Status:** drafted 2026-10-30, based on `main` (`6aee63b`).
- **Progress:** 8 of 8 steps; review fixes (PR #202) recorded in the execution log.

## Sources (read-only, recorded in every extracted file's header)

| Source | Commit | Taken |
|---|---|---|
| FigureBuilder, `mcthaydt/FigureBuilder` | `a1f7246` | `src/render/figure/math.ts`, `rig.ts`, `genes.ts`; the types behind the library files (`Gait` and `Stand` in `motion.ts`, `Lock` and `Headwear` in `garments.ts`, the hair pieces and `Cap` in `hair.ts`, `ItemDef` in `cast.ts`, the garment union in `garments.ts` and `streetwear.ts`); `library/{swatches,gaits,hair,headwear,items,poses}.json` as fixture content |
| The Last Light, `mcthaydt/PixiJS3D_Experiment_001` | `92e6704` | `tests/procedural-figure.test.ts`: the rig tests in this task's scope (two-bone IK reaches any reachable target; one rig, different proportions) and the library tests (every name a character uses exists; the builder checks name what is wrong; every swatch colour is on the palette) |

Not taken here (later rows): `parts.ts`, `garments.ts`, `hair.ts`, `streetwear.ts` and `build()` (M3.5b); `motion.ts`'s `base()`, stands, holds, hems and the hair spring, with The Last Light's feet-planted, closed-walk and hold-invariance tests and FigureBuilder's `tests/form.test.ts` (M3.5c); the figure view (M3.5d). Never taken: `sets.json`, `graphics.json` (SNEKPRTY marks, plates, font, colourway), the painter and the DUEL ramps.

## Decisions (open to the Owner's veto)

1. **Package.** `packages/figures`, `@mcthaydt/automata-figures`, `private: true` (spec §4.8), renderer-free (no Pixi import), source-only like `editor-3d` (no tsdown, no `dist`), one vitest project `unit` on Node.
2. **Strict TypeScript.** AF compiles with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `isolatedDeclarations`; FigureBuilder does not. The extracted math keeps its formulas but types matrices as fixed tuples (`M` is 12 numbers, `R3` is 9) so indexing stays `number`, and array lookups of joints go through one checked accessor. Behaviour is unchanged and the tests pin it.
3. **`skeleton(def)`.** The spec's `skeleton(def: FigureDef)` is `skeletonFromGenes(genesOf(def))`: FigureBuilder's `skeleton(genes)` is extracted as `skeletonFromGenes`, and `genesOf` is its `fromDef` gene step (`measure(sliders).genes`, then the figure's own `genes`).
4. **Content kinds.** Eight collections, all `sim: false` (figures are presentation, law 1): `figure` (`content/figures/`), `figure-swatch` (`figure-swatches/`), `figure-gait` (`figure-gaits/`), `figure-hair` (`figure-hair/`), `figure-headwear` (`figure-headwear/`), `figure-item` (`figure-items/`), `figure-stand` (`figure-stands/`), `figure-rig` (`figure-rigs/`). One TOML file per item, as every AF collection. Library references use the content compiler's `contentRef`, so a missing id is the compiler's own `unknownReference` at `file:line:col` (F-e): consumed, not copied.
5. **Ids.** AF ids are kebab-case (`ID_PATTERN`), so FigureBuilder's camelCase names become kebab-case (`handOnHip` → `hand-on-hip`, `inkBlack` → `ink-black`), in references too.
6. **Swatches are palette colours.** A swatch is `{ colour, gloss?, flat?, kind?, role? }`: `colour` is a 0-based index into the game's palette content (Endesga 64 by default, numbered as `docs/art/palettes/endesga-64.txt` and Emberwick's sprite comments number it), `gloss` and `flat` are the material fields a lit mesh can use, `kind` and `role` are what streetwear matches swatches by. Dropped as painter-only: `ramp`, `base`, `lift`, `floor`, `grain`, `strands`, `rim`, `wear`, `streaks`, `paint`, `tones`, `mix`, `stain`, `holo`, `see`. A schema cannot see the palette, so `swatchColourProblems(swatches, palette)` checks the indexes against it, and the fixture test runs it against `DEFAULT_PALETTE`; placing that problem at `file:line:col` needs a cross-kind check seam in the content compiler, which is a request to the content lane, not built here.
7. **Colour mapping rule (fixture conversion).** Each FigureBuilder swatch's colour is its DUEL row and step, `RAMPS[ramp][base]` (`src/render/duel-ramps.ts` at `a1f7246`: the step a lit surface sits on), mapped to the nearest Endesga 64 colour by Euclidean distance in OKLab, ties to the lower index. `paint` overrides are ignored, so one rule covers every swatch. The conversion ran once (a throwaway script, not committed); each swatch file's header comment records its source row, step, DUEL colour and result, and the table below lists them. Some skin and lid tones land on cool greys (Endesga 64 has few muted warm tones); a game re-picks its own.
8. **Garments in 5a.** The figure schema checks every garment's swatch fields as references (F-e) and its other fields by type. Classic garments (`garments.ts`) and streetwear (`streetwear.ts`) are listed with their fields; `graphics` and `pendant` (SNEKPRTY marks and plates) are left out. M3.5b, which builds them, may tighten ranges.
9. **Hair.** The spec on `main` (PR #195) gives `FigureDef` a `hairPieces?: readonly string[]` of hair-library ids, and the figure schema now has it: every id is checked as a reference (F-e). The hair an outfit wears stays FigureBuilder's outfit garment, `{ hair: <swatch>, style: <hair id> | inline, tie? }`, because that garment carries the hair's colour and changes with a cap; M3.5b, which builds hair, settles how `hairPieces` combines with it (for example the hair worn when an outfit names none). Until then nothing reads `hairPieces` but the content check.
10. **Gait overrides.** `gaitOverrides?: Partial<Gait>` is in the figure (FigureBuilder `CharacterDef`), checked field by field like a gait.
11. **Not in the figure (was 10):** FigureBuilder's `face.camera` and `face.turn` (sprite cheats, excluded by §4.4.1), `play`, `atlasOutfit`, `story`, `cell` and per-figure `swatches` (a figure's own colours are library swatches). `blink` waits for the face decals (M3.5d).
11. **Impossible skeletons.** The figure schema runs `genesOf` and `skeletonFromGenes` and refuses a non-positive bone length (thigh, shin, upper arm, forearm, neck, head, spine from pelvis to chest, foot), placing the diagnostic at the slider (or the `genes` override) that sets it and naming it: `legs 3 gives a shin of -0.21 m`. Slider ranges follow The Last Light's builder check: `height` 120 to 240 cm, `headTilt` −30° to 30°, every other slider −1 to 2 (a little past 0 to 1 is allowed, as FigureBuilder says).
12. **Rig limits.** `figure-rig` holds the spec's starting values (§4.4.2) in degrees: elbow and knee hinges 0 to 150, chest twist ±35, neck yaw ±70 and pitch −40 to 50. The spec gives no numbers for the shoulder and hip cones, the chest's pitch or the head, so the fixture's `default` picks them (shoulder cone 110, hip cone 95, chest pitch −20 to 30, head yaw and pitch as the neck, head roll ±25) for M3.6a to tune. 5a only checks that each range is a range (`min ≤ max`).
13. **Fixture figures.** `wick` (Emberwick's hero, `games/emberwick/src/art/sprites.ts`: a small hooded wanderer in a blue cloak with gold trim, dark boots, glowing eyes in the dark under the hood, a lantern; as data, his colours are Endesga 64 indexes 41, 24, 17, 15 and 32) and `keeper` (an old lamplighter: tall, long-armed, the `elderly` gait, a coat and flat cap, a torch). Wick's hood is inline headwear locks; his lantern is the library's `hand-lamp`.

14. **API report.** `pnpm check`'s `api-report` unit test covers every `packages/*` folder that `tooling/api-report/src/core-packages.ts` does not list as not core (today `physics` and `editor-3d`). `figures` is an extension in the core/extension sense (it registers with `defineExtension`), but the spec makes it free and in this repository (M3R-D20), and its exports are the seam M3.5b to M3.6 and the Studio build on, so it gets a committed report (`tooling/api-report/reports/figures.api.md`) rather than an entry in `NOT_CORE`. Either is a one-line change if the Owner prefers the other.
15. **Content layout.** The content compiler's key locator does not index keys inside inline tables or arrays (`packages/content/src/parse/locate-keys.ts`), so a fixture outfit is written as an array of tables (`[[outfits.lamplighter]]`, one garment each) and a missing garment swatch is reported at its own line, not at the outfit's.
16. **Garment, hair-piece and hand unions; ids or inline values.** A garment is chosen by its first known key (`keyedUnion`, `library/keyed-union.ts`) rather than with zod's union, which reports a failed member as one "Invalid input" on the whole object; the member's own issues keep their paths, so a wrong field is reported at its key. A stand's hand is told apart the same way (`at` or `out`). A field that takes an id or an inline value (the gait, a hair style, headwear) goes through `refOrInline` (`library/ref-or-inline.ts`), which chooses by the value's type (a string is an id, a table or an array is parsed by its schema), for the same reason.
17. **Default rig.** `DEFAULT_RIG_LIMITS` is exported, so a figure that names no `rig` has limits in a game with no figure-rig content; the fixture's `figure-rigs/default.toml` says the same (tested). Chest and neck roll limits are left for M3.6a.
18. **Math entry.** The math stays exported from the package root (not moved to a `./math` subpath): the rig's types (`V3`, `M`, `Q`) are in its public signatures, so callers need them from the same entry.

## Files

- **Create** `packages/figures/`: `package.json`, `tsconfig.json`, `vitest.config.ts`.
- **Create** `packages/figures/src/`:
  - `index.ts`
  - `math/math.ts`, `math/math.test.ts`
  - `rig/rig.ts` (joints, `PARENTS`, `J`, `armChain`, `skeletonFromGenes`, `restPose`, `clonePose`, `fk`), `rig/two-bone-ik.ts`, `rig/rig.test.ts`
  - `genes/genes.ts` (`Sliders`, `HeadShape`, `DEFAULT_SLIDERS`, `DEFAULT_HEAD`, `measure`), `genes/genes.test.ts`
  - `library/shapes.schema.ts` (vectors, angles), `library/swatch.schema.ts`, `library/gait.schema.ts`, `library/hair.schema.ts`, `library/headwear.schema.ts`, `library/item.schema.ts`, `library/stand.schema.ts`, `library/rig-limits.schema.ts`, `library/swatch-colours.ts`, `library/library.test.ts`
  - `figure/garment.schema.ts`, `figure/figure.schema.ts`, `figure/figure-skeleton.ts` (`genesOf`, `skeleton`, `skeletonProblems`), `figure/figure-skeleton.test.ts` (F-a)
  - `content/figures.content.ts` (the eight `defineContentSchema` kinds), `figures.extension.ts`, `content/figures-content.test.ts` (compile, F-e, impossible skeletons), `figures.extension.test.ts`
  - `library/keyed-union.ts`, `library/ref-or-inline.ts`
  - `testing/fixture-sliders.ts`, `testing/compile-fixture.ts` (test helpers)
  - `testing/fixtures/content/…` (the fixture library and the two figures, TOML)
- **Create** `tooling/api-report/reports/figures.api.md` (`pnpm api-report --update`, decision 14).
- **Modify:** `pnpm-lock.yaml` (the new workspace). Nothing else: `pnpm style` and knip already cover `packages/*`.

## Interfaces

- **Produced:** `V3`, `Q`, `M`, the math functions; `JOINTS` (27), `Joint`, `J`, `PARENTS`, `Side`, `armChain`, `Genes`, `Skeleton`, `Pose`, `skeletonFromGenes`, `restPose`, `clonePose`, `fk`, `twoBoneIK`; `Sliders`, `HeadShape`, `Measure`, `DEFAULT_SLIDERS`, `DEFAULT_HEAD`, `measure`; the zod schemas and their types (`FigureDef`, `Garment`, `Swatch`, `Gait`, `HairStyle`, `Headwear`, `ItemDef`, `Stand`, `RigLimits`); `genesOf`, `skeleton(def)`, `skeletonProblems`; `swatchColourProblems`; `FIGURE_CONTENT` (the eight kinds); `figuresExtension`.
- **Consumed:** `defineContentSchema`, `contentRef`, `compileContent`, `DEFAULT_PALETTE`, `Palette`, `Diagnostic` (`@mcthaydt/automata-content`); `defineExtension`, `ExtensionDef` (`@mcthaydt/automata-runtime/extension`); zod.
- **For later rows:** M3.5b reads `Measure`, `Skeleton`, the library types and `Garment`; M3.5c reads `Gait`, `Stand`, `ItemDef`, `twoBoneIK`; M3.6a reads `RigLimits` and `twoBoneIK`.

## Steps

- [x] **1. Plan.** This file, committed first.
- [x] **2. Package skeleton.** `package.json`, `tsconfig.json`, `vitest.config.ts`, an empty `index.ts`; `pnpm install`; `pnpm --filter @mcthaydt/automata-figures typecheck` passes with no tests.
- [x] **3. Red: math, rig, genes.** `math.test.ts` (quaternion and matrix identities, `hash` repeats, `invertRigid`), `rig.test.ts` (27 joints with parents first and the hem and hair pivots on their parents; The Last Light's "two-bone IK puts the end on any reachable target" on Wick's and the keeper's skeletons; out of reach extends fully toward it; a pole parallel to the limb stays finite; FK of the rest pose is the rest positions), `genes.test.ts` (FigureBuilder's defaults; `height` in cm gives metres; `face` fills from `DEFAULT_HEAD`; the `chunk` build). Run: fail for the missing modules.
- [x] **4. Green: extract.** `math.ts`, `rig.ts`, `two-bone-ik.ts`, `genes.ts` from FigureBuilder `a1f7246`, typed for AF's strict settings. Step 3's tests pass.
- [x] **5. Red: schemas, fixture content, F-a.** `library.test.ts` (every fixture library file parses through its schema; FigureBuilder's painter fields are refused as unknown; every fixture swatch colour is on `DEFAULT_PALETTE` and an index past it is reported), `figure-skeleton.test.ts` (F-a: Wick and the keeper from one `skeleton()`, the same 27 joints, bone lengths following their sliders; `skeletonProblems` names `legs` for a negative spine, and a gene override when it breaks a bone), `figures-content.test.ts` (the fixture compiles with no diagnostics; F-e: a figure naming a missing swatch, gait, hair style, headwear, stand or rig, and an item naming a missing material swatch, fail with `unknownReference` at its `file:line:col`; a figure with impossible sliders fails naming the slider at its line), `figures.extension.test.ts` (`figuresExtension` carries the eight kinds, none for the sim). Add the fixture TOML. Run: fail for the missing schemas.
- [x] **6. Green: schemas, content kinds, extension.** The schema files, `figure-skeleton.ts`, `swatch-colours.ts`, `figures.content.ts`, `figures.extension.ts`, `index.ts`. Step 5's tests pass.
- [x] **7. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check` (lint, typecheck, boundaries, style, knip, unit). `pnpm api-report --update` (decision 14). No changeset (private package). No parity (no sim, renderer or golden touched), no build (not published, no tsdown).
- [x] **8. Hand off.** Push `claude/3d-m3-5a-figures-rig`; report the commits, gates and decisions.

## Swatch mapping (decision 7)

| FigureBuilder | AF id | DUEL row, step | DUEL colour | Endesga 64 |
|---|---|---|---|---|
| `fair` | `fair` | 27, 5 | `#ebbd9d` | 22 `#f6ca9f` |
| `pale` | `pale` | 1, 4 | `#bbafa4` | 7 `#b4b4b4` |
| `sallow` | `sallow` | 22, 5 | `#b39783` | 10 `#92a1b9` |
| `auburn` | `auburn` | 2, 2 | `#885041` | 19 `#8a4836` |
| `inkBlack` | `ink-black` | 0, 1 | `#222323` | 3 `#272727` |
| `steelGrey` | `steel-grey` | 10, 4 | `#848795` | 6 `#858585` |
| `brown` | `brown` | 12, 3 | `#725a51` | 5 `#5d5d5d` |
| `navy` | `navy` | 5, 1 | `#3a4568` | 12 `#424c6e` |
| `navyDeep` | `navy-deep` | 5, 0 | `#282b4a` | 13 `#2a2f4e` |
| `starch` | `starch` | 1, 5 | `#ccc3b1` | 7 `#b4b4b4` |
| `starchShade` | `starch-shade` | 1, 4 | `#bbafa4` | 7 `#b4b4b4` |
| `wardWhite` | `ward-white` | 10, 6 | `#bac7db` | 9 `#c7cfdd` |
| `wardWhiteShade` | `ward-white-shade` | 10, 5 | `#abaebe` | 7 `#b4b4b4` |
| `capWhite` | `cap-white` | 10, 7 | `#ebf0f6` | 8 `#ffffff` |
| `cream` | `cream` | 1, 4 | `#bbafa4` | 7 `#b4b4b4` |
| `maroon` | `maroon` | 19, 1 | `#633432` | 18 `#5d2c28` |
| `denim` | `denim` | 7, 1 | `#23324d` | 13 `#2a2f4e` |
| `workGreen` | `work-green` | 8, 2 | `#385140` | 38 `#134c4c` |
| `rubberBrown` | `rubber-brown` | 24, 1 | `#53393a` | 18 `#5d2c28` |
| `tweed` | `tweed` | 12, 3 | `#725a51` | 5 `#5d5d5d` |
| `charcoal` | `charcoal` | 10, 1 | `#48474d` | 4 `#3d3d3d` |
| `flatGrey` | `flat-grey` | 10, 3 | `#73737f` | 11 `#657392` |
| `rubberGrey` | `rubber-grey` | 10, 4 | `#848795` | 6 `#858585` |
| `mauve` | `mauve` | 30, 1 | `#5e414a` | 18 `#5d2c28` |
| `redTrim` | `red-trim` | 9, 1 | `#82211d` | 62 `#891e2b` |
| `bootBrown` | `boot-brown` | 24, 2 | `#784c49` | 19 `#8a4836` |
| `stocking` | `stocking` | 10, 2 | `#5b5c69` | 5 `#5d5d5d` |
| `stockingDark` | `stocking-dark` | 10, 1 | `#48474d` | 4 `#3d3d3d` |
| `black` | `black` | 0, 1 | `#222323` | 3 `#272727` |
| `sole` | `sole` | 0, 0 | `#000000` | 15 `#0e071b` |
| `bootSole` | `boot-sole` | 24, 0 | `#372423` | 17 `#391f21` |
| `brass` | `brass` | 15, 5 | `#cca96e` | 21 `#e69c69` |
| `silver` | `silver` | 0, 5 | `#a6aeba` | 7 `#b4b4b4` |
| `badge` | `badge` | 0, 7 | `#f5f7fa` | 8 `#ffffff` |
| `cross` | `cross` | 9, 2 | `#b63c35` | 61 `#c42430` |
| `wood` | `wood` | 12, 3 | `#725a51` | 5 `#5d5d5d` |
| `rag` | `rag` | 12, 5 | `#9e8a6e` | 6 `#858585` |
| `glass` | `glass` | 1, 6 | `#eadbc9` | 23 `#f9e6cf` |
| `eyeDark` | `eye-dark` | 28, 0 | `#1d1d21` | 2 `#1b1b1b` |
| `eyeMilky` | `eye-milky` | 0, 6 | `#cdd2da` | 9 `#c7cfdd` |
| `stubble` | `stubble` | 1, 3 | `#aea189` | 7 `#b4b4b4` |
| `lid` | `lid` | 27, 3 | `#b98c93` | 10 `#92a1b9` |
| `paleLid` | `pale-lid` | 1, 2 | `#9e8c79` | 6 `#858585` |
| `brow` | `brow` | 24, 0 | `#372423` | 17 `#391f21` |
| `mouth` | `mouth` | 24, 1 | `#53393a` | 18 `#5d2c28` |
| `chrome` | `chrome` | 0, 6 | `#cdd2da` | 9 `#c7cfdd` |
| `chromeDark` | `chrome-dark` | 0, 5 | `#a6aeba` | 7 `#b4b4b4` |
| `stitch` | `stitch` | 10, 2 | `#5b5c69` | 5 `#5d5d5d` |
| `topstitch` | `topstitch` | 15, 4 | `#b29062` | 20 `#bf6f4a` |
| `glint` | `glint` | 0, 7 | `#f5f7fa` | 8 `#ffffff` |
| `cord` | `cord` | 0, 7 | `#f5f7fa` | 8 `#ffffff` |
| `midsole` | `midsole` | 0, 7 | `#f5f7fa` | 8 `#ffffff` |
| `outsole` | `outsole` | 0, 3 | `#626871` | 5 `#5d5d5d` |
| `holoCyan` | `holo-cyan` | 7, 7 | `#74f5fd` | 45 `#94fdff` |
| `holoLilac` | `holo-lilac` | 28, 5 | `#a996ec` | 10 `#92a1b9` |
| `holoViolet` | `holo-violet` | 28, 3 | `#7964ba` | 11 `#657392` |

## Gates

- Selected: the four test files of steps 3 and 5 while iterating; `pnpm format` and `TURBO_FORCE=true pnpm check` at the end.
- Omitted: parity (no sim, renderer, ui or golden changes), `pnpm build`, `api-index`, `agent-skills` (the package is private and unbuilt; `pnpm check` runs their unit tests), changesets (private), e2e (nothing runs in a browser).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | `adc4df1` | Plan committed first. |
| 2026-10-30 | 2 | `13921b5` | `pnpm install`; `tsc -p packages/figures` passes on an empty entry. |
| 2026-10-30 | 3 | | Red: `math.test.ts`, `rig.test.ts`, `genes.test.ts` fail to load (`Cannot find module './math'`, `'./genes'`, `'../genes/genes'`): 3 files failed, no tests. Golden numbers taken by running FigureBuilder's own `math.ts`, `rig.ts` and `genes.ts` at `a1f7246` on Node 24 (a throwaway copy in the scratchpad with `.ts` import suffixes). |
| 2026-10-30 | 4 | `13921b5` | Extracted with tuple types; 3 files, 18 tests pass; the source's `measure` genes for Wick, rest positions and IK rotations match exactly (IK to 1e-12). Biome's `useIterableCallbackReturn` made the tests use `for…of` instead of `forEach`. |
| 2026-10-30 | 5 | | Red: `figures.extension.test.ts`, `figures-content.test.ts`, `figure-skeleton.test.ts`, `library.test.ts` fail to load (`Cannot find module './figures.extension'`, `'../library/swatch-colours'`, `'./figure-skeleton'`, `'./gait.schema'`); the 18 earlier tests still pass. |
| 2026-10-30 | 6 | `df0eba6` | First green run: 6 failed. cornrows' `nape` is a one-point line (the shape allowed only two or more; fixed to one or more), and F-e found the missing hair style, headwear and garment swatch at the outfit's line, not the garment's: the content compiler does not index keys inside inline tables, so the fixture outfits became arrays of tables (decision 15). Then 7 files, 45 tests pass. `tsc` then wanted explicit types (`isolatedDeclarations`) and `exactOptionalPropertyTypes`-safe partial schemas (`partialOf`). |
| 2026-10-30 | 7 | (hand-off commit) | `pnpm format`. First `TURBO_FORCE=true pnpm check`: exit 1, `@mcthaydt/api-report` `seams.test.ts` "match the current source of every core package" expected no unreported package and found `figures.api.md` (the other failed lines were tasks turbo stopped). `pnpm api-report --update` wrote `figures.api.md` (decision 14). Second `TURBO_FORCE=true pnpm check`: exit 0 (lint, typecheck 35 of 35, boundaries, style 0 findings, knip, unit 34 of 34). |
| 2026-10-30 | 8 | `2365fad` | Pushed `claude/3d-m3-5a-figures-rig` (PR #202 opened by the coordinator). |
| 2026-10-30 | Review | (review-fix commit) | Gates: `pnpm format`, `pnpm api-report --update` (adds `gaitOverridesSchema`, `DEFAULT_RIG_LIMITS`, `refOrInline` types), `TURBO_FORCE=true pnpm check` exit 0 (typecheck 36 of 36, unit 34 of 34). Merged `origin/main` (`b395d17`, PR #195's spec: 27 joints, `stand?`, `hairPieces`). Review fixes, test first. Red: 9 failed of 54: four inline-value and union cases reported only the union's key (`outfits.wanderer.4.style`, `outfits.lamplighter.5.style`, `hands.R`) and an inline gait gave one diagnostic; `gaitOverrides` was an unknown field; `hairPieces` gave no reference check; `DEFAULT_RIG_LIMITS` did not exist. Green: `refOrInline` for the gait, hair style and headwear; stand hands through `keyedUnion('hand', { at, out })`; `gaitOverrides` and `hairPieces` in the figure; `DEFAULT_RIG_LIMITS`, checked against the fixture default. Tightened (passed on first run, as they assert existing behaviour more closely): F-e asserts the column; the reachable-target IK test counts its cases (at least 4 of 6); out of reach, the limb points at the target (dot 1 to 1e-9); the slider-range message names the range. `mmul` and `mul3` build their tuples directly instead of `flatMap`, same sums in the same order: the exact goldens still pass. `compileFixture` removes its temp copy after each compile. 54 tests pass. |
