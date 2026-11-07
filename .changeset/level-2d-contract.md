---
'@automata/content': patch
---

New `@automata/content/level-2d`: the 2D level format the editor writes and games read. It holds the strict schemas for `project.toml`, `levels/<id>.toml` and `world.toml`, the typed-field rules they use, `level2dKinds()` to register the three kinds, and `intGridRows` and `entitiesOf` to read a level.
