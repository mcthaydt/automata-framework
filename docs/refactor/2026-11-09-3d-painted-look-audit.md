# 3D at the builders' level: painted figures and the builders' look (audit)

**Date:** 2026-11-09. **Stage:** 1 of 6 (audit) for this area. It changes no code. The plan stage writes the plan and
spec from section 12.

**Asked by the Owner** (in the "Show the 3D examples and Emberwick" thread):

- 06:30, on the FigureBuilder fork's ad: "this is the level of detail the characters with figure builder have?"
- 06:52, on a decision card: "Painter sprites in core".
- 06:53: "We should only ever do 3D figures with the painter, cut whatever crap we were doing before".
- 06:54: "Use the environment builder, now the 3D editor, to make a scene that doesn't look like shit".
- 06:58, on a 15 s video of the builders' shots: "this it what we were doing with figure builder + environment builder;
  it needs to be this level".

**Measured at:** AF `47391563` (#567, the stack's tip), FigureBuilder `025ffb4` (its `main`, the commit AF's figures
were ported from), EnvironmentBuilder `6d82a52` (its `main`, with FigureBuilder pinned at `50235f4`). Node 22 on this
session's x86 container. No phone, iPad or GPU was available.

**Evidence** (project files, `3d-look/`): `figures-density.png` (today's mesh figures beside FigureBuilder's painter at
1× and 2×), `reference-shots.png` (the Owner's video, a frame every 2 s), `eb-base-interior.png` (EnvironmentBuilder's
own render of its base interior, made for this audit). The Owner's base-scenes image is
`3d-examples/environmentbuilder-base-scenes.png`.

## 1. The bar

The Owner's video and the base-scenes image are the acceptance targets, for the figures and for the rooms. What they
show, frame by frame:

- **Figures** painted as pixel art: 100 to 125 pixels tall in a room (the base pair at density 2), a drawn face (eyes
  with whites and lids, brows, lips), hands, a dark outline, light in whole steps along each colour's ramp, a rim on the
  lamp's side, a contact shadow and a shadow thrown along the key. In first person a face fills a quarter of the frame.
- **Rooms** in photo textures snapped to DUEL: plank walls, checker and carpet floors, brick, tiled ceilings, wet
  asphalt. Furniture, plants, shelves, cars, a street lamp, a tree, a shop sign with letters ("OFFICE").
- **Light:** pendant and floor lamps with pools of light and a glow, light in steps, haze, night and day, rain with wet
  reflections, a sky with clouds and a city on the horizon.
- **Views:** a cut-away diorama of a whole floor, a first-person corridor, a side-on street.

## 2. What AF draws today

