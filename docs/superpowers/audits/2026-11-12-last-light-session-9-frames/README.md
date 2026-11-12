# The Last Light against the old game, round two (stage 4 session 9, 2026-11-12)

Chromium on software GL (SwiftShader), 1024 by 768, the old game at `92e6704` run for real (no `?debug`, Begin clicked), ours on the tree at the
commit that adds each picture. Strips are old, ours before, ours after. The old game is read for how each thing is done, and the framework's own
parts say it (the Owner, 2026-11-12: "don't port directly, just see how we did it"): no old file or painter is copied in.

## Items 1 and 3 (their shared cause): the game's own swatches were flat

`item1` strip: [`strip-item1-old-before-after.png`](strip-item1-old-before-after.png).

**Cause, with evidence.** `albedoTiles` (world-kit) finds a tile only in the kit's committed `TILE_FILES`. The game's three swatches
(`ward-floor`, `ward-plaster`, `ward-wainscot`, in `content/world-swatches`) had a `[texture]` block each and no tile file, so every one drew as
**one flat colour**: the smooth grey smear (item 1) and the flat slabs (item 3). Session 8's tuning of those swatches' `texture` knobs
changed nothing on screen. Second cause, found while fixing the first: tone mode puts a grout line two steps *down the swatch's ramp*, and the
floor sat on sand step 0, the bottom of its ramp, so even a tile file would have clamped the grout to the tile's own colour.
Third, the old plaster is not khaki: the old game's plaster is an even sea-green (see below), and session 8 had read the mean of another file.

**What the old game does** (`src/render/assets.ts` at `92e6704`, lines 165 to 217): the floor is 8 px tiles (30 cm, 26.7 texels a metre) in
two glazes, mostly a warm grey (`#625d54`, sand 0), now and then a cool slate (`#5b5c69`), on a one-texel grout of `#222323`, with a lit far
edge (`#857565`); the plaster is 32 texels a metre, `#47655a` with lighter (`#5b7b69`) and darker (`#394d3c`) clusters and a few cracks;
the wainscot is cream tile (`#ccc3b1`) with a glazed top and a shaded foot on grout. All are DUEL colours, point-sampled, repeating.

| Surface | How the old game makes it | What ours drew | The framework's way, now |
|---|---|---|---|
| Floor | painted 8 px tile, grout, lit edge, warm and cool tiles | one flat sand colour | `ward-floor`: slate step 2 in tone mode on the kit's `floorTiles` photograph, `scale 1.2` (its 25 cm tiles become 30 cm), grout two steps down (`#2d3136`), the photograph's other-hued tiles take the accent `ward-floor-warm` (sand step 0) |
| Plaster | sea-green with clusters and cracks | a flat sand | `ward-plaster`: sage step 1 (`#47655a`, no gap to the palette), the kit's plaster photograph |
| Wainscot | cream tile on grout | flat | the kit's wall-tile photograph, as written, now actually drawn |
| A game's own tile files | n/a | none: ignored | **small generic hook** in world-kit: `albedoTiles(swatches, own)`, test first; the game makes its tiles with the kit's own pipeline (`tools/tiles/make.ts` into `content/world-tiles`), and a test fails when a file is not what the pipeline makes |

Numbers, mean luma / mean hue of the same screen rectangle (old / ours before / ours after):

| Region (x0 y0 x1 y1) | Old | Before | After |
|---|---|---|---|
| floor (250 560 450 700) | 44.5 / 154 | 43.0 / 179 | 43.7 / 183 |
| east wall (690 110 880 300) | 41.6 / 149 | 54.1 / **15** | 57.0 / **141** |
| west wall (0 170 110 400) | 24.6 / 166 | 28.7 / 190 | 29.9 / 172 |
| lamp pool (740 340 840 440) | 63.2 / 34 | 89.6 / 27 | 90.0 / 29 |
| far dark (390 120 580 260) | 35.6 / 187 | 25.4 / 192 | 25.5 / 187 |
| whole frame | 31.2 / 170 | 32.8 / 36 | 33.5 / 164 |

