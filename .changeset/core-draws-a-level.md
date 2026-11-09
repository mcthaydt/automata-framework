---
'@automata/framework': patch
---

`defineGame({ level: levelScene({ project, levels, images, start, live }) })` draws a 2D level the editor made (tiles, auto tiles, objects and placed characters) under the entity views. A tile with no picture shows as the editor's flat colour, and a missing picture or a tile past the set is reported in words that name the level.