| # | Finding | Evidence |
|---|---|---|
| F1 | Figures are `@pixi/3d` meshes in one flat colour per material, a tone step drawn as ±18% of that colour | `packages/3d/src/features/figures/view/figure-colour.ts` (`SHADE_STEP = 0.18`), `figure-meshes.ts` (Flat or Phong material per name) |
| F2 | The face is point marks drawn as quads; FigureBuilder's drawn face (iris, lash, whites, brows, lips by the head's shape) and its hand stamp were never ported | `figure-decals.ts`; FigureBuilder `paint/paint.ts` `FaceStamp`, `HandStamp` |
| F3 | The painter's material fields were cut from the swatch format, so a figure's colour is one DUEL step | `figure-swatch` files say "Painter-only fields (ramp, base, lift, floor, grain, strands, rim, wear, streaks, paint, tones, holo) are dropped"; `swatch.schema.ts` keeps `ramp`, `step`, `gloss`, `flat` |
| F4 | The figure format cut the sprite fields (`face.camera`, `face.turn`) the painter's head turn reads | `figure.schema.ts` header |
| F5 | The outline is off | `look/library/look.json` `switches.outline: false` |
| F6 | The field is 180 pixels on its short side. With the Owner's 24 mm lens a metre at distance *d* is 180 ÷ *d* pixels: 36 at Ember Hall's 5 m (FigureBuilder's density 1 is 36.9), 25.7 at its goal view's 7 m. Wick (1.2 m) stands about 39 pixels tall. The base-scenes image's figures are at density 2 (73.8 a metre) | `look/target-size.ts`; `camera/fov.ts` (`2·atan(12/24)`: tan of the half angle is 0.5); `games/base-3d/content/levels/room.af-sector.json` views |
| F7 | The world kit's 39 photos and 62 photo tiles exist, but no tile reaches a frame: the renderer draws every piece in its swatch's flat colour, and world meshes carry no texture coordinates | `packages/3d/src/app/world-view.ts` (`colourOf(tileName(piece.surface))`, positions, normals and indices only); tiles are read only by `extensions/world-kit/src/features/textures/` |
| F8 | Rain, stars and the glow are the world kit's passes; the haze, wet reflections, light shafts, the grade's moods, particles and figure shadows were never ported | `extensions/world-kit/src/features/sky/`; EnvironmentBuilder `paint/post.ts`, `look.json` switches |
| F9 | Levels 3D can place a game's own props, lamps and characters, but core's props are only `box`, `cylinder`, `table`, `bin`, `lamp`, `streetLamp` and `tree`; the kit's library, its dresser and its photo swatches cannot reach the editor, which never imports an extension | `packages/editor-3d/src/shared/things/thing-def.schema.ts` (groups furniture, characters, lamps from the game's content); the 3D scope trim's ruling "the editor is core and never imports an extension" |
| F10 | The editor draws characters as boxes: "the editor does not run the game's figure builder" | `packages/editor-3d/src/features/levels-3d/dollhouse/stand-ins.ts` |
| F11 | Ember Hall has no art pass: a bare room of flat swatches, crates and barrels, orange boxes for embers, no lamp | `games/base-3d/content/world-swatches/`, `world-props/` (crate, barrel only), `src/features/embers/ember-view.ts`; `3d-examples/compare.png` |
| F12 | ADR 0007 chose passes for figures and rejected a painted figure because it "loses the figure's live lighting"; the 3D scope trim cut "the CPU reference painters" as a test oracle | `docs/adr/0007-3d-look.md`; `2026-11-07-3d-scope-trim.md` section 2 |
| F13 | FigureBuilder drops the far eye in a turned made pose: its sunglasses check counts the ear, a head part painted from the skin's own ramp (`skin~ear`), as something worn over the eye when it sits a texel beside it, and `eye()` returns before drawing. Seen on base-f at density 1 (pitch 18° and 25°) and base-m at density 2 (25°) and density 1 (18°); the standing 45° views draw both eyes at both densities | FigureBuilder `paint/paint.ts` `shaded()` and `eye()`; the eye row at the front template (`faceAt` view 0) holds part 1001 (an ear) in `skinBrown~ear` beside the far eye |

F12 is answered by how EnvironmentBuilder and The Last Light (the Owner's own Pixi 3D game) light a painted figure: the
painter writes a normal map beside the colours, and the room's lamps light that finished cell every frame (a flat
light, one ramp step of form, a rim). The light stays live; only the painting is cached.

## 3. Measurements

### FigureBuilder's painter, one cell

FigureBuilder `025ffb4`, the base pair walking and turning, the cell cache off so every pose step rasterises and
paints, 600 updates after a warm-up (the script is in project files, `3d-look/scripts/figurebuilder-paint-timing.ts`):

| Density | Cell | Paints | Median | p95 | Max |
|---|---|---|---|---|---|
| 1 | 64 × 96 | 156 / 191 | 11.5 / 10.5 ms | 19.3 / 14.9 ms | 25.6 / 22.8 ms |
| 1.5 | 96 × 144 | 156 / 191 | 12.9 / 17.4 ms | 20.2 / 22.7 ms | 34.9 / 35.7 ms |
| 2 | 128 × 192 | 156 / 191 | 20.0 / 23.1 ms | 29.0 / 29.5 ms | 32.1 / 41.0 ms |
| 3 | 192 × 288 | 156 / 191 | 38.0 / 41.1 ms | 43.6 / 49.5 ms | 54.4 / 66.9 ms |
| 4 | 256 × 384 | 156 / 191 | 70.9 / 73.6 ms | 82.8 / 90.0 ms | 94.6 / 117.3 ms |

(base-m / base-f.) A phone is slower than this container, so a new cell at density 2 does not fit in one frame of a
phone's 33 ms. A walk is 8 poses in each of 8 directions: 64 cells, about 1.3 s of painting at density 2, once, after
which every step is a cached cell. FigureBuilder caches up to 384 cells; a density-2 cell with its normal map is
196,608 bytes before the cache trims empty rows, so the cap must be in bytes, not cells.

