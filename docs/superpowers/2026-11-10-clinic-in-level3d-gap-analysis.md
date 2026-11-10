# The Last Light's clinic in AF's 3D level: gap analysis

- **Date:** 2026-11-10.
- **Scope:** the clinic (`St. Agnes Clinic`, act one, "Night Shift") only. On 2026-11-10 the Owner narrowed the
  workstream to "Just recreate the clinic". The other scenes (prologue, clinic-dawn, bay) come later.
- **Goal:** the clinic loads in AF from data, and plays and looks like the original.
- **Sources read:**
  - The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704` (2026-10-22). Every earlier conversion into
    AF was made from this commit (`docs/provenance/sources.md`).
  - AF `main` at `1e4e2c8f`.
  - `mcthaydt/automata-plus` at `1766c62`.
- **"level3d":** no package has that name. It means the `af-sector/2` level format (`@automata/3d/level`,
  `packages/3d/src/shared/level/`), the world builder and renderer in `packages/3d`, and the sim's side of the level
  in `extensions/sectors`.

## Where the extensions live

On 2026-11-07 the Owner chose to port automata-plus into this repository as `extensions/<name>` (P-D1 B, in
`docs/refactor/plus-progress.md`). automata-plus `main` has not moved since 2026-11-01. So "Plus extension" below means
`extensions/<name>` here. EnvironmentBuilder's coordinator plans to make The Last Light's render features into
"automata-plus extensions". I have asked that session (2026-11-10) to confirm the location with the Owner and to agree
who builds what. Until it replies, every render feature marked **EB** is assumed to come from that project, and this
work adds nothing to it.

## Status key

- **Supported:** AF reads it and does something with it today.
- **Partial:** the format can hold it, or a near match exists, but something is missing. The row says what.
- **Missing:** nothing in AF.
- **EB:** a render extension that EnvironmentBuilder's project plans to build.

## 1. Sectors and walls (`scenes/clinic/map.ts`, generated from `docs/art/blockout-clinic/blockout.json`)

7 sectors: hall (with the counter as a hole), counter, ward, mouth, corridor, doorway, closet. 3 masses.

| Item | Status | Notes |
|---|---|---|
| Sector outlines, holes, floor and ceiling heights, `light`, `zone`, `open` | **Supported** | Already converted once: `extensions/sectors/src/testing/fixtures/clinic.af-sector.json` (`af-sector/2`, read by `readLevel`), with the original's own resolution in `clinic.resolved.json` for comparison. It is a test fixture only; no game loads it. |
| Masses (counter plinth, ward bulkhead, north-east pier) | **Partial** | The sim reads them (`sectors`: colliders, checks). The 3D world builder draws none (`masses` has no reader in `packages/3d/src/features`). |
| Wall `cut` (13 names, such as `north-east` and `ward-back`) | **Partial** | The format holds it, and the camera's occluders read cuts. Nothing ties the clinic's cut names to its camera zones. |
| Wall `hideFrom` (the mouth's bulkhead hidden from `hall`) | **Partial** | Schema only. Nothing in AF reads it. |
| Trim: `skirting`, `capital`, `wainscot`, `rail`, `cap`, `trimDepth`, `trimTexture` (the counter's front and top) | **Partial** | Schema and the 3D editor's inspector only. The world builder does not draw trim bands, so the reception counter would render as a bare block. |
| Wall `window` with bars and `moon` (ward back, corridor end) | **Partial** | `build.ts` reads `window`. Bars and the moon glass need checking against the original. |
| Wall `door` (`exit`, `staff`), the `doorway` sector, `thick: 0`, `handrail`, `frame: false` | **Partial** | `door` is read (`build.ts`, `update-pieces.ts`). `handrail` and `pilaster` are drawn by none. |
| Materials and textures (`counterTop`, `ceilingTile`, `floorDim`, `kick`, `counterFront`, `cap`) | **Missing** | The names are not in AF's swatch library. They come from the original's DUEL ramps and texture set (`render/duel-ramps.ts`, `assets.ts`). |

## 2. Props and dress (`props.ts`, `dress.ts`, `render/props.ts`, `render/dressing.ts`, `render/models/`)

| Item | Status | Notes |
|---|---|---|
| 44 hand-placed furniture models (`PROPS`): bed, wheelchair, trolley, gurney, filing cabinets, a wall TV, and 20 stock items on shelves | **Partial** | `af-sector/2` `props: [{ id, use, at, angle, with }]` holds the placements. AF has a GLB parser (`shared/render/model/parse-glb.ts`, `load-models.ts`), but no world prop uses it. The 61 models are `.glb` plus `.pack` in `src/render/models/` (123 files), and their licence and provenance need recording. `size`, `uniform`, `gain`, `wall` and `ceiling` have no fields yet; they would go in `with`. |
| `RESERVED` wall space (36 rectangles) and rule-based wall dressing | **Partial** | `dress: { as, pin, remove }` and the world-kit dresser (`extensions/world-kit/src/features/furnish`) are AF's version. The original's rules (`render/dressing.ts`) and a "reserved" input are not in AF. |
| `SIGNS` (`STAFF ONLY`, `SUPPLY` over a portal) | **Partial** | A wall `decor` of kind `sign` exists. A sign per portal side (`corridor>doorway`) does not. |
| `dressClinic` (349 lines of code): pipes, the exit door and its lit sign, the supply-room door (open and shut), curtains and fire, puddles and their reflections, sparks, the fuse box, the CRT's static, the live monitor screen, moon shafts and patches, light pools, footprints, floor grime, cables, a hanging ceiling tile | **Missing** | It is code, not data, and much of it follows world state (power, fire, alarm, the curtains, the leak). AF's `PieceStates` (doors 0–1, lamp level and colour, prop moved or hidden) carries part of what it drives. Fire, water, sparks, reflections, shafts and the live screens have no AF piece. |

## 3. Lamps and light (`level.ts` `LAMPS`, `BOUNCE`; `render/look.ts`, `indirect-light.ts`, `fog.ts`, `bloom-filter.ts`)

| Item | Status | Notes |
|---|---|---|
| 15 lamps of kinds `desk`, `screen`, `pendant`, `bulb`, `fluorescent`, `fire`, `spark`, `moon` and `fill`, each with range, radius and colour | **Partial** | `af-sector/2` `lamps` holds them. AF's lamp kit has `bulb`, `desk`, `fluorescent`, `neon`, `pendant` and `sodium`; `screen`, `fire`, `spark`, `moon` and `fill` are missing. `radius` (the light pool) has no field. |
| Lamps that follow state (power, fire, alarm, flicker, strobe with "reduce flashing") | **Partial** | `PieceStates.lamps` and `lamp-switches.ts` give level and colour. Seeded flicker per lamp and the "reduce flashing" setting are not wired. |
| Bounce points and indirect light | **EB** | `render/indirect-light.ts`. |
| Haze and mist (the look bible's `HAZE`) | **EB** | `render/fog.ts`. AF has `view-fog.ts`, which is not the same model. |
| Bloom | **EB** | `render/bloom-filter.ts`. |
| The look: DUEL ramps, palette, retro and crisp filters, LCD panel | **Partial / EB** | AF has DUEL ramp light, the DUEL snap, outlines and dither (`features/look`). The clinic's own numbers, `retro-filter`, `crisp` and `lcd-panel` are **EB**. |
| Vertex light and occlusion | **Partial** | AF has `vertex-light`, `vertex-bake` and `occlusion`. Whether they match `render/occlusion.ts` is unchecked. |

## 4. Cameras and zones (`level.ts` `ZONES`, `zoneAt`; `visibility.ts`; `render/room-camera.ts`, `camera-rig.ts`, `room-visibility.ts`, `play-framing.ts`)

| Item | Status | Notes |
|---|---|---|
| 3 fixed camera zones (hall, corridor, closet) with look-at, distance, follow, depth follow, and enter hysteresis | **Partial** | AF has an angled camera, a view per sector (`view`) and a latch (`view-latch.ts`). `views` holds named cameras. The clinic picks zones with `zoneAt`, a function; it needs restating per sector (the `zone` field is already in the fixture). Follow, depth follow and enter offsets need fields, or the camera rig. |
| Camera rig | **EB** | `render/camera-rig.ts`. |
| Room visibility (4 rooms, which zones see them, which masses belong to them) | **EB** | `render/room-visibility.ts`, `room-ownership.ts`, `room-wall-owners.ts`. The clinic's policy is data (`visibility.ts`), so it moves as-is once the extension's input is known. |

## 5. Doors and locks

| Item | Status | Notes |
|---|---|---|
| The exit's electric lock opens with power; the staff door is painted shut | **Partial** | Puzzle facts (`exitOpen`, `power`) are in the converted puzzle. A door's open state drives `PieceStates.doors`. Nothing maps a puzzle fact to a door's state yet. |
| The supply-room door (`closetDoor` box, `closetOpen`, a nav edge gated by it) | **Partial** | The converted nav has the gated edge (`cmid` to `closet` through `closetDoor`). The door's swing is code in `dressClinic`. |
| The key cabinet keypad | **Partial** | It is a puzzle action and a cutscene. The open cabinet is code in `dressClinic`. |

## 6. Puzzle, interaction and items (`puzzle.ts`, `puzzle-model.ts`, `rules.ts`, `level.ts` `HOTSPOTS`)

| Item | Status | Notes |
|---|---|---|
| The puzzle: 9 items, 22 facts, 62 actions | **Supported (as a fixture)** | `extensions/puzzle/src/testing/fixtures/clinic.puzzle.toml`, converted at `92e6704`. No game loads it. |
| 23 hotspots, each with a name, a reach and a height (2 of them hiding spots) | **Missing** | No `af-sector/2` field. The nearest thing is `entities` with `entityDefs` and `fields`. |
| Collider boxes (21 `BOXES`) | **Partial** | Converted to a nav TOML fixture (21 boxes). In the level they would be props with colliders, or entities. |
| Ada's verbs, inventory, combining tools, fuel, the lighter and the torch (`game/tools.ts`) | **Partial** | The puzzle extension holds actions. The tools' light and fuel rules are hooks in `rules.ts`, not data. |
| The rules hooks the data cannot express: timers, fire spread, the leak, footsteps, waking the Nurse (`rules.ts`, 376 lines) | **Missing** | They need clinic game code in AF, or new systems rules. |
| Peek, grapple, barricade, the director (imported by `rules.ts`) | **Missing** | Not converted. Whether the clinic uses each one in act one needs checking. |

## 7. The crew, the Nurse and hiding (`systems.ts`, `game/agents.ts`, `pursuit.ts`, `render/figure/`)

| Item | Status | Notes |
|---|---|---|
| The Night Nurse as an agent: patrol, investigate, hunt, flee light, stun; 27 tunables; world rules R1 to R15 | **Supported (as a fixture)** | `extensions/systems/src/testing/fixtures/clinic.systems.toml`. The systems extension has `pursuit.ts`. |
| Nav: 18 nodes, 22 edges, the patrol | **Supported (as a fixture)** | The `nav` fixture (converted at `92e6704`). |
| Hiding (the locker and the privacy screen) | **Partial** | `systems` has `hide`, `unhide` and "saw her hide". The provenance says `withHiding` was not ported. |
| Figures: Ada, the Nurse (and the porter) | **Partial** | The original's figures are the same family as AF's (genes, garments and a shared rig). `characters/ada.json` and `nurse.json` need converting into AF figure content. The `faces` decoy is act three's. |
| Footprints, the stun's look, the Nurse's poses in cutscenes | **Partial** | Clips and actions exist in AF. The poses themselves are unchecked. |

## 8. Story, cutscenes and presentation

| Item | Status | Notes |
|---|---|---|
| Lines, dialogue graphs, storylets, beats and hint ladders | **Supported (as fixtures)** | `extensions/narrative/src/testing/fixtures/clinic.*.toml`. |
| Cutscenes | **Supported (as a fixture)** | `extensions/cutscenes/src/testing/fixtures/clinic.cutscenes.toml`, evaluated in tests. Not played in a 3D stage (the 3D director arrived with `@automata/3d/timeline`). |
| The act card, room names on the map, the register save, `carries` into act three | **Missing** | `presentation.ts`. The original's UI and save shape (`src/ui`, `game/register.ts`, `save-shape.ts`) are not in AF. |
| The FMV the first time she lights the lighter | **Missing** | `src/fmv/`. |
| Audio (`src/audio/`) | **Partial** | `audio-synth` exists; the clinic's sounds are not converted. |
| Feel (`src/feel/`) | **Supported** | `feel` was ported from it. |

## What this adds up to

1. **Data that is ready.** The geometry, puzzle, systems, nav, narrative and cutscenes are all converted from the
   same commit. They are test fixtures, and no game loads them together.
2. **Data that needs a home in the level.** Props (with GLB models), lamps of 5 new kinds, hotspots, colliders, camera
   zones and the room-visibility policy. Most of it fits `af-sector/2` as written (`props`, `lamps`, `views`, `zone`,
   `entities`). A few fields are new: lamp `radius`, prop `size` and `gain`, hotspot `reach`.
3. **Drawing the level needs builder work.** Trim bands, masses, `hideFrom`, handrails and pilasters are in the schema
   and drawn by nothing.
4. **The render look is mostly EB's.** Fog, bloom, indirect light, the retro, crisp and LCD filters, room visibility
   and the camera rig.
5. **The hard part is behaviour written as code.** `dressClinic` (349 lines) and `rules.ts`'s hooks (376 lines) are
   code that reacts to world state. Data cannot hold all of it. Some of it needs a clinic game in AF, as `games/`
   or `examples/`, with code of its own.
6. **No game shell exists for this genre.** AF has no adventure UI: verbs, inventory, a register save, an act card,
   FMV. `base-3d` is the nearest 3D game.

## Open questions for the Owner

These are what the brainstorm has to settle:

- What "plays like the original" covers: the whole of act one (Nurse, fire, water, power, the puzzle, the cutscenes,
  saves), or the clinic walkable, lit and dressed with the puzzle running.
- What "looks like the original" means: a pixel match against The Last Light, or EnvironmentBuilder's "same look,
  new numbers".
- Where the clinic lives: a new game in `games/`, an example, or a clinic profile in `base-3d`.
- Whether the 61 GLB models may be copied into AF, and under what licence.
