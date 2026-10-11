# Art provenance: `examples/base-2d`

| Asset | Where | Made by | How | Date |
|---|---|---|---|---|
| Wick (idle ×2, two run frames, jump, fall) | `sprites.ts` | Claude (AI coding agent), integration thread, PR #10 (M1.8) | Drawn as a palette-indexed pixel map in source, previewed as PNGs, no generation API and no reference image | 2026-10-11 |
| Stone (three variants), moss cap, edges, grass, glowing mushroom, vine | `sprites.ts`; placed by `src/render/tiles.ts` | Same | Same; placement is a deterministic autotiler (`tiles.test.ts`) | 2026-10-11 |
| Ember crystal | `sprites.ts` | Same | Same | 2026-10-11 |
| Night backdrop (dithered sky bands, stars, moon, ruined towers, trees, fog), light shafts, fireflies, particles | `src/render/backdrop.ts`, `renderer.ts`, `particles.ts` | Same | Drawn in code from palette colors at fixed positions | 2026-10-11 |
| Pixel lights and vignette | `src/render/light-levels.ts`, `pixels.ts` | Same | Computed: a stepped falloff with a 4 × 4 Bayer dither (`light-levels.test.ts`), tinted with palette colors | 2026-10-11 |
| Palette | `palette.ts` | Endesga ([Lospec](https://lospec.com/palette-list/endesga-64)), supplied by the Owner | Copied from `docs/art/palettes/endesga-64.txt`; `art.test.ts` checks it | 2026-10-11 |
| Pixelify Sans (screens' type) | `@fontsource/pixelify-sans` 5.3.0 | Stefie Justprince, via Fontsource | OFL-1.1, bundled by Vite | 2026-10-11 |

Why pixel maps rather than a generation API: the base's sprites are tiny (8 × 8 and 16 × 16) and must use Endesga 64 exactly. Image generators produce off-palette, anti-aliased output that would need quantizing and cleanup by hand, so the art was authored directly on the palette instead. The Owner may still replace any of it; generated art goes through the `pipelines` gates once they exist (M3), with its provenance recorded here.

Look (second pass, 2026-10-11): the first pass read as a Bubble Bobble and Celeste clone (a bubble-blowing blob with a red scarf, pink bricks, a bubble goal), and the Owner asked for something less derivative and more like a current itch.io hit. Now: Wick, a hooded wanderer with glowing eyes and a lantern, climbs mossy ruins at night to an ember. Modern pixel-art treatment: colored outlines and rim light, a multiplied light map with dithered pixel lights (lantern, ember, mushrooms, fireflies, moon), light shafts, parallax layers, a vignette, afterimages, landing shake and sparks. Bubble Bobble (one single-screen room) and Celeste (movement feel, squash and stretch, dust) remain as influences, not as copied motifs. Owner acceptance of the look is open.