### EnvironmentBuilder's scene painter, one frame

EnvironmentBuilder `6d82a52`, the base set (`npm run render`): 2.1 to 8.2 s per map for its diorama and first-person
frames, building included. Built once, then 24 frames drawn (`3d-look/scripts/environmentbuilder-frame-timing.ts`):

| Scene | View | Size | Build | Frame median | Frame max |
|---|---|---|---|---|---|
| base-interior | diorama, density 2 | 512 × 320 | 1,042 ms | 103 ms | 533 ms |
| base-interior | first person | 320 × 200 | 282 ms | 304 ms | 1,895 ms |
| base-exterior-dressed | diorama, density 2 | 640 × 360 | 1,382 ms | 931 ms | 1,172 ms |
| base-exterior-dressed | first person | 320 × 200 | 401 ms | 162 ms | 758 ms |

The budget is 33 ms a frame on a phone and 16.7 ms on an iPad (ADR 0007). On this container the CPU scene painter is 3
to 28 times over a phone's budget before the phone's own slowness. It is a renderer for stills and shots, which is
how the Owner's video was made.

## 4. Can EnvironmentBuilder's CPU painter be AF's 3D renderer?

Not for a game. Every frame of a game moves the camera or a figure; at 100 to 900 ms a frame a game would run at one to
ten frames a second on this container and slower on a phone, and the first-person view is the slowest. It would also
make Pixi a screen for a CPU image, which ADR 0002 and law 6 ("PixiJS only for rendering") do not intend, and the
3D editor's views (Plan, the dollhouse, Walk) would each need the same CPU frame.

What works, and what the Owner's own The Last Light already does on Pixi 3D: **Pixi 3D draws the room every frame, in
the builders' look, and the figures are FigureBuilder's painted cells, lit live and placed in the room.** EnvironmentBuilder's
rules come across as data and passes, not as its rasteriser: photo tiles drawn as textures, light per vertex in whole
steps, the DUEL snap with its dither, haze, lamps from the kit, glow, rain, reflections. This is decision **D1**
(section 11), recommended **A**.

## 5. Figures: the painter, and nothing else

The Owner's ruling: the painter is the only way a 3D figure is drawn. The mesh figure is deleted, not kept beside it.

### What ports, from where

From FigureBuilder `025ffb4`, the same commit AF's figure generator came from, so the parts the painter reads are the
parts AF already builds:

| Source | Lines | Into `packages/3d/src/features/figures/` | Notes |
|---|---|---|---|
| `paint/raster.ts` | 310 | `paint/raster.ts` | the G-buffer, resolve, clean-up, the neckline rule, joins, contour, decal and print stamps, `noise3` |
| `paint/paint.ts` | 1,535 | `paint/` split by job, each under 600 lines (tones and the palette, the face stamp, the hand stamp, the painter, folds and strands, materials such as holo and stain) | AF's file limit |
| `paint/duel-ramps.ts` | 38 | none | AF has `DUEL_RAMPS` in `@automata/content/palette`; check the two are the same table |
| `paint/fabric.ts` | 41 | the fabric registry AF already has | H5 |
| `figure/cloth.ts` | 97 | `paint/cloth.ts` | cloth coordinates for a fabric |
| `figure/figure.ts` (the soup, the hand shapes, the drawn face, the cell cache, the 8-direction snap) | about 300 of 521 | `view/figure-cell.ts`, `view/cell-cache.ts` | AF keeps its own `evaluate()`, clips and hair spring: one timeline |
| `lighting/*` | 190 | none | AF lights the finished cell in the room (below), as EnvironmentBuilder does; FigureBuilder's own key bands stay in the painter |

And from EnvironmentBuilder `6d82a52`: `stage/sprite-light.ts` (155 lines, the cell lit texel by texel from its normal
map) replaces AF's part-level `look/sprite-light.ts`, and `stage/cast.ts`'s placement, depth test, haze and shadow rules
become the figure's composite (below).

Every ported file gets its row in `docs/provenance/sources.md`, and is rewritten in AF's style (kebab-case names, one
job a file, no `!`, comments that say why).

### The format comes back

