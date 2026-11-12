# The stage contract

What a scene needs to draw a painted figure of `@automata/figures`, as a versioned public surface. `STAGE_VERSION` is **1**.
The package is private and unpublished, so the contract's version is `STAGE_VERSION` alone; it began as FigureBuilder's, and
the changelog (section 7) keeps its history. The rules of the package as a whole are in `../README.md`.

## 1. What it is, and who consumes it

The look is made by its CPU painter: the supersampled G-buffer, the key light cut into each swatch's ramp,
the ink outline, the colour budget, whole-step lighting. A scene on the GPU must show that look unchanged, so the
painter is the single source of truth and a scene draws its **cells**: it never redraws a figure as a lit mesh.

The consumer is the character kit's door, in this repository: `extensions/character-kit/src/shared/figures/door.ts`, the one
place that imports the package (the kit's door test and `pnpm boundaries` keep it so). A door imports three entries and
nothing deeper:

| Entry | What it gives |
|---|---|
| `src/entries/index.ts` | Figures, actors, lighting, and the stage below |
| `src/entries/kit.ts` | The painter's toolkit (section 5) |
| `src/entries/view.ts` | The Pixi 3D view (`CellSprite`, `StageView`, `FigureSprite`): the only entry that loads Pixi |

The package owns no camera: the host drives its camera and passes a `CameraPose` in. A pose is read,
never changed.

## 2. The types

All lengths are metres, all angles radians, screen pixels y down.

**`Cell`**: a painted figure as a scene draws it. Every buffer is the figure's own, valid until its next draw (a consumer
that keeps a frame copies).

