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

## Item 3: Ada in the room's light

`ada-old-before-after-play.png` (the 200 by 240 px round Ada at the spawn, 2x: old, ours before the room's light, ours after). Mean luma of the
box round her: old 52.3, ours before 85.1, **ours after 56.2**.

- **How the old game lights its figure** (`src/render/stage.ts`, `sprite-light.ts` at 92e6704): every texel takes an ambient fill (the room's ambient
  0.15 x the teal tint x 1.5, `LOOK.characters.ambient`) plus N.L from each lamp that reaches her past the walls (`lightAt`, 1.05 x the lamp's
  falloff x strength x colour), snapped to the room's 0.1 steps, times its colour, on the sRGB bytes. At the spawn, away from the lamps, that is
  the ambient alone: she is as dim as the floor round her. The outline is DUEL's darkest teal (`#002219`), not black.
- **What ours does** (`extensions/character-kit/src/features/painted/room-light.ts`): the kit reads the room's light at her chest and at four points of floor
  round her feet, and holds her no hotter than 1.1 times the floor's shown luma by whole steps (`ROOM_LIGHT.hotLuma`, `dimmest` 12), never above her
  painted colours (`lift` 0). So she dims with the floor, and the floor was twice too bright: item 2 is what dimmed her, with no change to the figure.
- **Left, and not the game's to say:** the kit's outline is black where the old is the room's dark teal, and her arms keep a pale rim from the lamp's
  direction (the old shows the same rim, fainter). Both are the character kit's, which `claude/last-light-figures-look` owns, so they are not touched here.

## Item 4: the opening as the old game plays it

`old-real-opening-sheet.png` is the old game's real opening (1024 by 768, no `?debug`, the real clock, Begin clicked) at 1, 3, 5, 7, 9 and 12 s;
`opening-card-old-before-after.png` is the card's frame: the old at 9 s, ours before, ours after.

The old opening, in order: (1) **a 5 s film** (`signing-on`: Ada's hand signing the register, a 480 by 270 motion comic in a letterboxed 16:9 window, small
captions under it, `Esc / Enter - Skip` in the corner); (2) the 17 s **opening cutscene**, in a cinematic letterbox (bars top and bottom, about 84 px each at
1024 by 768): the hall from high in its south-west corner, the card **"PROLOGUE: FIRST NIGHT"** from 1.0 to 4.5 s of the cutscene over it, the first line
("St. Agnes Clinic. 20:00.") as a small caption under the bar, then Ada from the front and above, then the note, then the hall camera hands over to play.

### (i) The card: done, with today's pieces

`src/app/ActCard.svelte` and `act-card.ts` (test first: `tests/unit/app/act-card.test.ts`, watched failing for the missing component). The words are the
interface's (`messages/ui/en.json` `card.prologue`), the window is the old game's (`ACT_CARD` in `main.ts`: 1 to 4.5 s), from the sim's own clock so a slow renderer
shows it as long as a fast one; it takes no pointer and no focus, honours `prefers-reduced-motion`, and is its own extension in the HUD overlay (an extension fills a
slot once). **What it is not:** the old card is set in the game's pixel font, which the framework does not give a game (open proposal, the HUD's pixel font);
it is a bold monospace, cream (`#eadbc9`, DUEL sand 6), spaced wide, until then.

### (ii) The establishing camera: the keys are already the old's; two real differences found

