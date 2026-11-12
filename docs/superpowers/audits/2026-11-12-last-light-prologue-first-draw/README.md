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

## For the dressing task: the 20 props that do not draw

The level names 20 props whose preset the world kit's library lacks, so the builder reports `unknown-prop` and draws nothing for
them (`WORLD.problems`). The old game draws each as a GLB model (`src/render/models`, packed by `scripts/pack-models.py`) or a
dressing mesh (`src/scenes/clinic/dress.ts`). By the level's own prop id, then the preset it asked for (the "what it is" column is read from the ids and the puzzle's hotspots, not checked against the old game's models):

| Prop id | Preset the level names | What it is |
|---|---|---|
| `bed` | `bed` | The ward bed (Bed 04, where Ada lies down at the end) |
| `nightstand`, `drawers` | `cabinet` | The bedside nightstand (the lamp, then the paraffin); a chest of drawers |
| `fallen-chair`, `office-chair` | `chair` | A chair on its side in the hall; the desk's chair |
| `filing-1`, `filing-2` | `filingCabinet` | The two filing cabinets (one holds the register's papers) |
| `wall-tv`, `privacy-screen` | `screen` | The wall television; the folding screen by the bed |
| `mop-bucket` | `mopBucket` | A mop bucket in the corridor |
| `desk-lamp`, `pendant-lamp` | `lamp` | The banker's lamp on the counter; the hall's pendant shade |
| `junction-box` | `utilityBox` | The junction box the spark comes from |
| `floor-plant-1`, `floor-plant-2`, `desk-plant` | `plant` | Two floor plants and the desk's plant |
| `book-stack-1`, `book-stack-2` | `bookStack` | Stacks of books on the counter and the nightstand |
| `overbed-table` | `table` | The overbed table |
| `water-cooler` | `waterCooler` | The water cooler |

Also named but absent from the kit: the swatches the old floors and counter used (`counterTop`, `floorDim`; now `laminate` and
`tileFloor`), and the teal glazed wainscot tile the old game put under the wall rail.

## The lamp kit against the old archetypes (for the ruling on widening it)

The kit clamps a lamp's range into its kind's band, and the old game's reaches are wider. In the level now, with the old range and the range
the kit gives:

| Lamp | Kind written | Old range (m) | Range drawn (m) | Why |
|---|---|---|---|---|
| `hallLamp` | pendant | 7.5 | **6** | pendant band 3.5 to 6 (the old pendant's 5.5 to 9) |
| `curtainWest`, `curtainEast` | neon | 6 | **3.5** | no fire kind; neon band 1.5 to 3.5 (the old fire's 4 to 6.5) |
| `moon` | neon | 4.2 | **3.5** | the kit's moon is another colour; neon band |
| `wardFill` | neon | 4.8 | **3.5** | the kit's fill is a warm grey (`#d9d4cc`, peak 0.5), the old one a cool teal (peak 1.25); neon band |
| `bayFill` | neon | 4.4 | **3.5** | same |
| `spark` | neon | 4 | **3.5** | no spark kind (the old one 3 to 5, peak 2.5); neon band |
| `wardLamp`, `deskLamp`, `corridorLamp`, `exitLamp`, `closetLamp`, `sconce`, `monitorGlow`, `moonCorridor` | various | as written | as written | inside their bands |

The falloff is `(1 - d / range)^2`, so the hall pendant's light at 3 m is 0.25 of full instead of the old 0.36 (30% less), and at 5 m 0.03 instead
of 0.11. The two fills and the moon matter most for the look: the old ward and bay get their cool teal fill from them.

## The camera, as the coordinator asked

The play camera is the old game's, measured: at the same spawn the IV stand, the bench, the counter and the back doorway land on
the same screen positions in `side-by-side-play.png` (the IV stand at about x 240 and the bench at 120 to 290 of 1000 in both), and the
numbers are pinned (`tests/unit/app/camera-rules.test.ts`). What reads as "closer and lower" in ours is the missing darkness, vignette
and the dressing (the bed and the curtains on the left, the noticeboard on the back wall, the old rug-shaped light shafts), and Ada's slab.
Before this session ours also had 5% bars top and bottom, which did crop the frame; that is fixed.

## The minimap

The plan has no minimap: the survey's run-time rows list the objective line, the prompt, the inventory, the examine box and the keypad (the
hud extension's five pieces) and none for the map. The old game's minimap (`src/ui/minimap.ts`) is the journal map's model drawn small. It is
row 15 of the editor gaps ledger and, once built, belongs with the UI editor's screens (row 1), not in the prologue's task list.


## The painted figures (task 13, session 4)

`ours-painted-play-1024x768.png`, `ours-painted-cutscene-1024x768.png` and the two `side-by-side-painted-*.png` (old left, ours right; Chromium on
SwiftShader, 1024 by 768, field 640 by 480; shot by `tests/e2e/frames.test.ts`, `AF_SHOOT=<folder> pnpm test:e2e --grep frames`). Ada and the night
nurse are the character kit's painted figures: density 1, `crisp: false` (true size), lit by the room's lamps with the sprite light and casting
their shadow on the floor. Measured on the play frame (hair's top to the soles, in the 480-line field): Ada is **112 lines** tall at the spawn,
where the old game's sprite measured about 109 at the same spot (the camera's 52 lines a metre, 1.17 times that by perspective at the spawn).

What each wears, and what the old game's wore that the kit's library cannot say today (held until the wardrobe lands; `MISSING` in
`src/features/figures/cast.ts`, pinned by `tests/unit/features/figures/cast.test.ts`):

| | Wears now (the kit) | Old game, missing |
|---|---|---|
| Ada (street clothes, the prologue's outfit) | a cream rib `tee` with short sleeves, `jeans` in denim, brown leather `shoes` on a black sole, `smoothBob` hair in auburn, brown eyes | the maroon waistcoat (the painted wardrobe has none); boots with a shaft |
| The night nurse (the creature) | a white `tee` with short sleeves, a white `skirt` (length 0.42, flare 0.3), heavy shoes (the old swatch), long black `fallLong` hair, brown eyes | stockings, the belt, the nurse cap with its cross, the curtain of hair over the face, the skirt's hem stain and folds, the `uncanny` gait (she walks `loose`) |

Also not drawn: the lamp in Ada's hand (the painted figure's state has no held item); a cutscene's poses (`read`, `flinch`, `sit`, `sleep`, `pulse`
are not stands of the builder, so the figure stands or walks); and a cutscene key's close-up density (the prologue's cutscenes name none, so
every figure is at density 1). Props do not block Ada: the level's props carry no footprints (the old game's colliders were blockout boxes the
converter did not carry into the sector map), so nothing from the dressing can be read as a collision.
