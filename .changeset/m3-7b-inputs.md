---
'@mcthaydt/automata-game': patch
'@mcthaydt/automata': patch
---

`inputs(...maps)` joins several `keys()` maps into one input map: each map sends its own command every tick, read from one Input over the merged bindings, with one set of touch buttons and one Controls section (a 3D game sends its move, lock and action buttons as separate commands). It throws on no maps, on two maps for one command, and on an action id, a key or a pad button two maps share.
