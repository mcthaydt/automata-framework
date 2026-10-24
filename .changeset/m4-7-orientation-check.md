---
"@mcthaydt/automata-ship": patch
---

The game's orientation against the ship config (M4.7 follow-up): `prepare` fails with `OrientationMismatch`, and the private `automata check` gains an `orientation` step (rule `orientation-mismatch`), when a `defineGame` plays in an `orientation` other than `ship.config.ts`'s `runtime.orientation` (`any` when the game leaves it out). The sources are read, not run, as the board check reads them, so only string literals are compared. `ship` exports `gameOrientationsIn`, `declaredOrientationIn`, `findOrientationMismatches`, `isOrientationSource` and their types.
