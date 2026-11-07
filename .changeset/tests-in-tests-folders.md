---
'@mcthaydt/automata-sim': patch
'@mcthaydt/automata-content': patch
'@mcthaydt/automata': patch
'@mcthaydt/automata-tools': patch
---

Tests moved out of `src/` into each package's `tests/` folder. No change for consumers: the published files and exports are the same (the `package.json` gains a `#src/*` import alias that only the tests use, and the `test:parity` script is called `test:browser`).
