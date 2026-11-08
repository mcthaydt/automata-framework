# level-2d

A 2D level as the plan that `narrative`, `cutscenes`, `nav` and `systems` read (see [`places`](../places/README.md)).
Give `level2dPlaces({ level, project })` to those extensions and they work in a 2D game, with no 3D rooms.

- **Rooms** are the items of the definition tagged `area`: rectangles placed and stretched in Levels. A room's name is
  the item's `name` field (else its id) and its zone is its `zone` field (else the name). Where two areas overlap, the
  first in the file wins, and a point on a shared edge belongs to it.
- **Walls** are the cells of the walls layer (the first IntGrid layer) whose value is called `solid`. Walking and line
  of sight both stop at them.
- **Positions** are the game's own position component (`position: { component, x, y }`, in level pixels), so there is one
  copy of where something stands. A game with none uses `Level2dAt`.
- **Crossing** between two areas is the middle of the edge they share; two areas that meet only at a corner do not touch.
- The plan is in metres. One metre is one cell of the walls layer unless `metre` says otherwise.

[`examples/2d-story`](../../examples/2d-story/) uses it with all four, and its tests show the keeper, the cutscene and the guard
running in a 2D level.

It is free, MIT licensed and optional. It is not published to npm yet.
