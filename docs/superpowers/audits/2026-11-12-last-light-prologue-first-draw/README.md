# The look in play, against the old game (stage 4 session 3, 2026-11-12)

The old game is `mcthaydt/PixiJS3D_Experiment_001` at `92e6704`. Its own ward frame is
`old-baseline-clinic-ward-on-1024x768.png` (its `docs/verification/baselines/clinic/ward-on.png`, the clinic's ward, act one's
scene on the same blockout). The prologue itself is not in its baselines, so the old prologue was shot with its own
`scripts/verify/shoot.mjs` (`?debug&renderer=webgl&scene=prologue`, SwiftShader, 1024 by 768, the spawn at 0.6, 3.6 facing south):

| File | What |
|---|---|
| `old-play-1024x768.png`, `old-play-no-lcd-1024x768.png` | The old prologue's hall in play, picture effects on and off (LCD and dither) |
| `old-cutscene-1024x768.png` | The old opening cutscene |
| `old-baseline-clinic-ward-on-1024x768.png` | The old game's approved ward baseline |
| `ours-play-1024x768.png`, `ours-cutscene-1024x768.png` | Ours at the same place and size (Chromium, SwiftShader, 1024 by 768, field 640 by 480) |
| `ours-play-640x360.png`, `ours-cutscene-640x360.png` | Ours in a 16:9 window (field 640 by 360) |
| `side-by-side-play.png`, `side-by-side-cutscene.png` | Old on the left, ours on the right |

Mean luma over the frame (0 to 255), measured, not judged: the old hall 33, ours before this session 116, ours now 63.

## What was wrong and was ours (all fixed in this session, each test first)

