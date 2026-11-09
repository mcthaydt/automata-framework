---
'@automataframework/automata-sim': patch
'@automataframework/automata-content': patch
'@automataframework/automata': patch
'@automataframework/automata-tools': patch
---

Tests moved out of `src/` into each package's `tests/` folder. No change for consumers: the published files and exports are the same (the `package.json` gains a `#src/*` import alias that only the tests use, and the `test:parity` script is called `test:browser`).