- The swatch gains the painter's optional fields: `lift`, `paint` (a hand-picked ramp), `tones`, `strands`, `sheen`,
  `streaks`, `mix`, `stain`, `holo`, `see`, `fabric`. A swatch with none paints from its DUEL row, so no game file breaks.
- A built material becomes the painter's material: the ramp's row, `base` = the step plus the variant's `shade`, `flat`,
  `gloss`. AF's variants (`<swatch>@<role>`) map one to one.
- The figure gains `face = { camera, turn, blink, drawn }` with FigureBuilder's defaults; a decal regains `density` and
  `print`.
- The base pair's swatches take FigureBuilder's `paint` and `tones` (its skin swatches have both), so the base pair
  paints like FigureBuilder's.

### Drawing a figure in the room

1. The figure view builds the parts once per outfit and item, as now, and poses them with AF's `evaluate()`.
2. The painter draws a cell at a **density** set by the camera: the field's pixels a metre at the figure's depth, over
   36.9, rounded to a step of 1/16, held between a least and a most the look names. A walk toward the camera repaints
   only when the step changes. The 8 directions and a 2° pitch step are FigureBuilder's.
3. Cells are **cached** by pose, direction, pitch and density, with a cap in bytes. On load a figure **prewarms** its
   walk and idle. A new cell is painted at most once a frame and never blocks it: the view shows the last cell until the
   new one is ready. If the iPad misses its budget with this, the painting moves to a worker (same-origin file, so
   Ruken's `script-src 'self'` holds; no `blob:`).
4. The **sprite light** lights the cached cell each frame from the room's lamps at the figure's chest: the flat light,
   one ramp step of form, the rim. It is cheap and it is what keeps the light live.
5. The cell is **composited at whole field pixels** after the DUEL snap and the outline pass, with each texel's own
   depth (the painter's G-buffer plus the figure's root) tested against the scene's depth, so a table hides a figure's
   legs and the world's outline never draws a second line round FigureBuilder's own. The haze is applied at the
   figure's depth on the CPU, as EnvironmentBuilder does, so a figure in haze matches the room. This needs a custom
   `Pass3D` that samples the cell atlas and the view's depth on WebGL2 and WebGPU (a `PostEffect` takes no extra
   sampler, ADR 0007). The first task proves it; if it cannot be done, the fallback is The Last Light's `Sprite3D`
   billboard with an alpha cut, drawn before the passes, and a test that the snap leaves every DUEL colour unchanged at
   every Bayer cell.
6. A **contact shadow** under the feet and the silhouette thrown along the key onto the floor (EnvironmentBuilder
   `shadowOf`), drawn on the floor before the figure.

### What is deleted

`figure-meshes.ts`, `figure-skin.ts`, `figure-decals.ts`, `figure-colour.ts`, `figure-joints.ts`, the Flat and Phong
branch of `figure-view.ts` (526 lines in `view/`), their tests (505 lines in `tests/unit/figures/view/`), the part-level
`look/sprite-light.ts` and the figure's use of `light.tint`. `figure()` keeps its name and its options, so the 18 files
that call it change only where they read meshes. The editor's `person` stand-in goes: Levels 3D and the Studio draw the
painted figure.

Kept: the body, rig, genes, profiles, motion, clips, hair, garments, the five registries and `build()`. A test that
compares built parts ("the base pair and Wick are the same with or without the kit") still holds; one that counts
meshes or materials is rewritten against the cell.

## 6. The world in the builders' look, on Pixi 3D

