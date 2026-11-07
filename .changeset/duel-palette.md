---
'@automata/content': patch
---

The default palette is DUEL: 256 colours as 32 ramps of 8, replacing Endesga 64. `@automata/content/palette` adds `DUEL_RAMPS`, `rampOf`, `step` and `nearestDuel`. A game without `content/palette.toml` now gets DUEL, so its content hash changes.
