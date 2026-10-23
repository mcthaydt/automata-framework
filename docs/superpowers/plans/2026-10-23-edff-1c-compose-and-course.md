# EDFF.1c FloorFifty composition and course generator: TDD plan

- **Task:** EDFF.1c, the third slice of EDFF.1 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §10.4 (composition), §10.5 (course), decision FF-D4 ("composition math is a pure function ported from `StageLayers`, tested against numbers from FloorFifty's own code").
- **Lane:** FloorFifty profile. **Depends on:** EDFF.1a (`StageValue`), EDFF.1b (`tunables.ts`, `StageCheckContext`). Stacks on #154. **Unblocks:** EDFF.1d (the `Profile` object's views), EDFF.2 (the Compose canvas applies `composeStage`), EDFF.3 (the Course view draws `createCourse` and `stepDemands`).
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-edff1c`. The 2D spec is drafted, not reviewed.
- **Progress:** 5 of 6 steps (the PR is step 6's last part). Implemented and locally checked 2026-10-23; not CI verified.

## Why the numbers come from a script that runs the game

FF-D4 says "WYSIWYG is a claim about numbers". A port tested against numbers the port produced proves nothing, and the two FloorFifty tests that exist (`tests/shared/level/demand.test.ts`, `tests/client/systems/render/stage-layers.test.ts`) check a handful of values. So the goldens are written by `testing/make-goldens.mjs`, which copies FloorFifty's own files at the recorded commit into a temporary folder, stubs only the imports that need a GPU or an image (textures, haze, window codes, the sun's shimmer filter), and runs `createCourse`, `stepDemands` and `StageLayers.update` on `pixi.js`. The port must equal them with `toBe`, bit for bit. A refresh is a re-run at a newer commit with the diff reviewed.

## Scope

**In** (`packages/editor-2d/src/profiles/floorfifty-stage/`, headless, Node `unit` project):

- `course-rng.ts`: `deriveSeed` and `createRng` (SplitMix32), the integer generator the game and the server share.
- `course-tuning.ts`: `resolveCourseTuning(courseTuning, context)`: the 16 tunables the generator and the demand read, from the stage's `courseTuning`, else `tuning.toml`, else the declared default, each judged against its declaration. A value out of range is a finding of the checks already; here it makes the course unavailable instead of drawing a wrong one.
- `course-floors.ts`: `createCourse(seed, tuning)`, `courseBounds`, `rampBand`, the `Floor` and `Course` types.
- `course-demand.ts`: `bounceBudget` and `stepDemands` (how much of one bounce each step asks for), for the Course view.
- `stage-scenery.ts`: `resolveScenery(value)`: the layers with their defaults filled in (a city layer's arc is its depth over 0.35, a sky layer's 0), the light's height (default −60), the horizon lift and the city's sink as knots built from the phrases' ends; `citySinkAt`.
- `stage-compose.ts`: `composeStage(scenery, state)`: where each layer stands for a camera height, a progress and a time, by `StageLayers.update`'s formulas.
- `testing/make-goldens.mjs`, `testing/course-goldens.json`, `testing/compose-goldens.json`; `testing/PROVENANCE.md` extended.

**Out, with owner:**

| What | Where |
|---|---|
| The commands that change a document, the `Profile` object, templates, views, exports; mapping `ProjectContext` to `StageCheckContext` | EDFF.1d |
| The Compose canvas (sprites, placeholders, ghost extents), the climb scrubber, the viewport chips | EDFF.2 |
| The Course view (bars, bounds, reach, demand strip) | EDFF.3 |
| Music and race reactions (`StageMotion`: bob, jolt, surge, swarm sweeps), the sun's heat shimmer, haze baking, window codes | not previewed; they need a race, a song or a GPU, and move a layer by a few units |
| `extendCourse` (the endless mode's growth) | the Course view asks `createCourse` for the floors it shows |

## Decisions made here (written into spec §10.4 and §10.5)

1. **The preview shows the settled composition.** The game eases the horizon lift and the city's sink toward the values the climb has earned over 0.4 s, and applies them at once under reduced motion. The editor scrubs a position, so it shows where the ease comes to rest (the reduced-motion value). Goldens run the game with `reducedMotion = true` for that reason.
2. **`composeStage` returns the game's sprite positions, not a simplified model.** A `tile` layer's strip runs 4000 units below its art, so its `y` includes them; a sky plate has no `tileX`; city layers are rounded to whole device pixels when `pixelsPerUnit` is given. The first draft of §10.4 listed `x`, `alpha` and `visible`: the game has no per-layer alpha, every strip is centred on x = 0, and hiding a layer is the Layers panel's own state, so those three are cut.
3. **Layers come back in drawing order**, which is the game's: a leading sky plate (the first sky layer, when it is a plate) first, then the list in order.
4. **Heights are an input only for the framing.** `cityTopMin` sinks the city until no strip starts above it, and that needs the strips' heights (the art's). A layer with no height is left out of the framing, as the game leaves out a layer whose art did not arrive.
5. **A tuning value out of range makes the course unavailable** (`resolveCourseTuning` returns the problems). The generator never runs on a value the game would refuse.
6. **Only the 16 tunables the course reads are judged.** The checks judge all 35 (`tunableRange`); a bad survival tunable does not stop the Course view.

## Contract

```ts
// course-rng.ts
deriveSeed(seed: number, salt: number): number
createRng(seed: number): Rng            // nextUint32, nextFloat, nextInt(min, max) inclusive, nextRange(min, max)

// course-tuning.ts
type CourseTuning = Readonly<Record<CourseTunableName, number>>
resolveCourseTuning(courseTuning: Readonly<Record<string, number>>, context?: StageCheckContext): Result<CourseTuning, readonly TuningProblem[]>