| EnvironmentBuilder | Source | AF today | The work |
|---|---|---|---|
| Every material is a photo, cut to a DUEL tile | `photo/`, `photos.json` | the pipeline and 62 tiles in the world kit, never drawn (F7) | world meshes get texture coordinates from the surface's placement (`world/surface.ts` already computes the frame); a tile material samples the tile's labels nearest-neighbour and lights each texel by whole steps along its own ramp, as `paint.ts onRamp` does; the tile's texels a metre are made for the field's |
| Light per vertex, stepped, Gouraud, one dithered snap | `paint/vertex-light.ts`, `look.json light.step` | `shared/render/light/vertex-bake.ts`, `vertex-light.ts`, the stepped `RampMaterial`, the snap | check the stepped light against EnvironmentBuilder's on the base interior, number by number; the tile material reads it |
| Occlusion from the sector map | `paint/occlusion.ts` | `shared/render/light/occlusion.ts` | none beyond a check that it is on |
| Lamps from the kit | `look.json kit` | `lamp-kit.ts`, `lamp-kit.json` | the lamp's glow and pool on the floor read as the base interior's |
| Haze | `paint/colour.ts` (`hazed`) | linear fog only | the haze as a pass before the snap, its colour the light's; figures hazed the same way |
| Sky, clouds, the horizon | `paint/` sky | core's sky and horizon | clouds as in the base exterior |
| Stars, rain, glow | `paint/` | the world kit's passes | into core with the world kit (section 7) |
| Wet reflections, light shafts and motes, bloom | `paint/post.ts` | none | passes, each with its switch, GLSL and WGSL |
| The grade's moods | `post.ts grade` | `grade: time` | the moods as data |
| Particles (embers, dust) | `post.ts particles` | Ember Hall's orange boxes | an emitter view drawn as field pixels |
| Figure shadows, bounce | `stage/cast.ts` | none | section 5 step 6; bounce off, as EnvironmentBuilder's |
| The outline | `look.json` (off there too) | off | on for Ember Hall's world (part 2); figures carry their own |

**The field.** The base-scenes image is at density 2, and EnvironmentBuilder's diorama is 640 × 360. At the Owner's
5 m a field of 360 on its short side puts a figure at density 1.95 (`360 ÷ 5 ÷ 36.9`): Wick about 78 pixels tall and the
base pair about 115, as in the target. The field is 360 (the Owner, 07:27: "Bump it to 360 then"). It is four times
today's pixels, so the frame time is measured on the GPU runner (task 9) and listed for the Owner's iPad; a miss goes to
the Owner rather than quietly lowering the field. This is ruling **R3** (section 11).

**First person.** The Owner's video has first-person shots. A face that fills a quarter of a 320 × 200 frame is
density 4 or more: 71 to 117 ms a cell here. The plan adds a first-person camera view only after the third-person look
lands and the cell cost is measured on the iPad.

## 7. The world kit comes into core

The Owner calls the 3D editor "the environment builder" now, and the target is made of the world kit's things: its
props, the dresser and its kits, the lettering and signs, the photo swatches and tiles, the sky passes. The editor is
core and does not import an extension, so for Levels 3D to place them they move into `@automata/3d` (reading **R1**):

- `extensions/world-kit/src` (5,419 lines), its `library/` (912 KB: props, kits, swatches, glyphs, words, maps, tiles)
  and `assets/photos/` (39 CC0 photos, 2.9 MB, credits in `photos.json`) move into `packages/3d` by feature.
- The photo pipeline's Node command (`automata-world-textures`) moves to `@automata/tools`, the one Node tools package.
- The extension goes; `dressedBaseScenes` becomes core's dressed base scenes, as both builders have them.
- The 3D scope trim's rows for props, the swatch library, kits, decals and lettering, generated maps, the photo pipeline,
  `reads`, and stars, rain and bloom are reversed, and its "Fill with furniture" cut from Levels 3D (16.2) with them.
  The trim's section 2 gets a line pointing here; the rows stay readable.
- The character kit stays an extension: the Owner's override is for drawing figures, and a wardrobe is not needed for
  the target. Its garments paint through the same materials.

## 8. Levels 3D as the environment builder

What the editor must do for the end proof, beyond what it does today:

- **Props:** the kit's whole library in Furniture, beside the game's own, each with a thumbnail.
- **Lamps:** the lamp kit's kinds (`pendant`, `bulb`, `desk`, `fluorescent`, `sodium`, `neon`), a colour kept within
  the kind's tone, on or off, and its pool shown in the 3D view as the game draws it.
- **Materials:** the photo swatches in the material sheet, with their tile as the swatch, for floors, walls and
  ceilings (the complete-game journey marks "no way to change a floor's material" as failing today).
- **Furnish a room:** a purpose and a number (the dresser's `dress`), then take a piece out or move it (`remove`,
  `pin`). Copy passes the drunk grandma test: "Furnish this room as… an office".
- **Time of day:** pick it for the level, and see it.
- **The views draw the game's look:** painted figures in place of stand-ins, tiles, the lamps' light, haze, at the
  game's field. Touch targets stay at 44 and 48 pixels; the phone layout first.

