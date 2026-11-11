# Can our level editor author the clinic? (2026-11-11)

The Owner's goal for the clinic work: "make sure our editor that we build is capable of creating what we did without the
editor." This file answers it, one row for each kind of thing the clinic uses. The answer is **no, not yet**: the editor
(`packages/editor-3d`) can draw the rooms, doors, windows and portals, set the heights, light, three trim heights, textures and
camera of each room, a handrail and a window's moon, and place and move props and lamps by position and turn. It cannot
author anything that carries a parameter: a prop's `with`, a lamp's range, radius, colour or level, a point-list run, a
trim band's depth or texture, a zone's camera, the room-visibility policy, a swatch.

Each "yes", "partly" or "no" below is for "the editor can author it today", and each is checked against the code or a test, not
remembered. The clinic itself is the test: `packages/editor-3d/tests/unit/shared/level-session/af-sector/clinic-in-editor.test.ts`
opens `spikes/clinic/content/clinic.af-sector.json` with the editor's own profile and proves what it reads, lists, keeps and
flags. Paths are under `packages/editor-3d/` unless they say otherwise.

## What the editor does with the clinic today (measured)

| Claim | Evidence |
|---|---|
| It opens with nothing refused, lists all 109 props (57 furniture, 52 dressing) and 15 lamps as things | `clinic-in-editor.test.ts` "opens" |
| Moving a fitted prop writes only its place; its nested `with.with` is kept as written | `clinic-in-editor.test.ts` "moves a fitted piece" |
| Moving a lamp keeps `masses`, `views`, `visibility`, `bounce`, `time` and the lamp's range, radius, colour as written | `clinic-in-editor.test.ts` "keeps the members" |
| Every prop and lamp definition offers a turn (props) and nothing else (lamps): no `with`, range, radius, colour, level | `clinic-in-editor.test.ts` "offers a lamp or a prop only" |
| One check fails: the two pipe runs, whose first point is not inside a room | `clinic-in-editor.test.ts` "has one failing check" |

## The table

