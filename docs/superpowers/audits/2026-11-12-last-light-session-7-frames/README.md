# The prologue against the old game's real play (stage 4 session 7, 2026-11-12)

Chromium on software GL (SwiftShader), a desktop context at 1024 by 768. **The old frames are the old game's real play** (`92e6704`, no
`?debug`, `?renderer=webgl&scene=prologue`, the real clock, started at the title's Begin), not the `?debug` frames of the earlier folders,
which keep a 640 by 480 picture stretched to the window. Ours are on the tree at the commit that adds this folder.

| File | What |
|---|---|
| `side-by-side-play.png`, `side-by-side-cutscene.png` | Old left, ours right, same window |
| `old-real-play-1024x768.png`, `old-real-cutscene-1024x768.png` | The old game's real play, 40 s and 10 s after Begin (its opening starts with a clip and a title card; the first line is typed at about 10 s) |
| `ours-play-1024x768.png`, `ours-cutscene-1024x768.png` | Ours |
| `old-real-handover-14s-to-28s.png` | The old opening's last frames and its first play frames (14, 16, 18, 20, 22, 23, 24, 25, 26, 27, 28 s): Ada faces us in the last cutscene frames, turns, and stands with her back to the camera in play |

## Ada's facing (item 4)

The old game shows Ada facing us at the end of the opening and her back to the camera from its first play frames on; the old opening's
last key is `facing: 0` and its spawn is pi. Ours does both (`tests/unit/features/ada/facing.test.ts`): the opening's last key is 0, and
the heading play starts with is pi. An earlier reading, that she stays facing us in play, is not what the old game shows.

## The LCD grid (item 5)

The mesh's period, measured from the screenshots' pixels (the dominant period of the brightness profile of a floor patch, both axes):

| | Cell | Mesh period |
|---|---|---|
| Old, real play at 1024 by 768 | 2 screen pixels | **4.0** both axes |
| Ours before this session | 4 screen pixels (`cell` 2 field pixels at 2x) | **8.0** (7.9 to 8.2 x, 7.6 to 8.4 y) |
| Ours now (`cell = 1` in `content/look.toml`) | 2 screen pixels | **6.0** both axes |

The earlier folders compared the old `?debug` frame (3.2 px a cell) with ours at another scale, and the old game's real grid is finer than
either. The old game drew the panel on the screen's own pixels (`LCD_CELL` 2, a mesh of 4); ours draws it on the field, which the window
shows at a whole scale (2x here). A 2-pixel cell is one field pixel, which `content/look.toml` now says. A 4-pixel mesh is 2 field pixels,
the Nyquist limit, where the pass fades the mesh to nothing (`fade` 0 at 0.5 cycles a pixel), so the finest mesh the field can show is 3
field pixels, 6 on the screen. Matching the old 4 needs the panel drawn after the letterbox's upscale, on screen pixels: a core shape (a
pass that runs on the screen), not content, and not built (an open proposal).

## The wall (item 6)

`wall-before-after-play.png` (before left, after right; `ours-play-wall-1024x768.png` is the after). The old wall is two bands: a glazed
tile to 1.14 m (`DEFAULT_TRIM.wainscot`) under plaster. Ours is now two bands too: the level's solid walls of the rooms with the old
default trim (17 walls) carry a `dado` of the game's new `ward-wainscot` swatch (`content/world-swatches/ward-wainscot.toml`) at 1.14 m,
under the `ward-plaster` above. It reads on the east wall behind the desk and the west wall. The contrast is low because both bands
are the sand ramp, and the desk lamp's pool is the old game's (`#ffb866`, 5 m, level 1.05), so it still lands warm and wide on the sand.

What the palette has and lacks:

| Old colour | Where | Nearest DUEL step | Distance (RGB / Lab) |
|---|---|---|---|
| `#ccc3b1`, the tile's base | `src/render/assets.ts`, wainscot canvas | sand 5 `#ccc3b1`, **exact** | 0 / 0 |
| `#858667`, the plaster's mean | `public/art/plaster.png` | sand 1 `#857565` | 17.1 / 11.9 |
| | | by Lab, `#9e8a6e` (ramp 12 step 5) | 26.3 / 9.7 |

So the gap is the plaster's olive alone: no DUEL step is olive-khaki (the ramps with olive, 20 and 23, are far more saturated or darker).
The wainscot has no gap: the old tile is cream, and it looked teal in the old frames because the old room's green light and grade lay over
it. Ours keeps sand 1 for the plaster (the nearest by RGB, as before). The editor gaps ledger's row 16 says so.
