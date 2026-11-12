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
every figure is at density 1). Props block Ada now (session 5, `c62510eb`): see "Meshes against blockouts" below.


## Meshes against blockouts: every prop of the prologue (stage 4 session 5, 2026-11-12)

The Owner's word of 2026-11-12: a generated prop is the blockout (place, turn, footprint, height, collider); a mesh replaces it on
screen, fitted to it. The old game ships a `.glb` and a `.pack` for each of its 62 model props (`src/render/models/`), and all 57
furniture entries of the clinic's prop table (`src/scenes/clinic/props.ts`) name one. **Every prop of the prologue has an old mesh.** Ours
draws none of them today: 55 are in the level (28 as a library preset, 4 as a kit kind (`screen`, `table`, two `lamp`s) and 23 as plain boxes, as the third column says), and two (the fallen
chair and the privacy screen) were left out of the level because no kit prop is a chair on its side or a folding screen.

How the old game fitted a model (`fitProp`, `src/render/props.ts`): the table's `size` is a world box centred on `(x, z)`, standing at
`y` (default the floor); `uniform` scales the model to the box's height and keeps its proportions, otherwise its bounds stretch to the
box; `yaw` turns it about the up axis (a quarter turn swaps its width and depth). So the box the converter already carries IS the
brief a mesh is fitted to. Columns: *old box* is that box worked from the table and the model's own bounds (measured here by reading the
`.glb`, uniform unless the row says otherwise: the trolley, the drawers and the strip light stretch to `size`); *blockout* is the width
x height x depth of what the level draws today, its centre on the plan and its lowest point, measured from the built pieces.

