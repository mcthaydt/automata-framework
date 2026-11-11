# c8-lit plan audit

The audit of [the c8-lit plan](2026-11-11-c8-lit-plan.md) against [its spec](2026-11-11-c8-lit-spec.md), AF's code,
FigureBuilder (FB) and EnvironmentBuilder (EB). 2026-11-11, on `claude/c8-lit-spec` at `775f25de`. The Owner approved
the spec and plan ahead, so the audit checks them for correctness against the code and leaves the decisions alone.

**Result: 4 blocking, 10 should-fix, 9 nice-to-have. All are fixed in the plan.** The spec was changed only where it was
factually wrong (sections 1, 3, 4b, 5a, 5b, 7, 9 and 11), and each change is marked "corrected at the plan audit".

Read: AF `main` `5d7f40d3` (this branch's base), FB `main` `d6e3c9f` (the pinned submodule, cloned read-only), FB's
showcase commit `cb4aa9f`, EB `main` `f7c5356`, and `@pixi/3d` 0.1.0-beta.2 as installed. The FB submodule was
initialised from a local clone. Every scratch edit to it was reverted, and the tree is clean.

## The arm64 flip, measured

Each script below ran under `tsx` in `extensions/character-kit` on Linux x64, Node 22.23.4. They live in the session's
scratchpad and are not committed. The nudge moves `Math.sin` and `Math.cos` one unit in the last place, up or down or
not at all, by a seeded 32-bit LCG.

| What | Result |
|---|---|
| `nia` on `thin`, direction 0, plain | `71301072…`, the golden's x64 md5 |
| The same, nudged, seeds 1 to 40 | 25 give `71301072…`, 15 give `259c7a37…` (the Macs'). The spec's 16 of 40 used another generator; the finding holds |
| A plain run against a flipping seed: the vertex soup | Positions and depths are **bit-identical**. 190 vertices have their normal **negated** (`n` to `−n`), all at one point each (a ring pinched to a point) |
| The same: the supersampled G-buffer | Part and depth are identical at every sample; only the interpolated normal changes. No other triangle wins any sample |
| The spec's raster rule (quantised depth, the camera-facing face wins a tie within a part), applied | Plain md5 unchanged (`71301072…`); still 15 of 40 seeds give `259c7a37…`. **The rule does not touch the flip** |
| Where the negated normals come from | `grid()` in FB `src/features/hair/hair.ts` (line 85), `if (dot(n, sub(p, inner(i))) < 0) n = scale(n, -1)`. On `nia`/`thin` 880 vertices have that dot under 1e-9: 700 poles sit exactly on `inner(i)`, 180 are 1e-10 to 1e-9 off it, so the sign is rounding. `limb()` and `superquadric()` were instrumented too and have none |
| Fix A: a pole within 1e-6 m of `inner(i)` is oriented by the next row's outward direction (`i === 0 ? 1 : i − 1`, as the function's own `dv` fallback picks) | Plain x64 now paints `259c7a37…`, the Macs' md5; 40 of 40 seeds agree |
| Fix A over the whole runway golden | 42 of 112 cells move (1 to 26 texels each, all in the hair's rows); 0 of 112 unstable under 4 seeds. Today, 0 move and **5 are unstable** under 4 seeds: `june/3`, `june/muscular/5`, `june/curvy/5`, `nia/0`, `nia/thin/0` |
| Fix B: at such a pole, keep the cross product's own sign | 8 of 112 runway cells move, `nia/thin/0` to a third picture (`894992ce…`); 0 unstable |
| Fix D: the same with 1e-12 | No effect: the noisy poles are 1e-10 to 1e-9 off |
| FB `npm test` at `d6e3c9f` (AF's `vitest` 5.0.3) | 43 files, 536 tests pass |
| FB `npm test` with fix A | **10 fail**: `base`, `lit`, `actors` and `sprites` (`base-f-D1`, `base-f-D2`) goldens, `identity.test.ts` "lamps: base-f, direction 0", and `sheets.test.ts` (3 cases that read the goldens). Only `base-f` moves |
| FB `npm test` with fix B | **4 fail**: `lit`, `actors` (`base-f`), identity "lamps: base-f, direction 4", and `sheets.test.ts`'s lit case |
| The base pair under the nudge, today and with fix B | Stable both ways (16 cells, 8 seeds): base-f's goldens move because the rule re-decides its rounding-sized poles, not because they flip by arch today |

Measured for the light: a DUEL step is ×1.172 in the peak sRGB channel and ×1.488 in luminance at the median of steps 1
to 7 of the 32 rows (the spec's numbers hold), and the 256 ramp colours are distinct, so `onRow` is exact. `lightFigure`
for eight D2 base-pair figures walking with three lamps took 6.00 ms a frame at the median and 13.83 ms at the worst
(the spec's 9.18 ms used other lamps; the same order). `cellOf` for the eight took 1.34 ms.

## Blocking

**B1. The arm64 flip's owner is the hair's pole normals, not `rasterize`.** Spec section 7a traced the flip to a depth
tie between two faces of one part. The measurements above show no tie: the positions and depths are bit-identical, and
the same triangles win every sample. What changes is the sign of vertex normals at hair-grid poles, which `grid()`
takes from the dot of the normal with an offset of 0 to 1e-9 m. The planned raster rule was applied and changes nothing.
Fixed: spec section 7 corrected. Task F1 now changes `grid()` in `src/features/hair/hair.ts`. Its unit test is on
`grid()`: a pinched row 1e-10 m to either side of its inner point, both signs, the normal agreeing with the next row's.
`raster.ts` is left alone.

**B2. Any arch-stable rule moves FB's base-f goldens, and the plan said stop if one moves.** With fix A, all four
goldens, an identity md5 that `CLAUDE.md` says c5-finish must never move, and the sheets check fail. Fix B fails four.
The base pair's hair has rounding-sized poles too, and a rule that decides them by anything but the sign of the noise
paints some of them differently from x64's answer today. So Task F1 could never pass its own Step 4. Fixed: the plan
predicts the move (base-f only; base-m unchanged) and routes it through a stop. The executor shows the coordinator the
expected, actual and diff images, and re-records only on the coordinator's ruling, in one named commit (FB `CLAUDE.md`'s
rule). Identity's md5 is named in that ruling. The Global Constraint now says base-m and every other FB test must not
move.

**B3. `SceneLight.tint` has no sun and no fill, and is not stepped.** `tintInto` (`vertex-light.ts`) is the ambient plus
each lamp at its level, with occluders, capped at 1.6 (`LIGHT_CEILING`). The sun and the fill are in the content
(`SceneLight.lighting.sun`, `.fill`) and in the static bake, not in `tint`. So by day a painted figure would get no
direction at all: no form, no rim. Spec sections 3 and 5b said otherwise. Fixed:
- the spec is corrected.
- `roomLight` (Task A3) adds the sun as one more lamp, read from `light.lighting.sun` when present: its `dir` turned by
  Ry(−azimuth), its strength `level × peak(colour)`. The flat light and the ring stay `tint`'s, so the exposure compares
  like with like.
- The sun's occlusion is not public (`segmentBlocked` is not exported, and a new export is out of bounds), so a figure
  in shadow by day still takes the sun's form. That is a new risk in spec section 11, and the gate judges it.
- The fill has no direction and is left out, as the mesh figures' `characterTint` leaves it out.

**B4. Task A2's acceptance rule could never be met, and its count was wrong.** It accepted a moved runway cell only
"where two faces of one part met". With fix A, 42 cells move, all in the hair. Fixed: a cell is acceptable when every
differing texel is the hair's (its material in the figure's G-buffer is the hair's) and, at each, the new texel is no
darker than the same hair's texels beside it (a pole no longer faces in). The plan predicts about 42 cells, and that `nia/thin/0` becomes `259c7a37…`, so the Macs'
recorded md5 becomes everyone's.

## Should-fix

**S1. A lit-cache hit returned a stale `Cell`.** A `Cell`'s `painted`, `normals`, `depth`, `weave`, `anchor` and
`direction` are the figure's own, valid until its next draw. A stored cell keeps the miss frame's. Fixed: the cache
stores only the lit buffer and its key. Every call builds `{ ...unlit, rgba: lit, key: litKey }` from this frame's
`cellOf(figure)`, which the painter computes anyway, so a hit costs no hash and is always fresh.

**S2. The cache key did not determine the bytes.** The key held the tint's amount in eighths, not its colour. Two warm
lights of different hues could share a key, and `lightSprite` was called with the unquantised light. Fixed:
- `roomLight` builds `lighting` from the quantised values only: the flat light's peak in steps, its colour in sixteenths
  a channel, the direction in sixteenths and the strength in tenths.
- The key prints exactly those.
- A new test checks that two rooms giving one key give byte-equal `lightSprite` output.

**S3. The budget's bench measured the wrong thing and missed the worst case.**
- The painter already hashes the unlit cell every frame (1.34 ms for eight, measured). Timing `litCells().lit` counted
  that hash against the light's 2 ms.
- The bench walked through steady light only, but the worst frame is one where every figure relights at once: a lamp
  switched, a level change on a flickering lamp, or the time crossing a step. `lightFigure` alone took up to 13.83 ms
  for eight, so 6 ms is at risk.
- `vitest run tests/bench/…` finds no file without `AF_BENCH=1`: the preset adds the `bench` project only then.

Fixed: the bench times the increment over the unlit path, runs three scenarios (a steady walk, a lamp switched at frame
300, and a lamp whose level steps every 1/12 s), reports each, and runs with `AF_BENCH=1`. A miss still stops at the
checkpoint (spec section 5c); no staggering of relights, which would be lighting fewer frames.

**S4. Task F4 Step 1 was a reading exercise, not a check that could stop early.** Read in the installed beta:
- `MaterialSystemGpu.ensureMaterial` compiles the main pass from `materialDescriptor.template ?? template`, so a
  `FlatMaterial` subclass whose `getPrimaryDescriptor()` returns a `ShaderDescriptor` with `template` is a public seam.
- The default WGSL template (`gpuTemplate`) is module-internal, so FB must carry a copy.
- The shader cache key is built from bit names and **never includes the template**. The custom template must always
  travel with `cellDepthBit`, whose name keeps the key apart.

Fixed:
- Step 1 is now a pixel spike: the copied template with a constant `frag_depth` of 1.0, under WebGPU, behind a box. The
  box must show through the quad. If the template does not compile, the device reports an error, or the quad still
  covers the box, stop.
- A Node test in FB reads the installed `MaterialSystemGpu.mjs` and asserts the copy equals `gpuTemplate` except for the
  fragment entry, so an `@pixi/3d` upgrade fails loudly.
- The z convention under WebGPU is decided by a view-check readback, not by a Node test, which cannot see what the
  renderer does with the matrix.

**S5. The #602 check could not see #602.** `git log origin/main --oneline | grep -i "present pass"` matches a commit
subject, and a merge's subject is "Merge pull request #602 from …". #602 is open, not draft, and carries #587. Fixed:
`git merge-base --is-ancestor origin/claude/fix-scene-depth-hazard origin/main`, or the PR's merged state. The plan
says #587 comes with it.

**S6. CI on the Macs, and pushes.** The `checks` job runs where `vars.AF_CHECKS_RUNNER || 'af-mac'` says. A green run
on x64 proves nothing about arm64. Every push to a branch cancels its runs in flight (`cancel-in-progress`, #594).
Fixed:
- Task A2 Step 6 reads the job's runner and `process.arch` from its log before ticking.
- The plan has a push rule: one push per CI round, and no push while a run on the branch is in progress unless the
  coordinator says so.
- The known reds (#592 WebKit look e2e, #593 3D parity on `af-mac`, #594 capacity) are named as not this cycle's, and
  are reported, never re-run to green.

**S7. Task A2 missed a file and a prerequisite.**
- `tests/unit/fashion/runway-golden.test.ts` pins `ARCH_OVERRIDES` and `expectedFitMd5(…, 'arm64')` (lines 16 to 48),
  and it was not in the task's files.
- The re-record reads `cb4aa9f`, which a fresh FB clone does not have.

Fixed: the file is listed and its override cases are deleted with the override. Step 3 fetches
`claude/runway-video` first.

**S8. The nudge tests were too slow for the gates.** At about 0.27 s a paint, 8 seeds over the 80 fit cells is about
3.3 min in AF's unit suite, on a Mac `checks` job already at its limit (#594). FB's 40 seeds over 32 base-pair paints is
about 5 min against a 3-minute suite. Fixed:
- AF's unit test runs the five cells unstable today, 8 seeds each (about 11 s). The full sweep is in `tests/slow/`, run
  by hand and logged.
- FB's test is the `grid()` unit case plus the base pair at 8 seeds, standing only.

**S9. `hookTimeout` is already set.** `defineTests` gives every browser project `hookTimeout: 90_000`
(`BROWSER_HOOK_TIMEOUT_MS`, from #577), so Task A5 no longer edits `vitest.config.ts`.

**S10. Task F2 named files that do not exist, and missed one.** There is no `tests/features/lighting/` in FB. The fabric
fixtures are `tests/features/paint/fabric-fixtures.ts`. `npm run lit` gaining a `sprite` row edits `scripts/lit.ts`,
which was not in the task's files. Fixed.

## Nice-to-have

**N1.** The LCG in JavaScript: `s = (Math.imul(s, 1664525) + 1013904223) >>> 0`. Plain arithmetic loses the low bits.
Stated in Task F1.

**N2.** FB's contract states `stageFrame`'s options in section 2 (line 56) as well as section 3. Both gain `sprite?`.
Task F5.

**N3.** EB's flat light floors each lamp's mean N·L at 0.5 (`SPRITE_STYLE.floor`); AF's no-normal `tint` is the
lamp's full falloff, so AF's figures may read a step brighter under a pendant than EB's. Not a change. A gate line
compares them.

**N4.** EB never steps a texel whose peak channel is 40 or less (the eyes). The spec's rule 1 steps `0x222323` (row 0,
step 1). A gate line checks the eyes. The spec's "this is `lightFigure`'s floor rule" is loose: `lightFigure` moves a
step-0 texel up under a positive shift; the hold on step 0 is `tiled`'s. Corrected in the spec's rule 1 wording only.

**N5.** EB's door imports FB too. When EB moves its pin past the hair fix, its painted figures with hair move by the same
rule. Task F5 tells the coordinator.

**N6.** `gate lit` writes through `gateWrite`, which reads `C7_GATE_OUT`. The plan names the variable it sets.

**N7.** The room in the tests and the bench was "the base interior's content". It is now
`buildWorld(BASE_SCENES['base-interior'], baseLibrary, { night: true })` under `timeOfDay('lampLit')`, all public on
`@automata/3d` (and `@automata/3d/base`).

**N8.** A lit cell depends on `normals`, which the painted cell's key does not cover. The same colours with different
normals are not expected in practice (the same picture is the same pose), and the plan says so instead of hashing the
normals every frame.

**N9.** Spec section 11's raster risk is replaced by the hair rule's, and the sun's occlusion is added (B3).

## Verified

- `SceneLight.tint(x, y, z, normal?, out?)` exists on `main` (`packages/3d/src/shared/render/light/scene-light.ts`),
  and the renderer passes the `SceneLight` as a view factory's fourth argument when it has `lighting`.
- `SceneLight`, `createSceneLight`, `worldLighting`, `buildWorld`, `levelTime`, `timeOfDay`, `sceneLightingSchema` and
  `SceneLighting` are public on `@automata/3d`, and `BASE_SCENES` and `baseLibrary` are public on `@automata/3d/base`.
  So the chest, six direction and four floor probes, and the sun, come from AF's baked light with nothing in
  `packages/3d` or the look passes touched.
- `painted-view.ts` names the light `_light` and never reads it. `painted-stage.ts` warns once with `NOT_WEBGL`.
  `painter.ts` calls `cellOf` every frame.
- The haze's share is 0 before `near` past the focus (`hazeShare`), so Task A4's near figure is unveiled.
- FB's layer rule allows `lighting/sprite.ts` to import `paint/` and `lib/`, and `stage/` to import `lighting/`.
  `stage.ts` has `turned`. `docs/contract.md` has sections 3, 4b and 7 as the plan names them. `STAGE_VERSION` is 1.
- `cellOf` hashes the colour with FNV-1a and copies nothing.
- The runway golden is 112 md5s, and all 112 match on x64 at `d6e3c9f`.
- FB captures no `Math` function at import, so the nudge reaches all of it.
- The checks job runs on `af-mac` as of 2026-11-09.
- #592, #593 and #594 are open and not this cycle's. #602 is open and not merged.

## Not verified

- **Anything on arm64.** There is no Mac here. That fix A gives the Macs' md5 on x64 is strong evidence, and the Macs'
  `checks` job is still the proof.
- **WebGPU.** No browser ran. The template seam and the cache-key hazard were read in the beta's source, not exercised.
  `prepareCamera`'s WebGPU branch was not traced, so the z convention is left to Task F4's readback.
- **`lightSprite`'s cost**, because it does not exist yet. The budget's plausibility rests on `lightFigure`, measured.
- **FB's goldens under the dropped raster rule**: not run, because the rule does not fix the flip.
- The gate pictures, the browser suites and `pnpm check`. This audit changed docs only.

Ran: `pnpm install`; FB's `vitest run` four times (as is: 43 files, 536 tests pass; fix A: 10 fail; fix B: 4 fail; the
no-op 1e-12 variant: all pass); the scratch scripts above; `pnpm format`.
