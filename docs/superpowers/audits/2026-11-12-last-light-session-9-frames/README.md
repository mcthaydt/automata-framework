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
