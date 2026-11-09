# Editor gaps: what the free base-3d needed that the editors do not give yet

Every content kind is authored in an editor where one exists; each gap is logged here with its id, the editor, what is
missing and the workaround the game takes meanwhile.

| ID | Editor | What is missing | Workaround in the game |
|---|---|---|---|
| EG-1 | Levels 3D | The Things layer and the definitions editor are not built yet, so the room's `spawn`, `ember` and `goal` entities are written as data, not placed in the editor | `room.af-sector.json` is written against core's schema and opens in the editor as a plain level; re-author the entities in the Things layer once it and the definitions editor are built |
| EG-2 | Levels 3D | No typed entity definitions: `entityDefs` carries only each definition's id (`spawn`, `ember`, `goal`) | The converter checks each entity at load, naming the file and the JSON path |
| EG-3 | Levels 3D | `camera-view` files: no editor writes them; a sector names its view by id, the view itself (yaw, bounds, `rotate`) is not in the level file | The views are written in metres in `src/content/room.ts` (`ROOM_VIEWS`) |
| EG-4 | Levels 3D | Rooms are axis-aligned rectangles: the sim's walls, rooms and pits are boxes, while the editor draws any simple polygon | `areaFromSector` refuses another shape with the sector's JSON path |
| EG-5 | Levels 3D | No pit or hazard marker: a pit is a sector whose floor is below 0 (the channels, floor −3) | The converter reads `floor < 0` as a pit (no room box, no floor drawn) |
| EG-6 | Studio | Wick's roll clip is a placeholder (the pickup's crouch) until it is authored in the Studio | `content/figure-clips/roll.toml` |
