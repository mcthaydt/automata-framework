---
'@automata/tools': patch
---

A new game draws the level and the characters the editor made, and `automata editor` no longer fails to list the game's files while the content build is writing its own: a file that is gone by the time it is read is left out, so a save in the editor is not lost.