The opening's camera keys in `content/cutscenes/opening.toml` are the old script's to the digit (`pos [-1.6, 4.3, 6.3]` to `[0.9, 1.5, 1.6]`, lens 22 to 25, then the cuts at 4.6,
11, 13 and 15.9 s), and the lens-to-field-of-view formula is the same (`2 atan(12 / mm)`), so the camera is not what differs. Measured instead:
- **The night nurse stood in the corridor's mouth in plain view for the whole opening;** the old game draws her only once she is awake (her actor is the dormant sim's,
  alpha 0). Fixed in data: the opening carries two `nurse` actor keys at alpha 0 (`tests/unit/app/opening.test.ts`, watched failing: no nurse keys). The
  sim content hash moves (the cutscene file is sim content); nothing the sim does changes (371 game unit tests pass, the bot's night is the same).
- **Ada is drawn 2.5 times larger in the opening's close shots than the old draws her** (about 260 px tall against 90 in the first shot, which is 4.6 m from her): the old
  game keeps a figure at its cast's fixed field density and caps its scale at `MAX_SPRITE_SCALE` for a close camera (the opening's script comment says every framing
  keeps the sprites within it), where ours draws her in true perspective. That is the figure view's (the character kit's), not the cutscene's: **a framework
  proposal** (a billboard cap for close cutscene cameras in `@automata/character-kit`'s painted view).
- **The bars.** The old cutscene is letterboxed, about 84 px top and bottom at 1024 by 768; ours draws full frame, with the pause button on top. The framework's
  bars are fixed for the game (`barFraction`) and cannot open per cutscene: already a proposal, not built.
- **Ada's facing in the opening was not established.** At 12 s the old shows her face (turned to the left, from the north camera); ours at the same
  moment (`ours-opening-ada-after-1024x768.png`) is face-on at a density where no features read, so the frames do not say whether it is the
  same way round. The stage hands a cutscene's `facing` to the figure as a heading, as play does, and play's is right (session 7). Left open; the figure's density in
  the opening's close shots is the character kit's (`claude/last-light-figures-look`).

### (iii) The film: NOT ported. What is missing

The old repo ships it: `public/fmv/signing-on.webm` (288,709 bytes; VP9 in WebM, 480 by 270, 24 fps, 5.0 s, no audio track used: the old player mutes it), hooked
`before: 'opening'`; the prologue's other two are `ff-corridor.webm` (269,290 bytes, after lights out) and `lights-on.webm` (283,585 bytes, after the rest). All three are 5 s clips of
painted stills, ordered-dithered DUEL pixels, shown at a whole multiple of 480 by 270 over the game, skippable like a cutscene (`src/ui/fmv.ts`). **The framework has no video
anywhere**: no `<video>` layer or film step in `@automata/cutscenes` (its keys are camera, actor, caption, light, sound, doors, time, grade, props, cues, shake, flicker, fade, states), no
host overlay that plays and skips a clip, no `before` / `after` hook on a cutscene, and no asset path for a `.webm` (the build's checks name video files only to refuse them in an itch bundle).
What a port needs is therefore: (a) the three files (copyable, 0.8 MB, provenance to record), (b) a **film beat** in the cutscene script (`before` the opening, `after` lights out and the rest) and a skippable host
layer that plays a muted clip at a whole scale on a black field, (c) `.webm` accepted as a game asset. None is built; no player was written.

## Item 5: the HUD, with the pieces the game has today

`hud-old-before-after-play.png` (old, ours before, ours after). The old HUD is a pixel-font line at the top left with a marker before it (no box), a minimap
top right, nothing at the bottom while nothing is carried, and no pause button. Ours was the framework's pieces: a rounded boxed line, the pause button,
a bordered "Nothing carried." box.

**Matched, in the game's `style.css` (test first: `tests/e2e/hud.test.ts`, watched failing on the boxed line's `rgb(24, 31, 47)` background):**
- the objective is a plain line of cream text (`#eadbc9`, 14 px) with a `✦` marker before it (`#ffb866`, the lamp's colour), no box, with a 1 px black shadow so it still reads over a bright wall;
- an empty inventory draws nothing (the box is hidden while it holds only its "Nothing carried." line; nothing to press is hidden, since there is nothing in it).

**Not matched, and why (against the open proposals already in the tracker; nothing built):**
- **The pixel font.** The framework gives a game no pixel face for its HUD or its cards (the old text is `src/ui/pixel-font`); the line and the act card use the page's own type.
- **The minimap** (the journal map's model drawn north-up in the top-right corner, with the current room and the marker): editor-gaps row 15; no HUD piece draws a map.
- **The marker in the world** (the ✦ over the objective's target, such as the noticeboard): the objective's `target` is in the file, but no piece draws a marker at a hotspot.
- **The pause button** stays: it is the framework's (touch and the keyboard's only visible way to the pause menu); the old had none because it pauses on Esc alone. A touch
  target of 44 px is not removed to make a frame match.
