# Art provenance: `examples/physics/bodies-2d`

| Asset | Where | Made by | How | Date |
|---|---|---|---|---|
| Crate (8 × 8, moss band, one brace) | `sprites.ts` | Claude (AI coding agent), M2.1b physics demo thread | Drawn as a palette-indexed pixel map in source, in base-2d's Emberwick style; no generation API and no reference image | 2026-10-11 |
| Stone of lantern glass (8 × 8) | `sprites.ts` | Same | Same | 2026-10-11 |

Endesga 64 only, checked by `art.test.ts` against `docs/art/palettes/endesga-64.txt`. Everything else on screen (the room, Wick, the light) is base-2d's, recorded in `games/emberwick/src/art/PROVENANCE.md`. Pixel maps rather than a generation API for the same reason base-2d gives: at 8 × 8 a generator's off-palette, anti-aliased output would need redrawing by hand anyway. The Owner may replace either sprite.
