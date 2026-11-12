# The Last Light against the old game's real play (stage 4 session 8, 2026-11-12)

Chromium on software GL (SwiftShader), a desktop context at 1024 by 768, the old game at `92e6704` run for real (no `?debug`, the real clock,
Begin clicked), ours on the tree at the commit that adds each picture. Old left, ours right; the light pair has ours before and after between.

## Item 2: the room's light and grade

`light-old-before-after-play.png` (old, ours before, ours after). Mean luma (Rec. 709 on the sRGB bytes) and mean hue (degrees) of the same screen
rectangle in each frame; the rectangles are in the table's first column.

| Region (screen px, x0 y0 x1 y1) | Old luma | Ours before | Ours after | Old hue | Before | After |
|---|---|---|---|---|---|---|
| floor (250 560 450 700) | 44.5 | 88.2 | **43.1** | 154 | 241 | 179 |
| east wall (690 110 880 300) | 41.6 | 87.7 | **54.1** | 149 | 29 | 15 |
| west wall (0 170 110 400) | 24.6 | 35.4 | **28.7** | 166 | 174 | 190 |
| lamp pool (740 340 840 440) | 63.2 | 111.1 | **89.8** | 34 | 33 | 28 |
| far dark (390 120 580 260) | 35.6 | 32.7 | 27.8 | 187 | 182 | 192 |
| whole frame | 31.2 | 51.1 | **33.9** | 170 | 33 | 27 |

(The hue of a region with a saturation under 0.05 is noise: the floor before was a neutral grey, 0.03; the whole frame's mean hue is of a
near-grey. The old floor is a green-teal grey at 0.14.)

### What the old game does, and what ours did

- **The grade is the same.** The old `POST.grade` (`src/render/look.ts`: exposure 0, warmth -0.12, tint 0.08, contrast 1.05, highlights -0.05,
  saturation 0.85, vibrance 0.1, black crush 0.025, mood blend 0.85) and `POST.fade` (lift 0.13 of the haze colour, white 0.96, grain 0.04) are the
  retro extension's defaults to the digit; the fog is `#4b5a56` as `@pixi/3d` beta.2 drew it (session 3). Nothing there to change.
- **The light's numbers are the same.** `LIGHT` (`src/render/look.ts`): lamp strength 2.6 at level 1, ambient 0.15 tinted `[0.84, 0.97, 0.98]`, key 0.09
  on the normal, wall fill 0.08, steps of 0.1 are the framework's `lampLit` time and `LIGHT_PROFILE`. The fifteen lamps' positions, ranges and levels
  in the level file are the old `LAMPS` and the power-on levels of `dressClinic`.
- **What differs is where the product is formed.** The old game (beta.2) multiplies a texel's *linear* colour by its light and shows the
  product as it is. The framework's `srgb` light, which the game uses, multiplies the *sRGB* colour: a mid grey is 0.5 in sRGB and 0.21 in
  linear light, so the same lamp numbers draw about twice as bright, and a lamp's warm light, multiplied into a bright albedo, reads peach.
  `colorSpace: 'linear'` is not the cure: it encodes the product and measured brighter still (floor 110, east wall 130).
- **The floor swatch was wrong, not the light.** The old floor is a dark glazed tile painted from `#625d54` (three tiles in four) and `#5b5c69`
  (`src/render/assets.ts`). The room used the kit's `tileFloor`, slate step 5 (`#abaebe`): nearly four times the light. The floor now names the
  game's `ward-floor` (sand step 0, `#625d54`, no gap to the palette) with the kit's floor-tile photograph. That alone took the floor from 88.2 to 54.5.
- **The lamps carry a gain, in content.** `content/look.toml` `[light] lamps = 0.7` scales every lamp's strength (a new key, with a schema and a
  test; `1` is the old game's number). Measured: 0.5 left the floor at 35 (too dark, the tiles lost), 0.7 puts it at 43 and the whole frame at 33.9
  against the old 31.2; 1 is the "before" column.
- **The plaster steps down one.** With the product in sRGB the step that draws as the old plaster did is sand step 0 (`#625d54`), not sand step 1,
  the nearest to the old file's `#858667` in RGB (east wall 68 against 54 with step 0, old 42). The test that kept the plaster near the old file's
  colour now says why it is darker.

### What is left, and whose it is

- **The east wall still reads warm (hue 15, old 149) and the lamp pool is bright (89.8, old 63).** In the old frame the wall behind the desk is
  teal although the desk lamp is 2 m from it; the lamp's formula is the same and the lamp is where the old one is, so the old room's light there
  is shadowed or dimmed by something this audit did not find (the old `BOXES` occluders are the first thing to read). The measurement is in the table; the cause is open.
- **Lit surfaces are blobby; the old floor shows its tile grid.** The old floor is a 1 px dark grout line, a lit edge and a worn corner on 30 cm tiles
  (`assets.ts`): high contrast at low brightness. The kit's floor-tile photograph at `contrast 0.035` carries less, and in the dark the DUEL snap
  flattens it. The game can say a stronger contrast on its own swatch; not done in this item.
- **For the framework (open proposals, nothing built):** a light colour space that multiplies the surface's linear colour and shows the product without
  encoding it, as `@pixi/3d` beta.2 does for the old game, so a game that wants an old game's numbers does not need a gain and a re-picked palette step.
