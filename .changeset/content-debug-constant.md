---
'@mcthaydt/automata-content': patch
---

The Vite plugin defines `__AUTOMATA_DEBUG__` for the game: true in the dev server and in a build made with `AUTOMATA_DEBUG=1` (`automata build --debug`), false in a release build, so a block a game guards with it is dropped from what ships.
