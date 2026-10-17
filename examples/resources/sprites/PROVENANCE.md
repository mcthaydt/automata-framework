# Art provenance: `examples/resources/sprites`

| Asset | Used by | Made by | How | Date |
|---|---|---|---|---|
| `wick-run.png` (32 × 16: two 16 × 16 frames of Wick running, left to right) | `textures/textures-sprite.ts` | Copied from Emberwick's `WICK_RUN_A` and `WICK_RUN_B` pixel maps (`games/emberwick/src/art/sprites.ts`, at `1206310`), whose art is recorded in `games/emberwick/src/art/PROVENANCE.md` | Written pixel for pixel to an RGBA PNG by a short Node script (`node:zlib`, no image library, no resampling); `.` is transparent | 2026-10-16 |

Endesga 64 only: the PNG was decoded after writing and its 12 colors checked against `docs/art/palettes/endesga-64.txt`. SHA-256 `9b80043fae6495012d352e906159fc8b65d18aba2ee2b45abc9f5008034e2fa0`. The Owner may replace it; Owner acceptance of Emberwick's look is still open, so this sheet's look is too.
