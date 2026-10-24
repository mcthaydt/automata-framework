---
'@mcthaydt/automata-testing': patch
---

`goldenCommands({ root })` lets the browser golden read command serve golden files from a folder wider than the Vitest project's root, for a package whose goldens sit beside it (the examples runner reads `examples/__goldens__`). Additive: `goldenCommands()` keeps the project root.

BREAKING: the API report counts `goldenCommands`' new optional `options` parameter as a changed signature. Existing calls, `goldenCommands()`, behave as before.