The east wall's hue 15 (peach) was the plaster's colour, not the lamp: with the old green it is 141 (old 149), and the whole frame's hue
moves from 36 (a warm grey) to 164 (old 170). That settles most of item 5's "green" and the east-wall question session 8 left open.

## Item 2: the window light on the floor

`item2` strip: [`strip-item2-old-before-after.png`](strip-item2-old-before-after.png) (old, ours after item 1, ours after item 2).

**What the old game does** (`moonShaft` and the `moonPatch` sprite in `src/scenes/clinic/dress.ts` and `src/render/assets.ts` at `92e6704`): there is no lamp
or shadow. A small picture (32 by 96 texels, 4.4 cm each) of pale-blue stripes (a 7-texel period with 2 clear, so four bars between the
window's bars' shadows, soft at the sides, fading in over 10 texels and out along its length) is laid flat on the floor, 1.7 cm up, rotated to
run away from the window, and **drawn additively** (and the light shaft through the air as a second, soft quad). The ward's window is in the back wall at x -4.

**What the framework could say.** Nothing: the baked light is per vertex and its lamps are points, so a pattern a few centimetres across cannot be
baked; `moon: true` on a window is in the level schema and read by nothing; a thin flat prop is opaque, not added. So this is a **new, small, generic
shape**, built with tests as the brief allows, and the coordinator is told: `LightPatch` and `drawLightPatches` in `@automata/3d` (`shared/render/light/light-patch.ts`,
`features/look/light-patch-view.ts`): a window, the patch's middle, its size, its bars, its gain and colour, the rooms it shows in; the stripes' texels and
corners are pure and tested (`tests/unit/look/light-patch.test.ts`), the quad is a flat unlit mesh added to the floor in the room's pass, so the look's snap that
follows cuts the sum into whole DUEL steps. The game says its patch as data in `content/look.toml` `[[moonlight]]`, schema-checked.

| Box (330 340 670 500) around the stripes | Mean luma | 95th percentile |
|---|---|---|
| old | 46.3 | 80.9 |
| ours after item 1 (no stripes) | 44.1 | 78.0 |
| ours with the old gain 0.5, start as the old's | 52.0 | 104.3 |
| ours at gain 0.38, start 0.35 m further along | 50.4 | 88.4 |

**Not done:** the corridor's window (the old game's second patch and the light shaft in the air). The hall's camera draws the corridor too, so its stripes
show through the doorway where the old game hides them; it waits for a patch that follows the player's room. The glass in the ward's window draws black with
dither speckle in play (the dark rectangle top centre): item 7's "bright cyan window" is the other half of it.

## Item 4: softness and speckle

`item4` strip: [`strip-item4-old-before-after.png`](strip-item4-old-before-after.png) (old, ours after item 2, ours after item 4); the bench and bed at 2x, old
then ours before then after: [`item4-bench-zoom-old-linear-nearest.png`](item4-bench-zoom-old-linear-nearest.png) (its middle panel has the nearest-sampled models and the old dither strength 0.04; the right panel 1/64).

Causes found, measured, in the order the coordinator listed them:

1. **Mesh props' texture filtering: a defect, fixed.** `loadModels` decodes a model's image with `Texture.from(ImageBitmap)`, which pixi samples **linearly**; the
   old game decoded and snapped to the palette and drew nearest (`own(..., true)` in `assets.ts`), and the world's tiles in the framework are nearest already
   (`world-view.ts`). Fix in `@automata/3d` `shared/render/model/load-models.ts`: the loaded texture is `nearest` with no mips; test first
   (`load-models.test.ts`, watched failing: `'linear'` to be `'nearest'`). The browser suites with a model (parity renderer's "sampled nearest" quadrant test, the 3D example's
   meshes, `webgpu/mesh`) say nearest in their own words; they need Firefox and WebKit here and did not run.
