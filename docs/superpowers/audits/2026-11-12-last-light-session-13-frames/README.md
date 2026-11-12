# The Last Light, session 13: figures painted at the density the camera needs

Chromium on software GL (SwiftShader, `AF_WEBGPU=software`), 1024 by 768 for frames (a field of 512 by 384, shown at 2x). WebKit, Firefox and a real GPU did not run. "Before" is `8e026f55` (the merge of the builders fold), shot from a separate worktree so no edit could touch it; "after" is `76c14834`, and the face frames are `8db04840`. The whole frames (`ours-opening-t5`, `ours-opening-t8` and `ours-lightsOut-t4, t8, t11, t14`) were shot by `tests/e2e/shots.test.ts` and are in the session's scratch folder, not in the repository; the four pictures here are crops of them and one sheet of the painter's own cells.

**The bar is not met by any frame the game's cameras make.** The pictures are better, not good: see "Why" below.

## The pictures

| File | What it shows |
| --- | --- |
| `crop-opening-t5-before-after.png` | Ada in the opening at 5 s, 4x. Left, before (density 1): coarse blocks, the face a flat grey-violet patch with a dark blob. Right, after (density 2, her dot face): a clean one-texel outline and the hair a shaded mass; the face is still two dots on lavender. |
| `crop-nurse-t11-before-after.png` | The lights-out nurse in the doorway at 11 s, 4x. After: finer texels, a real hair silhouette, arms and the stained hem. She is faceless by design, and the room is dark. |
| `faces-ada-sheet.png` | The painter's own cells of Ada's head at densities 1, 2, 4 and 8 (left to right), `face.drawn` false (top) and true (bottom), unlit and unpassed. With `drawn: true` the face at density 2 has brows, lidded eyes with whites, a nose and a mouth; at 4 and 8 it is the clean, planar, large face asked for: slit eyes under a lid line, thin brows, a nose plane, a one-row mouth, the hair a clean three-tone mass, no specks. **The painter meets the bar; the game never shows it.** |
| `crop-ada-variants.png` | Five frames of Ada's head in the opening at 5 s, 3x: before (density 1); density 2 with her dot face; density 2 with her drawn face (`8db04840`); the drawn face with the LCD panel off; the drawn face with the LCD panel and the retro grade off (a temporary switch in `look-passes.ts`, never committed). |

## Numbers

**Zoom of each shot** (the screen pixels one density-1 texel covers at the figure, `zoomOf`; computed from the camera keys in `content/cutscenes/*.toml` on the 384-line field, not logged in the game; the frames agree: Ada about 145 field pixels tall, her head about 23):

| Shot | Camera | Distance | Zoom | Density `densityFor` gives |
| --- | --- | --- | --- | --- |
| Play | 50 mm, 52 lines a metre | 16 m | 1.4 | 1 (the old game's) |
| Opening, Ada, 4.6 to 11 s | lens 21 to 24 | about 3.9 m | about 2.3 to 2.7 | 2 |
| Every other shot read (lens 21 to 41) | | 3 to 6 m | about 2 to 3.4 | 2 |

Density 4 needs a zoom of 4 or more, density 8 a zoom of 8: a camera 1.7 to 3.5 times closer than the opening's. A texel is never minified, so `'auto'` cannot make a far shot sharp.

**Paint cost and cell size** (Node on this container's CPU; a new pose raster per call; the first paint of any new figure costs 0.5 to 0.9 s with the JIT and the build):

| Density | Cell | Full cell (colours, normals, depth) | New pose | 
| --- | --- | --- | --- |
| 1 | 64 by 96 | 0.07 MB | 26 ms |
| 2 | 128 by 192 | 0.28 MB | 44 ms |
| 4 | 256 by 384 | 1.13 MB | 100 to 113 ms |
| 6 | 384 by 576 | 2.5 MB | 200 to 236 ms |
| 8 | 512 by 768 | 4.5 MB | 390 to 460 ms |

**What the cache holds.** The painter's `Figure` keeps one cell for each pose key (outfit, facing, camera pitch, walk phase or idle step, face tags, blink, head lead, hair swing) up to 384 cells, its own constant (`CELLS` in `figure.ts`), not changed. The kit keeps one `Painter` (so one `Figure`) for each density a figure has been seen at, and 32 lit cells for each painter. A density not drawn for 10 seconds is dropped, so a close shot's density does not stay after the shot. The ceiling for one painter is 384 cells times the full cell above (density 4 about 430 MB, density 8 about 1.7 GB), reached only by a figure that shows 384 distinct poses. **The real size of a walk's cache was not measured**, and the cap is a count of cells, not bytes.

## Why the close shot still fails

1. **The camera.** The shot is a zoom of about 2.3 to 2.7, so density 2: the head is about 23 field pixels, the face about 12.
2. **The cast.** Ada's `face.drawn: false` (the drawn face hides under her fringe at density 1). Fixed in `8db04840` through `defFor(density)`: her drawn face from density 2.
3. **The LCD panel and the grade** barely change the face (frames 4 and 5 of `crop-ada-variants.png`). The mesh chops one-pixel features; the lavender is not theirs. The DUEL snap and dither were not tested off.
4. **The skin's tint.** The painter's bare skin is pink; in the room it is lavender in all five frames, including with the LCD and the grade off. It comes from the room's baked light on the figure or from the palette snap. **Not investigated, not fixed.**

## For the next session

- The lavender skin: shoot one frame with `lit: false` to separate the room's light from the snap; a face must keep its skin hue.
- A pure `cameraAt(t + lead)` on the director so the kit can paint a cut's density before the cut lands (today `stateAt` starts cues, so it cannot be peeked).
- Re-frame the opening's shot of Ada speaking as a head and shoulders close-up (zoom about 8, density 8, a head near 100 field pixels), and give each cutscene at least one such close-up where a figure speaks or is revealed. The game's `maxDensity` is the kit's default 4 until then.
- Measure a walk's cache and cap it by bytes.
