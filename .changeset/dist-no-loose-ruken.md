---
'@automata/framework': patch
---

The published build no longer ships a loose copy of the Ruken adapter. `@automata/framework/testing` carries the fake Ruken host as one bundle, so a game's tests run without `@ruken/*` installed, and `HostingSeams` no longer names a Ruken type.