| Prop | Old model | Ours today | Should draw | Old placement and size | Old fitted box | Blockout today | Fits? |
|---|---|---|---|---|---|---|---|
| `bed` | `bed` | bed.single | the mesh `bed`, fitted; blockout stays as collider | 1.05×0.95×2.05 (0.00 rad) @ -4.10,0.40 y0.00 | 1.10×0.95×2.13 | 1.10×0.95×2.16 @ -4.10,0.40 y0.00 | fits |
| `wheelchair` | `wheelchair` | wheelchair | the mesh `wheelchair`, fitted; blockout stays as collider | 0.95×0.95×0.65 (1.57 rad) @ -4.20,1.90 y0.00 | 0.99×0.95×0.68 | 1.06×0.96×0.68 @ -4.20,1.90 y0.00 | fits |
| `fallen-chair` | `fallen-chair` | NOT IN LEVEL | the mesh `fallen-chair`; no blockout yet: add one (a box of its size) | 0.66×0.42×0.47 (1.57 rad) @ -1.20,0.35 y0.00 | 0.68×0.42×0.48 | — | no blockout in the level (left out) |
| `bench` | `bench` | bench | the mesh `bench`, fitted; blockout stays as collider | 1.66×0.90×0.52 (0.00 rad) @ -2.85,3.35 y0.00 | 1.66×0.90×0.50 | 1.59×0.89×0.46 @ -2.85,3.28 y0.00 | fits |
| `sink` | `sink` | sink | the mesh `sink`, fitted; blockout stays as collider | 0.45×0.80×0.51 (1.57 rad) @ -4.98,3.00 y0.20 | 0.46×0.80×0.51 | 0.45×1.10×0.60 @ -4.99,3.00 y0.20 | blockout 1.10 tall, old 0.80 |
| `trolley` | `trolley` | trolley | the mesh `trolley`, fitted; blockout stays as collider | 0.50×0.95×0.75 (1.57 rad) @ 2.30,2.40 y0.00 | 0.50×0.95×0.75 | 0.45×0.95×0.75 @ 2.30,2.40 y0.00 | fits |
| `filing-1` | `filing` | cabinet.filing | the mesh `filing`, fitted; blockout stays as collider | 0.52×1.34×0.63 (0.00 rad) @ -4.32,-3.47 y0.00 | 0.52×1.34×0.63 | 0.47×1.32×0.64 @ -4.32,-3.46 y0.00 | fits |
| `filing-2` | `filing` | cabinet.filing | the mesh `filing`, fitted; blockout stays as collider | 0.52×1.34×0.63 (0.00 rad) @ -3.76,-3.47 y0.00 | 0.52×1.34×0.63 | 0.47×1.32×0.64 @ -3.76,-3.46 y0.00 | fits |
| `drawers` | `drawers` | dresser | the mesh `drawers`, fitted; blockout stays as collider | 0.75×0.88×0.45 (0.00 rad) @ 2.40,-0.62 y0.00 | 0.75×0.88×0.45 | 0.75×0.88×0.48 @ 2.40,-0.60 y0.00 | fits |
| `clock` | `clock` | wallClock | the mesh `clock`, fitted; blockout stays as collider | 0.56×0.56×0.06 (0.00 rad) @ 4.45,-0.84 y2.57 | 0.56×0.56×0.05 | 0.32×0.32×0.06 @ 4.45,-0.82 y4.61 | blockout 0.32 tall, old 0.56; blockout floats at y4.61, old y2.57 |
| `nightstand` | `nightstand` | nightstand | the mesh `nightstand`, fitted; blockout stays as collider | 0.42×0.70×0.49 (0.00 rad) @ -3.12,-0.30 y0.00 | 0.49×0.70×0.42 | 0.42×0.70×0.52 @ -3.12,-0.28 y0.00 | fits |
| `monitor-cart` | `monitor-cart` | monitorCart | the mesh `monitor-cart`, fitted; blockout stays as collider | 0.71×1.10×0.54 (0.00 rad) @ -2.40,-3.35 y0.00 | 0.71×1.10×0.54 | 0.48×1.45×0.51 @ -2.40,-3.33 y0.00 | blockout 1.45 tall, old 1.10 |
| `iv-stand` | `iv-stand` | dripStand | the mesh `iv-stand`, fitted; blockout stays as collider | 0.84×1.80×0.86 (0.00 rad) @ -2.60,1.15 y0.00 | 0.83×1.80×0.86 | 0.60×1.90×0.61 @ -2.60,1.18 y0.00 | fits |
| `office-chair` | `office-chair` | chair.wood | the mesh `office-chair`, fitted; blockout stays as collider | 0.66×0.95×0.71 (0.00 rad) @ 3.90,-0.40 y0.00 | 0.66×0.95×0.71 | 0.44×0.92×0.42 @ 3.90,-0.40 y0.00 | fits |
| `wall-tv` | `wall-tv` | kind screen | the mesh `wall-tv`, fitted; blockout stays as collider | 0.69×0.55×0.45 (1.57 rad) @ -4.53,-1.70 y1.80 | 0.69×0.55×0.45 | 0.06×0.55×0.69 @ -4.52,-1.70 y1.80 | fits |
| `mop-bucket` | `mop-bucket` | mop.bucket | the mesh `mop-bucket`, fitted; blockout stays as collider | 0.44×1.25×0.59 (1.57 rad) @ 1.10,-5.30 y0.00 | 0.44×1.25×0.59 | 0.36×0.99×0.47 @ 1.10,-5.35 y0.00 | blockout 0.99 tall, old 1.25 |
| `desk-lamp` | `desk-lamp` | kind lamp | the mesh `desk-lamp`, fitted; blockout stays as collider | 0.35×0.42×0.21 (0.00 rad) @ 3.05,1.10 y1.08 | 0.35×0.42×0.21 | 0.24×0.50×0.24 @ 3.05,1.10 y1.08 | fits |
| `waste-bin-1` | `waste-bin` | bin | the mesh `waste-bin`, fitted; blockout stays as collider | 0.41×0.50×0.41 (0.00 rad) @ 4.55,2.95 y0.00 | 0.41×0.50×0.41 | 0.55×0.89×0.55 @ 4.55,2.95 y0.00 | blockout 0.89 tall, old 0.50 |
| `waste-bin-2` | `waste-bin` | bin | the mesh `waste-bin`, fitted; blockout stays as collider | 0.37×0.45×0.37 (0.00 rad) @ 4.50,5.62 y0.00 | 0.37×0.45×0.37 | 0.55×0.89×0.55 @ 4.50,5.62 y0.00 | blockout 0.89 tall, old 0.45 |
| `coat-hook` | `coat-hook` | kind box | the mesh `coat-hook`, fitted; blockout stays as collider | 0.51×1.15×0.24 (0.00 rad) @ 2.35,-0.74 y0.92 | 0.51×1.15×0.24 | 0.51×1.15×0.24 @ 2.35,-0.74 y0.92 | fits |
| `wall-sconce` | `wall-sconce` | kind box | the mesh `wall-sconce`, fitted; blockout stays as collider | 0.22×0.30×0.28 (0.00 rad) @ 2.30,-0.72 y2.56 | 0.22×0.30×0.28 | 0.22×0.30×0.28 @ 2.30,-0.72 y2.56 | fits |
| `junction-box` | `junction-box` | box.utility | the mesh `junction-box`, fitted; blockout stays as collider | 0.43×0.90×0.28 (0.00 rad) @ 3.90,-0.72 y2.60 | 0.43×0.90×0.28 | 0.47×0.90×0.32 @ 3.90,-0.72 y2.60 | fits |
| `key-cabinet` | `key-cabinet` | keyCabinet | the mesh `key-cabinet`, fitted; blockout stays as collider | 0.31×0.75×0.60 (-1.57 rad) @ 4.71,3.60 y1.12 | 0.31×0.75×0.60 | 0.12×0.50×0.40 @ 4.65,3.60 y2.52 | blockout 0.50 tall, old 0.75; blockout floats at y2.52, old y1.12 |
| `floor-plant-1` | `floor-plant` | plant.pot | the mesh `floor-plant`, fitted; blockout stays as collider | 0.86×1.30×0.81 (0.00 rad) @ -4.40,6.30 y0.00 | 0.85×1.30×0.81 | 0.95×1.35×1.12 @ -4.54,6.34 y0.00 | centre off |
| `floor-plant-2` | `floor-plant` | plant.pot | the mesh `floor-plant`, fitted; blockout stays as collider | 0.75×1.15×0.79 (1.57 rad) @ 4.40,6.35 y0.00 | 0.72×1.15×0.75 | 0.99×1.22×0.84 @ 4.44,6.48 y0.00 | centre off |
| `desk-plant` | `desk-plant` | plant.pot | the mesh `desk-plant`, fitted; blockout stays as collider | 0.36×0.40×0.33 (0.00 rad) @ 4.30,0.45 y1.10 | 0.36×0.40×0.33 | 0.32×0.48×0.32 @ 4.30,0.45 y1.10 | fits |
| `book-stack-1` | `book-stack` | books.stack | the mesh `book-stack`, fitted; blockout stays as collider | 0.26×0.20×0.19 (0.00 rad) @ 3.90,0.45 y1.10 | 0.26×0.20×0.19 | 0.21×0.10×0.16 @ 3.90,0.45 y1.10 | fits |
| `book-stack-2` | `book-stack` | books.stack | the mesh `book-stack`, fitted; blockout stays as collider | 0.19×0.17×0.22 (1.57 rad) @ 2.95,2.95 y1.10 | 0.16×0.17×0.22 | 0.16×0.10×0.21 @ 2.95,2.95 y1.10 | fits |
| `ledger` | `ledger` | paper | the mesh `ledger`, fitted; blockout stays as collider | 0.45×0.06×0.42 (0.00 rad) @ 2.95,1.50 y1.10 | 0.47×0.06×0.44 | 0.23×0.00×0.31 @ 2.95,1.50 y1.10 | fits |
| `overbed-table` | `overbed-table` | kind table | the mesh `overbed-table`, fitted; blockout stays as collider | 0.45×0.90×0.80 (-1.57 rad) @ -3.30,0.90 y0.00 | 0.45×0.90×0.77 | 0.80×0.90×0.45 @ -3.30,0.90 y0.00 | fits |
| `privacy-screen` | `privacy-screen` | NOT IN LEVEL | the mesh `privacy-screen`; no blockout yet: add one (a box of its size) | 1.25×1.60×0.45 (0.40 rad) @ -2.75,-2.55 y0.00 | 1.21×1.60×0.70 | — | no blockout in the level (left out) |
| `radiator-1` | `radiator` | radiator | the mesh `radiator`, fitted; blockout stays as collider | 0.20×0.62×0.90 (1.57 rad) @ -4.75,4.20 y0.00 | 0.13×0.62×0.62 | 0.08×0.60×0.98 @ -4.75,4.20 y0.00 | fits |
| `radiator-2` | `radiator` | radiator | the mesh `radiator`, fitted; blockout stays as collider | 0.20×0.62×0.90 (-1.57 rad) @ 1.35,-2.35 y0.00 | 0.13×0.62×0.62 | 0.08×0.60×0.99 @ 1.35,-2.35 y0.00 | fits |
| `extinguisher-cabinet` | `extinguisher-cabinet` | kind box | the mesh `extinguisher-cabinet`, fitted; blockout stays as collider | 0.17×0.75×0.42 (1.57 rad) @ -1.39,-3.30 y0.95 | 0.17×0.75×0.40 | 0.42×0.75×0.17 @ -1.39,-3.30 y0.95 | fits |
| `gurney` | `gurney` | gurney | the mesh `gurney`, fitted; blockout stays as collider | 0.62×0.90×1.80 (1.57 rad) @ -1.10,-5.75 y0.00 | 0.61×0.90×1.63 | 0.67×1.00×1.90 @ -1.10,-5.75 y0.00 | fits |
| `water-cooler` | `water-cooler` | cooler.water | the mesh `water-cooler`, fitted; blockout stays as collider | 0.34×1.20×0.36 (-1.57 rad) @ 4.62,4.40 y0.00 | 0.36×1.20×0.31 | 0.30×1.30×0.30 @ 4.62,4.40 y0.00 | blockout 1.30 tall, old 1.20 |
| `pendant-lamp` | `pendant-lamp` | kind lamp | the mesh `pendant-lamp`, fitted; blockout stays as collider | 0.50×0.75×0.50 (0.00 rad) @ -4.10,0.40 y2.75 | 0.57×0.75×0.57 | 0.45×0.57×0.45 @ -4.10,0.40 y2.93 | blockout 0.57 tall, old 0.75; blockout floats at y2.93, old y2.75 |
| `strip-light-1` | `strip-light` | kind box | the mesh `strip-light`, fitted; blockout stays as collider | 0.30×0.10×1.25 (1.57 rad) @ 0.00,-2.50 y3.08 | 0.30×0.10×1.25 | 1.25×0.10×0.30 @ 0.00,-2.50 y3.08 | fits |
| `strip-light-2` | `strip-light` | kind box | the mesh `strip-light`, fitted; blockout stays as collider | 0.30×0.10×1.25 (1.57 rad) @ 0.00,-4.60 y3.08 | 0.30×0.10×1.25 | 1.25×0.10×0.30 @ 0.00,-4.60 y3.08 | fits |
| `stock-boxes-1` | `stock-boxes` | kind box | the mesh `stock-boxes`, fitted; blockout stays as collider | 0.30×0.40×0.30 (0.00 rad) @ 3.72,-6.17 y0.16 | 0.33×0.40×0.27 | 0.30×0.40×0.30 @ 3.72,-6.17 y0.16 | fits |
| `stock-archive-1` | `stock-archive` | kind box | the mesh `stock-archive`, fitted; blockout stays as collider | 0.30×0.36×0.30 (0.00 rad) @ 3.72,-6.17 y0.64 | 0.30×0.36×0.30 | 0.30×0.36×0.30 @ 3.72,-6.17 y0.64 | fits |
| `stock-linen-1` | `stock-linen` | kind box | the mesh `stock-linen`, fitted; blockout stays as collider | 0.30×0.30×0.30 (0.00 rad) @ 3.72,-6.17 y1.14 | 0.35×0.30×0.31 | 0.30×0.30×0.30 @ 3.72,-6.17 y1.14 | fits |
| `stock-bottles-1` | `stock-bottles` | kind box | the mesh `stock-bottles`, fitted; blockout stays as collider | 0.30×0.20×0.30 (0.00 rad) @ 3.72,-6.17 y1.66 | 0.39×0.20×0.21 | 0.30×0.20×0.30 @ 3.72,-6.17 y1.66 | fits |
| `stock-canisters-1` | `stock-canisters` | kind box | the mesh `stock-canisters`, fitted; blockout stays as collider | 0.30×0.36×0.30 (0.00 rad) @ 4.20,-6.17 y0.16 | 0.35×0.36×0.31 | 0.30×0.36×0.30 @ 4.20,-6.17 y0.16 | fits |
| `stock-toolbox-1` | `stock-toolbox` | kind box | the mesh `stock-toolbox`, fitted; blockout stays as collider | 0.30×0.24×0.30 (0.00 rad) @ 4.20,-6.17 y0.64 | 0.33×0.24×0.18 | 0.30×0.24×0.30 @ 4.20,-6.17 y0.64 | fits |
| `stock-rolls-1` | `stock-rolls` | kind box | the mesh `stock-rolls`, fitted; blockout stays as collider | 0.30×0.34×0.30 (0.00 rad) @ 4.20,-6.17 y1.14 | 0.41×0.34×0.25 | 0.30×0.34×0.30 @ 4.20,-6.17 y1.14 | fits |
| `stock-bandages-1` | `stock-bandages` | kind box | the mesh `stock-bandages`, fitted; blockout stays as collider | 0.30×0.22×0.30 (0.00 rad) @ 4.20,-6.17 y1.66 | 0.31×0.22×0.20 | 0.30×0.22×0.30 @ 4.20,-6.17 y1.66 | fits |
| `stock-archive-2` | `stock-archive` | kind box | the mesh `stock-archive`, fitted; blockout stays as collider | 0.30×0.40×0.30 (1.57 rad) @ 1.93,-5.95 y0.16 | 0.34×0.40×0.33 | 0.30×0.40×0.30 @ 1.93,-5.95 y0.16 | fits |
| `stock-bandages-2` | `stock-bandages` | kind box | the mesh `stock-bandages`, fitted; blockout stays as collider | 0.30×0.26×0.30 (1.57 rad) @ 1.93,-5.95 y0.64 | 0.24×0.26×0.37 | 0.30×0.26×0.30 @ 1.93,-5.95 y0.64 | fits |
| `stock-bottles-2` | `stock-bottles` | kind box | the mesh `stock-bottles`, fitted; blockout stays as collider | 0.30×0.20×0.30 (1.57 rad) @ 1.93,-5.95 y1.14 | 0.21×0.20×0.39 | 0.30×0.20×0.30 @ 1.93,-5.95 y1.14 | fits |
| `stock-boxes-2` | `stock-boxes` | kind box | the mesh `stock-boxes`, fitted; blockout stays as collider | 0.30×0.40×0.30 (1.57 rad) @ 1.93,-5.20 y0.16 | 0.27×0.40×0.33 | 0.30×0.40×0.30 @ 1.93,-5.20 y0.16 | fits |
| `stock-linen-2` | `stock-linen` | kind box | the mesh `stock-linen`, fitted; blockout stays as collider | 0.30×0.30×0.30 (1.57 rad) @ 1.93,-5.20 y0.64 | 0.31×0.30×0.35 | 0.30×0.30×0.30 @ 1.93,-5.20 y0.64 | fits |
| `stock-rolls-2` | `stock-rolls` | kind box | the mesh `stock-rolls`, fitted; blockout stays as collider | 0.30×0.30×0.30 (1.57 rad) @ 1.93,-5.20 y1.14 | 0.22×0.30×0.36 | 0.30×0.30×0.30 @ 1.93,-5.20 y1.14 | fits |
| `stock-canisters-2` | `stock-canisters` | kind box | the mesh `stock-canisters`, fitted; blockout stays as collider | 0.30×0.36×0.30 (-1.57 rad) @ 4.25,-3.95 y0.49 | 0.31×0.36×0.35 | 0.30×0.36×0.30 @ 4.25,-3.95 y0.49 | fits |
| `stock-linen-3` | `stock-linen` | kind box | the mesh `stock-linen`, fitted; blockout stays as collider | 0.30×0.28×0.30 (-1.57 rad) @ 4.25,-3.95 y0.99 | 0.29×0.28×0.32 | 0.30×0.28×0.30 @ 4.25,-3.95 y0.99 | fits |
| `stock-boxes-3` | `stock-boxes` | kind box | the mesh `stock-boxes`, fitted; blockout stays as collider | 0.30×0.40×0.30 (-1.57 rad) @ 4.25,-4.95 y0.49 | 0.27×0.40×0.33 | 0.30×0.40×0.30 @ 4.25,-4.95 y0.49 | fits |
| `stock-toolbox-2` | `stock-toolbox` | kind box | the mesh `stock-toolbox`, fitted; blockout stays as collider | 0.30×0.24×0.30 (-1.57 rad) @ 4.25,-4.95 y0.99 | 0.18×0.24×0.33 | 0.30×0.24×0.30 @ 4.25,-4.95 y0.99 | fits |

