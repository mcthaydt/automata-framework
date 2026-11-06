---
'@mcthaydt/automata-sim': patch
'@mcthaydt/automata-content': patch
'@mcthaydt/automata-host': patch
'@mcthaydt/automata-ui': patch
'@mcthaydt/automata-runtime': patch
'@mcthaydt/automata-render-pixi': patch
'@mcthaydt/automata-game': patch
'@mcthaydt/automata': patch
'@mcthaydt/automata-testing': patch
'@mcthaydt/automata-node': patch
'@mcthaydt/automata-ship': patch
---

Tests moved out of `src/` into each package's `tests/` folder. No change for consumers: the published files and exports are the same (the `package.json` gains a `#src/*` import alias that only the tests use, and the `test:parity` script is called `test:browser`).
