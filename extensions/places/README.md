# Places

What `narrative`, `cutscenes`, `nav` and `systems` need to know about where things are: where something stands, which
room that is, whether a straight line is blocked for walking or for sight, and where a walker leaves one room for the
next. A game with 3D rooms gets the answers from [`sectors`](../sectors/README.md); a 2D game gets them from
[`level-2d`](../level-2d/README.md). This package holds only the contract and two small helpers, so those four extensions
never learn which kind of level they are in.

It is free, MIT licensed and optional. It is not published to npm yet.

## The plan is in metres

Every number the four extensions hold is in metres: speeds, sense ranges, patrol points. A 2D level is in pixels, so
`level-2d` converts at its edge (one metre is one grid cell by default).
