# Art provenance: `examples/resources/sprites`

| Asset | Used by | Made by | How | Date |
|---|---|---|---|---|
| `wick-run.png` (32 × 16: two 16 × 16 frames of Wick running, left to right) | `textures/textures-sprite.ts` | Copied from Emberwick's `WICK_RUN_A` and `WICK_RUN_B` pixel maps (`games/emberwick/src/art/sprites.ts`, at `1206310`), whose art is recorded in `games/emberwick/src/art/PROVENANCE.md` | Written pixel for pixel to an RGBA PNG by a short Node script (`node:zlib`, no image library, no resampling); `.` is transparent | 2026-10-16 |

DUEL only (remapped from Endesga 64 on 2026-11-07, the same remap as Emberwick's sprites): the PNG was decoded after writing and its 12 colours checked against `docs/art/palettes/duel.txt`. SHA-256 `b9bd2d112083f1a0ba6047640069a58be23c582aef2c672f19340d15a953962d`. The Owner may replace it; Owner acceptance of Emberwick's look is still open, so this sheet's look is too.
