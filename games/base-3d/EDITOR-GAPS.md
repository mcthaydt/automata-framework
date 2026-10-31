# Editor gaps: what the Cold Kiln needed that the editors do not give yet

DESIGN.md §17 asks for every content kind to be authored in an editor and every gap to be logged here: its id, the
editor, what is missing, and the workaround the game takes meanwhile. GAME-3D.1i authored
`src/content/levels/kiln.af-sector.json`, three rooms and the niche, as an `af-sector/1` file: written as data against
core's schema (`@mcthaydt/automata-sector-format`) and read by `src/content/levels/sector-area.ts`, not drawn in the 3D
level editor's UI (EG-1 is why that is a gap and not a choice).

| ID | Editor | What is missing | Workaround in the game |
|---|---|---|---|
| EG-1 | Levels 3D (ED3D) | The editor's file open, canvas and Things layer cannot yet be driven for a whole dungeon from here: the Things layer (ED3D.12) and the definitions editor (ED3D.13) are unchecked in docs/02, so entities cannot be placed and typed there | The file is written as data and validated by the shared schema; it opens in the editor as a plain level (sectors, doors, `view`s). Re-author the entities in the Things layer when ED3D.12 and ED3D.13 land |
| EG-2 | Levels 3D | No typed entity definitions for the game's pieces: `entityDefs` carries only each definition's id. The fields of `door`, `switch`, `chest`, `pot`, `block`, `cracked`, `hook-post` and `sling-target` live in `src/constants/entities.ts` (strict Zod, the game's truth), and the area's own `spawn`, `ember`, `foe` and `area-exit` are conventions of the converter | The converter checks each piece against the game's schema at load (`compileArea`), naming the file and the JSON path (G3-F2) |
| EG-3 | Levels 3D | `camera-view` files: no editor writes them (DESIGN.md §17, gap 1). A sector names its view by id; the view itself (yaw, bounds, `rotate`) is not in the level file | The views are written in metres in `src/content/kiln.ts` (`KILN_VIEWS`), and the converter refuses a sector naming a view the area does not define |
| EG-4 | Levels 3D | Rooms are axis-aligned rectangles in 1.0: the sim's walls, rooms and pits are boxes. The editor draws any simple polygon, so a non-rectangular sector is accepted by the editor and refused by the game | `areaFromSector` refuses it with the sector's JSON path; every room of the kiln is a rectangle. A polygon room needs wall segments in the sim (a core request) |
| EG-5 | Levels 3D | No pit, hazard or fall marker: a pit is a sector whose floor is below 0 (the slag channel, floor −3) by convention, and the editor shows it as a deep room | The converter reads `floor < 0` as a pit (no room box, no floor drawn, Wick falls into it) |
| EG-6 | Levels 3D | A sector's `view` is one camera view per sector; the Bellows Gallery is three sectors (the room, the channel, the ledge) that all name `bellows-gallery`, because the channel and the ledge must be sectors of their own | The solver and the camera take rooms by view id, so the three share one |
| EG-7 | Levels 3D / sim | A room whose doors close behind Wick until its foe falls (the Hearth Chamber, DESIGN.md §0.2) has no authoring form: a `clear` door starts closed and opens when its room's foes are gone | None in 1.0: the Hearth Chamber has only its small-key door. Closing on entry is a sim feature (a follow-up) |
