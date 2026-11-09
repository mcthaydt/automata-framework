# 3D at the references' level: design spec

- **What this is:** the spec for 3D drawn at the level of the Owner's references (FigureBuilder and EnvironmentBuilder's
  shots), as a game. Stage 2 of 6 for this area, written with `superpowers:writing-plans` (no subagents) on 2026-11-09.
  Its plan is [2026-11-09-3d-painted-look-plan.md](2026-11-09-3d-painted-look-plan.md); its audit is
  [2026-11-09-3d-painted-look-audit.md](2026-11-09-3d-painted-look-audit.md) (F1 to F13, R1 to R4); its plan audit is
  [2026-11-09-3d-painted-look-plan-audit.md](2026-11-09-3d-painted-look-plan-audit.md) (P1 to P14, fixed in place here).
- **Checked against:** AF `0eb970be` (branch `claude/project-thread-5izi62`, PR #570 on #567), FigureBuilder `025ffb4`,
  EnvironmentBuilder `6d82a52`.
- **Path:** architectural (the figure renderer is replaced, the world kit moves into core, the look's frame changes).
  The brainstorming gates are met by the Owner's words below and the Opus plan audit that follows this document.

## 1. The brief

**The Owner, 2026-11-09:**

- 06:53: "We should only ever do 3D figures with the painter, cut whatever crap we were doing before".
- 06:54: "Use the environment builder, now the 3D editor, to make a scene that doesn't look like shit".
- 06:58, on the builders' video: "it needs to be this level".
- 07:27: "Bump it to 360 then" (the field).
- 07:57: "Make the 3D view look like the references I sent, it should be that, but a game; you have the repos, make it
  happen".

**The coordinator, 07:57:** take the audit's recommended approach unless reaching the references truly needs
EnvironmentBuilder's painter; judge that against the references, not against effort. The final proof is Ember Hall
built in Levels 3D at the references' level.

**The references:** `3d-examples/environmentbuilder-base-scenes.png` (the base interior and exterior, close and wide)
and the Owner's video (`3d-look/reference-shots.png`, a frame every 2 s): a lit apartment cut away, a carpeted corridor
in first person, a rainy alley and a rainy street at night.

**Decision D1 (the Owner's, 07:57, recorded from their words):** A. The rooms are drawn by Pixi 3D in the builders'
look, every frame, live at any camera; the figures are FigureBuilder's painted cells. R1 (the world kit into core), R2
(the painter everywhere) and R4 (ADR 0008) stand; R3 is the Owner's ruling (a 360 field).

## 2. Can Pixi 3D reach the references?

Yes. Every trait of the references comes from a rule the builders run per texel or per vertex, and each rule is either
data made at load or a few lines of a shader. None needs a CPU frame. The table is the judgment, trait by trait:

| Trait in the references | The builders' rule | Here |
|---|---|---|
| Figures with drawn faces, hands, an outline, light in whole steps, a rim | FigureBuilder's painter; EnvironmentBuilder's sprite light | the painter and the sprite light ported, run on the CPU per cell, cached (section 4) |
| Photo textures, a texel to a pixel | a tile made at the scale each texel is seen at (`textureAt`, `uv` in `paint.ts`) | tiles made at load at the scales the level's views see them (section 5.2) |
| Every colour a DUEL colour, dithered where it falls between two | albedo × light, hazed, one OKLab snap with a 4 × 4 Bayer offset (`colour.ts`) | the same, with the snap in OKLab (section 5.4) |
| Pools of lamp light on floors and walls, falling off in dithered bands | light per vertex in steps of 0.1, Gouraud across a face, on subdivided pieces (`vertex-light.ts`) | the bake AF has, held to EnvironmentBuilder's numbers by an oracle (section 5.3) |
| Green haze in the interior, glowing where the lamps are | the veil mixes toward its colour plus 0.5 × the texel's light, past the focus (`hazed`) | the same in the world's material; a figure hazed at its depth (sections 4.5, 5.3) |
| Lamps, signs and windows that glow, a ring round them | emissive swatches; the bloom (`post.ts bloom`) | emissive swatches; the glow pass (section 5.6) |
| Rain, wet reflections, light shafts, motes, moths | `post.ts` | passes, each with a switch (section 5.6) |
| Night and day, a mood | the time of day, the grade's moods | the time of day, the moods as a palette remap (section 5.6) |
| A sky with clouds and a city on the horizon | the sky bands, clouds, the horizon | core's sky and horizon, with clouds (section 5.6) |
| Furniture, plants, cars, a street lamp, a tree, a sign that says OFFICE | the prop generators, kits and lettering | the world kit's, moved into core (section 6) |
| Shadows under the figures | a contact shadow and the silhouette thrown along the key | a shadow quad per figure before the snap (section 4.6) |

**What differs, on purpose:** EnvironmentBuilder's diorama is drawn with one pixels-a-metre over the whole frame; a game
has the Owner's 24 mm perspective camera. So a figure is painted at one density per view (the field's pixels a metre at
the view's focus), as the diorama does at its one scale, and a tile at the scale the view sees it at the focus. A figure
nearer or farther than the focus keeps the view's density, which is the pixel-art rule (one texel density, The Last
Light's 36.9 texels a metre) and not the lens's.

**First person** is in the video. It is not in this plan: the game's camera is the angled one, and a first-person view
waits for the Owner after the end proof (audit section 6).

## 3. New findings

The audit's F1 to F13 stand. Writing this spec found four more:

| # | Finding | Evidence |
|---|---|---|
| F14 | The GPU snap picks the nearest DUEL colour in sRGB; the builders and AF's own CPU (`nearestDuel`) pick it in OKLab. A dark or saturated colour lands on a different DUEL colour in the game than in the references | `packages/3d/src/features/look/duel-snap-filter.ts` (`dot(d, d)` on RGB); FigureBuilder `paint.ts duel` and AF `@automata/content/palette nearestDuel` (OKLab) |
| F15 | A tile is made at 32 texels a metre for every surface; at a 360 field and 5 m a surface shows 72 pixels a metre, so a texel would be two pixels. EnvironmentBuilder makes each tile at the scale its texels are seen at | world kit `swatch-tiles.ts` (`reads.at`, 32); EnvironmentBuilder `paint.ts` `uv()` and `textures.ts textureAt` |
| F16 | Neither reference has a world outline (EnvironmentBuilder's `look.json` has `outline: false`; the frames show none). The audit's part 2 put the world's outline on: that reading is withdrawn, the outline stays off | `look.json` `switches.outline`; `environmentbuilder-base-scenes.png` |
| F17 | AF's vertex light is not cut into EnvironmentBuilder's steps of 0.1, and was never compared with it number by number | `shared/render/light/vertex-light.ts` (no step); EnvironmentBuilder `look.json` `light.step: 0.1` |

Measured for this spec (Node 24, this container): the photo pipeline reads, flattens and facets all 62 textured
swatches' photos in 2,346 ms (38 ms a swatch, once per photo), then makes their tiles in 674 ms at 32 texels a metre,
1,035 ms at 45, 1,778 ms at 64 and 3,567 ms at 90 (11 to 58 ms a tile), and 844 ms at 64 by 22.6 (a floor's pair).

## 4. Figures: the painter

### 4.1 What is drawn

A figure is FigureBuilder's painter's cell: its colours (DUEL), its normal map and its per-texel depth, from the parts
AF's `build()` makes, posed by AF's own `evaluate()` with FigureBuilder's sprite cheats given back to it (`lookUp`,
`view`, `pitch` and the walk's neck correction, which AF's `base()` had dropped; plan audit P8). The mesh figure is deleted (audit section 5, "What is deleted").
The port is the audit's table (section 5), plus FigureBuilder's sprite cheats from `figure.ts motion()`: the head turned
toward the camera by `faceTurn`, the three-quarter turn (`THREE_Q`), the head's 30° lead. Every ported file gets its
provenance row.

**F13's fix** is part of the port: the sunglasses check (`shaded()`) counts a head part painted from the skin's own
ramp (`skin~ear`, the ears) as skin, so it never hides an eye. The fix goes to FigureBuilder as a pull request too; the
oracle (section 9) names the cells it changes.

### 4.2 Density

One density per view: `D = clamp(round(4 × P ÷ 36.9) ÷ 4, look.figures.min, look.figures.max)`, where `P` is the field's
pixels a metre at the view's focus, `short ÷ (2 × distance × tan(fovShort ÷ 2))`, which is `short ÷ distance` with the
Owner's lens. At a 360 field: Ember Hall's 5 m views are density 2 (72 pixels a metre), its 7 m goal view 1.5. The
look's `figures` defaults are `min: 1`, `max: 3`. A view change that changes `D` prewarms the new cells (4.3). An editor
camera takes the same rule from its distance to its focus.

### 4.3 Cells

- A cell is painted for a key: the pose step, the direction (8, as FigureBuilder's), the 2° pitch step, the density, the
  outfit and item, the face (expression, marks, blink).
- **The cache** holds cells to a cap in bytes (`look.figures.cacheBytes`, default 32 MiB), least recently shown dropped
  first. A density-2 cell (128 × 192) with its colours, normal map and depth (4 + 4 + 4 bytes a texel) is 288 KiB
  before its empty rows are trimmed.
- **Prewarm:** on load and on a density change, a figure queues its idle and its walk in the current direction first,
  then the other seven directions.
- **One paint a frame**, for all figures together: a figure whose cell is not ready shows its last cell. Painting never
  blocks a frame; the worker is the step after, only if the iPad misses its budget.

### 4.4 The sprite light

EnvironmentBuilder's `stage/sprite-light.ts`, ported whole: the flat light (ambient plus each lamp at the figure's mean
N·L, never under `floor`, the floors capped by `floorCap`), one ramp step of form past `threshold`, the rim on the lamps'
side, the lone-texel rule, the ink and eyes never stepped. The lights come from the scene's light at the figure's chest.
The look carries EnvironmentBuilder's `figureLight`: `ambient 1.5, threshold 0.22, ink 40, floor 0.5, rim 0.35,
floorCap 0.8`.

### 4.5 Haze and the snap on the cell

The lit cell is hazed at the figure's root depth (EnvironmentBuilder `cast.ts`: the same veil as the room, its share
from the depth past the focus) and snapped to DUEL in OKLab with the Bayer offset at its screen pixel. A finished cell
is cached by its cell, its light (each channel to the 0.1 step), its haze share (to 1/32) and its place's `x mod 4` and
`y mod 4`, so a figure standing in one light repaints nothing.

### 4.6 In the frame

- **The composite:** a `Pass3D` at the `afterTransparent` stage draws each finished cell as a quad at whole field pixels,
  its feet's texel where the root projects (rounded), one texel to one pixel. Each texel writes its own depth (the root's
  view depth plus the cell's depth channel), so the hardware depth test hides a figure's legs behind a table. A texel
  under the painter's alpha cut is discarded. It writes the **painted** alpha code (5.4), so the snap leaves it as it is.
  It draws with blending off and writes straight colour (not premultiplied), its quads placed with the backend's flip.
  A cell's depth is packed into an 8-bit texture (16-bit fixed point), not `r32float`, which WebGPU binds only as
  `unfilterable-float`; colours are uploaded unpremultiplied. A placed cell names a source rect, so particles share one
  atlas (plan audit P1, P4, P12).
- **Order and occluders:** the composite runs after the transparent pass, so a wall the occluders have faded never
  covers a figure: the player stays seen through it, as the fade intends (P13).
- **The shadow:** a quad on the floor under each figure, drawn before the snap, multiplies the light there by
  `look.figureShadow` (0.6) where the contact ellipse or the silhouette thrown along the key falls (EnvironmentBuilder
  `shadowOf`).
- **The view's API:** `figure(def, options)` keeps its name and options. Its container is the root's place. It hands its
  cells to the view's figure layer, which the renderer makes when there is a look and passes to every view factory as
  a fifth argument (`ViewLayers3d`), so no other factory changes. An editor makes its own layer for its `View3D`.

### 4.7 ADR 0008

"3D figures are painted": the painter replaces ADR 0007's figure passes; law 6 holds (Pixi 3D draws every frame, a cell
is a texture it draws); ADR 0002's consequences get the note.

## 5. The world in the builders' look

### 5.1 The frame, in order

1. **Opaque:** every world piece in the tile material (5.3): its texel's DUEL albedo × the baked vertex light × the
   gain, clamped, hazed. Alpha 1, or the **glowing** code for an emissive swatch.
2. **The figures' shadows**, multiplied into the opaque colour.
3. **The figures** (4.6), with the painted code.
4. **Post:** the snap (5.4); the glow; reflections; shafts and motes; particles; rain; stars where the sky shows; the
   finish (the mood's palette remap, and every alpha back to 1 or 0). Each but the snap and the finish has a switch.
   The outline stays (off by default, F16).

### 5.2 Tiles at the view's scale

- **The scales:** for a view, `P` as in 4.2. A floor or ceiling's tile is made for `(P, P × sin tilt)`, a wall's for
  `(P, P × cos tilt)`, each snapped to the pipeline's √2 steps (`texelScale`), as EnvironmentBuilder's `uv()` sees them.
  A prop's face takes the floor pair or the wall pair by its normal (`|ny| ≥ 0.7`), as `uv()` does.
- **Made at load:** the photo pipeline runs in the browser. Its PNG decode inflates with `DecompressionStream`
  (Chromium, WebKit 16.4, Firefox 113 and Node 18 have it), so one decoder serves the game, the editor and the tests;
  the photos are fetched by URL from the package's assets. The renderer's start waits for the level's tiles as it waits
  for its models, yielding to the page between tiles. A tile is cached for the session by swatch, pair and grime.
- **Nothing is committed:** the 62 tile files and the `automata-world-textures` command go. The `reads` checks become a
  unit test that makes every textured swatch's tile from its photo at `reads.at` and checks it.
- **Placed as EnvironmentBuilder places it:** walls tile from their start, floors in the world, props in their own frame;
  `{ tile, repeat, pan, align, turn }` from the surface (`world/surface.ts`). A world mesh carries its texture
  coordinates in metres and a flag for floor-like faces; the material scales them by the tile's texels a metre.
- **On a view change** the pieces take the new view's tiles (a texture and a scale per material, no rebuild). A level
  names all its views; every view's pairs are made at load. A pair asked for later (an editor's zoom or orbit) is made
  one tile a frame while the old tile shows. Density and tiles follow the active view's distance, never the distance
  an ease passes through; the haze's focus may follow the live camera (P11).
- **Engines:** the pipeline's `oklab`, powers and `hypot` run on `@automata/sim/math` (fdlibm), so a tile is the same
  bytes in every engine; squares are written `x * x` (P9).

### 5.3 The tile material

- The albedo is the tile's texel: the swatch's ladder read at the texel's label (`tileColours`), a DUEL colour, sampled
  nearest, repeating. A flat swatch is its one colour, as now.
- The light is the baked vertex colour, cut into EnvironmentBuilder's steps (F17), Gouraud across the face, times the
  look's `light.gain` (1.0), the product clamped to 1 per channel.
- The haze: `share = clamp((depth − focus − near) ÷ (far − near), 0, 1) × amount`; the colour mixes toward
  `min(1, veil + glow × light)` by `share`. EnvironmentBuilder's profile: `colour #47655a, near 0, far 10, amount 0.85,
  glow 0.5`; a time of day may set its own colour and amount. `focus` is the view's distance. It replaces the view's
  linear fog wherever the look is on.
- **An oracle holds the light to EnvironmentBuilder's:** its `vertexLight` at sample points of the base interior and
  exterior, at their times, and AF's bake at the same points agree to within one step.

### 5.4 The snap and the alpha codes

- The snap picks the nearest DUEL colour in OKLab (F14): the palette's OKLab triples are constants of the shader, the
  colour plus the Bayer offset is converted (linear sRGB, Ottosson's matrices, `cbrt`) and the nearest is taken, the
  first winning a tie, as `nearestDuel`. A unit test compares the shader's choice (run in a real context) with
  `nearestDuel` over a grid of colours.
- **Alpha codes** carry what the post chain must know, in steps an 8-bit target holds exactly: `0` nothing drawn, `160/255`
  the sky pass, `192/255` painted, `224/255` glowing, `1` world. The snap snaps world and glowing pixels and passes painted
  ones through; the finish writes 1 wherever anything was drawn. The first task proves the codes survive the forward
  pass and the post chain on WebGL2 and WebGPU.
- **How a code is read:** a pixel is the code its alpha is nearest, within half a byte; any other non-zero alpha is
  world (a blended piece, such as a wall the occluders fade, leaves `a + dst × (1 − a)`, which is no code) (P3).
- **Premultiplication:** `@pixi/3d`'s material template writes `vec4(colour × alpha, alpha)`, so a material that writes
  a code divides its colour by the code in its last bit (P1). The last post pass is blended onto the 2D stage as
  premultiplied colour, so the finish writes colour 0 where it writes alpha 0, runs after every other pass, and a pass
  that paints a pixel with alpha 0 (a glow ring, rain or a particle over the sky) marks it drawn (P2).
- **The 8-bit store:** the scene is stored in 8 bits before the snap, and EnvironmentBuilder snaps from floats; measured,
  3.79 % of texels then pick a neighbouring DUEL colour in the dither (P5). The snap quantises as EnvironmentBuilder's
  does (`round((c + offset) × 255)`) on the stored colour. The CPU port of EnvironmentBuilder's rule (`worldTexel`) is
  held to its oracle exactly; the GPU frame is held to `worldTexel` with the 8-bit store modelled, every pixel equal but
  those within 1e-4 of a rounding boundary, which the test counts and prints. A half-float scene target (0.37 %) needs a
  graph of AF's own and is not taken.
- **The encode:** `toneMapping: 'none'` still writes `pow(colour, 1/2.2)` at the template's end. The tile material
  lights, hazes and codes in EnvironmentBuilder's space (sRGB bytes × light) and its bit runs after the encode (P6).

### 5.5 Lamps

The lamp kit is EnvironmentBuilder's (`pendant`, `bulb`, `desk`, `fluorescent`, `sodium`, `neon`; AF's `lamp-kit.json`
has the same numbers). A lamp's shade is an emissive swatch and glows; its pool is the vertex light on subdivided
pieces. A lamp's colour stays within `tone` (0.06) of its kind's.

### 5.6 Passes and the sky

- **Glow:** the world kit's stepped bloom, reading the glowing code instead of a luma threshold.
- **Reflections:** wet ground mirrors the frame about the ground plane, a step down, rippled by a texel
  (EnvironmentBuilder `reflect`); the ground is found from the depth and the camera.
- **Shafts and motes** in spot lamps' cones (`shafts`); **particles** (embers, dust, drips, moths round lamps) as one-
  to three-pixel sprites, depth-tested (`particles`).
- **Rain** and **stars**: the world kit's passes.
- **The moods:** EnvironmentBuilder's moods (`registerMood`), each a palette-to-palette remap computed once on the CPU
  in OKLab and snapped back to DUEL; the finish applies it.
- **The sky:** core's bands and horizon, and EnvironmentBuilder's clouds.

### 5.7 The field

The look's short side is 360 (R3). The long side follows the stage (`targetSize`). The frame time with every pass on
and four painted figures walking is measured on the GPU runner; the Owner's iPad and phone runs are listed for the
Owner. A miss goes to the Owner; the field is not lowered quietly.

## 6. The world kit comes into core (R1)

- `extensions/world-kit` moves into `packages/3d` by feature: the photo pipeline (`features/photo/`), the props and their
  generators, the kits and the dresser, the lettering, the generated maps and the readability rules (`features/world/`),
  the sky passes (`features/look/`), the library and the photos (`library/`, `assets/photos/`). Its tests move with it.
- The dressed base scenes join the bare ones in `@automata/3d/base`. `dressLevel`, the kits, `generateMap` and
  `readsAgainst` are exported from `@automata/3d/props-kit`; the passes from `@automata/3d`.
- Core's library is the base library plus the kit's: a game lays its own swatches and props over it.
- The extension, its manifest and its entries go; the examples that used it import core. The 3D scope trim's rows for
  these move get a line pointing here. The character kit stays an extension.

## 7. Levels 3D as the environment builder

- **One drawing for the game and the editor:** core's `drawLevel(view, level, options)` builds the world, makes the
  tiles, draws the pieces in the tile material, places the lamps and the light, and returns what moves. Ember Hall's
  scene hook, the editor's 3D view and Walk all call it, so the editor shows what the game draws.
- **The views draw the game's look:** tiles, the lamps' light, haze, the passes, at the game's field; painted figures in
  place of the person stand-ins (a cast member as its figure, the start as the game's player figure).
- **Furniture:** core's library (the kit's 86 props) beside the game's own, by group, each with a thumbnail.
- **Lamps:** the kit's six kinds, a colour kept within the kind's tone, on or off.
- **Materials:** the photo swatches, each shown by its tile, for floors, walls and ceilings.
- **Furnish:** "Furnish this room as…" a kit's purpose and how full; then take a piece out or move it (`remove`, `pin`).
- **Time of day:** as today, drawn in the view.
- Touch targets 44 px, primary actions 48 px; phone first; words in `docs/refactor/copy.md`.

## 8. Ember Hall's art pass

Made in Levels 3D, then committed as the level file the editor wrote: photo walls and a worn floor, kit lamps with
pools and a glow, kit props (crates, barrels, shelves, a table), the haze, real embers (a small glowing prop and an
ember emitter in place of the orange boxes), Wick painted at density 2. The replay hash does not move: the sim reads
none of it.

## 9. Proofs

- **The painter's oracle:** FigureBuilder `025ffb4` writes twelve posed frames of the base pair (its triangle soups, its
  decals, its face and hand stamps) and the md5 of each painted cell, plus four cells as PNG. AF's painter, given the
  same soups, writes the same bytes, except the cells F13's fix changes, which are named.
- **The world's oracles:** EnvironmentBuilder `6d82a52` writes the vertex light at 200 points of each base scene, its
  `shade` colour for 500 sampled texels, its sprite light on two cells, and its tiles' label md5s for three swatches at
  three pairs.
- **Parity:** WebGL2 and WebGPU images of the base interior and exterior, bare and dressed, with the base pair; every
  pixel DUEL; the figures' cells hashed alike in Node, Chromium, WebKit and Firefox.
- **The board:** AF's base interior and exterior beside EnvironmentBuilder's renders and the Owner's frames, for every
  look change.
- **The end proof:** a journey that builds a room in Levels 3D (photo walls and floor, two kit lamps, a room furnished as
  a waiting room and one piece moved, a time of day, two characters), saves, reloads, closes and reopens, plays it, and
  checks the game drew it (the tiles' colours where the walls are, the pools, the figures standing in them, figures
  reading against their room by at least 1.1). Ember Hall's art pass is the second proof. The Owner judges the board
  and plays it once on the iPad.

## 10. Risks

The audit's risks (section 13) stand, with these:

- **Load time:** a level's tiles take about 1 s on this container (8 swatches, 2 views); a phone is two to four times
  slower. The start waits for them; Ember Hall's load is measured in Chromium at a 4× CPU throttle, and over 2 s there
  moves photo preparation and tile making into a same-origin worker file (Ruken's `script-src 'self'`; no `blob:`).
- **Engines and the pipeline:** the pipeline and the painter use `cbrt`, `pow`, `sin` and `atan2`; a tile or a cell
  could differ by a label between engines. Both run on `@automata/sim/math` from the start (P9); the parity task hashes
  cells and tiles in four engines; a difference is fixed in the code, never accepted.
- **Posing:** AF's `base()` dropped FigureBuilder's sprite cheats; they come back as presentation inputs to
  `MotionState` (P8), so a cell is FigureBuilder's figure, not only its painting.
- **The beta's alpha:** if a target or a backend changes the alpha codes, the fallback is a second colour target for the
  codes; the first task finds out.