2. **The dither's strength: 2.5 times the old game's, fixed in the game's look.** The old snap (`retro-filter.ts`, `look.ts` `dither` at `92e6704`) adds an 8 by 8 Bayer
   offset of at most 1/64 of the colour range, scaled by `1 - 0.5 luma` and cut to nothing in the deep blacks (`smoothstep(0.02, 0.08, luma)`, "to eliminate crawling
   noise"). The framework's is a 4 by 4 offset of `dither.strength` (0.04 by default), the same at every luma. The game now says 1/64 (`app/look.ts`, test first). Isolated
   speckled pixels per 100 in the far dark box fall from 28.7 (old 38) to 18.1; in the west wall box from 29.0 to 19.5 (old 22.8). The old game's luma weight and shadow taper are not in
   the framework's pass: a proposal (an optional `lumaWeight` and `shadowTaper` on `dither`, defaults leaving every other game's picture alone).
3. **Pass order: the framework's design, not changed (a proposal).** The old shader snaps to the palette first and grades and fades after, so its last frame is not on the
   palette (its darkest colours are 4, 4, 4 and 4, 8, 8); the retro extension grades **before** core's snap, "so the final frame is DUEL" (its README). Where the grade
   lifts or crushes a dark gradient, the snap then drops it to black or the next dark colour: the black clumps behind the bench and the wheelchairs, where the old game's shadows are smooth dark teal. Moving
   the grade after the snap would change every game that uses the retro pass; the look's own rule ("DUEL palette") is the Owner's.
4. **Not the cause:** the field's upscale filter (the desk's edges are sharper in ours, 99th percentile of the field gradient 94 against the old 58, and the whole-pixel scale is
   nearest), the LCD mesh (both draw it), mipmaps (none). Software GL (SwiftShader) can blur or speckle differently from a real GPU; nothing here points at it.

| Box | Isolated speckle % old / before / after | Mean luma old / before / after |
|---|---|---|
| floor (250 560 450 700) | 51.4 / 45.8 / 40.0 | 43.9 / 43.2 / 43.4 |
| far dark (390 120 580 260) | 38.0 / 28.7 / 18.1 | 34.9 / 25.2 / 24.8 |
| west wall (0 170 110 400) | 22.8 / 29.0 / 19.5 | 23.8 / 29.1 / 29.3 |

(Isolated speckle: a field pixel, the 2 by 2 screen pixels averaged, that differs by more than 6 levels from the median of its four neighbours.)

## Item 3: the walls

`item3` strip: [`strip-item3-old-before-after.png`](strip-item3-old-before-after.png) (old, ours before this session, ours now); the east wall at 2x: [`item3-east-wall-zoom-old-above-ours-below.png`](item3-east-wall-zoom-old-above-ours-below.png).

- **Flat slabs and the peach east wall: item 1's cause.** The plaster and the wainscot were flat colours (no tile file), and the plaster was the wrong colour (sand, where the old
  plaster is sea-green). With the tiles made and the plaster sage step 1, the east wall's hue is 141 (old 149), the west wall's 172 (old 166); see item 1's table.
- **The noticeboard was missing.** The old hall has a cork board, 1.7 by 0.9 m, centred at (3.3, 1.95) on the north wall with the day shift's note, a photograph and a drawing
  pinned on (`dress.ts` line 126 and 153 at `92e6704`), and the objective's marker over it. The level had the hotspot and no board. The kit has a `noticeboard` preset (a framed
  panel with three to six slips pinned on, by seed): the level now carries one at the old board's place and size, on a game swatch `ward-cork` (wood step 1; amber step 2, the cork's own colour,
  drew bright orange under the sRGB light). Test first (`world.test.ts`, "the ward's noticeboard", watched failing: no piece).
- **Not done: the tiled band.** The old hall's lower wall shows a row of tile with a light face and dark grout (the wainscot's `#ccc3b1` on `#625d54`). The wainscot is drawn now, but with no visible grid: the
  kit's photographs that have a grid are brown floor tiles (`floorTiles`) and a concrete slab (`wallTiles`) with no deep joints, and the cream mosaic (`tiles`) has none. `floorTiles` read at the wainscot's 22 cm
  keeps a one-texel grout at 32 texels a metre only at the floor's 30 cm. What the swatch system lacks: a cream glazed tile photograph with a dark joint, or a pattern kind for "tiles on grout"
  (size, joint width, two tones, a lit top edge) that the world builder draws; the `pattern` field of a swatch is in the schema and read by nothing today.
