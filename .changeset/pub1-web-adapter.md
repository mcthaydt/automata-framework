---
'@mcthaydt/automata-host': patch
---

PUB.1: a web `Hosting` adapter for builds published outside Ruken (itch.io or any static host), chosen at build time through the new `@mcthaydt/automata-host/target` export (`automata-web` condition → web adapter, `default` → Ruken adapter). `Hosting.kind` gains `'web'` and `Hosting.hostName` names the host for UI. `RUKEN_SDK_MARKERS` and `findRukenSdkMarkers` let a build check that an itch bundle holds no Ruken SDK code.

BREAKING: `Hosting` gains the required `hostName` member and `kind` gains `'web'`, so a hand-written `Hosting` implementation must add `hostName`, and a `switch` over `kind` must handle `'web'`. The Ruken adapter and every existing call behave as before.