## 9. Ember Hall's art pass (part 2)

Made in Levels 3D, not by hand, so the room is the editor's work (the Owner wants game content made in the editors).
Wick painted at density 2; stone or plank walls and a worn floor from the photo swatches; lamps from the kit with pools
of light and a glow; props from the kit (crates, barrels, shelves, a table); a sky through a window or an open roof; the
haze; real embers as glowing particles with a glow; the world's outline on. The replay hash does not move: all of this
is presentation (the 3D scope trim's rule for Ember Hall's room).

## 10. The end proof

One journey, in Chromium at iPad and phone size, on a temporary copy of a new 3D game:

1. In Levels 3D, make a room in the builders' look: photo walls and floor, two lamps from the kit, a room furnished as
   a waiting room and one piece moved, a time of day, two characters.
2. Save; reload the page; close and reopen the editor; the room is as it was.
3. Play it from the editor. The game draws what was made: the tiles' colours where the walls are, the lamps' pools,
   the painted figures standing in them.
4. The frame is put on a board beside `environmentbuilder-base-scenes.png` and frames of the Owner's video, and the
   figures read against the room by at least 1.1 (the world kit's `readsAgainst`, The Last Light's rule).

The Owner judges the board, and plays it once on the iPad. Ember Hall's art pass is the second proof, made the same way.

## 11. Decisions and readings

- **D1 (the Owner's): how the rooms reach the builders' look.**
  - **A (recommended):** the builders' look rebuilt on Pixi 3D (photo tiles, stepped light, haze, lamps, glow, rain,
    reflections), with FigureBuilder's painted figures in it. Live at any camera; The Last Light's way.
  - B: EnvironmentBuilder's CPU painter draws every frame. Its exact pixels, at 100 to 900 ms a frame here.
  - C: the CPU painter for fixed cameras only: each camera's room painted once, figures composited live. No turning
    or walking camera, and no first person.
- **R1:** the world kit moves into core (section 7), because the 3D editor is the environment builder now.
- **R2:** the painter replaces the mesh figure everywhere, the editors included (the Owner, 06:53).
- **R3 (the Owner's, 07:27):** the field's short side is 360 (section 6). Its frame time is measured; a miss is the
  Owner's call.
- **R4:** this reverses ADR 0007 for figures (a new ADR 0008: "3D figures are painted"), and law 6 holds: Pixi 3D draws
  every frame, and a painted cell is a texture it draws, as an atlas is. ADR 0002's consequences get the note.

The Owner may overrule any reading; the plan follows the decision and the readings as written until then.

## 12. Work the plan should cover, in order

Each task is test-first. "Measured" means a number from an artifact.

**Phase A: proofs first**
1. A spike: a `Pass3D` that draws an RGBA cell at whole field pixels with a per-texel depth test against the view's
   depth, on WebGL2 and WebGPU, with the snap and the outline before it. Pass or fall back to `Sprite3D` (section 5
   step 5). ADR 0008.
2. The painter's oracle: FigureBuilder `025ffb4` writes the base pair's built parts and its painted cells for 8
   directions and the walk at densities 1 and 2 to a fixture (a script run once, its output committed with the commit
   it came from). AF's port must give the same bytes.

**Phase B: figures painted**
3. The format: swatch and figure fields (section 5), Zod, with the content kinds' tests.
4. The painter's port (section 5 table), its FigureBuilder tests ported (materials, neckline, prints, fabric, cloth,
   eyes), the oracle passing. The port fixes F13: the sunglasses check counts a part painted from the skin's own ramp
   (the ears) as skin. A test draws the base pair at every direction, stand and walk frame, densities 1, 2 and 4 and
   pitches 18° to 35°, and finds both eyes wherever the face's template shows both. The oracle's cells that change
   (the turned made poses) are named, and the fix goes upstream to FigureBuilder too.
