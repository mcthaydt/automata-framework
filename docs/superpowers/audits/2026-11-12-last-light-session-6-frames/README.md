# The prologue after the outfits, the baked light for models and the LCD panel and retro grade (stage 4 session 6, 2026-11-12)

Chromium on software GL (SwiftShader), a desktop context for the first three and a phone held sideways with a finger for the touch
pair. Our frames are on the tree at the commit that adds this folder. The old game's frames are the first session's
(`../2026-11-12-last-light-prologue-first-draw/old-play-1024x768.png`, `old-cutscene-1024x768.png`: the old game's own shoot,
`?debug`, which keeps its authored 640 by 480 picture and fills the window).

| File | What |
|---|---|
| `side-by-side-play.png` | Old left, ours right: the hall in play, Ada's back to the camera at the spawn |
| `side-by-side-cutscene.png` | Old left, ours right: the opening cutscene as its first line is typed |
| `generated-against-meshes-play.png` | Ours with the generated blockouts (left) and with the old game's meshes (right), same frame |
| `ours-play-1024x768.png`, `ours-cutscene-1024x768.png`, `ours-generated-play-1024x768.png` | The single frames |
| `ours-touch-play-844x390.png`, `ours-touch-cutscene-844x390.png` | A phone: the floating stick under the thumb's rest; the camera turns on a swipe (a gesture, not drawn) |

## Numbers (mean luma 0 to 255, measured from the files)

| | Old | Ours |
|---|---|---|
| The room, without Ada (old: the frame less the minimap and the objective line; ours: the 640 by 480 picture) | 29.4 | 46.1 |
| Ada (shirt and trousers) over the floor at her feet | 0.60 | 0.46 |

Ada's boxes, in full-frame pixels (x0-x1, y0-y1): old shirt 565-590 by 516-545, trousers 565-590 by 555-610, floor 520-545 and 610-640 by 470-620; ours shirt 543-563 by 458-480, trousers 543-563 by 488-528, floor 505-525 and 585-605 by 430-545. They are not the first session's boxes (its old figure read 0.74 by its own), so the ratio compares only
old and ours by the same boxes: ours is now darker than the floor under her, as the old is (it was 1.11 on the first session's boxes), at
0.77 of the old ratio. The room is 1.6 times the old room (it was 2.1: mean 63 against 33 before the LCD panel and the grade).

## The models against the generated props (the same frame, the same pixels)

| | Generated | Meshes, before (session 5) | Meshes, now |
|---|---|---|---|
| Bench | 49.7 | 0.70 of it | **0.80** |
| Clock and TV | 29.2 | 0.65 | **0.82** |
| Bed and table | 70.7 | 0.88 | **0.87** |
| The floor beside them | 43.4 | 1.0 | 1.0 |

The models still read below the generated props, by their own albedo: a model's texture (mean luma 96) is not the swatch the generated
prop uses, and these boxes take in what stands behind and on them. The lighting itself is the same now: a model beside a generated prop of
the same albedo under the same lamp reads 1.05 of it, held to 0.92 to 1.08 by `world-view-models.test.ts`.

## After the coordinator's rulings: the old game's scale rule and black bars (`after-scale-rule/`)

The picture's size is chosen from the window by the old game's `letterboxScale` (`app/field.ts`; the table test's expected values are the old
function's own output): 1024 by 768 is 2x of 512 by 384, 1280 by 720 is 2x of 640 by 360, 1920 by 1080 is 3x, 844 by 390 is 2x of 422 by 195, 1366 by 768
is 2x of 640 by 384 (bars of 43 px each side), 844 by 390 at device ratio 3 is 4x of 633 by 292. The bars round the picture are black (`BAR_COLOR` in
`app/look.ts`, handed to the renderer as `barColor`; the page is `--void: #000000` in `style.css`, with the weight of `:root` because the
framework's theme paints the page DUEL's navy surface after the game's file loads). Nothing the look draws changed: the clear colour inside the picture, the
vignette and the fog's far colour are as they were.

| File | What |
|---|---|
| `side-by-side-play.png`, `side-by-side-cutscene.png` | Old left, ours right at 1024 by 768: the picture fills the window at 2x |
| `ours-touch-play-844x390.png`, `ours-touch-cutscene-844x390.png` | A phone: 422 by 195 at 2x, the floating stick |
| `resized-1024x768-to-1280x720.png`, `resized-1024x768-to-640x480.png` | **What a resize does today:** the field is chosen when the game starts and then kept, so the same 512 by 384 picture is drawn at the largest whole scale that fits the new window (1x in both here), centred, in black |

Measured on `ours-play-1024x768.png`: the room without Ada, 47.6 (old 29.4). Ada stands 180 px tall, 90 lines of the 384-line field (23.4%); the old game's real play
at 1024 by 768 is the same field and scale, and its Ada in the first session's `?debug` frame (a 480-line picture stretched to the window) is 156 px, 97 lines of 480 (20.3%), which is 78
lines of 384. So ours is 1.15 times the old Ada's height by this measure (the figure's own cell height is 112 lines against the old 109: the difference is in what each measure includes, not
in the sprite), and a smaller field shows less of the room, as in the old game.

### The resize, and the smallest core shape (a proposal, not built)

Before this session's core fix (`784aa1dd5`) a 512 by 384 field in a 1280 by 720 view was drawn at 2x from the width alone, 768 lines tall in a 720 view, cut at the top
and the bottom. It now takes the tighter side and is 1x with bars. What still cannot happen is the field following the window: `size` is read once. The smallest shape: `defineGame({ size })`
may be a function of the view (`({ width, height, ratio }) => ({ width, height })`) that the boot calls on start and on every resize or turn, and the renderer re-makes its
letterbox and resizes its render target; a game whose field is fixed passes the object as today.

## Seen earlier, before the rule

- **The picture is small in a 1024 by 768 window.** `crispRendererOptions(CRISP_CLINIC)` is core's `scale: 'whole'`, which floors: the 640 by
  480 field is drawn at 1x with black bars (and the DOM overlay's words sit on the bars). The old game's play chose a whole scale that filled
  at least 80% of the window and a smaller picture when needed (`letterboxScale`: 2x at 512 by 384 here), and its `?debug` shoot stretched
  to fill, which is why the old frame fills the window. A 1280 by 720 or 1920 by 1080 window is exactly 2x and 3x of 640 by 360. The
  field is fixed when the game starts, so the 80% rule cannot be had from the game alone: a decision for the coordinator.
- A phone's picture is 640 by 296 at 1x inside 844 by 390, for the same reason.