Reading the table:

- **44 of the 57 rows fit** (the blockout's centre within 0.1 m of the old box and its height and floor within 0.1 and 0.05 m): the
  mesh can be fitted to the blockout as it is. Where the blockout is thinner or narrower than the old box (a wall clock, a radiator, the
  TV) the mesh is fitted by height and centred on the blockout, as the old game did.
- **Blockout faults to fix before a mesh is fitted to them (a mesh fitted to a wrong blockout lands wrong): `clock` and `key-cabinet`
  float at 4.61 and 2.52 m** (the preset's own mount `height`, 2.2 and 1.4, is added to the `[x, z, height]` the converter wrote, so
  the clock hangs over the ceiling at 3.08); `sink`, `monitor-cart`, `mop-bucket`, both bins and the water cooler are 0.1 to 0.4 m
  the wrong height; `pendant-lamp` is 0.18 m short; the two floor plants are off-centre by their pot's own origin.
- **Two have no blockout**: the fallen chair and the privacy screen; each needs one (a box of the old size), because the mesh needs a
  place, a footprint and a collider to follow.
- The framework cannot name a model for a prop today (`PropPlace` has no `model`; `drawWorld` draws pieces only), so no row can say "replaced
  by this mesh" yet. See the plan's log.


### What was done about it (session 5)

Frames: `ours-meshes-play-1024x768.png`, `ours-meshes-cutscene-1024x768.png` (re-shot after the facing fix below; Chromium on SwiftShader, a desktop context with no touch, so no
buttons over the frame), `side-by-side-meshes-play.png` and `side-by-side-meshes-cutscene.png` (old left, ours right), and
`generated-against-meshes-play.png` (the same frame with the generated props left, the meshes right).

- **All 57 props name the old game's model** (41 files, `public/models/*.bin`, byte for byte from the old game's `.pack`s; rows and
  checksums in `PROVENANCE.md`). The generated prop stays the blockout: `World.props` keeps its box, the sim's footprint comes from it
  (`obstaclesOf`), and a model that was not loaded fails the boot with its file's name.