| # | What the clinic uses | Can the editor author it today? | Evidence |
|---|---|---|---|
| 1 | **Sectors and walls**: rooms as corner loops, floor and ceiling heights, light, pit, holes, a door, a window, a portal between rooms | **Yes** | `src/shared/edit/sector-edits.ts` (`addSector`, `setHeights`, `setLight`, `setPit`, `splitSector`, `mergeSectors`), `wall-edits.ts` (`setWallKind`, `setDoor`, `setWindow`), `vertex-edits.ts`; journeys `tests/browser/journeys/draw.journey.test.ts`; unit `tests/unit/shared/edit/sector-edits.test.ts`, `wall-edits.test.ts` |
| 2 | **Trim bands**: skirting, wainscot, rail (heights); a capital; each band's `trimDepth` and `trimTexture`; a wall top (`cap`) | **Partly**: the three heights only. Capital, cap, depth and texture ride as written but cannot be set | `sector-edits.ts` `setTrim` (`TRIM_PIECES = skirting, wainscot, rail`, its comment: "a capital, a cap stay as written"); `src/features/levels-3d/inspector/SectorCard.svelte` (the trim steppers); `af-material-edits.ts` only renames a `trimTexture`, it never sets one |
| 3 | **Masses** (solid blocks between rooms, the building's masonry) | **No**: read to build the map and kept, with no edit and no tool | `af-sector-profile.ts` line 44 reads `level.masses` for geometry; there is no `mass` edit in `src/shared/edit/` |
| 4 | **Handrails** | **Yes** | `wall-edits.ts` `setWallFlags` (`handrail`), `WallCard.svelte` "Handrail" |
| 5 | **Pilasters** (a wall's `pilaster` start/end) | **No**: kept as written | `3d/src/shared/level/af-sector-2-parts.schema.ts` line 205 has it; no edit names `pilaster` |
| 6 | **Moon glass** (a window's `moon`) | **Yes** for the flag (and bars); the glass's swatch is a library entry, row 18 | `wall-edits.ts` `setWindow` (`moon`) |
| 7 | **Lamps**: place one of the kit's kinds at a point | **Yes**: a kind and a position (the palette lists the kit's kinds) | `af-placed.ts` `lamp()` and `placedDefinitions` (`LAMP_KINDS`), test `af-placed.test.ts` "offers every lamp the kit has" |
| 8 | **A lamp's radius, range, colour, level, flicker, bounce points** | **No**: a lamp has no fields (`fields: []`, `readOnly: true`), `created()` writes `{id, kind, at}`; a written light is kept untouched when the lamp moves. The level's `bounce` has no tool at all | `af-placed.ts` lines 90-97 and 186-190; test `af-placed.test.ts` "the pendant lamp's parameters stay as written"; no `bounce` in `src/` |
| 9 | **Kit presets placed by position and angle**, with `with` params (including `fit`'s nested `with.with`) | **Partly**: position, height and angle yes (a `prop.<use>` or `kind.<kind>` thing). `with`: **no**, it can neither be set nor shown; it is kept when the prop moves. A preset appears in the palette only if the game's `world-props/*.toml` has it; the world kit is not a dependency of the editor, so its generators do not draw in the editor's views | `af-placed.ts` `furniture()` (`fields: [ANGLE]`, `readOnly: true`), `created()`, `PROP_ORDER`; `af-codec.ts`; `readOnlyReason` ("comes from the game's furniture, so it can't be changed here"); `packages/editor-3d/package.json` has no `@automata/world-kit`; `3d/tests/unit/world/clinic-level.test.ts` ("core has no generator for them") |
| 10 | **Point-list runs** (pipe runs, cables) | **No**: the field types are `int float bool text enum color angle ref point` (one point, no list), and a placed thing has one point. The two pipe runs even fail the editor's "outside every room" check | `packages/content/src/shared/level-2d/field-types.ts` line 11; `af-placed.ts`; `clinic-in-editor.test.ts` "has one failing check" |
| 11 | **`fit` props** (any preset scaled to a box) | **No**: it is a kit `kind` with `of`, `with`, `size` and `turn`, all inside `with` (row 9) | `extensions/world-kit/library/props.json` `fit`; same code as row 9 |
| 12 | **Veils** (light pools, moon shafts, translucent parts) | **No**: they are kit generators' parts, authored through `with` (row 9); no veil is placed or edited | same as row 9; no `veil` in `src/` |
| 13 | **Camera zones** (`views`): the zone's `look`, `distance`, `x`, `follow`, `depthFollow`, `enterMargin`, `bounds` | **Partly**: a room takes a camera view by id from a picker (`setView`, the `views` keys); the view itself cannot be created or edited | `sector-edits.ts` `setView` (the editor "holds the id"); `SectorCard.svelte` "Camera"; `af-sector-profile.ts` line 52 `views: Object.keys(level.views ?? {})`; no view edit anywhere |
| 14 | **Room visibility and cut groups**: the level's `visibility` policy, a wall's `cut` group | **No**: a wall's `occlude` (`cut`, `fade`, `never`, the "Hide in 3D" control) yes, but the named `cut` group and the policy are kept as written, with no edit | `wall-edits.ts` `setWallOcclude`, `WallCard.svelte` "Hide in 3D"; `3d/src/shared/level/af-sector-2-parts.schema.ts` line 202 (`cut`); `af-codec.ts` `FILE_ORDER` names neither `bounce` nor `visibility` |
| 15 | **Swatches**: picking one for a floor, ceiling or wall | **Yes** | `sector-edits.ts` `setMaterials`, `wall-edits.ts` `setWallMaterial`, `material-edits.ts` `applyMaterial` (wall, room, matching), `MaterialSheet.svelte` |
| 16 | **Swatches, authoring them** (a DUEL ramp and step, `emit`, `flat`, `noCast`, `uv`) | **No**: the editor reads the game's `world-swatches/*.toml` and never writes them; its `materials` table edits (`add`, `set`, `rename`, `remove`) are the level's own table, which the clinic does not use | `game-library.ts` header ("this editor never writes them"); `af-material-edits.ts` |
| 17 | **Textured swatches** (a tile floor) | **No**, and not shown either: the editor's game view takes a flat colour from a swatch | `src/features/levels-3d/dollhouse/game-scene.ts` (`colourOf`, "a missing material draws grey"); same gap as the spike's `scene.ts` |
| 18 | **The level's library copy** (`clinic.library.json`: the swatches and presets the level names) | **No**: the library is the game's TOML folders, read-only here; nothing writes or checks a library copy | `game-library.ts` |
| 19 | **The opening state** (lamp levels with the power out, `PieceStates`) | **No**: not part of the level file; the clinic keeps it in `clinic.opening-state.json` | `spikes/clinic/content/clinic.opening-state.json`; no `PieceStates` in `src/` |
| 20 | **Time and look** (ambient, fill, sky preset) | **Partly**: a named time of day is chosen; the level's own `scene.light` overrides are kept as written | `src/shared/edit/level-edits.ts` `setTimeOfDay` and its test ("keeps a time's own overrides") |

## What `spikes/clinic/scene.ts` does that a level should carry

The frames are drawn by 127 lines of per-scene code. Each is a place where the level, not a script, should say it; the editor can
author none of it today.

| In `scene.ts` | What a level or the game's content should hold instead |
|---|---|
| The camera: the zone's view as a `cameraView`, its room `bounds` computed from the sectors' corners, the focus and heading | A zone's bounds follow from its sectors; the editor needs a view editor (row 13) and the game a generic "play this level" wiring |
| `HazeEffect.focus(VIEW.distance)` | The look's haze should read the active view's distance itself |
| A stand-in body for the player (a 1.62 m box) | The level's `spawn`/`cast` (the editor places `cast` things, which are read-only boxes) |
| The opening's lamp levels (`opening.lamps`) | A level's initial piece states (row 19) |
| `colourOf: swatchColour(...)`, flat | The textured-swatch path of the world view (row 17) |
| The sky colour, `view.environment` | A time-of-day member of the level (row 20) |

## To make the editor able to build the clinic (priority order)

1. **Fields on a placed prop and lamp**: `with` (a nested object, which `fit` needs), and a lamp's range, radius, colour,
   level, flicker. Without these the editor can place the clinic's 109 props and 15 lamps in the right spots but not make
   one of them what it is. Rows 7 to 12, and the largest single gap.
2. **Load the world kit in the editor**, so kit presets are in the palette and draw in the views. Today a clinic preset
   would not build (row 9).
3. **A point-list field and path tool** (row 10): pipe runs and cables, with the "outside every room" check taught that a
   wall-mounted thing is not outside.
4. **Textured swatches in the game view, and a swatch editor** (rows 16 to 18): the clinic's floor is tiles.
5. **Trim in full** (row 2: capital, cap, depth, texture) and **masses and pilasters** (rows 3, 5).
6. **Camera views and zones** (row 13): author a zone's look, distance, follow and bounds, not only pick one.
7. **Room visibility and cut groups** (row 14) once the extension is on main; **bounce points** (row 8); **the opening state** (row 19).

## Format and converter gaps the clinic work met

Things batch 2 had to work around in a converter or a spike script that an editor, or the `af-sector/2` format, should own.
Each is what was done, and what it points to.

1. **Placing a thing against a wall.** A wall piece (notice, plaque, pipe, CRT) is a prop built facing +z at an origin, so the
   author works out `angle` from the wall's normal (90 south, 0 east, 180 west, −90 north) and nudges the origin 1 to 4 cm off the
   wall by hand. A "mount on this wall segment" placement (wall id, distance along, height) would remove the arithmetic
   and the mistakes (a plaque at x 4.86 poked through the wall until it was moved to 4.84).
2. **Paths.** Pipe runs and cables are lists of world points, stored relative to the first. An editor needs a polyline tool
   with snapping to walls and the ceiling, and the level a path-type prop whose points are world points.
3. **Fit a preset to a box.** The source's models carry a world box; the kit's presets carry their own sizes. `fit` (new, in the
   world kit) scales a generator to a box. The format has no notion of it: it is a `kind` with `of`, `with`, `size` and `turn`, so
   an editor sees a generic prop. A first-class "size" on a place (any preset, any box) would be the editor's way in.
4. **A prop's light and the level's lamps.** The kit's desk lamp carries a light; the level has its own desk lamp
   at the same spot. The converter strips the preset's light. A prop's light should be able to name the level lamp it stands for
   (`lampId`), so the glow dims with it and nothing is lit twice.
5. **Pieces that follow a lamp's level.** The light pools are static veils at the opening's levels (the source scales each
   pool by its lamp). `PieceStates` moves lamps; a veil (or any part) cannot yet follow one.
6. **Which swatches a preset uses.** A generator names default swatches (`bookCream`, `leatherBlack`, `cordBlack`) that appear
   nowhere in the preset. The converter had to find them by building and reading the "unknown swatch" problems. A generator should
   be able to list the swatches it can use, so a library copy is complete by construction.
7. **Rooms and cut groups for props.** A wall's pieces carry a `cut` group so room visibility hides them with the wall; a
   prop does not. The hall's north-east pipes and noticeboard draw in the supply and corridor frames, where the source hides them.
   A prop needs an owner room (or a wall to ride on), authored, not guessed from where it stands.
8. **Textures on the floor and walls.** The source's floor is a tile-grid texture and its pictures read as steeper because of
   it. A swatch can name a photo texture, but `drawWorld`'s `colourOf` path takes a flat colour; the spike has no way to show the
   kit's `tileFloor`. The spike needs the textured-swatch path the world view has, and the editor a floor-pattern picker.
9. **Orientation of kit generators.** A bed is built lengthwise along x with its head at −x, a bench along x, a wheelchair facing +z.
   The author must know each; `turn` is a number found by trial. Each generator should declare its axes, so an editor can show them.
10. **Axis-aligned veils.** A moon shaft's patch is square to the wall; the source's runs diagonally along the shaft. A
    veil with a turn about y (or the shaft taking an aim) would close it.
11. **Closed curtains.** The kit's curtain is two folds drawn back; a drawn-closed curtain is `panel` = half the width, a trick.
12. **Tests of extension presets in core.** Core's clinic test cannot build the dressing (core has no such generators), so
    the level's test is split between `packages/3d` (stand-in models) and `extensions/world-kit` (kit pieces). A level that
    names an extension's presets should say which extension, so a checker can load it.