| Field | Meaning |
|---|---|
| `key` | `<w>x<h>:<hash of rgba>`: changes whenever `rgba` may have, so it keys a texture of the colours (the view's upload). It does **not** cover `painted`, `normals`, `depth` or `weave`: a consumer that caches one of those (a GPU light's normal map) reads it fresh each frame or keys it by its own hash. A 32-bit hash: a long-lived cache can in principle collide |
| `size` | `[w, h]` texels |
| `rgba` | RGBA, alpha 0 or 255 only, an empty texel 0,0,0,0: the painter's cell, or the lit cell when the stage lit it |
| `painted` | The unlit painted cell (the same buffer as `rgba` when the stage did not light it) |
| `normals` | The normal map (`lightFigure`'s `LitSource.normals`): view space, alpha 0 where none |
| `depth` | Metres toward the camera from the root's plane, per texel, along the pitch the cell was painted at. **Always present** (`Figure.depth`, restored from the cell cache with `painted` and `normals`, so a cache hit gives the bytes a fresh drawing does): the G-buffer's depth where a surface is, the nearest neighbour's under an outline texel, finite wherever `rgba`'s alpha is set and `-Infinity` elsewhere |
| `weave` | The fabric data (H5), or null |
| `anchor` | The texel the figure's root on the ground maps to: `[w / 2, h − feet]` |
| `metresPerTexel`, `density`, `direction`, `pitch` | Metres a texel covers; the density; the direction drawn (0–7); the pitch drawn at (the stage's: `SPRITE_PITCH`, 18°, by default) |

**`CameraPose`**: `eye`, `right`, `up`, `fwd` (world metres; unit, orthogonal, right-handed: `right × up = −fwd`;
the `PCam` fields of the scene host this was first written for), `size` (`[w, h]`, whole pixels), and **exactly one** of `f` (perspective: the focal
length in pixels, `(w / 2) / tan(fov / 2)`, with the principal point `cx`, `cy`, the frame's centre by default) or
`pixelsPerMetre` (orthographic, the projection the cells are painted for). `lookAt(eye, target, lens, size)` builds one;
`gameplay(look, orbit)` is The Last Light's. `compose` and `project` honour an off-centre `cx`, `cy` under perspective;
**`StageView` does not**: its `Camera3D` has a symmetric frustum, so geometry a host adds to the same view would not meet
the figures, and `StageView.draw` throws on a perspective pose whose principal point is not the frame's centre (`checkCentred`;
off-axis projection is a later question, if a host's camera needs one). Orthographic poses have no principal point.

**`StageSprite`**: `{ name, cell, at, screen, scale, depth }`: one figure in a frame. `at` is its feet in the world,
`screen` where the cell's top-left lands (pixels), `scale` how many screen pixels one texel covers, `depth` its distance
in metres along `fwd`. **`StageFrame`**: `{ version, camera, sprites }`, sprites far to near.

`stageFrame(actors, t, pose, { lighting?, lights?, sprite?, density?, crisp?, maxDensity?, pitch? })` makes a frame; `compose(frame, backdrop?)` is the CPU
reference (an RGBA frame of `camera.size`). A pose that is malformed throws an `Error` naming the field.

**The placement rule.** Per actor, `at3 = [x, ground(x, z), z]`:

```
[ax, ay, d] = project(pose, at3)           left out if perspective and d < 0.1 (behind the camera)
zoom        = zoomOf(pose, at3)            screen pixels per density-1 texel; a whole zoom to 1e-9 counts as whole
density     = opts.density ?? 2            D2 by default; 1 or 4 as asked
crisp:      scale = max(1, round(zoom / density))                                           (the default)
crisp: false (true scale):  scale = zoom / density
density 'auto' (the density follows the zoom, up to maxDensity):
  crisp:    n = max(1, round(zoom)); density = densityFor(n, max); scale = n / density
  true:     density = densityFor(zoom, max); scale = zoom / density
cell        = cellOf(actor.draw(t, { ...viewOf(pose, at3), pitch: opts.pitch ?? SPRITE_PITCH }, density, light), lit)
top-left    = [ax − scale·anchor.x, ay − scale·anchor.y]
screen      = crisp (the default) or a whole scale ? rounded top-left : top-left
sprites     sorted by d descending, then by the actor's index ascending (a tie: the later is on top)
```

`densityFor(zoom, max = 4)`: at a whole zoom the largest of 4, 2, 1 that divides it and is not above `max`; otherwise the
largest not above the zoom or `max`; never under 1. `compose` goes by pixel centres: a pixel takes the texel
`floor((px + 0.5 − screen) / scale)` when it is in the cell and its alpha is set.

## 3. The turn, and the lighting frame

A figure is painted at the nearest of 8 directions, from the bearing `viewOf(pose, at)` gives (the eye round the figure:
under perspective each figure has its own; under an orthographic pose the bearing `fwd` gives, shared), **at the renders'
pitch** (`SPRITE_PITCH`, 18°, the pitch of `pnpm --filter @automata/figures render` and the sheets; `Cell.pitch` reads it), **whatever the camera's
tilt** (`viewOf` still returns the pose's own pitch; `StageOptions.pitch` lets a host set another). Figures are sprites
drawn the way classic 2.5D games draw them, so a tilted camera (The Last Light's is 30°) does not foreshorten them or turn
them into a different drawing from the one the renders show. The relation a host relies on is

> **world = Ry(azimuth) · cell**

where the cell's frame has x to the screen's right, y up, z toward the camera. A quad for a cell stands on the root,
square to the image plane (its axes the pose's `right` and `up`), so the camera scales it evenly.

World lamps (`lighting`, lamps in world metres) are turned into that frame by `Ry(−azimuth)`, with the actor's feet,
and `lightFigure` lights the cell with `at` there. The other light path is the light hook (`lights`): a light per actor
for the painter, as a host's scene light does. The third is the sprite light (`sprite`: `(actor, at) =>
SpriteLighting | null`, c8-lit): the room's light as a host reads it where the figure stands, a flat light in light units
(1 is as painted) and unit lamp directions in the world with their strengths; the stage turns each direction by
`Ry(−azimuth)` and `lightSprite` lights the cell in whole DUEL steps (`flatSteps`, the form, a rim, the light's warmth through
`grade`), every texel on its own row. The rim is the first texel in from the painter's outline on the lamps' side (empty beside it, or
empty past one held texel); a texel with no normal gets no form and no rim. `null` leaves that actor unlit. It is a pure function, so a host that keeps the result by
its inputs gets the same bytes every time. One light path per frame; more than one throws.

## 4. The pixel grid

**The density is D2 by default** (`density`: 2; `1` and `4` as asked; `'auto'` picks it from the zoom with `densityFor`,
up to `maxDensity`): the package's working resolution, the look of its renders. At The Last Light's 640×480 and 16 m a
D2 texel covers about 0.85 pixels, a D1 texel 1.69.

**Crisp is the default** (`crisp` unset or `true`): `scale` is whole pixels per painted texel, `max(1, round(zoom /
density))`, and `screen` is rounded to the pixel grid, so every texel is a whole block of pixels and a figure is never
minified. At the gameplay camera a D2 texel is drawn at 1 px (the figure about 18% over true scale); at twice the frame
(1280×960, `gameplay(look, orbit, [1280, 960])`) at 2 px. Bringing the frame up (or the camera in) is the host's job:
the package owns no camera. The owner chose D2, the renders' pitch and crisp at the c6 visual gate, reversing the spec's
first draft (D1 figures at the camera's pitch, true scale by default, crisp opt-in); `STAGE_VERSION` stays 1 because
nothing was published before the change.

**True scale** is `crisp: false`: `scale` is any real number and `screen` the projected anchor unrounded, so no new colour
but uneven texels (at D2 a texel is 0.85 px: texels drop out, as a nearest minify does). Under an orthographic pose at a whole zoom the two
are the same. `crisp` snaps each figure's quad; it never changes the pose. A host applies `scale` and `screen` as given,
or ignores them and draws the cell at `at` at true scale.

## 4b. Depth: per texel

Figures stay billboards, but each texel has a depth, so a figure hides correctly behind scene geometry (a wall in the same
view) and behind another figure, texel by texel: a walking woman's arm swung toward the camera shows in front of the man
standing before her, though her root is the farther. The owner's call at the visual gate ("Depth now"), replacing the first
fix (the depth test off, sprites in order), which could not hide a figure behind a wall.

`texelDepths(camera, sprite)` gives the depth of every texel of a sprite's cell along the camera's `fwd`, in metres, as
32-bit floats (`Infinity` where the cell is empty). A texel's surface point is `(x, y', depth)` in the cell's frame (x to
the screen's right, y' up the cell, `Cell.depth` toward the camera, along the pitch the cell was painted at), turned to the
world by Ry(azimuth) (section 3) and put at the sprite's `at`; its depth along `fwd` is the sprite's root depth plus the turned
offset's component along `fwd`. Under a camera at the cell's own pitch that is the root's less the cell's depth.

`compose(frame, backdrop?)` is the rule. Sprites go in the frame's order; the sprite at rank `i` (0 first) is tested at its
texels' depths less `(i + 1) · TIE_BIAS` (`TIE_BIAS = 0.001` m, exported by `src/shared/stage/stage.ts`, not by `index`), and
a texel replaces what is there only when its test depth is **strictly nearer**. So: two figures at one distance tie, and the
later (cast order) wins; a later sprite beats an earlier one that is nearer by less than the difference of their ranks in
millimetres; and a figure beats a `Backdrop` (the scene's own geometry: a function from a pixel centre to a depth and colour,
or null, tested the same way) at the same depth or up to a millimetre behind it. The rule is in **metres**, so it does not
follow the camera's range. The Pixi view computes the same thing on the GPU: each quad's fragment shader takes `(rank + 1) ·
TIE_BIAS` off the texel's depth from a float texture of `texelDepths`, projects it through the camera's own projection, writes
`gl_FragDepth`, and the depth test (`LESS`) is on. The camera's near and far fit the frame's depths unless the host gives its
range (a scene with geometry beyond them must; the fitted near is `max(0.05, nearest root − 3)`, so a hand-built sprite whose texels reach nearer than that, a root under about 1 m, clips: give a `range`); the bias must stay above the depth buffer's step at the farthest figure (a
24-bit buffer under `{ near: 0.1, far: 1000 }` steps about 0.15 mm at 16 m, so a millimetre holds there; at 100 m the step
is millimetres and the buffer, not the rule, decides). The browser suite (`tests/browser/`) proves GPU = `compose` byte for byte, with a wall quad cutting
a figure at the knees, two overlapping figures, and, at a host's `range`, a figure against its twin half a step and a step and a
half behind it (`range/later`, `range/earlier`) and the gameplay wall (`range/wall`). Where two surfaces cross, the pixels within
the GPU's depth step of the crossing can differ by a pixel; the check cases keep surfaces apart (the twin is uniformly offset),
and a quad's own edge pixels are the one other place the GPU's fixed-point rasteriser and an exact ray may disagree, so a check
wall's edges are kept off screen or axis-aligned.

**Per-texel depth under WebGL and WebGPU.** The depth shader bit (`cellDepthBit`, `src/features/view/cell-sprite.ts`) has a GLSL
stage (`gl_FragDepth`) and a WGSL one. Under WebGPU a bit alone cannot write `@builtin(frag_depth)`: `@pixi/3d`'s default material
template ends its fragment entry with `{{fragmentWriteOutputs}}`, which returns colour locations only, so a depth-writing quad compiles
from the package's own template (`CELL_TEMPLATE`, `src/features/view/cell-template.ts`: a copy of `@pixi/3d`'s with three edits, the
fragment entry returning a colour and a depth), set through the material's `getPrimaryDescriptor().template` once `StageView` has seen
the renderer is WebGPU. `tests/unit/view/template.test.ts` reads the installed `@pixi/3d` and fails, in words, when its template moves
on. WebGPU binds every material texture as filterable float, which `r32float` is not, so under WebGPU the depths go up as the floats'
own bytes in an `rgba8unorm` texture and the shader rebuilds them with `bitcast`. Each texture is sampled with its own style (since
`@pixi/3d` 0.1.0-beta.3), and both of a cell's are `nearest`, so a magnified texel does not blend and a packed depth is read whole;
the window depth is
`zNdc · 0.5 + 0.5` under both renderers (the projection matrix `StageView` passes holds −1…1 clip depth). `StageView.perTexelDepth`
is true under both; any other renderer warns once (`perTexelDepthWarning`) and `perTexelDepth` is false. The browser suite
draws every stage case under WebGL and, where the browser's WebGPU presents a frame, under WebGPU, and requires 0 pixels of difference
from `compose` in each. A colour texture is created `rgba8unorm` (Pixi's default for a byte buffer is `bgra8unorm`, which swaps
red and blue under WebGPU).

**Fog.** A cell is an unlit picture of display colours. `CellMaterial` turns the engine's fog off and mixes the display value toward the
engine's fog colour itself (`cellFogBit`, `src/features/view/cell-fog.ts`), the straight mix of display values `@pixi/3d` 0.1.0-beta.2 gave an
unlit colour; beta.3's own fog mixes in linear light and encodes again, which reads lighter in the middle of the range. `tests/browser`
(`view-fog.test.ts`, and the WebGPU twin) check every opaque pixel of a fogged quad against the unfogged one, for a `StageView` quad and
a `FigureSprite`, under both renderers. A host states one fog on its view; the colour the fully fogged cell reaches is what the view's
fog colour decodes to (the framework's `viewFog` hands the colour that decodes to beta.2's).
Another limit: a billboard
is the painter's orthographic view at 18°, so under another camera tilt a texel's depth is where its surface really is but
its place is the billboard's: a wall's cut line is right to a few millimetres, not exact, off the painter's pitch.

## 5. The breaking-change list

Changing the name, path, signature or behaviour of any of these breaks the character kit's door, and with it every game that dresses a figure. `src/entries/kit.ts` re-exports the
ones that are not already on `src/entries/index.ts`, and `tests/unit/api.test.ts` pins both surfaces.

| Name | Where it lives | Public through |
|---|---|---|
| `gbuffer`, `rasterize`, `resolve`, `cleanup`, `noise3`, `STYLE`, `TRI`, `VERT`, type `GBuffer` | `src/shared/paint/raster.ts` | `kit` |
| `duel`, `oklab` | `src/shared/paint/paint-style.ts` | `kit` |
| `RAMPS`, `RAMP_OUTLINE` | `src/shared/paint/duel-ramps.ts` | `index` (already), `kit` |
| `placed`, `superquadric`, `limb`, types `Mesh`, `Material` | `src/shared/body/parts.ts` | `kit` (the types also `index`, already) |
| `axisAngle`, `normalize`, `apply`, `sub`, `cross`, `dot`, `lerp`, type `V3` | `src/shared/math/math.ts` | `kit` (`V3` also `index`, already) |
| `fk`, `J` | `src/shared/body/rig.ts` | `kit` (`J` also `index`, already) |
| `FIGURE_KEY` | `src/shared/lighting/lamps.ts` | `index` (already) |
| `BASE`, `Figure`, `member`, `ScriptedActor`, `Troupe`, `scriptOf`, types `ActorScript`, `CastMember`, `Placement` | as today | `index` (already) |
| type `Casting` | `src/shared/actors/actor-types.ts` | `index` (added) |
| The azimuth turn a figure is drawn at (world = Ry(azimuth) · cell) | `src/shared/figure/figure.ts` | documented in section 3, pinned by `tests/unit/stage/light.test.ts` |

What stays internal: everything else (the painter's `paint`, the hair and outfit generators' insides, the motion
solver's insides, the cell cache).

## 6. The rule

A removal, rename, signature or behaviour change of anything in sections 2 or 5 raises `STAGE_VERSION` and is written in the changelog below. Adding a name does not break a consumer, but still
needs its line in `tests/unit/api.test.ts`, made on purpose.

## 7. Changelog

- **1** (c6-pixi3d): first version. Per-texel depth (`Cell.depth` always present, `texelDepths`, `compose`'s backdrop and
  the GPU's `gl_FragDepth`) was decided at the gate too. At the visual gate, before anything was published (so no version bump), the owner
  chose: figures painted at the renders' pitch (`SPRITE_PITCH`, 18°) whatever the camera's tilt, D2 by default (`density`
  option; `'auto'` is the old zoom-driven choice), crisp by default (`crisp: false` is true scale).
  The implementation audit's fixes, also before anything was published: the tie rule is in metres (`TIE_BIAS`, one millimetre a
  place) and the same in `compose` and on the GPU, a figure winning a tie with scene geometry; `Cell.key` is the colour's key alone
  (stated); `StageView` throws on an off-centre principal point and warns once without WebGL; `Figure.depth` never takes the root's
  plane for an outline texel at D4.
- **1** (additive, for the framework's c7): `src/index.ts` adds `TIE_BIAS`; `src/kit.ts` adds `GROUP`, `weights`,
  `qmul`, `smooth` and the types `Limb`, `Ring`, so a host's own garment kinds (H1) need nothing deeper than the kit. Adding a
  name breaks no consumer (section 6), so `STAGE_VERSION` stays 1.
- **1** (additive, for the framework's c8-lit): `src/index.ts` adds `lightSprite`, `flatSteps`, `SPRITE_STYLE` and the
  types `SpriteLighting`, `SpriteLamp`, `SpriteStyle`; `StageOptions.sprite`, the third light path (the two-path error is now
  "lighting, lights and sprite are three light paths; give one"); per-texel depth under WebGPU (a WGSL stage and a fragment
  template). Adding a name breaks no consumer (section 6), so `STAGE_VERSION` stays 1.
- **1** (moved into the framework, 2026-11-12): the package arrives as `extensions/figures` (`@automata/figures`) with its history, byte
  for byte, and its goldens unmoved at the move; its layout follows the framework's (`src/shared/<layer>/`, `src/features/view/`,
  `src/entries/`). The three entries are `src/entries/index.ts`, `kit.ts` and `view.ts`; no name on them changed, so `STAGE_VERSION`
  stays 1. One painter fix came across with it and moved recorded pixels, named in its commit: a turned face keeps both eyes
  (the Owner: "yes, give me both eyes"); the other fixes that came with it moved none.