- **The table's "fits" column was too loose.** It judged height, floor and centre, not the footprint. Fitting the real models found six more
  blockouts that were far thinner or flatter than their model (the ledger, the wall TV, the overbed table, both radiators, the extinguisher
  cabinet). In all, **17 blockouts are the old game's box now** (`BOXED` in `tools/convert/models.ts`): the 13 of the table's last column
  but the pendant (kept as the kit's lamp because its light is the prop's: its model leaves the blockout by 0.12 m each side and 0.18 m in
  height by a `fit` offset) and the two the level lacked, plus those six. `tests/unit/features/room/models.test.ts` holds it: every model
  stands inside its blockout, the tightest axis is full, and none is under 40% of its blockout.
- **The old game stretched three models to their box** (the trolley, the drawers, the strip light: no `uniform`); the rule here does not
  stretch. The trolley draws 0.42 by 0.71 by 0.75 m where the old one was stretched to 0.50 by 0.95 by 0.75, the drawers 0.60 by 0.57 by 0.48
  where it was 0.75 by 0.88 by 0.45, and the strip light is turned to lie along its box. These are visible differences, by name.
- **The fallen chair and the privacy screen** now have a blockout (a box of the old size, turned the old yaw by the fit) and their mesh
  draws: the chair on its side lies at (-1.2, 0.35); the folding screen stands in the ward's alcove, turned 22.9 degrees (it fills 58% of its
  blockout's depth, the blockout being the turned model's box on the plan).

