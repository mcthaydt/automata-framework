---
'@mcthaydt/automata-ship': patch
---

A game's ship config can declare `audience: 'private'`: `automata-ship prepare` then checks the build as private and writes no `ruken.toml` (M3 spec §4.8).
