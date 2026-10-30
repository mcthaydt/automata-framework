---
'@mcthaydt/automata-ship': patch
---

`prepare` and itch.io's `prepare --target itch` refuse a build that contains `@pixi/3d`, a closed beta, for a public target (`Pixi3dInPublicBuild`, M3 spec §4.8 X-b); `deploy-dev` and the new `publish --private`, which uploads only when `RUKEN_API` is Ruken's local stack (`PrivatePublishNotLocal` otherwise), allow it. Every build that contains `@pixi/3d/extras` is refused (`Pixi3dExtrasInBuild`, S7-g). `PrepareInput.audience`, `publishBuild`, `isLocalStack`, `findPixi3d` and the marker lists are exported.

BREAKING: the API report counts `PrepareInput`'s new optional `audience` as a changed interface. Existing callers compile; a public `prepare` of a build without `@pixi/3d` behaves as before.
