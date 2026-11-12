# The Last Light against the old game, round four (stage 4 session 11, 2026-11-12)

Chromium on software GL (SwiftShader), 1024 by 768. The old game's frame is session 8's real-play capture of `92e6704` (no `?debug`, Begin clicked); ours are shot by
`games/the-last-light/tests/e2e/frames.test.ts` (`AF_SHOOT=<folder>`). WebKit, Firefox and a real GPU did not run.

## Item 2: the wainscot from the floor-tile photograph (Floor Tiles 08)

[`strip-item2-old-before-after.png`](strip-item2-old-before-after.png): old, ours at the end of session 10, ours now. Zoom of the band: [`zoom-item2-band-before-after.png`](zoom-item2-band-before-after.png); changed pixels: [`diff-item2-before-after.png`](diff-item2-before-after.png).

- **No new photograph was needed.** Floor Tiles 08 (Poly Haven `floor_tiles_08`, CC0, Rob Tuytel) is already the kit's `floorTiles` (`assets/photos/photos.json`), which session 9 used for the floor.
- **The photograph holds five tiles a side, not six** (a column profile of `floorTiles.png` repeats at 38.4 of its 192 px). A 15 cm tile is `scale = 0.5`. The same count means the floor, at `scale = 1.2`, is 36 cm tiles, not the 30 cm its comment and test say (item 3 corrects it).
- **Why the joint was lost before:** at the kit's 32 texels a metre a 15 cm tile is 4.8 texels, and its joint is a tenth of a texel's width, so it averages away (the tile came out a flat step). `reads = { at = 64 }` makes the tile at 64 texels a metre (9.6 texels a tile, a one-texel joint). `contrast` 0.04 (a step per 0.04 of OKLab lightness, `range` -4 to 1) is the largest that keeps the joint: at 0.1 the joints fall inside one step and vanish; at 0.025 the glaze mottles into camouflage.
- **Test first:** `tests/unit/features/room/tiles.test.ts` reads the committed tile and asks for a tile 15 cm across (its width in metres over five), the floor-tile photograph, and column and row mean-light profiles that repeat at one tile (correlation above 0.4 on both axes, the tile's joints lining up with each other). It failed first against the old wall-tile swatch for the right reason (a tile 0.37 m across).
- **At the play camera the grid is faint.** The wainscot shows in the east wall only behind the counter, lit by the lamp and seen obliquely: 4,016 pixels of the frame changed. High-passed column profile of the band (x 770 to 930, y 305 to 332; smoothed 4 px, minus a 24 px mean), std as a share of the band's mean luma: 3.7 % before, 4.7 % now (the old game's tile row, where it shows under the cork, has clear dark joints about 20 px apart). The joint is one to two ramp steps below the glaze (luma 0.83 to 0.9 of it), the old grout `#625d54` is 0.47 of the tile: darker joints need a ramp step lower than the sand ramp's range allows without the mottle; not closed.
