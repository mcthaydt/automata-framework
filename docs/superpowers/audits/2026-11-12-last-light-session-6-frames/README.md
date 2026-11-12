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

Ada's boxes are the ones in the notes of this commit's message: the shirt and the trousers inside her figure, the floor on either side
of her over the same rows. They are not the first session's boxes (its old figure read 0.74 by its own), so the ratio compares only
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

## Seen, and not changed

- **The picture is small in a 1024 by 768 window.** `crispRendererOptions(CRISP_CLINIC)` is core's `scale: 'whole'`, which floors: the 640 by
  480 field is drawn at 1x with black bars (and the DOM overlay's words sit on the bars). The old game's play chose a whole scale that filled
  at least 80% of the window and a smaller picture when needed (`letterboxScale`: 2x at 512 by 384 here), and its `?debug` shoot stretched
  to fill, which is why the old frame fills the window. A 1280 by 720 or 1920 by 1080 window is exactly 2x and 3x of 640 by 360. The
  field is fixed when the game starts, so the 80% rule cannot be had from the game alone: a decision for the coordinator.
- A phone's picture is 640 by 296 at 1x inside 844 by 390, for the same reason.
