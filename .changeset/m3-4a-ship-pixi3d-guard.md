---
'@mcthaydt/automata-ship': patch
---

`prepare` and itch.io's `prepare --target itch` refuse a build that contains `@pixi/3d`, a closed beta, for a public target (`Pixi3dInPublicBuild`, M3 spec §4.8 X-b); `deploy-dev` and the new `prepare --private` (Ruken's local stack) allow it. Every build that contains `@pixi/3d/extras` is refused (`Pixi3dExtrasInBuild`, S7-g). `PrepareInput.audience`, `findPixi3d` and the marker lists are exported.
