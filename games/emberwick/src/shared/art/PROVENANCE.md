# Art provenance: `games/emberwick`

| Asset | Where | Made by | How | Date |
|---|---|---|---|---|
| Wick (idle ×2, two run frames, jump, fall) | `sprites.ts` | Claude (AI coding agent), integration thread, PR #10 (M1.8) | Drawn as a palette-indexed pixel map in source, previewed as PNGs, no generation API and no reference image | 2026-10-11 |
| Stone (three variants), moss cap, edges, grass, glowing mushroom, vine | `sprites.ts`; placed by `src/features/scene/tiles.ts` | Same | Same; placement is a deterministic autotiler (`tiles.test.ts`) | 2026-10-11 |
| Ember crystal | `sprites.ts` | Same | Same | 2026-10-11 |
| Night backdrop (dithered sky bands, stars, moon, ruined towers, trees, fog), light shafts, fireflies, particles | `src/features/scene/backdrop.ts`, `scene-renderer.ts`, `particles.ts` | Same | Drawn in code from palette colors at fixed positions | 2026-10-11 |
| Pixel lights and vignette | `src/shared/light-levels.ts`, `pixels.ts` | Same | Computed: a stepped falloff with a 4 × 4 Bayer dither (`light-levels.test.ts`), tinted with palette colors | 2026-10-11 |
| Palette | `palette.ts` | DUEL (author and licence not recorded yet: `docs/art/palettes/duel.md`) | AF's default palette, read from `@automata/content/palette`; `art.test.ts` checks every colour the art uses. Replaces Endesga 64 (2026-11-07, Owner: "2D should also use the duel palette") | 2026-11-07 |
| Remap to DUEL | `sprites.ts`, `backdrop.ts`, `scene.ts`, `particles.ts`, `scene-renderer.ts`, `style.css` | Claude (AI coding agent), 3D slice task 5.2 | Every Endesga 64 colour became its nearest DUEL colour in OKLab (`tooling/codemods/src/remap-palette.ts`); hand fixes are listed below | 2026-11-07 |
| Pixelify Sans (screens' type) | `@fontsource/pixelify-sans` 5.3.0 | Stefie Justprince, via Fontsource | OFL-1.1, bundled by Vite | 2026-10-11 |

Why pixel maps rather than a generation API: the base's sprites are tiny (8 × 8 and 16 × 16) and must use the palette exactly. Image generators produce off-palette, anti-aliased output that would need quantizing and cleanup by hand, so the art was authored directly on the palette instead. The Owner may still replace any of it; generated art goes through the `pipelines` gates once they exist (M3), with its provenance recorded here.

Look (second pass, 2026-10-11): the first pass read as a Bubble Bobble and Celeste clone (a bubble-blowing blob with a red scarf, pink bricks, a bubble goal), and the Owner asked for something less derivative and more like a current itch.io hit. Now: Wick, a hooded wanderer with glowing eyes and a lantern, climbs mossy ruins at night to an ember. Modern pixel-art treatment: colored outlines and rim light, a multiplied light map with dithered pixel lights (lantern, ember, mushrooms, fireflies, moon), light shafts, parallax layers, a vignette, afterimages, landing shake and sparks. Bubble Bobble (one single-screen room) and Celeste (movement feel, squash and stretch, dust) remain as influences, not as copied motifs. Owner acceptance of the look is open.

Hand fixes after the remap to DUEL (2026-11-07): the nearest DUEL colour to Endesga's near-black purple `#0e071b` is a plum (`#2e1026`, 104), which turned the page's letterbox and the near trees red-brown; the near trees, the night vignette, the dark under the hood and the page background use DUEL's dark grey `#1d1d21` (224) instead.