1. **Every lamp was in the wrong place.** The converter wrote a lamp at `[x, y, z]` (the old game's order); the level format says
   `[x, z, height]`. The corridor's and the closet's lamps hung 3 to 6 m *below the floor*, the hall's pendant 0.8 m too low and 0.8 m
   too far south. Converter and level fixed; `tests/unit/features/room/world.test.ts` fails on the old file and passes on the new.
2. **Eight of the fifteen lamps were silently dropped.** The kit refuses a lamp whose colour is off its kind's tone, and has no
   screen, fire or spark kind (the monitor's glow, both curtains' fire, the spark, the two moons and the two fills). The builder reports
   this as a sentence and draws the rest, so nothing failed; the room was just lit by seven lamps. They are now `neon` lamps with
   their own colour (the kit's coloured glow), reported by the converter as approximated. Their ranges clamp to the neon band (1.5 to
   3.5 m): the old fire lamps reached 6 m. See "For the coordinator".
3. **Every lamp burned at level 1.** The old game burns each at the level its dress sets (the hall's pendant 0.6, the ward's 0.5, the
   corridor's bulb 0.12, the closet's tube 0, the curtains and spark unlit until their moment). Written into the level as each lamp's
   `level` (the old levels at power on, the flicker at its mean).
4. **The picture had the framework's 5% letterbox bars in play** (24 of 480 lines gone, a smaller room in the frame). The old game
   drew the whole window in play. `BAR_FRACTION = 0` in `app/field.ts`.
5. **The far end of the room was veiled in a mid teal, and the whole room with it.** The framework's haze measures from a focus
   that defaults to 3 m (a first-person lens's); the play camera is 16 m away, so every pixel counted as 13 m behind the focus and
   took the full haze, 85% of `#47655a` plus half its own light. That flat wash was the "pale, low contrast" first frames, in play and in
   the cutscene alike (so it was not a play-versus-cutscene difference: both stages light the same way). The old fog was `@pixi/3d`'s
   view fog, which draws its colour as the linear value read as sRGB: `0x4b5a56` reached the screen as `#121a18`. `app/look.ts`:
   that colour, whole at 7 m past the focus, no light added, the focus at the play camera's distance.
6. **Floors, walls and ceilings named no swatch,** so the builder drew first-person oak and warm plaster (the brown noise). Each room
   now names `tileFloor`, `plasterPaint` and `ceilingTile` (the counter's top `laminate`), the kit's nearest to the old photographic
   tiles, plaster and ceiling tile. The kit has no teal glazed tile wainscot like the old game's.

Level and time are not the cause: `lampLit`'s ambient is 0.15, as the old game's, and the lamps' strength is the shared 2.6.

## What is left, and whose

**HELD (not this session's)**
- The LCD panel's grid and the frame's vignette (the old frame's dark corners come from it), the retro grade (palette, fade, saturation
  0.85, warmth, bloom). Most of the remaining brightness and warmth difference is here: ours is still about twice as bright and
  warmer, because the old game's grade darkens and cools the whole frame after the light.
- Ada and the night figure are a green or brown slab (the painted figures, task 13). That slab is also why her size cannot be compared yet.
- Dressing: 20 of the level's props do not draw because the library has no preset of their name (`bed`, `chair`, `cabinet`, `screen`,
  `filingCabinet`, `mopBucket`, `lamp`, `plant`, `bookStack`, `table`, `waterCooler`, `utilityBox`): the ward bed and its curtains, the
  noticeboard, the chairs, the register's cabinet. The wainscot tile (teal glazed) and the old floor's checker tint.

**OURS, still open**
- Lights out. The old game does not black the room: the hall falls to 0.1, the ward to 0.12, the exit lamp stays at 0.95, the desk lamp
  goes. Ours sets every listed lamp to 0 (`LIT_UNTIL_LIGHTS_OUT`). Next.
- The walls are greener and brighter where a lamp reaches them than the old game's near-black plaster: `plasterPaint` is a sage ramp;
  a darker swatch, or the grade, will close it.
- Three rooms (hall, corridor, closet) have a wall piece with no surface name (the builder says `unknown-swatch: "undefined"`): a piece
  of those rooms is not drawn. Not yet found.

**For the coordinator (kit and core, not changed here)**
- The lamp kit's bands are narrower than the old game's (pendant 3.5 to 6 against 5.5 to 9, no fire, screen or spark kinds, a moon and
  fill of other colours and peaks). The hall's pendant (7.5 m) clamps to 6. If the old reach is wanted the kit gains the old
  archetypes; that is the builders' look's data, so it is a proposal, not a change made here.
- The framework's letterbox bars are always on and fixed (5%); the old game closed 11% bars in a cutscene only. A cutscene's bars
  that open and close is a core feature, not built.
- The old fog also had drifting mist puffs lit by the lamps (`fog.ts`); the framework's look has none ("its particle mist is not
  extracted").

## Ada's size

The camera rules are the old game's already: a 50 mm lens (27 degrees of the picture's height), 30 degrees down, the zones' own distances (16.6,
16, 15 m, from the level's `views`). At 480 lines that is 52.1 lines to a metre at the focus (the old game's "about 53"), so a 1.7 m figure
at the focus is about 89 lines tall (the old "about 90"). `tests/unit/app/camera-rules.test.ts` pins the lens, the distances and the
figure. Nothing was changed. The earlier "about 1.2 times larger" was the slab being nearer the camera than the focus (Ada at the spawn is
2.9 m in front of the hall's focus, 1.17 times larger by perspective) plus its top face; on the screen at the spawn the old sprite is
about 109 lines tall, ours (a 1.55 m box, its top face seen from 30 degrees) about 103. The painted figure (task 13, held) settles it.

## The HUD, old against `content/hud/play.toml`

| | The old game | Ours |
|---|---|---|
| Objective | Top left, one line, a diamond glyph then the words, in a small bitmap pixel font, no box | Top left, a rounded dark box, sans font, 360 wide |
| Where to go | A marker on the goal: a world diamond, or a chevron on the picture's edge toward it | None |
| Minimap | Top right, always, 80 by 60 (64 by 48 on touch), north up, the current room red, the doors seen | None |
| Prompt | A box tied to its hotspot by a leader line: "E · Read Patient record · 1/2 · Tab" (key, verb, name, which of how many, the key that cycles) | A box at the bottom centre, not tied to the hotspot |
| Items | One slot at the bottom centre with its key (1) and a fuel meter | "Nothing carried." bottom right, and the item slots |
| Debug line | Top left, only with `?debug` | None |

The hud extension gives five pieces (objective, prompt, inventory, examine, keypad), an anchor and a width each, and one boxed sans style; it
cannot say a minimap, an objective marker, a leader line or a pixel-font unboxed line. Logged as row 15 of the editor gaps ledger (with row 1,
the UI editor) and not restyled by hand. The hud extension and ui-screens are not changed here.
