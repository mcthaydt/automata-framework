# 3D at the references' level: plan audit

- **What this is:** stage 3 of 6 for this area: the audit of the
  [spec](2026-11-09-3d-painted-look-spec.md) and [plan](2026-11-09-3d-painted-look-plan.md), 2026-11-09. Findings are
  fixed in place in both documents; this file says what was found, how it was checked, and what changed.
- **Checked against:** AF `0eb970be` (with the plan at `8ecdde65`, PR #570), `@pixi/3d` 0.1.0-beta.2 as vendored
  (`vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz`, read from its `dist/`), FigureBuilder `025ffb4`, EnvironmentBuilder
  `6d82a52`.
- **The Owner's fixed rulings, unchanged:** the painter is the only way a 3D figure is drawn and the mesh path is
  deleted; the field is 360; first person waits until after the end proof; the end proof is Ember Hall built in Levels
  3D at the references' level, reloaded and played.

## Verdicts on the three questions

**1. Do the alpha codes survive `@pixi/3d`'s forward pass and post chain?** Yes, with four rules the plan did not have
(P1 to P4). What holds: in composite mode (any `PostEffect`) the scene draws into a `sceneColor` transient in the view
target's own format (`toDescribe` in `core/render-graph/RenderGraph.mjs`: `source.format ?? "bgra8unorm"`), an 8-bit
target with no multisampling, so `160/255`, `192/255` and `224/255` are stored exactly. Opaque materials draw with
blending off (`stateFor3D`). A `PostEffect` passes alpha through when its fragment does (the snap returns `c.a`). The
letterbox holds the view at resolution 1 (`target-size.ts`), so a field pixel is a target pixel. What breaks without the
rules: the forward template premultiplies every material's output by its alpha, the last post pass is blended onto the
2D stage as premultiplied colour, blended pieces (the occluders' fade) leave alphas that are no code, and a raw-NDC quad
lands upside down on one of the two backends.

**2. Task 13: tiles baked in the browser at load.** Workable at load, not mid-game as written (P11), and not alike in
every engine as written (P9). The pipeline's `oklab` uses `Math.cbrt`, `** 2.4` and `Math.hypot`, which ECMAScript does
not pin; one ulp moves a Kuwahara variance compare, a k-means assignment or an accent threshold, and so a label. AF
already has deterministic fdlibm math (`@automata/sim/math`), which the 3D package imports today; the port uses it, and
the engines task hashes tiles as well as cells. Load: the spec's numbers are this container's (38 ms to prepare a photo,
11 to 58 ms a tile, single blocking runs); a phone is two to four times slower, and a view change or an editor zoom would
make tiles while frames are due. All of a level's views are prewarmed at load; new pairs later are made one a frame
behind the old tile; the load is measured under a 4× CPU throttle with a threshold that moves the bake to a worker.

**3. Can Task 6's soup match FigureBuilder's, given AF's own posing?** Not as the plan has it (P8): AF's `base()` removed
FigureBuilder's sprite cheats on purpose (`motion/base.ts`, header: "no sprite cheats (`lookUp`, `view`, `pitch` and the
walk-level neck correction that reads them)"), and `evaluate()` passes `headYaw: 0`. FigureBuilder's standing frames
pitch the head up by `face.camera × pitch × cos(view)` (0.6 × 18° for the base pair) and turn it by the lead, `faceTurn`
and `THREE_Q`; its walk adds the neck correction. So no standing frame can agree within 1e-5. With those inputs restored
to `MotionState` (presentation inputs, relative to the camera, as the cell key already is) it can: the base pair's
gaits (`loose`, `bounce`) have no twitch, so AF's idle-only twitch does not bite; a straight walk runs along its facing,
so AF's `moveDir` feet agree; the clock and the hair's swing are recorded per frame by the oracle and fed in. The hero
frame's hands come from FigureBuilder's `standOf` at openings, which AF's stands do not reproduce; its painting is still
held byte for byte through FigureBuilder's own soup (Task 5).

## Findings

| # | Finding | Evidence | Fixed in |
|---|---|---|---|
| P1 | The forward template writes `fragColor = vec4(finalColor * alpha, alpha)`: a material that writes the glowing code as its alpha draws its colour at 224/255 of itself. The composite pass, if blended, would mix a quarter of the world into every figure texel | `core/gl/shader/MaterialSystemGl.mjs` (`glFragmentTemplate`), `core/gpu/shader/MaterialSystemGpu.mjs`; `BaseMaterial3D` `stateFor3D` | Task 1 (a rule and a test), Task 14 |
| P2 | The last post pass draws onto the 2D stage with blending on, as premultiplied colour (`createOutputState`, used when an effect writes the default target). A pixel with alpha 0 and any colour adds that colour over the 2D sky; a ring of glow, a rain streak or a particle over the sky vanishes if the finish writes 0 there | `core/render-passes/output/outputPassUtils.mjs`, `post-processing/effects/FullscreenPass.mjs` (`_writes === null`) | Task 12 (the finish), Global Constraints |
| P3 | Blended pieces leave alphas that are no code: the occluders fade a wall by `alphaMode = 'blend'` and `alpha < 1` (`occluders.ts showAt`), giving `a + dst × (1 − a)` (a over the sky, between codes over a glowing pixel). Reading "within half a byte of a code" leaves those pixels unclassified | `packages/3d/src/features/camera/occluders/occluders.ts`; the world kit's `glass`, `glassDay`, `glassNight`, `carGlass` swatches | Task 1 (the reading rule), Task 12 |
| P4 | A pass that places quads in NDC itself must follow the backend's flip: the graph binds transients flipped differently on WebGL2 and WebGPU (`RenderGraph`'s `flipY`; `FullscreenPass` passes `!isWebGL` in `uFxTexel`). The plan's test cell would pass upside down if it were symmetric. And an `r32float` depth texture is `unfilterable-float` on WebGPU, which a plain `texture_2d<f32>` binding refuses without `float32-filterable` | `post-processing/effects/FullscreenPass.mjs` `_updateHeaderUniforms`; WebGPU's texture format table | Task 1 (interface and tests) |
| P5 | The scene is stored in 8 bits before the snap, and EnvironmentBuilder snaps from floats. Measured (200,000 texels of DUEL albedo × stepped light × haze, at a random Bayer cell): **3.79 %** pick a different DUEL colour when the colour is stored in 8 bits first, 0.37 % from a half-float target, 0.07 % from fp32 (values that sit on a rounding boundary). So the plan's "the material draws `worldTexel`'s colour at each pixel" and "`worldTexel` matches EnvironmentBuilder's shade" cannot both pass exactly | `/mnt/project-files/3d-look/scripts/snap-store-flips.ts` (this audit) | Tasks 8, 12, 14 |
| P6 | `toneMapping: 'none'` still encodes: `srgbEncodeBit` writes `pow(finalColor, 1/2.2)` at `{{end}}`, after the template's lighting in linear. A tile material built on the template would light and haze in a different space from EnvironmentBuilder (`colour.ts litColour` multiplies sRGB bytes) | `core/shader/bits/tonemapping/srgbEncodeBit.mjs`; EnvironmentBuilder `src/features/paint/colour.ts` | Task 14 |
| P7 | The OKLab snap test over a 17³ grid compares an fp32 shader with fp64 `nearestDuel`; where two DUEL colours are near-equally far the pick can differ for no fault. The shader must also linearise with the piecewise sRGB curve `nearestDuel` uses, not a power, and quantise as EnvironmentBuilder's `snap` does (`round((c + offset) × 255)`) before it picks | `packages/content/src/shared/palette/duel.ts`; EnvironmentBuilder `colour.ts snap` | Task 12 |
| P8 | Task 6's vertex test cannot pass: AF's posing has none of FigureBuilder's sprite cheats (`lookUp`, `view`, `pitch`, the walk's neck correction; `headYaw` is 0 in `evaluate`). The plan's `spriteCheats` returns only the head's yaw | AF `features/figures/motion/base.ts` (header), `motion-state.ts`, `clips/evaluate.ts` (`headYaw: 0`); FigureBuilder `figure/figure.ts motion()` (lines 251–270), `motion/motion.ts` (lines 438–439, 574–577) | Task 6 |
| P9 | The painter (48 calls to `Math.sin`, `cos`, `atan2`, `cbrt`, `pow`, `exp` or `hypot` in `paint/` and `figure.ts`, 112 uses of `**`) and the photo pipeline (`oklab`'s `Math.cbrt`, `** 2.4`, `Math.hypot`) depend on unpinned engine maths. The plan only investigates after a mismatch, and only for cells | FigureBuilder `src/features/paint/*.ts`; AF `shared/math/colour.ts`, `extensions/world-kit/src/features/textures/pipeline.ts`; `@automata/sim/math` (`packages/sim/src/shared/math/dmath.ts`) | Tasks 3, 5, 11 |
| P10 | `F13_FRAMES` names "base-m at density 2 at 25°", but every oracle frame is at the sheets' 18°. At 18° the audit saw the far eye dropped for base-f and base-m at density 1 | stage 1 audit F13; plan Task 2 step 3 | Task 5 |
| P11 | Tiles are made only for one camera (`DrawLevelInput.camera`), and `setCamera` makes new ones while frames are due: Ember Hall's views ease over 400 ms through every distance between, and an editor's zoom or orbit asks for a new pair at each √2 step. No load budget is named | `packages/3d/src/features/camera/angled-camera.ts` (`ease` 400 ms); spec 10 | Tasks 9, 13, 15, 20, 25 |
| P12 | Particles as cells through the composite pass, each with its own textures, is one draw and one bind a particle | plan Task 19, `PlacedCell` | Tasks 1, 19 |
| P13 | Unstated: the figure's shadow is drawn with a multiply blend, which writes alpha 1 (world), so the snap re-dithers the shadowed floor; and the composite runs after the transparent pass, so a faded occluder wall never covers a figure (the player stays seen through it). Both are right; neither was written down | `createDefaultGraph3D.mjs` (order of passes) | Task 9 |
| P14 | The spec's alpha codes (5.4) lack the sky's 160 the plan's Global Constraints have | spec 5.4, plan Global Constraints | spec 5.4 |

## What changed

- **Spec:** 4.6 (straight colour, blend off, the depth texture, the source rect), 5.4 (the codes with the sky, how they
  are read, premultiplication, the 8-bit store and how the oracles are held), 5.2 (all views prewarmed, a new pair
  behind the old tile), 10 (risks measured: the store, the engines' maths, the load under throttle).
- **Plan:** Global Constraints (codes and how they are read; the encode; deterministic maths); Task 1 (rules, interface,
  two more tests); Task 3 (`dmath` in the pipeline); Task 5 (`dmath` in the painter, `F13_FRAMES`); Task 6 (the sprite
  cheats come back to `MotionState`; the test at `evaluateMotion` with the oracle's recorded state, stand and walk);
  Task 2 (the oracle records each frame's motion state); Task 8, 12 and 14 (the snap rounds as EnvironmentBuilder's;
  the 8-bit store modelled; boundary cases listed, not hidden); Task 9 (the shadow's alpha, density and tiles follow
  the active view); Task 11 (tiles too); Task 13 (prewarm, background pairs, the throttled budget); Task 15 (every view);
  Task 19 (particles share an atlas); Task 20 (4× throttle); Task 25 (thumbnails made lazily).

## What this audit ran

- Read: the spec, plan and stage 1 audit; `@pixi/3d` 0.1.0-beta.2's render graph, default graph, pass, fullscreen
  effect, output pass, material templates, base material and tone-mapping bits; AF's look passes, snap, ramp material,
  target size, renderer mount, occluders, figure motion (`base.ts`, `motion-state.ts`, `evaluate.ts`), DUEL palette,
  `dmath`, the world kit's pipeline; FigureBuilder's `figure.ts`, `frames.ts`, `motion.ts`, `base/base.ts`, gaits;
  EnvironmentBuilder's `colour.ts`.
- Ran: the 8-bit-store experiment above (Node 24, 200,000 samples, seeded).
- Not run: no GPU, browser or engine runs; nothing was built. Each fix is a rule and a test the build stage runs first.
