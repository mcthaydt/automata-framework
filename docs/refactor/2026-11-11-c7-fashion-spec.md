# c7: FigureBuilder's look in AF, with depth, a wardrobe and a runway

Cycle c7-af. One cycle, one branch, two visual gates. The plan is
[`2026-11-11-c7-fashion-plan.md`](2026-11-11-c7-fashion-plan.md).

The Owner, 2026-11-11, relayed by the coordinator: "show me when you're think you're done, auto approve spec and
plans". So the spec and the plan are approved as written, the two visual gates are the coordinator's checkpoints and
not stops for the Owner, and the Owner sees the finished result.

## 1. Why

AF takes FigureBuilder (FB) in as a git submodule behind one door (#577). Today that door shows a painted figure, but
not as FB's own renders look: the cell is minified, it is painted at the camera's tilt, and it is a flat quad that
cannot stand behind a wall. FB's cycle c6 (FB #26) has since published a stage contract for hosts
(`vendor/FigureBuilder/docs/contract.md`, `STAGE_VERSION` 1) that settles each of those.

The Owner's decisions, which this spec does not reopen:

1. "We should use for AutomataFramework the same resolution we've been using for the FigureBuilder so far": D2, painted
   at a fixed 18° pitch whatever the camera's tilt (only the 8-way direction follows the camera), and crisp (each texel
   at `max(1, round(zoom))` whole pixels, never minified). The field size or the camera distance is the host's to choose
   so that this holds.
2. Billboards with per-texel depth, so figures hide behind walls and behind each other. FB's CPU painter stays the one
   source of the look; the live-mesh GPU painter was tried and rejected.
3. The character kit rebuilt on the door: the runway wardrobe, the fabrics and the demo characters' library, registered
   from the kit through FB's hooks (H1 garments, H2 outfit hooks, H3 hair pieces, H4 finishes, H5 fabrics) and kept out
   of FB's base. Fashion should be "a big thing".
4. A fashion example in AF: a runway with characters of different body types and outfits, walking, at FB's look.
5. EnvironmentBuilder's look work is moving into `packages/3d` on `claude/eb-look-baseline`. This cycle stays out of
   `packages/3d` unless it cannot be avoided (section 9 names the files).

## 2. What is there today (measured from the code)

- The door is `extensions/character-kit/src/features/painted/door.ts`: `BASE`, `Figure`, `member`, `standing` and three
  types from `figure-builder`. `paintedFigure(def)` paints at D2 and shows the cell on a `Sprite3D` turned to the camera
  by yaw and by the camera's own pitch (`figure-sprite.ts`, `camera.ts`).