5. The cell: density from the camera, the 8 directions, the cache with its byte cap, prewarm, one paint a frame.
6. The sprite light from EnvironmentBuilder, on the cell; the composite (task 1's pass); haze at depth; the shadows.
7. Delete the mesh path (section 5) and move every caller: Ember Hall, the 3D story examples, the figure and look
   examples, the character kit's and the wardrobe example's parity tests, the create-game templates, the frame-budget
   stress page, the Studio, Levels 3D's stand-ins. The parity images that show figures are re-recorded, each move
   explained in its commit.
8. The same cells in every engine: the oracle's cells hashed in Node, Chromium, WebKit and Firefox. A mismatch is
   investigated (the painter's `Math` calls first), never accepted.
9. The budget: Wick and three others walking at density 2, every pass on, on the GPU runner; the Owner's iPad and
   phone runs listed as the Owner's.

**Phase C: the world's look**
10. Into core: the world kit (section 7), with its tests; the Node command into `@automata/tools`; `pnpm boundaries`,
    `knip` and the API report updated.
11. Texture coordinates and the tile material (section 6), proved on the base interior and the base exterior.
12. The haze; then glow and bloom, rain, stars, reflections, shafts, the moods, particles: one task each, each a GLSL and
    WGSL pair with its switch and a WebGL2/WebGPU parity image.
13. The field at 360 (R3), with this phase's frame times on the GPU runner beside task 9's.
14. A board script: AF's base interior and base exterior beside EnvironmentBuilder's renders and the Owner's frames, for
    every look change from here.

**Phase D: the editor**
15. Levels 3D's Furniture, Lamps, Materials, Furnish, Time of day (section 8), each with a DOM test, a layout test at phone
    and iPad size and a journey step. Copy in `copy.md`.
16. The editor's views draw the game's look and the painted figures.

**Phase E: proofs**
17. Ember Hall's art pass, made in Levels 3D (section 9); its replay hash unchanged.
18. The end-proof journey (section 10), with the reload and the reopen.
19. First person, only if the Owner asks after seeing 17 and 18.

## 13. Risks

- **The painter's cost on a phone.** 20 ms a density-2 cell here; a phone may be two to four times slower. Prewarm,
  the cache and one paint a frame keep it off the frame; the worker is the step after.
- **Memory.** 196 KB a density-2 cell; a byte cap, and cells for poses not shown in a while dropped first.
- **Engines.** The painter uses `Math.sin`, `cos`, `pow` and `atan2`, which engines may round differently. Task 8 finds
  out; the fix is the painter's, not the test's.
- **Eight directions.** A painted figure turns in 45° steps while the camera turns smoothly. That is the sprite look the
  Owner chose; the Studio shows it so it is no surprise.
- **The beta.** A custom `Pass3D` that samples two textures is new to AF on `@pixi/3d` 0.1.0-beta.2; task 1 settles it
  before anything else depends on it.
- **Four times the pixels** at 360. The Owner's ruling; task 9 and task 13 measure it, and a miss on the iPad goes back
  to the Owner.
- **Size.** Core grows by the painter (about 2,400 lines) and the world kit (5,419 lines, 3.8 MB of data and photos).
  The 3D package is private until Pixi 3D is public, so nothing published grows yet.
- **Licences.** FigureBuilder and EnvironmentBuilder have no licence file (3D slice audit, B9). AF already carries code
  ported from both under the Owner's direction; the provenance rows record it. Still open for the Owner, as before.

## 14. What this audit ran

- Read: AF's figure view, look, world view, Levels 3D's things and stand-ins, the 3D scope trim, ADR 0002 and 0007, the
  3D slice audit's D9 and D10; FigureBuilder's painter, raster, figure and frames; EnvironmentBuilder's figure door,
  sprite light, cast and renderer; The Last Light's notes (EnvironmentBuilder `docs/reference/the-last-light/`).
- Ran: FigureBuilder's painter timing and the base pair at densities 1 and 2; EnvironmentBuilder's base set
  (`npm run render`) and its frame timing; `pnpm build` at `47391563`; the editors' `complete-game-3d` and
  `work-survives-reopening` journeys in Chromium at iPad size: 8 of 8 as expected (3.5 min). Six pass: a new 3D game
  made with every editor and played, Feel and Audio, Writer, Sequence, Schematic, and the reload, closed tab and
  restarted editor. Two fail as they are marked to: a floor cannot be given another material in Levels 3D, and Publish
  refuses the game while Pixi 3D is a closed beta. The first is section 8's Materials.
- Not run: WebKit, Firefox, a phone, an iPad, the GPU runner, `3d.yml`. No code changed.
