# 3D core as light as 2D: scope trim and refactor pass

**Date:** 2026-11-07. **Asked by the Owner:** "Make sure we're not overscoping 3D, it should be as lightweight as 2D,
everything else should go into plus" (19:28), then "And we're doing refactors too right? Like we aren't just moving
stuff around right?" (19:31). Since 15:05 "plus" means AF's own `extensions/<name>` (the Plus port spec). Accepted under
the standing rule: "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals"
(Owner, 2026-10-31).

**Applies to:** the [3D plan](2026-11-07-3d-slice-plan.md) (amended in place, task numbers kept) and the Plus port plan
(`2026-11-07-plus-port-plan.md`, on the port's branch; its addendum is section 6 below, copied into that plan by the
port's build thread).

**Measured at:** `78e0ca7f` (the 3D build, task 7.3 in progress) and `da94d726` (the Plus port build, PR #458).

## 1. The bar: what 2D core is

2D core draws what the game authored and ships no content library and no generator:

- `packages/automata/src/features/render/`: 1,647 lines (renderer, camera, letterbox, sprite and pose views, one
  post-filter slot).
- `packages/content/src/shared/level-2d/`: the level format and its checks (839 lines).
- The palette (DUEL) is the one shared table. No tileset library, no level generator, no furnishing, no lettering, no
  weather, no CPU painter. Emberwick uses core only (`--no-extension-imports packages games/emberwick`).

`packages/3d/src` at `78e0ca7f` is 22,695 lines of TypeScript plus 2,325 lines of library JSON. Of that, about 4,200
lines are content libraries and generators the rule moves out (section 2). The figure generator stays, because in 3D
it is what a sprite sheet is in 2D: the only way a 3D game gets a character (the Owner, 2026-10-23: "procedural only
for now").

**The 3D rule, from the 2D bar:** core is what draws a game's own data (its level, its figures, its props, its lamps,
its time of day) through the camera and the look; what a game needs before it can author anything (the level format,
the body, the motion, the registries a library plugs into); and what Ember Hall, the 3D reference game, uses. A
library of ready-made things (furniture, streets, clothes, hairstyles, signs) and the tools that fill a level for you
are extensions. Ember Hall uses core only, as Emberwick does.

## 2. The ruling, feature by feature

| Feature | Built? | Ruling | Why | Tasks |
|---|---|---|---|---|
| Camera, view latch, occluders, heading sim | yes | **keep** | 2D's `camera-2d`; the Owner's camera (24 mm, 25° down) needs the occluders | none |
| Renderer, no-eval sync, context loss | yes | **keep** | 2D's renderer | none |
| `af-sector/2`, its migration, `readLevel`, `LevelProblem` | yes | **keep** | 2D's `level-2d` | none |
| `convert-builder-map.ts`, `scripts/convert-builder-maps.ts` | yes | **move** to `@automata/world-kit` | converts the builder's sample maps, which go with the library | 7.3, port 3.7 |
| World builder (sectors, mesh, subdivide, surface, doors, windows, wall decor) | yes | **keep** | draws the level, as 2D draws tiles | none |
| Prop placement (`place-props.ts`, `props/piece.ts`, `props/resolve.ts`) | yes | **keep**, with a generator registry | a game places its own things, as 2D places entities | 7.3 |
| Prop generators (furniture, nature, signs, small things, street) and `props.json` | yes | **move** to `@automata/world-kit` | a library of ready-made things; core registers only `box` and `cylinder` | 7.3, port 3.7 |
| Swatch library (`swatches.json`, 1,223 lines) | yes | **move**; the swatches Ember Hall uses move into its own content | a library; the `world-swatch` kind stays so a game writes its own | 7.3, port 3.7 |
| Lamps, the lamp kit (`lamp-kit.ts`, `lamp-kit.json`) | yes | **keep** | lighting a game's own level; 79 lines | none |
| Kits and the dresser (`kits.json`, `dressSector`) | no (uncommitted) | **move** to `@automata/world-kit` as `dressLevel` | fills a level for you | 7.3, port 3.7 |
| Decals (dirt, posters) and lettering (`lettering.ts`, `glyphs.json`, `stream.ts`) | lettering yes | **move** to `@automata/world-kit` | signs are library things | 7.3, port 3.7 |
| Generated maps (`generateMap('apartment' \| 'block')`) and the converted sample maps | no | **move** to `@automata/world-kit` | a generator | 7.3, port 3.7 |
| The photo-to-tile pipeline (`automata textures`), the photos and the tiles | no (task 9.1) | **move** to `@automata/world-kit` (a Node entry and bin) | an art pipeline for the library's swatches; 2D core has no art pipeline beyond atlases | 9.1, port 3.8 |
| Declared `reads` checks and figure readability | no (9.2, 16.3) | **move** to `@automata/world-kit` | quality checks for the library's swatches and maps | 9.2, 16.3, port 3.8 |
| Time of day (six named times with their words) | yes | **keep** | the light a level names; data, as the palette is | none |
| One timeline (`shared/timeline/`) | yes | **keep** | clips, piece states and `@automata/cutscenes` share it | none |
| Piece states (`PieceStates`, `updatePieces`, `startClip`) | no (7.4) | **keep** | a door or lamp changing; small | 7.4 |
| Body, rig, profiles, IK, genes and face sliders | yes | **keep** | the figure is 3D's sprite | none |
| Motion (gaits, stands, holds, aim, solve, hems, hair spring), clips, actions | yes | **keep**; `seated.ts` and the `figure-seat` kind **move** | Ember Hall walks, rolls, reaches; nothing in it sits | 7.6, port 3.6 |
| Items (sword, shield) and figure lighting | yes | **keep** | Ember Hall uses them | none |
| The five registries (garments, outfit hooks, hair pieces, finishes, fabrics) | yes | **keep** | the seams extensions plug into; 387 lines | none |
| Garment kinds | yes, 15 | **keep 7**: `cap`, `cape`, `eyes`, `hair`, `shoes`, `top`, `trousers` (what Wick and the base pair wear); **move 8**: `apron`, `belt`, `coat`, `gloves`, `legs`, `mark`, `skirt`, `waistcoat` to `@automata/character-kit` | a wardrobe is a library | 7.6, port 3.6 |
| Hair: `locks` (Wick's hood and cropped hair), the skull, the cap's cut | yes | **keep** | Ember Hall uses them | none |
| Hair pieces `scalp`, `rows`, `tail`, `fall` (both shapes), `bun`, `sweep`, `block`, `edges`; finishes beyond the base | yes | **move** to `@automata/character-kit`, registered with `registerHairPiece` / `registerFinish` | hairstyles are a library | 7.6, port 3.6 |
| The `figure-headwear` kind | yes | **keep** (6.4's ruling stands: a style library a game fills, like hair styles) | a game's own content (`figure-headwear/flat.toml`), not a library core ships | none |
| glTF loading (`shared/render/model/`) | yes | **keep** | the authored-art path, as 2D loads atlases | none |
| The look: low-resolution target, DUEL snap and dither, ramp light, outline, sprite light, fog, grade | no (8.2) | **keep** | the Owner's look ("their pixel-art look too"; "We use pixi3D") | 8.2 |
| Sky with its horizon silhouette | no (8.2) | **keep** (amended 19:58: the base exterior needs it) | an open-sky sector is part of the level format; the base exterior is judged under it | 8.2, 7.7 |
| Stars, rain, bloom passes | no (8.2) | **move** to `@automata/world-kit` through a pass slot core adds | weather and skies are dressing; core gets `addLookPass`, as 2D has one post-filter slot | 8.2, port 3.8 |
| The CPU reference painters (`testing/look-reference/`) and `look-sheet.ts` | no (8.2) | **cut** | a second renderer kept only as a test oracle; 2D proves its look with parity images from the real renderer, and so does 3D | 8.2 |
| Examples: hair, wardrobe, furnished room, generated map | no (12.1) | **move** to the port (they show extensions) | | 12.1, port 3.9 |
| Levels 3D: Fill with furniture, the kit checks, readability hint | no (16.2, 16.3) | **cut** from the editor | the editor is core and never imports an extension; essential features only | 16.2, 16.3 |

**The base pair and the base scenes are core (Owner, 2026-11-07 19:58: "The base M and F figure should be in 3D
though, base interior and exterior too").** As in both builders, they are what every visual change is judged on, so
they ship with core: the base man and woman (bodies only, in painted-on blocks, barefoot: no garment and no hair, so
nothing they need left core), the base interior (a plain room at lamplight with a window, a doorway and a corridor
stub, a box, a table, a cylinder and a pendant lamp) and the base exterior (a pavement before a building face with a
door and two windows, a road a kerb lower, a street lamp, a round tree, open sky with a city on the horizon, by day).
For them core keeps, beyond `box` and `cylinder`, the generators `table`, `bin`, `lamp`, `streetLamp` and `tree`
(from `78e0ca7f`'s `furniture.ts`, `small-things.ts`, `street.ts` and `nature.ts`, those kinds only), the presets
`prim.box`, `prim.table`, `prim.cylinder`, `lamp.pendant`, `streetLamp` and `tree.round`, and the swatches the two
scenes name. The dressed variants (the interior as a waiting room, the exterior as a street) need kits, so they are
the world kit's. Task 7.7.

**Ember Hall's room:** no kit. It places a few `box` and `cylinder` props from its own `world-prop` content, keeps its
lamp and its time of day; its replay hash does not move (dressing is presentation).

**A level that asks for an extension the game lacks** (a sector with `dress`, a `sky` pass named by the look): core
keeps the field in the schema (the format is one), draws the room bare and reports a `LevelProblem` with code
`needs-extension` and `name: 'world-kit'`; it never fills the room some other way. Message: "This room asks to be
furnished by the world kit, which this game doesn't have. Add @automata/world-kit, or remove "dress" from the room."

**Size after the trim (measured again at 10.2):** 4,189 lines of libraries, generators, lettering and the converter
(`wc -l` at `78e0ca7f`), 1,233 of hair pieces and seats, and the eight garment kinds' share of
`outfit/garments/` leave `packages/3d/src`; the reference painters are never written.

## 3. Moving is not the refactor: findings

The Owner asked that this is a refactor, not only a move. Each finding names its evidence and the task that fixes it.

| # | Finding | Evidence | Fix | Task |
|---|---|---|---|---|
| R1 | Sector geometry lives three times: the editor, the `sectors` extension and the world builder each have their own | `polygonArea`, `insideSector`, `segmentDistance`, `crossing`, `opening`, `walkBlocker` in both `packages/editor-3d/src/geometry/sectors.ts` and `extensions/sectors/src/shared/sim/{queries,pieces}.ts`; `triangulate` in both `editor-3d/src/geometry/triangulate.ts` and `packages/3d/src/features/world/sectors.ts` | one owner: `packages/3d/src/shared/level/geometry.ts`, exported from `@automata/3d/level` (a sim entry, so it keeps the sim's rules); the others import it | 3D 7.5, 14.1; port 5.1 |
| R2 | Prop generators are one hard-coded table | `props/generators.ts` spreads five files into `GENERATORS` | `registerPropGenerator(kind, generator)`, throwing `RegistryClash` like the figure registries | 3D 7.3 |
| R3 | Hair pieces are one switch, not the registry core already has | `hair-parts.ts` (406 lines) builds every piece kind itself; `registerHairPiece` exists and core uses it for nothing | `hairParts` reads pieces from the registry; core registers none; `character-kit` registers all eight | 3D 7.6 |
| R4 | `fall` holds two shapes in one key | the 6.4 log: "the schema is a union of the two and the builder tells them apart by `from`"; the older one is used only by fixtures | `character-kit` keeps the newer `fall`; the older lock list becomes `locks`, which core already has; fixtures converted once | port 3.6 |
| R5 | Two functions named `sample` in one package | `shared/timeline/sample.ts` and `features/figures/clips/sample.ts` (the second blends handle poses) | the clip one is renamed `blendKeyPoses` | 3D 10.1 |
| R6 | Plan IDs in code comments | `M3 spec §4.4.4`, `ED3D.4`, `M3.6b`: 190 in `packages/3d/src`, 465 in `packages/editor-3d/src` | 10.1 and 17.2 already remove them; 17.2's count is now stated | 3D 10.1, 17.2 |
| R7 | `editor-3d`'s phase 14 is a pure move | 14.1's map relocates `geometry/*` to `shared/geometry/` | 14.1 deletes `geometry/{sectors,triangulate,loops}.ts` where `@automata/3d/level` covers them (R1) and moves only what is left | 3D 14.1 |
| R8 | The Plus port's phase 2 was layout moves ("no behaviour change") for most packages | task 2.6's title; only `feel` and `net` were rewritten (Effect out) | a refactor phase after the move (port phase 5) | port 5.1 to 5.4 |
| R9 | `ui-screens` repeats core's screens | `extensions/ui-screens` has `TitleScreen`, `PauseScreen`, `SettingsScreen`; core has `TitleScreen`, `PausedScreen` and `SettingsScreen` (`packages/automata/src/app/screens/`) | keep a screen only where it does what core's does not; a screen that does the same goes, its tests with it | port 5.2 |
| R10 | Three copies of the walking test helper | `stepWith` in `extensions/{nav,sectors,systems}/src/testing/` | one in `@automata/sectors/testing`; the other two import it | port 5.3 |
| R11 | Three extension files at the 600-line limit | `pipelines/src/shared/runner.ts` 592, `net/src/features/client/room/net-room.ts` 588, `net-server/src/features/room/engine/room-engine.ts` 560 | split by responsibility | port 5.4 |

Recorded, not changed: the Node file seams (`FileError`, `tryFile`) are written in `packages/tools`, `pipelines` and
`tooling/dev-tools`. Plus port P-D7 chose this ("the Node tools keep their own small file and process seams") so
that core does not publish them; sharing them would grow core's API for two private tools.

## 4. What changes in the 3D plan

Task numbers are kept, so the tracking table and the log still line up. Now 54 tasks: 9.1 and 9.2 leave for the port,
7.5, 7.6 and 7.7 join.

| Task | Change |
|---|---|
| 7.3 | Trimmed: props placed from the game's library through a generator registry, core's `box` and `cylinder`, lamps, `world-prop` and `world-swatch` kinds, `needs-extension`. The rest leaves `packages/3d` (section 2) |
| 7.4 | Unchanged |
| **7.5 (new)** | One sector geometry owner (R1) |
| **7.6 (new)** | Character-kit material leaves core: eight garment kinds, the hair pieces and their finishes, seats; `hairParts` reads the registry (R3) |
| 8.2 | No reference painters and no `look-sheet.ts`; stars, rain and bloom go; the sky and its horizon stay; core adds `addLookPass`; the parity images include the base scenes with the base pair |
| **7.7 (new, 19:58)** | The base pair and the base scenes in core, with the generators, presets and swatches they use |
| 9.1, 9.2 | Moved to the port (3.8). Their boxes are not ticked here; their rows say "moved" |
| 10.1 | Also R5 |
| 10.2 | The README lists what is core and points at the two kits |
| 12.1 | Three core examples (`figures-stand-and-sliders`, `look-pixel-art`, `world-time-of-day`); the other four go to the port |
| 12.2 | The template's content test has no `checkReads` |
| 13.3 | The stress room is Ember Hall's own room with core's passes |
| 14.1 | R7 |
| 16.1 | The kit's icons lose Furniture-fill; the Furniture tool places one of the game's props |
| 16.2 | No Fill with furniture, no `furnishAs`, no `checkReads`, no kit checks; a level asking for an extension shows the `needs-extension` sentence |
| 16.3 | Framing only; no readability and no "Wick is hard to see here" |
| 17.2 | R6's count: 465 in `packages/editor-3d/src` |
| Review Focus 4 | "a kit" → "a prop, a swatch, a time of day or an extension the game does not have" |

## 5. What changes in the 3D spec

Section 3 (Scope), 7 (layout), 8.2 (the registries and the wardrobe), 9 (the level) and 6 (the look) point here for
the trim; their tables are not rewritten, so the reasons stay readable beside the rulings.

## 6. Addendum to the Plus port plan

The port's build thread copies this section into `2026-11-07-plus-port-plan.md` as part B tasks 3.6 to 3.9 and a new
phase 5, and adds them to `plus-progress.md`. 19 tasks become 27. Global Constraints apply, and so does the house rule
of this document: **a port is also a refactor**. Each task below lists what changes, not only where code goes.

The source of each move is a commit already on the 3D build's branch (`78e0ca7f` for 7.3's library, and the commit 7.6
writes), so nothing is lost when core deletes it.

### Task 3.6: `@automata/character-kit` (after 3D 7.6)

**Files:** create `extensions/character-kit/` (`src/features/{garments,hair,seats}/`, `src/entries/index.ts`,
`character-kit.extension.ts`, `tests/`); `examples/3d/wardrobe/` (the streetwear example) registers its kinds next to
the kit's.

**Interfaces:** consumes `registerGarment`, `registerHairPiece`, `registerFinish`, `registerFabric`, `profiles`,
`girth`, `Pose`, `Track` from `@automata/3d/figures`; produces `characterKitExtension` (registers the eight garment
kinds, the eight hair pieces, the extra finishes and the `figure-seat` kind) and `seated(...)`.

- [ ] **Step 1: Failing tests:** `a figure in a skirt fails with "No garment called skirt" without the kit and builds
  with it`; `a style with a bun builds only with the kit`; `the base pair and Wick are the same with or without the kit`
  (mesh equality); the ported goldens for the kit's kinds.
- [ ] **Step 2:** FAIL. **Step 3:** the move from the 3D commit, then the refactor: R4 (one `fall`), one schema file per
  piece kind beside its builder, no piece kind known by name outside its own file. **Step 4:** PASS; 3D's goldens
  unchanged. Grandma test on the kit's README. **Commit** `feat(character-kit): clothes, hairstyles and seats for 3D figures`

### Task 3.7: `@automata/world-kit`: props, furnishing, signs, maps (after 3D 7.3 and 7.5)

**Files:** the base scenes' dressed variants (`base-interior-dressed` as a waiting room, `base-exterior-dressed` as a
street, built from core's base scenes so the two never drift); create `extensions/world-kit/` (`src/features/{props,furnish,lettering,maps}/`, `library/{props,kits,
swatches,glyphs}.json`, `library/maps/*.af-sector.json`, `scripts/convert-builder-maps.ts`).

**Interfaces:** consumes `registerPropGenerator`, `buildWorld`, `WorldLibrary`, `AfSector2`, the level geometry; produces
`worldKitExtension`, `worldKitLibrary: WorldLibrary` (merged by the game with its own), `dressLevel(level, library,
seed): AfSector2` (writes `props` and removes `dress`, so core draws it), `generateMap(name: 'apartment' | 'block',
seed): AfSector2`, the `world-kit` content kind.

- [ ] **Step 1: Failing tests** (from 3D 7.3's): `dressing is deterministic and every piece has an id`; `an unknown kit
  leaves the room bare and reports it`; `every library entry parses`; `apartment@1 and block@1 generate valid /2
  levels`; `a dressed level draws with core alone once dressLevel has run`.
- [ ] **Step 2:** FAIL. **Step 3:** the move from `78e0ca7f` and the uncommitted dresser, then the refactor: generators
  registered through the registry (R2), lettering's word list and shop kinds as library data, not code. **Step 4:**
  PASS. **Commit** `feat(world-kit): ready-made props, furnished rooms, signs and generated maps`

### Task 3.8: `@automata/world-kit`: textures, checks and the sky (after 3.7 and 3D 8.2)

**Files:** `extensions/world-kit/src/features/{textures,reads,sky}/`, `assets/photos/` (with each credit), the tiles
(generated, committed, each with its photo's sha-256), the bin `automata-world-textures`, the passes as GLSL + WGSL
pairs.

**Interfaces:** `photoToTile(png, knobs)` (from 3D 9.1's interface), `checkReads(level, library): LevelProblem[]` and
`readsAgainst(figure, room, camera)` (from 9.2 and 16.3), `starsPass`, `rainPass`, `bloomPass` added with
`addLookPass` (the sky and its horizon are core's).

- [ ] **Step 1: Failing tests:** 3D 9.1's and 9.2's tests, plus `rain is drawn only when the kit's pass is added` and
  WebGL2/WebGPU parity for each pass.
- [ ] **Step 2:** FAIL. **Step 3:** the port and the refactor (one tile format shared with the swatch library).
  **Step 4:** PASS in Chromium; WebKit and Firefox pending for the Owner's Mac. **Commit** `feat(world-kit): photo
  textures, the library's checks, and sky, stars and rain`

### Task 3.9: The kits' examples (after 3.6 to 3.8 and 3D 12.1)

`examples/3d/{figures-hair,figures-wardrobe,world-furnished-room,world-generated-map}.ts`, each booting to ready in
Chromium. **Commit** `feat(examples): the character and world kits`

### Phase 5: Refactor after the move (PR `claude/plus-refactor`)

The port's phase 2 moved most packages without changing them. This phase is the refactor.

#### Task 5.1: `sectors` uses core's level geometry (R1; after 3D 7.5)

- [ ] **Step 1:** record every sector parity hash and golden. **Step 2:** delete `polygonArea`, `insideSector`,
  `segmentDistance`, `crossing`, `opening`, `walkBlocker` from `extensions/sectors/src/shared/sim/`; import them from
  `@automata/3d/level`. **Step 3:** every hash and golden byte-identical; `pnpm boundaries` green. **Commit**
  `refactor(sectors): one sector geometry, core's`

#### Task 5.2: `ui-screens` keeps only what core lacks (R9)

- [ ] **Step 1:** for Title, Pause and Settings, list what the kit's screen does that core's does not, in the log.
  **Step 2:** a screen with nothing on its list goes (its entry, tests and README line); a screen with something keeps
  only that, built on core's screen. **Step 3:** layout suite passes; `ui-screens` README says which screens it adds and
  why. Grandma test on what remains. **Commit** `refactor(ui-screens): only the screens core does not have`

#### Task 5.3: One walking test helper (R10)

- [ ] `@automata/sectors/testing` exports `stepWith`; `nav` and `systems` import it; counts unchanged. **Commit**
  `refactor(extensions): one walking helper for the level's tests`

#### Task 5.4: Files at the limit, split by responsibility (R11)

- [ ] `runner.ts`, `net-room.ts`, `room-engine.ts` each become files with one responsibility apiece (named in the log),
  every test unchanged and passing. **Commit** `refactor(extensions): one responsibility per file`

#### Task 5.5: The refactor's record

- [ ] In `plus-progress.md`, each extension's line counts before and after phase 5 and 3.6 to 3.8, from `wc -l`, and
  the findings left open with their reason. **Commit** `docs(extensions): the refactor's record`