// course-floors.ts
createCourse(seed: number, tuning: CourseTuning): Course   // { seed, floorCount, floors, bounds, deathLineY }

// course-demand.ts
bounceBudget(tuning): number
stepDemands(course, tuning): number[]

// stage-scenery.ts
resolveScenery(value: StageValue): Scenery
citySinkAt(scenery: Scenery, progress: number): number

// stage-compose.ts
composeStage(scenery: Scenery, state: ComposeState): Composition
```

## Steps

Each step starts with the failing test, confirms why it fails, then makes the minimal change. Hand mutation checks close the survivors, as in EDFF.1b.

- [x] **1. The generator's integer stream.** `course-rng.ts` against the goldens' `streams` and `derived` (written by the game's own `rng.ts`), the range of each draw, wrapping of negative and large seeds, independent streams per salt.
- [x] **2. Course tuning.** `course-tuning.ts`: defaults, the base layer under the stage's, each of the 16 names judged (range, whole number for `int`, NaN), one problem each, unknown names ignored, a custom declaration set.
- [x] **3. Generator and demand.** `course-floors.ts` and `course-demand.ts` equal `course-goldens.json` for nine cases (the three shipped seeds, a hundred floors across every ramp band, a steep ramp, other physics, seed 0, the largest 32-bit seed, a seed past 32 bits). FloorFifty's own demand values for 35229 (floor 1 ≈ 0.11, floor 7 ≈ 0.94, floor 19 ≈ 0.84), prefix stability, bounds, death line.
- [x] **4. Scenery.** `stage-scenery.ts`: defaults, the knots (finish lands at 1, a smaller value is held, phrases out of order), no course or no `citySink` gives no arc, `citySinkAt` is linear between knots, clamps, and is continuous.
- [x] **5. Composition.** `stage-compose.ts` equals `compose-goldens.json` for the four shipped stages at five climb states and four framings (20 frames each), with `toBe` on every `y`, `tileX`, the sun's `y`, the lift and the city's sink; drawing order and parallax factors; a tile layer, a plate, a drifting layer, snapping, the framing.
- [ ] **6. Gates and records.** Package tests, typecheck, Biome, `pnpm style`, knip, boundaries, `api-report`; spec §10.4 and §10.5 as built, 02 row, 03 paragraph, PROVENANCE; push, draft PR stacked on #154.

## Execution record

Implemented 2026-10-23 on `claude/project-thread-73sp69-edff1c`, test first in each step (a test file, a run that failed because the module did not exist, then the module), with the one exception named in step 2.

1. `course-rng.ts` (20 tests): equal to the game's streams and derived seeds for six salted and five plain seeds.
2. `course-tuning.ts` (12 tests). `tunableFault` came out of `check-tuning.ts` and `courseTopFloor`, which each had a copy of the range rule, into `tunables.ts` (4 tests). That one is a refactor of two copies the existing tests already covered, so its tests were written beside the extraction rather than seen failing first; nine mutations of it all fail.
3. `course-floors.ts` (26 tests) and `course-demand.ts` (15 tests): exact against the nine golden cases, and against the three hashes FloorFifty pinned before the ramp existed, which also fixes the key order of a floor.
4. `stage-scenery.ts` (20 tests).
5. `stage-compose.ts` (105 tests, 80 of them golden frames): every `y`, `tileX`, the light, the lift and the city's sink equal to what `StageLayers.update` computes.
6. Gates: package 1032 tests in 38 files, typecheck, Biome, `pnpm style` 0 findings, knip clean, boundaries 0.

Hand mutation checks (`mutate.py`, one change at a time, the file's tests must fail): 16 in the rng, 10 in the tuning, 9 in `tunableFault`, 31 in the course, 10 in the demand, 25 in the scenery, 44 in `composeStage`. Survivors that a test closed: `clamp-lo` and `span-guard` in `citySinkAt` (two tests), `frame-plate` in the framing (one test). Survivors left, each an equivalent mutant: the rng's `>>> 0` on a derived seed and on the state (the next `mix` does bit operations, so the same bits; the state would only lose precision after two million draws, and a floor draws three), the generator's `UINT32_SPAN` off by one and `<=` for `<` at the share (a difference of one draw in 2^32), the demand's `>`/`>=` at exactly half the screen (the sign goes away in `Math.abs`), `citySinkAt`'s final return (the last knot is at 1, so the loop always returns first), `framingSink`'s `Number.isFinite` (with no city strip the minimum is +∞ and `Math.max(0, x − ∞)` is already 0), and `composeStage`'s `drift >= 0` (adds 0).

### Deviations

- The generator is `course-floors.ts`, not `course.generator.ts`: `pnpm style` gives a `*.generator.ts` file the `defineContentGenerator` role.
- `knip.jsonc` lists `make-goldens.mjs` as an entry of `packages/editor-2d`; it is run by hand and nothing imports it.
- `stage-property.test.ts` (EDFF.1a) got a 60 s timeout on its 200-sequence tests: a full run of the package, beside other jobs, went over the default 5 s on Rooftops (10 s in `pnpm check`, about two seconds alone). The assertions are untouched.
- The first draft of spec §10.4 listed `x`, `alpha` and `visible` in the output; they are cut (the spec says why).

### Not done

- Not CI verified. Nothing here has a screen: the Compose canvas and the Course view are EDFF.2 and EDFF.3.
- The golden heights of the strips are chosen, not the shipped art's; the framing is exact for them, and for any other heights by the formula the tests pin.
- The sun's heat shimmer, haze baking, window codes and the race and music reactions are not previewed (plan scope).
