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
