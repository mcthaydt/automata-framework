---
'@mcthaydt/automata': patch
---

The published build no longer ships a loose copy of the Ruken adapter. `@mcthaydt/automata/testing` carries the fake Ruken host as one bundle, so a game's tests run without `@ruken/*` installed, and `HostingSeams` no longer names a Ruken type.