- The submodule is at `08f54a6`. FB main was `1da8879` (c6) when this spec was written; it is now `d6e3c9f` (FB #27),
  which carries U1 and U2 (5.1). (Corrected at the plan audit.)
- `characterkit-painted` is 480 × 270 with the 24 mm lens (`fovOf(24)` is 53.13°, so the focal length is 270 px) and the
  default view 5 m back from a focus 1 m above the walker's feet, 25° down: 54 px a metre at the focus, and the feet are
  5.42 m deep, 49.8 px a metre. A D2 cell is 192 texels for 2.6 m, 73.85 texels a metre. So a D2 texel covers about
  0.73 px at the focus and 0.67 px at the feet: about 1.4 texels a pixel, minified. Derived here (the plan audit
  corrected the depth, which first used the focus's 5 m for the feet); gate 1 measures it from a render.
- A view factory's `update` runs before the camera driver moves the camera (`create-renderer.ts`, `mergeHooks(entities,
  cameraDriver, …)`), so a figure is placed by last frame's camera.
- AF's renderer asks for WebGL 2 unless a game sets `preference: 'webgpu'`.
- `@automata/character-kit`, `@automata/3d` and the examples are private: no changeset.

## 3. Goals, non-goals, anti-goals

**Goals.** In an AF scene a painted figure is FB's render: D2, 18°, crisp, with per-texel depth against AF's own
geometry and other figures. The kit carries the runway wardrobe, fabrics, library and cast. A runway example shows it,
with a journey. The gates hold before and after renders with texels a pixel measured, and the runway; the Owner sees the finished result.

**Non-goals.** Lighting painted figures from AF's lamps (the stage's `lighting` path); a WGSL depth bit (WebGPU);
retiring AF's procedural mesh figures or the kit's garments, hair and seats for them (they stay as they are; whether
they go is a later question for the Owner); a wardrobe editor; the EnvironmentBuilder look on the runway's set.

**Anti-goals.** A second painter or a restated look in AF. A patch to the vendored copy. Content added to FB's base. A
hash or golden re-recorded to make a suite pass. A build that contains `@pixi/3d` published or deployed.

## 4. Approaches

**What the door shows the cell on.** Three ways:

| | Way | Trade |
|---|---|---|
| A | FB's `StageView` whole | Proven byte for byte against `compose`, but it owns its own `View3D` and camera, so its depth buffer is not the one AF's walls are in. It cannot do decision 2 in an AF scene. Rejected |
| B | FB's `CellSprite` (with depth) inside AF's `View3D`, placed by the kit from the contract's rule | One depth shader and one upload path, FB's. The kit writes the placement (about 40 lines) because AF's figures are sim entities, not FB's `ScriptedActor`s, which `stageFrame` needs. **Chosen** |
| C | AF's own `Sprite3D` with its own depth bit | A second copy of the shader and the tie rule to keep in step with FB. Worth it only for WebGPU, which AF does not ask for by default. Rejected for now |

With B, the kit's placement is held to FB by a parity test, not by trust: the same figure at the same place under the
same pose through FB's own `stageFrame` and `compose` must give the kit's frame, pixel for pixel.

**How the 1:1 rule is met.** The contract's crisp rule draws a D2 texel at `max(1, round(zoom / 2))` px, so no texel is
ever minified; what the host chooses is how far the figure is from true scale. Two cameras:

- *Perspective (AF's follow rig)*: `characterkit-painted` goes to 640 × 360 (focal length 360 px, 72 px a metre at the
  focus 5 m away, 0.975 px a texel; 66.4 px a metre at the feet 5.42 m deep, 0.90 px a texel): 1 px a texel, about 11%
  over true scale at the feet (480 × 270 would be about 48% over). The rule holds in the field's own pixels; the
  letterbox then scales the whole field to the screen (Pixel 7 landscape is 863 × 360 CSS px, iPhone 14 landscape
  750 × 340), so the phones do not both show it at ×1. (Both corrected at the plan audit.)
- *Orthographic at the painter's pitch (the runway)*: 73.846 px a metre exactly (`pixelsPerMetre = 192 / 2.6`, a whole
  zoom of 2), tilted 18°. This is the projection the cells are painted for, so the runway is FB's render exactly, and
  depth is exact, not "right to a few millimetres". 640 × 360 shows 8.67 m × 4.88 m. The example sets `view.camera`
  itself in its `scene` callback, which needs nothing from `packages/3d`.

## 5. The design

### 5.1 The submodule and the door

- Bump `vendor/FigureBuilder` to FB main at `d6e3c9f` (FB #27) or later, which includes the upstream asks below.
- The door moves to `extensions/character-kit/src/shared/figure-builder/` so that both features (`painted`, `fashion`)
  may import it. Two files: `door.ts` (FB's `src/index` and `src/kit`: no Pixi, safe in Node) and `door-view.ts` (FB's
  `src/view`: `CellSprite`). `tests/unit/shared/door.test.ts` holds them the only importers of `figure-builder`.
- The door adds, from `index`: `SPRITE_PITCH`, `cellOf`, `type Cell`, `type CameraPose`, `project`, `viewOf`, `zoomOf`,
  `texelDepths`, `stageFrame`, `compose`, `STAGE_VERSION`, `TIE_BIAS`, `ScriptedActor` (the last four for the parity
  test and the rule), `POSES`, `GAITS`, `SWATCHES`, `HAIR_STYLES`, the five `register*` hooks and their types. From
  `kit`: what the wardrobe builds with. From `view`: `CellSprite`.
- A unit test asserts `STAGE_VERSION === 1`: a breaking bump of the contract fails here first, by name.

**Upstream asks (FB, one small additive PR, no `STAGE_VERSION` bump; merged as FB #27, `d6e3c9f`).**

- U1: `TIE_BIAS` on `src/index` (it is on `stage.ts` only; a host that depth-tests its own quads needs it).
- U2: `src/kit` adds `GROUP`, `weights`, `qmul`, `smooth` and the types `Limb`, `Ring`: the runway wardrobe imports
  them from `src/features/body/parts` and `src/lib/math` today, which a door may not.

U1 and U2 are on FB main (`d6e3c9f`), so the bump does not wait; nothing is deep-imported and nothing is copied.

### 5.2 The resolution rule and the placement

A new pure module, `painted/place.ts`, is the contract's section 2 for one figure:

```
pose      = poseOf(camera, [w, h])        // AF's Camera3D → FB's CameraPose (perspective f, or pixelsPerMetre)
[ax, ay, d] = project(pose, at)           // skipped if perspective and d < 0.1
scale     = max(1, round(zoomOf(pose, at) / 2))            // D2, crisp
view      = { azimuth: viewOf(pose, at).azimuth, pitch: SPRITE_PITCH }
screen    = round([ax − scale·anchor.x, ay − scale·anchor.y])
quad      : square to the image plane (the pose's right and up), at eye + d·fwd, offset so the anchor texel lands on
            screen + scale·anchor; pixelSize = scale · k, k = d / f (perspective) or 1 / pixelsPerMetre
```

"A pixel" is a pixel of the `View3D`'s target: the game's `size` when it is letterboxed (both examples are).

`paintedFigure(def, options)` keeps its name and place in `views`. Its options: `density` (2 by default; 1 or 4 as
asked), `state` (now `{ moving: boolean; pose?: string; outfit?: string }`: `pose` names one of FB's `POSES`, `outfit`
one of the character's outfits), `now`. The old yaw-and-pitch facing (`figure-sprite.ts`, `camera.ts`) is deleted.

### 5.3 Per-texel depth

`painted/painted-stage.ts`: one stage per camera (found by the `Camera3D` the factory is handed, so the game writes
nothing new). Each frame, after the camera has moved and before the view draws, it:

1. places every painted figure (5.2) and sorts them far to near, ties by creation order;
2. shows each cell on a `CellSprite` made with depth, and calls `showDepths(texelDepths(pose, sprite), perspective,
   P[10], P[14], (rank + 1) · TIE_BIAS)` with the camera's own projection `P`;
3. hides a figure behind the camera.

So AF's meshes and the figures share one depth buffer and FB's rule: strictly nearer wins, a tie goes to the later
figure, a figure wins a tie with geometry.

- **When it runs.** In the last hook before the `View3D` renders, so the placement uses this frame's camera. The plan's
  first choice is a render callback on the stage's own node; section 9 names the fallback.
- **WebGPU.** Under a renderer that is not WebGL the stage warns once, in words, and the figures depth-test as flat
  quads at their roots (FB's known limit). AF's default is WebGL 2, so no game meets this unasked.
- **Depth range.** The bias is a millimetre a rank, so the camera's near and far must keep the depth step under a
  millimetre where figures stand. The examples' cameras are checked for it in a test (24-bit depth).

### 5.4 The kit's fashion

A new feature, `extensions/character-kit/src/features/fashion/`, ported from FB's showcase branches
(`claude/runway-video` `cb4aa9f`: `demo/runway/{wardrobe,library,characters}.ts`; `claude/demo-characters` `8fb0242`:
`demo/{library,characters}.ts`) onto FB main through the door:

| File | Holds | Hook |
|---|---|---|
| `fabrics.ts` | the 7 fabrics | H5 `registerFabric` |
| `garments.ts`, `shells.ts` | the 9 garment kinds (`tee`, `hoodie`, `jacket`, `coat`, `skirt`, `dress`, `jeans`, `trousers`, `shoes`) and the body-fitted shells they share | H1 `registerGarment` |
| `swatches.ts` | the wardrobe's, skin, hair and lip swatches | merged into `SWATCHES` |
| `hair.ts` | the `silk` finish and the hair styles | H4 `registerFinish`; `HAIR_STYLES`; H3 `registerHairPiece` for any piece main lacks |
| `cast.ts` | the eight runway models (MARA, DRE, JUNE, THEO, EDITH, SAM, NIA, OTTO) and the seven demo characters, as data | none |
| `register-fashion.ts` | registers all of the above once | the side-effect file |

- `registerGarment` throws on a second registration, so `registerFashion()` is guarded and safe to call twice; the kit's
  extension calls it.
- H2 (`registerOutfitHooks`) and H3 are used where the ported content needs them and not otherwise: a hook is not
  exercised with invented content. The showcase branches were cut from an older FB main, so the port is checked: every
  runway outfit on the slider extremes (thin, heavy, muscular, curvy, short) builds and paints with no skin showing
  through cloth, as the showcase's `fit-check` did.
- The kit's entry exports `RUNWAY_CAST`, `DEMO_CAST`, `registerFashion` and `paintedFigure`. The beats, the song and the
  video compositor stay on FB's branch.

### 5.5 The runway example

`examples/3d/characterkit/characterkit-runway.ts`, id `characterkit-runway`, 640 × 360, the orthographic camera of
section 4.

- **The set**: a runway toward the camera, a back wall with a doorway the models come through (so each is seen passing
  behind the wall's edge, texel by texel), a dark floor. AF boxes; no look pass.
- **The show**: the sim owns it. The eight models walk one after another from the doorway to the runway's end, hold
  their own hero stand, turn and walk back; the next sets off as one turns, so two pass each other on the runway (an
  arm in front of the other's body). It loops. Positions come from the tick, as `characterkit-painted`'s walker does.
- **Words**: the model on the runway is named on screen ("MARA"), and the canvas carries `data-model` and
  `data-stage` (`walking`, `standing`, `returning`) for the journey. No controls.
- **Journey** (`examples/3d/tests/e2e/characterkit-runway.test.ts`, Chromium and WebKit): it plays under the CSP on
  WebGL; a model's name is shown; the runway's column of the canvas holds the painter's many colours; `data-model`
  changes to the second model; no page errors. 120 s a test.
- **Time**: FB paints on the CPU and caches cells. The example's first loop paints every walk cell once; the plan
  measures the paint time a cell and the frame time with the most walkers at once (two, by this schedule; corrected
  at the plan audit from three), and the gate reports both. If a frame goes over
  budget on the journey phones, the fix is fewer models walking at once, never a lower density.

### 5.6 The gates

- **Gate 1, after the resolution and depth work.** `characterkit-painted` before (the branch's base) and after, at the
  same sim tick, as PNGs at ×4 nearest, with texels a pixel measured from each render (the figure's height in pixels
  against its cell's rows), beside FB's own render of the same figure and direction. And a depth sheet: a figure cut by a
  wall, two overlapping figures. The coordinator checks it before the fashion work goes on.
- **Gate 2, the runway.** Stills of each model at the runway's end, a pass of two models, the doorway, and a short
  capture of the loop; the measured paint and frame times.

Both are artifacts in the pull request (`docs/refactor/c7/`), made by a script, never by hand.

## 6. Checks

| What | Proved by |
|---|---|
| The door is the only importer | unit: `door.test.ts` |
| Placement equals FB's rule | unit: the kit's place for a figure equals `stageFrame`'s sprite (`screen`, `scale`, `depth`) for a `ScriptedActor` at the same place, perspective and orthographic |
| The GPU frame equals `compose` | browser (Chromium, WebKit): the renderer's readback of one figure, of two overlapping, and of a figure cut by an AF box, equals `compose(frame, backdrop)` pixel for pixel away from crossing lines |
| 1:1 or more | browser: in both examples no figure's `scale` is under 1 and the readback's figure height is `scale ×` its cell's rows |
| 18° whatever the tilt | unit: a camera at 25°, 40° and 60° gives `Cell.pitch === SPRITE_PITCH` and the same cell |
| This frame's camera | browser: move the camera, render once, the readback equals `compose` for the new pose |
| The wardrobe fits | unit: every runway outfit on the slider extremes builds and paints; a registered kind twice does not throw through `registerFashion` |
| The runway plays | journey, Chromium and WebKit |

Firefox has no headless WebGL here; the GPU runner covers it, and it is reported as pending until it has.

## 7. Constraints

- The laws in `AGENTS.md`: the sim owns positions and the show's clock; the painter is presentation and decides nothing.
- `@pixi/3d` is a private beta: nothing built from this cycle is published or deployed.
- No changeset: every package touched is private. If a published package must change, a `patch` changeset goes with it.
- CI: journeys 120 s a test, build-and-serve servers 180 s, the 3D job 30 minutes; a tap sends down and up in one task;
  the private submodule is fetched with `SUBMODULES_TOKEN` in its own step. Affected suites run locally in Chromium and
  WebKit before every push.
- Known and not this cycle's: the WebKit `look-pixel-art` feedback-loop error (its own issue); `pnpm api-index` failing
  on main for three undocumented exports.

## 8. Calls made here (the Owner may overrule any)

1. `CellSprite` in AF's view, placement in the kit, held by a parity test (approach B).
2. `characterkit-painted` goes from 480 × 270 to 640 × 360; the lens and the view stay.
3. The runway is orthographic at 18° and 73.846 px a metre, so it is exactly FB's render.
4. AF's mesh figures and the kit's older garments, hair and seats are left alone this cycle.
5. Painted figures are not lit by AF's lamps this cycle: they carry the painter's own key light.
6. H2 and H3 are used only where the ported content needs them.
7. The door moves to `src/shared/figure-builder/` and becomes two files, one of them free of Pixi.
8. Two upstream asks to FB (U1, U2) before the bump: both merged as FB #27 (`d6e3c9f`).

## 9. `packages/3d`: the files that may be touched

None by design. Two only if the plan's first choice fails, to be cleared with EnvironmentBuilder's coordinator before
they are edited:

- `packages/3d/src/app/create-renderer.ts`: the order of the draw hooks (`mergeHooks(entities, cameraDriver, …)`), if
  no render callback inside the view lets the stage place figures after the camera has moved.
- `packages/3d/src/shared/render/views/view-3d.ts`: the factory's arguments, if the stage needs the `View3D` and cannot
  reach it from the camera it is handed.

## 10. Left to the builder

The names inside files; how the runway's timing is written as ticks; the gate script's layout; the exact near and far
of the runway's camera, within the millimetre rule.
