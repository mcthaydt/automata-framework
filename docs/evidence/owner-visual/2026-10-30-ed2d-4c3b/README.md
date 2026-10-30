# ED2D.4c3b: the Pixi level canvas, images for review (2026-10-30)

Written by `packages/editor-2d/src/canvas/level-visuals.canvas.test.ts` with `ED2D_VISUALS=1 pnpm --filter @mcthaydt/automata-editor-2d test:canvas level-visuals`, in headless Chromium (Playwright 1.63, WebGL2 through SwiftShader), on branch `claude/editors-ed2d-4c3b-pixi-canvas`. They show what the canvas draws; they are not goldens and nothing compares against them (2D editor spec §14). The samples are Mossgate and Hollowmere (`src/testing/samples.ts`), whose tilesets are placeholders (ED2D-D11). Real devices (iPad Safari, Pencil) stay with the Owner.

| Image | What it shows | What to look for |
|---|---|---|
| `level-mossgate-placeholders.png` | Mossgate's first level at 554 × 602 (the Level view's canvas on an iPad 11" landscape), fitted and centred; the collision layer active with a 2 × 2 brush hovering | Numbered flat placeholder tiles in the fixed twelve colours; the IntGrid layer under them; entities as boxes, ellipses and points in their colours with their names (on a dark halo); the 16 px grid of the active layer; the brush footprint as an accent square |
| `level-hollowmere-placeholders.png` | Hollowmere's first level, entities layer active, the first entity selected | The selection outline in the accent colour; tile 0 shown as a numbered placeholder too (never a blank) |
| `level-mossgate-image-tiles.png` | Mossgate with its tileset given an image in the workspace (a generated PNG of flat cells, lighter or darker than each placeholder colour) | Tiles are frames of the image: no numbers, nearest-neighbour scaling, same placement as the placeholders |
| `level-mossgate-image-missing.png` | Mossgate whose tileset names an image the workspace does not have | The same numbered placeholders as with no image, and no error (spec §13) |
| `level-before-pause.png`, `level-paused.png` | The canvas, then its WebGL context lost | "Preview paused" over the canvas's background; the lost canvas is hidden (Chromium paints it white with a broken-image glyph) |
| `home-thumbnails-1194x834.png` | Home with both samples | Each card's 48 px tile shows its first level, fitted, instead of the initial |

Regenerated after the review fixes of 2026-10-30 (entity names now have a dark halo; nothing else changed in what is drawn).

**Visual acceptance** (2026-10-30): recorded under the Owner's "Auto approve all visual acceptance too"; the coordinator's review opened all seven images and found each correct.