**The old textures against the DUEL palette (2d).** Every model's texture is 6 to 12 colours (median 10) at 128 by 128, and every one of
them is a DUEL colour exactly (the mean distance to the nearest palette colour, over the 41 models' pixels, is 0.0): the old pipeline
flattened them to the palette, so the frame's final snap to DUEL changes none of a texel. Their mean luma is 96 of 255.

**The room light beside generated props: not the same.** A generated prop takes the room's light baked into its vertex colours (the pools of
the lamps, the room's shade, the shadows); a model today draws with its own flat Phong material, which takes none of that. Measured on the same
frame at the same pixels (mean luma 0 to 255, the generated frame against the meshes' frame; the floor beside them, which no model touches,
is 69.5 in both): bench 50.8 to 35.5 (0.70), wheelchair 33.9 to 28.6 (0.84), the clock and the TV 63.1 to 40.9 (0.65), the bed and table 47.6
to 41.8 (0.88), the counter and what stands on it 73.1 to 63.4 (0.87). The models read 0.65 to 0.88 of the same prop generated, cooler
(`bench` blue 29 against red 29 where the generated one is 55, 50, 47) and without the desk lamp's pool on them. See
`generated-against-meshes-play.png`. The smallest change that would give a model the baked light: in `drawWorld`'s `modelMesh`, put the
model's texture on a `FlatMaterial` (a plain texture, as the pieces with a photo tile have) and call `light.bake(mesh, { textured: true,
albedo, shadeSteps: 1 - room.light })` as the piece loop does, since the mesh is already in world space with a geometry of its own.
Not made: it is a framework decision for the Owner's eye on the frame.


## Three things seen in the last frame (stage 4 session 5)

**4a. The row of six large W S A D Q E buttons.** They are the framework's own touch controls: `keys()` makes one button for each bound key
and `PlayScreen` draws them when the player is touching (`tracker.method === 'touch'`). They were in the frame because the journeys'
`sizes.phone` is an iPhone context with a coarse pointer, which the framework rightly reads as touch; the frame shoot is a desktop context now
(`tests/e2e/frames.test.ts`: no touch, device scale 1), and its frames have no buttons. What was not gated was the game's own Lamp and Skip
buttons (`PlayControls.svelte`): a `hud.overlay` component could not see the input method. **`PlayHandle.inputMethod`** (core, `fa496784`,
test first, `patch` changeset) gives it, and the two buttons now show only under touch (`9fc00ff1`; tests for touch, keyboard and gamepad, and for
a player who changes from one to the other). Layout is unchanged: the container's size moves them, the input mode says whether they are there.
Still to be shot, as the coordinator asked: one phone-size touch frame, to see the six buttons and Lamp and Skip over the objective and the inventory.

**4b. Ada against the room.** First, a fault of ours that explains much of "she does not look like the same character": **she faced the
wrong way.** The game's heading is the sim's (`atan2(dx, dz)`, 0 faces +z toward the play camera, the old spawn's pi faces north) and the kit's
painted figure has its own zero, half a turn away (an entity's yaw 0 faces -z). The game passed its heading as it was, so she was drawn
facing the camera at the spawn, where the old game shows her back, and she walked backwards in the picture (the creature too). `kitYaw` turns
it at the one place the figure is posed (`features/figures/figure-view.ts`), for the sim's heading and for a cutscene's facing alike; the test
that failed first walks a figure north and checks she is drawn facing away. See `ada-old-against-ours-back.png` (old left, ours right).
The cutscene's other facings (a quarter turn to the board, and so on) are not checked against the old game; the opening's is.

Her reading, measured on the play frame at the spawn (mean over boxes inside the figure, and over the floor on the same rows and around her
feet; luma 0 to 255, saturation 0 to 1 as HSV):

| | Old, graded | Old, no LCD and dither | Ours now |
|---|---|---|---|
| Her shirt, luma (sat) | 40.0 (0.33) | 44.7 (0.31) | 138.3 (0.25) |
| Her trousers, luma (sat) | 39.8 (0.49) | 44.0 (0.46) | 49.4 (0.91) |
| Her hair, luma (sat) | 41.4 (0.41) | 44.5 (0.35) | 73.0 (0.69) |
| The floor on her rows and at her feet, luma | 54.2 | 60.4 | 84.4 |
| Her (shirt and trousers) over the floor | 0.74 | 0.73 | **1.11** |

The old Ada is a dark figure against the floor (0.74: darker than the floor under her, a silhouette); ours is brighter than the floor under her
(1.11) and her trousers are saturated (0.91 against 0.49). **The kit's bound is that a figure is no brighter than 1.1 times its ring** (`HOT`
in the reads): by this rough measure (boxes, not the kit's depth-buffer mask) she is at it and a hair over, so the kit's exposure does not
clearly hold her inside its bound; it was never measured on this level (nothing in the game or the kit's browser tests measures a figure's read: `figureReads`
needs the frame's two depth buffers, which no test gives it). **How much is the missing grade and vignette:** the old frame with the LCD
and dither off is 10% brighter than with them (44.3 against 39.9 for her, 60.4 against 54.2 for the floor), and the retro grade (palette, fade,
saturation 0.85, warmth) and the vignette are in both old frames, so these two frames cannot separate them. The floor tells the order: ours is
1.4 to 1.6 times the old floor, which the grade and vignette plausibly account for. They cannot account for her being above her floor
where the old Ada is 0.74 of hers: that difference is the clothes (a cream tee in place of the dark maroon waistcoat and shirt, held with the
wardrobe) and the sprite light (the old figure sat in the room's own light; ours is lit by the painter's sprite light at the lamps' pools).
Nothing was changed for this: it is a number for the Owner and for the wardrobe work, and any darkening of her by hand would be a guess.

**4c. The hall's dressing after the meshes.** Present now, from the old game's own models: the waiting bench with its three seats, the
wheelchair, the bed with the overbed table, the drip stand, the filing cabinets, the drawers, the clock, the wall television, the coat hook, the
trolley, the bins, the plants, the folding screen and the chair on its side. Still different, and why:
- The noticeboard (the cork board with notes behind the desk), the posters, the notes and papers on the floor and walls, and the scratches:
  they are decals and lettering the old game's dressing rules placed; the level format has `decals` and `lettering`, and the prologue's level has
  none authored (a hand job for the dressing, or the world kit's dressing: workstream 4).
- The ward's curtains (green, on rails), the ward curtains' fire: not props of the old table; the old game drew them as dressing, and the kit
  has no curtain prop.
- The teal glazed-tile wainscot and the checker tint of the old floor: the kit has no such swatch (named in "What is left" above).
- The moonlight slats across the floor: the old game's window light; the level has the moon lamps (`neon`) and no light shaft (`shaft` on a lamp).
- The supply room's shelving: the stock boxes stand in the air; the old shelf boxes were colliders and shelf geometry the level lacks.
- The corner minimap and the objective marker: the HUD (editor ledger row 15), not the dressing.
- The look: the LCD panel, the vignette and the retro grade (held: `claude/builders-look-effects`), and Ada's wardrobe (held: FigureBuilder's wardrobe branch).
- The models take the room's light by a flat material and not by the bake: they read 0.65 to 0.88 of what the generated props did (see above), which
  is a framework decision waiting on the coordinator.
