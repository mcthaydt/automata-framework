# Art provenance: `examples/base-2d`

| Asset | Where | Made by | How | Date |
|---|---|---|---|---|
| Character (idle, two run frames, jump, fall) | `sprites.ts` | Claude (AI coding agent), integration thread, PR for M1.8 | Drawn as a palette-indexed pixel map in source, previewed as PNGs, no generation API and no reference image | 2026-10-11 |
| Bricks (top and inner) | `sprites.ts` | Same | Same | 2026-10-11 |
| Goal bubble | `sprites.ts` | Same | Same | 2026-10-11 |
| Backdrop (sky bands, stars, hills) and dust | `src/render/backdrop.ts`, `src/render/dust.ts` | Same | Drawn in code from palette colors at fixed positions | 2026-10-11 |
| Palette | `palette.ts` | Endesga ([Lospec](https://lospec.com/palette-list/endesga-64)), supplied by the Owner | Copied from `docs/art/palettes/endesga-64.txt`; `art.test.ts` checks it | 2026-10-11 |

Why pixel maps rather than a generation API: the base's sprites are tiny (8 × 8 and 16 × 16) and must use Endesga 64 exactly. Image generators produce off-palette, anti-aliased output that would need quantizing and cleanup by hand, so the art was authored directly on the palette instead. The Owner may still replace any of it; generated art goes through the `pipelines` gates once they exist (M3), with its provenance recorded here.

Look: Bubble Bobble (chunky outlined shapes, saturated bricks on a dark sky, a bubble to reach) mixed with Celeste (a red scarf, low internal resolution, squash and stretch, dust). Owner acceptance of the look is open.
